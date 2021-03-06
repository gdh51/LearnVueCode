# 标准化节点

对于普通的`HTML`标签，标准化可以直接跳过，因为生成渲染函数一定会返回数组形式的`VNode`节点但这里有两种情况需要额外的标准化：

1. 当子节点中包含组件时——因为一个**函数式组件**可能会返回一个数组的**根**`VNode`节点而不仅仅是一个。在这情况下，需要简单的标准化：如果任何单个子节点为数组，那么我们就用`concat()`扁平它。优化后它以及它的子节点能保证只有一层深度，因为函数式组件已经自己标准化过它的子数组。此时调用[`simpleNormalizeChildren()`](#%e7%ae%80%e5%8d%95%e4%bc%98%e5%8c%96simplenormalizechildren)

2. 如果子节点中包含经常生成嵌套子节点数组的构造函数，如`<template>`, `<slot>`, `v-for`或子节点数组是用户写的渲染函数。这种情况下需要普通标准化去满足所有类型的子节点，此时调用[`normalizeChildren()`](#%e6%99%ae%e9%80%9a%e4%bc%98%e5%8c%96normalizechildren)

这里我举一个简单的需要标准化的例子，假如在非根节点处出现这种情况：

```js
<template>
    <div></div>
    <div></div>
</template>
```

那么很明显这里会生成`template`节点下面挂载两个`div`节点，待到生成渲染函数时，子节点数组就会变成这样`[[div, div]]`，这很明显不合理，所以我们要将其转化为`[div, div]`这种形式。(这是我打的比方)，这里可以参看下当时对`template`的处理情况[跳转](../../../beforeMount/compile编译/baseCompile/generate生成/处理属性生成函数/README.md)
____
在根据`AST`树生成渲染函数的阶段，我们在处理`children`时就对是否需要标准化进行处理，[具体](../../../beforeMount/compile编译/baseCompile/generate生成/../parse解析/一群工具方法/其他属性处理方法/README.md)

## 简单优化——simpleNormalizeChildren()

简单优化非常简单，即将本应该为单个`VNode`节点的数组展开。

```js
function simpleNormalizeChildren(children: any) {

    // 将子节点中为多个根VNode的子节点扁平化
    for (let i = 0; i < children.length; i++) {
        if (Array.isArray(children[i])) {
            return Array.prototype.concat.apply([], children)
        }
    }
    return children
}
```

## 普通优化——normalizeChildren()

对于普通优化，它会对相邻的文本节点进行优化，将它们合并为一个文本节点；而且在这期间，还存在一些非`VNode`的文本字符串，需要对它们进行处理为`VNode`节点

```js
function normalizeChildren(children: any): ? Array < VNode > {

    // 仅一个文本节点时，直接创建一个文本节点返回
    return isPrimitive(children) ? [createTextVNode(children)] :

        // 处理多个节点时
        (Array.isArray(children) ? normalizeArrayChildren(children) : undefined);
}
```

下面是对单个根节点但为数组情况的处理：

```js
// 是否为文本节点，而非注释节点
function isTextNode(node) : boolean {
    return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

function normalizeArrayChildren(children: any, nestedIndex ? : string): Array < VNode > {
    const res = [];
    let i, c, lastIndex, last;

    // 遍历子节点数组
    for (i = 0; i < children.length; i++) {
        c = children[i];

        // 无定义或布尔值时直接跳过
        if (isUndef(c) || typeof c === 'boolean') continue;

        // 记录结果中上一个节点的下标，和上一个节点
        lastIndex = res.length - 1;
        last = res[lastIndex];

        //  nested
        // 如果子节点为多个根节点
        if (Array.isArray(c)) {
            if (c.length > 0) {

                // 递归进行标准化，返回一个节点
                c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`);

                // merge adjacent text nodes
                // 如果上一个节点和当前标准化后节点都为文本节点，则合并相邻的文本节点
                if (isTextNode(c[0]) && isTextNode(last)) {
                    res[lastIndex] = createTextVNode(last.text + (c[0]: any).text)
                    c.shift()
                }

                // 将数组元素添加至res
                res.push.apply(res, c);
            }

        // 是否为原始值(文本)
        } else if (isPrimitive(c)) {

            // 如果上一个节点的结果是文本节点，而当前节点又为文本节点则又合并为单个文本节点
            if (isTextNode(last)) {
                // merge adjacent text nodes
                // this is necessary for SSR hydration because text nodes are
                // essentially merged when rendered to HTML strings
                res[lastIndex] = createTextVNode(last.text + c);

            // 上一个节点不为文本节点，且当前文本节点不为空，则新建一个节点
            } else if (c !== '') {
                // convert primitive to vnode
                res.push(createTextVNode(c))
            }

        // 及不为原始值，也不为数组，那么就是对象，那么它可能为一个VNode节点
        } else {

            // 同样的对比当前与前一个节点是否为文本节点，是就合并
            if (isTextNode(c) && isTextNode(last)) {

                // merge adjacent text nodes
                res[lastIndex] = createTextVNode(last.text + c.text);

            // 那么此时就为VNode节点
            } else {

                // default key for nested array children (likely generated by v-for)
                // 如果普通的节点没有生成v-for的key值则帮其生成
                if (isTrue(children._isVList) &&
                    isDef(c.tag) &&
                    isUndef(c.key) &&
                    isDef(nestedIndex)) {
                    c.key = `__vlist${nestedIndex}_${i}__`
                }
                res.push(c)
            }
        }
    }
    return res
}
```

我们可以看到，对于每个节点，主要存在三种情况：

- 单个节点，但包含一个数组的节点：继续递归处理
- 原始值，这个有点神，只处理是字符串的情况，其他情况丢弃
- 对象，即单个`VNode`节点，如果为`v-for`节点则进行一下检测，然后直接扔进数组

我们可以看到这个方法的处理结果为一个数组包含多个`VNode`节点。

**Note**：笔者在看这段代码时就疏忽了这一句`res.push.apply(res, c);`，以为处理后会出现该为一个节点但为数组的情况。这句可谓是真的秒秒秒。
