# Base路由模式的实例方法

以下为`Base`模式下的实例方法，所有的路由的大多数方法都是基于`Base`模式的实例方法进行构建的：

- [Route过渡切换——history.transitionTo](#route过渡切换historytransitionto)

## Route过渡切换——history.transitionTo()

该方法用于通过提交当前`URL`的路径信息，来加载新的`Route`，并更新组件等等。整个方法由两部分组成：

1. 新的`Route`的生成
2. 新的`Route`的提交与更新

惯例，先浏览一下代码：

```js
history.transitionTo(

    // 未处理的当前位置信息(比如路径字符串)
    location: RawLocation,

    // 路由切换完成时调用的函数
    onComplete ? : Function,

    // 路由切换中断时调用的函数
    onAbort ? : Function
) {

    // 获取匹配当前位置信息对象location而产生的新的Route
    const route = this.router.match(location, this.current);

    // 提交路由Route更新
    this.confirmTransition(
        route,
        () => {

            // 更新当前的Route
            this.updateRoute(route);

            // 初始化时该函数为空
            onComplete && onComplete(route);

            // 进行URL的跳转
            this.ensureURL();

            // fire ready cbs once
            // 调用初始化onReady函数(仅调用一次)
            if (!this.ready) {
                this.ready = true
                this.readyCbs.forEach(cb => {
                    cb(route)
                })
            }
        },
        err => {
            if (onAbort) {
                onAbort(err)
            }
            if (err && !this.ready) {
                this.ready = true
                this.readyErrorCbs.forEach(cb => {
                    cb(err)
                })
            }
        }
    )
}
```

### 新的`Route`的生成

新的`Route`是通过在解析`URL`路径得到`Location`并得到对于匹配到的`RouteRecord`，最终来生成新的`Route`：

```js
// 获取匹配当前位置信息对象location而产生的新的Route
const route = this.router.match(location, this.current);
```

该方法调用的是`router`的实例方法`match()`，还记得我们生成`RouteRecords`表时的方法吗，这些并没有暴露出来，而是返回了两个接口`match()/addRoute()`，`router`就是帮我调用了这两个接口：

```js
router.match(
    // 未处理的路径信息对象
    raw: RawLocation,
    current ? : Route,
    redirectedFrom ? : Location
): Route {

    // 调用RouteRecord路由表内部接口查找匹配的路由路径
    return this.matcher.match(raw, current, redirectedFrom)
}
```

那么让我们先具体来看看这个[`matcher.match()`](../../../RouteRecord/两个接口/README.md)方法
