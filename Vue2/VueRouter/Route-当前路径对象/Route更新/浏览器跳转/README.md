# 浏览器控件跳转

浏览器控件跳转主要就是通过浏览器的前进和后退按钮实现。当然也可以通过函数形式的调用控件功能`router.go/back/forward()`。

此时`Vue-Router`通过监听`popState`事件来对跳转的`url`进行处理。关于事件的监听，肯定是和不同的模式有关，那么其肯定在初始化路由模式`Class`时进行监听的。

毋庸置疑，浏览器监听模式一共就两种`hash`与`html5`

- [hash](#hash路由事件监听)
- [html5](#html5路由事件监听)

## html5路由事件监听

其实经过我们对路由跳转的过程的了解，我们已经大致知道了路由跳转要进行的必须步骤：`base.transitionTo()`。那么我们对每一种模式的跳转需要关心的就是它还做了什么事情。

在`html5`模式中整个监听函数非常简单，多余的代码主要是对某些浏览器的意外行为做出处理，但是在当前版本中完全没有必要了，因为当前版本中事件监听器是在初始化结束阶段后绑定。

>不同的浏览器在加载页面时处理popstate事件的形式存在差异。页面加载时Chrome和Safari通常会触发(emit )popstate事件，但Firefox则不会。

```js
window.addEventListener('popstate', handleRoutingEvent)

// 监听popstate事件(即通过浏览器前进后退)，做出路由更新
const handleRoutingEvent = () => {

    // 获取跳转前的路由路径信息对象
    const current = this.current;

    // Avoiding first `popstate` event dispatched in some browsers but first
    // history route not updated since async guard at the same time.
    // 避免第一次`popstate`时间在START Route解析异步组件时意外的更新
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
```

其余就是常规的调用`base.transitionTo()`进行路由跳转。

## hash路由事件监听

在`hash`模式中，会优先监听`html5`模式的事件来对`path`的变化做处理，降级后处理会使用`hashchange`事件来做监听。

>`popState`还可以监听手动输入的URL变化，没想到吧，可以完全替代hashchange

```js
// 优先通过浏览器history模式完成监听
const eventType = supportsPushState ? "popstate" : "hashchange";
window.addEventListener(eventType, handleRoutingEvent);

const handleRoutingEvent = () => {

    // 获取跳转前Route
    const current = this.current;

    // 确保hash模式下URL形式正确
    if (!ensureSlash()) {
        return;
    }

    // 获取当前的完整path(包括查询字符串)
    this.transitionTo(getHash(), route => {

        // 是否处理滚动条
        if (supportsScroll) {
            handleScroll(this.router, route, current, true);
        }

        // 不支持浏览器history模式时，通过replaceHash替换路由
        if (!supportsPushState) {

            // 直接重写hash值
            replaceHash(route.fullPath);
        }
    });
};
```

___
[`base.transitionTo()`函数，详解](../../../路由模式/base基础模式/实例方法/README.md)
