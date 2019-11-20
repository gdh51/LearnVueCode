/* @flow */

import he from 'he'
import {
    parseHTML
} from './html-parser'
import {
    parseText
} from './text-parser'
import {
    parseFilters
} from './filter-parser'
import {
    genAssignmentCode
} from '../directives/model'
import {
    extend,
    cached,
    no,
    camelize,
    hyphenate
} from 'shared/util'
import {
    isIE,
    isEdge,
    isServerRendering
} from 'core/util/env'

import {
    addProp,
    addAttr,
    baseWarn,
    addHandler,
    addDirective,
    getBindingAttr,
    getAndRemoveAttr,
    getRawBindingAttr,
    pluckModuleFunction,
    getAndRemoveAttrByRegex
} from '../helpers'

// 匹配事件添加符
export const onRE = /^@|^v-on:/;

// 匹配指令前缀
export const dirRE = process.env.VBIND_PROP_SHORTHAND ?
    /^v-|^@|^:|^\./ :
    /^v-|^@|^:/;

// 匹配v-for中 in/of 前后的变量名
export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;

// 匹配 for中 ,后的字符
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;

// 匹配空格开头
const stripParensRE = /^\(|\)$/g;

// 匹配[xxx...]
const dynamicArgRE = /^\[.*\]$/;

// 匹配参数
const argRE = /:(.*)$/;

// 匹配bind表达式
export const bindRE = /^:|^\.|^v-bind:/;

const propBindRE = /^\./;
const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g

// 匹配插槽表达式
const slotRE = /^v-slot(:|$)|^#/

// 匹配换行符
const lineBreakRE = /[\r\n]/;

// 匹配空格
const whitespaceRE = /\s+/g;

