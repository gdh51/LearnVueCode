# Watcher监听者对象(主要是区别于另一个观察者对象)

在我们定义的`watch`和`computed`属性时，它们都是依赖于`Watcher`对象来进行对属性的监听。下面我们就来具体学习`class Watcher`。

在初始化`computed`时, 不会对其进行求值与依赖项的收集,只有当真正使用它时才会开始计算。同时我们的模版字符串(也代表一个`Watcher`)中所用的变量，也要被收集在该 `Vue` 实例之下。

`Watcher`具体分为`3`类(括号为它们初始化时的区别)：

1. 渲染`Watcher`(具有`before`属性)
2. 计算属性`Watcher`(`lazy`属性为`true`)
3. 监听函数`Watcher`(`user`属性为`true`)

```js
let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * 一个观察者解析一个表达式，收集依赖项，并在表达式的返回值改变时触发回调函数
 */
class Watcher {
    vm: Component;

    // 当为computed属性时，该值为函数，表示computed的求值表达式
    // 当为watch属性时，该值表示watch的名称字符串
    expression: string;
    cb: Function;
    id: number;

    // watch的特有属性，用于是否深度监听
    deep: boolean;

    // watch的特有属性，用于执行回调函数
    user: boolean;

    // 计算属性特有属性，是否延迟Watcher的求值
    lazy: boolean;
    sync: boolean;

    // 是否允许允许Watcher进行表达式计算
    dirty: boolean;

    // 渲染Watcher的特有属性，表示当前组件是否活跃
    active: boolean;

    // 当前观察者对象依赖的依赖项
    deps: Array < Dep > ;
    newDeps: Array < Dep > ;
    depIds: SimpleSet;
    newDepIds: SimpleSet;

    // 渲染Watcher特有属性，当前Watcher在重新计算(更新)前调用的函数
    before: ? Function;
    getter: Function;
    value: any;

    constructor(
        vm: Component,
        expOrFn: string | Function,
        cb: Function,
        options ? : ? Object,
        isRenderWatcher ? : boolean
    ) {
        this.vm = vm

        // 是否为渲染watcher
        if (isRenderWatcher) {
            vm._watcher = this;
        }

        // 将Watcher加入vm上的_watchers数组
        vm._watchers.push(this);

        // options
        // 初始化配置
        if (options) {
            this.deep = !!options.deep;
            this.user = !!options.user;
            this.lazy = !!options.lazy;
            this.sync = !!options.sync;
            this.before = options.before;
        } else {

            // 未传入时默认为false
            this.deep = this.user = this.lazy = this.sync = false;
        }
        this.cb = cb;
        this.id = ++uid; // uid for batching
        this.active = true;
        this.dirty = this.lazy; // for lazy watchers
        this.deps = [];
        this.newDeps = [];
        this.depIds = new Set();
        this.newDepIds = new Set();
        this.expression = process.env.NODE_ENV !== 'production' ?
            expOrFn.toString() : '';

        // Watcher变动所涉及的函数
        // 这里即渲染Watcher的渲染函数或计算属性的计算函数
        if (typeof expOrFn === 'function') {
            this.getter = expOrFn;
        } else {

            // 当Watcher名为字符串时, 可以是.运算符指定对象的某个属性
            // getter为一个函数, 返回watch名所对应的属性(即监听函数)
            this.getter = parsePath(expOrFn);

            // 当存在不规范的定义时会报错
            if (!this.getter) {
                this.getter = noop
                process.env.NODE_ENV !== 'production' && warn(
                    `Failed watching path: "${expOrFn}" ` +
                    'Watcher only accepts simple dot-delimited paths. ' +
                    'For full control, use a function instead.',
                    vm
                )
            }
        }

        // 当前Watcher的值，当是computed时，延迟求值(即本次不求值)
        this.value = this.lazy ?
            undefined :
            this.get();
    }
}
```

那么这里我们按照不同的`Watcher`分别来进行学习。

在我们设置一个`watch`监听函数时，可能设置的是一个对象中的某个属性，那么此时，该函数就会解析这个字符串，返回那个对应的属性

## Watcher.prototype.evaluate()——计算Watcher的值(lazy Watcher专属)

该方法为`Computed Watcher`计算属性的专用方法，用于对`Watcher`求值，并更新其允许求值属性(`dirty`)

