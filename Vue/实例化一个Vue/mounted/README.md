# Mounted

生成DOM与挂载组件阶段，我们接着上次`mountComponent()`函数继续看：

```js
function mountComponent(
    vm: Component,
    el: ? Element,
    hydrating ? : boolean
): Component {
    vm.$el = el;

    // ....中间部分省略

    let updateComponent

    // 赋值updateComponent函数，记录是否记录渲染性能
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        updateComponent = () => {
            const name = vm._name
            const id = vm._uid
            const startTag = `vue-perf-start:${id}`
            const endTag = `vue-perf-end:${id}`

            mark(startTag)

            const vnode = vm._render()
            mark(endTag)
            measure(`vue ${name} render`, startTag, endTag)

            mark(startTag)
            vm._update(vnode, hydrating)
            mark(endTag)
            measure(`vue ${name} patch`, startTag, endTag)
        }
    } else {
        updateComponent = () => {
            vm._update(vm._render(), hydrating)
        }
    }

    // we set this to vm._watcher inside the watcher's constructor
    // since the watcher's initial patch may call $forceUpdate (e.g. inside child
    // component's mounted hook), which relies on vm._watcher being already defined
    // 为vue的dom创建一个watcher
    new Watcher(vm, updateComponent, noop, {
        before() {
            if (vm._isMounted && !vm._isDestroyed) {
                callHook(vm, 'beforeUpdate')
            }
        }
    }, true /* isRenderWatcher */ )
    hydrating = false

    // manually mounted instance, call mounted on self
    // mounted is called for render-created child components in its inserted hook
    if (vm.$vnode == null) {
        vm._isMounted = true
        callHook(vm, 'mounted');
    };

    return vm
}
```

从上面我们可以看到该阶段，主要就是创建渲染`Watcher`，在初始化该`Watcher`的过程中，便生成真实的`DOM`，我们再来重新认识下[渲染`Watcher`](../../Vue中的响应式属性/Watcher监听者对象/README.md#%e6%b8%b2%e6%9f%93watcher)

我相信你前面的`Watcher`创建流程已经了解了，我们主要看看这里面的`updateComponent()`函数干了什么：

```js
updateComponent = () => {
    vm._update(vm._render(), hydrating)
}
```

## _render()——生成根VNode节点

首先是调用`Vue.prototype.render()`函数，这个函数在我们最初`renderMixin()`时进行挂载的，我就直接把代码复制过来了：

```js
Vue.prototype._render = function (): VNode {
    const vm: Component = this;

    // 获取渲染函数和其父节点
    const {
        render,

        // 代表该组件父节点的占位符
        _parentVnode
    } = vm.$options

    // 存在父节点时(根Vue实例不存在)
    if (_parentVnode) {
        vm.$scopedSlots = normalizeScopedSlots(
            _parentVnode.data.scopedSlots,

            // 当前vm实例的具名插槽(该对象只在2.5版本旧语法slot的情况下存在)
            vm.$slots,

            // 当前vm实例的作用域插槽
            vm.$scopedSlots
        )
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 设置父节点，这允许渲染函数可以通过该节点来访问父节点上的data
    vm.$vnode = _parentVnode;

    // render self
    let vnode;
    try {
        // There's no need to maintain a stack becaues all render fns are called
        // separately from one another. Nested component's render fns are called
        // when parent component is patched.
        // 这里没有必要去维护一个栈，因为所有渲染函数会独立调用。
        // 嵌套的组件渲染函数会在其父组件打补丁时进行渲染
        currentRenderingInstance = vm;

        // 调用渲染函数，生成我们根Vue实例的Vnode节点们
        vnode = render.call(vm._renderProxy, vm.$createElement);
    } catch (e) {
        handleError(e, vm, `render`)
        // return error render result,
        // or previous vnode to prevent render error causing blank component
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production' &&vm.$options.renderError) {
            try {
                vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
            } catch (e) {
                handleError(e, vm, `renderError`)
                vnode = vm._vnode
            }
        } else {
            vnode = vm._vnode
        }
    } finally {

        // 清空当前渲染的实例
        currentRenderingInstance = null
    }

    // if the returned array contains only a single node, allow it
    // 如果返回的节点数组中只存在一个节点，则承认它，如果返回多个根节点，那么对起报错
    if (Array.isArray(vnode) && vnode.length === 1) {
        vnode = vnode[0]
    }

    // return empty vnode in case the render function errored out
    // 不允许有多个根节点，此时返回空的VNode节点以防渲染函数出错
    if (!(vnode instanceof VNode)) {
        if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
                warn(
                'Multiple root nodes returned from render function. Render function ' +
                'should return a single root node.',
                vm
            )
        }
        vnode = createEmptyVNode()
    }

    // set parent
    // 设置该节点的parent，为该vm实例的占位符。
    vnode.parent = _parentVnode
    return vnode;
}
```

由于是根`Vue`实例，所以我们暂时不对`normalizeScopedSlots()`进行学习，那么就下来，就是调用我们的渲染函数`render.call(vm._renderProxy, vm.$createElement);`，生成一个我们根`Vue`实例的模版`VNode`节点，这里正常情况下只有一个，之后对该`Vnode`节点`parent`节点进行了处理，这个过程就结束了，注意这个过程并没有对组件的模版进行解析和生成`VNode`。

关于`render()`函数的执行，这里因为要根据模版变换，这里我以[几个例子](./渲染函数的调用的例子/README.md)展开来开展学习。

## _update()——渲染DOM模版

该函数是在`lifecycleMixin()`期间添加到`Vue.prototype`