# 工具方法

这里会记录在基础模式中使用到的工具方法，以便快速查询：

**目录：**

- [normalizeBase()——格式化基础路由路径](#normalizebase%e6%a0%bc%e5%bc%8f%e5%8c%96%e5%9f%ba%e7%a1%80%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%84)

## normalizeBase()——格式化基础路由路径

该方法用于自动获取基础路由路径或使用用户定义的基础路由路径，同时还要对其格式进行规范。整体过程比较简单，不用过分说明：

```js
function normalizeBase(base: ? string): string {

    // 未传入基础URL时
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
    // 确保基础路径以/开头，不然就补上
    if (base.charAt(0) !== '/') {
        base = '/' + base
    }

    // remove trailing slash
    // 移除末尾的/
    return base.replace(/\/$/, '')
}
```
