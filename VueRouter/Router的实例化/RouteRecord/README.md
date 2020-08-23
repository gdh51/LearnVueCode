# RouteRecord——路由表

在`VueRouter`中，为什么它能根据当前的`URL Path`来加载不同的组件，其原理就是在初始化`Router`时，其会将我们定义的`routes`中的一个个路由信息(`RouteConfig`)转化为一张路由表(`RouteRecord`)，并且会根据我们定义路由的顺序，影响路由表渲染组件优先级的权重。

整个路由表(`RouteRecord`)由`createMatcher()`函数通过传入`routes`创建：

```js
// 根据路由配置创建3个不同类型的RouteRecord
this.matcher = createMatcher(options.routes || [], this);
```

该函数会创建三个不同形式的路由表(实际上为一个，另外两个为一个查询`Map`)，这些表不会向外部暴露，会存储在闭包中，仅暴露两个接口来进行`RouteRecord`的查询，其具体的函数为：

```js
function createRouteMap(

    // 原始的路由配置对象(option.routes)
    routes: Array < RouteConfig > ,

    // 以下三个参数为之前该函数输出结果，
    // 主要用于addRoutes函数添加新的路由信息
    oldPathList ? : Array < string > ,
    oldPathMap ? : Dictionary < RouteRecord > ,
    oldNameMap ? : Dictionary < RouteRecord >
): {
    pathList: Array < string > ,
    pathMap: Dictionary < RouteRecord > ,
    nameMap: Dictionary < RouteRecord >
} {
    // the path list is used to control path matching priority
    // 一个具有匹配权重的RouteRecords表
    const pathList: Array < string > = oldPathList || [];

    // 按路由地址path->RouteRecord的Map
    const pathMap: Dictionary < RouteRecord > = oldPathMap || Object.create(null);

    // 按路由名称name->RouteRecord的Map
    const nameMap: Dictionary < RouteRecord > = oldNameMap || Object.create(null);

    // 遍历，将RouteConfig中的路由信息添加到三个表中
    routes.forEach(route => {
        addRouteRecord(pathList, pathMap, nameMap, route);
    });

    // ensure wildcard routes are always at the end
    // 确保通配符路径永远在权重表的最后
    for (let i = 0, l = pathList.length; i < l; i++) {

        // 找到通配符路径将其添加到路径表数组
        if (pathList[i] === '*') {
            pathList.push(pathList.splice(i, 1)[0]);
            l--;
            i--;
        }
    }

    if (process.env.NODE_ENV === 'development') {

        // warn if routes do not include leading slashes
        // 每个RouteConfig的path都必须在首部以/开头
        const found = pathList
            // check for missing leading slash
            .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

        // 否则警告
        if (found.length > 0) {
            const pathNames = found.map(path => `- ${path}`).join('\n')
            warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
        }
    }

    // 返回三个记录路由情况的对象
    return {
        pathList,
        pathMap,
        nameMap
    };
}
```

我们可以从上述函数中看出，该函数通过一个闭包，来存储`RouteRecord`，如何通过接口的`match`函数来匹配`RouteRecord`创建`Route`。(这个之后在单独说)

具体的创建过程由`createRouteMap()`函数来创建。该函数的主要作用就是递归调用`addRouteRecord()`函数来向三种路由表中添加`RouteRecord`，该函数的主要逻辑为：

```js
function createRouteMap(

    // 原始的路由配置对象(option.routes)
    routes: Array < RouteConfig > ,

    // 以下三个参数为之前该函数输出结果，用于添加新的路由信息
    oldPathList ? : Array < string > ,
    oldPathMap ? : Dictionary < RouteRecord > ,
    oldNameMap ? : Dictionary < RouteRecord >
): {
    pathList: Array < string > ,
    pathMap: Dictionary < RouteRecord > ,
    nameMap: Dictionary < RouteRecord >
} {
    // the path list is used to control path matching priority
    // 一个用于匹配路径的路径表
    const pathList: Array < string > = oldPathList || [];

    // 路径到对应路由信息的映射表
    const pathMap: Dictionary < RouteRecord > = oldPathMap || Object.create(null);

    // 命名路由到路由信息的映射表
    const nameMap: Dictionary < RouteRecord > = oldNameMap || Object.create(null);

    // 遍历，将原始路由中的路由信息添加到三个表中
    routes.forEach(route => {
        addRouteRecord(pathList, pathMap, nameMap, route);
    });

    // ensure wildcard routes are always at the end
    // 确保通配符路径永远在转化后路由表数组的最后
    for (let i = 0, l = pathList.length; i < l; i++) {

        // 找到通配符路径将其添加到路径表数组
        if (pathList[i] === '*') {
            pathList.push(pathList.splice(i, 1)[0]);
            l--;
            i--;
        }
    }

    if (process.env.NODE_ENV === 'development') {

        // warn if routes do not include leading slashes
        // 每个路由地址都必须在首部以/开头
        const found = pathList
            // check for missing leading slash
            .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

        // 否则警告
        if (found.length > 0) {
            const pathNames = found.map(path => `- ${path}`).join('\n')
            warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
        }
    }

    // 返回三个记录路由情况的对象
    return {
        pathList,
        pathMap,
        nameMap
    }
}
```

