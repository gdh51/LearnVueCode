# convert数据响应化(Observer)

作为一个暴露的`API`，`Vue3.0`通过该函数来将对象转化为响应式对象，那么该函数对标`Vue2.x`中的`observe()`函数，这里我们先看看其具体的做法：

```js
const convert = (val) => isObject(val) ? reactive(val) : val;
```

从上面我们可以得知，响应化还是只对对象值对象处理，对于对象值调用`reactive()`函数来进行响应化，那么在了解它之前，我们先来看一个用于存储这些响应化数据的地方。

## 响应化数据的存储

在`Vue3.x`中，没对数据进行不同的响应化处理，就会被存放在不同的`WeakMap/WeakSet`中，同时也要保存**原数据与响应式代理数据的映射关系**：

```js
// WeakMaps that store {raw <-> observed} pairs.
// WeakMaps用于存储原生对象与观察者对象之间互相的映射
const rawToReactive = new WeakMap();
const reactiveToRaw = new WeakMap();
const rawToReadonly = new WeakMap();
const readonlyToRaw = new WeakMap();

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
// WeakSets用于存储被标记为只读或在响应式创建期间却无依赖项的值
const readonlyValues = new WeakSet();
const nonReactiveValues = new WeakSet();
```

对于可以进行代理的数据类型，也进行了明确的规定：

```js
const isObservableType = /*#__PURE__*/ makeMap('Object,Array,Map,Set,WeakMap,WeakSet');
const canObserve = (value) => {
    return (!value._isVue &&
        !value._isVNode &&

        // 对象类型的值
        isObservableType(toRawType(value)) &&

        // 已创建过响应式但为具有proxy的值
        !nonReactiveValues.has(value));
};
```

对于ES6中一些新增的数据类型，需要特殊的处理器：

```js
const collectionTypes = new Set([Set, Map, WeakMap, WeakSet]);
```

了解了上面的各个变量后，我们来看看这个响应式`API`

## 对象/数据响化处理——reactive()

对于响应式对象的创建一共有两种类型：

- 只读
- 普通

对于只读的对象类型的代理，再次调用`readonly() api`，而对于普通的对象则继续调用`createReactiveObject()`进行处理。

```js
// 将对象变为响应式的API
function reactive(target) {

    // if trying to observe a readonly proxy, return the readonly version.
    // 是否已存在该对象的只读版本的代理，有则直接返回
    if (readonlyToRaw.has(target)) {
        return target;
    }

    // target is explicitly marked as readonly by user
    // 如果该值被用户标记为只读，那么进行只读的响应式处理
    if (readonlyValues.has(target)) {
        return readonly(target);
    }

    // 是否已进行处理，已处理则直接返回
    if (isRef(target)) {
        return target;
    }

    // 返回创建的响应式对象
    return createReactiveObject(target, rawToReactive, reactiveToRaw, mutableHandlers, mutableCollectionHandlers);
}
```

### 正式代理数据——createReactiveObject()

无论是`readonly()`还是普通对象的代理，其实际都是对该函数的封装调用，那么我们具体来看看以下函数：

```js
function createReactiveObject(target, toProxy, toRaw, baseHandlers, collectionHandlers) {

    // 如果不是对象，则直接返回该值
    if (!isObject(target)) {
        return target;
    }

    // target already has corresponding Proxy
    // 如果该对象已经有相应的代理，则直接返回这个代理的对象
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }

    // target is already a Proxy
    // 该对象已被其他代理，返回原对象
    if (toRaw.has(target)) {
        return target;
    }

    // only a whitelist of value types can be observed.
    // 仅有白名单的数据类型能被代理，其他类型直接返回
    if (!canObserve(target)) {
        return target;
    }

    // 单独类型
    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers;

    // 代理数据
    observed = new Proxy(target, handlers);

    // 创建影射表
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    return observed;
}
```

从上面我们可以看到，代理了对象后，会被存入对应的`rawToxx, xxToRaw`的`WeakMap`中，防止重复进行代理；那么具体代理使用的拦截对象就要根据代理的类型来决定了：

- [只读型拦截器](./只读型拦截器/README.md)
- [普通拦截器](./普通型拦截器/README.md)
