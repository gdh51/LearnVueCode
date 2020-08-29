# H5 History路由模式的实例方法

以下为`H5 History`模式下的实例方法，其实例方法主要是承接`Base`模式的阙漏处，对`H5`模式下一些独特的特性进行针对性的处理。

- [获取完整路径信息——history.getCurrentLocation()](#获取完整路径信息historygetcurrentlocation)

## 获取完整路径信息——history.getCurrentLocation()

该方法用于获取当前`URL`完整的**路径**信息，具体包含查询字符串与`hash`值等等。方法比较简单，这里不做过多的解释，跟着注释看就行了。

```js
// 获取当前的完整路径信息
history.getCurrentLocation(): string {
    return getLocation(this.base);
}


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
