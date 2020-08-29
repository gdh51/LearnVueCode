# 生成路由表期间使用的工具方法

这里汇总了生成路由表期间的各种工具方法：

- [normalizePath()——标准化路由路径](#normalizepath%e6%a0%87%e5%87%86%e5%8c%96%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%84)
- [cleanPath()——清除路径中的//](#cleanpath清除路径中的)
- [compileRouteRegex()——根据路径生成正则表达式](#compilerouteregex%e6%a0%b9%e6%8d%ae%e8%b7%af%e5%be%84%e7%94%9f%e6%88%90%e6%ad%a3%e5%88%99%e8%a1%a8%e8%be%be%e5%bc%8f)
- [normalizeLocation()——标准化路径地址对象](#normalizelocation标准化路径地址对象)

## normalizePath()——标准化路由路径

该方法用于标准化路径字符串，其中严格模式下，允许路径以`/`结尾；对于绝对路径的地址，直接返回；对于根路径，直接返回其`Path`；在具有子`RouteRecord`时，会在与父级路由拼接后格式化其`//`为`/`。

```js
function normalizePath(
    path: string,

    // 父级RouteRecord
    parent ? : RouteRecord,
    strict ? : boolean
): string {

    // 严格模式下，保留path末尾的 /，不对其做清除
    if (!strict) path = path.replace(/\/$/, '');

    // 如果以/开头，则说明为绝对路径，直接返回
    if (path[0] === '/') return path;

    // 根URL，直接返回
    if (parent == null) return path;

    // 清空全部 //，并返回完整的路径信息(如为子路由则还要包含父路由)
    // 其实这里相对于为严格模式下的父子组合路径清理了//
    return cleanPath(`${parent.path}/${path}`);
}
```

所以当我们定义父`Path: /a`时，子`Path`一定要定义为`Path: b`(无斜线)，不然子`Path`会被认为为绝对路径，返回`/b`;

## cleanPath()——清除路径中的//

该方法非常简单，就是清除传入其中值中的`//`，该方法主要作用是在严格模式下，清理父子路径间的`/`，比如我们定义父`Path: /a/`，子`Path: b`，注意，子路径无论如何都不能以`/`起始。

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

该函数用于处理即将要跳转的路径对象`Location`，与当前（上一个）`Route`，来生成新的`Route`，该方法有一定的复杂性，需要仔细梳理，先浏览下：

```js
// 该方法用于完整化Location对象(该对象指我们定义Router-link 中to的那些路径的补全)
// 除命名路由外，其他跳转Location都会标准化
export function normalizeLocation(

    // 当前的路径字符串或其当前router-link指定的to对象
    raw: RawLocation,

    // 当前的路由路径记录对象Route（这里指未跳转前的）
    current: ? Route,

    // 是否添加到路径最后
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
        const params = next.params;

        // 仅在传入对象形式的路径参数时复制并重写(防止修改原参数)
        if (params && typeof params === 'object') {
            next.params = extend({}, params);
        }
        return next;
    }

    // relative params
    // 当无路径字符串但具有路径参数时(肯定也不存在name)，
    // 将其处理为当前路径下的子路径(即视为相对路径)
    if (!next.path && next.params && current) {
        next = extend({}, next);

        // 将其标记为已标准化
        next._normalized = true;

        // 复制合并之前路由与即将跳转的路径参数
        // 优先保留即将跳转的路径信息
        const params: any = extend(extend({}, current.params), next.params);

        // 如果跳转前Route为命名路由，则直接复用，并传入路径参数
        if (current.name) {
            next.name = current.name;
            next.params = params;

        // 不为具名路由时，则从匹配的路由中寻找
        } else if (current.matched.length) {

            // 从最后一个路径地址开始匹配
            const rawPath = current.matched[current.matched.length - 1].path;

            // 将路径补全
            next.path = fillParams(rawPath, params, `path ${current.path}`)
        } else if (process.env.NODE_ENV !== 'production') {
            warn(false, `relative params navigation requires a current route.`)
        }
        return next;
    }

    // 进入此处说明仅有path或无path且无params

    // 提出path中各个参数的信息(hash/query/path)
    const parsedPath = parsePath(next.path || '');

    // 获取跳转前路径的字符串
    const basePath = (current && current.path) || '/';

    // 要跳转的路由是否给定了路径，如果给定了则进行合并
    const path = parsedPath.path ?

        // 将相对路径转化为绝对路径(不包括查询字符串)(要跳转的路径支持../形式)
        resolvePath(parsedPath.path, basePath, append || next.append) :

        // 无path则返回上一路径路径或基础路径
        basePath;

    // 解析查询合并查询字符串
    const query = resolveQuery(
        parsedPath.query,

        // 该参数存在时，只能说明用户定义在路由中存在该参数
        next.query,

        // 用户定义解析Query的方法
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

首先得出结论，`Raw Location`一共有哪些情况，这些情况具有从上到下的优先级：

- `Location`已标准化(未标准化则为`Raw Location`)，直接返回
- [`Raw Location`具备`name`，即跳转命名路由](#raw-location具备name)
- [`Raw Location`未传入`path`，但传入对象`params`](#raw-location未传入path但传入对象params)，此时视为当前`Route`的相对路径(标记`_normalized`)
- [`Raw Location`仅具有`path`，按传入的`path`来跳转](#raw-location仅具有path或什么都没有按传入的path来跳转)(标记`_normalized`)
- [`Raw Location`什么都没有](#raw-location仅具有path或什么都没有按传入的path来跳转)，我愿称之为原地蹦达(当然会更新`hash/query`)(标记`_normalized`)

在所有的处理之前，优先对传入的`Raw Location`进行`path`的处理，统一处理为对象形式：

```js
// 将路径字符串同一为对象形式(next就表示即将要跳转的路径)
let next: Location = typeof raw === 'string' ? {
    path: raw
} : raw;
```

第一种情况就不用解释了，直接从后面的情况开始说明：

### `Raw Location`具备`name`

当我们传入的`Raw Location`指定有`name`(命名路由)时，那么浅复制`params`后，直接返回。(未标记`_normalized`)

```js
if (next.name) {
    next = extend({}, raw);
    const params = next.params;

    // 仅在传入对象形式的路径参数时复制并重写(防止修改原参数)(Object.assign)
    if (params && typeof params === 'object') {
        next.params = extend({}, params);
    }
    return next;
}
```

### `Raw Location`未传入`path`，但传入对象`params`

在这种情况下，会认为其为相对路径下的跳转，具体会根据上一个`Route`来决定具体的`Location`。(标记`_normalized`)具体还是分为两种情况：

1. 跳转前的`Route`具有命名路由的`name`字段，则作为当前路由的使用
2. 跳转前的`Route`中最先匹配的`RouteRecord`中的`path`为基准，进行路由相对路径的变更。(这个比较特殊，下面会细说)

```js
// relative params
// 当无路径字符串但具有路径参数时(肯定也不存在name)，
// 将其处理为当前路径下的子路径(即视为相对路径)
if (!next.path && next.params && current) {
    next = extend({}, next);

    // 将其标记为已标准化
    next._normalized = true;

    // 复制合并之前路由与即将跳转的路径参数
    // 优先保留即将跳转的路径信息
    const params: any = extend(extend({}, current.params), next.params);

    // 如果跳转前Route为命名路由，则直接复用，并传入路径参数
    if (current.name) {
        next.name = current.name;
        next.params = params;

    // 不为具名路由时，则从匹配的路由中寻找
    } else if (current.matched.length) {

        // 从最后一个RouteRecord(即上一个的全路径匹配Record)开始匹配
        const rawPath = current.matched[current.matched.length - 1].path;

        // 将路径补全，按相对路径的标准来(仅在path定义了动态参数有效)
        next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
        warn(false, `relative params navigation requires a current route.`)
    }
    return next;
}
```

在第二种情况中，使用[`fillParams()`](#补全path动态参数fillparams)方法来补全`path`，其会**补全其中的动态参数**，当参数不足时，会报错。这种情况的适用场景很明显，只变化动态参数的场景，针对不同的参数渲染不同的板块。(大多数时候，我们是通过完整的`path`来渲染动态参数，因为大家不知道这种途径)

### `Raw Location`仅具有`path`(或什么都没有)，按传入的`path`来跳转

大多数情况下，我们使用跳转的`Raw Location`对象时，仅会使用它的`path`参数，也即现在这种情况：

```js
// 进入此处说明仅有path或无path且无params
// 提出即将跳转path中各个参数的信息(hash/query/path)
const parsedPath = parsePath(next.path || '');

// 获取跳转前路径的字符串
const basePath = (current && current.path) || '/';

// 要跳转的路由是否给定了路径，如果给定了则进行合并
const path = parsedPath.path ?

    // 将相对路径转化为绝对路径(不包括查询字符串)(要跳转的路径支持../形式)
    resolvePath(parsedPath.path, basePath, append || next.append) :

    // 无path则返回上一路径路径或基础路径
    basePath;

// 解析查询合并查询字符串
const query = resolveQuery(
    parsedPath.query,

    // 该参数存在时，只能说明用户定义在路由中存在该参数
    next.query,

    // 用户定义解析Query的方法
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
```

在该段代码中，主要需要关注的就是`path`是如何进行处理的，这里获取的参数主要有两个部分：

- 准备跳转的`path`
- 跳转前的`path`

```js
const parsedPath = parsePath(next.path || '');
const basePath = (current && current.path) || '/';

const path = parsedPath.path ?
    resolvePath(parsedPath.path, basePath, append || next.append) :
    basePath;
```

如果没有准备跳转前`path`，那么直接沿用之前的`path`；如果具有准备跳转的`path`，在调用[`resolvePath()`](#resolvepath处理path)来进行`path`的处理，这里主要是处理即将跳转的`path`的相对路径形式/绝对路径形式处理为一个具体的`path`(这个地方涉及到一些`api`，可以仔细康康)。

最后就是对`query/hash`的处理，这里没什么好说的，和以为常见的三方库处理一样，具体看[`resolveQuery()`](#resolvequery解析查询字符串)(选看，也可以不看)。

___
那么到目前为止，整个`path`就处理完毕了，让我们继续回到[`matcher.match()`](../两个接口/README.md#新的Route的创建)方法中

## 补全path动态参数——fillParams()

该方法用于补全`RouteRecord`中`path`定义的动态参数，比如`/path/:id`传入`{ id: '33'}`则补全后就为`/path/33`。（下面的函数都可以不看，因为借助了`path-to-regexp`库）

```js
function fillParams(

    // 定义在RouteRecord中的path
    path: string,

    // 路径参数
    params: ? Object,

    // 报错信息
    routeMsg : string
): string {

    // 当前路径下的子路径参数
    params = params || {};

    try {

        // 优先获取缓存，之后在考虑对当前地址进行合法的转换
        // 将RouteRecord中的path转化为函数，这样就支持/path/:id这种写法的匹配
        const filler =
            regexpCompileCache[path] ||
            (regexpCompileCache[path] = Regexp.compile(path))

        // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
        // 解决通配符路由问题
        if (params.pathMatch) params[0] = params.pathMatch

        // 合并路径参数转化为完整路径
        return filler(params, {

            // 该参数表示把转化的最终路径中特殊的符号不进转移
            // 比如/path/:id 传入{ id: ':'}, 不加pretty为/path/%3A 加了为/path/:
            pretty: true
        });
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            // Fix #3072 no warn if `pathMatch` is string
            warn(typeof params.pathMatch === 'string', `missing param for ${routeMsg}: ${e.message}`)
        }
        return ''
    } finally {

        // delete the 0 if it was added
        // 删除临时添加的路径参数
        delete params[0]
    }
}
```

如果你想在线测试这个方法的具体效果，可以通过[这个链接](http://forbeslindesay.github.io/express-route-tester/)。

## 解析path为参数对象——parsePath()

该方法用于将`path`(完整意义上的`path`)解析为一个对象，其中包含`hash/query/path`三个独立的参数。该方法比较简单：

```js
// 解析URL，转换为参数形式
function parsePath(path: string): {
    path: string;
    query: string;
    hash: string;
} {
    let hash = ''
    let query = ''

    const hashIndex = path.indexOf('#')
    if (hashIndex >= 0) {
        hash = path.slice(hashIndex)
        path = path.slice(0, hashIndex)
    }

    const queryIndex = path.indexOf('?')
    if (queryIndex >= 0) {
        query = path.slice(queryIndex + 1)
        path = path.slice(0, queryIndex)
    }

    // 返回对应部分的字符串表达式
    return {
        path,
        query,
        hash
    }
}
```

## resolvePath()——处理path

该方法用于将相对路径合并为绝对路径，当然该方法也可以用于处理绝对路径。

对于是否为绝对路径的判断主要来自于第一个参数，当第一个参数(`relative`)为绝对路径(以`/`开头)时，那么直接返回即可；如果第一个参数为相对路径(不以`/`开头)，则会拼接在第二个参数之后，具体的代码如下：

```js
function resolvePath(

    // 相对路径（也有可能是一个完整的路径）(这也是即将要跳转的路径)
    relative: string,

    // 无相对路径时提供的基础相对路径(也是跳转前路径)
    base: string,

    // 作为相对路径直接添加在最后
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
    // - 或路径以/结尾时，要将其删除最后的空格(以/结尾时调用split方法会产生一个空格)
    if (!append || !stack[stack.length - 1]) {
        stack.pop()
    }

    // resolve relative path
    // 解析相对路径字符串，移除首位/(这个没用，如果首位为/则以作为绝对路径返回了)
    // 分割路径参数
    const segments = relative.replace(/^\//, '').split('/');

    // 处理../这种相对路径
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        // 如果当前路径为..则base路径倒退一级
        if (segment === '..') {
            stack.pop();

        // 其他情况时加入到最终路径栈中(.表示当前路径，没用)
        } else if (segment !== '.') {
            stack.push(segment);
        }
    }

    // ensure leading slash
    // 确保路径以/开头
    if (stack[0] !== '') {
        stack.unshift('');
    }

    // 返回最终路径
    return stack.join('/');
}
```

其中涉及到一个`append`参数，当我们进行相对路径跳转时，比如由`/a/b`跳转至相对路径`c`，如果设置`append = true`，则最终的`path`为`/a/b/c`，否则就为`/a/c`。

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
