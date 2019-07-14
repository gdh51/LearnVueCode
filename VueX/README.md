# VueX

源码解读

我们知道(你可能也不知道)`Vue` 通过 `Vue.use(plugin)`来安装插件, 实质是执行 `plugin` 上的 `install()`方法, 所以我们先从它开始看起

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

  //初始化插件与严格模式,默认关闭严格模式
  var plugins = options.plugins;
  if (plugins === void 0) plugins = [];
  var strict = options.strict;
  if (strict === void 0) strict = false;

  // store internal state
  //实例内部状态

  //用来判断允许修改state,为false时修改会报错,严格模式下是只能用 mutation来修改state
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

  //实现watch的Vue实例
  this._watcherVM = new Vue();

  // bind commit and dispatch to self
  //绑定commit()与dispatch()至store实例, 绑定this至该store实例
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

  //注册根module,同时递归注册所有的子module,并收集所有的getter到_wrappedGetters
  installModule(this, state, [], this._modules.root);

  //初始化store的vue实例, 给state注册响应式计算,并将_wrappedGetters注册为计算属性
  resetStoreVM(this, state);

  // 调用插件
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

这里介绍的比较多,按顺序依次介绍

### util —— assertRawModule()

这是一个工具方法, 用来判断 `Module` 中属性值是否是正确的类型, 代码如下

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
        assertOptions.assert(value), //是否符合规定的数据类型

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

### ModuleCollection() 构造函数

`Vuex`中通过该函数收集所有的 `module`

```js
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
  return path.reduce(function(module, key) {
    return module.getChild(key);
  }, this.root);
};

ModuleCollection.prototype.getNamespace = function getNamespace(path) {
  var module = this.root;
  return path.reduce(function(namespace, key) {
    //获取对应key的module
    module = module.getChild(key);

    //返回命名空间地址字符串
    return namespace + (module.namespaced ? key + '/' : '');
  }, '');
};

ModuleCollection.prototype.register = function register(
  path,
  rawModule,
  runtime
) {
  var this$1 = this;

  //未传参数时默认为true
  if (runtime === void 0) runtime = true;

  //检查Module的各属性值是否是正确的数据类型
  {
    assertRawModule(path, rawModule);
  }

  //新建一个module,与顶层module共享state(具体见下方Module构造函数)
  var newModule = new Module(rawModule, runtime);

  //当为顶层module时, 在root属性挂载该module
  if (path.length === 0) {
    this.root = newModule;
  } else {
    //不是顶层module时,找到该module的父级module,并添加在父级module的_children中
    var parent = this.get(path.slice(0, -1));
    parent.addChild(path[path.length - 1], newModule);
  }

  //有还有嵌套的modules属性,则遍历path在moduleCollection上注册所有嵌套的module
  if (rawModule.modules) {
    forEachValue(rawModule.modules, function(rawChildModule, key) {
      this$1.register(path.concat(key), rawChildModule, runtime);
    });
  }
};
```

### Module() 构造函数

`Module` 构造函数用来创建一个 `Module`, 并在其上注册各种方法与管理子 `module`

```js
var Module = function Module(rawModule, runtime) {
  this.runtime = runtime;

  //存储子module
  this._children = Object.create(null);
  // 存储顶层Module, 即最顶层的options
  this._rawModule = rawModule;
  var rawState = rawModule.state;

  // 将顶层module的state挂载在自身, 当state为函数时单独维护
  this.state = (typeof rawState === 'function' ? rawState() : rawState) || {};
};

//添加一个module
Module.prototype.addChild = function addChild(key, module) {
  this._children[key] = module;
};

//返回子module中值为key的module
Module.prototype.getChild = function getChild(key) {
  return this._children[key];
};
```

### installModule()

注册该 module 所有的方法与数据具体见下

