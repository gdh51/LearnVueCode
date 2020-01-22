# data属性的合并策略

`data`属性的更新策略较为复杂，

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

从上面的入口函数我们可以看到，两种都是调用的`mergeDataOrFn()`，唯一的区别是组件vm实例会对配置的`data`进行检验。返回的函数直接是调用后的结果，那么我们来看看这个函数是什么：

```js
function mergeDataOrFn(
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {

    // 组件实例的情况
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

    // 根Vue实例的data属性
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

乍一看其实`mergedDataFn()`与`mergedInstanceDataFn()`似乎是一样的，唯一的区别就是对于`childVal`有特殊的处理。最后都是用简单的类似`Object.assign()`的函数`mergeData`处理结果，用于合并`data`属性，该方法只向目标对象中添加自身没有的字段，对于对象类型字段，其通过递归调用该方法来添加其中的属性。

具体的`mergeData()`函数代码如下：

```js
function mergeData(to: Object, from: ? Object): Object {
    if (!from) return to;
    let key, toVal, fromVal;

    // 检查from对象中所有的key值，支持symbol
    const keys = hasSymbol ?
        Reflect.ownKeys(from) :
        Object.keys(from);

    for (let i = 0; i < keys.length; i++) {
        key = keys[i];

        // in case the object is already observed...
        // 防止该data对象已被观察
        if (key === '__ob__') continue
        toVal = to[key];
        fromVal = from[key];

        // 从from对象中添加to对象没有的key值
        if (!hasOwn(to, key)) {

            // 直接为其定义响应式属性
            set(to, key, fromVal);

        // 如果该值为对象，则递归添加
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

上述代码中涉及一个`set()`方法，这里暂时不用关心，它用于将一个属性设置为响应式。其他的地方应该好理解。

## 为什么组件vm实例要使用函数而不是对象

当作为组件来实例化一个`vm`实例时，调用`data`的策略时，不会传入第三个参数(即当前`vm`实例)，所以在`data`的合并策略函数中，会进入第一个分支：

```js
if (!vm) {
    // 进入当前分支
    if (childVal && typeof childVal !== 'function') {
        process.env.NODE_ENV !== 'production' && warn(
            'The "data" option should be a function ' +
            'that returns a per-instance value in component ' +
            'definitions.',
            vm
        );

        return parentVal;
    }
}
```

在这里就会对`childVal`的类型进行检测，如果不是函数，那么就会导致直接返回`parentVal`，这就是为什么如果我们在组件中定义一个对象时，必须要声明一个函数，而不是一个对象。当声明一个对象时，所有的组件都会不能使用这个`data`对象。

## provide的策略

同`data`的策略的合并方式相同。

```js
strats.provide = mergeDataOrFn;
```
