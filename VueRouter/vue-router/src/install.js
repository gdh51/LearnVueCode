import View from './components/view'
import Link from './components/link'

export let _Vue

export function install(Vue) {

    // 防止重复安装
    if (install.installed && _Vue === Vue) return;
    install.installed = true

    _Vue = Vue

    const isDef = v => v !== undefined;

    // 注册
    const registerInstance = (vm, callVal) => {

        // 获取该组件vm实例的占位节点
        let i = vm.$options._parentVnode
        if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {

            // 在当前vm实例上注册router
            i(vm, callVal)
        }
    }

    // 混入两个声明周期函数
    Vue.mixin({
        beforeCreate() {

            // 仅根vm实例配置上挂载有router
            if (isDef(this.$options.router)) {
                this._routerRoot = this;
                this._router = this.$options.router;
                this._router.init(this);

                // 在其上定义_route用来访问history
                Vue.util.defineReactive(this, '_route', this._router.history.current)

            // 组件vm实例
            } else {

                // 每个组件vm实例递归将其父级router作为router
                this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
            }
            registerInstance(this, this)
        },
        destroyed() {
            registerInstance(this)
        }
    })

    // 在原型链上定义$router、$route，方便直接查询路由
    Object.defineProperty(Vue.prototype, '$router', {
        get() {
            return this._routerRoot._router
        }
    });

    Object.defineProperty(Vue.prototype, '$route', {
        get() {
            return this._routerRoot._route
        }
    });

    // 挂载两个全局组件
    Vue.component('RouterView', View)
    Vue.component('RouterLink', Link)

    const strats = Vue.config.optionMergeStrategies
    // use the same hook merging strategy for route hooks
    strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}