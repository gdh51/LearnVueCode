/* @flow */

import {
    _Vue
} from '../install'
import type Router from '../index'
import {
    inBrowser
} from '../util/dom'
import {
    runQueue
} from '../util/async'
import {
    warn,
    isError,
    isExtendedError
} from '../util/warn'
import {
    START,
    isSameRoute
} from '../util/route'
import {
    flatten,
    flatMapComponents,
    resolveAsyncComponents
} from '../util/resolve-components'
import {
    NavigationDuplicated
} from './errors'

export class History {
    router: Router
    base: string
    current: Route
    pending: ? Route
    cb: (r: Route) => void
    ready: boolean
    readyCbs: Array < Function >
        readyErrorCbs: Array < Function >
        errorCbs: Array < Function >

        // implemented by sub-classes
        +go: (n: number) => void +
        push: (loc: RawLocation) => void +
        replace: (loc: RawLocation) => void +
        ensureURL: (push ? : boolean) => void +
        getCurrentLocation: () => string

    constructor(router: Router, base: ? string) {

        // 路由实例对象
        this.router = router

        // 标准化baseURL
        this.base = normalizeBase(base);

        // start with a route object that stands for "nowhere"
        // 在初始化时，添加一个表示没有任何路径的，当前路由位置信息对象
        this.current = START
        this.pending = null;
        this.ready = false;
        this.readyCbs = [];
        this.readyErrorCbs = [];
        this.errorCbs = [];
    }

    listen(cb: Function) {
        this.cb = cb
    }

    onReady(cb: Function, errorCb: ? Function) {
        if (this.ready) {
            cb()
        } else {
            this.readyCbs.push(cb)
            if (errorCb) {
                this.readyErrorCbs.push(errorCb)
            }
        }
    }

    onError(errorCb: Function) {
        this.errorCbs.push(errorCb)
    }

