# 工具方法

目录：

- [looseEqual()——松散相等](#looseequal%e6%9d%be%e6%95%a3%e7%9b%b8%e7%ad%89)
- [looseIndexOf()——第一个满足松散相等值的下标](#looseindexof%e7%ac%ac%e4%b8%80%e4%b8%aa%e6%bb%a1%e8%b6%b3%e6%9d%be%e6%95%a3%e7%9b%b8%e7%ad%89%e5%80%bc%e7%9a%84%e4%b8%8b%e6%a0%87)

## looseEqual()——松散相等

和全等(`===`)不同，该函数用于判断两个值是否大致相等，大致相等的意思是假如有两个对象，它们大致相等的条件是其对应属性个数，与对应的原始属性如果相等则相等；如果为对象则继续递归进行判断。这里其实还是判断原始值是否相等，但是对于对象，它放松了要求，不要求其严格意义上的全等。

```js
/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 * 检查两个值是否大致相等，意思是如果为两个对象，那么它们对应的键和值等吗
 */
export function looseEqual(a: any, b: any): boolean {

    // 如果全等，则直接返回
    if (a === b) return true;
    const isObjectA = isObject(a);
    const isObjectB = isObject(b);

    // 如果两者都为对象
    if (isObjectA && isObjectB) {
        try {
            const isArrayA = Array.isArray(a)
            const isArrayB = Array.isArray(b)

            // 两者都为数组时，递归检测其每一个值是否松散相等
            if (isArrayA && isArrayB) {
                return a.length === b.length && a.every((e, i) => {
                    return looseEqual(e, b[i])
                });

            // 两个都为日期对象时，获取其时间是否相等
            } else if (a instanceof Date && b instanceof Date) {
                return a.getTime() === b.getTime();

            // 两个都为普通对象时，在其键值对个数一样的情况，下递归其各个值看是否相等
            } else if (!isArrayA && !isArrayB) {
                const keysA = Object.keys(a)
                const keysB = Object.keys(b)
                return keysA.length === keysB.length && keysA.every(key => {
                    return looseEqual(a[key], b[key])
                });
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }

    // 两者都不为对象时，且不全等时，则有可能为symbol，查看其值是否一样
    } else if (!isObjectA && !isObjectB) {
        return String(a) === String(b);
    } else {
        return false;
    }
}
```

## looseIndexOf()——第一个满足松散相等值的下标

该函数可以立即为`Array.prototype.indexOf()`方法的松散办，它不要求查找的元素值于目标值全等。

```js
/**
 * Return the first index at which a loosely equal value can be
 * found in the array (if value is a plain object, the array must
 * contain an object of the same shape), or -1 if it is not present.
 */
function looseIndexOf(arr: Array < mixed > , val: mixed): number {

    // 找到第一个数组中与val值松散相等的值的下标
    for (let i = 0; i < arr.length; i++) {
        if (looseEqual(arr[i], val)) return i
    }
    return -1
}
```