```js
/**
 * Evaluate the value of the watcher.
 * This only gets called for lazy watchers.
 * 计算Watcher的值，仅会被lazy Watcher调用
 */
evaluate() {
    this.value = this.get();
    this.dirty = false;
}
```

那么具体求值就是下面的这个方法。

## Watcher.prototype.get()——计算Watcher的值，收集依赖项

该方法用来触发`Watcher`的`getter`函数，对其进行求值，并收集依赖项, 并按以下的顺序：

1. 首先通过`pushTarget()`指定当前的`Watcher`为要进行收集依赖项的`Watcher`
2. 对`Watcher`的`getter`函数进行求值，收集依赖项(注意有`.`运算符的路径时的特殊性情况)
3. 如果是深度监听`(deep = true)`，则还要遍历整个求值结果(是对象的其他下)，进行依赖项收集
4. 通过`cleanupDeps()`更新`Watcher`中的新旧`deps`列队，并根据是否还存在这个`dep`依赖项，来决定是否移除该`Watcher`。
5. 通过`popTarget()`移除当前指定的`Watcher`

具体过程为：

```js
  /**
   * Evaluate the getter, and re-collect dependencies.
   */
get () {

    // 将当前watcher实例作为依赖的目标watcher实例
    pushTarget(this);
    let value;
    const vm = this.vm;
    try {

        // 调用cmoputed/watch函数的getter函数直接收集依赖，将当前的watcher实例收集到响应式属性value的deps依赖项中, 并将这些dep添加到watcher的newDeps队列中
        value = this.getter.call(vm, vm);
    } catch (e) {

        // 如果是用户定义的watcher则提示表达式错误
        if (this.user) {
            handleError(e, vm, `getter for watcher "${this.expression}"`)
        } else {
            throw e
        }
    } finally {

        // "touch" every property so they are all tracked as
        // dependencies for deep watching
        // 在用户定义watch时使用深度监听——deep属性时调用
        // 当为深度监听时, 遍历监听的属性, 将其所有属性的依赖项添加到当前watcher中
        if (this.deep) {
          traverse(value);
        }

        // 移除当前Dep.target指向的watcher
        popTarget();

        // 更新当前watcher的依赖项
        this.cleanupDeps()
    }
    return value
}
```

