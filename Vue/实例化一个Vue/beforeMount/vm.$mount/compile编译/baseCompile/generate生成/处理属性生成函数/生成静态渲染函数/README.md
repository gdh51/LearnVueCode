# 生成静态渲染函数

在这里我将对静态节点的处理归纳为两种，一种就是具有`v-once`的元素，另一种为`v-pre`的元素。

## genStatic()——处理静态根节点

该函数用于处理静态元素根节点(`staticRoot`)：

```js
// hoist static sub-trees out
function genStatic(el: ASTElement, state: CodegenState): string {

    // 添加已处理的标记位
    el.staticProcessed = true;

    // Some elements (templates) need to behave differently inside of a v-pre
    // node.  All pre nodes are static roots, so we can use this as a location to
    // wrap a state change and reset it upon exiting the pre node.
    // 一些元素(模版)需要在v-pre节点中表现得不同；全部v-pre节点都是静态根节点，所以我们可以将其作为一个信号
    // 来处理其状态的变换，并在退出该pre节点时重置它。

    // 最初的状态栈中pre的状态
    const originalPreState = state.pre;

    // 如果当前元素为v-pre元素，则暂时用当前元素的状态替换其状态
    if (el.pre) {
        state.pre = el.pre;
    }

    // 将当前节点的渲染函数加入渲染函数队列中，递归对该节点调用处理函数，处理其余属性
    state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`);

    // 处理完整个该元素时，还原为上一个静态节点的状态
    state.pre = originalPreState;

    // 返回该节点处理结果生成的_m()函数
    return `_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}
```

从代码看出，每次调用`genStatic()`函数时，`state`的`pre`状态总会为上一个拥有`pre`状态的节点的状态。那么`state.pre`的状态是用来做什么的呢？在[`genElement()`](../README.md)中处理模版时，防止不对`<template>`元素上本身的属性进行处理。待`genElement()`调用完毕后，便归还状态`state.pre`状态。

之后每一个调用`genStatic()`函数处理的结果都会被加入`state.staticRenderFns`数组，最后返回一个带有该静态函数位置的函数`_m()`

该函数的处理结果大概为`_m(8, true)`或`_m(8)`

## genOnce()——处理v-once

因为我们知道，处理具有`v-once`的元素：使用该特性的元素和组件只渲染一次，渲染后便作为静态内容跳过。

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

在调用`genStatic()`的过程中，并未进行静态根节点的检查，强制将`v-once`属性具有的节点作为静态根节点处理。

下面将三种情况的处理路径书写下：

- 情况1：`genIf()` -> 其他属性 -> `genStatic()`
- 情况2：直接返回`_o(renderFn,onceId,key)`
- 情况3：`genStatic()`
