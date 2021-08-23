# Dep(依赖项)

在`Vue3`中，依赖项的生成也是`lazy`(懒的)，其不像`Vue2`中存储在闭包中，而是存储在当前响应式对象用于存储依赖项的`Map`中。

在我们生成一个响应式对象时，其会在当前生成的响应式对象和源对象之间建立一个映射关系，并存储在一个全局的`WeakMap`中，这样我们不必担心不适用该对象时带来的内存开销。

```js
// proxyMap一共有以下4种
export const reactiveMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()

// 存储仅对应的管理MAP中，映射关系为 源对象 => 代理对象
proxyMap.set(target, proxy)
```

## 依赖项收集/副作用函数追踪

### 依赖项懒生成

那么在我们访问到一个响应式对象的键名时，此时**正在进行计算**的副作用函数就应该产生一个依赖项收集行为。首先其会检查当前源对象是否已生成过用于收集依赖项的`Map`，这个`Map`会建立一个`源对象 -> 依赖项集合`的映射，如果生成过就直接使用，否则生成：

```js
// 存放着 源对象 -> 依赖项集合 的Map，
// 该响应化对象所有的依赖项key都会以Set的形式存入到Map中
const targetMap = new WeakMap<any, KeyToDepMap>()

// 当前不允许追踪时，退出
if (!isTracking()) {
  return
}

// 获取当前对象对应的依赖项Map(包含了所有已被激活的依赖项)
let depsMap = targetMap.get(target)

// 如果当前对象不存在依赖项Map，则创建一个
if (!depsMap) {
  targetMap.set(target, (depsMap = new Map()))
}
```

紧接着边是从这个`Map`中查询是否已针对这个`key`值生成过对应的依赖项，没有则生成一个:

```js
// 获取当前key对应的依赖项
let dep = depsMap.get(key)

// 没有则新建，并加入desMap
if (!dep) {
  depsMap.set(key, (dep = createDep()))
}

// 创建一个Dep
export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep

  // 已追踪的dep的bitmap
  dep.w = 0

  // 即将追踪的dep的bitmap
  dep.n = 0
  return dep
}
```

在上述一个依赖项上，具有一个`w`与一个`n`属性，它们都是一个`bitmap`(`bitmap`就相当于于一个`map`，只不过其用二进制的形式表示，比如`1010`，则表示在第一位和第三位上其有值，即`true`)，`w`表示已经追踪的副作用函数的`bitmap`，`n`表示即将追踪的副作用函数的`bitmap`。

最后对副作用函数进行追踪：

```js
const eventInfo = __DEV__
  ? { effect: activeEffect, target, type, key }
  : undefined

// 让当前依赖项追踪当前effect
trackEffects(dep, eventInfo)
```

### 副作用函数的依赖项 diff

在调用此函数之前，这里我会直接告诉你，在进行副作用函数依赖项收集前，其会调用`initDepMarkers()`函数将当前正在进行依赖收集的副作用函数所代表的唯一`bit`位写入到`dep.w`中(之后就不再会对`dep.w`进行任何写入行为)：

```js
// 上面的函数
export const initDepMarkers = ({ deps }: ReactiveEffect) => {
  // 初始化当前依赖项，将当前深度记录📝在已追踪依赖项中
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].w |= trackOpBit // set was tracked
    }
  }
}
```

写入后，即进行我们刚刚提到的`track()`函数的流程。

之后在`trackEffects()`函数中，其不会参考`dep.w`的`bitmap`而是直接将当前正在进行依赖收集的副作用函数写入到`dep.n`对应的`bit`位上。

当然其会检查`dep.w`的`bitmap`上是否已有当前副作用函数的`bit`位，如果没有时，才会执行依赖收集、副作用函数追踪的操作。(所以操作都只会执行一次，重复不进行执行)

```js
// 是否需要追踪
let shouldTrack = false

// 不超过30次递归追踪时使用
if (effectTrackDepth <= maxMarkerBits) {
  // 当前依赖项还未将当前effect标记为即将追踪
  if (!newTracked(dep)) {
    // 将当前effect的bit位写入当前依赖项即将追踪依赖项bit位中
    dep.n |= trackOpBit // set newly tracked

    // 当前依赖项未追踪当前effect
    // 即这是个新的依赖项
    shouldTrack = !wasTracked(dep)
  }

  // 超过时，当前追踪的effect为新effect
} else {
  // Full cleanup mode.
  shouldTrack = !dep.has(activeEffect)
}
```

