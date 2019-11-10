
# 处理属性生成函数

大致浏览一下源码，不难发现，`Vue`反复调用`genElement()`这个函数来处理元素的属性来生成渲染函数；为了防止重复处理某个属性，再该属性处理时，会在该元素上添加一个`[key]Processed`类似的标记位来证明它已经处理了。

## genElement()——处理元素渲染相关属性，生成渲染函数

该函数按 `static` -> `once` -> `for` -> `if` -> `children` -> `slot` -> `component` -> `data` 这样的顺序来处理属性，为什么只处理这些属性也很好理解，因为它们会影响`dom`的渲染。

```js

```

## genStatic()——处理静态根节点

该函数用于处理静态元素根节点：

```js
// hoist static sub-trees out
function genStatic(el: ASTElement, state: CodegenState): string {

    // 添加已处理的标记位
    el.staticProcessed = true;

    // Some elements (templates) need to behave differently inside of a v-pre
    // node.  All pre nodes are static roots, so we can use this as a location to
    // wrap a state change and reset it upon exiting the pre node.
    // 一些元素需要在v-pre节点中表现得不同；全部v-pre节点都是静态根节点，所以我们可以将其作为一个位置
    // 来处理其状态的变换。

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
```

该函数的处理结果为`_m(8, true)`或`_m(8)`

## genOnce()——处理v-once

处理具有`v-once`的元素，处理该属性时，因为我们知道：使用该特性的元素和组件只渲染一次，渲染后便作为静态内容跳过。

所以在这里我们可以看到，仅有三种处理方式，分别的顺序为：

1. 生成`v-if`条件函数
2. 根据自身是否处于`v-for`循环中，生成特定的渲染函数
3. 生成静态渲染函数

在这三个条件中，`1`、`3`最终都会调用`genStatic()`作为静态组件处理

```js
// v-once
function genOnce(el: ASTElement, state: CodegenState): string {
    el.onceProcessed = true;

    // 对于v-once元素优先处理其if属性
    if (el.if && !el.ifProcessed) {
        return genIf(el, state);

        // 该元素是否处于具有v-for属性的节点中
    } else if (el.staticInFor) {
        let key = '';
        let parent = el.parent;

        // 找到该节点的key值字符串表达式
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
            return genElement(el, state);
        }

        // 处理其他属性
        return `_o(${genElement(el, state)},${state.onceId++},${key})`
    } else {

        // 默认情况作为静态节点处理
        return genStatic(el, state);
    }
}
```

## genFor()——处理v-for

该函数用于处理`v-for`属性生成一个函数字符串表达式，在这最后会调用`genElement()`处理其他属性：

```js
function genFor(
    el: any,
    state: CodegenState,
    altGen ? : Function,
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

    // 返回其render函数，调用genElement处理其他属性
    return `${altHelper || '_l'}((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +
        `return ${(altGen || genElement)(el, state)}` +
        '})'
}
```

假如一个`v-for`表达式为`(item, index) in items`，则结果为`_l((items)), function(item, index){return }`。

## genChildren()——处理子元素

用该方法来处理`el`元素的所有子节点，会根据是否指定`altGenNode()`函数来决定采取何种函数来处理渲染函数。

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
        // 优化单独的v-for节点
        if (children.length === 1 &&
            el.for &&
            el.tag !== 'template' &&
            el.tag !== 'slot'
        ) {

            // 确定标准化的类型，默认情况不指定类型；
            const normalizationType = checkSkip ?
                (state.maybeComponent(el) ? `,1` : `,0`) : ``;

            // 调用altGemElement或genElement继续对其他属性进行优化
            return `${(altGenElement || genElement)(el, state)}${normalizationType}`
        }

        // 具有多个子节点时的标准化类型
        const normalizationType = checkSkip ?
            getNormalizationType(children, state.maybeComponent) : 0;

        // 未指定时，使用默认的生成函数
        const gen = altGenNode || genNode;

        // 分别对每个子节点调用生成函数，组成render函数
        return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''}`
    }
}
```

最终结果为`[子元素返回的函数], 标准化类型`或`[子元素返回的函数]`

## genIf()/genIfConditions()——处理if条件块

该函数用于处理`if`条件块，如果确实具有if条件块，那么会以一个三元表达式的形式来处理其他之间的条件关系。

```js
function genIf(
    el: any,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {
    el.ifProcessed = true // avoid recursion
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
```

最终结果为`(if条件)?(当前元素的处理结果的渲染函数):(下一个else-if条件)...`