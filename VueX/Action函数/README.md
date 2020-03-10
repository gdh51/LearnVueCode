# Action函数

首先是`Action`函数的注册：

```js
// 遍历注册当前module的action函数
// 当前有命名空间的其名称要加上命名空间
module.forEachAction(function (action, key) {
    var type = action.root ? key : namespace + key;
    var handler = action.handler || action;
    registerAction(store, type, handler, local);
});
```

从注册调用的回调函数我们可以看到，`action`函数在注册时就决定了其行为，根据其中的`root`字段，可以直接决定其提交的名称。之后是调用`registerAction()`函数完成注册：

## registerAction()————注册Action函数

该函数和`registerMutation`大同小异，不同的是`Action`函数的返回值，始终会被处理为一个`Promise`对象，且其在调用时，可以访问到更多的参数。

```js
//注册actions,并包装该action函数, 参入store接口作为实参
function registerAction(store, type, handler, local) {

    // 初始化，或取出对应类型的action回调数组
    var entry = store._actions[type] || (store._actions[type] = []);

    // 包装action函数, 所以我们在执行dispatch时能从第一个参数获取该module的信息
    entry.push(function wrappedActionHandler(payload, cb) {

        // 传入各种信息，任你使用
        var res = handler.call(store, {
            dispatch: local.dispatch,
            commit: local.commit,
            getters: local.getters,
            state: local.state,
            rootGetters: store.getters,
            rootState: store.state
        }, payload, cb);

        // 如果无返回值或返回值不是promise，则直接resolve
        if (!isPromise(res)) {
            res = Promise.resolve(res);
        }

        // 存在devtool插件的时候捕获错误
        if (store._devtoolHook) {
            return res.catch(function (err) {
                store._devtoolHook.emit('vuex:error', err);
                throw err
            });
        } else {
            return res
        }
    });
}
```

## Action的提交函数

首先依旧是原始的`Action`函数，它和`Mutation`大同小异，不过它使用`Promise`对象来进行封装：

```js
// 初始的dispatch函数
Store.prototype.dispatch = function dispatch(_type, _payload) {
    var this$1 = this;

    // 检查参数并统一为对象格式
    var ref = unifyObjectStyle(_type, _payload);

    // 获取dispatch的action名称
    var type = ref.type;
    var payload = ref.payload;

    var action = {
        type: type,
        payload: payload
    };

    // 获取该对应的actions函数
    var entry = this._actions[type];
    if (!entry) {
        {
            console.error(("[vuex] unknown action type: " + type));
        }
        return
    }

    // 在执行该action函数前，先调用观察它的订阅者们的before钩子函数
    try {
        this._actionSubscribers
            .filter(function (sub) {
                return sub.before;
            })
            .forEach(function (sub) {
                return sub.before(action, this$1.state);
            });
    } catch (e) {
        {
            console.warn("[vuex] error in before action subscribers: ");
            console.error(e);
        }
    }

    // 触发所有action回调函数
    var result = entry.length > 1 ?
        Promise.all(entry.map(function (handler) {
            return handler(payload);
        })) :
        entry[0](payload);

    //在state改变后执行所有订阅者的的after函数
    return result.then(function (res) {
        try {
            this$1._actionSubscribers
                .filter(function (sub) {
                    return sub.after;
                })
                .forEach(function (sub) {
                    return sub.after(action, this$1.state);
                });
        } catch (e) {
            {
                console.warn("[vuex] error in after action subscribers: ");
                console.error(e);
            }
        }
        return res;
    })
};
```

从上面可以看到，我们可以对`action`函数进行订阅，监听其调用前后调用后的`store.state`状态，这里不是本地的`state`注意，因为在之后我们会对其`this`指向进行绑定：

```js
var ref = this;
var dispatch = ref.dispatch;
this.dispatch = function boundDispatch(type, payload) {
    return dispatch.call(store, type, payload)
};
```

之后便是在创建本地上下文对象时，根据命名空间重写的该函数，但主要目的是重写其提交的类型：

```js
noNamespace ? store.dispatch : function (_type, _payload, _options) {

    // 格式化参数
    var args = unifyObjectStyle(_type, _payload, _options);
    var payload = args.payload;
    var options = args.options;
    var type = args.type;

    // 当没有配置或未设置root属性时，为其添加命名空间前缀
    // 这里的含义其实是在该module中提交action函数
    if (!options || !options.root) {
        type = namespace + type;
        if (!store._actions[type]) {
            console.error(("[vuex] unknown local action type: " + (args.type) + ", global type: " + type));
            return
        }
    }

    return store.dispatch(type, payload)
}
```
