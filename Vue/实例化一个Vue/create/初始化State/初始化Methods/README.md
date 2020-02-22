# initMethods()——初始化Methods

比较容易理解，该方法做了两件事：

1. 效验`Methods`中定义的名称(不与`props`中定义的属性名称重复/不为保留字)
2. 将定义的方法直接挂载在当前`Vue`实例上，并将方法的`this`指向当前`Vue`实例

```js
function initMethods(vm: Component, methods: Object) {

    // 获取props中设置的属性
    const props = vm.$options.props

    // 如果方法名与props中属性名重复或为保留字则报错
    for (const key in methods) {
        if (process.env.NODE_ENV !== 'production') {
            if (typeof methods[key] !== 'function') {
                warn(
                    `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
                    `Did you reference the function correctly?`,
                    vm
                )
            }
            if (props && hasOwn(props, key)) {
                warn(
                    `Method "${key}" has already been defined as a prop.`,
                    vm
                )
            }
            if ((key in vm) && isReserved(key)) {
                warn(
                    `Method "${key}" conflicts with an existing Vue instance method. ` +
                    `Avoid defining component methods that start with _ or $.`
                )
            }
        }

        // 在vm实例上挂载该方法, 当该方法不为函数时, 直接清空,
        // 同时将方法的this指向绑定为当前vm实例
        vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
    }
}
```
