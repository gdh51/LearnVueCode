# 存储的key值(state.key)

在`history API`调用时，每次都会附带一个`state`(存储)，其中保存则一个用时间戳生成的唯一`key`值，该`key`值仅会在`replace URL`时被更新。

介于这个模块的代码量较少，这里我直接全部拿出来：

```js
// use User Timing api (if present) for more accurate key precision
// 使用User Timing来获取更精准的时间
const Time =
    inBrowser && window.performance && window.performance.now ?
    window.performance :
    Date

function genStateKey(): string {

    // 取当前时间保留三位小数
    return Time.now().toFixed(3)
}

let _key: string = genStateKey()

function getStateKey() {
    return _key
}

function setStateKey(key: string) {
    return (_key = key)
}
```

从上面代码可以比较轻易的看出这个`key`值在`URL`相同时是永远一样的，除非生成一个新的并调用`setStateKey()`方法来替换。
