# 集合对象拦截器

集合对象主要是指由构造函数`Map/Set/WeakMap/WeakSet`生成对象，介于它们和普通对象不一样所以此处使用特殊的拦截器进行处理。

但是它们和普通的对象也一样，一共有四种处理器：

- `集合响应化拦截器` -> `reactive()` => `mutableCollectionHandlers`
- `浅响应化拦截器` -> `shallowReactive()` => `shallowCollectionHandlers`
- `只读拦截器` -> `readonly()` => `readonlyCollectionHandlers`
- `只读浅拦截器` -> `shallowReadonly()` => `shallowReadonlyCollectionHandlers`

与普通对象不同的是，这些集合对象的访问往往是通过方法(`get()`)来实现的，其的属性读取仅有其长度`.size`。重写也一样，所以拦截器仅需要更改`get()`即可。而它们的响应化处理函数也比较特殊，可以对任何值进行处理——对象进行响应化其他直接返回：

```js
const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value

const toReadonly = <T extends unknown>(value: T): T =>
  isObject(value) ? readonly(value as Record<any, any>) : value

// 注意这个toShallow，直接返回原值
const toShallow = <T extends unknown>(value: T): T => value
```

**注意**上面的`toShallow()`函数，它直接返回原值哦

这里我们就不重复介绍是从哪个`API`得来的了，话不多说，先来康康：

## 通用的拦截器生成函数(createInstrumentationGetter())

集合的拦截器都由`createInstrumentationGetter()`生成，再由传入参数的不同进行分化。

```js
function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  
  // 根据当前传入的参数，决定使用哪种行为的高阶函数
    const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations

  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {

    // 是否为响应化
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly

    // 是否为只读
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly

    // 返回原对象
    } else if (key === ReactiveFlags.RAW) {
      return target
    }

    return Reflect.get(

      // 访问的方法是对象自身拥有的，这里就规避了不同集合对象方法访问的存在性问题了
      hasOwn(instrumentations, key) && key in target

        // 调用被处理后的该方法
        ? instrumentations

        // 访问其他属性则直接访问原对象
        : target,
      key,
      receiver
    )
  }
}
```

从上面可以看到该方法非常简单，除了对访问对应集合对象的原方法做了特殊处理外，其他的都是直接返回。但这也说明了，对于其访问集合`.size`属性，不会进行`effect()`追踪

由此也可见对于集合对象来说，它们的访问差异就在这里了:

```js
// 根据当前传入的参数，决定使用哪种行为的高阶函数
  const instrumentations = shallow
    ? shallowInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations
```

此外，某些集合对象具有迭代方法，这里被一个变量存储了起来，并分配到各个不同拦截器中:

```js
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]

iteratorMethods.forEach(method => {

  // 普通集合拦截器
  mutableInstrumentations[method as string] = createIterableMethod(
    method,
    false,
    false
  )

  // 只读集合拦截器
  readonlyInstrumentations[method as string] = createIterableMethod(
    method,
    true,
    false
  )

  // 浅集合拦截器
  shallowInstrumentations[method as string] = createIterableMethod(
    method,
    false,
    true
  )
})
```

## 通用访问拦截器——get()

对于集合对象来说，如果要访问它们的元素，那么会调用该函数进行处理：

>复习一波，能调用`X.get()`的仅有`Map/WeakMap`, `Set/WeakSet`只能用迭代器来访问

```js
// 集合的访问器函数
function get(
  target: MapTypes,
  key: unknown,
  isReadonly = false,
  isShallow = false
) {
  // #1772: readonly(reactive(Map)) should return readonly + reactive version
  // of the value

  // 获取被代理的原对象
  target = (target as any)[ReactiveFlags.RAW]

  // 获取底层的源对象(即没有被响应化处理的)
  const rawTarget = toRaw(target)

  // 获取键值的原值(针对Map)
  const rawKey = toRaw(key)

  // 在非只读且用于访问的键值为被代理的对象时, 进行`effect()`追踪
  if (key !== rawKey) {
    !isReadonly && track(rawTarget, TrackOpTypes.GET, key)
  }

  // 在非只读时，对原键值进行effect()追踪
  !isReadonly && track(rawTarget, TrackOpTypes.GET, rawKey)
  
  // 获取原型链上的原生的has函数(防止effect追踪)
  const { has } = getProto(rawTarget)

  // 根据当前拦截器，决定其内部元素使用哪一种拦截器继续进行递归处理
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
  
  // 访问具体某个字段时，递归对其进行代理处理
  if (has.call(rawTarget, key)) {
    return wrap(target.get(key))
  } else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey))
  }
}
```

该函数的逻辑还是比较简单的，简单的说就是对于访问的`key`值，无论这个`key`值是响应化还是原`key`值，都按同样的行为进行处理——进行`effect()`追踪；之后递归响应化其内部元素(当然是针对对象)

## 通用forEach函数拦截器创建函数——createForEach()

该函数用于创建`forEach()`函数的拦截器，总体的行为就是模拟`forEach()`，然后在其调用`callback()`时，将回调的参数处理为对应响应化的对象，在对每个数组元素进行`effect()`追踪

