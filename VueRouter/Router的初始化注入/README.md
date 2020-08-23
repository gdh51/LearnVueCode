# Router 的初始化注入

`Router`的初始化注入大约分为三个部分：

- 混入全局`mixin`用于注册
- 在`Vue.prototype`上定义`$route/$router`
- 挂在`Router`配套组件

## 注入的入口

首先`Router`的注入始于`Vue.use(VueRouter)`的使用，`Vue.use`会调用`VueRouter.install`这个函数来执行：

```js
VueRouter.install = install;

function install(Vue) {
    // 防止重复安装
    if (install.installed && _Vue === Vue) return;
    install.installed = true;

    // 防止重复注册
    _Vue = Vue;

    // 混入全局，这部分代码已经提取至最下方
    Vue.mixins(hooks);

    // 在原型链上定义$router、$route，方便直接查询路由
    Object.defineProperty(Vue.prototype, '$router', {
        get() {
            // 返回挂在在根Vue实例的router实例
            return this._routerRoot._router;
        },
    });

    Object.defineProperty(Vue.prototype, '$route', {
        get() {
            // 返回当前路由路径记录对象(Route)
            return this._routerRoot._route;
        },
    });

    // 挂载两个全局组件
    Vue.component('RouterView', View);
    Vue.component('RouterLink', Link);

    // options的合并策略
    const strats = Vue.config.optionMergeStrategies;
    // use the same hook merging strategy for route hooks
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate =
        strats.created;
}
```

从上面的注释可以看到总体的逻辑，那么关于`mixins`部分，该部分将在挂在`router`实例的`Vue`实例化时调用，会在那时初始化整个`router`的路由信息，并定义访问`Route`的方式。这里由于还没调用，我们先浏览下即可。如下：

```js
const isDef = (v) => v !== undefined;

// 注册函数，用于注册router
const registerInstance = (vm, callVal) => {

    // 获取该组件vm实例的占位节点
    // (比如使用el-button这个组件，则就为<el-button>这个元素)
    let i = vm.$options._parentVnode;

    // 调用该组件中的registerRouteInstance注册该实例
    // registerRouteInstance函数存在于router-view组件中
    // 具体我们到时候在学习
    if (
        isDef(i) &&
        isDef((i = i.data)) &&
        isDef((i = i.registerRouteInstance))
    ) {
        // 在当前vm实例上注册router
        i(vm, callVal);
    }
};

// 混入两个生命周期函数，帮忙注册路由和移除
Vue.mixin({
    beforeCreate() {

        // 仅根vm实例配置上挂载有router，并定义Route在_route上
        if (isDef(this.$options.router)) {

            // 定义router的根vm实例
            this._routerRoot = this;

            // 原始router的配置
            this._router = this.$options.router;

            // 初始化路由位置信息
            this._router.init(this);

            // 在根vm实例上定义_route用来访问直接访问当前的Route
            Vue.util.defineReactive(
                this,
                '_route',

                // 这里是Route
                this._router.history.current
            );

            // 组件vm实例
        } else {

            // 为其他子vm实例挂载路由所在的根vm实例
            this._routerRoot =
                (this.$parent && this.$parent._routerRoot) || this;
        }

        registerInstance(this, this);
    },
    destroyed() {

        // 销毁该组件时，注销实例
        registerInstance(this);
    },
});
```

那么下一步则是[初始化`Router`实例](../Router的实例化)
