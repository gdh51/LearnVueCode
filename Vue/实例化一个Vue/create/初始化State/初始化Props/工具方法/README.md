# 工具方法

这里存放一些在`initProps()`中使用到的工具方法：

**目录：**

- [getTypeIndex()——检测传入类型是否符合某一个类型要求](#gettypeindex%e6%a3%80%e6%b5%8b%e4%bc%a0%e5%85%a5%e7%b1%bb%e5%9e%8b%e6%98%af%e5%90%a6%e7%ac%a6%e5%90%88%e6%9f%90%e4%b8%80%e4%b8%aa%e7%b1%bb%e5%9e%8b%e8%a6%81%e6%b1%82)
- [getType()——获取构造函数函数名](#gettype%e8%8e%b7%e5%8f%96%e6%9e%84%e9%80%a0%e5%87%bd%e6%95%b0%e5%87%bd%e6%95%b0%e5%90%8d)
- [assertType()——断言value是否为type类型](#asserttype%e6%96%ad%e8%a8%80value%e6%98%af%e5%90%a6%e4%b8%batype%e7%b1%bb%e5%9e%8b)
- [proxy()——代理访问属性](#proxy%e4%bb%a3%e7%90%86%e8%ae%bf%e9%97%ae%e5%b1%9e%e6%80%a7)

## getTypeIndex()——检测传入类型是否符合某一个类型要求

该函数用于检测传入的`type`是否符合`expectedTypes`数组中任意一个要求的`type`类型，如果符合则会返回其符合条件类型的下标，否则返回`-1`。

```js
// 检查expectedTypes
function getTypeIndex(type, expectedTypes): number {

    // 验证非数组情况
    if (!Array.isArray(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1
    }

    // 验证expectedTypes为数组的情况
    for (let i = 0, len = expectedTypes.length; i < len; i++) {

        // 返回符合条件的下标
        if (isSameType(expectedTypes[i], type)) {
            return i;
        }
    }
    return -1
}

// a、b两个构造函数的函数名是否相同
function isSameType(a, b) {
    return getType(a) === getType(b)
}
```

[`getType()`](#gettype%e8%8e%b7%e5%8f%96%e6%9e%84%e9%80%a0%e5%87%bd%e6%95%b0%e5%87%bd%e6%95%b0%e5%90%8d)函数用于获取构造函数的名称，返回一个字符串

## getType()——获取构造函数函数名

该方法用于获取传入的构造函数的函数名。

```js
/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 * 使用函数的字符串名称是检查内置的类型，因为在不同vms或iframes中直接的
 * 比较会失败
 */
function getType(fn) {

    // 返回该type类型的函数名称
    const match = fn && fn.toString().match(/^\s*function (\w+)/);
    return match ? match[1] : ''
}
```

## assertType()——断言value是否为type类型

该方法用于根据传入的`value`与构造函数，来判断其是否为所属的`Class`，整体方法比较简单，重点在于对于不同值的处理：

```js
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType(value: any, type: Function): {
    valid: boolean;
    expectedType: string;
} {
    let valid;

    // 获取该类型的函数名称，即Object则返回Object字符串
    const expectedType = getType(type);

    // 这里的普通值检查使用的typeof，所以要进行区分
    if (simpleCheckRE.test(expectedType)) {
        const t = typeof value;
        valid = t === expectedType.toLowerCase()
        // for primitive wrapper objects
        if (!valid && t === 'object') {
            valid = value instanceof type
        }

    // 单独检测普通对象
    } else if (expectedType === 'Object') {
        valid = isPlainObject(value);

    // 效验数组
    } else if (expectedType === 'Array') {
        valid = Array.isArray(value);

    // 自定义构造函数的值也能进行效验
    } else {
        valid = value instanceof type
    }
    return {
        valid,
        expectedType
    }
}
```

## proxy()——代理访问属性

该方法用于便于某个对象代理访问另一个对象的属性：

```js
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
