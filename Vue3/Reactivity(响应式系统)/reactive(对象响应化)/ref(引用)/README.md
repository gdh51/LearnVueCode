# ref(引用)

`V3`中`ref api`用于直接将一个任意值转化为响应式对象并单独使用。生成的`ref`对象会保存对当前值的引用，所以在原值变动时，其能很好的追踪它的变化。

`ref api`相对于响应式`API`来说较为简单，下面逐一对其所有相关`API`进行介绍。

- [`ref()/shallowRef()`](#refshallowref响应式引用普通引用)——为普通对象生成单个响应式引用
- [`toRef()/toRefs()`](#toreftorefs将值转化为引用)——将响应式对象转化为引用
- [`customRef()`](#customref创建自定义引用)——自定义引用
- [`unref()`](#unref安全访问引用原值)——安全访问引用原值
- [`triggerRef()`](#triggerref触发引用更新)——触发引用更新
- [`proxyRefs()`](#proxyrefs无感知访问修改普通对象)——无感知访问/修改**普通对象**

## ref()&shallowRef()——响应式引用/普通引用

`ref`相对于响应式`API`来说，其更像单独为该值做了响应式处理；而`shallowRef()`则仅仅是对原值进行一个简单的引用。

但无论是哪个它们都是通过`createRef()`函数创建，下面为其具体的代码:

```js
// 创建引用
export function ref(value?: unknown) {
    return createRef(value)
}

export function shallowRef(value?: unknown) {
    return createRef(value, true)
}

export function isRef(r: any): r is Ref {
    return Boolean(r && r.__v_isRef === true)
}

function createRef(rawValue: unknown, shallow = false) {
    // 已为引用时直接返回
    if (isRef(rawValue)) {
        return rawValue
    }

    // 创建引用对象
    return new RefImpl(rawValue, shallow)
}
```

`RefImpl`引用接口构造函数为一个具有访问器的对象，通过访问器我们可以做到依赖追踪和更新通知:

```js
class RefImpl<T> {
  private _value: T

  // ref类型对象的标识符
  public readonly __v_isRef = true

  constructor(private _rawValue: T, public readonly _shallow = false) {
    // 浅引用时直接返回原值，否则根据情况响应化
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }

  // 访问value值时进行依赖追踪，然后返回原值
  get value() {
    track(toRaw(this), TrackOpTypes.GET, 'value')
    return this._value
  }

  set value(newVal) {
    // 对比新旧值是否变更
    if (hasChanged(toRaw(newVal), this._rawValue)) {
      // 替换原值
      this._rawValue = newVal

      // 按值类型进行响应化处理
      this._value = this._shallow ? newVal : convert(newVal)

      // 通知副作用函数更新
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
    }
  }
}
```

从这个构造函数可以看到，对于浅引用来说，其不会对当前进行引用处理的对象进行任何处理，仅仅是赋予其依赖收集、触发能力；而对于正常的引用来说，它会根据当前的值的类型进行处理——为对象时进行响应化处理。

```js
this._value = this._shallow ? newVal : convert(newVal)

// 根据传入值决定是否响应化
const convert = <T extends unknown>(val: T): T =>
  isObject(val) ? reactive(val) : val
```

> 关于依赖项对于副作用函数的追踪和触发你可以通过[这篇文章](<../../effect(副作用函数)/README.md>)来了解

## toRef()&toRefs()——将值转化为引用

`toRef()`与`toRefs()`都用于将某个值转化为引用。由于响应式对象实现原理的关系(`Proxy`)无法直接对返回的响应式对象直接使用解构赋值。那么这个时候如果你想单独使用某个键名就需要使用该`API`:

```js
// 提取某个响应式对象键名的引用
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]> {
  // 已为引用对象时，直接返回
  return isRef(object[key])
    ? object[key]
    : (new ObjectRefImpl(object, key) as any)
}

// 间接的帮你访问响应式对象
class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true

  constructor(private readonly _object: T, private readonly _key: K) {}

  get value() {
    return this._object[this._key]
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}
```

该`API`非常简单，同理，`toRefs()`就是为你遍历每个键名：

```js
// toRefs则是手动遍历调用toRef
export function toRefs<T extends object>(object: T): ToRefs<T> {
  if (__DEV__ && !isProxy(object)) {
    console.warn(`toRefs() expects a reactive object but received a plain one.`)
  }
  const ret: any = isArray(object) ? new Array(object.length) : {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}
```

## customRef()——创建自定义引用

使用该`API`可以根据自己的实际情况来自定义一个引用，同时自定义其引用访问/设置时的行为。

```js
// 创建一个自定义的ref，自定义get和set行为
export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRefImpl(factory) as any
}

constructor(factory: CustomRefFactory<T>) {
    // 调用工厂函数，会传入追踪和触发副作用函数更新的函数作为参数
    const { get, set } = factory(
      () => track(this, TrackOpTypes.GET, 'value'),
      () => trigger(this, TriggerOpTypes.SET, 'value')
    )

    // 应用getter与setter
    this._get = get
    this._set = set
  }

  get value() {
    return this._get()
  }

  set value(newVal) {
    this._set(newVal)
  }
}
```

通过一个工厂函数，我们可以自定义访问器和设置器的行为，同时这个工厂函数在调用时会传入 2 个参数：第一个用于追踪`effect()`、第二个用于通知`effect()`更新。

## unref()——安全访问引用原值

该函数可以保证我们安全的访问一个值，减轻心智负担。如果该值为引用对象，那么其会自动取值其`.value`，否则不会做多余的处理。

```js
// 取出ref的值
export function unref<T>(ref: T): T extends Ref<infer V> ? V : T {
  return isRef(ref) ? (ref.value as any) : ref
}
```

## triggerRef()——触发引用更新

该方法就如其名一样，用于强制让一个引用通知所以追踪它的副作用函数更新:

```js
// 触发追踪当前ref的副作用函数更新
export function triggerRef(ref: Ref) {
  trigger(toRaw(ref), TriggerOpTypes.SET, 'value', __DEV__ ? ref.value : void 0)
}
```

## proxyRefs()——无感知访问/修改普通对象

该方法用于一个存引用的普通对象，当对这个对象进行代理后，如果你访问其包含引用对象的字段，那么其会直接`unref()`这个引用对象并返回；同理，在设置一个引用对象的值时也会直接为其设置值，而不需要通过`.value`的方式来设置。

像这样用户就不需要过度的去关心当前的值是否为一个引用对象。

```js
// 自动安全取值引用对象
export function proxyRefs<T extends object>(
  objectWithRefs: T
): ShallowUnwrapRef<T> {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers)
}

// 一个拦截器，访问器自动取值引用对象(不用通过.value)
const shallowUnwrapHandlers: ProxyHandler<any> = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key]

    // 为引用对象设置新值时，直接替换其.value
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value
      return true

      // 其余直接设置值即可
    } else {
      return Reflect.set(target, key, value, receiver)
    }
  }
}
```
