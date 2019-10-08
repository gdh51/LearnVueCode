# initWatch(vm, opts.watch)
`Vue`通过`initWatch()`来初始化用户配置的`watch`。

```js
initWatch(vm, opts.watch);
function initWatch(vm: Component, watch: Object) {
    for (const key in watch) {
        const handler = watch[key];

        // 对用户注册watch的形式分别处理
        // 同一个属性的watch可以有多个函数来处理
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i]);
            }
        } else {
            createWatcher(vm, key, handler);
        }
    }
}
```

通过`createWatcher()`函数来为每个`watch`创建一个`watcher`实例，它们都是通过`vm.$watch()`方法来创建的
```js
function createWatcher(
    vm: Component,
    expOrFn: string | Function,
    handler: any,
    options ? : Object
) {

    // 处理对象形式的watch
    if (isPlainObject(handler)) {
        options = handler;
        handler = handler.handler;
    }

    // 当对应watch值为字符串时, 取vm实例上的该值所代表的的方法
    if (typeof handler === 'string') {
        handler = vm[handler];
    }

    // 注册watch
    return vm.$watch(expOrFn, handler, options);
}
```

我们知道可以通过`Vue`的实例方法`$watch`来注册一个`watch`，其实内部也是这种方式来注册的`watch`
```js
Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options ? : Object
): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
        return createWatcher(vm, expOrFn, cb, options)
    }

    options = options || {};

    // watch独有属性
    options.user = true;

    // 实例化一个watcher并进行求值和依赖项收集
    // 参数分别为 当前vm实例, watcher名, 回调函数, watcher配置
    const watcher = new Watcher(vm, expOrFn, cb, options);

    // 设置immediate时, 在注册完watch后立即触发一次
    if (options.immediate) {
        try {

            // 立即触发一次watch函数，并传入监听的值作为参数
            cb.call(vm, watcher.value);
        } catch (error) {
            handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
        }
    }

    // 返回一个用于销毁watcher的函数
    return function unwatchFn() {
        watcher.teardown();
    }
}
```
[实例化watcher的过程](../../Vue中的响应式属性/Watcher监听者对象)

返回的函数可以用于注销该`watch`，具体过程为：
1. 如果整个组件是否都要消耗？
   1. 是：不做处理转至第二步
   2. 否：从该组件的`watcher`队列中移除该`watcher`
2. 从该`watcher`监听的各个`dep`依赖项中移除该`watcher`

具体代码如下
```js
teardown() {
    if (this.active) {
        // remove self from vm's watcher list
        // this is a somewhat expensive operation so we skip it
        // if the vm is being destroyed.
        // 从watcher队列中移除该项，因为该项操作开销较大，所以当整个组件销毁时，我们不做处理
        if (!this.vm._isBeingDestroyed) {
            remove(this.vm._watchers, this);
        }

        // 从全部该watcher所需依赖项中移除该watcher
        let i = this.deps.length;
        while (i--) {
            this.deps[i].removeSub(this);
        }
        this.active = false;
    }
}

// 一个简单的数组移除项函数
function remove (arr: Array<any>, item: any): Array<any> | void {
  if (arr.length) {
    const index = arr.indexOf(item);
    if (index > -1) {
      return arr.splice(index, 1);
    }
  }
}
```
