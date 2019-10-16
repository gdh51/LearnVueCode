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
    // 在子options上应用extends/mixins属性仅当它们构造函数非Vue时
    if (!child._base) {
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