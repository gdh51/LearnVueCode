/**
 * vuex v3.1.1
 * (c) 2019 Evan You
 * @license MIT
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
        (global = global || self, global.Vuex = factory());
}(this, function () {
    'use strict';

    function applyMixin(Vue) {
        var version = Number(Vue.version.split('.')[0]);

        //针对Vue版本做了不同的处理
        //当Vue版本大于2时, 将vueinit()混入beforeCreate钩子函数中
        if (version >= 2) {
            Vue.mixin({
                beforeCreate: vuexInit
            });

        } else {
            // 重写_init()方法,并将vueinit()放入配置属性中
            // 1.x版本向后兼容
            var _init = Vue.prototype._init;
            Vue.prototype._init = function (options) {
                if (options === void 0) options = {};

                //将vuexInit添加到options.init属性中
                options.init = options.init ? [vuexInit].concat(options.init) : vuexInit;
                _init.call(this, options);
            };
        }

        /**
         * Vuex init hook, injected into each instances init hooks list.
         * Vuex初始化钩子函数,将其注入到每个Vue实例中,且保证公用一个store,
         * 挂载到每个Vue实例的$store属性上
         */

        function vuexInit() {
            var options = this.$options;

            // 注入store, 存在store属性时表示root节点,直接根据store类型进行使用
            // 这里是对根节点的注册，因为我们将store挂载到了根节点的options上的
            if (options.store) {
                this.$store =
                    typeof options.store === 'function' ? options.store() : options.store;

            // 对于非根节点，我们将获取其父节点上的$store，层层递归，相当于获取根节点上的
            } else if (options.parent && options.parent.$store) {
                this.$store = options.parent.$store;
            }
        }
    }

    var target = typeof window !== 'undefined' ?
        window :
        typeof global !== 'undefined' ?
        global : {};
    var devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__;

    function devtoolPlugin(store) {
        if (!devtoolHook) {
            return
        }

        store._devtoolHook = devtoolHook;

        devtoolHook.emit('vuex:init', store);

        devtoolHook.on('vuex:travel-to-state', function (targetState) {
            store.replaceState(targetState);
        });

        store.subscribe(function (mutation, state) {
            devtoolHook.emit('vuex:mutation', mutation, state);
        });
    }

    /**
     * Get the first item that pass the test
     * by second argument function
     *
     * @param {Array} list
     * @param {Function} f
     * @return {*}
     */

    /**
     * forEach for object
     */
    function forEachValue(obj, fn) {
        Object.keys(obj).forEach(function (key) {
            return fn(obj[key], key);
        });
    }

    function isObject(obj) {
        return obj !== null && typeof obj === 'object'
    }

    function isPromise(val) {
        return val && typeof val.then === 'function'
    }

    function assert(condition, msg) {
        if (!condition) {
            throw new Error(("[vuex] " + msg))
        }
    }

    function partial(fn, arg) {
        return function () {
            return fn(arg)
        }
    }

    // Base data struct for store's module, package with some attribute and method
    // 每个module的基础数据结构，用一些属性和方法包装
    var Module = function Module(rawModule, runtime) {
        this.runtime = runtime;

        //存储子module
        this._children = Object.create(null);

        // 存储该module的原始配置对象
        this._rawModule = rawModule;

        // 获取该module的state
        var rawState = rawModule.state;

        // 根据其state的类型，进行不同的初始化
        this.state = (typeof rawState === 'function' ? rawState() : rawState) || {};
    };

    var prototypeAccessors = {
        namespaced: {
            configurable: true
        }
    };

    prototypeAccessors.namespaced.get = function () {
        return !!this._rawModule.namespaced
    };

    //添加一个module
    Module.prototype.addChild = function addChild(key, module) {
        this._children[key] = module;
    };

    Module.prototype.removeChild = function removeChild(key) {
        delete this._children[key];
    };

    //返回子module中值为key的module
    Module.prototype.getChild = function getChild(key) {
        return this._children[key]
    };

    Module.prototype.update = function update(rawModule) {
        this._rawModule.namespaced = rawModule.namespaced;
        if (rawModule.actions) {
            this._rawModule.actions = rawModule.actions;
        }
        if (rawModule.mutations) {
            this._rawModule.mutations = rawModule.mutations;
        }
        if (rawModule.getters) {
            this._rawModule.getters = rawModule.getters;
        }
    };

    Module.prototype.forEachChild = function forEachChild(fn) {
        forEachValue(this._children, fn);
    };

    Module.prototype.forEachGetter = function forEachGetter(fn) {
        if (this._rawModule.getters) {
            forEachValue(this._rawModule.getters, fn);
        }
    };

    Module.prototype.forEachAction = function forEachAction(fn) {
        if (this._rawModule.actions) {
            forEachValue(this._rawModule.actions, fn);
        }
    };

    Module.prototype.forEachMutation = function forEachMutation(fn) {

        // 获取其原始配置中的mutations函数
        if (this._rawModule.mutations) {

            // 调用对象版本的forEach
            forEachValue(this._rawModule.mutations, fn);
        }
    };

    Object.defineProperties(Module.prototype, prototypeAccessors);

    var ModuleCollection = function ModuleCollection(rawRootModule) {
        /**
         * 在该实例root属性上挂载module, 并遍历创建所有子module, 大约是这个样子:
         * root.moduleA => moduleA._children.moduleB =>
         * moduleB._children.moduleC
         */
        this.register([], rawRootModule, false);
    };

    //查找对应path的module
    ModuleCollection.prototype.get = function get(path) {

        // 从根module开始查找指定path下的module
        return path.reduce(function (module, key) {
            return module.getChild(key)
        }, this.root)
    };;

    ModuleCollection.prototype.getNamespace = function getNamespace(path) {

        // 获取根module
        var module = this.root;

        // 将返回当前path的命名空间版本
        return path.reduce(function (namespace, key) {

            //获取对应key的module，查看其是否定义namespaced字段
            module = module.getChild(key);

            // 对于使用了命名空间的module，要为其附带上其路径名称
            return namespace + (module.namespaced ? key + '/' : '')
        }, '')
    };

    ModuleCollection.prototype.update = function update$1(rawRootModule) {
        update([], this.root, rawRootModule);
    };

    ModuleCollection.prototype.register = function register(path, rawModule, runtime) {
        var this$1 = this;

        //未传参数时默认为true
        if (runtime === void 0) runtime = true;

        //检查Module的各属性值是否是正确的数据类型
        {
            assertRawModule(path, rawModule);
        }

        // 为当前的module创建一个单独的Module对象，存储其module配置
        var newModule = new Module(rawModule, runtime);

        //当为顶层module时, 在该顶层modul的root属性挂载该module
        if (path.length === 0) {
            this.root = newModule;
        } else {

            //不是顶层module时,找到该module的父级module,并添加在父级module的_children中
            var parent = this.get(path.slice(0, -1));
            parent.addChild(path[path.length - 1], newModule);
        }

        // 有还存在子modules属性,则遍历path在moduleCollection上注册所有嵌套的module
        if (rawModule.modules) {

            // forEachValue可以理解为对象版本的forEach遍历
            forEachValue(rawModule.modules, function (rawChildModule, key) {
                this$1.register(path.concat(key), rawChildModule, runtime);
            });
        }
    };

    ModuleCollection.prototype.unregister = function unregister(path) {
        //查找到父模块位置,移除父模块中_children对应的模块
        var parent = this.get(path.slice(0, -1));
        var key = path[path.length - 1];
        if (!parent.getChild(key).runtime) {
            return
        }

        parent.removeChild(key);
    };

    function update(path, targetModule, newModule) {
        {
            assertRawModule(path, newModule);
        }

        // update target module
        targetModule.update(newModule);

        // update nested modules
        if (newModule.modules) {
            for (var key in newModule.modules) {
                if (!targetModule.getChild(key)) {
                    {
                        console.warn(
                            "[vuex] trying to add a new module '" + key + "' on hot reloading, " +
                            'manual reload is needed'
                        );
                    }
                    return
                }
                update(
                    path.concat(key),
                    targetModule.getChild(key),
                    newModule.modules[key]
                );
            }
        }
    }

    var functionAssert = {
        assert: function (value) {
            return typeof value === 'function';
        },
        expected: 'function'
    };

    var objectAssert = {
        assert: function (value) {
            return typeof value === 'function' ||
                (typeof value === 'object' && typeof value.handler === 'function');
        },
        expected: 'function or object with "handler" function'
    };

    var assertTypes = {
        getters: functionAssert,
        mutations: functionAssert,
        actions: objectAssert
    };

    function assertRawModule(path, rawModule) {
        Object.keys(assertTypes).forEach(function (key) {
            if (!rawModule[key]) {
                return
            }

            var assertOptions = assertTypes[key];

            forEachValue(rawModule[key], function (value, type) {
                assert(
                    assertOptions.assert(value),
                    makeAssertionMessage(path, key, type, value, assertOptions.expected)
                );
            });
        });
    }

    function makeAssertionMessage(path, key, type, value, expected) {
        var buf = key + " should be " + expected + " but \"" + key + "." + type + "\"";
        if (path.length > 0) {
            buf += " in module \"" + (path.join('.')) + "\"";
        }
        buf += " is " + (JSON.stringify(value)) + ".";
        return buf
    }

    var Vue; // bind on install

    var Store = function Store(options) {
        var this$1 = this;

        // 初始化配置，这里就是我们在最初传入的配置
        if (options === void 0) options = {};

        // Auto install if it is not done yet and `window` has `Vue`.
        // To allow users to avoid auto-installation in some cases,
        // this code should be placed here. See #731
        //window上挂载有Vue时自动注册
        //当要避免自动注册时, 应该改动这里
        if (!Vue && typeof window !== 'undefined' && window.Vue) {
            install(window.Vue);
        }

        // 断言，检测错误
        {
            assert(Vue, "must call Vue.use(Vuex) before creating a store instance.");
            assert(typeof Promise !== 'undefined', "vuex requires a Promise polyfill in this browser.");
            assert(this instanceof Store, "store must be called with the new operator.");
        }

        //初始化插件与严格模式,默认关闭严格模式
        var plugins = options.plugins;
        if (plugins === void 0) plugins = [];
        var strict = options.strict;
        if (strict === void 0) strict = false;

        // store internal state
        // 实例内部状态

        // 用来判断严格模式下是否用 mutation来修改state
        this._committing = false;

        // 存放actions
        this._actions = Object.create(null);

        //存放action订阅者
        this._actionSubscribers = [];

        //存放mutations
        this._mutations = Object.create(null);

        //存放getter
        this._wrappedGetters = Object.create(null);

        //存放modules收集器, 遍历options并注册所有子module
        this._modules = new ModuleCollection(options);

        //根据命名空间存放module
        this._modulesNamespaceMap = Object.create(null);

        //存放订阅者
        this._subscribers = [];

        // 声明一个vm实例，用来监听getter的返回值
        this._watcherVM = new Vue();

        // bind commit and dispatch to self
        //绑定commit()与dispatch()至store实例, 绑定this至该store实例
        var store = this;
        var ref = this;
        var dispatch = ref.dispatch;
        var commit = ref.commit;

        // 绑定两个提交函数的this至store
        this.dispatch = function boundDispatch(type, payload) {
            return dispatch.call(store, type, payload)
        };
        this.commit = function boundCommit(type, payload, options) {
            return commit.call(store, type, payload, options)
        };

        // strict mode
        // 是否开启严格模式
        this.strict = strict;

        // 获取顶级module的state对象
        var state = this._modules.root.state;


        // 注册根module的各种属性，然后递归注册子module的
        installModule(this, state, [], this._modules.root);

        //初始化store的vue实例, 给state注册响应式计算,并将_wrappedGetters注册为计算属性
        resetStoreVM(this, state);

        // 调用插件
        plugins.forEach(function (plugin) {
            return plugin(this$1);
        });

        // 安装插件
        var useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools;
        if (useDevtools) {
            devtoolPlugin(this);
        }
    };

    var prototypeAccessors$1 = {
        state: {
            configurable: true
        }
    };

    prototypeAccessors$1.state.get = function () {
        return this._vm._data.$$state
    };

    prototypeAccessors$1.state.set = function (v) {
        {
            assert(false, "use store.replaceState() to explicit replace store state.");
        }
    };

    // mutation函数,用来更改state状态
    Store.prototype.commit = function commit(_type, _payload, _options) {
        var this$1 = this;

        // check object-style commit
        //检查参数并同一格式
        var ref = unifyObjectStyle(_type, _payload, _options);
        var type = ref.type;
        var payload = ref.payload;
        var options = ref.options;

        //在没有命名空间时,取出对应名称的mutation数组,遍历执行其函数
        var mutation = {
            type: type,
            payload: payload
        };
        var entry = this._mutations[type];
        if (!entry) {
            {
                console.error(("[vuex] unknown mutation type: " + type));
            }
            return
        }

        //暂时切换为允许修改state, 在函数执行完后切换为设置的strict状态
        this._withCommit(function () {
            entry.forEach(function commitIterator(handler) {
                handler(payload);
            });
        });

        //通知所有订阅者
        this._subscribers.forEach(function (sub) {
            return sub(mutation, this$1.state);
        });

        if (
            options && options.silent
        ) {
            console.warn(
                "[vuex] mutation type: " + type + ". Silent option has been removed. " +
                'Use the filter functionality in the vue-devtools'
            );
        }
    };

    // 初始的dispatch函数
    Store.prototype.dispatch = function dispatch(_type, _payload) {
        var this$1 = this;

        // 检查参数并统一为对象格式
        var ref = unifyObjectStyle(_type, _payload);

        // 获取dispatch的action名称
        var type = ref.type;
        var payload = ref.payload;

        var action = {
            type: type,
            payload: payload
        };

        // 获取该对应的actions函数
        var entry = this._actions[type];
        if (!entry) {
            {
                console.error(("[vuex] unknown action type: " + type));
            }
            return
        }

        // 在执行该action函数前，先调用观察它的订阅者们的before钩子函数
        try {
            this._actionSubscribers
                .filter(function (sub) {
                    return sub.before;
                })
                .forEach(function (sub) {
                    return sub.before(action, this$1.state);
                });
        } catch (e) {
            {
                console.warn("[vuex] error in before action subscribers: ");
                console.error(e);
            }
        }

        // 触发所有action回调函数
        var result = entry.length > 1 ?
            Promise.all(entry.map(function (handler) {
                return handler(payload);
            })) :
            entry[0](payload);

        //在state改变后执行所有订阅者的的after函数
        return result.then(function (res) {
            try {
                this$1._actionSubscribers
                    .filter(function (sub) {
                        return sub.after;
                    })
                    .forEach(function (sub) {
                        return sub.after(action, this$1.state);
                    });
            } catch (e) {
                {
                    console.warn("[vuex] error in after action subscribers: ");
                    console.error(e);
                }
            }
            return res;
        })
    };

    Store.prototype.subscribe = function subscribe(fn) {
        return genericSubscribe(fn, this._subscribers)
    };

    Store.prototype.subscribeAction = function subscribeAction(fn) {
        var subs = typeof fn === 'function' ? {
            before: fn
        } : fn;
        return genericSubscribe(subs, this._actionSubscribers)
    };

    // 该函数可以理解为Store版本的watch函数，且其只接收函数作为键名
    Store.prototype.watch = function watch(getter, cb, options) {
        var this$1 = this;

        // 要监控的getter必须为函数
        {
            assert(typeof getter === 'function', "store.watch only accepts a function.");
        }

        // 监听getter返回值的变化
        return this._watcherVM.$watch(function () {
            return getter(this$1.state, this$1.getters);
        }, cb, options)
    };

    Store.prototype.replaceState = function replaceState(state) {
        var this$1 = this;

        this._withCommit(function () {
            this$1._vm._data.$$state = state;
        });
    };

    //在path路径动态新注册一个module
    Store.prototype.registerModule = function registerModule(path, rawModule, options) {
        if (options === void 0) options = {};

        // path统一为数组
        if (typeof path === 'string') {
            path = [path];
        }

        // 不能在根module上注册
        {
            assert(Array.isArray(path), "module path must be a string or an Array.");
            assert(path.length > 0, 'cannot register the root module by using registerModule.');
        }

        // 在moduleCollection上注册该module的原始信息
        this._modules.register(path, rawModule);

        // 注册该module的各种属性
        installModule(this, this.state, path, this._modules.get(path), options.preserveState);

        // reset store to update getters...
        // 通过新建vue实例重设store,并注册响应式属性
        resetStoreVM(this, this.state);
    };

    //动态注销模块
    Store.prototype.unregisterModule = function unregisterModule(path) {
        var this$1 = this;

        //同样的path转换为数组
        if (typeof path === 'string') {
            path = [path];
        }

        {
            assert(Array.isArray(path), "module path must be a string or an Array.");
        }

        //移除模块对象中的模块
        this._modules.unregister(path);

        //获取对应的state并删除
        this._withCommit(function () {
            var parentState = getNestedState(this$1.state, path.slice(0, -1));

            // 删除对应的state
            Vue.delete(parentState, path[path.length - 1]);
        });

        // 重制store, 更新state
        resetStore(this);
    };

    Store.prototype.hotUpdate = function hotUpdate(newOptions) {
        this._modules.update(newOptions);
        resetStore(this, true);
    };

    //在执行回调函数时, 开起严格模式
    Store.prototype._withCommit = function _withCommit(fn) {

        // 获取初始设置的strict模式的值
        var committing = this._committing;

        // 暂时允许更新state
        this._committing = true;
        fn();

        // 还原其设置的值
        this._committing = committing;
    };

    Object.defineProperties(Store.prototype, prototypeAccessors$1);

    function genericSubscribe(fn, subs) {

        //函数不存在时就push进入订阅者队列
        if (subs.indexOf(fn) < 0) {
            subs.push(fn);
        }

        //返回一个函数用于取消订阅
        return function () {
            var i = subs.indexOf(fn);
            if (i > -1) {
                subs.splice(i, 1);
            }
        }
    }

    function resetStore(store, hot) {
        //初始化其他属性
        store._actions = Object.create(null);
        store._mutations = Object.create(null);
        store._wrappedGetters = Object.create(null);
        store._modulesNamespaceMap = Object.create(null);
        var state = store.state;

        // 重新注册所有module
        installModule(store, state, [], store._modules.root, true);

        // 重置store, 设置响应属性
        resetStoreVM(store, state, hot);
    }


    // 将store.state注册为响应式, 同时注册getter为computed属性
    function resetStoreVM(store, state, hot) {

        // 获取当前store的vm实例
        var oldVm = store._vm;

        // 将getters代理到该对象中
        store.getters = {};
        var wrappedGetters = store._wrappedGetters;
        var computed = {};

        // 代理getters中函数
        forEachValue(wrappedGetters, function (fn, key) {

            // use computed to leverage its lazy-caching mechanism
            // direct inline function use will lead to closure preserving oldVm.
            // using partial to return function with only arguments preserved in closure enviroment.
            //用闭包保存固定的store,并缓存
            computed[key] = partial(fn, store);

            //通过给store.getters定义get()函数来获取vue实例上对应的响应式属性
            Object.defineProperty(store.getters, key, {
                get: function () {
                    return store._vm[key];
                },
                enumerable: true // for local getters
            });
        });

        // use a Vue instance to store the state tree
        // suppress warnings just in case the user has added
        // some funky global mixins
        // 使用一个Vue实例去存储这些state与getter
        // 暂时开启报警，防止用户整幺蛾子
        var silent = Vue.config.silent;
        Vue.config.silent = true;
        store._vm = new Vue({
            data: {
                $$state: state
            },
            computed: computed
        });

        // 还原原始配置
        Vue.config.silent = silent;

        // enable strict mode for new vm
        // 为新的vm实例开启严格模式
        if (store.strict) {
            enableStrictMode(store);
        }

        // 如果存在旧的vm实例
        if (oldVm) {

            // 解除旧vm的state的引用并销毁旧vm实例
            if (hot) {

                // dispatch changes in all subscribed watchers
                // to force getter re-evaluation for hot reloading.
                store._withCommit(function () {
                    oldVm._data.$$state = null;
                });
            }

            // 销毁它
            Vue.nextTick(function () {
                return oldVm.$destroy();
            });
        }
    }

    //在store中注册所有actions/mutations/getter/state
    /**
     * @param {Object} store store实例
     * @param {Object} rootState 根module的state对象
     * @param {Array} path 当前module的path数组
     * @param {Object} module 当前的module
     * @param {Boolean} hot 热更新？
     */
    function installModule(store, rootState, path, module, hot) {

        // 是否为根module(根module的path为空数组)
        var isRoot = !path.length;

        // 获取当前module的命名空间字符串(仅在其与其祖先module标记了namespace属性情况下使用)
        var namespace = store._modules.getNamespace(path);

        // 当该module有命名空间时,将对应的module挂载在命名空间map的对应位置
        if (module.namespaced) {
            store._modulesNamespaceMap[namespace] = module;
        }

        // 非根module且为热更新时
        // 在父级state中以module名称的形式挂载子module的state
        if (!isRoot && !hot) {

            // 获取其父级module的state
            var parentState = getNestedState(rootState, path.slice(0, -1));

            // 获取当前module的名称
            var moduleName = path[path.length - 1];

            // 这里起始在初始化时没有必要在该函数中提交
            store._withCommit(function () {

                // 在指定vm实例上指定module的state上挂载当前module的state
                Vue.set(parentState, moduleName, module.state);
            });
        }

        // 为当前的module定义上下文对象，主要是规定其module中挂载的属性的访问方式
        var local = module.context = makeLocalContext(store, namespace, path);

        // 遍历当前module的mutation函数，在store上注册
        // 当前有命名空间的其名称要加上命名空间
        module.forEachMutation(function (mutation, key) {

            // 为其mutation的名称添加命名空间
            var namespacedType = namespace + key;

            // 在store上注册该mutation函数
            registerMutation(store, namespacedType, mutation, local);
        });

        // 遍历注册当前module的action函数
        // 当前有命名空间的其名称要加上命名空间
        module.forEachAction(function (action, key) {
            var type = action.root ? key : namespace + key;
            var handler = action.handler || action;
            registerAction(store, type, handler, local);
        });

        // 遍历注册当前module的getter函数在，将其注册在store中
        // 有命名空间要附带命名空间
        module.forEachGetter(function (getter, key) {
            var namespacedType = namespace + key;
            registerGetter(store, namespacedType, getter, local);
        });

        // 在根state上挂载全部子state
        module.forEachChild(function (child, key) {
            installModule(store, rootState, path.concat(key), child, hot);
        });
    }

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

    //在store._mutations上挂载当前module的mutation函数
    function registerMutation(store, type, handler, local) {

        // 初始化该mutation名称的回调函数数组
        var entry = store._mutations[type] || (store._mutations[type] = []);

        // 通过wrappedMutationHandler封装，主要是重定义其传入的参数
        entry.push(function wrappedMutationHandler(payload) {

            //this绑定至store实例，并传入当前module的state
            handler.call(store, local.state, payload);
        });
    }

    //注册actions,并包装该action函数, 参入store接口作为实参
    function registerAction(store, type, handler, local) {

        // 初始化，或取出对应类型的action回调数组
        var entry = store._actions[type] || (store._actions[type] = []);

        // 包装action函数, 所以我们在执行dispatch时能从第一个参数获取该module的信息
        entry.push(function wrappedActionHandler(payload, cb) {

            // 传入各种信息，任你使用
            var res = handler.call(store, {
                dispatch: local.dispatch,
                commit: local.commit,
                getters: local.getters,
                state: local.state,
                rootGetters: store.getters,
                rootState: store.state
            }, payload, cb);

            // 如果无返回值或返回值不是promise，则直接resolve
            if (!isPromise(res)) {
                res = Promise.resolve(res);
            }

            // 存在devtool插件的时候捕获错误
            if (store._devtoolHook) {
                return res.catch(function (err) {
                    store._devtoolHook.emit('vuex:error', err);
                    throw err
                });
            } else {
                return res
            }
        });
    }

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

    //允许严格模式, 该模式下state只能通过mutation改变
    function enableStrictMode(store) {
        store._vm.$watch(function () {
            return this._data.$$state
        }, function () {
            {
                assert(store._committing, "do not mutate vuex store state outside mutation handlers.");
            }
        }, {
            deep: true,
            sync: true
        });
    }

    // 从state开始，返回指定path路径下的state
    function getNestedState(state, path) {
        return path.length ?
            path.reduce(function (state, key) {
                return state[key];
            }, state) :
            state;
    }

    function unifyObjectStyle(type, payload, options) {
        //当传入一个对象作为参数时, 统一为对象格式
        if (isObject(type) && type.type) {
            options = payload;
            payload = type;
            type = type.type;
        }

        {
            assert(typeof type === 'string', ("expects string as the type, but found " + (typeof type) + "."));
        }

        return {
            type: type,
            payload: payload,
            options: options
        }
    }

    function install(_Vue) {
        if (Vue && _Vue === Vue) {
            {
                console.error(
                    '[vuex] already installed. Vue.use(Vuex) should be called only once.'
                );
            }
            return
        }
        Vue = _Vue;
        applyMixin(Vue);
    }

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
                    var module = getModuleByNamespace(this.$store, 'mapState', namespace);
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

    /**
     * Reduce the code which written in Vue.js for committing the mutation
     * @param {String} [namespace] - Module's namespace
     * @param {Object|Array} mutations # Object's item can be a function which accept `commit` function as the first param, it can accept anthor params. You can commit mutation and do any other things in this function. specially, You need to pass anthor params from the mapped function.
     * @return {Object}
     */
    var mapMutations = normalizeNamespace(function (namespace, mutations) {
        var res = {};
        normalizeMap(mutations).forEach(function (ref) {
            var key = ref.key;
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

    /**
     * Reduce the code which written in Vue.js for dispatch the action
     * @param {String} [namespace] - Module's namespace
     * @param {Object|Array} actions # Object's item can be a function which accept `dispatch` function as the first param, it can accept anthor params. You can dispatch action and do any other things in this function. specially, You need to pass anthor params from the mapped function.
     * @return {Object}
     */
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

    /**
     * Rebinding namespace param for mapXXX function in special scoped, and return them by simple object
     * @param {String} namespace
     * @return {Object}
     */
    var createNamespacedHelpers = function (namespace) {
        return ({
            mapState: mapState.bind(null, namespace),
            mapGetters: mapGetters.bind(null, namespace),
            mapMutations: mapMutations.bind(null, namespace),
            mapActions: mapActions.bind(null, namespace)
        });
    };

    /**
     * Normalize the map , 统一map参数为以下格式
     * normalizeMap([1, 2, 3]) => [ { key: 1, val: 1 }, { key: 2, val: 2 }, { key: 3, val: 3 } ]
     * normalizeMap({a: 1, b: 2, c: 3}) => [ { key: 'a', val: 1 }, { key: 'b', val: 2 }, { key: 'c', val: 3 } ]
     * @param {Array|Object} map
     * @return {Object}
     */
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

    /**
     * Search a special module from store by namespace. if module not exist, print error message.
     * 在module MAP中查找该命名空间的module, 未找到时报错
     * @param {Object} store
     * @param {String} helper
     * @param {String} namespace
     * @return {Object}
     */
    function getModuleByNamespace(store, helper, namespace) {

        // 从map中取出对应的module
        var module = store._modulesNamespaceMap[namespace];
        if (!module) {
            console.error(("[vuex] module namespace not found in " + helper + "(): " + namespace));
        }
        return module
    }

    var index = {
        Store: Store,
        install: install,
        version: '3.1.1',
        mapState: mapState,
        mapMutations: mapMutations,
        mapGetters: mapGetters,
        mapActions: mapActions,
        createNamespacedHelpers: createNamespacedHelpers
    };

    return index;

}));