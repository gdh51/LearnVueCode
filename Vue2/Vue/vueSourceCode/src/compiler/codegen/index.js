/* @flow */

import {
    genHandlers
} from './events'
import baseDirectives from '../directives/index'
import {
    camelize,
    no,
    extend
} from 'shared/util'
import {
    baseWarn,
    pluckModuleFunction
} from '../helpers'
import {
    emptySlotScopeToken
} from '../parser/index'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;

export class CodegenState {
    options: CompilerOptions;
    warn: Function;
    transforms: Array < TransformFunction > ;
    dataGenFns: Array < DataGenFunction > ;
    directives: {
        [key: string]: DirectiveFunction
    };
    maybeComponent: (el: ASTElement) => boolean;
    onceId: number;
    staticRenderFns: Array < string > ;
    pre: boolean;

    constructor(options: CompilerOptions) {
        this.options = options;
        this.warn = options.warn || baseWarn;

        // 获取module中的所有的transformCode方法(这里没有)
        this.transforms = pluckModuleFunction(options.modules, 'transformCode');

        // 获取module中所有的genData方法(这里有两个)
        this.dataGenFns = pluckModuleFunction(options.modules, 'genData');

        // 获取所有的指令方法
        this.directives = extend(extend({}, baseDirectives), options.directives);

        //  是否为原生标签
        const isReservedTag = options.isReservedTag || no;

        // 一个检测函数用于查看是否为组件
        this.maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag);
        this.onceId = 0;
        this.staticRenderFns = [];
        this.pre = false;
    }
}

export type CodegenResult = {
    render: string,
    staticRenderFns: Array < string >
};

export function generate(
    ast: ASTElement | void,
    options: CompilerOptions
): CodegenResult {

    // 创建一个代码的状态栈
    const state = new CodegenState(options);

    // 生成render函数的字符串
    const code = ast ? genElement(ast, state) : '_c("div")';

    // 返回渲染接口
    return {
        render: `with(this){return ${code}}`,
        staticRenderFns: state.staticRenderFns
    };
}

export function genElement(el: ASTElement, state: CodegenState): string {

    // 处理v-pre属性，父级元素有时，子元素会继承
    if (el.parent) {
        el.pre = el.pre || el.parent.pre;
    }

    // 按序处理以下属性，返回其渲染函数

    // 处理静态根节点
    if (el.staticRoot && !el.staticProcessed) {
        return genStatic(el, state);

    // 处理v-once节点
    } else if (el.once && !el.onceProcessed) {
        return genOnce(el, state);

    // 处理v-for和v-if两个结构属性
    } else if (el.for && !el.forProcessed) {
        return genFor(el, state);
    } else if (el.if && !el.ifProcessed) {
        return genIf(el, state);

    // 处理子元素节点
    // 处理非静态节点中的template元素
    } else if (el.tag === 'template' && !el.slotTarget && !state.pre) {
        return genChildren(el, state) || 'void 0';
    } else if (el.tag === 'slot') {

        // 处理slot元素
        return genSlot(el, state);
    } else {

        // component or element
        let code;

        // 处理动态组件
        if (el.component) {
            code = genComponent(el.component, el, state)
        } else {

            // 处理元素
            let data;

            // 如果元素不平坦或为静态组件
            if (!el.plain || (el.pre && state.maybeComponent(el))) {
                data = genData(el, state);
            }

            // 增对非内联模版，要处理其子节点
            const children = el.inlineTemplate ? null
                : genChildren(el, state, true);


            // 返回该节点与子节点处理结果的渲染函数
            code = `_c('${el.tag}'
                ${data ? `,${data}` : ''}
                ${children ? `,${children}` : ''})`
        }

        // module transforms
        for (let i = 0; i < state.transforms.length; i++) {
            code = state.transforms[i](el, code)
        }
        return code
    }
}

// hoist static sub-trees out
function genStatic(el: ASTElement, state: CodegenState): string {

    // 添加已处理的标记位
    el.staticProcessed = true;

    // Some elements (templates) need to behave differently inside of a v-pre
    // node.  All pre nodes are static roots, so we can use this as a location to
    // wrap a state change and reset it upon exiting the pre node.
    // 一些元素需要在v-pre节点中表现得不同；全部v-pre节点都是静态根节点，所以我们可以将其作为一个位置
    // 来处理其状态的变换，并在退出该pre节点时重置它。

    // 最初的状态栈中pre的状态
    const originalPreState = state.pre;

    // 如果当前元素为v-pre元素，则暂时用当前元素的状态替换其状态
    if (el.pre) {
        state.pre = el.pre;
    }

    // 将当前节点的渲染函数加入渲染函数队列中，递归对该节点调用处理函数，处理其余属性
    state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`);

    // 处理完整个该元素时，还原最初栈的状态
    state.pre = originalPreState;

    // 返回该节点处理结果生成的_m()函数
    return `_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}

