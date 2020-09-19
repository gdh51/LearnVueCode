# 路由切换滚动条行为的处理

如果你使用过滚动条`scrollBehavior`这个属性，那么你应该知道，滚动条可以来做什么(保存跳转前的页面高度)，现在让我们来康康其原理。

## 滚动条行为安装

滚动条行为是否安装还是要看我们是否定义，最开始它会随着安装路由事件监听器时，一同确认安装:

```js
// 自定义的scrollBehavior函数
const expectScroll = router.options.scrollBehavior;

// 是否支持滚动条行为
const supportsScroll = supportsPushState && expectScroll;

// 支持时，安装滚动条行为监听函数
if (supportsScroll) {

    // 返回一个注销滚动条行为的函数
    this.listeners.push(setupScroll());
}
```