    transitionTo(

        // 当前的位置信息对象
        location: RawLocation,

        // 路由切换完成时调用的函数
        onComplete ? : Function,

        // 路由切换中断时调用的函数
        onAbort ? : Function
    ) {

        // 获取匹配当前位置信息对象而产生的新的当前路径信息对象
        const route = this.router.match(location, this.current);
        this.confirmTransition(
            route,
            () => {

                // 更新当前路径信息对象
                this.updateRoute(route)
                onComplete && onComplete(route)

                // 进行URL的跳转
                this.ensureURL()

                // fire ready cbs once
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

    confirmTransition(route: Route, onComplete: Function, onAbort ? : Function) {

        // 保存跳转前路径信息对象
        const current = this.current;

        // 定义中断函数，错误回调仅在主动调用push/replace时触发
        const abort = err => {
            // after merging https://github.com/vuejs/vue-router/pull/2771 we
            // When the user navigates through history through back/forward buttons
            // we do not want to throw the error. We only throw it if directly calling
            // push/replace. That's why it's not included in isError
            if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {
                if (this.errorCbs.length) {
                    this.errorCbs.forEach(cb => {
                        cb(err)
                    })
                } else {
                    warn(false, 'uncaught error during route navigation:')
                    console.error(err)
                }
            }
            onAbort && onAbort(err)
        }

        // 跳转前后的路径信息对象是否相同？(即转化为URL后全等)
        if (
            isSameRoute(route, current) &&

            // in the case the route map has been dynamically appended to
            // 且匹配的路由中的组件数量也相同
            route.matched.length === current.matched.length
        ) {

            // 根据当前URL情况看是否加载URL
            this.ensureURL()
            return abort(new NavigationDuplicated(route))
        }

        // 根据之前路由匹配的组件与即将更新路由要匹配的组件，得出要更新和失活的组件
        const {
            updated,
            deactivated,
            activated
        } = resolveQueue(
            this.current.matched,
            route.matched
        );

        // 在路由跳转前处理要调用的Hooks们，将它们统一添加到queue队列中
        // 添加更新顺序的队列，按不活跃函数的路由守卫-> 触发 beforeEach钩子 -> 触发update函数 ->
        // 触发活跃组件的beforeEnter -> 触发异步组件的
        const queue: Array < ? NavigationGuard > = [].concat(
            // in-component leave guards
            extractLeaveGuards(deactivated),
            // global before hooks
            this.router.beforeHooks,
            // in-component update hooks
            extractUpdateHooks(updated),
            // in-config enter guards
            activated.map(m => m.beforeEnter),
            // async components
            resolveAsyncComponents(activated)
        );

        // 将当前(将要跳转的)路径对象设置为等待处理
        this.pending = route;

        // 定义调用hook的迭代器函数
        const iterator = (hook: NavigationGuard, next) => {

            // 如果又切换了路由则直接终止
            if (this.pending !== route) {
                return abort()
            }
            try {

                // 分别传入to和from路由信息
                hook(route, current, (to: any) => {

                    // 如果传入false则停止路由跳转，并切换为跳转前URL
                    if (to === false || isError(to)) {
                        // next(false) -> abort navigation, ensure current URL
                        this.ensureURL(true)
                        abort(to)

                    // 重定向到其他URL
                    } else if (
                        typeof to === 'string' ||
                        (typeof to === 'object' &&
                            (typeof to.path === 'string' || typeof to.name === 'string'))
                    ) {
                        // next('/') or next({ path: '/' }) -> redirect
                        abort()
                        if (typeof to === 'object' && to.replace) {
                            this.replace(to)
                        } else {
                            this.push(to)
                        }
                    } else {

                        // confirm transition and pass on the value
                        // 继续执行下一个路由守卫
                        next(to)
                    }
                })
            } catch (e) {
                abort(e)
            }
        }

        // 依次执行queue队列，并调用iterator函数，并在最后调用最后的回调函数
        runQueue(queue, iterator, () => {
            const postEnterCbs = []
            const isValid = () => this.current === route

            // wait until async components are resolved before
            // extracting in-component enter guards
            // 等待异步组件加载完毕，将beforeRouteEnter和beforeResolve加入队列进行执行
            const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
            const queue = enterGuards.concat(this.router.resolveHooks)

            // 那么此时在来执行
            runQueue(queue, iterator, () => {
                if (this.pending !== route) {
                    return abort()
                }
                this.pending = null
                onComplete(route)
                if (this.router.app) {
                    this.router.app.$nextTick(() => {
                        postEnterCbs.forEach(cb => {
                            cb()
                        })
                    })
                }
            })
        })
    }

    updateRoute(route: Route) {

        // 更新current路由
        const prev = this.current
        this.current = route
        this.cb && this.cb(route)
        this.router.afterHooks.forEach(hook => {
            hook && hook(route, prev)
        })
    }
}

function normalizeBase(base: ? string): string {

    // 未传入基础URL时
    if (!base) {

        // 在浏览器环境中，优先使用base元素中的地址，否则还是使用/
        if (inBrowser) {
            // respect <base> tag
            // 优先使用base元素定义的路径
            const baseEl = document.querySelector('base')
            base = (baseEl && baseEl.getAttribute('href')) || '/'
            // strip full URL origin
            // 去除协议地址
            base = base.replace(/^https?:\/\/[^\/]+/, '')

            // 在服务器渲染时，初始化为/
        } else {
            base = '/'
        }
    }

    // make sure there's the starting slash
    // 确保基础路径以/开头，不然就补上
    if (base.charAt(0) !== '/') {
        base = '/' + base
    }

    // remove trailing slash
    // 移除末尾的/
    return base.replace(/\/$/, '')
}

function resolveQueue(
    current: Array < RouteRecord > ,
    next: Array < RouteRecord >
): {
    updated: Array < RouteRecord > ,
    activated: Array < RouteRecord > ,
    deactivated: Array < RouteRecord >
} {
    let i;

    // 取两者中组件数量最多的
    const max = Math.max(current.length, next.length);

    // 从父级组件开始，依次对比，当发现第一个不同的组件时，
    // 则说明从当前组件开始，组件发生了更新
    for (i = 0; i < max; i++) {
        if (current[i] !== next[i]) {
            break
        }
    }
    return {

        // 未变动的组件，但是需要提醒更新的组件
        updated: next.slice(0, i),

        // 新激活的组件
        activated: next.slice(i),

        // 变更的组件
        deactivated: current.slice(i)
    }
}

function extractGuards(

    // 路由记录对象的数组
    records: Array < RouteRecord > ,

    // 路由导航守卫名称
    name: string,
    bind: Function,
    reverse ? : boolean
): Array < ? Function > {

    // 对records数组调用forEach方法，整理其传入的这个回调函数
    const guards = flatMapComponents(records, (def, instance, match, key) => {

        // 获取用户定义的路由守卫
        const guard = extractGuard(def, name);

        // 如果存在，则依次返回这些导航守卫函数
        if (guard) {
            return Array.isArray(guard) ?
                guard.map(guard => bind(guard, instance, match, key)) :
                bind(guard, instance, match, key)
        }
    });

    // 返回守卫们触发后的返回值数组(在leave类型的守卫触发时，要倒叙返回返回值，
    // 即从父->子)
    return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard(
    def: Object | Function,
    key: string
): NavigationGuard | Array < NavigationGuard > {
    if (typeof def !== 'function') {
        // extend now so that global mixins are applied.
        def = _Vue.extend(def)
    }
    return def.options[key]
}

function extractLeaveGuards(deactivated: Array < RouteRecord > ): Array < ? Function > {
    return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks(updated: Array < RouteRecord > ): Array < ? Function > {
    return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard(guard: NavigationGuard, instance: ? _Vue): ? NavigationGuard {
    if (instance) {
        return function boundRouteGuard() {
            return guard.apply(instance, arguments)
        }
    }
}

function extractEnterGuards(
    activated: Array < RouteRecord > ,
    cbs: Array < Function > ,
    isValid: () => boolean
) : Array < ? Function > {
    return extractGuards(
        activated,
        'beforeRouteEnter',
        (guard, _, match, key) => {
            return bindEnterGuard(guard, match, key, cbs, isValid)
        }
    )
}

function bindEnterGuard(
    guard: NavigationGuard,
    match: RouteRecord,
    key: string,
    cbs: Array < Function > ,
    isValid: () => boolean
): NavigationGuard {
    return function routeEnterGuard(to, from, next) {
        return guard(to, from, cb => {
            if (typeof cb === 'function') {
                cbs.push(() => {
                    // #750
                    // if a router-view is wrapped with an out-in transition,
                    // the instance may not have been registered at this time.
                    // we will need to poll for registration until current route
                    // is no longer valid.
                    poll(cb, match.instances, key, isValid)
                })
            }
            next(cb)
        })
    }
}

function poll(
    cb: any, // somehow flow cannot infer this is a function
    instances: Object,
    key: string,
    isValid: () => boolean
) {
    if (
        instances[key] &&
        !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
    ) {
        cb(instances[key])
    } else if (isValid()) {
        setTimeout(() => {
            poll(cb, instances, key, isValid)
        }, 16)
    }
}