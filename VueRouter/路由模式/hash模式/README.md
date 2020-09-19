# hash模式

作为一种路由模式，从其构造函数，我们可以看它是[`History`](../base基础模式/README.md)的子类，它将针对`hash`模式，提供具体的控制`URL`的`API`，下面是它的构造函数：

```js
class HashHistory extends History {
    constructor(router: Router, base: ? string, fallback : boolean) {
        super(router, base);

        // check history fallback deeplinking
        // 检查是否为降级而来，如果是则要更新当前地址的URL，并则直接返回
        if (fallback && checkFallback(this.base)) {
            return
        }

        // 更新当前hash值，确保以根路径为起始
        ensureSlash();
    }
}
```

在继承`History`类的继承之上，首先它要确定是否为降级而来。这个检测是基于之前的`fallback`变量(具体触发该模式的条件已经标记在以下代码中)：

```js
// 是否在不兼容时自动降级
// 判断变量为如果history模式，但不支持该API则且不主动关闭fallback模式
this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
if (this.fallback) {

    // 兼容模式下使用hash路由
    mode = 'hash'
}
```

那么如果是降级而来，我们就通过调用`checkFallback()`方法来替换当前的`URL`为`# + path`的形式：

```js
// 检查是否为降级形式的hash模式
function checkFallback(base) {

    // 获取当前URL的路径(包括查询字符串与hash值)(该方法只用于提取history模式下的路径)
    const location = getLocation(base);

    // 如果不是以/#开头，则将其替换为baseURL + /# + 路径 的形式
    if (!/^\/#/.test(location)) {
        window.location.replace(cleanPath(base + '/#' + location));
        return true;
    }
}
```

当当前路径本来就以`/#`起始时，则优先调用`History API`来进行地址的替换，这也就是`ensureSlash()`方法要做的事情(其中上面的[`getLocation()`](./工具方法/REAMDE.md#getlocation%e8%8e%b7%e5%8f%96%e5%bd%93%e5%89%8d%e8%b7%af%e5%be%84%e4%bf%a1%e6%81%af)方法用来获取当前`URL`的具体路径信息)：

```js
// 确保hash模式的URL正确
function ensureSlash(): boolean {

    // 获取hash值
    const path = getHash();

    // 确保当前为/起始
    if (path.charAt(0) === '/') {
        return true
    }

    // 否则替换为/起始
    replaceHash('/' + path)
    return false
}
```

该方法主要是用来确保`hash`模式下的`URL`以`/`开始，规范`URL`。首先它使用[`getHash()`](./工具方法/REAMDE.md#geturl%e8%8e%b7%e5%8f%96%e5%ae%8c%e6%95%b4%e7%9a%84url%e5%9c%b0%e5%9d%80)方法来获取当前`URL`的`hash`值，如果当前的`hash`模式下路径规范不正确，那么就调用[`replaceHash()`](./工具方法/REAMDE.md#replacehash%e6%9b%b4%e6%96%b0%e5%bd%93%e5%89%8d%e7%9a%84hash%e8%b7%af%e5%be%84%e5%80%bc)方法来将其重新载入新的路径地址。
____
那么到目前为止，`hash`模式下构造函数所做的时就这样，具体的作用还是要配合路由组件一起使用。

## hash事件监听器安装

`hash`模式下的安装和`history`模式基本上一样，区别在于事件监听的处理，其他的是一样的，有如下几个步骤：

1. 防止重复监听
2. 滚动条行为控制
3. 正式的处理函数

```js
hash.setupListeners() {

    // 用于注销路由事件监听器的队列，如果里面有函数，则说明已监听
    if (this.listeners.length > 0) {
        return;
    }
    const router = this.router;
    const expectScroll = router.options.scrollBehavior;
    const supportsScroll = supportsPushState && expectScroll;

    if (supportsScroll) {
        this.listeners.push(setupScroll());
    }

    const handleRoutingEvent = () => { /* 略 */ }
}
```

了解[handleRoutingEvent](../../Route-当前路径对象/Route更新/浏览器跳转/README.md)
