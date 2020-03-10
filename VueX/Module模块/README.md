# Module，模块

在`VueX`中，如果我们在配置中使用`module`时，就会注册一个该子模块，`Module`的构造函数如下：

```js
// Base data struct for store's module, package with some attribute and method
// Vuex中module的基础结构，包装一些属性和方法
var Module = function Module(rawModule, runtime) {

    // 是否为运行时创建
    this.runtime = runtime;

    //存储子module数组
    this._children = Object.create(null);

    // 将原始的module配置，存放在该属性中
    this._rawModule = rawModule;
    var rawState = rawModule.state;

    // 将当前module的state挂载至自身state属性上
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {};
};
```

该`module`中主要包括了`4`个字段：

- `runtime`是否为运行时注册
- `_children`：子`module`数组
- `_rawModule`：该`module`的初始配置
- `state`：该`module`设置的`state`

除此之外呢，它还具有一些实例方法：

- [添加/删除/获取指定的子module——Module.prototype.addChild()/Module.prototype.removeChild()/Module.prototype.getChild()](#%e6%b7%bb%e5%8a%a0%e5%88%a0%e9%99%a4%e8%8e%b7%e5%8f%96%e6%8c%87%e5%ae%9a%e7%9a%84%e5%ad%90modulemoduleprototypeaddchildmoduleprototyperemovechildmoduleprototypegetchild)
- [模块上的属性注册———installModule()](#%e6%a8%a1%e5%9d%97%e4%b8%8a%e7%9a%84%e5%b1%9e%e6%80%a7%e6%b3%a8%e5%86%8cinstallmodule)

## 添加/删除/获取指定的子module——Module.prototype.addChild()/Module.prototype.removeChild()/Module.prototype.getChild()

比较简单这里就不说明了。

```js
//添加一个指定key的module
Module.prototype.addChild = function addChild(key, module) {
    this._children[key] = module;
};

// 删除一个指定key的module
Module.prototype.removeChild = function removeChild(key) {
    delete this._children[key];
};

//返回子module中值为key的module
Module.prototype.getChild = function getChild(key) {
    return this._children[key]
};
```

## 模块上的属性注册———installModule()

虽然该方法不是`module`上的实例方法，但我觉得它和`module`关系很大，基本上决定了一个`module`内部的属性关系，所以我将其放到这里来将，虽然该方法很复杂，但是可以简单概括为：

- 注册`State`
- 注册`Mutation`
- 注册`Action`
- 注册`Getter`
- 递归注册子`module`

这其中还设计到一个`module`的命名空间(`namespace`)与上下文(`context`)的问题，这里我们粗略来看看：

```js
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

    // 非根module且为非热更新时
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
```

那么首先，是对当前`module`命名空间(`namespaced`)的获取，它调用了[`ModuleCollection.prototype.getNamespace()`](../ModuleCollection模块集合管理/README.md#modulecollectionprototypegetnamespace%e8%8e%b7%e5%8f%96%e6%8c%87%e5%ae%9a%e8%b7%af%e5%be%84%e4%b8%8b%e7%9a%84%e5%91%bd%e5%90%8d%e7%a9%ba%e9%97%b4%e5%ad%97%e7%ac%a6%e4%b8%b2)方法，来获取其`module`在一个路径下的`namespaceKey`值，这方法会将路径图中使用了`module.namespaced = true`的`module`生成一个具体的值(当然具体的还是点进链接中查看)，之后如果当前`module`如果注册了`namespaced`，则将其挂载在全局的`_modulesNamespaceMap`上：

```js
var namespace = store._modules.getNamespace(path);

// 当该module有命名空间时,将对应的module挂载在命名空间map的对应位置
if (module.namespaced) {
    store._modulesNamespaceMap[namespace] = module;
}
```

之后便是对子模块的`state`进行注册，它具体注册的地方，那肯定是根模块的`state`上！

```js
if (!isRoot && !hot) {

    // 获取其父级module的state
    var parentState = getNestedState(rootState, path.slice(0, -1));

    // 获取当前module的名称
    var moduleName = path[path.length - 1];

    // 在_withCommit中提交state变更，防止触发报警
    store._withCommit(function () {

        // 在指定vm实例上指定module的state上挂载当前module的state
        Vue.set(parentState, moduleName, module.state);
    });
}
```

这里首先通过[`getNestedState()`](../内部辅助方法/README.md#getnestedstate%e8%8e%b7%e5%8f%96%e6%8c%87%e5%ae%9a%e8%b7%af%e5%be%84%e4%b8%8b%e7%9a%84state)方法获取到了指定路径的`state`，之后通过`Vue.set api`将子`module`的`state`挂载在父`module`上，注意哦，这里挂载的键名**直接为`module`名，非`namespace`**。

那么这里的[`_withCommit()`](../Store存储空间/README.md#storeprototypewithcommit%e6%a0%87%e5%87%86%e6%8f%90%e4%ba%a4)是个什么玩意儿呢，其实它是个断言函数，之后我们会看到，非常的简单，当然这里你也可以提前去学习。
____
在这之后就是一个比较该`module`的上下文对象(`context`)的获取，通过该上下文会根据是否具有命名空间来绝对其内部能访问的范围，该上下文对象通过[`makeLocalContext()`](./模块上下文Context/REAMDE.md)创建。

那么最后便是`Mutation`、`Action`、`Getter`的注册，之后就是递归重复执行该函数注册子`module`。

- [Mutation的注册](../Mutation函数/README.md)
- [Action的注册](../Action函数/README.md)
- [Getter的注册](../Getter访问器/README.md)
- [单独了解模块的Context](./模块上下文Context/REAMDE.md)
