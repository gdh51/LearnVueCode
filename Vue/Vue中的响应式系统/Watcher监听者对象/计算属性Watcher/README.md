# 计算属性的Watcher

这里我们将从计算属性的三个方面来讲解它：

- [初始化](#%e5%88%9d%e5%a7%8b%e5%8c%96)
- [依赖收集](#%e4%be%9d%e8%b5%96%e6%94%b6%e9%9b%86)
- [依赖更新(何时与怎么进行computed属性更新？)](#%e4%be%9d%e8%b5%96%e6%9b%b4%e6%96%b0%e4%bd%95%e6%97%b6%e4%b8%8e%e6%80%8e%e4%b9%88%e8%bf%9b%e8%a1%8ccomputed%e5%b1%9e%e6%80%a7%e6%9b%b4%e6%96%b0)

除此之外，还有个问题那么就是当`computed`属性如果作为一个依赖项怎么办？

- [作为依赖项的computed属性](#computed%e5%b1%9e%e6%80%a7%e4%be%9d%e8%b5%96%e9%a1%b9%e6%94%b6%e9%9b%86%e7%9a%84%e6%95%b4%e7%90%86)

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

既然计算属性的`Watcher`根本没有求值，那么它就不会收集依赖项，也就不会更新。那么它什么时候进行第一次求值计算呢？设想一下既然它是`lazy`的，那么即只有当我们使用它时它才进行求值计算。这里的它被使用情况就比较多了，只要是`vm`中都有机会被使用到。那么此时我们可以看下计算属性的`getter`(注意第一次初始化`Computed`的`Watcher`时，`dirty = true`)：

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

        // 重新让watcher的依赖项将该watcher添加到观察者对象中
        if (Dep.target) {
            watcher.depend()
        }

        // 返回当前Watcher的值
        return watcher.value;
    }
}
```

这里我们可以看到，当允许计算时要调用[`Watcher.prototype.evaluate()`](../README.md#watcherprototypeevaluate%e8%ae%a1%e7%ae%97watcher%e7%9a%84%e5%80%bclazy-watcher%e4%b8%93%e5%b1%9e)(点击查看详情)对`Watcher`进行求值，并且进行依赖项收集。

这里就涉及一个`dirty`字段来对是否可以求值来进行把控，直接说，该值会在**其依赖项更新时将其更新为`dirty = true`并在该计算属性下次被使用时，再次进行求值**。

## 依赖更新(何时与怎么进行computed属性更新？)

知道了`Computed`属性如何收集依赖项后，现在我们要对如何更新进行探讨。上文我们提到每次`Computed`属性的更新都依赖于其`watcher.dirty`属性，该值只会在第一次或计算属性依赖项更新后才会变化为`true`(这里又涉及个新东西待会学习)。

>这里只简单解释依赖项更新时的流程：其按以下步骤

1. 某个所依赖的值发生变化，触发其`dep.notify()`
2. 通过`dep.notify()`通知对应的`watcher`触发`watcher.update()`
3. 在`update()`方法中，`computed`走第一条路线，改变其`watcher.dirty`的值为`true`，其含义为**允许**`computed`重新进行求值和依赖项收集。

```js
Watcher.prototype.update() {
        if (this.lazy) {

        // 会触发这里
        this.dirty = true
    } else ...

    // 后面就略了
}
```

到此为止，其他的过程就和依赖项收集中的求值一样了。

![computed属性的依赖项发生了变化的流程](../../img/computed属性的依赖项发生了变化的流程.svg)

## computed属性依赖项收集的整理

从上面描述我们看出：`computed`自身无`dep`依赖项，它不作为一个值来进行处理。**此时以`computed`属性作为依赖项目标的`watcher`将直接观察`computed`所依赖的依赖项**来判断是否对自身进行更新。

>这里又涉及到个问题，那就是一个`Vue`中`Computed Watcher`创建的时间一定是最早的，因为在更新全部`Watcher`时，是按照`Watcher`创建时间从早到晚来依次更新的，介于`Computed`属性可能会用于各种地方，所以它必须尽早更新，当然在这个部分就扯远了，学习了刷新队列时就会对这个会有一个了解。

所以，只要目标`watcher`要重新进行求值计算，无论`computed`属性是否变化都需要重新进行计算(无变化时返回原值即可)
