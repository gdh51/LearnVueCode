
# 处理属性生成函数

大致浏览一下源码，不难发现，`Vue`反复调用`genElement()`这个函数来处理元素的属性来生成渲染函数；为了防止重复处理某个属性，再该属性处理时，会在该元素上添加一个`[key]Processed`类似的标记位来证明它已经处理了。

## genElement()——处理元素渲染相关属性，生成渲染函数

该函数按 `static` -> `once` -> `for` -> `if` -> `children` -> `slot` -> `component` -> `data` 这样的顺序来处理属性，为什么只处理这些属性也很好理解，因为它们会影响`dom`的渲染；它们处理的顺序也好理解，为什么`v-for`与`v-if`优先处理，因为其会影响这个`dom`是否渲染，形成前置条件，先过一遍具体的代码：

```js
function genElement(el: ASTElement, state: CodegenState): string {

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
    // 处理非静态节点子节点的template元素
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

            // 如果元素仍具有其他属性或为静态组件
            if (!el.plain || (el.pre && state.maybeComponent(el))) {
                data = genData(el, state);
            }

            // 增对非内联模版，要处理其子节点，生成其子节点的渲染函数
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
```

首先我们可以看到，首先根据元素自身具有的属性特征会选择性调用以下函数：

- [`genStatic()`](./生成静态渲染函数/README.md)
- [`genOnce()`](./生成静态渲染函数/README.md#genonce%e5%a4%84%e7%90%86v-once)
- [`genIf()`](./生成影响结构的函数/README.md#genif%e5%a4%84%e7%90%86%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0%e4%b8%adif%e8%af%ad%e5%8f%a5%e5%9d%97)
- [`genFor()`](./生成影响结构的函数/README.md)
- [`genChildren()`](#genchildren%e5%a4%84%e7%90%86%e5%ad%90%e5%85%83%e7%b4%a0)
- [`genSlot()`](./生成插槽函数/README.md#%e9%92%88%e5%af%b9slot%e5%85%83%e7%b4%a0%e7%9a%84%e5%a4%84%e7%90%86genslot)

待以上属性处理完毕后，便检测该元素是否为动态组件，是则调用[`genComponent()`](#gencomponent%e5%a4%84%e7%90%86%e5%8a%a8%e6%80%81%e7%bb%84%e4%bb%b6)处理其中的内容然后生成渲染函数；不是则调用[`genData()`](./)处理完其上其他属性后，便继续调用[`genChildren()`](#genchildren%e5%a4%84%e7%90%86%e5%ad%90%e5%85%83%e7%b4%a0)迭代子元素生成渲染函数，然后生成渲染函数。

无论是哪个处理属性的方法，其中都会再调用`genElement()`函数(直接或间接)

## genChildren()——处理子元素

用该方法来处理`el`元素的所有子节点，会根据是否指定`altGenNode()`函数来决定采取何种函数来处理渲染函数，默认情况使用`genNode()`函数，它会根据具体情况来调用`gen()`函数

```js
function genChildren(
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
```

首先我们可以看到单个非`template/slot`的`v-for`元素时，是会直接调用`genElement()`函数进行处理生成渲染函数的(原因很简单，能用`v-for`的肯定为元素)；而对于多个子节点，首先则需要确定它们的节点类型再调用对应的`gen()`函数。

这其中涉及到个标准化等级的确定，调用的[`getNormalizationType()`](./其他检测函数/README.md)函数，总共有三个等级。
____
对于子节点类型的确定则调用的`genNode()`函数

## genNode()——根据节点类型调用生成函数

很简单该函数根据节点类型来调用不同的`gen()`函数

```js
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
```

下面两个文本节点的处理函数如下：

```js
function genText(text: ASTText | ASTExpression): string {

    // 根据是否属性节点(即插值表达式的文本)
    return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

function genComment(comment: ASTText): string {
    return `_e(${JSON.stringify(comment.text)})`
}
```

`genChildren()`最终的结果为`[子元素返回的函数], 标准化类型`或`[子元素返回的函数]`

## genComponent()——处理动态组件

该函数用于处理具有`is`属性的元素，处理完其内容和属性后会直接返回`_c()`渲染函数

```js
// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent(
    componentName: string,
    el: ASTElement,
    state: CodegenState
): string {

    // 当为内联模版时，这里不进行处理，只处理要作为插槽的内容
    const children = el.inlineTemplate ? null : genChildren(el, state, true);

    // 处理上面数据后返回渲染后函数, genData中会处理内联模版生成渲染函数
    return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}
```

## 具体函数目录

按我的理解，我将整个生成渲染函数的函数分为：

- [生成静态渲染函数](./生成静态渲染函数/README.md)
- [生成影响结构的函数](./生成影响结构的函数/README.md)
- [生成插槽函数](./生成插槽函数/README.md)
- [生成事件处理器](./生成事件处理器/README.md)
- [生成数据表达式](./生成数据表达式/README.md)
- [其他检测函数](./其他检测函数/README.md)