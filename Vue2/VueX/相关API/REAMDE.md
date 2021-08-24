# 相关API

这里就介绍了`VueX`的相关`API`的内部原理，首先是[`5`个暴露出来的辅助函数](./辅助函数/REAMDE.md)

除了上面的`5`个`api`外，我们在初始化`Store`时，明显还生成了以下两个参数，但我们仅在提交`mutation`函数时看见过`_subscribers`通知的过程：

```js
//存放订阅者
this._subscribers = [];

// 声明一个vm实例，用来监听getter的返回值
this._watcherVM = new Vue();

//存放action订阅者
this._actionSubscribers = [];
```

那么这里就讲讲它们两个具体产生的过程：

## Store.prototype.watch()——store版本的监听函数

该实例方法实际为`Store`版本的`Vue.prototype.$watch`，不同的是其只接收函数形式的键名监听。

```js
// 该函数可以理解为Store版本的watch函数，且其只接收函数作为键名
Store.prototype.watch = function watch(getter, cb, options) {
    var this$1 = this;

    // 要监控的getter必须为函数
    {
        assert(typeof getter === 'function', "store.watch only accepts a function.");
    }

    // 监听getter返回值的变化
    return this._watcherVM.$watch(function () {
        return getter(this$1.state, this$1.getters);
    }, cb, options)
};
```

## Store部分值或函数的监听

`Store`下的数据或函数监听都是通过`genericSubscribe()`来实现的，它会将回调函数添加到订阅者队列中，并返回一个用于取消订阅的函数。

```js
function genericSubscribe(fn, subs) {

    //函数不存在时就push进入订阅者队列
    if (subs.indexOf(fn) < 0) {
        subs.push(fn);
    }

    //返回一个函数用于取消订阅
    return function () {
        var i = subs.indexOf(fn);
        if (i > -1) {
            subs.splice(i, 1);
        }
    }
}
```

### commit函数订阅者

如果我们想订阅`commit()`的提交，那么我们可以调用以下函数来实现：

```js
Store.prototype.subscribe = function subscribe(fn) {
    return genericSubscribe(fn, this._subscribers)
};
```

当订阅后，每当`commit()`被触发成功时，就执行这些回调函数：

```js
//通知所有订阅者
this._subscribers.forEach(function (sub) {
    return sub(mutation, this$1.state);
});
```

### action函数订阅者

对于`action`函数执行的周期的订阅，我们能关注的时间点更多，默认情况下是关注其执行之前，当然我们可以可以配置观察其执行之后：

```js
Store.prototype.subscribeAction = function subscribeAction(fn) {
    var subs = typeof fn === 'function' ? {
        before: fn
    } : fn;
    return genericSubscribe(subs, this._actionSubscribers)
};
```

这里就不展示执行前的订阅者触发逻辑了，执行后的`after`回调函数触发通过`promise`对象来保证其的有序性，并且会传入最新的`state`：

```js
this$1._actionSubscribers
    .filter(function (sub) {
        return sub.after;
    })
    .forEach(function (sub) {
        return sub.after(action, this$1.state);
    });
```

## 动态添加/删除module——Store.prototype.registerModule/unregisterModule()

该函数用于在`Store`中动态注册或删除`module`，它整个过程于我们初始化`Store`的过程其实是大同小异的。

```js
//在path路径动态新注册一个module
Store.prototype.registerModule = function registerModule(path, rawModule, options) {
    if (options === void 0) options = {};

    // path统一为数组
    if (typeof path === 'string') {
        path = [path];
    }

    // 不能在根module上注册
    {
        assert(Array.isArray(path), "module path must be a string or an Array.");
        assert(path.length > 0, 'cannot register the root module by using registerModule.');
    }

    // 在moduleCollection上注册该module的原始信息
    this._modules.register(path, rawModule);

    // 注册该module的各种属性
    installModule(this, this.state, path, this._modules.get(path), options.preserveState);

    // reset store to update getters...
    // 通过新建vue实例重设store,并注册响应式属性
    resetStoreVM(this, this.state);
};
```

删除一个`module`的破坏力比较大，建议大家不要动态删除。

```js
Store.prototype.unregisterModule = function unregisterModule(path) {
    var this$1 = this;

    //同样的path转换为数组
    if (typeof path === 'string') {
        path = [path];
    }

    {
        assert(Array.isArray(path), "module path must be a string or an Array.");
    }

    //移除模块对象中的模块
    this._modules.unregister(path);

    //获取对应的state并删除
    this._withCommit(function () {
        var parentState = getNestedState(this$1.state, path.slice(0, -1));

        // 删除对应的state
        Vue.delete(parentState, path[path.length - 1]);
    });

    // 重制store, 更新state
    resetStore(this);
};
function resetStore(store, hot) {
    //初始化其他属性
    store._actions = Object.create(null);
    store._mutations = Object.create(null);
    store._wrappedGetters = Object.create(null);
    store._modulesNamespaceMap = Object.create(null);
    var state = store.state;

    // 重新注册所有module
    installModule(store, state, [], store._modules.root, true);

    // 重置store, 设置响应属性
    resetStoreVM(store, state, hot);
}
```

我们从上面可以看到删除一个`module`基本上把初始化操作都做了一遍，除了`module`和订阅者的生成，所以大家尽量不要删除。
