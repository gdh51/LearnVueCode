# initProps()

下面来看一下`Vue`实例在创建时如何初始化`props`中的属性。其中，它将每一个`props`属性变更为响应式属性。

话不多说直接上源码：

```js
function initProps(vm: Component, propsOptions: Object) {
    // 父组件最初传递的props
    const propsData = vm.$options.propsData || {};

    // 在vm实例上定义_props的代理
    const props = (vm._props = {});

    // 缓存prop的键名, 之后更新props时不用再次遍历对象来获取键名
    const keys = (vm.$options._propKeys = []);
    const isRoot = !vm.$parent;

    // root instance props should be converted
    if (!isRoot) {
        toggleObserving(false);
    }

    for (const key in propsOptions) {
        keys.push(key);

        // 效验props中对属性的配置的type, 返回该prop的正确值(父级中值或默认值)
        const value = validateProp(key, propsOptions, propsData, vm);

        // 生产环境中, 限制props名与修改props中属性
        if (process.env.NODE_ENV !== 'production') {
            const hyphenatedKey = hyphenate(key);
            if (
                isReservedAttribute(hyphenatedKey) ||
                config.isReservedAttr(hyphenatedKey)
            ) {
                warn(
                    `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
                    vm
                );
            }

            // 定义一个自定义setter, 在用户改变props某个属性时, 触发该setter来报错
            defineReactive(props, key, value, () => {
                if (!isRoot && !isUpdatingChildComponent) {
                    warn(
                        `Avoid mutating a prop directly since the value will be ` +
                            `overwritten whenever the parent component re-renders. ` +
                            `Instead, use a data or computed property based on the prop's ` +
                            `value. Prop being mutated: "${key}"`,
                        vm
                    );
                }
            });
        } else {
            defineReactive(props, key, value);
        }

        // static props are already proxied on the component's prototype
        // during Vue.extend(). We only need to proxy props defined at
        // instantiation here.
        if (!(key in vm)) {
            proxy(vm, `_props`, key);
        }
    }
    toggleObserving(true);
}
```

## validateProp()——效验 prop 的 type, 并返回一个合适的值

首先，该函数会效验`prop`定义的`type`, 之后在`prop`未传值的情况下且定义有默认值时返回默认值

```js
function validateProp(
    key: string,
    propOptions: Object,
    propsData: Object,
    vm?: Component
): any {
    const prop = propOptions[key];
    const absent = !hasOwn(propsData, key);
    let value = propsData[key];

    // 检查type是否为Boolean类型
    const booleanIndex = getTypeIndex(Boolean, prop.type);
    if (booleanIndex > -1) {
        if (absent && !hasOwn(prop, 'default')) {
            value = false;
        } else if (value === '' || value === hyphenate(key)) {
            // only cast empty string / same name to boolean if
            // boolean has higher priority
            const stringIndex = getTypeIndex(String, prop.type);

            if (stringIndex < 0 || booleanIndex < stringIndex) {
                value = true;
            }
        }
    }

    // 在父级未传值情况下，检查是否有default默认值, 在该props没有值时获取它
    if (value === undefined) {
        value = getPropDefaultValue(vm, prop, key);

        // since the default value is a fresh copy,
        // make sure to observe it.
        // 当默认值为新的副本时, 要重新为它定义响应式特性(依赖于父级对象)
        const prevShouldObserve = shouldObserve;
        toggleObserving(true);
        observe(value);
        toggleObserving(prevShouldObserve);
    }
    if (
        process.env.NODE_ENV !== 'production' &&
        // skip validation for weex recycle-list child component props
        !(__WEEX__ && isObject(value) && '@binding' in value)
    ) {
        // 判断prop名是否合法
        assertProp(prop, key, value, vm, absent);
    }
    return value;
}
```

### getTypeIndex(type, expectedTypes)——查看当前 type 是否在期望的 type 中

返回符合预期的`type`的下标

```js
function getTypeIndex(type, expectedTypes): number {
    // 验证非数组情况
    if (!Array.isArray(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1;
    }

    // 验证type为数组的情况
    for (let i = 0, len = expectedTypes.length; i < len; i++) {
        if (isSameType(expectedTypes[i], type)) {
            return i;
        }
    }
    return -1;
}
```

### getPropDefaultValue()——获取 prop 默认值

获取一个 prop 属性的默认值

```js
function getPropDefaultValue(
    vm: ?Component,
    prop: PropOptions,
    key: string
): any {
    // 未配置默认值时, 返回undefined
    if (!hasOwn(prop, 'default')) {
        return undefined;
    }

    const def = prop.default;

    // warn against non-factory defaults for Object & Array
    // 在Object/Array类型时, default必须是工厂函数的形式
    if (process.env.NODE_ENV !== 'production' && isObject(def)) {
        warn(
            'Invalid default value for prop "' +
                key +
                '": ' +
                'Props with type Object/Array must use a factory function ' +
                'to return the default value.',
            vm
        );
    }

    // the raw prop value was also undefined from previous render,
    // return previous default value to avoid unnecessary watcher trigger
    // 在经历过上次渲染后父级中即将传入的props仍为undefined时, 直接返回父级该属性的值来避免不必要的watcher的触发
    if (
        vm &&
        vm.$options.propsData &&
        vm.$options.propsData[key] === undefined &&
        vm._props[key] !== undefined
    ) {
        return vm._props[key];
    }
    // call factory function for non-Function types
    // a value is Function if its prototype is function even across different execution context
    return typeof def === 'function' && getType(prop.type) !== 'Function'
        ? def.call(vm)
        : def;
}
```
