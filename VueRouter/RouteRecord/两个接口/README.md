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

在具有`name`的`Location`的情况下比较暴力，直接取对应的剧名`RouteRecord`就行，之后通过`params`补全`path`上的动态参数：

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

        // 过滤掉可选的动态参数
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

    // 填充动态参数至RouteRecord.path
    location.path = fillParams(record.path, location.params, `named route "${name}"`)

    // 创建新的路径对象返回
    return _createRoute(record, location, redirectedFrom);
}
```

#### 具有path的Location对象

对于`path`的情况，比较简单，就是在`pathList`中按`RouteConfig`定义的优先级顺序一个一个的对比，知道完全匹配这个`path`，匹配则创建`Route`并返回，不匹配则返回空`Route`。

```js
if (location.path) {

    location.params = {};

    // 遍历路径列表查找于路径匹配的RouteRecord
    for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i];
        const record = pathMap[path];

        // 查询匹配到的路由，将path中的动态参数填充到params中
        if (matchRoute(record.regex, location.path, location.params)) {

            // 为即将跳转路径填充params参数
            return _createRoute(record, location, redirectedFrom)
        }
    }
}
```

其中[`matchRoute()`](../工具方法/README.md#查找与path匹配的routerecordmatchroute)的含义实际为看`RouteRecord`的`path`正则表达式是否匹配当前要跳转的`Location`对象的`path`，如果匹配则提取`RouteRecord`的动态参数作为键值对，存放入`Location.params`中。

____
那么无论是哪种方式，最终都是通过`_createRoute()`来创建`Route`。而`_createRoute()`是对`createRoute()`的封装。我们知道`createRoute()`用于创建`Route`，而`_createRoute()`主要是对重定向、别名路径跳转这些特殊跳转的处理。

```js
function _createRoute(

    // 当前匹配到(即将要跳转)的RouteRecord
    record: ? RouteRecord,

    // 当前(即将要跳转)的路径信息对象
    location : Location,

    // 重定向的地址的路径信息对象
    redirectedFrom ? : Location
): Route {

    // 如果该路径定义有重定向，则进行重定向
    if (record && record.redirect) {
        return redirect(record, redirectedFrom || location)
    }

    // 如果RouteRecord存在别名，优先进行别名路径查询
    if (record && record.matchAs) {
        return alias(record, location, record.matchAs)
    }

    // 其余情况则创建一个新的路径信息对象返回
    return createRoute(record, location, redirectedFrom, router)
}
```

普通的`RouteRecord`就会直接创建`Route`来结束掉整个创建流程。而如果当前`RouteRecord`存在重定向属性，或为别名创建的`RouteRecord`，那么会调用[`redirect()`](#重定向routerecordredirect)与[`alias()`](#别名跳转alias)方法来重定向和生成别名`Route`，这里就不细说了，具体自行查看。

>如果你忘记[`createRoute()`](../../Route-当前路径对象/README.md#创建route的流程)里面有什么了，可以在看看。

____
创建完`Route`后，让我们继续回到[提交`Route`](../../路由模式/base基础模式/实例方法/README.md#提交route进行切换historyconfirmtransition)。

## 重定向RouteRecord——redirect()

当我们遇到一个重定向的`RouteRecord`时，则会在其基础之上进行重定向，具体的重定向行为看其`redirect`字段的返回值。同样有两种情况：

- 返回的`Raw Location`对象具有`name`字段
- 返回的`Raw Location`对象具有`path`字段

在`name`字段的情况下，拥有绝对的优先级，直接取对于`name`下的`RouteRecord`重新进行`match()`流程；对于`path`情况，重定向的`path`可以为相对路径，它会基于重定向前的`path`进行跳转(相对路径行为为`append`)。

```js
function redirect(

    // 即将要跳转的RouteRecord
    record: RouteRecord,

    // 即将要跳转的Location
    location: Location
): Route {

    // 获取重定向地址
    const originalRedirect = record.redirect

    // 如果定义的重定向地址为函数，则创建一个即将跳转的Route传入后调用
    let redirect = typeof originalRedirect === 'function' ?
        originalRedirect(createRoute(record, location, null, router)) :
        originalRedirect

    // 重新获取重定向后的Raw Location对象
    if (typeof redirect === 'string') {
        redirect = {
            path: redirect
        }
    }

    // 返回的Raw Location对象非对象或字符串时，报错
    if (!redirect || typeof redirect !== 'object') {
        if (process.env.NODE_ENV !== 'production') {
            warn(
                false, `invalid redirect option: ${JSON.stringify(redirect)}`
            )
        }
        return _createRoute(null, location)
    }

    // 获取重定向的Raw Location对象
    const re: Object = redirect;
    const {
        name,
        path
    } = re;

    // 为其填充query/hash/params等参数
    let {
        query,
        hash,
        params
    } = location;
    query = re.hasOwnProperty('query') ? re.query : query;
    hash = re.hasOwnProperty('hash') ? re.hash : hash;
    params = re.hasOwnProperty('params') ? re.params : params;

    // 如果返回的Raw Location对象为命名路由
    if (name) {
        // resolved named direct
        const targetRecord = nameMap[name]
        if (process.env.NODE_ENV !== 'production') {
            assert(targetRecord, `redirect failed: named route "${name}" not found.`)
        }

        // 直接创建标准化的Location对象重新走match流程
        return match({
            _normalized: true,
            name,
            query,
            hash,
            params
        }, undefined, location);

    // 如果重定向Raw Location为path类型
    } else if (path) {

        // 1. resolve relative redirect
        // 1. 重定向的path可以以重定向前path进行相对跳转
        const rawPath = resolveRecordPath(path, record);

        // 2. resolve params
        // 2. 填充动态参值
        const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)

        // 3. rematch with existing query and hash
        // 3. 重新调用match匹配重定向后的RouteRecord
        return match({
            _normalized: true,
            path: resolvedPath,
            query,
            hash
        }, undefined, location);

    // 剩余情况就报错
    } else {
        if (process.env.NODE_ENV !== 'production') {
            warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
        }
        return _createRoute(null, location)
    }
}
```

在它们的重新`match()`过程，传入的`Loaction`对象为已标准化的对象，可以直接进行`name/path`的匹配。

## 别名跳转——alias()

在我们要跳转的`RouteRecord`为`alias`别名生成的`RouteRecord`，我们就要通过该方法来进行别名跳转。之后其会将别名`RouteRecord`重定向为真实`RouteRecord`，并结合重定向`Location`对象来生成最终的`Route`。如果别名的真实`RouteRecord`存在重定向等配置，那么也会正常重定向。

```js
function alias(

    // 别名跳转的RouteRecord（即别名跳转的RouteRecord）
    record: RouteRecord,

    // 别名跳转的Location对象
    location: Location,

    // 别名对应的真实路径
    matchAs: string
): Route {

    // 填充真实path中的动态参数
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)

    // 重新走match匹配，获取真实的Route
    const aliasedMatch = match({
        _normalized: true,
        path: aliasedPath
    });

    // 如果获取到了Route
    if (aliasedMatch) {

        // 获取其匹配的RouteRecords
        const matched = aliasedMatch.matched;

        // 取精准匹配的那个RouteRecord
        const aliasedRecord = matched[matched.length - 1];

        // 创建新的Route，利用真实的RouteRecord和别名的Location
        location.params = aliasedMatch.params;
        return _createRoute(aliasedRecord, location);
    }

    // 未匹配时，生成空的Record
    return _createRoute(null, location)
}
```