上述中的`newTracked()`与`wasTracked()`函数分别是检查依赖项的`n`(即将追踪的副作用函数的`bitmap`)与`w`(已追踪的副作用函数的`bitmap`)是否存在当前正在进行依赖收集的副作用函数：

```js
// 当前依赖项是否过去已追踪当前effect
export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0

// 当前依赖项是否现在已经追踪过当前effect
export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0
```

如果计算出这是个新的副作用函数(`shouldTrack`)应该被追踪，那么就会让依赖项和副作用函数互相收集对方。

```js
// 应该追踪当前effect时
if (shouldTrack) {
  // 依赖项与effect互相收集对方
  dep.add(activeEffect)
  activeEffect.deps.push(dep)

  // 触发当前effect的onTrack
  if (__DEV__ && activeEffect.onTrack) {
    activeEffect.onTrack(
      Object.assign(
        {
          effect: activeEffect
        },
        debuggerEventExtraInfo
      )
    )
  }
}
```

到目前为止，单个响应式对象的键值访问的副作用函数追踪就算完成了。直到整个副作用函数计算完毕后，其会调用`finalizeDepMarkers()`函数来`diff`这些依赖项，来排除掉那些不再使用的依赖项。首先是这个函数的全貌：

```js
// 正式进行依赖收集，并对新旧依赖项进行diff
export const finalizeDepMarkers = (effect: ReactiveEffect) => {
  const { deps } = effect
  if (deps.length) {
    // prev tract 之前追中的
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]

      // 如果当前依赖项之前存在，而现在不存在，则移除
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)

        // 新增、替换或不变时，重新写入
      } else {
        deps[ptr++] = dep
      }

      // clear bits
      // 清理当前深度的bit位
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }

    // 清空多余依赖项
    deps.length = ptr

    // 一次依赖项收集完毕后，一个依赖项的w/n的bitmap为0
  }
}
```

首先其会检查依赖项是否已不在使用(也即当前依赖项不再追踪当前的副作用函数)，此时就可以将其移除，否则则说明其为新建或不变，此时直接替换即可：

```js
const dep = deps[i]

// 如果当前依赖项之前存在，而现在不存在，则移除
if (wasTracked(dep) && !newTracked(dep)) {
  dep.delete(effect)

  // 新增、替换或不变时，重新写入
} else {
  deps[ptr++] = dep
}
```

每次替换完毕后，要清除曾经记录在依赖项上的当前`effect()`的`bit`位(`w/n`)

```js
// clear bits
// 清理当前深度的bit位
dep.w &= ~trackOpBit
dep.n &= ~trackOpBit
```

如此反复，直到**新的依赖项遍历完毕**，就将依赖项`diff`了出来，只剩下新的依赖项。

```js
// 清空多余依赖项
deps.length = ptr

// 一次依赖项收集完毕后，一个依赖项的w/n的bitmap为0
```

到此为止，一次副作用函数依赖项收集就完成了。

![dep collection](./imgs/dep%20collection.png)

## 依赖项总结

> 相比于`V2`，依赖项已在`getter()`闭包中初始化好，而`V3`则是在正式进行初始化时进行这些处理。如果当前依赖项在未来并未被使用，那么它也会被`WeakMap`自动回收。

整个依赖收集/创建的过程都是`lazy`的，仅会在需要时才进行——首先是为当前响应式对象创建一个`Map`，并将当前源对象到该`Map`的映射存储到全局的`targetMap`中，之后我们可以通过源对象直接查到这个用于存储依赖项集合的`Map`；而这个`Map`则会将即将要进行依赖收集的依赖项进行存储，具体是当前进行依赖项收集的`key`作为键名，新建一个`Set`作为值存储在其中。这个`Set`就代表源对象当前`key`值的依赖项(即`V2`的`Dep`)。

最后在每个依赖项(`Set`)中，就直接存储当前的`effect()`函数，此时在其中的`effect()`都是唯一的(理解`Set`的性质)。与此同时，当前被依赖追踪的副作用函数，也会加入该依赖项(`Set`)。由此它们形成了以下的结构：

![依赖项结构](./imgs/dependence%20structure.svg)
![依赖项结构-简洁版](./imgs/denpendence%20structure-sum%20up.svg)
