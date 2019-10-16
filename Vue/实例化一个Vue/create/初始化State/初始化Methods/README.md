# initMethods()
比较容易理解，该方法做了两件事：
1. 效验方法名称(不与`props`重名/不为保留字)
2. 绑定方法至当前`Vue`实例，并将方法的`this`指向当前`Vue`实例


```js
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props

  // 如方法名已在props中定义或为保留字则报错
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

    // 在vm实例上挂载该方法, 当该方法不为函数时, 直接清空, 将方法的this指向绑定为当前vm实例
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}
```