```js
// 创建forEach函数的拦截器
function createForEach(isReadonly: boolean, isShallow: boolean) {
  return function forEach(
    this: IterableCollections,
    callback: Function,
    thisArg?: unknown
  ) {

    // 当前被代理的对象
    const observed = this as any

    // 被代理的原对象(这有可能是一个被响应化后的对象)
    const target = observed[ReactiveFlags.RAW]

    // 被代理对象的最底层
    const rawTarget = toRaw(target)

    // 获取递归处理响应化的函数
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive

    // 非只读时进行effect追踪
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)

    // 调用forEach函数
    return target.forEach((value: unknown, key: unknown) => {
      // important: make sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.
      // 模拟原forEach调用，将value/key处理为对应响应化对象，并将当前对象作为this传入第三个参数
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}
```

## 创建迭代方法——createIterableMethod()

该方法统一为集合处理器创建了它们迭代方法的处理函数：

```js
function createIterableMethod(
  method: string | symbol, // 方法名
  isReadonly: boolean, // 是否只读
  isShallow: boolean // 是否浅式处理
) {
  return function(
    this: IterableCollections, // 调用方法的集合对象
    ...args: unknown[] // 调用方法时传入的参数
  ): Iterable & Iterator {

    // 获取源对象(这有可能是一个响应化对象)
    // 你可以通过reactive(readonly(xxx))来实现
    const target = (this as any)[ReactiveFlags.RAW]

    // 获取源对象(完全没有响应化的)
    const rawTarget = toRaw(target)

    // 源对象是否为Map
    const targetIsMap = isMap(rawTarget)

    // 是否调用的迭代方法
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)

    // 是否调用的keys方法(该方法仅Map有)
    const isKeyOnly = method === 'keys' && targetIsMap

    // 调用原方法(这里要用其原被代理的对象调用，因为原对象如果为被响应化的对象则要进行effect追踪)
    const innerIterator = target[method](...args)
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    
    // 不是只读对象时，进行`effect()`追踪
    !isReadonly &&
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      )
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    // 返回一个被处理后的迭代器对象，每个迭代器对象运行后都返回对应的处理后版本
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
            // 对值进行对应的递归处理
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this
      }
    }
  }
}
```

该函数就是包含了两个逻辑：

- 对`effect`追踪
- 对集合中的元素进行递归处理

具体它们的差异，我们会在下面分类中具体归纳：

## 集合响应化拦截器(mutableCollectionHandlers)

对于普通的集合对象来说，其整个拦截器的构成就是：

```js
export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, false)
}
```

