# Vue实例化——hooks的调用

随着`Vue`的实例化，我们的`router`此时才正式发挥它的作用，还记得在[`Vue.use(Router)`](../Router的初始化注入/README.md)调用时向`Vue`实例注入的两个`hooks`吗，现在我们来细细品一品它的含义。

首先是第一个`hook: beforeCreate`，它主要负责向我们每个`Vue`实例定义一个唯一的`_routerRoot`，以便我们在访问`$router`时，是访问的挂载着`router`实例的根`Vue`实例：

```js
beforeCreate() {

    // 仅根vm实例配置上挂载有router
    if (isDef(this.$options.router)) {

        // 定义router的根vm实例
        this._routerRoot = this;

        // 原始router的配置
        this._router = this.$options.router;

        // 初始化路由位置信息
        this._router.init(this);

        // 在根vm实例上定义_route用来访问直接访问当前的Route
        Vue.util.defineReactive(this, '_route', this._router.history.current)

    // 组件vm实例
    } else {

        // 为其他子vm实例挂载路由所在的根vm实例
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
    }
    registerInstance(this, this);
}
```

配合上面的代码，再来回顾下`$router/$route`是如何定义的：

```js
// 在原型链上定义$router、$route，方便直接查询路由
Object.defineProperty(Vue.prototype, '$router', {
    get() {

        // 返回挂在在根Vue实例的router实例
        return this._routerRoot._router
    }
});

// 代理挂在router的Vue实例的_route属性
Object.defineProperty(Vue.prototype, '$route', {
    get() {

        // 返回当前路由路径记录对象(Route)
        return this._routerRoot._route;
    }
});
```

两端代码相结合，我们便清晰的知道，我们**访问的`$router/$route`实际是访问的挂在`router`的`Vue`实例的`_router/_route`属性**，即`router`实例和`Route`。

上述代码中，我们还需要重点关注的是这句代码：

```js
// 初始化路由位置信息
this._router.init(this);
```

那么现在来具体[学习它](../Router的实例化/Router实例方法/README.md)。
