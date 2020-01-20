# 合并配置选项

在初始化根`Vue`实例时，其会进行配置项(`options`)的初始化合并。

```js
// 组件vm实例
if (options && options._isComponent) {

    // optimize internal component instantiation
    // since dynamic options merging is pretty slow, and none of the
    // internal component options needs special treatment.
    // 优化组件内部的组件，因为动态options合并低效，而且没有内部组件的options
    // 需要特殊的处理
    initInternalComponent(vm, options);

// 根vm实例
} else {
    vm.$options = mergeOptions(

        // 返回Vue.options，即全局组件配置
        resolveConstructorOptions(vm.constructor),

        // 我们定义的根vm实例的options
        options || {},
        vm
    )
}
```

那么首先呢，我们先看根vm实例的配置是如何合并的。

## 根vm实例的配置合并

### resolveConstructorOptions()——调整构造函数options

该函数用来解决当前组件构造函数的`options`与之前的`options`不一致的问题，这个检测会一直检查到根`Vue`构造函数，它会保证所有的构造函数的当前配置和缓存配置全等，否则就会对其进行打补丁式的修复。

```js
function resolveConstructorOptions(Ctor: Class < Component > ) {

    // 获取构造函数上的options属性
    let options = Ctor.options;

    // 如果该构造函数有父级
    if (Ctor.super) {

        // 获取父级组件构造函数的options
        const superOptions = resolveConstructorOptions(Ctor.super);

        // 获取父级构造函数上options
        const cachedSuperOptions = Ctor.superOptions;

        // 当父级options与缓存的options不同时(因为这两个都是对同一个对象的引用详情参考Vue.extend函数), 更新缓存
        if (superOptions !== cachedSuperOptions) {

            // super option changed,
            // need to resolve new options.
            // 父级options变动时，更新其缓存
            Ctor.superOptions = superOptions;

            // check if there are any late-modified/attached options (#4976)
            // 一个记录最新Options与原始差异的对象
            const modifiedOptions = resolveModifiedOptions(Ctor);

            // update base extend options
            // 将两者差异属性追加到组件的options上(即用户编写的组件模块文件里面的配置)
            if (modifiedOptions) {
                extend(Ctor.extendOptions, modifiedOptions);
            }

            // 更新组件的Superoptions
            options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);

            // 更新组件名称挂载的组件
            if (options.name) {
                options.components[options.name] = Ctor
            }
        }
    }
    return options;
}
```

