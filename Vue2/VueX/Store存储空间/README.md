# Store存储空间

在使用`Vue.use(Vuex)`后，我们还需要通过该构造函数来初始化一个`store`实例：

```js
new Vue({
    store: new Vuex.Store({})
});
```

那么这里我们来对这个`Store`构造函数的总体结构来进行了解下：

```js
var Store = function Store(options) {
    var this$1 = this;

    // 初始化配置，这里就是我们在最初传入的配置
    if (options === void 0) options = {};

    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    // window上挂载有Vue时自动注册
    // 当要避免自动注册时, 应该改动这里
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

    // 声明一个vm实例，用来进行响应式更新
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
```

那么整个`Store`就是这么的复杂，但总体也可以细分为四步：

1. 注册全部`module`
2. 为`module`们注册它们自己的各种属性
3. 将数据绑定到`vm`实例上
4. 插件安装

那么废话不多说，就按这四步来具体看看：

## 注册全部module

那么在之前的所有变量初始化我们就不要关心了，具体的我也写在注释里面了，这里我们具体来了解下这段代码，它表示从根`module`开始，将其他`module`注册在其产生的树形结构上：

```js
//存放modules收集器, 遍历options并注册所有子module
this._modules = new ModuleCollection(options);
```

那么具体这个构造函数的实例化就另外在[其他地方](../ModuleCollection模块集合管理/README.md)写了。

## 为module注册各种属性

在第二步中，VueX通过[`installModule()`](../Module模块/README.md#%e6%a8%a1%e5%9d%97%e4%b8%8a%e7%9a%84%e5%b1%9e%e6%80%a7%e6%b3%a8%e5%86%8cinstallmodule)来为每个`module`注册它们各自的全部属性：

```js
// 注册根module的各种属性，然后递归注册子module的
installModule(this, state, [], this._modules.root);
```

注册完后，我们还有件事，就是还没有将这些属性响应式化，所以此时我们调用`resetStoreVM()`来进行响应式化。

## 将数据绑定到`vm`实例上

它归功于`resetStoreVM()`，当然它还是通过一个`vm`实例来实现：

```js
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
```

那么上面也没有什么可以解释的，主要就说明下`enableStrictMode()`开启严格模式的原理，该函数具体为：

```js
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
```

这里我们就可以看到，通过`$watch api`，它会在`store.state`修改且严格模式开启时，如果没满足`assert()`函数的第一个参数，就会触发断言，配合它的还有[下面](#storeprototypewithcommit%e6%a0%87%e5%87%86%e6%8f%90%e4%ba%a4)的这个函数。

那么此时你可能会有**疑问**，`watch`这玩意儿不是异步更新吗，即使我们使用`__withCommit()`函数应该也是在微任务阶段更新，那时`._committing`的值早已还原了啊，就会导致报错。这个疑问是没错的，一般情况情况下应该就是这样，但是这里大家注意调用`watch api`时传入的配置中含有一个`sync: true`，这玩意儿虽然在`Vue`库中没有使用到且在文档中并没有记录，但这里使用到了，它表示`watch`的更新**不通过刷新队列更新，而是直接同步直接更新**。所以才能保持上面的断言不会出错。
____
这里就不说插件的安装了，就是调用插件函数并传入`store`实例

### Store.prototype.__withCommit()——标准提交

还记得实例化`Store`对象时的`strict`配置吗，该函数就用于来配合它完成是否通过`commit()`函数的提交。待会我们就会看到在`vm`实例进行响应式变化时，`VueX`会注册一个`watch`用于断言，它会监听`state`，当`_committing`的值为`false`，如果我们更新`state`就会引起错误，但当我们通过该高阶函数来更新时，`_committing`的值会暂时变为`true`来允许我们更新。

```js
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
```

虽然以上行为都是同步的，但是我们知道`watch`是异步触发的，但是也不是不能配置为同步触发，所以就能实现上面的逻辑，我在上面有具体讲到。