```js
//在store中注册所有actions/mutations/getter/state
function installModule(store, rootState, path, module, hot) {
  var isRoot = !path.length;

  //获取当前module的命名空间字符串
  var namespace = store._modules.getNamespace(path);

  // 当该module有命名空间时,将对应的module挂载在命名空间map的对应位置
  if (module.namespaced) {
    store._modulesNamespaceMap[namespace] = module;
  }

  // 在父级state中以module名称的形式挂载子module的state
  if (!isRoot && !hot) {
    var parentState = getNestedState(rootState, path.slice(0, -1));
    var moduleName = path[path.length - 1];
    store._withCommit(function() {
      Vue.set(parentState, moduleName, module.state);
    });
  }

  var local = (module.context = makeLocalContext(store, namespace, path));

  //以下全为在store._xx上注册全部module的xx函数
  //遍历注册mutation函数在store._mutations上注册全部module的mutation函数
  module.forEachMutation(function(mutation, key) {
    var namespacedType = namespace + key;
    registerMutation(store, namespacedType, mutation, local);
  });

  //遍历注册action函数在store._actions上注册全部module的action函数
  module.forEachAction(function(action, key) {
    var type = action.root ? key : namespace + key;
    var handler = action.handler || action;
    registerAction(store, type, handler, local);
  });

  //遍历注册getter函数在store._getters上注册全部module的getter
  module.forEachGetter(function(getter, key) {
    var namespacedType = namespace + key;
    registerGetter(store, namespacedType, getter, local);
  });

  //在根state上挂载全部子state
  module.forEachChild(function(child, key) {
    installModule(store, rootState, path.concat(key), child, hot);
  });
}
```

#### module.forEachxxx()

类似于这种格式的方法,这里只举一个例子,主要用于来检查与遍历 xxx 方法

```js
Module.prototype.forEachAction = function forEachAction(fn) {
  //检查是否存在actions属性, 存在时取出遍历执行fn
  if (this._rawModule.actions) {
    forEachValue(this._rawModule.actions, fn);
  }
};
```

#### registerMutation()

主要作用就是注册并包装 action 函数, 传入固定的形参

```js
//注册actions,并包装该action函数, 参入store接口作为实参
function registerAction(store, type, handler, local) {
  //取出对应类型的action回调
  var entry = store._actions[type] || (store._actions[type] = []);

  //包装action函数, 所以我们在执行dispatch时能从第一个参数获取store
  entry.push(function wrappedActionHandler(payload, cb) {
    var res = handler.call(
      store,
      {
        dispatch: local.dispatch,
        commit: local.commit,
        getters: local.getters,
        state: local.state,
        rootGetters: store.getters,
        rootState: store.state
      },
      payload,
      cb
    );

    //判断是否为Promise,不是时转换为
    if (!isPromise(res)) {
      res = Promise.resolve(res);
    }

    // 存在devtool插件的时候触发vuex的error给devtool
    if (store._devtoolHook) {
      return res.catch(function(err) {
        store._devtoolHook.emit('vuex:error', err);
        throw err;
      });
    } else {
      return res;
    }
  });
}
```

之后会介绍`dispatch()`函数, 其他的注册函数大同小异

### resetStoreVM()

作用是使`store`的`state`与`getter`分别变为响应式的`data`与`computed`属性

```js
//将store.state注册为响应式, 同时注册getter为computed属性
function resetStoreVM(store, state, hot) {
  var oldVm = store._vm;

  // 绑定公共的getters
  store.getters = {};
  var wrappedGetters = store._wrappedGetters;
  var computed = {};
  forEachValue(wrappedGetters, function(fn, key) {
    //用闭包保存固定的store参数,并缓存
    computed[key] = partial(fn, store);

    //通过给store.getters定义get()函数来获取vue实例上对应的响应式属性
    Object.defineProperty(store.getters, key, {
      get: function() {
        return store._vm[key];
      },
      enumerable: true // for local getters
    });
  });

  //设为true时, 在实例化vue中不会出现警告
  //通过vue实例使变量实现响应式
  var silent = Vue.config.silent;
  Vue.config.silent = true;
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed: computed
  });
  Vue.config.silent = silent;

  // enable strict mode for new vm
  //使用严格模式, 该模式下只能通过mutation修改store
  if (store.strict) {
    enableStrictMode(store);
  }

  if (oldVm) {
    //解除旧vm的state的引用并销毁旧vm实例
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(function() {
        oldVm._data.$$state = null;
      });
    }
    Vue.nextTick(function() {
      return oldVm.$destroy();
    });
  }
}
```

#### enableStrictMode()

在`resetStoreVM()`中出现的方法, 用来控制是否使用严格模式(在初始化`Store`的`strict`属性),只有通过`mutation`函数来改变`state`