对于最顶级的`Vue`构造函数，其不存在`.super`属性，所以直接返回其`options`配置即可。(下面的分段跳过，直接跳过到[下一部分](#mergeoptions%e5%90%88%e5%b9%b6%e9%85%8d%e7%bd%ae))

### resolveModifiedOptions()——对比原始options与最新options

当然我们用来区分两者不同的部分的方法是`resolveModifiedOptions()`，还记得我们在`Vue.extend()`创建的`sealedOptions`吗，它存放着最原始版本组件构造函数的`options`的缓存，所以只需要对比它们就可以了。该函数的结果是返回一个包含它们差异键值对的对象。

```js
// 对比新旧两个options，返回其变更部分填充的对象
function resolveModifiedOptions(Ctor: Class < Component > ): ? Object {
    let modified;
    const latest = Ctor.options;

    // 组件密封的对上一个父级属性的copy
    const sealed = Ctor.sealedOptions;

    // 遍历封装的Options与现有的Options, 将其不同(必须全等)的key/value
    // 存入modified对象中返回
    for (const key in latest) {

        // 全等，用来筛选与原始options不同的部分
        if (latest[key] !== sealed[key]) {
            if (!modified) modified = {};
            modified[key] = latest[key];
        }
    }
    return modified;
}
```

### mergeOptions()——合并配置

`mergeOption()`用来进行初始化配置对象；但在调用该方法前，需要调用`resolveConstructorOptions()`对`Vue`的构造函数的配置做处理，那么问题来了，在**初始化`Vue`构造函数时**，这个`Vue.options`这个属性干了什么呢？请复习一遍[初始化Vue构造函数](../../../初始化Vue构造函数/README.md)

下面是`mergeOptions()`的具体代码(并非仅这一处调用该方法)：

```js
function mergeOptions(
    parent: Object,
    child: Object,
    vm ? : Component
): Object {

    // 检查我们挂载在components的组件名称是否合法
    if (process.env.NODE_ENV !== 'production') {
        checkComponents(child);
    }

    if (typeof child === 'function') {
        child = child.options;
    }

    // 统一用户传入的props、inject、dir为对象格式
    normalizeProps(child, vm);
    normalizeInject(child, vm);
    normalizeDirectives(child);

    // Apply extends and mixins on the child options,
    // but only if it is a raw options object that isn't
    // the result of another mergeOptions call.
    // Only merged options has the _base property.
    // 为子组件合并传入的extends/mixins，仅合并未合并过的，
    // 且不对基础组件(具有_base)配置进行合并
    if (!child._base) {

        // 合并某个组件的options，这里的extends就指的是某个组件
        // 这是另一种同Vue.extend API扩展效果一样的拓展
        if (child.extends) {
            parent = mergeOptions(parent, child.extends, vm)
        }
        if (child.mixins) {
            for (let i = 0, l = child.mixins.length; i < l; i++) {
                parent = mergeOptions(parent, child.mixins[i], vm)
            }
        }
    }

    const options = {};
    let key;

    // 先合并parent中存在的key
    for (key in parent) {
        mergeField(key);
    }

    // 然后仅合并parent中在该child中不存在的key
    for (key in child) {
        if (!hasOwn(parent, key)) {
            mergeField(key);
        }

        function mergeField(key) {

            // 获取一个策略(已有或默认策略), 然后使用该策略对options中对应属性合并
            const strat = strats[key] || defaultStrat
            options[key] = strat(parent[key], child[key], vm, key)
        }

        return options;
    }
}
```

如大家所见，合并配置前，首先对用户传入的配置的数据类型进行格式化。待格式化完成后，如果我们定义了一些继承的组件配置，那么它们会优先被合并进去， 但这并不意味着这些继承的字段会被重写，因为我们可以在接下来的合并中看到，对于基础配置(`parent`)中的字段，在合并时，是直接跳过的。

```js
for (key in child) {
    if (!hasOwn(parent, key)) {
        mergeField(key);
    }
}
```

然后就优先从基础配置(`parent`)中合并配置，这些内置的配置是不允许被重写的，所以在接下来我们可以看到，对于子配置(`child`)的合并，排除了已存在的字段。

## 属性合并策略

在上述的代码中，我们明显能看到对于每一个字段，是有一种策略(`strat`)来控制其合并行为的，具体请移步[属性合并策略](./属性合并策略/README.md)。

## 组件构造函数创建时

当组件的构造函数创建时，会调用该函数来合并与父级构造函数的`options`。

在该`Vue`实例为组件的情况下会调用以下方法进行配置项的初始化

### initInternalComponent()——初始化组件的options

该函数用于处理组件的`options`对象，它不用动态合并的方式来处理，而是直接进行赋值的方式：

```js
function initInternalComponent(vm: Component, options: InternalComponentOptions) {

    // 将定义的组件对象置于原型对象并为组件实例定义$options
    const opts = vm.$options = Object.create(vm.constructor.options);

    // doing this because it's faster than dynamic enumeration.
    // 直接为其添加属性，因为它比动态枚举更快

    // 取出该vm实例代表的组件VNode(即我们在父级上下文使用的组件标签代表的VNode)
    const parentVnode = options._parentVnode;

    // 父vm实例
    opts.parent = options.parent;

    // 为其添加该vm实例代表的组件VNode
    opts._parentVnode = parentVnode;

    // 取出定义在父vm实例上下文，该组件标签上的属性
    const vnodeComponentOptions = parentVnode.componentOptions

    // 组件上定义的attrs
    opts.propsData = vnodeComponentOptions.propsData;

    // 父级上下文中组件标签定义的事件监听器
    opts._parentListeners = vnodeComponentOptions.listeners;

    // 父级上下文中组件标签内的子VNode
    opts._renderChildren = vnodeComponentOptions.children;

    // 组件标签的名称
    opts._componentTag = vnodeComponentOptions.tag

    // 组件是否为渲染函数，如果是，挂载在vm.$options中
    if (options.render) {
        opts.render = options.render;
        opts.staticRenderFns = options.staticRenderFns;
    }
}
```

这个函数是用来处理组件的，其中`vnodeComponentOptions`属性中的值来元素最初创建这个组件`VNode`时挂载的属性，它里面的属性就表示其在父级上下文中组件标签上定义的各种属性。
