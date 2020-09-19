# 浏览器控件跳转

浏览器控件跳转主要就是通过浏览器的前进和后退按钮实现。当然也可以通过函数形式的调用控件功能`router.go/back/forward()`。

此时`Vue-Router`通过监听`popState`事件来对跳转的`url`进行处理。关于事件的监听，肯定是和不同的模式有关，那么其肯定在初始化路由模式`Class`时进行监听的。

毋庸置疑，浏览器监听模式一共就两种`hash`与`html5`

- hash
- html5

## html5路由事件监听

其实经过我们对路由跳转的过程的了解，我们已经大致知道了路由跳转要进行的必须步骤：`base.transitionTo()`。那么我们对每一种模式的跳转需要关心的就是它还做了什么事情。在`html5`模式中

```js
// 监听popstate事件(即通过浏览器前进后退)，做出路由更新
window.addEventListener('popstate', e => {

    // 获取跳转前的路由路径信息对象
    const current = this.current;

    // Avoiding first `popstate` event dispatched in some browsers but first
    // history route not updated since async guard at the same time.
    // 避免第一次`popstate`时间在START Route解析异步组件时更新，
    // 因为此时START Route自己都还没有更新
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