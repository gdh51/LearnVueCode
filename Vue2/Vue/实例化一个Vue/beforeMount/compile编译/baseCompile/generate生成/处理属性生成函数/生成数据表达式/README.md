# 生成数据表达式

这里记录如何处理那些元素上的属性

## genData()——处理元素属性

该函数用于处理元素上的各种属性，比如`key`、自定义事件、指令等等

```js
function genData(el: ASTElement, state: CodegenState): string {
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
    // 对组件返回的v-model双向绑定对象生成表达式
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
    return data
}
```

首先这里会调用`genDirectives()`优先处理指令属性，因为有一些原生指令的使用会对之后的属性产生影响

### genDirectives()——处理指令

为什么调用该函数后，会对部分属性产生影响呢？原因在这其中的`state.directives`，它其中存放着一些对原生指令的处理函数。当我们使用原生指令时，有时就会产生影响

```js
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
            // 如果编译时的指令需要操作AST对象，则需要返回true来表示它需要一个运行时编译代码的副本
            // 这里只有v-model指令需要，且v-model不是操作的原生标签
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
```


#### 原生指令的处理

具体的原生指令一共包含6个：`v-on/bind/cloak/html/model/text`，由于之前没对这些对应的`gen()`函数进行了解，它们分别来自于`baseDirectives`与[`options.directives`](../../../../../baseOptions/README.md)，所以这里对它们进行了解：

```js
export default {
    on: function on(el: ASTElement, dir: ASTDirective) {

        // 这里指直接用v-on=""这种形式注册事件，用于注册对象形式语
        if (process.env.NODE_ENV !== 'production' && dir.modifiers) {
            warn(`v-on without argument does not support modifiers.`);
        }

        // 添加了个包装函数
        el.wrapListeners = (code: string) => `_g(${code},${dir.value})`
    },

    bind: function bind(el: ASTElement, dir: ASTDirective) {

        // 添加一个包装函数，用于处理v-bind的对象形式
        el.wrapData = (code: string) => {
            return `_b(${code},'${el.tag}',${dir.value},${
                dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
                }${
                dir.modifiers && dir.modifiers.sync ? ',true' : ''
            })`;
        }
    },

    // 空函数
    cloak: function noop(a ? : any, b ? : any, c ? : any) {},

    model: function model(){...},

    html: function html(el: ASTElement, dir: ASTDirective) {

        // 简单的添加个特性
        if (dir.value) {
            addProp(el, 'innerHTML', `_s(${dir.value})`, dir)
        }
    },

    text: function text(el: ASTElement, dir: ASTDirective) {
        if (dir.value) {

            // 简单的添加个特性
            addProp(el, 'textContent', `_s(${dir.value})`, dir)
        }
    }
}
```

它们各自对这些原生提供的指令进行解读然后生成了对应的运行时编译代码，然后添加到各种事件中、属性中。

上面6个`gen()`函数，除[`model()`](./对于双向绑定处理/README.md)外，其他的都不复杂，由于这里我们还要根据这些`gen()`函数时来判断是否需要在编译指令时还需要一个运行时编译代码的副本(除`v-model`指令添加至文本框时需要，其他情况都需要)。

### 处理style与class属性

之后便是对一些属性的添加，然后调用`state.dataGenFns`处理`class`与`style`属性，这里面的方法来自于[`baseOptions`](../../../../../baseOptions/README.md)，具体为：

```js
function genData(el: ASTElement): string {
    let data = ''
    if (el.staticClass) {
        data += `staticClass:${el.staticClass},`
    }
    if (el.classBinding) {
        data += `class:${el.classBinding},`
    }
    return data
}
function genData(el: ASTElement): string {
    let data = ''
    if (el.staticStyle) {
        data += `staticStyle:${el.staticStyle},`
    }
    if (el.styleBinding) {
        data += `style:(${el.styleBinding}),`
    }
    return data
}
```

就是简单的添加了动态`style/class`与静态`style/class`4个字段。

### genProps()——转化为运行时编译代码

之后调用`genProps()`函数对元素上的`attribute`(属性)与`property`(特性)进行了处理，将其转化为对应的数据类型字符串：

- 动态名称属性：数组
- 惊天名称属性：对象

```js
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
```

其中`transformSpecialNewlines()`用于处理其中的换行符解析失败问题问题

#### transformSpecialNewlines()

```js
// #3895, #4268
// 转义换行符
function transformSpecialNewlines(text: string): string {
    return text
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}
```

____
之后是调用[`genHandlers()`](../生成事件处理器/README.md)生成相关的事件监听器表达式，然后调用[`genScopedSlots()`](../生成插槽函数/README.md)

### genInlineTemplate()——处理内联模版

如果组件元素中设置了`inline-template`属性，则会视其内容为一个新的模版，重新调用`generate()`函数对其进行生成渲染函数

```js
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
```

### 针对v-on与v-bind的处理

如果之前处理指令中存在上述中的某一个指令，则会在最后在对它们进行一次包装处理：

```js
el.wrapListeners = (code: string) => `_g(${code},${dir.value})`
el.wrapData = (code: string) => {
    return `_b(${code},'${el.tag}',${dir.value},${
        dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
        }${
        dir.modifiers && dir.modifiers.sync ? ',true' : ''
    })`;
}

// v-bind data wrap
if (el.wrapData) {
    data = el.wrapData(data)
}
// v-on data wrap
if (el.wrapListeners) {
    data = el.wrapListeners(data)
}
```
