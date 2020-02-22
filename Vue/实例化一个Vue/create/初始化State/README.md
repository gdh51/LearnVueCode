# initState()初始化vm实例属性

`vm`实例在初始化我们定义的属性时, 按`props`、`methods`、`data`、`computed`、`watcher`，这样的顺序来进行初始化的，直接贴代码：

```js
function initState(vm: Component) {

    // 初始化一个观察者对象数组, 用于存放watcher监听器们
    vm._watchers = [];
    const opts = vm.$options

    // 初始化props
    if (opts.props) initProps(vm, opts.props)

    // 初始化methods
    if (opts.methods) initMethods(vm, opts.methods)

    // 初始化data
    if (opts.data) {
        initData(vm)

    // 未定义data时，初始化一个空data并转化为响应式
    } else {
        observe(vm._data = {}, true /* asRootData */ )
    }

    // 初始化computed属性
    if (opts.computed) initComputed(vm, opts.computed)

    // 初始化watch监听器
    if (opts.watch && opts.watch !== nativeWatch) {
        initWatch(vm, opts.watch)
    }
}
```

在`initState()`的最开始，其进行了`_watchers`数组的初始化：

```js
vm._watchers = [];
```

>这个`watchers`数组是用来干什么的呢？在`Vue`中，有三类`Watcher`，它们通过监听属性的变化，来使自己发生变化，这三类`Watcher`分别为渲染`Watcher`、`Computed Watcher`、`Watch Watcher`；除此之外，每个属性拥有一个叫依赖项(`dep`)的东西，这个依赖项也会将监听它的`Watcher`单独收集起来，当该属性发生变化时，就通知这些`Watcher`来更新自己。暂时呢我们就了解一些大概就行了，具体我们会在后面详细说明。

接下来按顺序，详细介绍下如何进行初始化各属性

1. [初始化Props](./初始化Props/README.md)
2. [初始化Methods](./初始化Methods/README.md)
3. [初始化Data](./初始化Data/README.md)
4. [初始化Computed](./初始化Computed/README.md)
5. [初始化Watch](./初始化Watch/README.md)

学习完上面的`State`，我们可以对于`Computed`和`Watch`它们涉及到了一个`Watcher`对象的处理和`Dep`对象，这里我们就可以来深入了解下它究竟是什么！
