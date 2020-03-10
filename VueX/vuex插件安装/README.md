# vuex插件安装

我们都知道`VueX`是通过以下方式来进行注册的：

```js
import Vuex from 'vuex'
import Vue from 'vue'

Vue.use(Vuex)

new Vue({
    store: new Vuex.Store({})
});
```

对于`Vue.use()`相信大家并不陌生，它会对传入的函数或对象进行安装，具体就是对传入的对象调用其`install()`方法；或者对传入的函数直接进行：

```js
//Vue.use本质执行了自己定义的install方法,参数为传入插件之后的其他参数
Vue.use = function (plugin) {
    var installedPlugins = (this._installedPlugins || (this._installedPlugins = []));

    if (installedPlugins.indexOf(plugin) > -1) {
        //已安装直接返回
        return this
    }

    // additional parameters
    //将参数存入新数组, 并将Vue实例作为作为第一个参数加入数组
    var args = toArray(arguments, 1);
    args.unshift(this);

    // 优先调用该插件中的install方法
    if (typeof plugin.install === 'function') {
        plugin.install.apply(plugin, args);
    } else if (typeof plugin === 'function') {
        plugin.apply(null, args);
    }
    installedPlugins.push(plugin);
    return this
};
```

那么在我们的`VueX`中，对应的`install()`方法就如下：

```js
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

   // 调用applyMixin()方法向Vue注册全局的mixin函数
    applyMixin(Vue);
}
```

那么对于具体的`applyMixin()`函数如下：

```js
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
}
```

这里我们可以看到该方法就是向`beforeCreate()`生命周期中添加一个初始化的钩子函数`vuexInit()`，该函数的主要作用是，为每个`vm`实例添加`vuex`的`store`对象，对于每个组件基本上有以下规则：

- 使用自身组件配置中的`store`
- 使用父级的`store`

由于这个原因，就使得我们每一个`vm`实例访问的`store`都是同一个！

```js
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
```

那么到目前为止，插件的安装就结束了，这里总结下：

- 注册一个`beforeCreate()`函数到全局的`Vue`构造函数上
