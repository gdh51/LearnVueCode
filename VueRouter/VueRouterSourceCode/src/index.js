/* @flow */

import {
    install
} from './install'
import {
    START
} from './util/route'
import {
    assert
} from './util/warn'
import {
    inBrowser
} from './util/dom'
import {
    cleanPath
} from './util/path'
import {
    createMatcher
} from './create-matcher'
import {
    normalizeLocation
} from './util/location'
import {
    supportsPushState
} from './util/push-state'

import {
    HashHistory
} from './history/hash'
import {
    HTML5History
} from './history/html5'
import {
    AbstractHistory
} from './history/abstract'

import type {
    Matcher
} from './create-matcher'

export default class VueRouter {
    static install: () => void;
    static version: string;

    app: any;
    apps: Array < any > ;
    ready: boolean;
    readyCbs: Array < Function > ;
    options: RouterOptions;

    // 路由模式
    mode: string;
    history: HashHistory | HTML5History | AbstractHistory;
    matcher: Matcher;
    fallback: boolean;
    beforeHooks: Array < ? NavigationGuard > ;
    resolveHooks: Array < ? NavigationGuard > ;
    afterHooks: Array < ? AfterNavigationHook > ;

    constructor(options: RouterOptions = {}) {

        // 当前挂载的根Vue实例
        this.app = null;

        // 路由作为挂载的根Vue实例数量
        this.apps = [];

        // 原始的路由配置
        this.options = options;

        // 全局路由前置守卫
        this.beforeHooks = [];

        // 全局解析守卫
        this.resolveHooks = [];

        // 全局后置守卫
        this.afterHooks = [];

        // 根据路由配置创建3个不同类型的路由表
        this.matcher = createMatcher(options.routes || [], this)

        // 默认为hash模式
        let mode = options.mode || 'hash';

        // 是否在不兼容时自动降级
        // 判断变量为如果history模式，但不支持该API则且不主动关闭fallback模式
        this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
        if (this.fallback) {

            // 兼容模式下使用hash路由
            mode = 'hash'
        }

        // 非浏览器中时，取抽象模式
        if (!inBrowser) {
            mode = 'abstract'
        }

        this.mode = mode;

        // 根据模式初始化对应的路由模式
        switch (mode) {
            case 'history':
                this.history = new HTML5History(this, options.base)
                break
            case 'hash':
                this.history = new HashHistory(this, options.base, this.fallback)
                break
            case 'abstract':
                this.history = new AbstractHistory(this, options.base)
                break
            default:
                if (process.env.NODE_ENV !== 'production') {
                    assert(false, `invalid mode: ${mode}`)
                }
        }
    }

    match(
        raw: RawLocation,
        current ? : Route,
        redirectedFrom ? : Location
    ): Route {

        // 调用RouteRecord路由表内部接口查找匹配的路由路径
        return this.matcher.match(raw, current, redirectedFrom)
    }

    get currentRoute(): ? Route {
        return this.history && this.history.current
    }

