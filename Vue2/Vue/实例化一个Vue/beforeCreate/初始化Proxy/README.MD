# 初始化 Vue 实例的代理

`initProxy()`函数的总的作用是将`Vue`实例代理到其`_renderProxy`属性上，这里针对浏览器是否支持`Proxy`类有两种处理情况：

1. 支持：就用拦截器`Proxy API`获取
2. 不支持：则直接挂载在该属性上即可

```js
if (process.env.NODE_ENV !== 'production') {
    initProxy(vm)
} else {
    vm._renderProxy = vm
}
```

首先，同样是在最初载入这个`Vue`库时，会定义一个`hasProxy`变量来判断是否支持原生的`Proxy API`，并同时在`Vue`的全局配置中定义一个`keyCodes`拦截器，用于检测是否为内部的修饰符(这些事件用于)：

```js
const config = {
    keyCodes: Object.create(null)
}

// 浏览器是否支持原生Proxy属性
const hasProxy = typeof Proxy !== 'undefined' && isNative(Proxy)

if (hasProxy) {
    // 给全局配置设置内置键hash表，防止用户重写内置键
    const isBuiltInModifier = makeMap(
        'stop,prevent,self,ctrl,shift,alt,meta,exact'
    )

    // 拦截原keyCodes的写入方式
    config.keyCodes = new Proxy(config.keyCodes, {
        set(target, key, value) {
            // 防止写入内部键值
            if (isBuiltInModifier(key)) {
                warn(
                    `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
                )
                return false
            } else {
                target[key] = value
                return true
            }
        }
    })
}
```

好的，进入正题，我们的`initProxy`函数是长这样的：

```js
// 根据浏览器兼容性，来决定是否使用Proxy
function initProxy(vm) {
    if (hasProxy) {
        // determine which proxy handler to use
        // 根据配置决定使用哪个拦截器
        const options = vm.$options

        // 在使用独立包编译template时(webpack)使用getHandler
        const handlers =
            options.render && options.render._withStripped
                ? getHandler
                : hasHandler
        vm._renderProxy = new Proxy(vm, handlers)
    } else {
        // 不支持，退回老方法
        vm._renderProxy = vm
    }
}
```

如果支持原生的`Proxy API`，那么就直接使用该`API`来做拦截器，不支持则直接将其赋值给`_renderProxy`变量(此时会失去验证并报错的能力)。

除此之外此处涉及到一个`_withStripped`变量，实际上它是使用`vue-loader`(具体在`@vue/component-compiler-utils`这个包中)来编译`template`时的产物，编译出来的`render()`函数会标记上，此时对于`template`中变量的使用会具有识别错误的能力。它们两个具体代码如下：

```js
const hasHandler = {
    has(target, key) {
        // 是否存在该访问字段
        const has = key in target

        // 查看该字段是否为全局变量（允许访问全局变量）
        const isAllowed =
            allowedGlobals(key) ||
            // 以_开头但不定义在data中属性
            (typeof key === 'string' &&
                key.charAt(0) === '_' &&
                !(key in target.$data))

        // 如果是空属性或非法属性
        if (!has && !isAllowed) {
            if (key in target.$data) warnReservedPrefix(target, key)
            else warnNonPresent(target, key)
        }
        return has || !isAllowed
    }
}

const getHandler = {
    get(target, key) {
        // 当前VM实例上无该key字段（要么是没代理上来，要么是真没有该字段）
        if (typeof key === 'string' && !(key in target)) {
            // 如果该字段存在于data中，那说明该字段用了内部命名形式命名_/$
            if (key in target.$data) warnReservedPrefix(target, key)
            // 缺失该字段，报错
            else warnNonPresent(target, key)
        }
        return target[key]
    }
}
```

从代码中我们可以看到，`hasHandler/getHandler`都用于检测用户的变量是否存在于`vm`实例之上，还有其命名方式是否与内部变量命名方式冲突。

## 为什么会有两个拦击处理器

现在的问题是，为什么会有`hasHandler`和`getHandler`两个处理器。具体原因是因为不同的开发模式导致的。如果你使用的是运行时编译`template`的模式，那么其`render()`函数会使用`hasHandler`，究其原因是其内部使用`with`操作符来访问当前的`VM`实例；而如果你是使用`webpack`这种单文件形式的`template`编译模式，那么其会生成一个独立的函数。

但是还有一点，按我们的尝试拦截器`API`的`hasHandler`只作用于`in`操作符，当我们使用模版时，它生成的渲染函数使用的是`with`语句，并未使用`in`操作符，其实不是这样，它还作用于以下的查询方式：

- 属性查询：`foo in proxy`
- `with`变量访问：`with (proxy) { (foo);}`
- `Reflect.has()`

## 其余的一些函数说明

下面是具体的变量键名检测函数，其中的`makeMap()`函数之后会了解，这里可以立即为一个取值函数，如果包含传入的值，则返回`true`，例如下面的`Infinity`包含在其中，如果我们调用`allowedGlobals(Infinity)`则返回`true`。

```js
// 一个以下字段的hash表，在表中存在以下某个字段时返回true
const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
        'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
        'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
        'require' // for Webpack/Browserify
)

// 一些警告函数，用于Proxy的拦截
// 提示用户未定义该变量(即在渲染模版或函数中使用到，但却未在vm实例上定义)
const warnNonPresent = (target, key) => {
    warn(
        `Property or method "${key}" is not defined on the instance but ` +
            'referenced during render. Make sure that this property is reactive, ' +
            'either in the data option, or for class-based components, by ' +
            'initializing the property. ' +
            'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
        target
    )
}

// 告警使用内部变量命名方式(即用_开头)
const warnReservedPrefix = (target, key) => {
    warn(
        `Property "${key}" must be accessed with "$data.${key}" because ` +
            'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
            'prevent conflicts with Vue internals' +
            'See: https://vuejs.org/v2/api/#data',
        target
    )
}
```
