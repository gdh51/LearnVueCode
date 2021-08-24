# transition组件

该组件大家都懂，用来作为给元素增加动画效果，主要分为两个阶段的动画效果，下面为这两个阶段在`create`阶段的处理：

- [入场过渡](./入场过渡/README.md)
- [离场过渡](./离场过渡/README.md)

## insert阶段

在`insert`阶段，我们的元素已经正式插入到文档中，对于非通过`v-show`显示的元素，我们还需要调用`insert()`函数来执行其`enter-js`的钩子函数

```js
function insert () {
    const parent = el.parentNode;
    const pendingNode = parent && parent._pending && parent._pending[vnode.key];

    // 优先调用离开的回调函数
    if (pendingNode &&
        pendingNode.tag === vnode.tag &&
        pendingNode.elm._leaveCb
    ) {
        pendingNode.elm._leaveCb();
    }

    // 再调用进入的enterHook
    enterHook && enterHook(el, cb);
}
```

## remove阶段

该函数调用于组件销毁阶段，执行过渡动画的函数，并执行`rm()`回调

```js
remove(vnode: VNode, rm: Function) {

    // 如果不是v-show = true，则执行离开动画
    if (vnode.data.show !== true) {

        // 传入rm在动画执行完毕时调用。
        leave(vnode, rm)
    } else {
        rm()
    }
}
```