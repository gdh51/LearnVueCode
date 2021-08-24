# 一些常用的工具方法

这里会记录一些经常全局使用的工具方法

目录

- [cached()——缓存函数](#cached%e7%bc%93%e5%ad%98%e5%87%bd%e6%95%b0)
- [makeMap()——hash表函数](#makemaphash%e8%a1%a8%e5%87%bd%e6%95%b0)

## cached()——缓存函数

该函数利用闭包来缓存一个函数的返回值，当传入旧值时会直接返回结果，因为比较常见，就不用介绍了：

```js
export function cached < F: Function > (fn: F): F {

    // 将函数结果存储在该对象中
    const cache = Object.create(null);
    return (function cachedFn(str: string) {

        // 是否命中缓存
        const hit = cache[str];

        // 命中缓存时直接返回，否则重新调用函数取值并缓存
        return hit || (cache[str] = fn(str));
    }: any)
}
```

## makeMap()——hash表函数

该函数用来生成一个哈希表，传入一个字符串字段，会将其中包含的所有键分别存入这个表中；用来确认一个值是否存在于其中。

```js
function makeMap(
    str: string,
    expectsLowerCase ? : boolean
): (key: string) => true | void {

    // 存储这些键
    const map = Object.create(null);
    const list: Array < string > = str.split(',');

    // 分别将这些值存入map表中
    for (let i = 0; i < list.length; i++) {
        map[list[i]] = true;
    }

    // 返回一个表用于检测是否存在传入的键
    return expectsLowerCase ?
        val => map[val.toLowerCase()] :
        val => map[val]
}
```