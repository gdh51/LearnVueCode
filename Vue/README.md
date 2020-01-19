# Vue构造函数

Vue 构造函数

```js
function Vue(options) {
    //只能做构造函数使用
    if (!(this instanceof Vue)) {
        warn(
            'Vue is a constructor and should be called with the `new` keyword'
        );
    }

    //初始化
    this._init(options);
}

// 五个在Vue构造函数之前的初始化
initMixin(Vue);
stateMixin(Vue);
eventsMixin(Vue);
lifecycleMixin(Vue);
renderMixin(Vue);
```

### new一个Vue实例时做了什么

[实例化一个Vue](./初始化一个Vue)
