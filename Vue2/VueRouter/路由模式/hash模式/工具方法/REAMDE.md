# 工具方法

这里会记录在`hash`模式中使用到的工具方法，以便快速查询：

**目录：**

- [getLocation()——获取当前路径信息](#getlocation%e8%8e%b7%e5%8f%96%e5%bd%93%e5%89%8d%e8%b7%af%e5%be%84%e4%bf%a1%e6%81%af)
- [getHash()——获取URL中的hash值](#gethash%e8%8e%b7%e5%8f%96url%e4%b8%ad%e7%9a%84hash%e5%80%bc)
- [replaceHash()——更新当前的hash路径值](#replacehash%e6%9b%b4%e6%96%b0%e5%bd%93%e5%89%8d%e7%9a%84hash%e8%b7%af%e5%be%84%e5%80%bc)
- [getUrl()——获取完整的URL地址](#geturl%e8%8e%b7%e5%8f%96%e5%ae%8c%e6%95%b4%e7%9a%84url%e5%9c%b0%e5%9d%80)

## getLocation()——获取当前路径信息

该方法用于提取当前URL的路径信息，比如`https://www.baidu.com/path1/path2#asdas`提取完成后就为`/path1/path2#asdas`，如果我们在初始化路由时提供了`baseURL`还会额外的添加到其中：

```js
// 获取完整的URL路径信息
function getLocation(base: string): string {

    // 获取当前的路径
    let path = decodeURI(window.location.pathname)

    // 如果当前路径以基础路径作为开始，则获取其具体的变化路径
    if (base && path.indexOf(base) === 0) {
        path = path.slice(base.length)
    }

    // 返回该路径下的路径(包括查询字符串与hash值)
    return (path || '/') + window.location.search + window.location.hash
}
```

## getHash()——获取URL中的hash值

该方法主要是兼容性处理获取`hash`值的方式，因为在某些浏览器中存在一定的问题，可能需要最原始的获取方式，直接从`URL`中手动提取。

```js
function getHash(): string {
    // We can't use window.location.hash here because it's not
    // consistent across browsers - Firefox will pre-decode it!
    // 我们不能直接window.location.hash，因为各个浏览器的行为不一致
    let href = window.location.href
    const index = href.indexOf('#');
    // empty path
    if (index < 0) return ''

    href = href.slice(index + 1);
    // decode the hash but not the search or hash
    // as search(query) is already decoded
    // https://github.com/vuejs/vue-router/issues/2708
    const searchIndex = href.indexOf('?')
    if (searchIndex < 0) {
        const hashIndex = href.indexOf('#')
        if (hashIndex > -1) {
            href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex)
        } else href = decodeURI(href)
    } else {
        href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex)
    }

    return href
}
```

## replaceHash()——更新当前的hash路径值

这里以替换当前`URL`的方式更新新的路径信息。即使是在`hash`模式下，也会优先通过`History API`来替换路径。

```js
function replaceHash(path) {

    // 是否支持history API的pushState方法
    if (supportsPushState) {

        // 支持时则使用该方法替换URL
        replaceState(getUrl(path));

    // 否则降级使用location.replace替换
    } else {
        window.location.replace(getUrl(path))
    }
}
```

上述方法通过[`supportsPushState`](../../history模式/工具方法/REAMDE.md#supportspushstate%e5%8f%98%e9%87%8f%e6%a3%80%e6%9f%a5%e6%98%af%e5%90%a6%e6%94%af%e6%8c%81historypushstate)变量来判断是否支持History API，然后在支持时就通过[`replaceState()`](../../history模式/工具方法/REAMDE.md#replacestate%e5%b0%81%e8%a3%85%e7%9a%84historyreplacestate%e6%8e%a5%e5%8f%a3)方法来替换；否则使用`location.replace()`方法来替换`URL`，其中获取完整URL使用的下方的[`getUrl()`](#geturl%e8%8e%b7%e5%8f%96%e5%ae%8c%e6%95%b4%e7%9a%84url%e5%9c%b0%e5%9d%80)方法。

## getUrl()——获取完整的URL地址

该方法用于获取完整的`URL`地址，包括`hash`值与查询字符串。

```js
// 根据当前的hash路径，生成纯净的URL
function getUrl(path) {
    const href = window.location.href;
    const i = href.indexOf('#');
    const base = i >= 0 ? href.slice(0, i) : href;
    return `${base}#${path}`;
}
```
