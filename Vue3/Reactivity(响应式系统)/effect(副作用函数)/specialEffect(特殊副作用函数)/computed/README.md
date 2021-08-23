# Computed

由于`Computed`属性具有收集依赖项，并根据依赖项更新进行更新的性质，所以其肯定是有`effect()`函数参与的。

`computed()`同`Vue2`接受**一个**函数或者对象作为参数,我们可以定义一个访问器函数或者一个对象，其中包含访问器(`getter`)与设置器(`setter`)，其工厂函数如下:

```js
// computed函数
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  // 用户传入一个getter函数
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions

    // setter定义为不能修改的函数
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    // 用户传入一个具有getter/setter函数的配置对象
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建computed引用
  const cRef = new ComputedRefImpl(
    getter,
    setter,

    // 是否只读(无setter则为只读)
    isFunction(getterOrOptions) || !getterOrOptions.set
  )

  if (__DEV__ && debugOptions) {
    cRef.effect.onTrack = debugOptions.onTrack
    cRef.effect.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
```

## ComputedRefImpl

从上面我们可以看到，整个计算属性的核心在`ComputedRefImpl`构造函数，其类似于`Ref()`函数返回的引用，或则说它就是一个特殊的引用对象：

```js
class ComputedRefImpl<T> {
  // 下属依赖项
  public dep?: Dep = undefined

  // 计算属性值的引用
  private _value!: T

  // 是否允许重新计算
  private _dirty = true
  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean

  constructor(
    // getter函数
    getter: ComputedGetter<T>,
    // setter函数
    private readonly _setter: ComputedSetter<T>,
    // 是否只读
    isReadonly: boolean
  ) {
    // 创建effect，自定义调度函数
    this.effect = new ReactiveEffect(getter, () => {
      // 未有依赖项更新时，不允许重新计算
      if (!this._dirty) {
        this._dirty = true

        // 通知当前收集当前computed属性的effect调度更新
        triggerRefValue(this)
      }
    })

    // 是否为只读属性
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  // 计算属性的取值属性
  get value() {
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    const self = toRaw(this)

    // computed追踪当前正在收集依赖项的effect
    trackRefValue(self)

    // 是否允许计算新值
    if (self._dirty) {
      // 允许计算新值时，计算一次后关闭
      self._dirty = false

      // 调度原computed函数进行依赖收集和取值
      // (即，依赖项更新，通知computed重新计算)
      self._value = self.effect.run()!
    }

    // 返回最新值
    return self._value
  }

  // 调用setter设置新的值
  set value(newValue: T) {
    this._setter(newValue)
  }
}
```

整个引用对象，主要有以下几个比较重要的属性：

- `_dirty`: 是否允许重新进行值的计算
- `_value`: 计算后值的缓存
- `value`：提供给用户访问的值
- `effect`: 当前计算引用的`effec()`函数，由于收集`getter()`函数的依赖项

看了上面几个属性的解释，相信你已经大致对整个引用的属性作用有所了解，现在让我们从计算属性引用的生命周期上来看看。

### 实例化 —— 构造函数

首先是构造函数，由于我们知道计算属性对依赖项是懒收集的，对其求值也是懒(`lazy`)的，所以在构造函数中，其只是初始化了`effect()`函数，并允许第一次求值。

```js
// 是否允许重新计算
private _dirty = true

constructor(
    // getter函数
    getter: ComputedGetter<T>,
    // setter函数
    private readonly _setter: ComputedSetter<T>,
    // 是否只读
    isReadonly: boolean
  ) {
    // 创建effect，自定义调度函数
    this.effect = new ReactiveEffect(getter, () => {
      // 未有依赖项更新时，不允许重新计算
      if (!this._dirty) {
        this._dirty = true

        // 通知当前收集当前computed属性的effect调度更新
        triggerRefValue(this)
      }
    })

    // 是否为只读属性
    this[ReactiveFlags.IS_READONLY] = isReadonly
  }
```

副作用函数构造函数`ReactiveEffect`的第一个参数为进行依赖项收集的计算函数，第二个参数为当前副作用函数**被**通知更新时的调度函数，即`getter()`函数收集的依赖项进行更新时，就会调用该函数。(之后会梳理整个计算属性使用流程)

### value —— 计算属性的值

在返回的计算属性引用对象上，通过访问其`.value`属性，就可以获取其值：

```js
// 计算属性的取值属性
  get value() {
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    const self = toRaw(this)

    // computed追踪当前正在收集依赖项的effect
    trackRefValue(self)

    // 是否允许计算新值
    if (self._dirty) {
      // 允许计算新值时，计算一次后关闭
      self._dirty = false

      // 调度原computed函数进行依赖收集和取值
      // (即，依赖项更新，通知computed重新计算)
      self._value = self.effect.run()!
    }

    // 返回最新值
    return self._value
  }
```

可以看到整个取值大体就为`_dirty`是否允许重新计算值，如果允许就会重新调度副作用函数(即调度`getter()`)对`getter()`函数中的依赖项进行依赖项收集并获取值；否则直接使用缓存值`._value`。

除此之外，其还要为当前正在使用计算属性引用的`effect()`进行追踪，即：

```js
// computed追踪当前正在收集依赖项的effect
trackRefValue(self)
```

至此整个计算属性就大致解析完毕，接下来是其使用时的一个生命周期。

### computed 的生命周期

计算属性的生命周期一共可以划分为`3`个阶段:

- 创建阶段
- 值访问(依赖收集/副作用函数追踪)
- 更新

#### 创建阶段

构造函数实例化，实例化副作用函数(不执行任何动作)

#### 值的访问值访问(依赖收集/副作用函数追踪)

被使用，即访问`.value`属性，此时函数会做出以下行为：

- `computed`属性作为依赖项，追踪当前正在收集依赖项的`effect`
- **允许**重新计算`computed`时，调用传入的`getter()`进行求值并收集求值过程中的依赖项

上面的第二个流程要在允许的前提下，这个条件会在如下情况下成为允许：

- 第一次创建计算属性
- `getter()`收集的依赖项更新

#### 更新

正如上面所说的，当`getter()`函数中的依赖项更新时，就会调度当前`effect()`函数进行更新。由于计算属性的副作用函数使用了自定义的调度程序(即初始化时传入的第二个参数)，整个过程都是**同步**进行的，不会再调度队列中进行。

```js
// 调度函数
;() => {
  // 未有依赖项更新时，不允许重新计算
  if (!this._dirty) {
    this._dirty = true

    // 通知当前收集当前computed属性的effect调度更新
    triggerRefValue(this)
  }
}
```

那么执行调度函数，仅在不允许重新计算时，才能重新对计算属性重新进行求值，此时调用`triggerRefValue()`函数通知使用了`computed`属性的副作用函数进行重新计算，在这次重新计算时，其使用到计算属性时，就会经历上述[访问的流程](#value--计算属性的值)，此时一次更新就结束了。

![computed lifecycle](./imgs/computed%20lifecycle.png)

## deferredComputed —— 延迟计算属性

延迟计算属性目前还在建设中(该`API`不开放)