// 匹配一些需要转义的符号
const invalidAttributeRE = /[\s"'<>\/=]/;

// 解析html转义后的模版
const decodeHTMLCached = cached(he.decode);

export const emptySlotScopeToken = `_empty_`

// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace
let maybeComponent

export function createASTElement(
    tag: string,
    attrs: Array < ASTAttr > ,
    parent: ASTElement | void
): ASTElement {
    return {
        type: 1,
        tag,

        // 原始匹配对象上简单处理后的属性数组
        attrsList: attrs,

        // 将属性按键值形式添加至对象中
        attrsMap: makeAttrsMap(attrs),
        rawAttrsMap: {},
        parent,
        children: []
    }
}

/**
 * Convert HTML string to AST.
 */
export function parse(
    template: string,
    options: CompilerOptions
): ASTElement | void {

    // 告警提示
    warn = options.warn || baseWarn;

    // 各种map效验器
    platformIsPreTag = options.isPreTag || no;
    platformMustUseProp = options.mustUseProp || no;
    platformGetTagNamespace = options.getTagNamespace || no;
    const isReservedTag = options.isReservedTag || no;

    // 是否为组件，一个判断函数
    maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag);

    // 取出这些module的对应属性，过滤掉空属性
    transforms = pluckModuleFunction(options.modules, 'transformNode')
    preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
    postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

    delimiters = options.delimiters;

    const stack = [];
    const preserveWhitespace = (options.preserveWhitespace !== false);
    const whitespaceOption = options.whitespace;
    let root;
    let currentParent;
    let inVPre = false;
    let inPre = false;
    let warned = false;

    function warnOnce(msg, range) {
        if (!warned) {
            warned = true
            warn(msg, range)
        }
    }

    function closeElement(element) {

        // 清空最后的空格节点
        trimEndingWhitespace(element);

        // 非处于v-pre元素中且元素还未完成属性处理时，对其剩余属性进行处理
        if (!inVPre && !element.processed) {
            element = processElement(element, options);
        }

        // tree management
        // 当元素不为根元素且当前元素不处于其他元素内部时
        if (!stack.length && element !== root) {

            // allow root elements with v-if, v-else-if and v-else
            // 允许根元素带有if属性，当前元素是否存在else条件语法
            if (root.if && (element.elseif || element.else)) {

                // 检查当前元素是否为多个元素
                if (process.env.NODE_ENV !== 'production') {
                    checkRootConstraints(element);
                }

                // 将该元素添加至另一个条件判断中
                addIfCondition(root, {
                    exp: element.elseif,
                    block: element
                });
            } else if (process.env.NODE_ENV !== 'production') {

                // 报错，肯定用了多个元素做根元素
                warnOnce(
                    `Component template should contain exactly one root element. ` +
                    `If you are using v-if on multiple elements, ` +
                    `use v-else-if to chain them instead.`, {
                        start: element.start
                    }
                )
            }
        }

        // 当前元素为子元素时，且未被禁用时
        if (currentParent && !element.forbidden) {

            // 处理元素elseif与else条件
            if (element.elseif || element.else) {

                // 添加该元素至上一个v-if元素的显示判断条件队列中
                processIfConditions(element, currentParent)
            } else {

                // 具有插槽绑定值时
                if (element.slotScope) {

                    // scoped slot
                    // 插槽名称
                    const name = element.slotTarget || '"default"';

                    // 将该元素存储到父元素的插槽作用域中
                    (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
                }

                // keep it in the children list so that v-else(-if) conditions can
                // find it as the prev node.
                // 将当前元素加入父元素的子队列中
                currentParent.children.push(element);
                element.parent = currentParent;
            }
        }

        // final children cleanup
        // filter out scoped slots
        // 最后对children属性进行清理，删除插槽元素
        element.children = element.children.filter(c => !(c: any).slotScope);

        // remove trailing whitespace node again
        // 这个为就不用解释了
        trimEndingWhitespace(element);

        // check pre state
        // 最后归还状态
        if (element.pre) {
            inVPre = false;
        }
        if (platformIsPreTag(element.tag)) {
            inPre = false;
        }

        // apply post-transforms
        for (let i = 0; i < postTransforms.length; i++) {
            postTransforms[i](element, options)
        }
    }

    function trimEndingWhitespace(el) {

        // remove trailing whitespace node
        // 清除最后的全部空格节点
        if (!inPre) {
            let lastNode;
            while (
                (lastNode = el.children[el.children.length - 1]) &&
                lastNode.type === 3 &&
                lastNode.text === ' '
            ) {
                el.children.pop()
            }
        }
    }

    function checkRootConstraints(el) {

        // 不能用slot、template作为根元素，因为它们可能含有多个元素
        if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(
                `Cannot use <${el.tag}> as component root element because it may ` +
                'contain multiple nodes.', {
                    start: el.start
                }
            )
        }

        // 根节点不能使用v-for属性
        if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
                'Cannot use v-for on stateful component root element because ' +
                'it renders multiple elements.',
                el.rawAttrsMap['v-for']
            )
        }
    }

    parseHTML(template, {
        warn,
        expectHTML: options.expectHTML,
        isUnaryTag: options.isUnaryTag,
        canBeLeftOpenTag: options.canBeLeftOpenTag,
        shouldDecodeNewlines: options.shouldDecodeNewlines,
        shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
        shouldKeepComment: options.comments,
        outputSourceRange: options.outputSourceRange,
        start(tag, attrs, unary, start, end) {

            // check namespace.
            // inherit parent ns if there is one
            // 检查是否有命名空间，有就继承父级的命名空间
            const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

            // handle IE svg bug
            // 处理IE浏览器svg的bug
            if (isIE && ns === 'svg') {
                attrs = guardIESVGBug(attrs)
            }

            // 创建元素的AST对象
            let element: ASTElement = createASTElement(tag, attrs, currentParent);

            // 有命名空间就挂载该属性
            if (ns) {
                element.ns = ns
            }


            if (process.env.NODE_ENV !== 'production') {
                if (options.outputSourceRange) {

                    // 添加该元素在原始模版中的位置信息
                    element.start = start;
                    element.end = end;

                    // 将原始匹配对象由数组形式转换为对象形式
                    element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
                        cumulated[attr.name] = attr;
                        return cumulated;
                    }, {});
                }

                // 检测属性名中是否含有非法符号
                attrs.forEach(attr => {
                    if (invalidAttributeRE.test(attr.name)) {
                        warn(
                            `Invalid dynamic argument expression: attribute names cannot contain ` +
                            `spaces, quotes, <, >, / or =.`, {
                                start: attr.start + attr.name.indexOf(`[`),
                                end: attr.start + attr.name.length
                            }
                        )
                    }
                });
            }

            // 使用了禁止的标签时报错(script或style)
            if (isForbiddenTag(element) && !isServerRendering()) {
                element.forbidden = true
                process.env.NODE_ENV !== 'production' && warn(
                    'Templates should only be responsible for mapping the state to the ' +
                    'UI. Avoid placing tags with side-effects in your templates, such as ' +
                    `<${tag}>` + ', as they will not be parsed.', {
                        start: element.start
                    }
                )
            }

            // apply pre-transforms
            // 如果是input标签且定义有v-model属性时，才会对其进行一次预处理
            for (let i = 0; i < preTransforms.length; i++) {
                element = preTransforms[i](element, options) || element;
            }

            // 确认当前元素是否在父元素有v-pre属性的元素中
            // 检测该元素是否具有v-pre属性
            if (!inVPre) {

                // 移除AST attrsList中v-pre属性，并给元素添加pre属性作为标记
                processPre(element);

                // 检测元素是否具有标记
                if (element.pre) {
                    inVPre = true;
                }
            }

            // 该元素是否为pre元素
            if (platformIsPreTag(element.tag)) {
                inPre = true;
            }

            // 如果具有v-pre属性，则直接将属性配置到attrs属性中
            if (inVPre) {
                processRawAttrs(element);

            // 如果元素还未完全处理完毕时
            } else if (!element.processed) {
                // structural directives

                // 处理v-for属性
                processFor(element);

                // 处理v-if v-else v-else-if属性
                processIf(element);

                // 处理v-once属性
                processOnce(element);
            }

            // 如果还未确定根元素时，那当前元素肯定是根元素
            if (!root) {
                root = element;

                // 检查根节点是否可能不为一个元素
                if (process.env.NODE_ENV !== 'production') {
                    checkRootConstraints(root);
                }
            }

            // 如果不是一元元素，那么替换父元素为当前元素，并推入栈中等待闭合
            if (!unary) {
                currentParent = element;
                stack.push(element);
            } else {

                // 为一元元素时，直接闭合
                closeElement(element);
            }
        },

        end(tag, start, end) {

            // 下面这两步操作统称pop()
            // 该元素头标签的ast对象
            const element = stack[stack.length - 1];
            // pop stack
            stack.length -= 1;

            // 确定父元素
            currentParent = stack[stack.length - 1];
            if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
                element.end = end
            }
            closeElement(element);
        },

        chars(text: string, start: number, end: number) {

            // 没有父元素时，报错
            if (!currentParent) {
                if (process.env.NODE_ENV !== 'production') {

                    // 是否模版为纯文本
                    if (text === template) {
                        warnOnce(
                            'Component template requires a root element, rather than just text.', {
                                start
                            }
                        )

                    // 将文本写在根元素外
                    } else if ((text = text.trim())) {
                        warnOnce(
                            `text "${text}" outside root element will be ignored.`, {
                                start
                            }
                        )
                    }
                }
                return
            }

            // IE textarea placeholder bug
            // 处理IE textarea placeholder 的bug
            // IE中的placeholder中内容会出现在元素中
            if (isIE &&
                currentParent.tag === 'textarea' &&
                currentParent.attrsMap.placeholder === text
            ) {
                return;
            }
            const children = currentParent.children;

            // 如果目前为pre元素的内容或非空文本
            if (inPre || text.trim()) {

                // 根据父元素是否为style或script标签，决定是否要解除文本的转义
                text = isTextTag(currentParent) ? text : decodeHTMLCached(text)

            // 子节点数组只存在一个空文本节点，则移除空文本（实际浏览器并不会移除）
            } else if (!children.length) {
                // remove the whitespace-only node right after an opening tag
                text = ''

            // 默认为undefined
            } else if (whitespaceOption) {

                // 压缩模式下，如果该空格字符串包含换行符，则清空为空字符串，否则转换为单独的空格字符串
                if (whitespaceOption === 'condense') {
                    // in condense mode, remove the whitespace node if it contains
                    // line break, otherwise condense to a single space
                    text = lineBreakRE.test(text) ? '' : ' '
                } else {
                    text = ' '
                }

            // 其余多个空格一路替换为一个空格
            } else {

                // 默认为true
                text = preserveWhitespace ? ' ' : ''
            }

            // 如果还存在文本
            if (text) {

                // 在非pre元素外的其他文本，在压缩模式下，文本中空格最大长度不超过1
                if (!inPre && whitespaceOption === 'condense') {
                    // condense consecutive whitespaces into single space
                    text = text.replace(whitespaceRE, ' ')
                }
                let res
                let child: ? ASTNode

                // 非v-pre且非空元素，解析字符串表达式后，生成属性节点ast对象
                if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {

                    // 属性节点，DOM4级中已废弃
                    child = {
                        type: 2,
                        expression: res.expression,
                        tokens: res.tokens,
                        text
                    }

                // 文本不为空或父节点只存在这一个文本子节点或子节点最后一个不为空格节点
                } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {

                    // 文本节点
                    child = {
                        type: 3,
                        text
                    }
                }

                // 将该ast对象加入父级的子节点数组
                if (child) {
                    if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
                        child.start = start
                        child.end = end
                    }
                    children.push(child);
                }
            }
        },
        comment(text: string, start, end) {
            // adding anyting as a sibling to the root node is forbidden
            // comments should still be allowed, but ignored
            // 有父节点，就挂载在父节点的子数组中，标记该文本的起始位置
            if (currentParent) {
                const child: ASTText = {
                    type: 3,
                    text,
                    isComment: true
                }
                if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
                    child.start = start
                    child.end = end
                }
                currentParent.children.push(child)
            }
        }
    });

    return root;
}

