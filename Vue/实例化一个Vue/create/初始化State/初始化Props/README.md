# initProps()

该函数用于初始化`Vue`实例的`props`属性，初始化完成后，所有`props`属性将会存储在`Vue`实例的`._props`属性中。

```js
function initProps(vm: Component, propsOptions: Object) {

    // 父组件或自定义传入的propsData值
    const propsData = vm.$options.propsData || {}

    // 在vm实例上定义_props的代理访问点
    const props = vm._props = {};

    // cache prop keys so that future props updates can iterate using Array
    // instead of dynamic object key enumeration.
    // 缓存prop的键名, 之后更新props时不用在次遍历对象来获取键名
    const keys = vm.$options._propKeys = [];

    // 确定其不为根vm实例
    const isRoot = !vm.$parent;

    // root instance props should be converted
    // 非根实例则要关闭Vue实例化时的依赖项收集
    if (!isRoot) {
        toggleObserving(false)
    }

    // 遍历组件原始定义的propsOptions配置
    for (const key in propsOptions) {
        keys.push(key);

        // 效验props中的各种属性，包括validate、required、type
        const value = validateProp(key, propsOptions, propsData, vm);

        // 生产环境中, 限制props名与修改props中属性
        // 为prop属性的setter定义一个报错函数，在修改该属性时报错
        if (process.env.NODE_ENV !== 'production') {
            const hyphenatedKey = hyphenate(key)
            if (isReservedAttribute(hyphenatedKey) ||
                config.isReservedAttr(hyphenatedKey)) {
                warn(
                    `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
                    vm
                )
            }

            // 定义一个setter, 在用户改变props某个属性时, 触发该setter来报错
            defineReactive(props, key, value, () => {
                if (!isRoot && !isUpdatingChildComponent) {
                    warn(
                        `Avoid mutating a prop directly since the value will be ` +
                        `overwritten
                        whenever the parent component re-renders. ` +
                        `Instead, use a data or computed property based on the prop's ` +
                        `value. Prop being mutated: "${key}"`,
                        vm
                    )
                }
            })
        } else {
            defineReactive(props, key, value)
        }
        // static props are already proxied on the component's prototype
        // during Vue.extend(). We only need to proxy props defined at
        // instantiation here.
        // 在vm上代理_props中的属性
        if (!(key in vm)) {
            proxy(vm, `_props`, key)
        }
    }

    // 还原依赖项收集开关
    toggleObserving(true);
}
```

初始化`props`属性呢，总体分为两步：

1. 效验`Prop`属性值
2. 对其进行响应式处理

其中效验`Prop`属性较为复杂，篇幅比较长，它通过[`validateProp()`](./验证属性/README.md)方法来进行效验。
___
那么对于该`prop`属性的响应式处理，则是调用的`defineReactive()`方法，这里我们先不对其进行了解，但我们要知道这里在对其进行响应式变更时，为其定义了一个自定义`setter`函数(对应该方法的第四个参数)，会在试图修改该`prop`时报错。

那么最后按我们使用`VM`时的心得，我们可以直接在`Vue`实例上访问到某个属性，这就是通过下面来实现的：

```js
if (!(key in vm)) {
    proxy(vm, `_props`, key);
}
```

[查看`proxy()`——代理访问](./工具方法/README.md#proxy%e4%bb%a3%e7%90%86%e8%ae%bf%e9%97%ae%e5%b1%9e%e6%80%a7)
