# Watcher

在我们定义的`watcher`和`computed`属性中，它们都是依赖于 Watcher 对象来进行对属性的监听。在初始化`computed`时, 不会对其进行求值与依赖项的收集,只有当真正使用它时才会开始计算。

```js
class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm

    // 一个vm实例渲染时
    if (isRenderWatcher) {
      vm._watcher = this;
    }

    // 加入vm上的_watchers数组
    vm._watchers.push(this);

    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    // watcher变动所涉及的函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn;
    } else {

      // 当watcher名为字符串时, 可以是.运算符指定对象的某个属性
      // getter为一个函数, 返回watcher名所对应的属性
      this.getter = parsePath(expOrFn)

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

    this.value = this.lazy
      ? undefined
      : this.get();
  }
```

## parsePath(path)——返回指定path的属性
可以以对象`.`运算符的形式指定对象的内部属性
```js
function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return;
  }
  const segments = path.split('.');

  // 返回指定path的属性
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return;
      obj = obj[segments[i]];
    }
    return obj;
  }
}
```

## Watcher.prototype.get()
该方法用来触发`computed`或`watcher`的函数，重新收集依赖项

```js
  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {

    // 将当前watcher实例作为依赖的目标
    pushTarget(this);
    let value;
    const vm = this.vm;
    try {

      // 调用getter函数收集其中所需的依赖项
      value = this.getter.call(vm, vm);
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {

      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 在用户定义Watcher的deep属性时调用
      // 当为深度监听时, 遍历监听的属性, 将其所有属性的依赖项添加到watcher中
      if (this.deep) {
        traverse(value);
      }

      popTarget()
      this.cleanupDeps()
    }
    return value
  }
```

### traverse(value)——遍历value，将其所有属性的依赖添加到当前watcher
```js
const seenObjects = new Set();

function traverse (val: any) {
  _traverse(val, seenObjects);

  // 清空所有depid
  seenObjects.clear();
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys;
  const isA = Array.isArray(val);

  // 非对象或数组或冻结属性或Vnode时直接返回
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return;
  }

  // 取出其观察者对象添加其id
  if (val.__ob__) {
    const depId = val.__ob__.dep.id;
    if (seen.has(depId)) {
      return;
    }

    seen.add(depId);
  }
  if (isA) {
    i = val.length;
    while (i--) _traverse(val[i], seen);
  } else {
    keys = Object.keys(val);
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen);
  }
}
```