// v-once
function genOnce(el: ASTElement, state: CodegenState): string {
    el.onceProcessed = true;

    // 对于v-once元素优先处理其if属性
    if (el.if && !el.ifProcessed) {
        return genIf(el, state);

        // 该元素是否处于具有v-for属性的静态节点中
    } else if (el.staticInFor) {
        let key = '';
        let parent = el.parent;

        // 找到该静态节点的key值字符串表达式
        while (parent) {
            if (parent.for) {
                key = parent.key;
                break;
            }
            parent = parent.parent;
        }

        // 没有key值则报错，v-once只能在拥有key值的静态节点的v-for中使用
        if (!key) {
            process.env.NODE_ENV !== 'production' && state.warn(
                `v-once can only be used inside v-for that is keyed. `,
                el.rawAttrsMap['v-once']
            )
            return genElement(el, state)
        }

        // 处理其他属性
        return `_o(${genElement(el, state)},${state.onceId++},${key})`
    } else {

        // 默认情况作为静态节点处理
        return genStatic(el, state);
    }
}

export function genIf(
    el: any,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {
    el.ifProcessed = true; // avoid recursion
    return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

function genIfConditions(
    conditions: ASTIfConditions,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {

    // 不存在if条件块，返回一个空函数
    if (!conditions.length) {
        return altEmpty || '_e()';
    }

    const condition = conditions.shift();

    // 具有if条件表达式时，生成条件语句块
    if (condition.exp) {

        // 根据if条件语句块来就行下一个函数的生成
        // 为true时，进入当前的block块，为false时，继续检查下一个if块
        // 结果就为多个三元语句的嵌套
        return `(${condition.exp})?${genTernaryExp(condition.block)}
            :${genIfConditions(conditions, state, altGen, altEmpty)}`
    } else {

        // 没有if条件表达式时，直接生成渲染函数即可
        return `${genTernaryExp(condition.block)}`;
    }

    // v-if with v-once should generate code like (a)?_m(0):_m(1)
    // 生成三元表达式
    function genTernaryExp(el) {

        // 具有指定的生成器时，则调用，否则检测是否具有once属性，在处理其他属性
        return altGen ? altGen(el, state) :
            (el.once ? genOnce(el, state) : genElement(el, state));
    }
}

export function genFor(
    el: any,
    state: CodegenState,

    // 指定的gen函数
    altGen ? : Function,

    // 指定的helper函数
    altHelper ? : string
): string {

    // 分别找到v-for表达式中的变量名
    const exp = el.for;
    const alias = el.alias;
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : '';
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : '';

    // 如果组件使用v-for则必须指定key值
    if (process.env.NODE_ENV !== 'production' &&
        state.maybeComponent(el) &&
        el.tag !== 'slot' &&
        el.tag !== 'template' &&
        !el.key
    ) {
        state.warn(
            `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
            `v-for should have explicit keys. ` +
            `See https://vuejs.org/guide/list.html#key for more info.`,
            el.rawAttrsMap['v-for'],
            true /* tip */
        )
    }

    // 添加已处理标记位
    el.forProcessed = true; // avoid recursion
    return `${altHelper || '_l'}((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +

        // 调用指定的gen函数或genElement继续处理元素剩下的属性
        `return ${(altGen || genElement)(el, state)}` +
        '})';
}

export function genData(el: ASTElement, state: CodegenState): string {
    let data = '{'

    // directives first.
    // directives may mutate the el's other properties before they are generated.
    // 优先处理指令，因为它可能会影响元素的其他属性
    const dirs = genDirectives(el, state);
    if (dirs) data += dirs + ',';

    // key
    if (el.key) {
        data += `key:${el.key},`
    }
    // ref
    if (el.ref) {
        data += `ref:${el.ref},`
    }
    if (el.refInFor) {
        data += `refInFor:true,`
    }
    // pre
    if (el.pre) {
        data += `pre:true,`
    }

    // record original tag name for components using "is" attribute
    // 为组件记录最初使用is属性时赋予的标签名
    if (el.component) {
        data += `tag:"${el.tag}",`
    }

    // module data generation functions
    // 处理style和class属性，也生成上述类似的对象
    for (let i = 0; i < state.dataGenFns.length; i++) {
        data += state.dataGenFns[i](el);
    }

    // attributes
    // 转义属性中的换行符
    if (el.attrs) {
        data += `attrs:${genProps(el.attrs)},`
    }

    // DOM props
    if (el.props) {
        data += `domProps:${genProps(el.props)},`
    }

    // event handlers
    // 生成该元素的自定义事件处理器键值对
    if (el.events) {
        data += `${genHandlers(el.events, false)},`
    }

    // 生成该元素的原生事件处理器键值对
    if (el.nativeEvents) {
        data += `${genHandlers(el.nativeEvents, true)},`
    }

    // slot target
    // only for non-scoped slots
    // 生成插槽目标，只为无指定属性的插槽生成
    if (el.slotTarget && !el.slotScope) {
        data += `slot:${el.slotTarget},`
    }

    // scoped slots
    // 元素具有插槽作用域时，生成其插槽指定属性的表达式
    if (el.scopedSlots) {
        data += `${genScopedSlots(el, el.scopedSlots, state)},`
    }
    // component v-model
    // 组件具有v-model双向绑定时，添加model键值对
    if (el.model) {
        data += `model:{value:${el.model.value},callback:${
            el.model.callback},expression:${el.model.expression}},`
    }
    // inline-template
    if (el.inlineTemplate) {
        const inlineTemplate = genInlineTemplate(el, state)
        if (inlineTemplate) {
            data += `${inlineTemplate},`
        }
    }
    data = data.replace(/,$/, '') + '}'
    // v-bind dynamic argument wrap
    // v-bind with dynamic arguments must be applied using the same v-bind object
    // merge helper so that class/style/mustUseProp attrs are handled correctly.
    if (el.dynamicAttrs) {
        data = `_b(${data},"${el.tag}",${genProps(el.dynamicAttrs)})`
    }
    // v-bind data wrap
    if (el.wrapData) {
        data = el.wrapData(data)
    }
    // v-on data wrap
    if (el.wrapListeners) {
        data = el.wrapListeners(data)
    }
    return data;
}

function genDirectives(el: ASTElement, state: CodegenState): string | void {
    const dirs = el.directives;
    if (!dirs) return;
    let res = 'directives:['
    let hasRuntime = false;
    let i, l, dir, needRuntime;
    for (i = 0, l = dirs.length; i < l; i++) {
        dir = dirs[i];
        needRuntime = true;

        // 匹配原生指令
        const gen: DirectiveFunction = state.directives[dir.name];
        if (gen) {
            // compile-time directive that manipulates AST.
            // returns true if it also needs a runtime counterpart.
            // 操作AST的编译时的指令，返回true表示仍需要运行时的副本
            needRuntime = !!gen(el, dir, state.warn);
        }


        if (needRuntime) {
            hasRuntime = true;

            // 每次循环的res的结果为 {...指令属性},  分隔
            res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
                dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
            }${
                dir.arg ? `,arg:${dir.isDynamicArg ? dir.arg : `"${dir.arg}"`}` : ''
                    }${
                dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
            }},`;
        }
    }
    if (hasRuntime) {

        // 返回全部指令对象组成的数组字符串
        return res.slice(0, -1) + ']';
    }
}

function genInlineTemplate(el: ASTElement, state: CodegenState): ? string {

    // 使用内联模版，也必须只有一个根元素
    const ast = el.children[0];

    // 拥有多个根元素时或唯一的节点不为元素，报错
    if (process.env.NODE_ENV !== 'production' && (
            el.children.length !== 1 || ast.type !== 1
        )) {
        state.warn(
            'Inline-template components must have exactly one child element.', {
                start: el.start
            }
        )
    }

    // 调用generate生成单独的渲染函数
    if (ast && ast.type === 1) {
        const inlineRenderFns = generate(ast, state.options)
        return `inlineTemplate:{render:function(){${
            inlineRenderFns.render
            }},staticRenderFns:[${
            inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`)
                                     .join(',')}]}`;
    }
}

function genScopedSlots(
    el: ASTElement,
    slots: {
        [key: string]: ASTElement
    },
    state: CodegenState
) : string {

    // by default scoped slots are considered "stable", this allows child
    // components with only scoped slots to skip forced updates from parent.
    // but in some cases we have to bail-out of this optimization
    // for example if the slot contains dynamic names, has v-if or v-for on them...
    // 确认是否需要强制更新
    let needsForceUpdate = el.for || Object.keys(slots).some(key => {
        const slot = slots[key];

        // 只要有一个插槽具有v-for或v-if或具有动态插槽名称
        // 或子元素中还存在slot元素都需要强制更新
        return (
            slot.slotTargetDynamic ||
            slot.if ||
            slot.for ||
            containsSlotChild(slot) // is passing down slot from parent which may be dynamic
        )
    })

    // #9534: if a component with scoped slots is inside a conditional branch,
    // it's possible for the same component to be reused but with different
    // compiled slot content. To avoid that, we generate a unique key based on
    // the generated code of all the slot contents.
    // 如果一个带有插槽作用域的组件存在if条件语句中，那么它有时编译时，即使是同一个组件也
    // 会编译出不同的插槽内容。因此，为了解决这个问题，我们为它生成了一个基于全部插槽内容的唯一的key
    let needsKey = !!el.if;

    // OR when it is inside another scoped slot or v-for (the reactivity may be
    // disconnected due to the intermediate scope variable)
    // #9438, #9506
    // TODO: this can be further optimized by properly analyzing in-scope bindings
    // and skip force updating ones that do not actually use scope variables.
    // 或当其处于另一个作用域插槽或v-for中
    if (!needsForceUpdate) {
        let parent = el.parent;
        while (parent) {

            // 父级拥有具名插槽或存在v-for属性，也需要强制更新
            if (
                (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
                parent.for
            ) {
                needsForceUpdate = true;
                break;
            }

            // 父级存在if条件块中，需要独立的key来防止重新编译
            if (parent.if) {
                needsKey = true;
            }
            parent = parent.parent;
        }
    }

    // 为每个插槽生成插槽函数表达式
    const generatedSlots = Object.keys(slots)
        .map(key => genScopedSlot(slots[key], state))
        .join(',')

    // 根据是否需要强制更新和key来生成最后的函数
    return `scopedSlots:_u([${generatedSlots}]${
    needsForceUpdate ? `,null,true` : ``
  }${
    !needsForceUpdate && needsKey ? `,null,false,${hash(generatedSlots)}` : ``
  })`
}

// times33 散列函数
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i)
    }
    return hash >>> 0;
}

function containsSlotChild(el: ASTNode): boolean {
    if (el.type === 1) {
        if (el.tag === 'slot') {
            return true
        }
        return el.children.some(containsSlotChild)
    }
    return false;
}

function genScopedSlot(
    el: ASTElement,
    state: CodegenState
): string {

    // 是否具有废弃的2.5语法
    const isLegacySyntax = el.attrsMap['slot-scope'];

    // 如未处理v-if属性，则优先处理该属性，处理完后再调用该方法处理插槽属性
    if (el.if && !el.ifProcessed && !isLegacySyntax) {
        return genIf(el, state, genScopedSlot, `null`)
    }

    // 如未处理v-for属性，则优先处理该属性，处理完后再调用该方法处理插槽属性
    if (el.for && !el.forProcessed) {
        return genFor(el, state, genScopedSlot)
    }

    // 获取插槽的作用域(其实就是指定的值，给插槽赋的值)
    const slotScope = el.slotScope === emptySlotScopeToken ? `` : String(el.slotScope);

    // 两种情况：非模版元素，调用genElement生成渲染函数
    // 模版元素：不具有v-if且非废弃语法，则调用genChildren对子元素生成渲染函数
    const fn = `function(${slotScope}){` +
        `return ${el.tag === 'template'
      ? el.if && (isLegacySyntax ? `(${el.if})?${genChildren(el, state) || 'undefined'}:undefined`
                                 : genChildren(el, state))
              || 'undefined'
      : genElement(el, state)}
    }`

    // reverse proxy v-slot without scope on this.$slots
    // 为没有指定作用域的插槽，保留代理
    const reverseProxy = slotScope ? `` : `,proxy:true`;

    // 返回该插槽的对象字符串
    return `{key:${el.slotTarget || `"default"`},fn:${fn}${reverseProxy}}`
}

export function genChildren(
    el: ASTElement,
    state: CodegenState,
    checkSkip ? : boolean,
    altGenElement ? : Function,
    altGenNode ? : Function
): string | void {
    const children = el.children;

    // 前提存在子节点
    if (children.length) {
        const el: any = children[0];

        // optimize single v-for
        // 优化单独的v-for非插槽和模版节点
        if (children.length === 1 &&
            el.for &&
            el.tag !== 'template' &&
            el.tag !== 'slot'
        ) {

            // 确定标准化的类型，默认情况不指定类型；
            const normalizationType = checkSkip ?
                (state.maybeComponent(el) ? `,1` : `,0`) : ``;

            // 调用genElement继续对其他属性进行优化(就正常渲染不存在指定的gen函数)
            return `${(altGenElement || genElement)(el, state)}${normalizationType}`
        }

        // 具有多个子节点时检测其标准化类型
        const normalizationType = checkSkip ?
            getNormalizationType(children, state.maybeComponent) : 0;

        // 确认生成函数(genNode)
        const gen = altGenNode || genNode;

        // 分别对每个子节点调用genNode生成函数，组成render函数
        return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''}`
    }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