function processPre(el) {
    if (getAndRemoveAttr(el, 'v-pre') != null) {
        el.pre = true
    }
}

function processRawAttrs(el) {
    const list = el.attrsList;
    const len = list.length;
    if (len) {

        // 直接将元素属性挂载至attrs(属性)上
        const attrs: Array < ASTAttr > = el.attrs = new Array(len)
        for (let i = 0; i < len; i++) {
            attrs[i] = {
                name: list[i].name,
                value: JSON.stringify(list[i].value)
            };

            if (list[i].start != null) {
                attrs[i].start = list[i].start
                attrs[i].end = list[i].end
            }
        }

    // 该元素未有任何其他属性时
    } else if (!el.pre) {

        // non root node in pre blocks with no attributes
        el.plain = true;
    }
}

export function processElement(
    element: ASTElement,
    options: CompilerOptions
) {

    // 初步处理key属性，返回其动态表达式
    processKey(element);

    // determine whether this is a plain element after
    // removing structural attributes
    // 检查其是否为一个简单元素，即处理完一些属性后还有属性剩余没有
    element.plain = (
        !element.key &&
        !element.scopedSlots &&
        !element.attrsList.length
    );

    // 处理动态ref属性
    processRef(element);

    // 处理元素中的插槽的内容
    processSlotContent(element);

    // 处理插槽元素
    processSlotOutlet(element);

    // 处理组件相关的属性
    processComponent(element);

    // 处理style和class属性，此处调用的是transformNode()方法
    for (let i = 0; i < transforms.length; i++) {
        element = transforms[i](element, options) || element;
    }

    // 处理剩余的属性
    processAttrs(element);
    return element;
}

