# 计算属性的Watcher

这里我们将从计算属性的三个方面来讲解它：

- [初始化](#%e5%88%9d%e5%a7%8b%e5%8c%96)
- [依赖收集](#%e4%be%9d%e8%b5%96%e6%94%b6%e9%9b%86)
- [依赖更新](#%e4%be%9d%e8%b5%96%e6%9b%b4%e6%96%b0)

## 初始化

首先我们来看看计算属性`Watcher`初始化时的传值情况：

```js
const computedWatcherOptions = {
    lazy: true
};
// create internal watcher for the computed property.
// 为计算属性创建watcher并收集依赖项
watchers[key] = new Watcher(
    vm,

    // 计算属性定义时的函数
    getter || noop,
    noop, // noop表示undefined
    computedWatcherOptions
);
```

所以在初始化`new Watcher()`，它将进行的操作简化下来就为：

```js
this.vm = vm

// 将Watcher加入vm上的_watchers数组
vm._watchers.push(this);

// options
// 初始化配置
this.deep = !!options.deep;
this.user = !!options.user;
this.lazy = !!options.lazy;
this.sync = !!options.sync;
this.before = options.before;
this.cb = cb;
this.id = ++uid; // uid for batching
this.active = true;

// 注意这里，第一次求值是允许的
this.dirty = this.lazy; // for lazy watchers
this.deps = [];
this.newDeps = [];
this.depIds = new Set();
this.newDepIds = new Set();
this.expression = expOrFn.toString();

// Watcher变动所涉及的函数
// 这里即渲染Watcher的渲染函数或计算属性的计算函数
this.getter = expOrFn;

// 当前Watcher的值，当是computed时，延迟求值(即本次不求值)
this.value = undefined;
```

可以看到，计算属性除了初始化外，基本上没有做任何处理；另外就是标志计算属性的两个属性字段`dirty/lazy`

## 依赖收集

既然计算属性的`Watcher`根本没有求值，那么它就不会收集依赖项，也就不会更新。那么它什么时候进行第一次求值计算呢？设想一下既然它是`lazy`的，那么即只有当我们使用它时它才进行求值计算。这里的使用情况就比较多了，只要是`vm`中都有机会被使用到。那么此时我们可以看下计算属性的`getter`(注意第一次初始化`Computed`的`Watcher`时，`dirty = true`)：

```js
function computedGetter() {

    // 取出对应computed属性的Watcher对象
    const watcher = this._computedWatchers && this._computedWatchers[key]

    if (watcher) {

        // 如果当前Watcher允许重新求值，那么就对Watcher重新求值
        // 这里的dirty相当于是否允许求值，会在该Watcher的依赖项变更时变为true
        if (watcher.dirty) {
            watcher.evaluate()
        }

        // 收集依赖项
        if (Dep.target) {
            watcher.depend()
        }

        // 返回当前Watcher的值
        return watcher.value;
    }
}
```

这里我们可以看到，要调用`Watcher.prototype.evaluate()`对`Watcher`进行求值，并且如果当前`Dep.target`存在观察者，则还要进行依赖项收集。

## 依赖更新

