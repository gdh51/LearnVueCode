# 渲染Watcher

先看下一渲染`Watcher`实例化时，如何传入的参数:

```js
new Watcher(vm, updateComponent, noop, {
    before() {
        if (vm._isMounted && !vm._isDestroyed) {
            callHook(vm, 'beforeUpdate')
        }
    }
}, true /* isRenderWatcher */ )
```

其中`updateComponent()`可以理解为生成DOM结构，这里的[`before()`](../../nextTick与渲染更新/README.MD#nexttick)函数就是我们之前在更新`Watcher`前，看到调用的方法，现在可以确认是生命周期函数。

在初始化`Wathcer`的最后个阶段，通过调用`Watcher.prototype.get()`来开始调用`updateComponent()`函数，进行依赖项的收集。
