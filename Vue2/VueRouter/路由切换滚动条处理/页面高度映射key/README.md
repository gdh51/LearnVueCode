# 页面高度映射 key

`key`值的生成基于时间戳，所以确保它永远不会重复。它存在的作用在于记录它到对应页面高度信息对象的映射。

`key`的具体生成、查询如下，由于代码非常简单，就详细说了，已配有注释。

```js
const Time =
    inBrowser && window.performance && window.performance.now
        ? window.performance
        : Date;

function genStateKey(): string {
    return Time.now().toFixed(3);
}

// 第一次的时候key值
let _key: string = genStateKey();

// 获取当前的key值
function getStateKey() {
    return _key;
}

// 生成新的key值，提供给下一个路由跳转使用
function setStateKey(key: string) {
    return (_key = key);
}
```

在全局中，每次仅存在一个唯一值。
