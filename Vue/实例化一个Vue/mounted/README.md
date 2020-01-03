# Mounted

生成`DOM`与挂载组件阶段，我们接着上次`mountComponent()`函数继续看：

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
    // 手动挂载实例时，会自己调用mounted函数
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

关于`render()`函数的执行，这里因为要根据模版变化，这里我以[几个例子](./渲染函数的调用的例子/README.md)展开来开展学习。
____
最后该函数返回我们`vm`根实例的根`VNode`节点，根据该根`VNode`，我们调用`_update()`函数来生成`DOM`片段。

## _update()——渲染DOM模版

该函数是在`lifecycleMixin()`期间添加到`Vue.prototype`上的函数，用于渲染`DOM`片段，具体如下：

```js
Vue.prototype._update = function (vnode: VNode, hydrating ? : boolean) {
    const vm: Component = this;

    // 上一个元素(如果为根实例，那么此时就为挂载的元素)
    const prevEl = vm.$el;

    // 上一个Vnode节点(如果为根实例那么此时就为空)(其他时候为根VNode节点)
    const prevVnode = vm._vnode;

    // 设置当前更新的vm实例，并存储上一个vm实例，
    // 返回一个用于切换为上一个实例的函数
    const restoreActiveInstance = setActiveInstance(vm);

    // 将当前VNode节点，挂载至_vnode(所以当前节点)
    vm._vnode = vnode;

    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // __patch__基于是否为后端渲染，已在Vue初始化时已经注入原型上(此时为浏览器渲染)

    // 存不在上一个VNode时
    if (!prevVnode) {

        // initial render
        // 初始化渲染后
        vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */ )
    } else {
        // updates
        vm.$el = vm.__patch__(prevVnode, vnode)
    }

    // 释放当前vm实例
    restoreActiveInstance()

    // update __vue__ reference
    if (prevEl) {

        // 清空根元素对vm实例的引用
        prevEl.__vue__ = null
    }

    if (vm.$el) {

        // 更新元素对vm实例的引用
        vm.$el.__vue__ = vm
    }

    // if parent is an HOC, update its $el as well
    // 如果父级为高阶组件，也更新它的$el
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
        vm.$parent.$el = vm.$el
    }

    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
}
```

首先该方法先确认上一个该`vm`实例的上一个挂载的元素`.$el`，与之对应的`VNode`节点，然后调用[`setActiveInstance()`](./其他工具方法/README.md#setactiveinstance%e8%ae%be%e7%bd%ae%e5%bd%93%e5%89%8d%e6%9b%b4%e6%96%b0%e7%9a%84vm%e5%ae%9e%e4%be%8b)方法来设置当前根`vm`实例为要进行渲染的实例。之后更新之前最新的根`VNode`节点。此时就开始产生分歧：在初始化渲染中，我们要确定渲染行为；而非初始化渲染时，因为已经转交给客户端了，所以我们不用关心其渲染的行为了。

行为分为两种:

- 服务器渲染(`hydration`注水)
- 客户端渲染

此处我们先只讲述客户端渲染，所以调用[`__patch__()`](./生成DOM元素/README.md)方法，它即我们所说的`vm`打补丁，通过它就正式开始了生成`DOM`模版，返回其`._vnode`代表的根节点的元素。之后调用[`restoreActiveInstance()`](./其他工具方法/README.md#setactiveinstance%e8%ae%be%e7%bd%ae%e5%bd%93%e5%89%8d%e6%9b%b4%e6%96%b0%e7%9a%84vm%e5%ae%9e%e4%be%8b)释放当前`vm`实例，将根`vm`实例同时挂载到根元素上。渲染就完成了。
____

正常渲染的`Watcher`结束后，如果是组件自己挂载的，会自动在其`insert-hook`钩子函数中调用`mounted()`函数，所以此处我们要手动去调用下根`Vue`实例的`mounted()`函数，至此我们的渲染全部结束，等待我们的是由更新带来的变化。
