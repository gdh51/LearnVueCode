# Getter访问器

该`Getter`我们最先要去看看它创建的本地上下文`Getter`是什么：

## 本地getter代理

```js
Object.defineProperties(local, {
    getters: {
        get: noNamespace ?

        // 在未有命名空间时，返回store上的getters
        function () {
            return store.getters;
        } : function () {

            // 将该命名空间下的getter全部代理到当前module的getters中
            return makeLocalGetters(store, namespace);
        }
    }
}
```

当我们访问这个`local.getters`时，就会触发`makeLocalGetters()`函数，生成一个全局`getters`中本地`getter`的代理：

```js
// 将命名空间module的getter代理到本module中
function makeLocalGetters(store, namespace) {

    // getter代理
    var gettersProxy = {};
    var splitPos = namespace.length;

    // 遍历store上的getters，找到
    Object.keys(store.getters).forEach(function (type) {

        // skip if the target getter is not match this namespace
        // 当目标getter名称的命名空间前缀与当前module的命名空间不匹配时跳过
        if (type.slice(0, splitPos) !== namespace) {
            return
        }

        // extract local getter type
        // 提取本地getter的名称(注意这里的getter中，可能是其子module的)
        var localType = type.slice(splitPos);

        // Add a port to the getters proxy.
        // Define as getter property because
        // we do not want to evaluate the getters in this time.
        // 添加一个代理getter的接口, 防止第一时间获取getter属性
        // 在gettersProxy上代理该getter
        Object.defineProperty(gettersProxy, localType, {
            get: function () {
                return store.getters[type];
            },
            enumerable: true
        });
    });

    return gettersProxy;
}
```

这样我们在具有命名空间时，就只会在`local.getters`中访问到当前命名空间下的该`getter`了，了解完这些，我们就可以来看看`getter`的注册。

## 全局getter注册

那么首先也是注册函数，为每个`getter`的名称添加命名空间前缀：

```js
// 遍历注册当前module的getter函数在，将其注册在store中
// 有命名空间要附带命名空间
module.forEachGetter(function (getter, key) {
    var namespacedType = namespace + key;
    registerGetter(store, namespacedType, getter, local);
});
```

之后调用`registerGetter()`进行注册：

```js
function registerGetter(store, type, rawGetter, local) {
    if (store._wrappedGetters[type]) {
        {
            console.error(("[vuex] duplicate getter key: " + type));
        }
        return
    }

    store._wrappedGetters[type] = function wrappedGetter(store) {
        return rawGetter(
            local.state, // local state
            local.getters, // local getters
            store.state, // root state
            store.getters // root getters
        )
    };
}
```

现在来看是不是清晰很多了，当没有命名空间时，`local`和`store`访问到的`getters`都是一样的。

## 总结下

当具有命名空间时，我们能在模块的上下文上访问到该命名空间下的所有`getter`(实际就是代理的全局的)，且它们都具有命名空间前缀。

当没有命名空间时，模块上下文上的`getter`与全局的`getter`是一样的。
