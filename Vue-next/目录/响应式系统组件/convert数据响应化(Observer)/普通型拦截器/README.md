# 普通型拦截器

普通型的拦截器对象为：

```js
const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
};
```

## get取值器

那么首先是它的取值器的构成，它由`createGetter()`同一创建：

```js
const get = /*#__PURE__*/ createGetter();
```