function processKey(el) {

    // 获取动态的key值字符串表达式
    const exp = getBindingAttr(el, 'key');

    // 检查是否在非法元素上使用key
    if (exp) {
        if (process.env.NODE_ENV !== 'production') {

            // 禁止在模版元素上定义key属性
            if (el.tag === 'template') {
                warn(
                    `<template> cannot be keyed. Place the key on real elements instead.`,
                    getRawBindingAttr(el, 'key')
                )
            }

            // 提示不要在抽象元素上用key属性
            if (el.for) {
                const iterator = el.iterator2 || el.iterator1;
                const parent = el.parent;
                if (iterator && iterator === exp && parent && parent.tag === 'transition-group') {
                    warn(
                        `Do not use v-for index as key on <transition-group> children, ` +
                        `this is the same as not using keys.`,
                        getRawBindingAttr(el, 'key'),
                        true /* tip */
                    )
                }
            }
        }
        el.key = exp;
    }
}

function processRef(el) {

    // 获取ref的动态表达式字符串
    const ref = getBindingAttr(el, 'ref');

    if (ref) {

        // 挂载至AST元素上
        el.ref = ref;

        // ref是否在v-for中
        el.refInFor = checkInFor(el);
    }
}

export function processFor(el: ASTElement) {
    let exp;

    // 获取v-for的字符串表达式
    if ((exp = getAndRemoveAttr(el, 'v-for'))) {

        // 匹配v-for表达式，将上代表的值的转换为对象形式
        const res = parseFor(exp);

        // 将属性嫁接到ast元素对象上去
        if (res) {
            extend(el, res);
        } else if (process.env.NODE_ENV !== 'production') {
            warn(
                `Invalid v-for expression: ${exp}`,
                el.rawAttrsMap['v-for']
            )
        }
    }
}

type ForParseResult = {
    for: string;
    alias: string;
    iterator1 ? : string;
    iterator2 ? : string;
};

