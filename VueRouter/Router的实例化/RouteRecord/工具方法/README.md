# 生成路由表期间使用的工具方法

这里汇总了生成路由表期间的各种工具方法：

- [normalizePath()——标准化路由路径](#normalizepath%e6%a0%87%e5%87%86%e5%8c%96%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%84)
- [compileRouteRegex()——根据路径生成正则表达式](#compilerouteregex%e6%a0%b9%e6%8d%ae%e8%b7%af%e5%be%84%e7%94%9f%e6%88%90%e6%ad%a3%e5%88%99%e8%a1%a8%e8%be%be%e5%bc%8f)

## normalizePath()——标准化路由路径

该方法用于标准化路径字符串，其中严格模式下，不允许路径以`/`结尾；对于绝对路径的地址，直接返回；非严格模式初始化时，直接返回原地址；其他情况清空其中的`//`后返回。

```js
function normalizePath(
    path: string,
    parent ? : RouteRecord,
    strict ? : boolean
): string {

    // 严格模式下，保留path末尾的 /
    if (!strict) path = path.replace(/\/$/, '')

    // 如果以/开头，则说明为相对路径，直接返回
    if (path[0] === '/') return path

    // 初始化时，直接返回地址
    if (parent == null) return path

    // 清空全部 //
    return cleanPath(`${parent.path}/${path}`)
}
```

## cleanPath()——清除路径中的//

该方法非常简单，就是清除传入其中值中的`//`

```js
// 清空全部 //
export function cleanPath(path: string): string {
    return path.replace(/\/\//g, '/');
}
```

## compileRouteRegex()——根据路径生成正则表达式

这个方法使用的是[`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)这个库来生成的正则表达式。

```js
function compileRouteRegex(
    path: string,
    pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {

    // 生成对应的正则表达式
    const regex = Regexp(path, [], pathToRegexpOptions);
    if (process.env.NODE_ENV !== 'production') {

        // 生成效验器防止填写重复的key值
        const keys: any = Object.create(null);
        regex.keys.forEach(key => {
            warn(
                !keys[key.name],
                `Duplicate param keys in route with path: "${path}"`
            )
            keys[key.name] = true
        })
    }
    return regex;
}
```

## normalizeLocation()——标准化路径地址对象

该函数用于处理即将要跳转的路径，与当前（上一个）路径对象的信息，来生成新的当前路径信息对象。

```js
// 该函数用于处理当前路由跳转的参数信息
function normalizeLocation(

    // 当前的路径字符串或其当前router-link指定的to对象
    raw: RawLocation,

    // 当前地址对应的路径地址对象（这里指未跳转前的）
    current: ? Route,

    // 是否添加到最后
    append : ? boolean,

    // 路由实例
    router : ? VueRouter
): Location {

    // 将路径字符串同一为对象形式(next就表示即将要跳转的路径)
    let next: Location = typeof raw === 'string' ? {
        path: raw
    } : raw;

    // named target
    // 如果已经标准化则直接返回处理后的结果
    if (next._normalized) {
        return next;

    // 如果跳转的为命名路由，则复制(某种意义上是深复制)其属性后直接返回
    } else if (next.name) {
        next = extend({}, raw);
        const params = next.params
        if (params && typeof params === 'object') {
            next.params = extend({}, params);
        }
        return next;
    }

    // relative params
    // 当无路径字符串但具有路径对象时，将其处理为当前路径下的子路径(即视为相对路径)
    if (!next.path && next.params && current) {
        next = extend({}, next);

        // 将其标记为已初始化
        next._normalized = true;

        // 复制并合并当前路由信息中的路径信息与要跳转的路径信息参数
        // 优先保留要跳转的路径信息
        const params: any = extend(extend({}, current.params), next.params);

        // 如果当前路径对象具有命名组件，那么直接复用并更新子路径信息
        if (current.name) {
            next.name = current.name;
            next.params = params;

        // 没有具有路由名称时，则从匹配的路由中寻找
        } else if (current.matched.length) {

            // 优先取最后一个路径地址
            const rawPath = current.matched[current.matched.length - 1].path;

            // 获取跳转地址的url字符串
            next.path = fillParams(rawPath, params, `path ${current.path}`)
        } else if (process.env.NODE_ENV !== 'production') {
            warn(false, `relative params navigation requires a current route.`)
        }
        return next
    }

    // 提出url中各个参数的信息(hash/query/path)
    const parsedPath = parsePath(next.path || '');

    // 获取跳转前路径的字符串
    const basePath = (current && current.path) || '/';

    // 要跳转的路由是否给定了路径，如果给定了则进行合并
    const path = parsedPath.path ?

        // 处理路径为最终路径
        resolvePath(parsedPath.path, basePath, append || next.append) :

        // 否则返回上一个路由的路径
        basePath;

    // 解析查询合并查询字符串
    const query = resolveQuery(
        parsedPath.query,
        next.query,
        router && router.options.parseQuery
    )

    // 优先获取跳转地址的hash
    let hash = next.hash || parsedPath.hash
    if (hash && hash.charAt(0) !== '#') {
        hash = `#${hash}`
    }

    // 返回标准化后结果
    return {
        _normalized: true,
        path,
        query,
        hash
    };
}
```

## resolvePath()——解析/合并路径

该方法用于将相对路径合并为绝对路径，当然该方法也可以用于处理绝对路径。

对于是否为绝对路径的判断主要来自于第一个参数，当第一个参数(`relative`)为绝对路径时，那么直接返回即可；如果第一个参数为相对路径，则会拼接在第二个参数之后，具体的代码如下：

```js
function resolvePath(

    // 相对路径（也有可能是一个完整的路径）
    relative: string,

    // 相对路径的基础路径
    base: string,

    // 是否直接添加在基础路径后
    append ? : boolean
): string {

    // 获取当前relative传入的具体是什么类型的属性
    const firstChar = relative.charAt(0);

    // 如果是以/开头，则视为绝对路径
    if (firstChar === '/') {
        return relative
    }

    // 如果为查询字符串或hash值则拼接后返回
    if (firstChar === '?' || firstChar === '#') {
        return base + relative;
    }

    // 当作为相对路径时，首先将之前的路径进行切割
    const stack = base.split('/');

    // remove trailing segment if:
    // 移除最后的参数如果满足以下参数
    // - not appending
    // - 不在末尾进行添加
    // - appending to trailing slash (last segment is empty)
    // - 或路径以/结尾时，要将其删除
    if (!append || !stack[stack.length - 1]) {
        stack.pop()
    }

    // resolve relative path
    // 解析相对路径字符串
    const segments = relative.replace(/^\//, '').split('/');
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        // 如果当前路径为..则移除
        if (segment === '..') {
            stack.pop();

        // 其他情况时加入到最终路径栈中
        } else if (segment !== '.') {
            stack.push(segment);
        }
    }

    // ensure leading slash
    // 确保路径以/开头
    if (stack[0] !== '') {
        stack.unshift('')
    }

    // 返回最终路径
    return stack.join('/')
}
```

## resolveQuery()——解析查询字符串

该函数用于合并查询字符串，可以自定义额外的查询字符串和解析函数。

```js
function resolveQuery(
    query: ? string,
    extraQuery : Dictionary < string > = {},
    _parseQuery: ? Function
): Dictionary < string > {

    // 是否提供查询字符串的解析函数，没有提供时，使用自带的
    const parse = _parseQuery || parseQuery
    let parsedQuery;

    // 解析查询字符串返回对象
    try {
        parsedQuery = parse(query || '')
    } catch (e) {
        process.env.NODE_ENV !== 'production' && warn(false, e.message)
        parsedQuery = {}
    }

    // 将额外的查询字符串覆盖至原查询字符串中
    for (const key in extraQuery) {
        parsedQuery[key] = extraQuery[key]
    }
    return parsedQuery
}
```
