# 辅助函数

我们知道`VueX`中有`5`个辅助函数，它们是：

- [mapState()——辅助注册state/getter](#mapstate%e8%be%85%e5%8a%a9%e6%b3%a8%e5%86%8cstategetter)
- [mapGetters()——直接获取取值器](#mapgetters%e7%9b%b4%e6%8e%a5%e8%8e%b7%e5%8f%96%e5%8f%96%e5%80%bc%e5%99%a8)
- [mapAction()——快捷注册action函数](#mapaction%e5%bf%ab%e6%8d%b7%e6%b3%a8%e5%86%8caction%e5%87%bd%e6%95%b0)
- [mapMutation()——快捷注册mutation函数](#mapmutation%e5%bf%ab%e6%8d%b7%e6%b3%a8%e5%86%8cmutation%e5%87%bd%e6%95%b0)
- [createNamespacedHelpers()——为某个命名空间创建全家桶](#createnamespacedhelpers%e4%b8%ba%e6%9f%90%e4%b8%aa%e5%91%bd%e5%90%8d%e7%a9%ba%e9%97%b4%e5%88%9b%e5%bb%ba%e5%85%a8%e5%ae%b6%e6%a1%b6)

我们都知道它用于在我们书写组件时，方便的创建对等的一些属性和方法。它们都是通过这个函数封装后产生的：

```js
/**
 * Return a function expect two param contains namespace and map. it will normalize the namespace and then the param's function will handle the new namespace and the map.
 * 封装原函数，处理其传入的namespace参数
 * @param {Function} fn
 * @return {Function}
 */
function normalizeNamespace(fn) {
    return function (namespace, map) {

        // 未传入命名空间时
        if (typeof namespace !== 'string') {

            //传入一个参数时
            map = namespace;
            namespace = '';

        // 确保其命名空间以/结尾
        } else if (namespace.charAt(namespace.length - 1) !== '/') {
            namespace += '/';
        }
        return fn(namespace, map)
    }
}
```

该函数的主要目的是处理传入函数的参数格式。另外还有一个格式化函数，将传入的对象类型或数组类型的值统一为多个对象组成的数组形式：

```js
function normalizeMap(map) {
    return Array.isArray(map) ?

        // 将其转化为多个对象组成的数组
        map.map(function (key) {
            return ({
                key: key,
                val: key
            });
        }) :
        Object.keys(map).map(function (key) {
            return ({
                key: key,
                val: map[key]
            });
        })
}
```

那么做好准备了，就正式开始吧！

## mapState()——辅助注册state/getter

该函数用于直接在`Vue`实例的`Computed`属性，接收两个参数，命名空间参数可选，如果指定了命名空间，那么第二个参数的值将会从命名空间中去获取，并且相应的`getter`也会发生范围上的变化！

```js
/**
 * Reduce the code which written in Vue.js for getting the state.
 * 将states中的属性变为getter属性
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} states # Object's item can be a function which accept state and getters for param, you can do something for state and getters in it.
 */
var mapState = normalizeNamespace(function (namespace, states) {
    var res = {};

    // 遍历state中属性, 为它们注册计算属性
    normalizeMap(states).forEach(function (ref) {
        var key = ref.key;
        var val = ref.val;

        res[key] = function mappedState() {

            // 取出全局state与getters
            var state = this.$store.state;
            var getters = this.$store.getters;

            // 有命名空间时,使用本地state与getters
            if (namespace) {

                // 直接通过命名空间取出对应的module
                var module = getModuleByNamespace(this.$store, 'mapState',namespace);
                if (!module) {
                    return
                }

                // 获取该module的state与getters
                state = module.context.state;
                getters = module.context.getters;
            }

            // 通过函数或字符串形式获取其值
            return typeof val === 'function' ?

                // 通过函数形式时，可以访问getters
                val.call(this, state, getters) :

                // 字符串仅能访问state
                state[val]
        };

        // mark vuex getter for devtools
        // 为devtools标记为vuexGetter
        res[key].vuex = true;
    });
    return res
});
```

这里要注意，如果我向使用`getter`上的值作为`computed`属性，那么则需要定义一个函数，通过参数来获取其`getter`的值。

## mapGetters()——直接获取取值器

该函数用于直接将`getter`转化为`computed`属性，具体实现过程比`mapState()`还简单，这里就不用解释了。

```js
/**
 * Reduce the code which written in Vue.js for getting the getters
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} getters
 * @return {Object}
 */
var mapGetters = normalizeNamespace(function (namespace, getters) {
    var res = {};
    normalizeMap(getters).forEach(function (ref) {
        var key = ref.key;
        var val = ref.val;

        // The namespace has been mutated by normalizeNamespace
        val = namespace + val;
        res[key] = function mappedGetter() {
            if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
                return
            }
            if (!(val in this.$store.getters)) {
                console.error(("[vuex] unknown getter: " + val));
                return
            }
            return this.$store.getters[val]
        };
        // mark vuex getter for devtools
        res[key].vuex = true;
    });
    return res
});
```

## mapAction()——快捷注册action函数

该方法呢就用于快捷注册`action`函数，对于有命名空间的部分呢，使用本地`dispatch()`函数进行注册：

```js
var mapActions = normalizeNamespace(function (namespace, actions) {
    var res = {};
    normalizeMap(actions).forEach(function (ref) {
        var key = ref.key;
        var val = ref.val;

        res[key] = function mappedAction() {
            var args = [],
                len = arguments.length;

            // 复制参数
            while (len--) args[len] = arguments[len];

            // 获取dispatch函数
            var dispatch = this.$store.dispatch;

            // 获取命名空间下的module
            if (namespace) {
                var module = getModuleByNamespace(this.$store, 'mapActions', namespace);
                if (!module) {
                    return
                }

                // 更新dispatch为本地提交
                dispatch = module.context.dispatch;
            }

            return typeof val === 'function' ?

                // 调用用户自定义的函数，传入dispatch方法与原有的参数
                val.apply(this, [dispatch].concat(args)) :

                // 直接调用dispatch方法，此时val为命名空间字符串
                dispatch.apply(this.$store, [val].concat(args))
        };
    });
    return res
});
```

## mapMutation()——快捷注册mutation函数

那么这个和上面的`action`函数相同，而且更简单：

```js
var mapMutations = normalizeNamespace(function (namespace, mutations) {
    var res = {};
    normalizeMap(mutations).forEach(function (ref) {
        var key = ref.key;

        // 提交的类型，或用户定义的函数
        var val = ref.val;

        res[key] = function mappedMutation() {
            var args = [],
                len = arguments.length;
            while (len--) args[len] = arguments[len];

            // Get the commit method from store
            var commit = this.$store.commit;
            if (namespace) {
                var module = getModuleByNamespace(this.$store, 'mapMutations', namespace);
                if (!module) {
                    return
                }
                commit = module.context.commit;
            }
            return typeof val === 'function' ?

                // 对于用户自定义函数，则传入commit
                val.apply(this, [commit].concat(args)) :

                // 否则直接帮用户调用
                commit.apply(this.$store, [val].concat(args))
        };
    });
    return res
});
```

## createNamespacedHelpers()——为某个命名空间创建全家桶

该方法用于为某个命名空间创建一个便利函数全家桶，直接进行挂载即可：

```js
var createNamespacedHelpers = function (namespace) {
    return ({
        mapState: mapState.bind(null, namespace),
        mapGetters: mapGetters.bind(null, namespace),
        mapMutations: mapMutations.bind(null, namespace),
        mapActions: mapActions.bind(null, namespace)
    });
};
```
