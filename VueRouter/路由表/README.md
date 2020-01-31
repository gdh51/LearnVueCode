# 路由表

在初始化`VueRouter`实例时，最开始根据用户配置的`route`，会创建一个路由表：

```js
// 根据路由配置创建适配表
this.matcher = createMatcher(options.routes || [], this)
```

该函数的具体内容就是返回两个接口函数：

```js
function createMatcher(
    routes: Array < RouteConfig > ,
    router: VueRouter
): Matcher {
    const {
        pathList,
        pathMap,
        nameMap
    } = createRouteMap(routes);

    return {
        match,
        addRoutes
    };
}
```

所以现在我们的主要目标就是`createRouteMap()`函数