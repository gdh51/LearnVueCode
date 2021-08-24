# 内部辅助方法

那么这里存放了`Vuex.Store`中初始化时的一些辅助方法，目录：

- [forEachValue()———对象形式的forEach函数](#foreachvalue%e5%af%b9%e8%b1%a1%e5%bd%a2%e5%bc%8f%e7%9a%84foreach%e5%87%bd%e6%95%b0)
- [getNestedState()——获取指定路径下的state](#getnestedstate%e8%8e%b7%e5%8f%96%e6%8c%87%e5%ae%9a%e8%b7%af%e5%be%84%e4%b8%8b%e7%9a%84state)
- [forEachXXXX()————module指定属性版本的forEach](#foreachxxxxmodule%e6%8c%87%e5%ae%9a%e5%b1%9e%e6%80%a7%e7%89%88%e6%9c%ac%e7%9a%84foreach)

## forEachValue()———对象形式的forEach函数

简单易懂，对象形式的`Array.prototype.forEach()`函数：

```js
function forEachValue(obj, fn) {
    Object.keys(obj).forEach(function (key) {
        return fn(obj[key], key);
    });
}
```

## getNestedState()——获取指定路径下的state

该方法用于获取从指定的`state`开始，指定`path`下的`state`，同样是巧妙的运用了`Array.prototype.reduce()`方法。

```js
// 从state开始，返回指定path路径下的state
function getNestedState(state, path) {
    return path.length ?
        path.reduce(function (state, key) {
            return state[key];
        }, state) :
        state;
}
```

## unifyObjectStyle()——格式化参数为对象形式

该方法用于格式化传入函数的参数为统一的对象形式。

```js
function unifyObjectStyle(type, payload, options) {
    //当传入一个对象作为参数时, 统一为对象格式
    if (isObject(type) && type.type) {
        options = payload;
        payload = type;
        type = type.type;
    }

    {
        assert(typeof type === 'string', ("expects string as the type, but found " + (typeof type) + "."));
    }

    return {
        type: type,
        payload: payload,
        options: options
    }
}
```

## forEachXXXX()————module指定属性版本的forEach

在module的属性注册时，我们可以看到很多类似`module.forEachXXX()`的函数，那么它们实际上是对指定的属性`XXX`调用[`forEachValue()`](#foreachvalue%e5%af%b9%e8%b1%a1%e5%bd%a2%e5%bc%8f%e7%9a%84foreach%e5%87%bd%e6%95%b0)方法的封装而已，比如这里的`forEachMutation()`：

```js
Module.prototype.forEachMutation = function forEachMutation(fn) {

    // 获取其原始配置中的mutations函数
    if (this._rawModule.mutations) {

        // 调用对象版本的forEach
        forEachValue(this._rawModule.mutations, fn);
    }
};
```
