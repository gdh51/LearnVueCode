# initData()——初始化data
针对用户是否定义data, vm中有两种处理方式：

> 截取initState中的部分代码
```js
if (opts.data) {
    initData(vm)
  } else {

    // 为定义时, 挂载一个空对象代理
    observe(vm._data = {}, true /* asRootData */)
  }
```

下面来详细了解下`initData()`函数,该函数做了两件事：
1. 代理用户定义的data到当前vm实例的`_data`并赋予其响应式特性。
2. 效验`data`中属性名, 不与`props/methods`重复且不为保留字
```js
function initData (vm: Component) {
  let data = vm.$options.data;

  // 获取用户定义的data, 然后挂载在Vue实例的_data上
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {};

  // 当函数形式返回的不是对象时报错你懂的
  if (!isPlainObject(data)) {
    data = {};
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // proxy data on instance
  const keys = Object.keys(data);
  const props = vm.$options.props;
  const methods = vm.$options.methods;
  let i = keys.length;

  // 通过之前的代码我们知道，props与methods会代理到vm实例上,
  // 所以此处data中属性名不能与其重复且不能为保留字
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {

      // 代理data中属性到Vue实例上
      proxy(vm, `_data`, key);
    }
  }

  // 递归data使其所有属性为响应式属性
  observe(data, true /* asRootData */);
}
```

## getData()
返回函数形式的data的返回值

[#7573 子组件定义props初始化时, 会被作为父组件的依赖项收集](https://github.com/vuejs/vue/issues/7573)
```js
function getData (data: Function, vm: Component): any {

  // 防止作为父组件的依赖项收集
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {

    // 返回函数形式中定义的对象
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}
```