export function parseFor(exp: string): ? ForParseResult {

    // 以下会以一个例子举例解释，当然最好的方式还是自己debugger
    // 匹配 v-for中的两个别名  如   (val, index) in values
    const inMatch = exp.match(forAliasRE);
    if (!inMatch) return;
    const res = {};

    // 匹配数据来源   匹配values
    res.for = inMatch[2].trim();

    // 匹配用户定义的单个值  匹配 val,index
    const alias = inMatch[1].trim().replace(stripParensRE, '');

    // 匹配 ,index
    const iteratorMatch = alias.match(forIteratorRE);
    if (iteratorMatch) {

        // 匹配第一个值 val
        res.alias = alias.replace(forIteratorRE, '').trim();

        // 匹配第二个值 index
        res.iterator1 = iteratorMatch[1].trim();

        // 如果还有第三个值是，存放第三个值
        if (iteratorMatch[2]) {
            res.iterator2 = iteratorMatch[2].trim()
        }

    // 仅一个值情况
    } else {
        res.alias = alias;
    }
    return res;
}

function processIf(el) {

    // 删除未处理属性中的v-if，返回起字符串表达式
    const exp = getAndRemoveAttr(el, 'v-if')
    if (exp) {
        el.if = exp;

        // 为元素添加一个if条件属性队列，并将该条件添加
        addIfCondition(el, {
            exp: exp,
            block: el
        });

    // 没有if时处理else情况和else-if的情况
    } else {
        if (getAndRemoveAttr(el, 'v-else') != null) {
            el.else = true;
        }
        const elseif = getAndRemoveAttr(el, 'v-else-if')
        if (elseif) {
            el.elseif = elseif
        }
    }
}

function processIfConditions(el, parent) {

    // 找到上一个元素节点
    const prev = findPrevElement(parent.children);

    // 前一个元素存在v-if则将该元素添加至其if条件判断数组中
    if (prev && prev.if) {
        addIfCondition(prev, {
            exp: el.elseif,
            block: el
        });

    // 否则报错，你用了v-else/v-else-if却没有对应v-if元素对应
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
            `used on element <${el.tag}> without corresponding v-if.`,
            el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
        );
    }
}

