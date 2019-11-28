# patch过程中用到的函数

这里主要是存放的是内置在`createPatchFunction()`闭包中的函数，这些函数将在它的返回值函数`patch()`调用时使用到。

目录：

## createEle()

## createComponent()

## setScope()——设置CSS作用域属性

该函数用于检查节点是否需要设置`CSS`的作用域，如果需要则通过对每个元素添加和该`vm`实例唯一对应的`attribute`来进行设置

```js
// set scope id attribute for scoped CSS.
// this is implemented as a special case to avoid the overhead
// of going through the normal attribute patching process.
// 设置CSS属性的作用域
// 这是一个单独的实现，防止对元素的普通attribute进行patch时造成额外的开销
function setScope(vnode) {
    let i;

    // 该VNode节点是否存在属性作用域，有则设置
    if (isDef(i = vnode.fnScopeId)) {
        nodeOps.setStyleScope(vnode.elm, i);

    // 没有则
    } else {
        let ancestor = vnode

        // 遍历该vm实例中的祖先节点，继承它的作用域属性
        while (ancestor) {

            // 是否存在vm实例并且该实例上是否存在_scopeId
            if (isDef(i = ancestor.context) && isDef(i =i.$options._scopeId)) {

                // 有则设置同意的作用域属性
                nodeOps.setStyleScope(vnode.elm, i)
            }
            ancestor = ancestor.parent
        }
    }

    // for slot content they should also get the scopeId from the host instance.
    // 对于插槽中的内容，它们也需要添加当前vm实例的scoped属性
    if (isDef(i = activeInstance) &&
        i !== vnode.context &&
        i !== vnode.fnContext &&
        isDef(i = i.$options._scopeId)
    ) {
        nodeOps.setStyleScope(vnode.elm, i)
    }
}
```

## checkDuplicateKeys()——检查是否存在重复key值

该方法用于检查子节点数组中的`key`值是否存在重复的情况。

```js
// 检查子节点数组中是否存在重复的key
function checkDuplicateKeys(children) {

    // 一个key值的map对象
    const seenKeys = {};

    // 遍历子节点数组，检查它们的key值是否重复
    for (let i = 0; i < children.length; i++) {
        const vnode = children[i]
        const key = vnode.key;

        // 重复时报错
        if (isDef(key)) {
            if (seenKeys[key]) {
                warn(
                    `Duplicate keys detected: '${key}'. This may cause an update error.`,
                    vnode.context
                )
            } else {

                // 没重复时存入map对象中
                seenKeys[key] = true
            }
        }
    }
}
```