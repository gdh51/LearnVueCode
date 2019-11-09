
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