// 找到当前元素的前一个节点，前一个节点必须为元素，否则报错
function findPrevElement(children: Array < any > ) : ASTElement | void {
    let i = children.length;
    while (i--) {

        // 找到元素类型的节点
        if (children[i].type === 1) {
            return children[i]
        } else {

            // 前一个节点非元素节点时且不为空时，报错
            if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
                warn(
                    `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
                    `will be ignored.`,
                    children[i]
                )
            }

            // 该节点被丢弃
            children.pop()
        }
    }
}

export function addIfCondition(el: ASTElement, condition: ASTIfCondition) {

    // 是否有判断条件对象？没有新建一个
    if (!el.ifConditions) {
        el.ifConditions = []
    }

    // 加入判断条件对象
    el.ifConditions.push(condition)
}

function processOnce(el) {
    const once = getAndRemoveAttr(el, 'v-once');
    if (once != null) {
        el.once = true
    }
}

// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
// 处理作为插入slot的组件
function processSlotContent(el) {
    let slotScope;

    // 旧语法，处理作用域插槽，处理作为模版插入的标签
    if (el.tag === 'template') {

        // 处理scope属性, 该属性已在高版本废弃，所以提示用户不要再使用
        slotScope = getAndRemoveAttr(el, 'scope');

        if (process.env.NODE_ENV !== 'production' && slotScope) {
            warn(
                `the "scope" attribute for scoped slots have been deprecated and ` +
                `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
                `can also be used on plain elements in addition to <template> to ` +
                `denote scoped slots.`,
                el.rawAttrsMap['scope'],
                true
            )
        }

        // 处理slot-scope属性
        el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope');

    // 不再模版上使用时
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {

        // 同v-for属性一起使用时，报错，提示用户两者优先级冲突
        if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
            warn(
                `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
                `(v-for takes higher priority). Use a wrapper <template> for the ` +
                `scoped slot to make it clearer.`,
                el.rawAttrsMap['slot-scope'],
                true
            )
        }
        el.slotScope = slotScope;
    }

    // slot="xxx"
    // 旧语法：获取slot的字符串表达式值，支持获取动态值
    const slotTarget = getBindingAttr(el, 'slot');

    // 旧语法：处理插槽绑定的插槽名称
    if (slotTarget) {

        // 获取内容绑定的插槽名称，默认绑定目标为default
        el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget;

        // 是否绑定的是动态属性目标
        el.slotTargetDynamic = !!(el.attrsMap[':slot'] || el.attrsMap['v-bind:slot'])

        // preserve slot as an attribute for native shadow DOM compat
        // only for non-scoped slots.
        // 为非template元素预备一个插槽属性(不支持2.6版本下)
        if (el.tag !== 'template' && !el.slotScope) {

            // 为el添加一个已处理的slot属性(添加在新的属性中)
            addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'));
        }
    }

    // 2.6 v-slot syntax
    // 2.6 v-slot 语法
    if (process.env.NEW_SLOT_SYNTAX) {

        // 插入模版的情况
        if (el.tag === 'template') {

            // v-slot on <template>
            // 处理掉模版上的v-slot属性
            const slotBinding = getAndRemoveAttrByRegex(el, slotRE);
            if (slotBinding) {

                if (process.env.NODE_ENV !== 'production') {

                    // 新旧版本语法一起用，报错
                    if (el.slotTarget || el.slotScope) {
                        warn(
                            `Unexpected mixed usage of different slot syntaxes.`,
                            el
                        )
                    }

                    // 使用template的v-slot语法，而父级元素不是组件，则报错
                    if (el.parent && !maybeComponent(el.parent)) {
                        warn(
                            `<template v-slot> can only appear at the root level inside ` +
                            `the receiving the component`,
                            el
                        )
                    }
                }

                const {

                    // 插槽名称字符串表达式
                    name,

                    // 插槽名是否为动态的
                    dynamic
                } = getSlotName(slotBinding);

                // 在ast元素上设置插槽名称与是否为动态名称
                el.slotTarget = name;
                el.slotTargetDynamic = dynamic;

                // 插槽指定的prop值(没有则指定默认值)
                el.slotScope = slotBinding.value || emptySlotScopeToken // force it into a scoped slot for perf
            }
        } else {

            // v-slot on component, denotes default slot
            // 直接在组件上使用插槽，则表示使用默认插槽
            const slotBinding = getAndRemoveAttrByRegex(el, slotRE);
            if (slotBinding) {
                if (process.env.NODE_ENV !== 'production') {

                    // 当前使用v-slot的不是组件 ,报错
                    if (!maybeComponent(el)) {
                        warn(
                            `v-slot can only be used on components or <template>.`,
                            slotBinding
                        )
                    }

                    // 混合两者版本的语法使用，报错
                    if (el.slotScope || el.slotTarget) {
                        warn(
                            `Unexpected mixed usage of different slot syntaxes.`,
                            el
                        )
                    }

                    // 已有作用域插槽时，报错
                    if (el.scopedSlots) {
                        warn(
                            `To avoid scope ambiguity, the default slot should also use ` +
                            `<template> syntax when there are other named slots.`,
                            slotBinding
                        )
                    }
                }

                // add the component's children to its default slot
                // 初始化插槽
                const slots = el.scopedSlots || (el.scopedSlots = {});

                // 处理并返回插槽名称，和是否为动态名称
                const {
                    name,
                    dynamic
                } = getSlotName(slotBinding);

                // 为插槽创建一个代表默认插槽的模版ast元素对象，并指定其父元素为当前组件
                const slotContainer = slots[name] = createASTElement('template', [], el);
                slotContainer.slotTarget = name;
                slotContainer.slotTargetDynamic = dynamic;

                // 因为中间新增了一层template元素，所以要重写它们的父子关系（必须要未绑定插槽作用域的）
                slotContainer.children = el.children.filter((c: any) => {
                    if (!c.slotScope) {
                        c.parent = slotContainer;
                        return true;
                    }
                });

                // 设置当前组件的插槽作用域为当前插槽绑定的值
                slotContainer.slotScope = slotBinding.value || emptySlotScopeToken;

                // remove children as they are returned from scopedSlots now
                // 移除组件的子数组，将插槽ast对象转移到scopedSlots对象上
                el.children = [];

                // mark el non-plain so data gets generated
                el.plain = false;
            }
        }
    }
}

function getSlotName(binding) {

    // 获取插槽名称
    let name = binding.name.replace(slotRE, '');

    // 未指定名称时，默认为default，但不允许用简写时不指定名称
    if (!name) {
        if (binding.name[0] !== '#') {
            name = 'default'
        } else if (process.env.NODE_ENV !== 'production') {
            warn(
                `v-slot shorthand syntax requires a slot name.`,
                binding
            )
        }
    }

    // 组件名是否为动态名称，根据属性名取对应的字符串表达式
    return dynamicArgRE.test(name)
        // dynamic [name]
        ?
        {
            name: name.slice(1, -1),
            dynamic: true
        }
        // static name
        :
        {
            name: `"${name}"`,
            dynamic: false
        }
}

// handle <slot/> outlets
function processSlotOutlet(el) {

    // 处理模版中留出的插槽位
    if (el.tag === 'slot') {

        // 获取插槽名称
        el.slotName = getBindingAttr(el, 'name');

        // 在slot元素上定义key时，进行报错
        if (process.env.NODE_ENV !== 'production' && el.key) {
            warn(
                `\`key\` does not work on <slot> because slots are abstract outlets ` +
                `and can possibly expand into multiple elements. ` +
                `Use the key on a wrapping element instead.`,
                getRawBindingAttr(el, 'key')
            )
        }
    }
}

