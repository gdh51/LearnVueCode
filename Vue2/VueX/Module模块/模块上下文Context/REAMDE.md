# 模块上下文Context

在注册`Module`时，我们同时为其注册了一个上下文对象：

```js
// 为当前的module定义上下文对象，主要是规定其module中挂载的属性的访问方式
var local = module.context = makeLocalContext(store, namespace, path);
```

它的目的主要是保证了我们访问的`getter/mutation/action`能在对应的模块。

```js
/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 * 本地化dispatch、commit、getters、state
 * 当没有命名空间时与根组件公用一个
 */
function makeLocalContext(store, namespace, path) {

    // 是否具有命名空间
    var noNamespace = namespace === '';

    var local = {

        // 在拥有命名空间，重新封装该dispatch函数，为其type增加路径
        // 在没有命名空间时，使用原dispatch函数
        dispatch: noNamespace ? store.dispatch : function (_type, _payload, _options) {

            // 格式化参数
            var args = unifyObjectStyle(_type, _payload, _options);
            var payload = args.payload;
            var options = args.options;
            var type = args.type;

            // 当没有配置或未设置root属性时，为其添加命名空间前缀
            // 这里的含义其实是在该module中提交action函数
            if (!options || !options.root) {
                type = namespace + type;
                if (!store._actions[type]) {
                    console.error(("[vuex] unknown local action type: " + (args.type) + ", global type: " + type));
                    return
                }
            }

            return store.dispatch(type, payload)
        },

        commit: noNamespace ? store.commit : function (_type, _payload, _options) {
            var args = unifyObjectStyle(_type, _payload, _options);
            var payload = args.payload;
            var options = args.options;
            var type = args.type;

            // 同上，未设置root或options时，在本地上下文问提交mutation
            if (!options || !options.root) {
                type = namespace + type;
                if (!store._mutations[type]) {
                    console.error(("[vuex] unknown local mutation type: " + (args.type) + ", global type: " + type));
                    return
                }
            }

            store.commit(type, payload, options);
        }
    };

    // getters and state object must be gotten lazily
    // because they will be changed by vm update
    // getters和state不会立即获取, 它们会随着vm更新而改变
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
        },
        state: {

            // 获取该路径下的state
            get: function () {
                return getNestedState(store.state, path);
            }
        }
    });

    return local;
}
```

这里我们又可以看到，对应**命名空间版本和非命名空间版本**，它们有一点微小的区别，首先是`Mutation/Action`函数，当其**拥有命名空间时且提交时不指定**`{ root: true }`使用根`Mutation/Action`时，那么其`dispatch/commit()`的方法会附带上命名空间；其次是`getter`状态栈，当其拥有命名空间时，它会调用`makeLocalGetters()`方法，从全局的`getter`中，获取拥有该命名空间的一部分子集：

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

该方法将全局`getter`中，具有该`module`命名空间前缀的`getter`(当然不一定是该`module`的`getter`，也有可能是其子`module`的)单独代理到`gettersProxy`对象中，使我们可以直接在该`module.context`中访问该`module`命名空间下的这些`getter`。
