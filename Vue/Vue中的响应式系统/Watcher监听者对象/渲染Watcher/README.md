# 渲染Watcher

对于渲染Watcher，我们同样是通过两个步骤来学习：

- [初始化与依赖项收集](#%e5%88%9d%e5%a7%8b%e5%8c%96%e4%b8%8e%e4%be%9d%e8%b5%96%e9%a1%b9%e6%94%b6%e9%9b%86)
- [依赖项更新](#%e4%be%9d%e8%b5%96%e9%a1%b9%e6%9b%b4%e6%96%b0)

## 初始化与依赖项收集

先看下一渲染`Watcher`实例化时，如何传入的参数:

```js
new Watcher(vm, updateComponent, noop, {
    before() {
        if (vm._isMounted && !vm._isDestroyed) {
            callHook(vm, 'beforeUpdate')
        }
    }
}, true /* isRenderWatcher */ )
```

其中`updateComponent()`可以理解为生成`DOM`结构的函数，这里的[`before()`](../../nextTick与渲染更新/README.MD#nexttick)函数就是我们之前在更新`Watcher`前，看到调用的方法，现在可以确认是`beforeUpdate()`生命周期函数，那么初始化的`Watcher`构造函数为：

```js
this.vm = vm

// 是否为渲染watcher
if (isRenderWatcher) {
    vm._watcher = this;
}

// 将Watcher加入vm上的_watchers数组
vm._watchers.push(this);

// options
// 初始化配置
this.deep = false;
this.user = false;
this.lazy = false;
this.sync = false;
this.before = options.before;
this.cb = cb;
this.id = ++uid; // uid for batching
this.active = true;
this.dirty = false; // for lazy watchers
this.deps = [];
this.newDeps = [];
this.depIds = new Set();
this.newDepIds = new Set();
this.expression = expOrFn.toString();

// 渲染函数
this.getter = expOrFn;


// 当前Watcher的值，当是computed时，延迟求值(即本次不求值)
this.value = this.get();
```

在这里我们只需要关注在初始化`class Wathcer`的最后个阶段，通过调用[`Watcher.prototype.get()`](../README.md#watcherprototypeget%e8%ae%a1%e7%ae%97watcher%e7%9a%84%e5%80%bc%e6%94%b6%e9%9b%86%e4%be%9d%e8%b5%96%e9%a1%b9)来开始调用`updateComponent()`函数进行求值，进行依赖项的收集。这个函数在之后渲染函数生成时会进行学习，这里我们只需要知道，凡是在模版或我们渲染函数中使用到的`vm`实例中的变量都会被作为依赖项进行收集。

## 依赖项更新

那么渲染`Watcher`的依赖项更新同监听属性，都是先调用[`watcher.update()`](../README.md#watcherptototypeupdate%e6%9b%b4%e6%96%b0-watcher)在调用[`watcher.run()`](../README.md#watcherprototyperun%e9%87%8d%e6%96%b0%e6%94%b6%e9%9b%86%e4%be%9d%e8%b5%96%e9%a1%b9%e5%b9%b6%e8%a7%a6%e5%8f%91%e5%9b%9e%e8%b0%83)来调用`updateComponent()`重新进行求值生成新的`DOM`。
