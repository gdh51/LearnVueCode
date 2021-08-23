# reactive(对象响应化)

在`Vue3`中，想要在`hook`中使用`data(){}`的功能，那么你需要做以下操作：

```js
import { reactive } from 'vue'

const data = reactive({ /* ... */ })

// 等价于
data() {
    return {}
}
```

至此，我们使用的`data`就具有响应式能力了，但还有一些注意的，就是不能使用解构赋值来从中取得某个属性，为什么会这样呢？具体来看看`reactive()`函数

## reactive(target: object)——创建普通的响应式对象

该函数用于创建一个不具有特殊性的响应式对象：

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

    // 存储通过reactive化的对象
    reactiveMap
  )
}
```

该函数仅仅是对`createReactiveObject()`函数的包装，由此我们可以猜测该函数才是统一创建响应式对象的函数，事实也如此：

### createReactiveObject()——通用函数，创建响应式对象

```js
function createReactiveObject(
  // 要响应化的对象
  target: Target,
  // 是否处理为只读的响应化对象
  isReadonly: boolean,
  // 普通对象的代理处理器
  baseHandlers: ProxyHandler<any>,
  // 集合对象的拦截函数
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  // 仅对象进行响应化处理(因为Proxy仅能代理对象)
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }

    // 非对象直接返回
    return target
  }

  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  // 目标对象已经被响应化了直接返回(除去一种特殊情况，即将普通的响应式对象转化为只读的)
  if (
    // 源对象存在
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target)

  // 如果找到了，则直接返回该响应式对象
  if (existingProxy) {
    return existingProxy
  }

  // only a whitelist of value types can be observed.
  // 只有一些处于白名单的值能够被观察(响应化)
  // 这里返回3种类型，非法/普通/特殊
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  // 正式对对象进行Proxy代理，赋予其响应式功能
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )

  // 存储仅对应的管理MAP中，映射关系为 源对象 => 代理对象
  proxyMap.set(target, proxy)
  return proxy
}
```

相对于之前`Vue2`来说，该函数比较简单，主要就是两种处理：

1. 是响应式对象就直接返回(除去一些特殊情况)。
2. 对象响应化/只读，通过`Proxy`进行操作行为拦截，并存储在对应的全局的`WeakMap`中。

当然看似这么简单的原因是因为实际的观察逻辑被集中在`Proxy`的拦截器中了。这里就不详细描述了，具体看下面的归类：

- 普通对象拦截器
  - 响应化/浅响应化
  - 只读/浅只读
- 集合对象拦截器
  - 响应化/浅响应化
  - 只读/浅只读

在非只读的情况下，如果进行属性访问，那么久会触发`effect()`追踪(即`Vue2`中的依赖性收集)；在进行书写写入时，则会调用一个名为`trigger()`的函数通知对应的`effect()`进行更新。

> 想具体了解各种拦截器，请阅读本篇文章[拦截器行为分类](./拦截行为分类/README.md)

接下来你需要去查看副作用函数，了解它们之间如何合作运行

- [`effect()`副作用函数](<../effect(副作用函数)/README.md>)