由上面的[`createInstrumentationGetter()`](#通用的拦截器生成函数createinstrumentationgetter)函数我们可以得知，其就是帮你判断当前访问的是原有的方法还是属性，如果是原生的方法则调用其封装后的原方法(使其能够具有其他特殊能力)，否则就直接返回对应的值。

而这些被修改的方法，来自于`mutableInstrumentations`:

```js
const mutableInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key)
  },
  get size() {
    return size((this as unknown) as IterableCollections)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, false)

  // 以及一些迭代方法，在上面提到过
}
```

上述的`get()`可以从[上面](#通用访问拦截器get)具体查看。实际上在集合拦截器中，只读和响应化等等判定属性仅作为用于判断对其内部进行何种递归处理的依据。

而`size() getter`仅是对其增强了`effect()`追踪能力：

```js
function size(target: IterableCollections, isReadonly = false) {

  //  获取被代理的对象
  target = (target as any)[ReactiveFlags.RAW]

  // 在非只读时，对effect进行追踪
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)

  // 返回原值
  return Reflect.get(target, 'size', target)
}
```

`has()`的行为比较简单，同上也是增强`effect()`追踪能力而已:

```js
function has(this: CollectionTypes, key: unknown, isReadonly = false): boolean {
  
  // 被代理的对象
  const target = (this as any)[ReactiveFlags.RAW]

  // 最底层的纯对象
  const rawTarget = toRaw(target)

  // 获取当前key值的纯对象(防止是响应化的对象作为key)
  const rawKey = toRaw(key)

  // 同时进行两次effect()追踪
  if (key !== rawKey) {
    !isReadonly && track(rawTarget, TrackOpTypes.HAS, key)
  }
  !isReadonly && track(rawTarget, TrackOpTypes.HAS, rawKey)

  // 调用原函数行为，返回结果
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey)
}
```

对于`Set/WeakSet`的添加元素来说，也比较简单:

```js
function add(this: SetTypes, value: unknown) {
  
  // 获取添加的值的底层的原始对象
  value = toRaw(value)

  // 获取当前对象的底层的原始对象
  const target = toRaw(this)
  const proto = getProto(target)

  // 将这个对象作为元素加入进去
  const hadKey = proto.has.call(target, value)

  // 新增时进行effect更新提醒
  if (!hadKey) {
    target.add(value)
    trigger(target, TriggerOpTypes.ADD, value, value)
  }
  return this
}
```

`Map/WeakMap`设置新值的拦截函数：

```js
function set(this: MapTypes, key: unknown, value: unknown) {
  
  // 获取设置值的底层原始对象
  value = toRaw(value)

  // 获取当前调用对象的底层原始对象
  const target = toRaw(this)

  // 获取原生的has/get函数
  const { has, get } = getProto(target)

  // 是否具有该值
  let hadKey = has.call(target, key)

  // 无时，看看是不是由于key为响应化对象
  // 所以不存在，这里取出原对象在查询一次
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)

  // 本地开发时
  } else if (__DEV__) {
    checkIdentityKeys(target, has, key)
  }

  // 获取旧值
  const oldValue = get.call(target, key)

  // 写入新值
  target.set(key, value)

  // 新增或变更时，进行effect更新提醒
  if (!hadKey) {
    trigger(target, TriggerOpTypes.ADD, key, value)
  } else if (hasChanged(value, oldValue)) {
    trigger(target, TriggerOpTypes.SET, key, value, oldValue)
  }
  return this
}
```

删除某个值(`Set/WeakSet/Map/WeakMap`):

```js
function deleteEntry(this: CollectionTypes, key: unknown) {
  const target = toRaw(this)
  const { has, get } = getProto(target)
  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  } else if (__DEV__) {

    // 用户是否用代理版本的key和纯版本的key
    // 分别存储了东西，报错
    checkIdentityKeys(target, has, key)
  }

  // 获取旧值(对于Set来说没有获取值的函数)
  const oldValue = get ? get.call(target, key) : undefined
  // forward the operation before queueing reactions

  // 执行删除操作
  const result = target.delete(key)

  // 触发effect更新
  if (hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}
```

同样对于清除操作来说也十分的简单：

```js
// 集合对象的清除函数
function clear(this: IterableCollections) {
  const target = toRaw(this)

  // 确保有东西可以清除
  // (对于Weak系列来说直接认为存在)
  const hadItems = target.size !== 0

  // 存储原集合对象
  const oldTarget = __DEV__
    ? isMap(target)
      ? new Map(target)
      : new Set(target)
    : undefined
  // forward the operation before queueing reactions
  // 执行清除操作
  const result = target.clear()

  // 触发effect更新
  if (hadItems) {
    trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
  }
  return result
}
```

虽然对于集合对象的处理比较多，但是对每一个处理来说都较为相识，总结下，对于普通集合对象来说它们的拦截器具有以下特征： 

- 对于访问的`key`来说，会确保这个`key`是否为一个响应化值，所以对两种值的`key`都会做处理。
- 集合也会递归响应对象，不过对于原始值来说，会直接返回

## 集合浅响应化拦截器(shallowCollectionHandlers)

集合的拦截器无论是哪种形式其实都差不多，快速过一下：

```js
export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, true)
}
```

其中对方法的拦截集合使用的是`shallowInstrumentations`:

```js
const shallowInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, false, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, true)
}
```

对比普通的集合拦截器，你可以发现除了参数外无任何其他差异，这些参数带来的差异也仅仅表现在如何对其内部元素的递归响应化处理——即调用`reactive()/readonly()`还是`shallowReactive()`等等。

## 只读集合拦截器(readonlyCollectionHandlers)

只读集合拦截器由`readonlyCollectionHandlers`创建

```js
export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(true, false)
}
```

其中使用的函数拦截对象为`readonlyInstrumentations`，这次它的方法拦截行为有点微小的差异:

```js
const readonlyInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections, true)
  },
  has(this: MapTypes, key: unknown) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, false)
}
```

这些差异仅体现在写入和修改方面，它们的写入方法都是通过`createReadonlyMethod()`创建：

```js
function createReadonlyMethod(type: TriggerOpTypes): Function {
  return function(this: CollectionTypes, ...args: unknown[]) {
    if (__DEV__) {
      const key = args[0] ? `on key "${args[0]}" ` : ``
      console.warn(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        toRaw(this)
      )
    }
    return type === TriggerOpTypes.DELETE ? false : this
  }
}
```

总结只读集合行为就是:

- 不能写入与修改
- 不进行`effect()`追踪
- 递归只读化子元素

## 只读浅集合拦截器

~~只读浅拦截器与只读拦截器应用了同一个函数拦截器`readonlyCollectionHandlers`，所以具有同样的行为，这里暂时不清楚用意。~~
3.27`Vue3`修复了这个问题[#3007](https://github.com/vuejs/vue-next/issues/3007)，现在对集合调用`shallowReadonly()`，会使用单独的拦截器`shallowReadonlyCollectionHandlers`:

```js
export const shallowReadonlyCollectionHandlers: ProxyHandler<
  CollectionTypes
> = {
  get: createInstrumentationGetter(true, true)
}
```

在`createInstrumentationGetter()`函数中会使用`shallowReadonlyInstrumentations`这个函数拦截器对象: 

```js
const shallowReadonlyInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, true, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections, true)
  },
  has(this: MapTypes, key: unknown) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, true)
}
```

它与只读化集合对象的区别只存在，它直接不会递归对内部元素进行只读化处理。

综上，集合对象的行为大体上可以总结为下图

![集合对象的响应化处理](./imgs/collection%20proxy.svg)
