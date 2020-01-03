# 渲染Watcher的更新

由[前面]()我们知道了，一个属性的改变是如何联动导致各种`Watcher`的更新，这里我们进一步探讨这之中的渲染`Watcher`的更新。

首先，无论哪种`Watcher`都将根据其回调函数重新求值，渲染`Watcher`也不例外。在我们初始化渲染`Watcher`时传入的求值函数为`updateComponent()`，其作用就是重新从该组件开始重新编译和生成渲染函数(模版情况)，当然更新肯定不可能直接是全部重新编译，所以这里我们来看看他们的处理。

从上面的描述我们就可以看到，更新的起点是从受影响的`Watcher`，并非将所有的更新都进行一次。而在调用`updateComponent()`函数时，我们直接就在通过`render()`函数重新生成`VNode Tree`了，`updateComponent()`函数分为两个部分——`_render()`与`_update()`。

```js
updateComponent = function () {
    vm._update(vm._render(), hydrating);
};
```

其中`_render()`函数即对根据当前Watcher的组件的模版(或渲染函数)生成VNode，这个和初始化渲染是一样的，这里重点应该关注的是`_update()`函数：

```js
vm.$el = vm.__patch__(prevVnode, vnode);
```

同样的是在其中调用`__patch__`函数，相当于初始化渲染不同的是，这次并没有指定特殊的渲染行为，并且传入了上次渲染的同层级的`VNode`节点进行对比。其实看这个函数名就可以知道——打补丁，它对比同层级的`VNode`节点，然后对其不同进行打补丁的行为，让真实的`DOM`元素向最新的`VNode`同步。这里有个过程的[简述版本](../../../Vue中的diff算法/README.md)，如果你还愿意看我详细的唠叨下，那么可以继续往下看。

## 新旧VNode节点的diff

所谓`diff`就是找到新旧两个`VNode`节点的不同之处，然后进行处理。

### 新或旧VNode节点不存在时

首先最简单的情况就是新的`VNode`节点已经不存在了，那么我们只需要将旧的`DOM`片段删除并销毁其中的`vm`组件实例即可(当然旧的`VNode`节点也存在)。

```js
// 如果当前节点已经不存在，则直接销毁旧节点并返回。
if (isUndef(vnode)) {

    // 如果之前存在节点，那么直接调用该节点及其子节点的destroy()钩子函数
    if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
    return
}
```

既然有了这种情况，那么也有另一种简单情况：新`VNode`节点存在，旧`VNode`节点不存在，此时我们只需根据新的`VNode`节点创建元素即可。

```js
// 之前不存在节点时，即新生成了节点
if (isUndef(oldVnode)) {

    // empty mount (likely as component), create new root element
    // 凭空挂载，比如创建组件时，直接创建一个根的DOM元素
    // 改变状态为初始化补丁状态。
    isInitialPatch = true;

    // 为VNode创建元素，并创建其所有子元素
    createElm(vnode, insertedVnodeQueue);
}
```

以上情况仅出现在组件中，以根vm实例进行渲染时，`oldVnode`为一个元素。

### 两个VNode节点都存在时

当两个`VNode`节点都存在时，情况就比较复杂了，首先我们要确认，新旧`VNode`节点，是否在大体上是相同的，这个对比是通过`sameVnode()`函数，如果大体上相同，那么我们就可以复用这个节点代表的元素。

现在我们来猜想一下，满足什么条件可以称之为大体相同，从我们书写`Vue`代码触发，首先是指定`key`的节点，`key`必须相同，其次对于元素的类型和标签肯定也要一致，事实上这个函数也就是如此：

```js
function sameVnode (a, b) {

    // 当两个节点的key、tag、是否为注释、都具有节点属性、input类型是否相同
    return (
        a.key === b.key && (
            (
            a.tag === b.tag &&
                a.isComment === b.isComment &&
                isDef(a.data) === isDef(b.data) &&
                sameInputType(a, b)
            )
        )
    )
}
```

如果不满足`sameVnode()`这个条件，那么会像创建根`vm`实例一样，根据新的`VNode Tree`创建一个全新的`DOM`片段，所以这里唯一有价值的就是对于复用节点的判定:

```js
if (!isRealElement && sameVnode(oldVnode, vnode)) {
    // patch existing root node
    patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
}
```

从上面也同时反应，一个组件是否复用至少要**其占位节点**满足`sameVnode()`才行，现在我们来看看`patchVnode()`函数