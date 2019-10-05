# initComputed()

```js
// 计算属性固有配置属性
const computedWatcherOptions = { lazy: true };

function initComputed(vm: Component, computed: Object) {

    // 在当前vm上挂载computed的Watcher
    const watchers = (vm._computedWatchers = Object.create(null));

    // computed properties are just getters during SSR
    // (忽视)计算属性仅作为getter在服务器渲染下
    const isSSR = isServerRendering();

    for (const key in computed) {
        const userDef = computed[key];

        // 取值函数getter
        const getter = typeof userDef === 'function' ? userDef : userDef.get;
        if (process.env.NODE_ENV !== 'production' && getter == null) {
            warn(`Getter is missing for computed property "${key}".`, vm);
        }

        if (!isSSR) {

            // create internal watcher for the computed property.
            // 为计算属性创建一个watcher，用于依赖项与响应式处理
            watchers[key] = new Watcher(
                vm,
                getter || noop,
                noop,
                computedWatcherOptions
            );
        }

        // component-defined computed properties are already defined on the
        // component prototype. We only need to define computed properties defined
        // at instantiation here.
        // 注册computed属性
        if (!(key in vm)) {
            defineComputed(vm, key, userDef);
        } else if (process.env.NODE_ENV !== 'production') {
            if (key in vm.$data) {
                warn(
                    `The computed property "${key}" is already defined in data.`,
                    vm
                );
            } else if (vm.$options.props && key in vm.$options.props) {
                warn(
                    `The computed property "${key}" is already defined as a prop.`,
                    vm
                );
            }
        }
    }
}
```

## defineComputed
Vue通过该函数来向Vue实例上定义该computed属性
```js
const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
};

function defineComputed(target: any, key: string, userDef: Object | Function) {
    const shouldCache = !isServerRendering();

    // 这里我们只关注非服务器渲染，则使用createComputedGetter()函数来创建计算属性的getter
    if (typeof userDef === 'function') {
        sharedPropertyDefinition.get = shouldCache
            ? createComputedGetter(key)
            : createGetterInvoker(userDef);
        sharedPropertyDefinition.set = noop;
    } else {
        sharedPropertyDefinition.get = userDef.get
            ? shouldCache && userDef.cache !== false
                ? createComputedGetter(key)
                : createGetterInvoker(userDef.get)
            : noop;
        sharedPropertyDefinition.set = userDef.set || noop;
    }

    // 未定义setter的情况下，不允许修改computed的值
    if (
        process.env.NODE_ENV !== 'production' &&
        sharedPropertyDefinition.set === noop
    ) {
        sharedPropertyDefinition.set = function() {
            warn(
                `Computed property "${key}" was assigned to but it has no setter.`,
                this
            );
        };
    }

    // 向vm实例上定义该计算属性
    Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

通过该函数返回一个计算属性的`getter`
```js
function createComputedGetter(key) {
    return function computedGetter() {

        // 取出对应computed属性的watcher对象
        const watcher = this._computedWatchers && this._computedWatchers[key]
        if (watcher) {

            // 当为computed属性时，为watcher进行依赖项收集
            if (watcher.dirty) {
                watcher.evaluate()
            }
            if (Dep.target) {
                watcher.depend()
            }
            return watcher.value
        }
    }
}
```

```js
evaluate() {
    // 对computed函数进行取值，依赖项收集
    this.value = this.get();
    this.dirty = false;
}
```