# 对象的处理

对于`Vue`对象的响应式处理，就是直接将所有的对象键值对都变为响应式：

```js
if (isPlainObject(value)) {
    // 遍历data中属性, 使每一个属性变为响应式并将其添加依赖到对应视图
    this.walk(value);
}

/**
 * Walk through all properties and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 * 遍历所有属性，将它们转化为getter/setters形式。(仅在为Object时这么做)
 */
walk(obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {

        // 重写所以的对象键值对
        defineReactive(obj, keys[i]);
    }
}
```

那么这里的`defineReactive()`方法在接下来会讲到，它将将键值对的属性描述符重写。
