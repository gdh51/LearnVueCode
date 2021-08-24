# ModuleCollection

顾名思义，该类就表示`VueX`中，所有`Module`的集合，它包含了我们在`VueX.options`中注册的模块的具体的信息。

```js
// 传入根Module为基础，注册全部module
var ModuleCollection = function ModuleCollection(rawRootModule) {
    /**
     * 在该实例root属性上挂载module, 并遍历创建所有子module, 大约是这个样子:
     * root.moduleA => moduleA._children.moduleB =>
     * moduleB._children.moduleC
     */
    this.register([], rawRootModule, false);
};
```

那么该函数呢，接收一个我们定义的模块配置，为其生成一个`Class Module`，来进行单独的管理。

## Module注册——ModuleCollection.prototype.register()

通过递归调用`ModuleCollection.prototype.register()`，`VueX`完成了其根`module`与其所有的子`module`的注册，它们将被全被存储在`Class ModuleCollection`中：

```js
/**
 * @param {Array} 路径的数组
 * @param {Object} 未处理的Module，即我们传入的配置
 * @param {Boolean} 是否为运行时注册
 */
ModuleCollection.prototype.register = function register(path, rawModule, runtime) {
    var this$1 = this;

    //未传参数时默认为运行时注册
    if (runtime === void 0) runtime = true;

    // 检查Module的各属性值是否是正确的数据类型
    // 比如mutation、action要求为函数
    {
        assertRawModule(path, rawModule);
    }

    // 为一个模块创建模块对象
    var newModule = new Module(rawModule, runtime);

    //当为顶层module时, 在该模块的root属性挂载该module
    if (path.length === 0) {
        this.root = newModule;
    } else {

        // 不是顶层module时,找到该module的父级module,
        // 并添加在父级module的_children中
        var parent = this.get(path.slice(0, -1));
        parent.addChild(path[path.length - 1], newModule);
    }

    // 如果该module中挂载有子module,
    // 则在为这些子module注册
    if (rawModule.modules) {
        forEachValue(rawModule.modules, function (rawChildModule, key) {

            // 传入的path为module名按顺序组成的键名
            this$1.register(path.concat(key), rawChildModule, runtime);
        });
    }
};
```

我们可以从上面看到`register()`函数主要分为两个步骤：

1. 注册当前传入配置的`module`(对于根`module`则挂载在`ModuleCollection.root`上)
2. 递归注册当前`module`的子`module`

那么最终呢，会产生一个这样的结构：

```js
let ModuleCollection = {
    root: {

        // 省略其他两个属性
        state: {},
        _children: [

            // 这里就是子module了
            {
                state: {},
                _children: [] //  然后如此往复
            }
        ]
    }
}
```

除此之外，我们可以看到，传入的`path`其实就是一个路径，比如：

```js
let moduleA = {
    modules: {
        moduleB: {}
    }
}
```

那么对于`moduleA`的路径就为`[moduleA]`，对于`moduleB`的路径就为`[moduleA, moduleB]`，所以上述用于添加父子`module`关系的代码，具体就涉及两个方法：

```js
var parent = this.get(path.slice(0, -1));
parent.addChild(path[path.length - 1], newModule);
```

## 从根module开始获取指定path下的module——ModuleCollection.prototype.get()

那么在上面了解了`path`数组的具体含义后，理解该函数就比较容易了，它巧妙的使用了`Array..prototype.reduce()`方法来迭代获取指定路径下的`module`：

```js
//查找对应path的module
ModuleCollection.prototype.get = function get(path) {

    // 从根module开始查找指定path下的module
    return path.reduce(function (module, key) {
        return module.getChild(key)
    }, this.root)
};
```

具体的[`module.getChild()`](../Module模块/README.md#%e6%b7%bb%e5%8a%a0%e5%88%a0%e9%99%a4%e8%8e%b7%e5%8f%96%e6%8c%87%e5%ae%9a%e7%9a%84%e5%ad%90modulemoduleprototypeaddchildmoduleprototyperemovechildmoduleprototypegetchild)方法其实就是获取其子`modules`数组的封装。

## ModuleCollection.prototype.getNamespace()——获取指定路径下的命名空间字符串

该方法用于获取指定路径下的命名空间字符串，具体代码结构和`ModuleCollection.prototype.get()`差不多，不同的时，该方法返回一个字符串。

```js
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
```

还记得具体的`module api`吗，当我们为某个`module`设置`namespaced`属性时，该`module`就会注册对应的命名空间，比如：

```js
let moduleA = {
    modules: {
        moduleB: {
            namespaced: true,
            modules: {
                moduleC: {}
            }
        }
    }
}

// 这里就表示moduleC的路径数组
let path = ['moduleA', 'moduleB', 'moduleC'];

// 那么moduleC的命名空间地址为
let namespacePath = 'moduleB/';
```

当然上面这种情况是虽然会出现，但是不会被使用，仅在当前`module.namespaced = true`时，才会将生成命名空间字符串使用在`namespacedMap`中。
