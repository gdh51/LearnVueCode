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

## create周期中的钩子函数

`create`周期中的钩子函数函数共8个：
![create周期的钩子函数](./imgs/create&#32;hooks.png)，

它们用于对那些`vue`指令进行处理，就按上述中的顺序进行调用，现在分别来看看它们具体的调用:

- [updateAttrs()——更新dom元素attribute](./更新元素Attribute/README.md#updateattrs%e6%9b%b4%e6%96%b0dom%e5%85%83%e7%b4%a0attribute)
- [updateClass()——更新元素的class](./更新元素Class/README.md)
- [updateDOMListener()——更新dom事件处理器](./更新事件处理器/README.md)
- [updateDOMProps()——更新元素的Property](./更新元素Property/README.md)
- [updateStyle()——更新style属性](./更新元素Style/README.md)
- [transition组件入场过渡](./transition组件/入场过渡/README.md)
- [更新ref元素](./更新ref/README.md)
- [updateDirectives()——更新指令](./更新指令/README.md)

____
可以看到上述都是针对`VNode`节点的`data`属性进行更新。
