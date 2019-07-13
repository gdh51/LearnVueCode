# VueX

源码解读

我们知道(你可能也不知道)Vue 通过 Vue.use(plugin)来安装插件, 实质是执行 plugin 上的 install()方法, 所以我们先从它开始看起

## install()

```js
function install(_Vue) {
  /**
   * 检查是否存在Vue构造函数与是否以安装该插件,
   * 因为Vue(vuex内部变量)会在安装后赋值给_Vue(传入的Vue构造函数)
   */
  if (Vue && _Vue === Vue) {
    {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      );
    }
    return;
  }

  //挂载Vue构造函数至内部Vue变量
  Vue = _Vue;

  //将vuex初始化函数混入vue构造函数中,详情见下
  applyMixin(Vue);
}
```

关于`applyMixin(Vue)`,目的是将初始化 Vuex 逻辑注入到 Vue 构造函数中

### applyMixin()

```js
function applyMixin(Vue) {
  var version = Number(Vue.version.split('.')[0]);

  //针对Vue版本做了不同的处理
  //当Vue版本大于2时, 将vueinit()混入beforeCreate钩子函数中
  if (version >= 2) {
    Vue.mixin({ beforeCreate: vuexInit });
  } else {
    // 重写_init()方法,并将vueinit()放入配置属性中
    // 1.x版本向后兼容
    var _init = Vue.prototype._init;
    Vue.prototype._init = function(options) {
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
    // 注入store, 存在store属性时表示ROOT节点,直接根据store类型进行使用
    if (options.store) {
      this.$store =
        typeof options.store === 'function' ? options.store() : options.store;

      //不存在该属性时表示子节点,从父组件中获取同一个store
    } else if (options.parent && options.parent.$store) {
      this.$store = options.parent.$store;
    }
  }
}
```

## Store 构造函数

```js
var Store = function Store(options) {
  var this$1 = this;
  if (options === void 0) options = {};

  // Auto install if it is not done yet and `window` has `Vue`.
  // To allow users to avoid auto-installation in some cases,
  // this code should be placed here. See #731
  //window上挂载有Vue时自动注册
  //当要避免自动注册时, 应该改动这里
  if (!Vue && typeof window !== 'undefined' && window.Vue) {
    install(window.Vue);
  }

  {
    assert(Vue, 'must call Vue.use(Vuex) before creating a store instance.');
    assert(
      typeof Promise !== 'undefined',
      'vuex requires a Promise polyfill in this browser.'
    );
    assert(
      this instanceof Store,
      'store must be called with the new operator.'
    );
  }

  var plugins = options.plugins;
  if (plugins === void 0) plugins = [];
  var strict = options.strict;
  if (strict === void 0) strict = false;

  // store internal state
  this._committing = false;
  this._actions = Object.create(null);
  this._actionSubscribers = [];
  this._mutations = Object.create(null);
  this._wrappedGetters = Object.create(null);
  this._modules = new ModuleCollection(options);
  this._modulesNamespaceMap = Object.create(null);
  this._subscribers = [];
  this._watcherVM = new Vue();

  // bind commit and dispatch to self
  var store = this;
  var ref = this;
  var dispatch = ref.dispatch;
  var commit = ref.commit;
  this.dispatch = function boundDispatch(type, payload) {
    return dispatch.call(store, type, payload);
  };
  this.commit = function boundCommit(type, payload, options) {
    return commit.call(store, type, payload, options);
  };

  // strict mode
  this.strict = strict;

  var state = this._modules.root.state;

  // init root module.
  // this also recursively registers all sub-modules
  // and collects all module getters inside this._wrappedGetters
  installModule(this, state, [], this._modules.root);

  // initialize the store vm, which is responsible for the reactivity
  // (also registers _wrappedGetters as computed properties)
  resetStoreVM(this, state);

  // apply plugins
  plugins.forEach(function(plugin) {
    return plugin(this$1);
  });

  var useDevtools =
    options.devtools !== undefined ? options.devtools : Vue.config.devtools;
  if (useDevtools) {
    devtoolPlugin(this);
  }
};
```

```js

```

这里介绍的比较多,按顺序依次介绍

### ModuleCollection 构造函数

Vuex 中通过该函数

```js
var ModuleCollection = function ModuleCollection(rawRootModule) {
  // register root module (Vuex.Store options)
  this.register([], rawRootModule, false);
};
```

#### util —— assertRawModule()
这是一个工具方法, 用来判断Module中属性值是否是正确的类型, 代码如下
```js
//先跳过这个函数, 在该代码段末尾回头在看
function assert(condition, msg) {
  if (!condition) {
    throw new Error('[vuex] ' + msg);
  }
}

//下面三个断言函数用于错误提示
var functionAssert = {
  assert: function(value) {
    return typeof value === 'function';
  },
  expected: 'function'
};

var objectAssert = {
  assert: function(value) {
    return (
      typeof value === 'function' ||
      (typeof value === 'object' && typeof value.handler === 'function')
    );
  },
  expected: 'function or object with "handler" function'
};

//对应的Module属性, 以及它们用来判断的函数
var assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
};

//判断Module属性值类型是否正确
function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach(function(key) {
    if (!rawModule[key]) {
      return;
    }

    var assertOptions = assertTypes[key];

    //检测getter、mutations、actions是否为对应的数据类型
    forEachValue(rawModule[key], function(value, type) {
      assert(
        assertOptions.assert(value),//是否符合规定的数据类型

        //当上面的断言返回false时,根据以下参数抛出错误
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      );
    });
  });
}

//对象版的forEach
function forEachValue(obj, fn) {
  Object.keys(obj).forEach(function(key) {
    return fn(obj[key], key);
  });
}

//创建断言的警告, 具体不详谈
function makeAssertionMessage(path, key, type, value, expected) {
  var buf = key + ' should be ' + expected + ' but "' + key + '.' + type + '"';
  if (path.length > 0) {
    buf += ' in module "' + path.join('.') + '"';
  }
  buf += ' is ' + JSON.stringify(value) + '.';
  return buf;
}
```