```js
function enableStrictMode(store) {
  //给state添加watch,并监听内部的变换,严格模式下直接报错
  store._vm.$watch(
    function() {
      return this._data.$$state;
    },
    function() {
      {
        assert(
          store._committing,
          'do not mutate vuex store state outside mutation handlers.'
        );
      }
    },
    { deep: true, sync: true }
  );
}
```

#### Store.prototype.\_withCommit

在 Vuex 的内部修改`state`时,会事先用来该函数来将`state`的状态改变为可以修改的状态,并在回调执行完后变回原状态

```js
//在执行回调函数时, 开起严格模式
Store.prototype._withCommit = function _withCommit(fn) {
  var committing = this._committing;
  this._committing = true;
  fn();
  this._committing = committing;
};
```

以上两个就是 strict 模式的执行原理

### Store 相关 API 接口

#### Store.prototype.commit()——Mutations

```js
//mutation函数,用来更改state状态
Store.prototype.commit = function commit(_type, _payload, _options) {
  var this$1 = this;

  // check object-style commit
  //检查参数并同一格式
  var ref = unifyObjectStyle(_type, _payload, _options);
  var type = ref.type;
  var payload = ref.payload;
  var options = ref.options;

  //在没有命名空间时,取出对应名称的mutation数组,遍历执行其函数
  var mutation = { type: type, payload: payload };
  var entry = this._mutations[type];
  if (!entry) {
    {
      console.error('[vuex] unknown mutation type: ' + type);
    }
    return;
  }

  //暂时切换为允许修改state, 在函数执行完后切换为设置的strict状态
  this._withCommit(function() {
    entry.forEach(function commitIterator(handler) {
      handler(payload);
    });
  });

  //通知所有订阅者,见下详解
  this._subscribers.forEach(function(sub) {
    return sub(mutation, this$1.state);
  });

  if (options && options.silent) {
    console.warn(
      '[vuex] mutation type: ' +
        type +
        '. Silent option has been removed. ' +
        'Use the filter functionality in the vue-devtools'
    );
  }
};
```

##### util——unifyObjectStyle()

这个函数用来统一参数为一种固定的对象形式

```js
function unifyObjectStyle(type, payload, options) {
  //当传入一个对象作为参数时, 统一为对象格式
  if (isObject(type) && type.type) {
    options = payload;
    payload = type;
    type = type.type;
  }

  {
    assert(
      typeof type === 'string',
      'expects string as the type, but found ' + typeof type + '.'
    );
  }

  return { type: type, payload: payload, options: options };
}
```

#### Store.prototype.subscribe()

之前在 commmit 结束后,会通过订阅者队列通知所有的订阅者调用这些订阅者函数, 它们都是从 subscribe()函数中产生:

```js
//订阅一个函数,并返回一个用于取消订阅函数的方法
Store.prototype.subscribe = function subscribe(fn) {
  return genericSubscribe(fn, this._subscribers);
};

function genericSubscribe(fn, subs) {
  //函数不存在时就push进入订阅者队列
  if (subs.indexOf(fn) < 0) {
    subs.push(fn);
  }

  //返回一个函数用于取消订阅
  return function() {
    var i = subs.indexOf(fn);
    if (i > -1) {
      subs.splice(i, 1);
    }
  };
}
```

这些订阅者向外提供了一个观察内部`state`变换的环境, 当通过`mutation`改变`state`时, 可以及时得到反馈

#### Store.prototype.dispatch()——Action

道理同 commit 差不多，但分为 3 个阶段,第一个阶段是在 state 改变前,执行 action 订阅者的 before 函数,第二个阶段改变 state 并执行相应类型的回调,第三个阶段触发改变状态后的 state,并执行 action 订阅者的 after 函数(**注意之前注册时的包装函数**)

