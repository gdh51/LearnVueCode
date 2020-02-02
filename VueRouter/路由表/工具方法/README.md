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
