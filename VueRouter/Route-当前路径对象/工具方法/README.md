# Route中使用到的工具方法

在`createRoute()`中涉及到的工具方法，下面继续单独解释：

- [clone()——深度克隆对象浅克隆数组](#clone%e6%b7%b1%e5%ba%a6%e5%85%8b%e9%9a%86%e5%af%b9%e8%b1%a1%e6%b5%85%e5%85%8b%e9%9a%86%e6%95%b0%e7%bb%84)
- [getFullPath()——返回完整的URL](#getfullpath返回完整的url路径)
- [formatMatch()——返回匹配的路由记录](#formatmatch返回匹配的routerecord)

## clone()——深度克隆对象浅克隆数组

这里就不用说明了，大家面试时估计经常写：

```js
// 处数组浅克隆外，其他的进行深克隆
function clone(value) {
    if (Array.isArray(value)) {
        return value.map(clone)
    } else if (value && typeof value === 'object') {
        const res = {}
        for (const key in value) {
            res[key] = clone(value[key])
        }
        return res
    } else {
        return value
    }
}
```

## getFullPath()——返回完整的URL路径

该方法根据提供的查询字符串对象和URL对象，返回一个除协议外完整的URL地址

```js
// 获取完整的URL路径
function getFullPath({
        path,
        query = {},
        hash = ''
    },
    _stringifyQuery
): string {

    // 优先使用用户定义的提取查询字符串函数，否则使用默认的
    const stringify = _stringifyQuery || stringifyQuery;

    // 返回完整的URL路径
    return (path || '/') + stringify(query) + hash;
}
```

## formatMatch()——返回匹配的RouteRecord

该方法用于返回当前路径所匹配的`RouteRecord`中上下游的全部`RouteRecord`，以便在后续渲染中判断从哪个层级进行组件的渲染更新。

```js
// 将当前匹配到路由信息对象及其父路由一起提取出来
function formatMatch(record: ? RouteRecord): Array < RouteRecord > {
    const res = [];

    // 将此路径下所有的路由记录对象添加到res数组中
    // 顺序按从父->子
    while (record) {
        res.unshift(record)
        record = record.parent
    }
    return res;
}
```

整个`RouteRecord`的排列顺序为 **父 -> 子**
