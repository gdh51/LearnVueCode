# 初始化 Vue 实例的代理

`initProxy()`函数的总的作用是将`Vue`实例代理到其`_renderProxy`属性上，这里针对浏览器是否支持`Proxy`类有两种处理情况：

1. 支持：就用拦截器`API`获取
2. 不支持：则直接挂载在该属性上即可

首先，同样是在最初载入这个`Vue`库时，会定义一个`hasProxy`变量来判断是否支持原生的`Proxy API`，并同时在`Vue`的全局配置中定义一个`keyCodes`拦截器，用于检测是否为内部的修饰符：

```js
// 浏览器是否支持原生Proxy属性
const hasProxy = typeof Proxy !== 'undefined' && isNative(Proxy);

if (hasProxy) {

    // 给全局配置设置内置键hash表，防止用户重写内置键
    const isBuiltInModifier = makeMap(
        'stop,prevent,self,ctrl,shift,alt,meta,exact'
    );
    config.keyCodes = new Proxy(config.keyCodes, {
        set(target, key, value) {
            if (isBuiltInModifier(key)) {
                warn(
                    `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
                );
                return false;
            } else {
                target[key] = value;
                return true;
            }
        }
    });
}
```

好的，进入正题，我们的`initProxy`函数是长这样的：

```js
// 根据浏览器兼容性，来决定是否使用Proxy
function initProxy(vm) {
    if (hasProxy) {

        // determine which proxy handler to use
        // 根据配置决定使用哪个拦截器
        const options = vm.$options;

        // 一般情况下使用hasHandler
        const handlers =
            options.render && options.render._withStripped
                ? getHandler
                : hasHandler;
        vm._renderProxy = new Proxy(vm, handlers);
    } else {
        vm._renderProxy = vm;
    }
}
```

比较简单，如果支持原生的`Proxy API`，那么就直接使用该`API`来做拦截器，不支持则直接将其赋值给`_renderProxy`变量。同样，这里还有个`_withStripped`变量来控制在支持拦截器`API`时，具体使用哪一种拦截器处理器，一般情况下，该变量是没有值的，所以使用`hasHandler`，该变量也不会在任何该库任何地方出现，估计在`SSR`中会使用到，它们两个具体代码如下：

```js
// Proxy的has拦截器，检测用户定义在vm上的变量是否合法
const hasHandler = {
    has(target, key) {
        const has = key in target;
        const isAllowed =

            // 排除全局变量
            allowedGlobals(key) ||

            // 内部变量(即以_开头)与不再data中定义的变量
            (typeof key === 'string' &&
                key.charAt(0) === '_' &&
                !(key in target.$data));

        // 如果用户在data中使用了以_为开头定义的变量
        if (!has && !isAllowed) {

            // 此处告警用户在data中使用了_开头的内部变量命名方式
            if (key in target.$data) warnReservedPrefix(target, key);

            // 此处告警用户使用了未定义的变量
            else warnNonPresent(target, key);
        }
        return has || !isAllowed;
    }
};

// Proxy的取值拦截器
const getHandler = {
    get(target, key) {

        // 如果用户使用了未定义的变量，则报错
        if (typeof key === 'string' && !(key in target)) {
            if (key in target.$data) warnReservedPrefix(target, key);
            else warnNonPresent(target, key);
        }

        // 否则直接返回
        return target[key];
    }
};
```

从代码中我们可以看到，`hasHandler/getHandler`都用于检测用户的变量是否存在于`vm`实例之上，还有其命名方式是否合法。现在的问题是，为什么要使用`hasHandler`，按我们的尝试拦截器`API`的`hasHandler`只作用于`in`操作符，当我们使用模版时，它生成的渲染函数使用的是`with`语句，并未使用`in`操作符，其实不是这样，它还作用于以下的查询方式：

+ 属性查询：`foo in proxy`
+ `with`变量访问：`with (proxy) { (foo);}`
+ `Reflect.has()`

下面是具体的变量键名检测函数，其中的`makeMap()`函数之后会学习，这里可以立即为一个取值函数，如果包含传入的值，则返回`true`，例如下面的`Infinity`包含在其中，如果我们调用`allowedGlobals(Infinity)`则返回`true`。

```js
// 一个以下字段的hash表，在表中存在以下某个字段时返回true
const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
        'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
        'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
        'require' // for Webpack/Browserify
);

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
    );
};

// 告警使用内部变量命名方式(即用_开头)
const warnReservedPrefix = (target, key) => {
    warn(
        `Property "${key}" must be accessed with "$data.${key}" because ` +
            'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
            'prevent conflicts with Vue internals' +
            'See: https://vuejs.org/v2/api/#data',
        target
    );
};
```