function processComponent(el) {
    let binding;

    // 处理当前元素绑定的组件
    if ((binding = getBindingAttr(el, 'is'))) {
        el.component = binding;
    }

    // 当前元素是否使用内联模版
    if (getAndRemoveAttr(el, 'inline-template') != null) {
        el.inlineTemplate = true;
    }
}

function processAttrs(el) {

    // 处理剩下的属性
    const list = el.attrsList;
    let i, l, name, rawName, value, modifiers, syncGen, isDynamic;
    for (i = 0, l = list.length; i < l; i++) {
        name = rawName = list[i].name;
        value = list[i].value;

        // 是否存在vue指令
        if (dirRE.test(name)) {

            // mark element as dynamic
            // 标记元素为动态的
            el.hasBindings = true;

            // modifiers 解析其中的.修饰符使用的变量
            modifiers = parseModifiers(name.replace(dirRE, ''));

            // support .foo shorthand syntax for the .prop modifier
            // 支持.foo简写语法代替:foo.prop修饰符，用于在dom上绑定prop
            if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {
                (modifiers || (modifiers = {})).prop = true;

                // 提取绑定dom的属性名
                name = `.` + name.slice(1).replace(modifierRE, '');

            // 提取绑定属性的名称
            } else if (modifiers) {
                name = name.replace(modifierRE, '');
            }

            // 使用v-bind方式绑定时，三种形式v-bind/:/.
            if (bindRE.test(name)) { // v-bind

                // 取得绑定属性的名称
                name = name.replace(bindRE, '');

                // 解析过滤器，得出最后的字符串表达式
                value = parseFilters(value);

                // 是否为动态的属性名，是时重新提取变量名称
                isDynamic = dynamicArgRE.test(name);
                if (isDynamic) {
                    name = name.slice(1, -1);
                }
                if (
                    process.env.NODE_ENV !== 'production' &&
                    value.trim().length === 0
                ) {
                    warn(
                        `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
                    )
                }

                // 处理修饰符
                if (modifiers) {

                    // .prop修饰符时，解析属性名称
                    if (modifiers.prop && !isDynamic) {
                        name = camelize(name);

                        // 因为变量经过驼峰化，部分DOM属性要还原
                        if (name === 'innerHtml') {
                            name = 'innerHTML';
                        }
                    }

                    // 是否有camel修饰符，有时需要将-形式变量转化为驼峰式
                    if (modifiers.camel && !isDynamic) {
                        name = camelize(name);
                    }

                    // 当有sync修饰符时
                    if (modifiers.sync) {

                        // 返回sync绑定的值至$event的字符串表达式
                        // 比如          :b.sync="c", 即将c值绑定至$event
                        // 这个就是事件处理表达式
                        syncGen = genAssignmentCode(value, `$event`);

                        // 非动态绑定属性名时
                        if (!isDynamic) {

                            // 添加该事件至该ast元素对象并处理其修饰符，绑定的事件名为驼峰式
                            addHandler(
                                el,
                                `update:${camelize(name)}`,
                                syncGen,
                                null,
                                false,
                                warn,
                                list[i]
                            );

                            // 事件名称不平滑时，再添加个-形式的事件
                            if (hyphenate(name) !== camelize(name)) {
                                addHandler(
                                    el,
                                    `update:${hyphenate(name)}`,
                                    syncGen,
                                    null,
                                    false,
                                    warn,
                                    list[i]
                                )
                            }
                        } else {
                            // handler w/ dynamic event name
                            // 添加动态的事件名
                            addHandler(
                                el,
                                `"update:"+(${name})`,
                                syncGen,
                                null,
                                false,
                                warn,
                                list[i],
                                true // dynamic
                            )
                        }
                    }
                }

                // 处理prop修饰符，没有该修饰符的部分dom元素的属性也必须添加prop属性
                if ((modifiers && modifiers.prop) || (
                        !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
                    )) {

                    // 处理元素的属性property
                    addProp(el, name, value, list[i], isDynamic)
                } else {

                    // 处理元素的特性attribute
                    addAttr(el, name, value, list[i], isDynamic)
                }

            // 处理事件添加v-on
            } else if (onRE.test(name)) { // v-on

                // 事件名
                name = name.replace(onRE, '');

                // 是否为动态事件名
                isDynamic = dynamicArgRE.test(name);
                if (isDynamic) {
                    name = name.slice(1, -1);
                }

                // 添加该事件
                addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)

            // 处理元素上的指令
            } else { // normal directives
                name = name.replace(dirRE, '')
                // parse arg
                const argMatch = name.match(argRE)
                let arg = argMatch && argMatch[1]
                isDynamic = false
                if (arg) {
                    name = name.slice(0, -(arg.length + 1))
                    if (dynamicArgRE.test(arg)) {
                        arg = arg.slice(1, -1)
                        isDynamic = true
                    }
                }
                addDirective(el, name, rawName, value, arg, isDynamic, modifiers, list[i])
                if (process.env.NODE_ENV !== 'production' && name === 'model') {
                    checkForAliasModel(el, value)
                }
            }
        } else {

            // literal attribute
            if (process.env.NODE_ENV !== 'production') {
                const res = parseText(value, delimiters)
                if (res) {
                    warn(
                        `${name}="${value}": ` +
                        'Interpolation inside attributes has been removed. ' +
                        'Use v-bind or the colon shorthand instead. For example, ' +
                        'instead of <div id="{{ val }}">, use <div :id="val">.',
                        list[i]
                    )
                }
            }
            addAttr(el, name, JSON.stringify(value), list[i])
            // #6887 firefox doesn't update muted state if set via attribute
            // even immediately after element creation
            if (!el.component &&
                name === 'muted' &&
                platformMustUseProp(el.tag, el.attrsMap.type, name)) {
                addProp(el, name, 'true', list[i])
            }
        }
    }
}

function checkInFor(el: ASTElement): boolean {
    let parent = el;

    // 找到第一个具有v-for属性的祖先元素
    while (parent) {
        if (parent.for !== undefined) {
            return true;
        }
        parent = parent.parent;
    }

    // 没找到则说明没有在v-for指令中
    return false;
}

// 解析标识符
function parseModifiers(name: string): Object | void {

    // 匹配修饰符
    const match = name.match(modifierRE);
    if (match) {

        // 将修饰符提取为对象属性
        const ret = {};
        match.forEach(m => {
            ret[m.slice(1)] = true;
        });

        // 返回该修饰符对象
        return ret;
    }
}

function makeAttrsMap(attrs: Array < Object > ): Object {
    const map = {};

    // 将属性按键值形式添加至对象中
    for (let i = 0, l = attrs.length; i < l; i++) {

        // 属性重复时，提示用户(对这种情况就是你写在模版里面时会出现)，此时新值会覆盖旧值
        if (
            process.env.NODE_ENV !== 'production' &&
            map[attrs[i].name] && !isIE && !isEdge
        ) {
            warn('duplicate attribute: ' + attrs[i].name, attrs[i])
        }
        map[attrs[i].name] = attrs[i].value
    }
    return map;
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag(el): boolean {
    return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag(el): boolean {
    return (
        el.tag === 'style' ||
        (el.tag === 'script' && (
            !el.attrsMap.type ||
            el.attrsMap.type === 'text/javascript'
        ))
    )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug(attrs) {
    const res = []
    for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        if (!ieNSBug.test(attr.name)) {
            attr.name = attr.name.replace(ieNSPrefix, '')
            res.push(attr)
        }
    }
    return res
}

function checkForAliasModel(el, value) {
    let _el = el;
    while (_el) {
        if (_el.for && _el.alias === value) {
            warn(
                `<${el.tag} v-model="${value}">: ` +
                `You are binding v-model directly to a v-for iteration alias. ` +
                `This will not be able to modify the v-for source array because ` +
                `writing to the alias is like modifying a function local variable. ` +
                `Consider using an array of objects and use v-model on an object property instead.`,
                el.rawAttrsMap['v-model']
            )
        }
        _el = _el.parent;
    }
}