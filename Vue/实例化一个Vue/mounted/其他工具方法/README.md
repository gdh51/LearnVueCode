# 一些运行时编译的工具方法

下面是在`mounted`阶段所用到的工具方法的目录:

- [resolveAsset()——获取指定对象上的资源](#resolveasset%e8%8e%b7%e5%8f%96%e6%8c%87%e5%ae%9a%e5%af%b9%e8%b1%a1%e4%b8%8a%e7%9a%84%e8%b5%84%e6%ba%90)
- [hasOwn()——是否为自有属性](#hasown%e6%98%af%e5%90%a6%e4%b8%ba%e8%87%aa%e6%9c%89%e5%b1%9e%e6%80%a7)
- [proxy()——拦截访问与修改](#proxy%e6%8b%a6%e6%88%aa%e8%ae%bf%e9%97%ae%e4%b8%8e%e4%bf%ae%e6%94%b9)
- [transformModel()——处理组件上v-model](#transformmodel%e5%a4%84%e7%90%86%e7%bb%84%e4%bb%b6%e4%b8%8av-model)
- [extractPropsFromVNodeData()——提取组件的prop值](#extractpropsfromvnodedata%e6%8f%90%e5%8f%96%e7%bb%84%e4%bb%b6%e7%9a%84prop%e5%80%bc)
- [setActiveInstance()——设置当前更新的vm实例](#setactiveinstance%e8%ae%be%e7%bd%ae%e5%bd%93%e5%89%8d%e6%9b%b4%e6%96%b0%e7%9a%84vm%e5%ae%9e%e4%be%8b)

## resolveAsset()——获取指定对象上的资源

该方法会获取传入对象的指定属性名称的值，如果没有，则会按该属性名称的原始值、`-`连接符值、驼峰式值依次查找。如果还没找到则会依赖查询其原型链来获取属性。

```js
/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 * 解析options中的某个值，该函数用于子vm实例可能要使用其祖先组件中的某个属性
 */
function resolveAsset(
    options: Object,

    // 传入的类型
    type: string,

    // 标签名称或id
    id: string,
    warnMissing ? : boolean
): any {

    if (typeof id !== 'string') {
        return;
    }

    // 取出挂载在用户自定义配置上的属性
    const assets = options[type];

    // check local registration variations first
    // 优先检查是否为自有属性，优先返回自有属性
    if (hasOwn(assets, id)) return assets[id];

    // 下面分别返回其名称的-连接符式和驼峰式
    const camelizedId = camelize(id);
    if (hasOwn(assets, camelizedId)) return assets[camelizedId];
    const PascalCaseId = capitalize(camelizedId);
    if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId];

    // fallback to prototype chain
    // 如果本地变量没有则，依次检测其对应对象的原型链
    const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
    if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
        warn(
            'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
            options
        )
    }
    return res;
}
```

传入的参数分别为`options` => 被查找的对象、`type` => 被查找对象的某个要被查找的属性对象、`id` => 在该属性对象中要被查找的键名。

## hasOwn()——是否为自有属性

比较简单，就是是否为对象的自有属性：

```js
/**
 * Check whether an object has the property.
 */
// 取原型链方法，防止用户重写该方法
const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(obj: Object | Array < * > , key: string): boolean {

    // 是否为自有属性
    return hasOwnProperty.call(obj, key)
}
```

## proxy()——拦截访问与修改

该方法用于拦截对某个目标的访问，当指定某个目标的某个属性后，以后再次对该目标访问时，会直接变成对该属性的访问：

```js
const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
};

// 拦截target对象的getter与setter使其查询或修改属性时，直接跨级修改sourceKey中的属性
function proxy(target: Object, sourceKey: string, key: string) {

    // 直接跨层访问
    sharedPropertyDefinition.get = function proxyGetter() {
        return this[sourceKey][key]
    }
    sharedPropertyDefinition.set = function proxySetter(val) {
        this[sourceKey][key] = val
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}
```

## transformModel()——处理组件上v-model

该方法用于处理组件元素上的`v-model`语法，以及在组件配置中配置的自定义`model`属性，过程不复杂，就是添加对应的事件和属性到`VNode`上

```js
function transformModel(options, data: any) {

    // 是否指定prop绑定的值，否则默认绑定其value属性
    const prop = (options.model && options.model.prop) || 'value';

    // 是否指定v-model绑定的事件，默认绑定input
    const event = (options.model && options.model.event) || 'input';

    // 在元素属性中添加绑定的元素属性的值
    (data.attrs || (data.attrs = {}))[prop] = data.model.value;

    // 获取元素上的事件处理器对象
    const on = data.on || (data.on = {});

    // 取出该类型的事件对象
    const existing = on[event];
    const callback = data.model.callback;

    // 如果存在同类型事件，转化为数组添加添加在最前
    if (isDef(existing)) {
        if (
            Array.isArray(existing) ?

            // 不为同一事件处理函数
            existing.indexOf(callback) === -1 :
            existing !== callback
        ) {
            on[event] = [callback].concat(existing)
        }
    } else {

        // 不存在时，直接添加
        on[event] = callback
    }
}
```

## extractPropsFromVNodeData()——提取组件的prop值

该函数用于来获取组件中的`props`的各个属性在某个`vm`上下文环境中具体真实值的。

```js
function extractPropsFromVNodeData(
    data: VNodeData,
    Ctor: Class < Component > ,
    tag ? : string
): ? Object {
    // we are only extracting raw values here.
    // validation and default values are handled in the child
    // component itself.
    // 这里只提取原始值，效验器和默认值的处理会在initState处理

    // 取出组件中定义的prop
    const propOptions = Ctor.options.props;
    if (isUndef(propOptions)) {
        return;
    }
    const res = {};

    // 取出元素的attribute，这里的porps占时未知来自于哪里
    const {
        attrs,
        props
    } = data;
    if (isDef(attrs) || isDef(props)) {
        for (const key in propOptions) {

            // 连接符化prop的键名
            const altKey = hyphenate(key);

            // 开发模式下，如果prop中包含大写字母，则提示
            if (process.env.NODE_ENV !== 'production') {
                const keyInLowerCase = key.toLowerCase()
                if (
                    key !== keyInLowerCase &&
                    attrs && hasOwn(attrs, keyInLowerCase)
                ) {
                    tip(
                        `Prop "${keyInLowerCase}" is passed to component ` +
                        `${formatComponentName(tag || Ctor)}, but the declared prop name is` +
                        ` "${key}". ` +
                        `Note that HTML attributes are case-insensitive and camelCased ` +
                        `props need to use their kebab-case equivalents when using in-DOM ` +
                        `templates. You should probably use "${altKey}" instead of "${key}".`
                    )
                }
            }

            // 优先取处理props，没有则处理attrs
            checkProp(res, props, key, altKey, true) || checkProp(res, attrs, key, altKey, false)
        }
    }
    return res
}
```

对于某个键名具体的值的提取调用的`checkProp()`函数，目前还不知道`props`的来源，因为如果是`domProps`是不存在`vm.props`中的。

### checkProp()——检测是否hash中是否存在key

该函数用于检查`hash`中是否存在`key`键名，如果存在，则将其键值存入`res`中

```js
function checkProp(

    // 结果
    res: Object,

    // 元素属性对象
    hash: ? Object,
    key : string,

    // key连接符化后的值
    altKey: string,

    // 是否保留该属性的由来
    preserve: boolean
) : boolean {

    // 存在property，优先按模版中定义的名称添加到最终结果
    if (isDef(hash)) {
        if (hasOwn(hash, key)) {
            res[key] = hash[key]
            if (!preserve) {
                delete hash[key]
            }
            return true;
        } else if (hasOwn(hash, altKey)) {
            res[key] = hash[altKey]
            if (!preserve) {
                delete hash[altKey]
            }
            return true;
        }
    }
    return false;
}
```

## setActiveInstance()——设置当前更新的vm实例

该函数用于存储上一个更新的`vm`实例，并将设置当前更新的`vm`实例，并返回一个接口来切换为上一个更新的`vm`实例。

```js
let activeInstance: any = null;

// 该函数用于将当前的更新的实例变更为传入的实例，并存储上一个更新的实例
function setActiveInstance(vm: Component) {

    // 储存上一个更新的vm实例
    const prevActiveInstance = activeInstance;

    // 设置更新的vm实例为当前实例;
    activeInstance = vm;

    // 返回一个接口，用于切换为上一个实例
    return () => {
        activeInstance = prevActiveInstance
    }
}
```