function getNormalizationType(
    children: Array < ASTNode > ,
    maybeComponent: (el: ASTElement) => boolean
): number {

    // 默认为不需要标准化
    let res = 0;
    for (let i = 0; i < children.length; i++) {
        const el: ASTNode = children[i];

        // 跳过元素节点
        if (el.type !== 1) {
            continue;
        }

        // 若该元素或同级if条件块元素中存在v-for属性或为template、slot元素则需要深度标准化
        if (needsNormalization(el) || (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
            res = 2;
            break;
        }

        // 若该元素或同级if条件块元素中的元素为组件，则进行简单的标准化
        if (maybeComponent(el) || (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
            res = 1;
        }
    }
    return res;
}

// 用于确认是否需要标准化
function needsNormalization(el: ASTElement): boolean {

    // 具有v-for或template、slot元素都需要进行标准化
    return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

// 根据节点类型，调用不同的生成器函数
function genNode(node: ASTNode, state: CodegenState): string {

    // 继续处理元素节点
    if (node.type === 1) {
        return genElement(node, state)

    // 处理注释节点
    } else if (node.type === 3 && node.isComment) {
        return genComment(node)
    } else {

        // 处理文本节点
        return genText(node)
    }
}

export function genText(text: ASTText | ASTExpression): string {

    // 根据是否属性节点(即插值表达式的文本)
    return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

export function genComment(comment: ASTText): string {
    return `_e(${JSON.stringify(comment.text)})`
}

function genSlot(el: ASTElement, state: CodegenState): string {
    const slotName = el.slotName || '"default"';

    // 获取子元素数组的渲染函数表达式(用作后备内容)
    const children = genChildren(el, state);
    let res = `_t(${slotName}${children ? `,${children}` : ''}`;

    // 获取插槽上的attribute属性
    const attrs = el.attrs || el.dynamicAttrs ?
        genProps((el.attrs || []).concat(el.dynamicAttrs || []).map(attr => ({

            // slot props are camelized
            // 将插槽上的属性驼峰化
            name: camelize(attr.name),
            value: attr.value,
            dynamic: attr.dynamic
        }))) : null;

    // 获取插槽的作用域(即绑定的属性)
    const bind = el.attrsMap['v-bind'];
    if ((attrs || bind) && !children) {
        res += `,null`
    }
    if (attrs) {
        res += `,${attrs}`
    }
    if (bind) {
        res += `${attrs ? '' : ',null'},${bind}`
    }
    return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent(
    componentName: string,
    el: ASTElement,
    state: CodegenState
): string {

    // 当为内联模版时，这里不进行处理，只处理要作为插槽的内容
    const children = el.inlineTemplate ? null : genChildren(el, state, true);

    // 处理上面数据后返回渲染后函数
    return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}

function genProps(props: Array < ASTAttr > ): string {
    let staticProps = ``;
    let dynamicProps = ``;
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];

        // 转义属性中的换行符
        const value = __WEEX__ ?
            generateValue(prop.value) :
            transformSpecialNewlines(prop.value);

        // 按属性名是否为动态的，划分不同的数据类型格式
        if (prop.dynamic) {
            dynamicProps += `${prop.name},${value},`
        } else {
            staticProps += `"${prop.name}":${value},`
        }
    }

    // 去掉最后的逗号
    staticProps = `{${staticProps.slice(0, -1)}}`;

    // 具有动态属性时，返回_d(静,动)格式的函数
    if (dynamicProps) {
        return `_d(${staticProps},[${dynamicProps.slice(0, -1)}])`
    } else {
        return staticProps;
    }
}

/* istanbul ignore next */
function generateValue(value) {
    if (typeof value === 'string') {
        return transformSpecialNewlines(value)
    }
    return JSON.stringify(value)
}

// #3895, #4268
// 转义换行符
function transformSpecialNewlines(text: string): string {
    return text
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}