# Base类中的工具方法

这里会记录在基础模式中使用到的工具方法，以便快速查询：

**目录：**

- [normalizeBase()——格式化基础路由路径](#normalizebase%e6%a0%bc%e5%bc%8f%e5%8c%96%e5%9f%ba%e7%a1%80%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%84)
- [两个Route是否完全相同——isSameRoute()](#两个route是否完全相同issameroute)
- [对象的字段与值完全匹配——isObjectEqual](#对象的字段与值完全匹配isobjectequal)

## normalizeBase()——格式化基础路由路径

该方法用于自动获取基础路由路径或使用用户定义的基础路由路径，同时还要对其格式进行规范。整体过程比较简单，不用过分说明：

```js
// 初始化与格式化路由根路径，确保以/开头但不以/结尾
// 如最终为 /path
function normalizeBase(base: ? string): string {

    // 未传入根路径时，优先使用DOM元素中base中定义路径，其次是/
    if (!base) {

        // 在浏览器环境中，优先使用base元素中的地址，否则还是使用/
        if (inBrowser) {
            // respect <base> tag
            // 优先使用base元素定义的路径
            const baseEl = document.querySelector('base')
            base = (baseEl && baseEl.getAttribute('href')) || '/'
            // strip full URL origin
            // 去除协议地址
            base = base.replace(/^https?:\/\/[^\/]+/, '')

            // 在服务器渲染时，初始化为/
        } else {
            base = '/'
        }
    }

    // make sure there's the starting slash
    // 确保根路径以/开头，不然就补上
    if (base.charAt(0) !== '/') {
        base = '/' + base
    }

    // remove trailing slash
    // 移除根路径末尾的/
    return base.replace(/\/$/, '')
}
```

## 两个Route是否完全相同——isSameRoute()

该方法用来对比两个`Route`是否完全相同(即转化为完整`URL`后是否全等)。如果有丝毫差距那么则认为它们为不同`Route`。该方法比较简单，你看一眼代码就懂：

```js
// 对比跳转前Route和即将跳转Route是否相同
function isSameRoute(a: Route, b: ? Route): boolean {

    // 为初始化Route则直接返回true
    if (b === START) {
        return a === b;

    // 无Route时直接返回false
    } else if (!b) {
        return false

    // 如果存在路径时
    } else if (a.path && b.path) {
        return (

            // 将路径末尾的/清除掉后，是否相等
            a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&

            // hash值也要想等
            a.hash === b.hash &&

            // 且query一样
            isObjectEqual(a.query, b.query)
        )

    // 当不为路径而是指定命名路由时
    } else if (a.name && b.name) {

        // 同样是满足这些条件相同
        return (
            a.name === b.name &&
            a.hash === b.hash &&
            isObjectEqual(a.query, b.query) &&
            isObjectEqual(a.params, b.params)
        )
    } else {
        return false
    }
}
```

其中用于对比两个对象是否相等用到了[`isObjectEqual()`](#对象的字段与值完全匹配isobjectequal)方法，该方法是非常规意义上的对象相等。

## 对象的字段与值完全匹配——isObjectEqual

该方法表示两个对象是否在字段和值上完全匹配和相等，但是非严格意义上两个对象全等。
比如有这两个对象`{ a:1, b: { c: 2 }}`与`{ a:1, b: { c: 2 }}`那么我们认为它们是等的；有两个对象`{ a:1, b: { c: 2 }}`与`{ a:1, b: { c: 2 }, c:3 }`，那么我们认为它们不等。

>该方法不适用于数组或对象中存在数组

```js
function isObjectEqual(a = {}, b = {}): boolean {
    // handle null value #1566
    if (!a || !b) return a === b

    // 首先确保字段数目一样，不一样就说明不等，没有进一步比的可比性
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
        return false
    }

    // 遍历全部字段的值，只要有一个不等则不等
    return aKeys.every(key => {
        const aVal = a[key]
        const bVal = b[key]
        // check nested equality
        if (typeof aVal === 'object' && typeof bVal === 'object') {
            return isObjectEqual(aVal, bVal)
        }
        return String(aVal) === String(bVal)
    })
}
```
