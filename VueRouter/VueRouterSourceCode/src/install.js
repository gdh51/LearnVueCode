import View from './components/view'
import Link from './components/link'

export let _Vue

export function install(Vue) {

    // 防止重复安装
    if (install.installed && _Vue === Vue) return;
    install.installed = true;

    // 防止重复注册
    _Vue = Vue;

    const isDef = v => v !== undefined;

    // 注册函数，用于注册router
    const registerInstance = (vm, callVal) => {

        // 获取该组件vm实例的占位节点
        let i = vm.$options._parentVnode
        if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {

            // 在当前vm实例上注册router
            i(vm, callVal)
        }
    }

    // 混入两个声明周期函数，帮忙注册路由和移除
    Vue.mixin({
        beforeCreate() {

            // 仅根vm实例配置上挂载有router
            if (isDef(this.$options.router)) {

                // 定义router的根vm实例
                this._routerRoot = this;

                // 原始router的配置
                this._router = this.$options.router;

                // 初始化路由位置信息
                this._router.init(this);

                // 在根vm实例上定义_route用来访问直接访问当前的路径信息
                Vue.util.defineReactive(this, '_route', this._router.history.current)

            // 组件vm实例
            } else {

                // 为其他子vm实例挂载路由所在的根vm实例
                this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
            }
            registerInstance(this, this);
        },
        destroyed() {
            registerInstance(this);
        }
    });

    // 在原型链上定义$router、$route，方便直接查询路由
    Object.defineProperty(Vue.prototype, '$router', {
        get() {

            // 返回挂在在根Vue实例的router实例
            return this._routerRoot._router
        }
    });

    Object.defineProperty(Vue.prototype, '$route', {
        get() {

            // 返回当前路由路径记录对象(Route)
            return this._routerRoot._route;
        }
    });

    // 挂载两个全局组件
    Vue.component('RouterView', View)
    Vue.component('RouterLink', Link)

    // options的合并策略
    const strats = Vue.config.optionMergeStrategies
    // use the same hook merging strategy for route hooks
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}