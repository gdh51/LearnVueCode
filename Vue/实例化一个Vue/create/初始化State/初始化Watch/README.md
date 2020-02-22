# initWatch(vm, opts.watch)——注册Watch监听器

`Vue`通过`initWatch()`来初始化组件配置中的`watch`字段。

```js
function initWatch(vm: Component, watch: Object) {

    // 遍历用户定义的watch
    for (const key in watch) {
        const handler = watch[key];

        // 对watch的类型分别处理创建Watcher
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i])
            }
        } else {
            createWatcher(vm, key, handler)
        }
    }
}
```

作为调度函数，该函数仅是处理用户定义的`watch`格式，对于每一个`watch`处理器的具体处理，还需要通过`createWatcher()`来处理。通过`createWatcher()`函数来为**每个`watch`的函数监听器**创建一个`Watcher`实例，它们都是通过`Vue.prototype.$watch()`方法来创建的，按照我们的了解我们知道该`API`会返回一个用于注销该`Watcher`的函数，但很遗憾，寄生在组件中的`watch`无法注销。

```js
// 该函数用于格式化参数，然后调用$watch API
function createWatcher(
    vm: Component,
    expOrFn: string | Function,

    // 定义的实际watch，可能有对象或字符串，函数形式
    handler: any,
    options ? : Object
) {

    // 处理对象形式的watch
    if (isPlainObject(handler)) {

        // 对象形式的watch，将其视为options
        options = handler;

        // 提出里面的函数处理器赋值给handler
        handler = handler.handler;
    }

    // 当对应watch值为字符串时, 取vm实例上的该值所代表的的方法
    if (typeof handler === 'string') {
        handler = vm[handler];
    }

    // 注册watch，调用原型API，参数分别为watch名、函数处理器、watch配置对象
    return vm.$watch(expOrFn, handler, options)
}
```

我们知道可以通过`Vue`的实例方法`Vue.prototype.$watch`可以来注册一个`watch`，其实内部也是这种方式来注册的`watch`：

```js
Vue.prototype.$watch = function (
        expOrFn: string | Function,
        cb: any,
        options ? : Object
    ): Function {
        const vm: Component = this;

    // 如果为对象，则格式化后在进行创建
    if (isPlainObject(cb)) {
        return createWatcher(vm, expOrFn, cb, options)
    }

    // 存储配置对象，定义特定字段user
    options = options || {};
    options.user = true;

    // 参数分别为 当前vm实例, watcher名, 回调函数, watcher配置
    const watcher = new Watcher(vm, expOrFn, cb, options);

    // 设置immediate时, 在注册完watcher后立即触发一次
    if (options.immediate) {
        try {
            cb.call(vm, watcher.value)
        } catch (error) {
            handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
        }
    }

    // 返回一个用于销毁watcher的函数
    return function unwatchFn() {
        watcher.teardown()
    }
}
```

从这个`API`，我们可以看出，相比于`computed`的创建，它仅创建了一个`Watcher`对象并未做其他处理，到此就告一段落，这部分内容。

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
