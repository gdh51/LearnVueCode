# initData()——初始化data

针对用户是否定义`data`, `vm`中有两种处理方式：

```js
// 截取initState()中的部分代码
if (opts.data) {
    initData(vm)
} else {

    // 为定义时, 挂载一个空对象代理
    observe(vm._data = {}, true /* asRootData */)
}
```

下面来详细了解下`initData()`函数,该函数做了两件事：

1. 效验`data`中属性名, 不与`props、methods`重复且不为保留字
2. 代理定义在`vm._data`中的属性，可以直接从`vm`上直接访问，并赋予其响应式特性。

具体详细的情况，可以直接看如下的函数注释：

```js
function initData(vm: Component) {

    // 获取组中中定义的data
    let data = vm.$options.data;

    // 获取用户定义的data的真实值, 并挂载在Vue实例的_data上
    data = vm._data = typeof data === 'function' ?

        // 获取函数值的返回值
        getData(data, vm) :
        data || {};

    // 当函数形式返回的不是对象时报错，你懂的
    if (!isPlainObject(data)) {
        data = {}
        process.env.NODE_ENV !== 'production' && warn(
            'data functions should return an object:\n' +
            'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
            vm
        )
    }

    // proxy data on instance
    // 将data的属性字段代理到vm实例上，这样我们就可以直接访问vm.xx来获取该值
    const keys = Object.keys(data);

    // 获取之前定义过的字段
    const props = vm.$options.props;
    const methods = vm.$options.methods;
    let i = keys.length;

    // 通过之前的代码我们知道，props与methods也会代理到vm实例上,
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

            // 代理data中属性到Vue实例上(即直接从vm.xx访问vm._data.xx)
            proxy(vm, `_data`, key);
        }
    }

    // 递归data使其所有属性为响应式属性
    observe(data, true /* asRootData */ )
}
```

## getData()——获取函数返回值

在组件定义的`data`为函数形式时，我们通过该函数来获取返回函数形式的`data`的返回值。

[#7573 子组件定义props初始化时, 会被作为父组件的依赖项收集](https://github.com/vuejs/vue/issues/7573)

```js
function getData(data: Function, vm: Component): any {

    // #7573 disable dep collection when invoking data getters
    // 禁止在调用getter时收集依赖项，防止重复收集依赖项
    pushTarget();
    try {

        // 获取函数的返回值(即返回的对象)
        return data.call(vm, vm)
    } catch (e) {

        // 一个报错函数，不用关注
        handleError(e, vm, `data()`)
        return {}
    } finally {
        popTarget()
    }
}
```

同样还有`observe()`函数，这里我们先不进行了解，等`initState()`函数学习完在统一学习。
