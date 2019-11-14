# optimze()——优化静态节点

该优化函数是筛选出静态节点，然后确认根静态节点，还在以后渲染时做出优化，函数不复杂，就是进行了遍历而已，先看以下大体的代码：

```js
function optimize(root: ? ASTElement, options : CompilerOptions) {
    if (!root) return;

    // 返回静态字段key的检查表
    isStaticKey = genStaticKeysCached(options.staticKeys || '');

    // 是否为原生标签
    isPlatformReservedTag = options.isReservedTag || no;

    // first pass: mark all non-static nodes.
    // 第一次遍历：标记所有的非静态节点
    markStatic(root);

    // second pass: mark static roots.
    // 第二次遍历：标记根静态节点
    markStaticRoots(root, false)
}
```

首先我们可以看到，通过`genStaticKeysCached()`获取了一个用于验证是否为静态字段的函数：

## genStaticKeysCached()——静态键值验证表缓存函数

该函数由2个函数组成：

```js
// 存储取值函数，注意这里缓存的是这个函数
const genStaticKeysCached = cached(genStaticKeys);

// 返回一个map表用于检查是否存在该字段，可以自定义一些字段
function genStaticKeys(keys: string): Function {
    return makeMap(
        'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
        (keys ? ',' + keys : '')
    )
}
```

[`cached()`](../../../../../一些常用的工具方法/README.md#cached%e7%bc%93%e5%ad%98%e5%87%bd%e6%95%b0)函数是一个用来存储一个函数输出结果的函数；而[`makeMap()`](../../../../../一些常用的工具方法/README.md#makemaphash%e8%a1%a8%e5%87%bd%e6%95%b0)则是用于生成一个查找传入字段是否字段的查找表，具体请点击函数查看具体代码。

而全部合在一起，也就是我们的`genStaticKeysCached()`函数，在这里的结果就是返回一个增加了`staticClass`、`staticStyle`两个键值的`map`函数，这个函数就用来检查是否有这些字段的。
___

接下来就是调用`markStatic()`来对每个节点进行标记：

## markStatic()——遍历全部ast对象，标记静态节点

该函数用于标记当前模版中所有ast节点对象是否为静态节点，如果当前节点为静态节点，但它的子节点不是，则它也不能称为静态节点：

```js
function markStatic(node: ASTNode) {

    // 检查是否为静态节点
    node.static = isStatic(node);

    // 为元素节点时
    if (node.type === 1) {

        // do not make component slot content static. this avoids
        // 1. components not able to mutate slot nodes
        // 2. static slot content fails for hot-reloading
        // 不要把组件的插槽内容静态化
        if (
            // 非原生元素
            !isPlatformReservedTag(node.tag) &&

            // 非slot元素
            node.tag !== 'slot' &&

            // 非内联模版
            node.attrsMap['inline-template'] == null
        ) {
            return;
        }

        for (let i = 0, l = node.children.length; i < l; i++) {
            const child = node.children[i]
            markStatic(child)

            // 子节点为非静态节点时，父节点也不能是
            if (!child.static) {
                node.static = false;
            }
        }

        // 同样对显示条件块中的元素进行检查
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                const block = node.ifConditions[i].block
                markStatic(block);
                if (!block.static) {
                    node.static = false
                }
            }
        }
    }
}
```

上面部分判断函数，我直接用注释写明用意了。
___
之后便进行第二次遍历，来标记那些静态节点的根节点：

## markStaticRoots()——标记静态节点的根节点

该函数用来标记当前节点是否为根静态节点，还有是否为`v-for`形式的根节点；它不允许当前静态节点只有一个子节点且是文本节点，因为这样用于存储它的消耗大于它带来的收益。

一旦确认某个节点为静态根节点，那么就直接退出不会在对其子节点进行标记。

```js
function markStaticRoots(node: ASTNode, isInFor: boolean) {
    if (node.type === 1) {

        // 静态节点或具有v-once
        if (node.static || node.once) {

            // 该节点是否在v-for中
            node.staticInFor = isInFor;
        }

        // For a node to qualify as a static root, it should have children that
        // are not just static text. Otherwise the cost of hoisting out will
        // outweigh the benefits and it's better off to just always render it fresh.
        // 如果一个节点为静态节点，那么其子节点不能仅仅是个静态文本节点，不然用于存储的损耗就大于它带来的收益
        // 节点为静态节点，并有多个子节点或一个子节点时，不为文本节点
        if (node.static && node.children.length && !(
                node.children.length === 1 &&
                node.children[0].type === 3
            )) {

            // 注意这里只要确认了静态根节点，就直接返回了，不会继续查询子节点了
            node.staticRoot = true;
            return;

        // 仅一个子节点且为文本
        } else {
            node.staticRoot = false
        }

        // 遍历子节点查询是否为根静态节点
        if (node.children) {
            for (let i = 0, l = node.children.length; i < l; i++) {
                markStaticRoots(node.children[i], isInFor || !!node.for)
            }
        }

        // 同样的遍历if条件块
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                markStaticRoots(node.ifConditions[i].block, isInFor)
            }
        }
    }
}
```

## 总结

`optimizer()`函数就是用来标记静态节点的，与静态根节点。
