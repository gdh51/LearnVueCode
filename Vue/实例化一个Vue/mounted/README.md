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

首先是调用`Vue.prototype.render()`函数，这个函数在我们最初`renderMixin()`时进行挂载的，我就直接把代码复制过来了：

```js

```