# 一些运行时编译的工具方法

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