那么就如上面我说的那样，首先是调用`watcher.getter()`来进行求值，具体的每种`Watcher`的求值方式在每个`Watcher`中具体有将，但我们要知道，求值就会触发`Dep`依赖项的`getter`取值器，进行依赖项收集。([什么时候进行依赖项项收集](../Dep依赖项/README.md#%e4%bb%80%e4%b9%88%e6%97%b6%e5%80%99%e4%b8%8e%e6%80%8e%e4%b9%88%e8%bf%9b%e8%a1%8c%e4%be%9d%e8%b5%96%e6%94%b6%e9%9b%86))

那么之后便调用`popTarget()`移除当前收集依赖项的`Watcher`，最后调用[`Watcher.prototype.cleanupDeps()`](#watcherprototypecleanupdeps%e6%b8%85%e9%99%a4%e5%b7%b2%e4%b8%8d%e5%ad%98%e5%9c%a8%e4%be%9d%e8%b5%96%e9%a1%b9%e4%ba%a4%e6%9b%bf%e4%be%9d%e8%b5%96%e9%a1%b9)将`watcher`的新依赖项更新进旧依赖项中。

到此为止，整个`Watcher`求值过程就算全部结束了。

### 深度监听对象的特殊情况

注意上面描述中我们并没有提到这个问题：

```js
if (this.deep) {
    traverse(value);
}
```

这个问题就是`watch`函数的深度监听问题，在之前的依赖项收集中我们可以看到，我们只收集了具体使用的值，对于对象或数组这种值，我们并没有收集其内部的元素值。所以`Watcher.prototype.traverse()`就会遍历这些对象或数组，进行深度收集：

其中，当我们深度监听对象时，会调用以下函数：

## traverse(value)——遍历 value，将其所有属性的依赖添加到当前 watcher

该函数的目的有两个：

1. 添加对象每个键值对(或数组元素)的依赖项
2. 当属性值为对象或数组时，**不会**添加用于管理键值对(或元素)的`deps`

```js
// 一个用于记录对象是否访问过的set
const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
function traverse(val: any) {
    _traverse(val, seenObjects);

    // 清空Set表
    seenObjects.clear();
}

function _traverse(val: any, seen: SimpleSet) {
    let i, keys;
    const isA = Array.isArray(val);

    // 非对象或数组或冻结属性或Vnode时直接返回
    if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
        return
    }

    // 对于对象或数组，添加它们的依赖项到seen防止循环引用
    if (val.__ob__) {
        const depId = val.__ob__.dep.id;

        // 已经进行收集则直接返回，防止循环引用
        if (seen.has(depId)) {
            return
        }
        seen.add(depId);
    }

    // 递归继续收集依赖项
    if (isA) {
        i = val.length
        while (i--) _traverse(val[i], seen);
    } else {
        keys = Object.keys(val)
        i = keys.length;
        while (i--) _traverse(val[keys[i]], seen);
    }
}
```

从该函数我们可以看到，对于**watch函数监听对象时，对象以及其内部对象的键值对增删是不会被监控到的**！

## Watcher.prototype.addDep()——为Watcher添加依赖项

该函数用于将该新增的依赖项添加至`Watcher`的依赖项数组中，并同时将该`Watcher`添加至`Dep`依赖项的观察者数组中。(该函数只处理新增的`Dep`，如果是重复的那么不做处理)

```js
/**
 * Add a dependency to this directive.
 * 向当前Watcher添加一个依赖项
 */
Watcher.prototype.addDep = function(dep: Dep) {

    // 获取当前dep的唯一标识符
    const id = dep.id;

    // 防止重复添加dep
    if (!this.newDepIds.has(id)) {

        // 将当前dep添加至Watcher的新deps数组中
        this.newDepIds.add(id);
        this.newDeps.push(dep);

        // 如果旧的deps数组中没有该依赖项，
        // 那么新增的依赖项还应该将该Watcher添加到它的观察者队列中
        if (!this.depIds.has(id)) {
            dep.addSub(this);
        }
    }
}

Dep.prototype.addSub = function (sub: Watcher) {

    // 将观察该依赖项的观察者添加至数组中
    this.subs.push(sub);
}
```

## Watcher.prototype.cleanupDeps()——清除已不存在依赖项，交替依赖项

还记得之前调用`Watcher.prototype.get()`时收集依赖项吗？它会将本次依赖项收集所需的所有依赖项保存在`watcher.newDeps`中，对于新增的`Dep`它还会将该`watcher`添加到该`Dep`的观察者(`dep.subs`)队列中。

那么`cleanupDeps`整个过程做了两件事：

1. 如果该`watcher`某些旧的`dep`依赖项已不存在最新的队列中，则移除旧的`dep`依赖项的观察者队列中的该`watcher`
2. 替换新旧`deps`依赖项队列，并清空新的新的依赖项(`newDeps`)队列。

```js
/**
 * Clean up for dependency collection.
 * 清理依赖项收集
 */
Watcher.prototype.cleanupDeps = function () {

    // 获取该Watcher原的依赖项数组
    let i = this.deps.length

    // 如果该旧的dep依赖项已不存在于新的deps队列，则要从旧的dep依赖项中移除该watcher
    while (i--) {

        // 取出旧的依赖项
        const dep = this.deps[i];

        // 当最新的依赖项队列已不存在该旧依赖项时，从该旧的依赖项移除该watcher
        if (!this.newDepIds.has(dep.id)) {

            // 将该Watcher从该依赖项的观察者队列中移除
            dep.removeSub(this);
        }
    }

     // 替换新旧依赖项队列
    let tmp = this.depIds;

    // 更新依赖项id数组
    this.depIds = this.newDepIds;

    // 这里是什么骚操作，没看懂
    this.newDepIds = tmp;
    this.newDepIds.clear();
    tmp = this.deps;

    // 这里又是什么骚操作，没看懂
    // 这里替换了两个依赖项数组
    this.deps = this.newDeps;
    this.newDeps = tmp;

    // 清空newDeps
    this.newDeps.length = 0;
}
```

至此，就是watcher函数全部的求值过程，用一张图来总结一下一个watcher的具体求值过程：
![watcher求值过程](../img/watcher求值.svg)

## Watcher.ptototype.update()——更新 watcher

```js
update() {
    if (this.lazy) {
        this.dirty = true
    } else if (this.sync) {
        this.run()
    } else {
        queueWatcher(this)
    }
}
```