    init(app: any /* Vue component instance */ ) {

        // app为router挂载的根实例
        process.env.NODE_ENV !== 'production' && assert(
            install.installed,
            `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
            `before creating root instance.`
        );

        // 将所有挂载了router的根vm实例，添加进apps中
        this.apps.push(app);

        // set up app destroyed handler
        // https://github.com/vuejs/vue-router/issues/2639
        app.$once('hook:destroyed', () => {

            // clean out app from this.apps array once destroyed
            // 当该根vm实例销毁时，从apps中移除
            const index = this.apps.indexOf(app);
            if (index > -1) this.apps.splice(index, 1);

            // ensure we still have a main app or null if no apps
            // we do not release the router so it can be reused
            // 确保仍有一个主要的根vm实例或没有vm实例
            // 我们不会移除router，以保证它可以在今后被复用
            // 更新当前的app变量指向
            if (this.app === app) this.app = this.apps[0] || null;
        })

        // main app previously initialized
        // return as we don't need to set up new history listener
        // 如果之前存在初始化过的实例，那么我们就不必去重新添加history的监听器了
        if (this.app) {
            return
        }

        // 将当前的根vm实例挂载在app上
        this.app = app;

        // 获取路由模式对象
        const history = this.history

        // 在各种模式下，更新路由表
        if (history instanceof HTML5History) {
            history.transitionTo(history.getCurrentLocation())
        } else if (history instanceof HashHistory) {
            const setupHashListener = () => {
                history.setupListeners()
            }
            history.transitionTo(

                // 获取当前完整的路径(包括查询字符串等等)
                history.getCurrentLocation(),
                setupHashListener,
                setupHashListener
            )
        }

        // 存储一个路由表更新函数
        history.listen(route => {

            // 为每个挂在router实例的根Vue实例更新当前的路由表
            this.apps.forEach((app) => {
                app._route = route;
            });
        });
    }

    beforeEach(fn: Function): Function {
        return registerHook(this.beforeHooks, fn)
    }

    beforeResolve(fn: Function): Function {
        return registerHook(this.resolveHooks, fn)
    }

    afterEach(fn: Function): Function {
        return registerHook(this.afterHooks, fn)
    }

    onReady(cb: Function, errorCb ? : Function) {
        this.history.onReady(cb, errorCb)
    }

    onError(errorCb: Function) {
        this.history.onError(errorCb)
    }

    push(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {

        // 指定更新完成或中断的回调函数时，调用Promise进行更新
        if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
            return new Promise((resolve, reject) => {
                this.history.push(location, resolve, reject)
            });

        // 当通过link跳转时，调用对应的历史模式进行组件更新
        } else {
            this.history.push(location, onComplete, onAbort)
        }
    }

    replace(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {
        // $flow-disable-line
        if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
            return new Promise((resolve, reject) => {
                this.history.replace(location, resolve, reject)
            })
        } else {
            this.history.replace(location, onComplete, onAbort)
        }
    }

    go(n: number) {
        this.history.go(n)
    }

    back() {
        this.go(-1)
    }

    forward() {
        this.go(1)
    }

    getMatchedComponents(to ? : RawLocation | Route): Array < any > {
        const route: any = to ?
            to.matched ?
            to :
            this.resolve(to).route : this.currentRoute
        if (!route) {
            return []
        }
        return [].concat.apply([], route.matched.map(m => {
            return Object.keys(m.components).map(key => {
                return m.components[key]
            })
        }))
    }

    resolve(
        to: RawLocation,
        current ? : Route,
        append ? : boolean
    ): {
        location: Location,
        route: Route,
        href: string,
        // for backwards compat
        normalizedTo: Location,
        resolved: Route
    } {
        current = current || this.history.current
        const location = normalizeLocation(
            to,
            current,
            append,
            this
        )
        const route = this.match(location, current)
        const fullPath = route.redirectedFrom || route.fullPath
        const base = this.history.base
        const href = createHref(base, fullPath, this.mode)
        return {
            location,
            route,
            href,
            // for backwards compat
            normalizedTo: location,
            resolved: route
        }
    }

    addRoutes(routes: Array < RouteConfig > ) {
        this.matcher.addRoutes(routes)
        if (this.history.current !== START) {
            this.history.transitionTo(this.history.getCurrentLocation())
        }
    }
}

function registerHook(list: Array < any > , fn: Function): Function {
    list.push(fn)
    return () => {
        const i = list.indexOf(fn)
        if (i > -1) list.splice(i, 1)
    }
}

function createHref(base: string, fullPath: string, mode) {
    var path = mode === 'hash' ? '#' + fullPath : fullPath
    return base ? cleanPath(base + '/' + path) : path
}

VueRouter.install = install
VueRouter.version = '__VERSION__'

if (inBrowser && window.Vue) {
    window.Vue.use(VueRouter)
}