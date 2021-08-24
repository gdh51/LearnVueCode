# beforeDestroy and destroyed

`Vue`中组件销毁有两种方式，第一种在新的一次渲染中组件`VNode`未被创建，那么之前的该节点就会被销毁；第二种情况则是组件内部主动调用`destroy API`。

无论哪种情况，本质上都是调用`vm.$destroy()`函数，那么我们首先来看第一种情况。

## 重新渲染中的销毁

我们知道，`VNode`的对比过程发生在`patch()`，在新的一次`patch()`过程中，同样的是使用的首次编译得出的`render()`函数来生成新的`VNode`，然后层层对比新旧的`VNode`。那么倘若当前新的`VNode`已经不存在且为组件`VNode`，那么就会为这个不存在的节点对应的`oldVNode`递归调用该函数：

```js
function invokeDestroyHook(vnode) {
    let i, j;

    // 取出节点的属性
    const data = vnode.data;

    // 如果存在
    if (isDef(data)) {

        // 调用其vm.$destroy()钩子函数
        if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode);

        // 调用我们定义的组件模块中的destroy()钩子函数
        for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
    }

    // 递归遍历子节点调用该函数。
    if (isDef(i = vnode.children)) {
        for (j = 0; j < vnode.children.length; ++j) {
            invokeDestroyHook(vnode.children[j])
        }
    }
}
```

注释中已经解释得很清晰了，这里就不多说明了，实际上也是调用的`API`来进行销毁，接下来是第二种销毁方式，主动销毁。

## 调用API主动销毁组件

主动调用则直接看该函数构造即可，可以看到销毁一共分为5步：

1. 调用`beforeDestroy`钩子函数。
2. 解除组件中`Watcher`实例与`Dep`依赖项的关系。
3. 递归销毁子组件
4. 调用`destroyed`钩子函数
5. 解除组件中的事件

```js
Vue.prototype.$destroy = function () {
    const vm: Component = this;

    // 如果该组件正在销毁，那么直接退出
    if (vm._isBeingDestroyed) {
        return
    }

    // 销毁前调用组件定义的beforeDestrory
    callHook(vm, 'beforeDestroy');

    // 变更状态，防止重复销毁
    vm._isBeingDestroyed = true;

    // remove self from parent
    // 将自己从父组件的子组件数组中移除
    const parent = vm.$parent;
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
        remove(parent.$children, vm)
    }

    // teardown watchers
    // 销毁该组件的watcher实例
    if (vm._watcher) {
        vm._watcher.teardown()
    }

    let i = vm._watchers.length;
    // 同时销毁该组件中其他的watcher
    while (i--) {
        vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
        vm._data.__ob__.vmCount--
    }

    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    // 递归调用子组件的销毁函数
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    callHook(vm, 'destroyed');
    // turn off all instance listeners.
    // 移除所有事件监听器
    vm.$off();

    // remove __vue__ reference
    // 如果该vm实例为根实例，那么还要移除该元素上的关系。
    if (vm.$el) {
        vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
        vm.$vnode.parent = null
    }
}
```

通过上述代码我们可以看出`Vue`只是**断开了当前销毁的`Vue`实例与其他实例的关系**，并没有处理`Vue`实例对应的那些`DOM`元素。所以如果想在销毁该组件时删除`DOM`中的该元素，还需自行处理。
