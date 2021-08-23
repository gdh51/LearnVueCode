# 普通对象拦截器

那么这里呢就针对对应的`API`来看具体使用到的拦截器，具体可以分为：

- `普通响应化拦截器` -> `reactive()` => `mutableHandlers`
- `浅响应化拦截器` -> `shallowReactive()` => `shallowReactiveHandlers`
- `只读拦截器` -> `readonly()` => `readonlyHandlers`
- `只读浅拦截器` -> `shallowReadonly()` => `shallowReadonlyHandlers`

以下涉及到的[`createGetter()`](../README.md#creategetter创建访问器)与[`createSetter()`](../README.md#createsetter创建写入器)你可以在这里具体查看。

## 普通响应化拦截器(mutableHandlers)

我们使用的`reactive()`如下，可以看出，不可以将一个`readonly()`的对象转化为`reactive()`:

```js
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 如果当前响应化的对象已为只读对象则直接返回
  if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
    return target
  }

  // 创建响应式对象
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  )
}
```

同时，此处使用的拦截器为`mutableHandlers`，它的结构如下：

```js
export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}
```

而创建上述函数的代码为：

```js
const get = /*#__PURE__*/ createGetter()
const set = /*#__PURE__*/ createSetter()

function deleteProperty(target: object, key: string | symbol): boolean {
  // 是否存在删除的key
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]

  // 操作原删除逻辑
  const result = Reflect.deleteProperty(target, key)

  // 如果删除成功且存在该字段的值，则通知effect更新
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)

  // 非内置symbol则进行effect追踪
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

function ownKeys(target: object): (string | symbol)[] {

  // 对effect的length进行追踪
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}
```

对于上述拦截器创建出来的响应化对象它具有以下特征：

- 会响应化本身以及其内部的所有的对象，但内部的响应化是**懒**的，即其会在你真正使用到的时候才进行响应化
- 如果你访问非数组对象的内部某个`key`且它是一个`ref()`化的对象，那么其会**直接返回其对应的值**，而不是这个`ref()`对象。(当然你访问一个数组对象非存在的数组下标值也会)
- 当你访问其值时，其会进行`effect()`追踪
- 当你访问一个已经被代理的嵌套对象的内部对象时，你访问的这个对象会被响应化后再返回这个被代理后后的对象，而不是源对象。
- 当你更新一个数组其内部一个已经被`ref()`化的值时，其会直接替换其`ref()`后对象的`value`

>上述描述没有包括`ownKeys()/deleteProperty()/has()`等函数的描述，因为这些函数行为比较简单，看一看便知

## 浅响应化拦截器(shallowReactiveHandlers)

浅响应化由`shallowReactive()`函数生成，该函数是这样的：

```js
/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 * 返回一个浅响应化的原对象的副本，仅有根属性会被响应化处理，
 * 且不会自动提取根字段中被ref()化的字段的value
 */
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,

    // 所有的浅响应化对象Map
    shallowReactiveMap
  )
}
```

该响应化拦截器为`shallowReactiveHandlers`并由以下函数构成：

```js
export const shallowReactiveHandlers: ProxyHandler<object> = extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)
```

其中`extend()`等价于`Object.assign()`，所以上述其实就是：

```js
{
  get: shallowGet,
  set: shallowSet,
  deleteProperty,
  has,
  ownKeys
}
```

变化之处就是这个`get()/set()`，它们同样由同种类型函数生成只是参数不一样罢了：

```js
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const shallowSet = /*#__PURE__*/ createSetter(true)
```

那么浅拦截器具有以下的特性：

- 响应化只对当前最外层对象起作用，内部保留
- 当你访问其内部的对象时，该对象不会继续任何处理(即返回原对象)
- 当你设置其内部字段新值时会直接替换旧值
- 设置新值后立刻通知`effect()`更新

## 只读拦截器(readonlyHandlers)

只读的对象由`readonly()`进行创建的:

```js
/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 * 创建一个原对象的只读版本，注意返回对象不具有响应式能力，
 * 该函数可以对一个已被响应化的对象使用
 */
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,

    // 只读对象的map
    readonlyMap
  )
}
```

这里我们直接查看其拦截器`readonlyHandlers`组成：

```js
const readonlyGet = /*#__PURE__*/ createGetter(true)

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,

  // 不能修改
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },

  // 不能删除
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}
```

可以见得非常简单，总结就是不能删不能写，对于访问来说它具有以下特征：

- 不会响应化被`readonly()`的对象
- 如果访问其中的一个值为`ref()`的字段，那么会在其是非合法数组字段时直接取出其值返回。
- 只读化的过程也是懒的，如果内部访问字段为对象则对其进行只读化，并返回这个只读对象。
- **不会进行`effect()`追踪**

## 只读浅拦截器(shallowReadonlyHandlers)

只读浅拦截器是我们调用`shallowReadonly()`生成的:

```js
/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 * 返回一个原对象的响应化复制版本，在这个响应化对象中仅根属性是只读的，
 * 且不会自动取出ref()的值，同时不会递归的只读化其内部的对象
 */
export function shallowReadonly<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,

    // 浅只读对象的map
    shallowReadonlyMap
  )
}
```

其`shallowReadonlyHandlers`就是重写了只读拦截器的`get()`而已:

```js
// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
// 属性访问拦截器在只读的时候不应该在访问顶层字段时直接取出ref中的值返回,
// 但仍需要保留只读对象的响应化能力
export const shallowReadonlyHandlers: ProxyHandler<object> = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)

const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)
```

通过重写访问器，其对属性的访问具有以下特征：

- **不会进行`effect()`追踪**
- 只对当前只读化对象进行只读处理，其内部字段按原始样子返回

总结来说就是基本上和原对象一样，只是不能重写。

---
至此，对于普通对象(`Array/Object`)的响应化来说，还是比较简单清晰的，如果你对`V3`的实际用法掌握得比较好，那么你可以很快的理解上面函数的意义。相信你通过查看这部分对这其中存在的坑和密码有更好的理解了。

[继续阅读集合对象拦截器](../集合对象拦截器/README.md)
