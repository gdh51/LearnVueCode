# Mutaion函数

首先我们从`Mutation`函数的注册看起：

```js
// 遍历当前module的mutation函数，在store上注册
// 当前有命名空间的其名称要加上命名空间
module.forEachMutation(function (mutation, key) {

    // 为其mutation的名称添加命名空间
    var namespacedType = namespace + key;

    // 在store上注册该mutation函数
    registerMutation(store, namespacedType, mutation, local);
});
```

这个[`forEachXXX()`](../内部辅助方法/README.md#foreachxxxxmodule%e6%8c%87%e5%ae%9a%e5%b1%9e%e6%80%a7%e7%89%88%e6%9c%ac%e7%9a%84foreach)，相当于对每一个`mutation`函数遍历调用这个回调函数。

从这个回调函数我们可以看出，**每一个`mutation`函数的名称都被重写加入了命名空间**，之后才调用`registerMutation()`进行注册。

## registerMutation()————注册Mutation函数

该函数就用于来在全局`store`上注册该`mutation`函数了，非常简单，就是在对应的键值对挂载该函数：

```js
//在store._mutations上挂载当前module的mutation函数
function registerMutation(store, type, handler, local) {

    // 初始化该mutation名称的回调函数数组
    var entry = store._mutations[type] || (store._mutations[type] = []);

    // 通过wrappedMutationHandler封装，主要是重定义其传入的参数
    entry.push(function wrappedMutationHandler(payload) {

        //this绑定至store实例，并传入当前module的state
        handler.call(store, local.state, payload);
    });
}
```

我们可以看到，当该`mutation()`函数调用时，会被传入其`module.context`中的`state`，与具体传入的参数。

当然还没完，这里配套还要提一下它的提交函数`commit()`。

## Mutation提交函数commit

我们从`commit()`函数的一生来看起，首先是其`pure`的原函数：

```js
// mutation函数,用来更改state状态
Store.prototype.commit = function commit(_type, _payload, _options) {
    var this$1 = this;

    // check object-style commit
    //检查参数并同一格式
    var ref = unifyObjectStyle(_type, _payload, _options);
    var type = ref.type;
    var payload = ref.payload;
    var options = ref.options;

    //在没有命名空间时,取出对应名称的mutation数组,遍历执行其函数
    var mutation = {
        type: type,
        payload: payload
    };
    var entry = this._mutations[type];
    if (!entry) {
        {
            console.error(("[vuex] unknown mutation type: " + type));
        }
        return
    }

    //暂时切换为允许修改state, 在函数执行完后切换为设置的strict状态
    this._withCommit(function () {
        entry.forEach(function commitIterator(handler) {
            handler(payload);
        });
    });

    //通知所有订阅者
    this._subscribers.forEach(function (sub) {
        return sub(mutation, this$1.state);
    });

    if (
        options && options.silent
    ) {
        console.warn(
            "[vuex] mutation type: " + type + ". Silent option has been removed. " +
            'Use the filter functionality in the vue-devtools'
        );
    }
};
```

非常简单的逻辑，就是取出具体的`mutation`名称的数组，遍历进行调用其内部的回调函数，之后如果有订阅者则在回调函数调用完后将最新的`state`告诉它们。

其次是它在`Store`实例化时的表现：

```js
var commit = ref.commit;

this.commit = function boundCommit(type, payload, options) {
    return commit.call(store, type, payload, options)
};
```

这里其实就是将`this`指向通过闭包绑定在了`store`。之后便是本地上下文上的`commit()`，此时具有两种情况：

```js
noNamespace ? store.commit : function (_type, _payload, _options) {

    // 同上，未设置root或options时，在本地上下文问提交mutation
    if (!options || !options.root) {
        type = namespace + type;
        if (!store._mutations[type]) {
            console.error(("[vuex] unknown local mutation type: " + (args.type) + ", global type: " + type));
            return
        }
    }

    store.commit(type, payload, options);
}
```

这里我就直接简化了，大概意思就是两种：

- 无命名空间：使用原函数
- 有命名空间：在非指定使用根访问时，重新提交的`mutation`函数类型

这里相当于增加了`commit()`提交的行为，使其可以分区提交。
