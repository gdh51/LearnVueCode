# Route-当前路径对象

在最初加载`Vue-Router`库时，会自动初始化一个基础的路由路径对象：

```js
// the starting route that represents the initial state
// 标识初始状态的起始路径
export const START = createRoute(null, {
  path: '/'
});
```

注释说它表示最初的状态，那么带着疑问我们继续看创建它的函数：

```js
function createRoute(

    // 当前匹配到的路由信息对象
    record: ? RouteRecord,

    // 即将要跳转的路由地址对象
    location : Location,

    // 需要重定向的路由地址对象
    redirectedFrom ? : ? Location,
    router ? : VueRouter
): Route {

    // 获取用户提供的提取查询字符串的自定义函数
    const stringifyQuery = router && router.options.stringifyQuery;

    // 提取当前地址的查询字符串对象
    let query: any = location.query || {}
    try {
        // 深度克隆query对象
        query = clone(query)
    } catch (e) {}

    // 生成以即将要跳转的路径为基础的路由信息对象
    const route: Route = {
        name: location.name || (record && record.name),
        meta: (record && record.meta) || {},
        path: location.path || '/',
        hash: location.hash || '',
        query,
        params: location.params || {},

        // 返回完整的URL地址
        fullPath: getFullPath(location, stringifyQuery),

        // 将当前路由及其所有父级路由按父->子的顺序添加到该数组
        matched: record ? formatMatch(record) : []
    }

    // 如果是从定向，那么还要记录从定向之前的地址
    if (redirectedFrom) {
        route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
    }

    // 返回该当前路径生成的路径信息对象，并不允许修改
    return Object.freeze(route)
}
```

这里我们可以直接从完整的函数看出，这就是一个根据当前**路由记录对象**与当前**页面的位置信息对象**生成的一个的一个当前路由位置的信息对象。所以上面的`START`表示的是最初的位置信息对象。

## 路径信息对象的使用

在具体的路由跳转时，会进行一个路由表的匹配，此时根据对应匹配到的路由信息就会最终产生一个该对象；即使没有匹配到时，也会产生一个空对象来进行代替。

## 使用到的工具方法

上面使用到了几个工具方法，这里逐一进行解释：

- [clone()——深度克隆对象浅克隆数组](#clone%e6%b7%b1%e5%ba%a6%e5%85%8b%e9%9a%86%e5%af%b9%e8%b1%a1%e6%b5%85%e5%85%8b%e9%9a%86%e6%95%b0%e7%bb%84)
- [getFullPath()——返回完整的URL](#getfullpath%e8%bf%94%e5%9b%9e%e5%ae%8c%e6%95%b4%e7%9a%84url)
- [formatMatch()——返回匹配的路由记录](#formatmatch%e8%bf%94%e5%9b%9e%e5%8c%b9%e9%85%8d%e7%9a%84%e8%b7%af%e7%94%b1%e8%ae%b0%e5%bd%95)

### clone()——深度克隆对象浅克隆数组

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

### getFullPath()——返回完整的URL

该方法根据提供的查询字符串对象和URL对象，返回一个除协议外完整的URL地址

```js
function getFullPath({
        path,
        query = {},
        hash = ''
    },
    _stringifyQuery
): string {

    // 优先使用用户定义的提取查询字符串函数，否则使用默认的
    const stringify = _stringifyQuery || stringifyQuery;

    // 返回完整的URL地址
    return (path || '/') + stringify(query) + hash
}
```

### formatMatch()——返回匹配的路由记录

该方法用于返回当前路径所以的匹配的所有记录对象，目前还不知其用途。

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
