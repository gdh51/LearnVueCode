# 初始化Options中的属性
在初始化一个新的Vue实例时, 会按以下顺序初始化我们在`Options`中设置的属性：
```js
// 初始化vue实例生命周期中的一些属性
initLifecycle(vm)

// 初始化在组件上注册的自定义事件(定义在模版中的)
initEvents(vm)

// 初始化与模版渲染有关的属性与函数
initRender(vm)

// 调用beforeCreate生命周期函数(包括mixin中的)
callHook(vm, 'beforeCreate')

// 初始化inject注入的函数
initInjections(vm)

// 分别初始化props、methods、data、computed、watcher
initState(vm)
initProvide(vm)
callHook(vm, 'created')
```

## initState()初始化vm实例属性
vm实例在初始化我们常用的属性时, 按`props`、`methods`、`data`、`computed`、`watcher`，这样的顺序来进行初始化的，直接贴代码
```js
function initState (vm: Component) {
  // 初始化一个观察者对象, 用于存放watcher定义的监听器
  vm._watchers = []
  const opts = vm.$options

  if (opts.props) initProps(vm, opts.props)

  if (opts.methods) initMethods(vm, opts.methods)

  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  if (opts.computed) initComputed(vm, opts.computed)

  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```

接下来按顺序，详细介绍下如何进行初始化各属性

1. [初始化Props](./初始化Props)
2. [初始化Methods](./初始化Methods)
3. [初始化Data](./初始化Data)
4. [初始化Computed](./初始化Computed)
5. [初始化Watch](./初始化Watch)