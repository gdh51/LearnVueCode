# Matcher的两个接口

在我们创建`RouteRecords`时，是暴露除了两个接口的：

```js
return {
    match,
    addRoutes
};
```

这里面比较重要的是`match()`接口，`addRoutes()`接口仅用于一个后续的`RouteRecord`补充。

## 匹配RouteRecord，创建Route——match()

就如标题所说，该方法用于创建`Route`，具体是通过传入的`Location`对象来决定，先**简单**看下该函数具体代码，比较复杂，如果你对`VueRouter`的`api`比较熟悉，那么可能理解起来比较容易：

```js
function match(

    // 当前的路径字符串(包括hash)或一个路径信息的对象
    raw: RawLocation,

    // 当前的路由路径记录对象Route（也即跳转前的）
    currentRoute ? : Route,
    redirectedFrom ? : Location
): Route {

    // 结合当前路径对象与将来的路径对象参数生成将来的Location
    const location = normalizeLocation(raw, currentRoute, false, router);

    // 优先查看Location是否制定命名路由
    const {
        name
    } = location;

    if (name) {

        // 取出指定命名路由的RouteRecord
        const record = nameMap[name];
        if (process.env.NODE_ENV !== 'production') {
            warn(record, `Route with name '${name}' does not exist`)
        }

        // 如果没有该组件，则返回一个空路由路径记录对象Route
        if (!record) return _createRoute(null, location);

        // 返回动态参数的名称组成的数组
        const paramNames = record.regex.keys
            .filter(key => !key.optional)
            .map(key => key.name)

        if (typeof location.params !== 'object') {
            location.params = {}
        }

        // 填充Location对象缺失的动态路径参数值
        // 如果之前的Route存在路径参数
        if (currentRoute && typeof currentRoute.params === 'object') {

            // 则遍历它的对象字段
            for (const key in currentRoute.params) {

                // 前路由路径参数字段不存在当前跳转路径中时且该参数为路径必须的动态参数时
                if (!(key in location.params) && paramNames.indexOf(key) > -1) {

                    // 将跳转路径继承上一个路由的Route的字段值
                    location.params[key] = currentRoute.params[key]
                }
            }
        }

        // 将参数与当前路径合并为完成的路径
        location.path = fillParams(record.path, location.params, `named route "${name}"`)

        // 创建新的路径对象返回
        return _createRoute(record, location, redirectedFrom);

    // 当指定了跳转的路径时
    } else if (location.path) {

        location.params = {};

        // 遍历路径列表查找于路径匹配的RouteRecord
        for (let i = 0; i < pathList.length; i++) {
            const path = pathList[i];
            const record = pathMap[path];

            // 查询匹配到的路由，并填充其路径中的动态参数
            if (matchRoute(record.regex, location.path, location.params)) {

                // 为即将跳转路径填充params参数
                return _createRoute(record, location, redirectedFrom)
            }
        }
    }

    // no match
    // 无匹配时返回个空路径信息对象
    return _createRoute(null, location)
}
```

首先是一个对跳转的`Raw Location`的一个格式化，这个非常重要：

```js
// 结合当前路径对象与将来的路径对象参数生成将来的Location
const location = normalizeLocation(raw, currentRoute, false, router);
```

具体调用的是[`normalizeLocation()`](../工具方法/README.md#normalizeLocation()——标准化路径地址对象)

### 新的Route的创建

得到了标准的`Location`对象，那么我们就可以在其基础之上进行新的`Route`的创建了。

整个创建依据两个变量：`name`和`path`，没有就是卵的，那么你就该反思下自己的问题了。那么首先是根据`name`的创建。

#### 具有name的Location对象

在具有`name`的`Location`的情况下比较暴力，直接取对应的剧名`RouteRecord`就行，之后在补全`path`、`params`等参数：

```js
if (name) {

    // 取出指定命名路由的RouteRecord
    const record = nameMap[name];
    if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
    }

    // 如果没有该组件，则返回一个空路由路径记录对象Route
    if (!record) return _createRoute(null, location);

    // 返回动态参数的名称组成的数组
    const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

    if (typeof location.params !== 'object') {
        location.params = {}
    }

    // 填充Location对象缺失的动态路径参数值
    // 如果之前的Route存在路径参数
    if (currentRoute && typeof currentRoute.params === 'object') {

        // 则遍历它的对象字段
        for (const key in currentRoute.params) {

            // 前路由路径参数字段不存在当前跳转路径中时且该参数为路径必须的动态参数时
            if (!(key in location.params) && paramNames.indexOf(key) > -1) {

                // 将跳转路径继承上一个路由的Route的字段值
                location.params[key] = currentRoute.params[key]
            }
        }
    }

    // 将参数与当前路径合并为完成的路径
    location.path = fillParams(record.path, location.params, `named route "${name}"`)

    // 创建新的路径对象返回
    return _createRoute(record, location, redirectedFrom);
}
```

#### 具有path的Location对象