```js
//触发action函数
Store.prototype.dispatch = function dispatch(_type, _payload) {
  var this$1 = this;

  // 检查参数并统一为对象格式
  var ref = unifyObjectStyle(_type, _payload);
  var type = ref.type;
  var payload = ref.payload;

  var action = { type: type, payload: payload };
  var entry = this._actions[type];
  if (!entry) {
    {
      console.error('[vuex] unknown action type: ' + type);
    }
    return;
  }

  //在执行回调前触发所有action订阅者函数,传入变换前的state
  try {
    this._actionSubscribers
      .filter(function(sub) {
        return sub.before;
      })
      .forEach(function(sub) {
        return sub.before(action, this$1.state);
      });
  } catch (e) {
    {
      console.warn('[vuex] error in before action subscribers: ');
      console.error(e);
    }
  }

  //触发所有包装action回调函数
  var result =
    entry.length > 1
      ? Promise.all(
          entry.map(function(handler) {
            return handler(payload);
          })
        )
      : entry[0](payload);

  //在state改变后执行所有订阅者的的after函数
  return result.then(function(res) {
    try {
      this$1._actionSubscribers
        .filter(function(sub) {
          return sub.after;
        })
        .forEach(function(sub) {
          return sub.after(action, this$1.state);
        });
    } catch (e) {
      {
        console.warn('[vuex] error in after action subscribers: ');
        console.error(e);
      }
    }
    return res;
  });
};
```

#### Store.prototype.watch()

一个利用 new Vue.\$watch 实现的响应式监听, 会传入 store 中的响应式数据作为参数

```js
//通过Vue实例的$watch API来监听getter函数的返回值, 并传入store所有的响应式数据作为参数
Store.prototype.watch = function watch(getter, cb, options) {
  var this$1 = this;

  //要监控的getter必须为函数
  {
    assert(
      typeof getter === 'function',
      'store.watch only accepts a function.'
    );
  }

  //通过Vue实例的$watch API来监听getter函数的返回值, 并传入store所有的响应式数据作为参数
  return this._watcherVM.$watch(
    function() {
      return getter(this$1.state, this$1.getters);
    },
    cb,
    options
  );
};
```

取消监听用该方法返回的函数即可

#### Store.prototype.registerModule()

动态新增一个 module

```js
//在path路径动态新注册一个module
Store.prototype.registerModule = function registerModule(
  path,
  rawModule,
  options
) {
  if (options === void 0) options = {};

  //path统一为数组
  if (typeof path === 'string') {
    path = [path];
  }

  {
    assert(Array.isArray(path), 'module path must be a string or an Array.');
    assert(
      path.length > 0,
      'cannot register the root module by using registerModule.'
    );
  }

  this._modules.register(path, rawModule);
  installModule(
    this,
    this.state,
    path,
    this._modules.get(path),
    options.preserveState
  );
  // reset store to update getters...
  // 通过新建vue实例重设store,并注册响应式属性
  resetStoreVM(this, this.state);
};
```

#### Store.prototype.unregisterModule()

解释了增加 module 肯定还有注销一个 module

```js
//动态注销模块
Store.prototype.unregisterModule = function unregisterModule(path) {
  var this$1 = this;

  //同样的path转换为数组
  if (typeof path === 'string') {
    path = [path];
  }

  {
    assert(Array.isArray(path), 'module path must be a string or an Array.');
  }

  //移除模块对象中的模块
  this._modules.unregister(path);

  //获取对应的state并删除
  this._withCommit(function() {
    var parentState = getNestedState(this$1.state, path.slice(0, -1));
    Vue.delete(parentState, path[path.length - 1]);
  });

  //重制store, 更新视图
  resetStore(this);
};
```

##### ModuleCollection.prototype.unregister()

通过父模块移除其父模块中\_children 中对应的模块

```js
ModuleCollection.prototype.unregister = function unregister(path) {
  //查找到父模块位置,移除父模块中_children对应的模块
  var parent = this.get(path.slice(0, -1));
  var key = path[path.length - 1];
  if (!parent.getChild(key).runtime) {
    return;
  }

  parent.removeChild(key);
};
```

##### util——resetStore()

初始化其他属性,重新注册 module 树,并对 state 进行响应式处理

```js
function resetStore(store, hot) {
  //初始化其他属性
  store._actions = Object.create(null);
  store._mutations = Object.create(null);
  store._wrappedGetters = Object.create(null);
  store._modulesNamespaceMap = Object.create(null);
  var state = store.state;
  // 注册所有module
  installModule(store, state, [], store._modules.root, true);
  // 重置store, 设置响应属性
  resetStoreVM(store, state, hot);
}
```
