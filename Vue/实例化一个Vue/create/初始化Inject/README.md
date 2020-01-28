# 初始化inject属性

初始化`inject`配置项通过的`initInjections()`，其做法是通过迭代查找当前实例祖先实例的`.provided`配置，然后在其中找到当前实例配置中所有的`inject`配置的键名，将其收集到一个新建的对象中并赋予这些`inject`函数响应式。

```js
function initInjections(vm: Component) {

    // 找到inject中所有的key值在祖先vm实例中的函数，返回一个键值对象
    const result = resolveInject(vm.$options.inject, vm);
    if (result) {

        // 暂时关闭依赖项的收集
        toggleObserving(false);

        // 遍历为所以函数定义响应式属性，如果在是开发模式，还要添加一个自定义setter来禁止用户修改
        Object.keys(result).forEach(key => {
            if (process.env.NODE_ENV !== 'production') {
                defineReactive(vm, key, result[key], () => {
                    warn(
                        `Avoid mutating an injected value directly since the changes will be ` +
                        `overwritten whenever the provided component re-renders. ` +
                        `injection being mutated: "${key}"`,
                        vm
                    )
                })
            } else {
                defineReactive(vm, key, result[key])
            }
        });

        // 开启全局依赖项的收集
        toggleObserving(true);
    }
}
```

整个过程比较简单和清晰，对`inject`中的函数值的查找则是通过`resolveInject()`函数，其具体细节为先遍历查找祖先组件的`provided`属性，直到根组件实例；如果没有找到就查看用户是否定义一个默认的`default`属性，定义时就使用该函数，否则就报错：

```js
function resolveInject(inject: any, vm: Component): ? Object {
    if (inject) {
        // inject is :any because flow is not smart enough to figure out cached
        // 上面的inject类型为any因为flow不能辨识缓存
        const result = Object.create(null);
        const keys = hasSymbol ? Reflect.ownKeys(inject) : Object.keys(inject);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // #6574 in case the inject object is observed...
            if (key === '__ob__') continue;
            const provideKey = inject[key].from;
            let source = vm;

            // 迭代，找到第一个祖先组件provided属性上该名的方法
            while (source) {
                if (source._provided && hasOwn(source._provided, provideKey)) {
                    result[key] = source._provided[provideKey]
                    break
                }
                source = source.$parent;
            }

            // 找到根组件都没有，查看是否配置有默认属性，
            // 如果有配置默认属性，则使用默认属性中的值，否则报错
            if (!source) {
                if ('default' in inject[key]) {
                    const provideDefault = inject[key].default;
                    result[key] = typeof provideDefault === 'function' ?
                        provideDefault.call(vm) :
                        provideDefault
                } else if (process.env.NODE_ENV !== 'production') {
                    warn(`Injection "${key}" not found`, vm)
                }
            }
        }
        return result;
    }
}
```

[官网文档介绍provide/inject](https://cn.vuejs.org/v2/api/#provide-inject)
