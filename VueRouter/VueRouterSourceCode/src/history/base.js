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

        // 标准化基准path
        this.base = normalizeBase(base);

        // start with a route object that stands for "nowhere"
        // 在初始化时，添加一个表示没有任何路径的，当前路由路径记录对象
        this.current = START;

        // 更新Route时，等待更新Route存放的地方
        this.pending = null;

        // Route是否更新完毕
        this.ready = false;

        // onReady函数的success处理函数，在初始化时成功时调用
        this.readyCbs = [];

        // onReady函数的error处理函数，在初始化时出错时调用
        this.readyErrorCbs = [];

        // onError函数，在除第一次加载外触发错误时调用
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

        // 未处理的当前位置信息(比如路径字符串)
        location: RawLocation,

        // 路由切换完成时调用的函数
        onComplete ? : Function,

        // 路由切换中断时调用的函数
        onAbort ? : Function
    ) {

        // 获取匹配当前位置信息对象而产生的新的Route
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

    // 提交路由更新
    confirmTransition(route: Route, onComplete: Function, onAbort ? : Function) {

        // 保存跳转前Route
        const current = this.current;

        // 定义中断函数，错误回调仅在主动调用push/replace时触发
        const abort = err => {

            // after merging https://github.com/vuejs/vue-router/pull/2771 we
            // When the user navigates through history through back/forward buttons
            // we do not want to throw the error. We only throw it if directly calling
            // push/replace. That's why it's not included in isError
            // 我们仅在用户直接通过History API调用push/replace时报错
            // 确保错误类型不为内部错误，为其他Error类的错误
            if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {

                // 调用onError回调
                if (this.errorCbs.length) {
                    this.errorCbs.forEach(cb => {
                        cb(err)
                    })
                } else {

                    // 未捕获时报错
                    warn(false, 'uncaught error during route navigation:')
                    console.error(err)
                }
            }

            // 直接调用最终的终止函数
            onAbort && onAbort(err)
        }

        // 跳转前后的路径信息对象是否相同？(即转化为URL后全等)
        if (
            isSameRoute(route, current) &&

            // in the case the route map has been dynamically appended to
            // 防止动态的添加RouteRecord
            route.matched.length === current.matched.length
        ) {

            // 根据当前URL情况看是否加载URL
            this.ensureURL();
            return abort(new NavigationDuplicated(route))
        }

        // 根据当前Route与之前的Route，计算出要销毁的组件与新创建的组件
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
            // 获取要离开的路由组件的beforeRouteLeave函数（父->子顺序）
            extractLeaveGuards(deactivated),

            // global before hooks
            // 获取全局的beforeEach导航守卫
            this.router.beforeHooks,

            // in-component update hooks
            // 获取未变更组件的beforeRouteUpdate函数(子->父)
            extractUpdateHooks(updated),

            // in-config enter guards
            // 获取新增的RouteRecord中的beforeEnter函数
            activated.map(m => m.beforeEnter),

            // async components
            // 获取加载异步路由(或普通路由的函数)
            resolveAsyncComponents(activated)
        );

        // 将当前(将要跳转的)Route设置为等待处理
        this.pending = route;

        // 重写hook函数，允许用户中断路由变更
        const iterator = (hook: NavigationGuard, next) => {

            // 如果又切换了路由则直接终止
            if (this.pending !== route) {
                return abort()
            }
            try {

                // 为每个hook分别传入to和from路由信息，以及一个next函数
                hook(route, current, (to: any) => {

                    // 如果传入false则停止路由跳转，并跳转至上一个URL
                    if (to === false || isError(to)) {

                        // next(false) -> abort navigation, ensure current URL
                        this.ensureURL(true);
                        abort(to);

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
                        // 无内鬼，继续执行下一个路由守卫
                        next(to)
                    }
                })
            } catch (e) {
                abort(e)
            }
        }

        // 执行第一个批queue，执行完毕后调用下面的回调
        runQueue(queue, iterator, () => {

            // 后进回调函数，待路由提交，组件实例创建后调用
            const postEnterCbs = [];

            // 检测当前Route是否变更为即将跳转的路由
            const isValid = () => this.current === route

            // wait until async components are resolved before
            // extracting in-component enter guards
            // 等待异步组件加载完毕，再将beforeRouteEnter和beforeResolve
            // 作为hooks加入一个单独的执行队列中
            const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
            const queue = enterGuards.concat(this.router.resolveHooks);

            // 执行beforeRouteEnter和beforeResolve的hooks
            runQueue(queue, iterator, () => {

                // 如果目标路由发现变化，则终止
                if (this.pending !== route) {
                    return abort()
                }

                // 加载完毕，清空加载中的路由·
                this.pending = null
                onComplete(route);

                // 在新的组件实例更新完毕后，调用beforeRouteEnter函数中传入next中的函数
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

        // 暂存变更URL前Route
        const prev = this.current

        // 更新变更后Route
        this.current = route;

        // 执行History实例监听的函数，为每个挂在router的实例更新Route
        this.cb && this.cb(route);

        // 调用全局的afterEach函数
        this.router.afterHooks.forEach(hook => {

            // 传入新、旧Route作为参数
            hook && hook(route, prev)
        })
    }
}

// 初始化与格式化路由根路径，确保以/开头但不以/结尾
// 如最终为 /path
function normalizeBase(base: ? string): string {

    // 未传入根路径时，优先使用DOM元素中base中定义路径，其次是/
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
    // 确保根路径以/开头，不然就补上
    if (base.charAt(0) !== '/') {
        base = '/' + base
    }

    // remove trailing slash
    // 移除根路径末尾的/
    return base.replace(/\/$/, '')
}

// 计算上一个Route与下一个Route产生的变化组件
function resolveQueue(
    current: Array < RouteRecord > ,
    next: Array < RouteRecord >
): {
    updated: Array < RouteRecord > ,
    activated: Array < RouteRecord > ,
    deactivated: Array < RouteRecord >
} {
    let i;

    // 取两者中组件数量最多的进行遍历
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

        // 失活的组件
        deactivated: current.slice(i)
    }
}

//
function extractGuards(

    // 路由记录对象的数组
    records: Array < RouteRecord > ,

    // 路由导航守卫名称
    name: string,

    //
    bind: Function,

    // 是否反顺序出发hook函数
    reverse ? : boolean
): Array < ? Function > {

    /**
     * @description 获取当前RouteRecord中名为name的导航守卫(从components中取)(不会递归子路由)
     * @param {Object} def 对应的组件配置对象
     * @param {Object} instance 对应组件的实例对象
     * @param {Object} matchc 此组件的RouteRecord
     * @param {String} key 命名视图下的对应组件名称(无命名视图时为default)
     */
    const guards = flatMapComponents(records, (def, instance, match, key) => {

        // 获取该组件中名为name的导航守卫
        const guard = extractGuard(def, name);

        // 如果存在，则依次返回这些导航守卫函数
        if (guard) {
            // 可以用数组命名多个导航守卫
            return Array.isArray(guard) ?

                // 将导航守卫的this绑定至组件，并传入当前RouteReord与组件视图名称key
                guard.map(guard => bind(guard, instance, match, key)) :
                bind(guard, instance, match, key)
        }
    });

    // 最后将守卫hook扁平化为扁平数组
    // (在leave类型的守卫触发时，要倒叙返回返回值， 即从父->子)
    return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard(
    def: Object | Function,
    key: string
): NavigationGuard | Array < NavigationGuard > {

    // 将组件配置对象注册为Vue实例构造函数
    if (typeof def !== 'function') {
        // extend now so that global mixins are applied.
        def = _Vue.extend(def)
    }

    // 取其原始配置中名为key的路由守卫
    return def.options[key];
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

        // 参数为 守卫，组件实例(此时还没有) 匹配的RouteRecord 组件命名视图名称
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

    // 当前Route是否变更为将要跳转的路由
    isValid: () => boolean
): NavigationGuard {
    return function routeEnterGuard(to, from, next) {

        // 重写原导航守卫，让其自动执行next函数
        return guard(to, from, cb => {

            // beforeRouteEnter的next参数，支持函数作为参数，
            // 参入函数时，该函数会加入cbs回调数组中，待此组件实例创建后调用
            if (typeof cb === 'function') {
                cbs.push(() => {
                    // #750
                    // if a router-view is wrapped with an out-in transition,
                    // the instance may not have been registered at this time.
                    // we will need to poll for registration until current route
                    // is no longer valid.
                    poll(cb, match.instances, key, isValid)
                });
            }
            next(cb)
        });
    }
}

// 立即或延迟执行cb，主要为了解决上面的#750这个问题
function poll(

    // 我们在next中传入的回调函数
    cb: any, // somehow flow cannot infer this is a function

    // 当前命名视图创建的组件实例对象map表
    instances: Object,

    // 组件在命名视图中的名称
    key: string,
    isValid: () => boolean
) {

    // 正常情况下直接调用回调，并传入当前组件的实例作为参数
    if (
        instances[key] &&
        !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
    ) {
        cb(instances[key]);

    // 如果组件还未创建，则待到下一个宏任务阶段执行
    } else if (isValid()) {
        setTimeout(() => {
            poll(cb, instances, key, isValid)
        }, 16)
    }
}