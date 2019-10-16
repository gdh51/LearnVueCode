# data属性的合并策略
data属性的更新策略较为复杂，
```js
strats.data = function (
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {

    // 在组件中, data必须为函数
    if (!vm) {
        if (childVal && typeof childVal !== 'function') {
            process.env.NODE_ENV !== 'production' && warn(
                'The "data" option should be a function ' +
                'that returns a per-instance value in component ' +
                'definitions.',
                vm
            )

            return parentVal;
        }
        return mergeDataOrFn(parentVal, childVal);
    }

    return mergeDataOrFn(parentVal, childVal, vm);
}
```

之后调用`mergeDataOrFn()`根据vm是否存在来返回一个用于合并的函数：
```js
function mergeDataOrFn(
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {

    // vm为组件实例的情况
    if (!vm) {

        // 返回其中存在的一个
        if (!childVal) {
            return parentVal;
        }
        if (!parentVal) {
            return childVal;
        }
        // when parentVal & childVal are both present,
        // we need to return a function that returns the
        // merged result of both functions... no need to
        // check if parentVal is a function here because
        // it has to be a function to pass previous merges.
        // 当两个参数都存在时，就返回一个合并它们options的函数
        return function mergedDataFn() {
            return mergeData(
                typeof childVal === 'function' ? childVal.call(this, this) : childVal,
                typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
            );
        }

    // 合并Vue实例的data属性
    } else {
        return function mergedInstanceDataFn() {
            const instanceData = typeof childVal === 'function' ?
                childVal.call(vm, vm) :
                childVal;
            const defaultData = typeof parentVal === 'function' ?
                parentVal.call(vm, vm) :
                parentVal;

            if (instanceData) {
                return mergeData(instanceData, defaultData);
            } else {
                return defaultData;
            }
        }
    }
}
```

最后是简单的类似`Object.assign`的函数`mergeData`，用于正式合并属性，通过递归的方式
```js
function mergeData(to: Object, from: ? Object): Object {
    if (!from) return to;
    let key, toVal, fromVal;

    const keys = hasSymbol ?
        Reflect.ownKeys(from) :
        Object.keys(from);

    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        // in case the object is already observed...
        if (key === '__ob__') continue
        toVal = to[key];
        fromVal = from[key];
        if (!hasOwn(to, key)) {
            set(to, key, fromVal)
        } else if (
            toVal !== fromVal &&
            isPlainObject(toVal) &&
            isPlainObject(fromVal)
        ) {
            mergeData(toVal, fromVal)
        }
    }
    return to;
}
```

具体合并`options`的函数为，可以理解为递归调用`Object.assign()`
```js
function mergeData(to: Object, from: ? Object): Object {
    if (!from) return to;
    let key, toVal, fromVal;

    // 防止有Symbol为键名的属性
    const keys = hasSymbol ?
        Reflect.ownKeys(from) :
        Object.keys(from);

    // 向to对象上添加from对象上自己不存在的属性
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        // in case the object is already observed...
        if (key === '__ob__') continue
        toVal = to[key];
        fromVal = from[key];
        if (!hasOwn(to, key)) {
            set(to, key, fromVal);
        } else if (
            toVal !== fromVal &&
            isPlainObject(toVal) &&
            isPlainObject(fromVal)
        ) {
            // 对象情况递归调用合并
            mergeData(toVal, fromVal);
        }
    }
    return to;
}
```

## provide的策略
同data的策略
```js
strats.provide = mergeDataOrFn;
```