这里先看一个具体的配置和其生成的结果：

```js
// 配置如下：
const routes = [{
        path: '/foo',
        component: Foo,
        name: 'fa',
        children: [
            {
                path: 'bar',
                name: 'fa.son',
                component: Bar
            }
        ]
    }
];
```

生成的结果如图：
![三个路由表](./imgs/三个路由表.png)

那么知道了前后生成结果，那么我们现在可以来看一下具体的中间过程了，上述代码中核心的一段就是：

```js
// 遍历，将原始路由中的路由信息添加到三个表中
routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
});
```

它的作用就是通过的`addRouteRecord()`方法，向`pathList/pathMap/nameMap`三者上添加路由路径表。

## 路由表的生成——addRouteRecord()

`addRouteRecord()`方法根据我们最初配置的路由表数组(`routes`)，将其与其子路由信息全部添加到三个不同的路由表对象中，这里我们按代码从上到下依次来浏览，那么总体可以按照以下步骤来归纳：

1. [路由信息对象的生成](#%e8%b7%af%e7%94%b1%e4%bf%a1%e6%81%af%e8%ae%b0%e5%bd%95%e5%af%b9%e8%b1%a1)
2. [递归生成子路由信息对象](#%e9%80%92%e5%bd%92%e7%94%9f%e6%88%90%e5%ad%90%e8%b7%af%e7%94%b1%e4%bf%a1%e6%81%af%e5%af%b9%e8%b1%a1)
3. [记录当前路由信息并为别名生成路由信息](#%e8%ae%b0%e5%bd%95%e5%bd%93%e5%89%8d%e8%b7%af%e7%94%b1%e4%bf%a1%e6%81%af%e5%b9%b6%e4%b8%ba%e5%88%ab%e5%90%8d%e7%94%9f%e6%88%90%e8%b7%af%e7%94%b1%e4%bf%a1%e6%81%af)

### 路由信息记录对象

该方法要做的第一件事情就是为当前的路径配置对象生成一个`record`路径信息记录对象，它记录了该路由有关的所有信息：

```js
// 提取配置中的路由地址和组件名称
const {
    path,
    name
} = route;

// 为没配置path的用户报错
if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
        typeof route.component !== 'string',
        `route config "component" for path: ${String(
    path || name
  )} cannot be a ` + `string id. Use an actual component instead.`
    )
}

// 2.6新增api，用于将控制正则表达式路由规则的解析行为
const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {};

// 标准化格式化用户配置的路径
const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

// 路由路径匹配规则是否大小写敏感
if (typeof route.caseSensitive === 'boolean') {

    // 同步正则表达式的大小写敏感规则
    pathToRegexpOptions.sensitive = route.caseSensitive
}

// 输入路由信息
const record: RouteRecord = {
    path: normalizedPath,

    // 根据path生成一份正则表达式
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),

    // 该路由路径下代表的组件(默认情况下存放于default)
    components: route.components || {
        default: route.component
    },

    // 组件生成的vm实例
    instances: {},

    // 当前路由名称
    name,
    parent,

    // 别名路由匹配的真实路径
    matchAs,

    // 路由重定向路径
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,

    // 路由信息元参数对象，记录该路由的信息
    meta: route.meta || {},

    // 是否将组件参数信息设置为组件实例属性
    props: route.props == null ?

        // 未定义传入组件的参数时，初始化为空对象
        {} :

        // 是否定义有子组件视图
        route.components ?

        // 当定义有命名视图时，则使用原定义
        route.props :

        // 未有命名视图时，则存放在默认位置中
        {
            default: route.props
        }
}
```

上述部分比较简单，不用过渡深究，其中生成`path`所用的[`normalizePath()`](./工具方法/README.md#normalizepath%e6%a0%87%e5%87%86%e5%8c%96%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%84)方法与将其`path`生成正则表达式的[`compileRouteRegex()`](./工具方法/README.md#compilerouteregex%e6%a0%b9%e6%8d%ae%e8%b7%af%e5%be%84%e7%94%9f%e6%88%90%e6%ad%a3%e5%88%99%e8%a1%a8%e8%be%be%e5%bc%8f)方法，该方法具体是使用的[`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)这个库，具体就不说明了。

综上，我们可以从其中看到还有个`pathToRegexpOptions`属性(`Vue`文档中并未说明具体配置项)可以配置在路由信息中，这个属性就是用来控制路径转换为正则表达式时的行为的，具体就与[`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)库的配置对齐。

### 递归生成子路由信息对象

接下来便是处理路由中的嵌套路由了，这里就比较普通，但是要预防一个问题，就是在配置子路由时，如果不配置其子路由路径且配置了父录路由的名称，此时跳转至父路由时，就不会触发子路由组件的刷新。

```js
// 是否设置子路由路径
if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    // 警告：如果该路由为命名路由，则不要重定向或有一个默认的子路由
    // 如果用户通过路由名称跳转到该路由时，该默认子组件不会被重新渲染
    if (process.env.NODE_ENV !== 'production') {

        // 命名路由，不具有重定向但不具有具体的子路由路径
        if (
            route.name &&
            !route.redirect &&

            // 路径是否为单独的/或为空字符串
            route.children.some(child => /^\/?$/.test(child.path))
        ) {
            warn(
                false,
                `Named Route '${route.name}' has a default child route. ` +
                `When navigating to this named route (:to="{name: '${
            route.name
        }'"), ` +
                `the default child route will not be rendered. Remove the name from ` +
                `this route and use the name of the default child route for named ` +
                `links instead.`
            )
        }
    }

    // 遍历子路由数组，将其添加到记录中
    route.children.forEach(child => {
        const childMatchAs = matchAs ?
            cleanPath(`${matchAs}/${child.path}`) :
            undefined;

        // 递归调用该方法添加子路由
        addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
}
```

除此之外，这里我们还需要注意的是，当我们使用路由的别名时，此时`matchAs`参数为原路由路径的前缀。之后便是调用`addRouteRecord()`生成子路由记录信息对象，注意此时的子路由名称会发生变化。

### 记录当前路由信息并为别名生成路由信息

最后将当前路由信息对象加入到三个路由表中，同时，如果路由具有别名，同样要为其别名生成一个一样的路由记录信息对象，这里就不再多做阐述：

```js
// 如果Map中不存在该地址，则分别存入pathList与pathMap
if (!pathMap[record.path]) {
    pathList.push(record.path);
    pathMap[record.path] = record;
}

// 如果路由存在任何形式的别名
if (route.alias !== undefined) {

    // 格式化别名为数组，并依次添加为一个单独的路由
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
    for (let i = 0; i < aliases.length; ++i) {
        const alias = aliases[i];

        // 禁止别名与路径值重复
        if (process.env.NODE_ENV !== 'production' && alias === path) {
            warn(
                false,
                `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
            )
            // skip in dev to make it work
            continue
        }

        // 将别名作为一个新的路由也添加到路由表中
        const aliasRoute = {
            path: alias,
            children: route.children
        };
        addRouteRecord(
            pathList,
            pathMap,
            nameMap,
            aliasRoute,
            parent,
            record.path || '/' // matchAs
            )
    }
}

// 如果具有路由名称，将其同时添加到路由名表中
if (name) {
    if (!nameMap[name]) {
        nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
        warn(
            false,
            `Duplicate named routes definition: ` +
            `{ name: "${name}", path: "${record.path}" }`
        )
    }
}
```

## 处理通配符和不正规的路径

处理完三个路由表信息对象后，在`createRouteMap()`函数的最后处理通配符对象，始终要使其在`pathList`的最后，以便无路由匹配时，使用它；同时限制路由路径必须以`/`开头。

```js
// ensure wildcard routes are always at the end
// 确保通配符路径永远在路由表数组的最后
for (let i = 0, l = pathList.length; i < l; i++) {

    // 找到通配符路径将其添加到路径表数组
    if (pathList[i] === '*') {
        pathList.push(pathList.splice(i, 1)[0])
        l--
        i--
    }
}

if (process.env.NODE_ENV === 'development') {

    // warn if routes do not include leading slashes
    // 除*外每个路由地址都必须在首部以/开头
    const found = pathList
        // check for missing leading slash
        .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    // 否则警告
    if (found.length > 0) {
        const pathNames = found.map(path => `- ${path}`).join('\n')
        warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
}
```

到此为止，三个路由表就全部生成了！

最后，值得注意的是这三个对象并未直接返回暴露给外界，相反，提供了两个接口来提供用户操作：

```js
return {
    match,
    addRoutes
};
```

## 暴露给外界的两个接口

在`createRouteMap()`函数调用后，返回了两个接口函数：

```js
return {
    match,
    addRoutes
};
```

前者用于从路由表中匹配对应的路由路径地址，然后返回一个当前路径地址对象，后者就是用于动态添加一个新的路由路径，流程和`createRouteMap()`方法一样，不同的是此时会在原有的三张表上添加：

```js
function addRoutes(routes) {

    // 添加新的路由路径，在原3表的基础上
    createRouteMap(routes, pathList, pathMap, nameMap)
}
```

其次是`match()`函数，它用于匹配当前传入的**当前位置信息对象**来生成一个**当前路径信息对象**，也就是我们即将要跳转的最终地址的信息。

```js
function match(

    // 当前的路径字符串(包括hash)或一个路径信息的对象
    raw: RawLocation,

    // 当前的路由地址的信息对象
    currentRoute ? : Route,
    redirectedFrom ? : Location
): Route {

    // 结合当前路径对象与将来的路径对象参数生成将来的路径对象
    const location = normalizeLocation(raw, currentRoute, false, router);
    const {
        name
    } = location;

    // 如果将来的路径对象指定了组件名称
    if (name) {

        // 取出指定路径下的路由信息对象
        const record = nameMap[name];
        if (process.env.NODE_ENV !== 'production') {
            warn(record, `Route with name '${name}' does not exist`)
        }

        // 如果没有该组件，则返回一个空路径信息对象
        if (!record) return _createRoute(null, location);
        const paramNames = record.regex.keys
            .filter(key => !key.optional)
            .map(key => key.name)

        if (typeof location.params !== 'object') {
            location.params = {}
        }

        // 将剩余的路径参数复制进location中
        if (currentRoute && typeof currentRoute.params === 'object') {
            for (const key in currentRoute.params) {
                if (!(key in location.params) && paramNames.indexOf(key) > -1) {
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

        // 返回匹配路径的路由对象
        location.params = {}
        for (let i = 0; i < pathList.length; i++) {
            const path = pathList[i];
            const record = pathMap[path];

            // 查询匹配到的路由，同name一样创建一个路径信息对象返回
            if (matchRoute(record.regex, location.path, location.params)) {
                return _createRoute(record, location, redirectedFrom)
            }
        }
    }

    // no match
    // 无匹配时返回个空路径信息对象
    return _createRoute(null, location)
}
```

该函数大致的思路就是根据我们即将要跳转的当前位置信息对象，去匹配对应的路由表上的路由对象，找到匹配的路由对象则创建一个新的路径信息对象返回，否则返回一个空的路径信息对象，具体最终的路径信息对象的创建由`_createRoute()`函数来完成，它负责处理路由跳转的类型：重定向、别名、直接跳转：

```js
function _createRoute(

    // 当前匹配到的路由信息对象
    record: ? RouteRecord,

    // 当前的路径信息对象(未处理完全的)
    location : Location,

    // 重定向的地址的路径信息对象
    redirectedFrom ? : Location
): Route {

    // 优先进行重定向
    if (record && record.redirect) {
        return redirect(record, redirectedFrom || location)
    }

    // 其次进行别名跳转
    if (record && record.matchAs) {
        return alias(record, location, record.matchAs)
    }

    // 其余情况则创建一个新的路径信息对象返回
    return createRoute(record, location, redirectedFrom, router)
}
```

无论是哪种跳转，最终的路径信息对象的创建都是通过`createRoute()`函数来完成：

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

该函数并不负责，我们的主要关注点就是其中的`route.matched`属性，它表示的匹配到的路径下的组件及其父组件，待会会用于视图的渲染。
