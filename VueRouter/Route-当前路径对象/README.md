# Route-当前路径对象

在`Vue`中，记录着当前处于路径的信息对象叫做`Route`，每当我们切换到一个新的路径，其就会更新为一个新的`Route`。从这个`Route`中我们可以获得许多诸如组件匹配信息，当前的查询字符串对象、`meta`等信息。

现成的`Route`就存在于我们的`Vue.prototype.$route`，该属性实际返回的是挂载`router`实例的`_route`属性。该属性已被响应式激活，所以收集其依赖项即可做到组件虽路径一同更新。

## 初始化加载Route

言归正传，在最初加载`Vue-Router`库时，会自动初始化一个基础的`Route`：

```js
// the starting route that represents the initial state
// 标识初始状态的起始路径
export const START = createRoute(null, {
  path: '/'
});
```

注释说它表示最初的状态，顺手查看下面函数的形参，第一个为`RouteRecord`，第二个为表示浏览器当前路径相关信息对象的`Location`，其实这里确切的说应该叫做`Raw Location`，因为其还未做标准化处理。那我们配合注释继续往下查看：

## 创建Route的流程

```js
// 创建一个Route路由路径记录对象
function createRoute(

    // 当前匹配到的Record对象，即我们创建在matcher中的
    record: ? RouteRecord,

    // 即将要跳转的路由地址对象
    location : Location,

    // 需要重定向的路由地址对象
    redirectedFrom ? : ? Location,
    router ? : VueRouter
): Route {

    // 获取用户提供的提取查询字符串的自定义函数
    const stringifyQuery = router && router.options.stringifyQuery;

    // 提取当前地址的查询字符串对象
    let query: any = location.query || {};

    try {
        // 深度克隆query对象
        query = clone(query)
    } catch (e) {}

    // 生成以即将要跳转的路径为基础的路由路径记录对象
    const route: Route = {
        name: location.name || (record && record.name),
        meta: (record && record.meta) || {},
        path: location.path || '/',
        hash: location.hash || '',
        query,
        params: location.params || {},

        // 返回完整的URL路径
        fullPath: getFullPath(location, stringifyQuery),

        // 将当前路由及其所有父级路由按父->子的顺序添加到该数组
        matched: record ? formatMatch(record) : []
    }

    // 如果是从定向，那么还要记录从定向之前的地址
    if (redirectedFrom) {
        route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
    }

    // 返回该当前路径生成的路由路径记录对象，并不允许修改
    return Object.freeze(route);
}
```

上述代码中的`location`变量就相对于我们定义在`<router-link :to=""/>`中的`to`属性所传入的值，代入这个观念，那么创建的`Route`就比较好理解了。

>在这其中，有关于[`getFullPath()`](./工具方法/README.md#getfullpath返回完整的url路径)、[`formatMatch`](./工具方法/README.md#formatmatch返回匹配的routerecord)两个方法，请点击查看其具体解析。

现在我们已经了解了`START Route`的真面目了，现在我们继续回到[初始化`base history`](../Router的实例化/路由模式/base基础模式/README.md#阅读完毕返回锚点)中。
