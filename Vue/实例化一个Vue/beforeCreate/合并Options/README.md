# 合并配置选项

这个过程发生在`Vue`实例初始化自身代理之前，会更具该`Vue`实例是否为组件来进行配置项的初始化合并。

```js
// 当为组件的配置时
if (options && options._isComponent) {
    // optimize internal component instantiation
    // since dynamic options merging is pretty slow, and none of the
    // internal component options needs special treatment.
    initInternalComponent(vm, options)
} else {
    vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
    )
}
```

在该Vue实例为组件的情况下会调用以下方法进行配置项的初始化

## initInternalComponent()

## resolveConstructorOptions()——调整构造函数options

该函数用来解决当前组件构造函数的`options`与之前的`options`不一致的问题，这个检测会一直检查到根`Vue`构造函数，它会保证所有的构造函数的当前配置和缓存配置全等，否则就会对其进行打补丁式的修复。

```js
function resolveConstructorOptions(Ctor: Class < Component > ) {

    // 获取构造函数上的options属性
    let options = Ctor.options;

    // 如果该构造函数有父级(没有父级弹什么mixins)
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

## mergeOptions()

否则，则直接使用`mergeOption()`来进行初始化配置对象；但在调用该方法前，需要调用`resolveConstructorOptions()`对`Vue`的构造函数的配置做处理，那么问题来了，在**初始化`Vue`构造函数时**，这个`Vue.options`这个属性干了什么呢？请看[初始化API和一些属性](../初始化API)

1. `resolveConstructorOptions()`：处理构造函数的`Options`配置，分为两种情况：
   1. Vue构造函数：直接返回其`options`即可
   2. `VueComponent`组件构造函数
2. `mergeOption()`：合并用户与默认`options`

下面是`mergeOptions()`的具体代码：

```js
function mergeOptions(
    parent: Object,
    child: Object,
    vm ? : Component
): Object {

    // 检查组件名称是否合法
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
    // 在子options上应用extends/mixins属性仅当它们构造函数具有_base属性时且不为第一次调用该函数
    if (!child._base) {

        // 合并某个组件的options，这里的extends就指的是某个组件
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

    // 合并parent中存在的key
    for (key in parent) {
        mergeField(key);
    }

    // 仅合并parent中在该child中不存在的key
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
```

### 组件构造函数创建时

当组件的构造函数创建时，会调用该函数来合并与父级构造函数的`options`。

### 格式options中的部分属性的数据类型

Vue在这一步会对`props`、`inject`、`directives`三个属性进行数据类型的转换，具体如下：

#### props的转换

`props`属性只支持数组和对象两种形式，其余形式报错

```js
function normalizeProps(options: Object, vm: ? Component) {
    const props = options.props;
    if (!props) return;
    const res = {};
    let i, val, name;

    // 用户数组形式定义时，每个参数必须为字符串，将其转换为对象
    if (Array.isArray(props)) {
        i = props.length
        while (i--) {
            val = props[i]
            if (typeof val === 'string') {
                name = camelize(val)
                res[name] = {
                    type: null
                }
            } else if (process.env.NODE_ENV !== 'production') {
                warn('props must be strings when using array syntax.')
            }
        }

    // 对象形式时，更具其属性的值，进行格式化
    } else if (isPlainObject(props)) {
        for (const key in props) {
            val = props[key]
            name = camelize(key)
            res[name] = isPlainObject(val) ?
                val : {
                    type: val
                }
        }

    // 两种数据类型都不是时，对不起，报错
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "props": expected an Array or an Object, ` +
            `but got ${toRawType(props)}.`,
            vm
        )
    }
    options.props = res;
}
```

最终转换为的值为：

```js
options.props = {
    value1: {
        type: Object
    }

    ...
}
```

#### inject的转换

`inject`属性只支持数组和对象两种形式，其余形式报错

```js
function normalizeInject(options: Object, vm: ? Component) {
    const inject = options.inject;
    if (!inject) return;
    const normalized = options.inject = {};

    // 数组形式时，值必须为字符串(虽然没有报错)
    if (Array.isArray(inject)) {
        for (let i = 0; i < inject.length; i++) {
            normalized[inject[i]] = {
                from: inject[i]
            }
        }

    // 对象形式时
    } else if (isPlainObject(inject)) {
        for (const key in inject) {
            const val = inject[key]
            normalized[key] = isPlainObject(val) ?
                extend({
                    from: key
                }, val) : {
                    from: val
                }
        }
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "inject": expected an Array or an Object, ` +
            `but got ${toRawType(inject)}.`,
            vm
        )
    }
}
```

最终效果为：

```js
options.inject = {
    key1: {
        from: val1
    }
    ...
}
```

#### directives的转换

```js
function normalizeDirectives(options: Object) {
    const dirs = options.directives;

    // 只定义一个函数时，默认绑定bind与update
    if (dirs) {
        for (const key in dirs) {
            const def = dirs[key];
            if (typeof def === 'function') {
                dirs[key] = {
                    bind: def,
                    update: def
                }
            }
        }
    }
}
```
