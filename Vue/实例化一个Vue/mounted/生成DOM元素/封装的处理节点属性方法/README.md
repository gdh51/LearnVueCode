# module——处理VNode属性的方法

首先该数组中的方法都用来处理`VNode`节点的属性的，没错，就是`vue`中的那些指令属性的处理：

先看看该数组的由来：

```js
// the directive module should be applied last, after all
// built-in modules have been applied.
// 指令型的模块应该最后调用，待所有内置模块调用后
const modules = platformModules.concat(baseModules);
```

现在还不懂是正常的。那么`platformModules`为：

```js
[
    attrs: {
        create: updateAttrs,
        update: updateAttrs
    },
    klass:{
        create: updateClass,
        update: updateClass
    },
    events:{
        create: updateDOMListeners,
        update: updateDOMListeners
    },
    domProps:{
        create: updateDOMProps,
        update: updateDOMProps
    },
    style:{
        create: updateStyle,
        update: updateStyle
    },
    transition:inBrowser ? {
        create: _enter,
        activate: _enter,
        remove () {}
    } : {}
]
```

那么`baseModules`为：

```js
[
    ref: {
        create () {},
        update () {},
        destroy () {}
    },
    directives: {
        create: updateDirectives,
        update: updateDirectives,
        destroy: function unbindDirectives () {}
    }
]
```

导致了解一下是什么就够了。
