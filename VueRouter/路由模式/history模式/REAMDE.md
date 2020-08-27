# history模式

作为`Vue-Router`中基于`H5 History API`，它在`URL`的体现上比较美观，并且有专门的`API`来控制页面的路径情况，现在我们来看下其构造函数：

```js
class HTML5History extends History {
    constructor(router: Router, base: ? string) {

        // 继承基础路由信息
        super(router, base);

        // 是否提供一个控制滚动条行为的方法
        const expectScroll = router.options.scrollBehavior;

        // 探测当前运行环境是否支持滚动条行为，仅在h5模式下支持
        const supportsScroll = supportsPushState && expectScroll;

        // 如果支持控制滚动条且用户想控制，则记录当前页面信息
        if (supportsScroll) {
            setupScroll();
        }

        // 获取完整的URL 路径 信息
        const initLocation = getLocation(this.base);

        // 监听popstate事件(即通过浏览器前进后退)，做出路由更新
        window.addEventListener('popstate', e => {

            // 获取跳转前的路由路径信息对象
            const current = this.current;

            // Avoiding first `popstate` event dispatched in some browsers but first
            // history route not updated since async guard at the same time.
            // 避免第一次popstate事件触发时，在某些浏览器中，
            // 由于异步守卫的原因，路由路径记录对象还没有更新(还为初始化状态)
            const location = getLocation(this.base);

            // 所以当为初始化路由时且路径包括hash值都没有改变的情况下，直接退出
            if (this.current === START && location === initLocation) {
                return
            }

            // 进行路由跳转
            this.transitionTo(location, route => {

                // 跳转完成时，处理当前页面的滚动条高度
                if (supportsScroll) {
                    handleScroll(router, route, current, true)
                }
            });
        });
    }
}
```

`h5`的路由构造函数整体较为简单(看着代码少)，主要分为三坨：

- [`base`路由信息继承](#基础路由信息继承)
- 滚动条监听
- h5事件监听

## 基础路由信息继承

在实例化`h5`实例前，要先从`base`路由继承基础信息，其包括一些`Route`、一些`hooks`等等，具体请查看[`base`初始化](../base基础模式/README.md)。

### base基础信息了解完毕锚点

继承完`base`路由的基础信息后，其实整个`h5 history`的初始化就结束了。后续代码是关于路由切换时，页面高度控制与浏览器前进后退按钮使用的处理，在纯`JS`交互中我们暂时不需要关注，这两个部分我们放在后来单独学习。

那么到目前为止，整个`router`实例的初始化阶段已经结束，正式进入下一个阶段——[`Vue`实例化](../../初次页面加载/Vue实例化/README.md)
