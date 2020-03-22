/* @flow */

import type Router from '../index'
import {
    History
} from './base'
import {
    cleanPath
} from '../util/path'
import {
    START
} from '../util/route'
import {
    setupScroll,
    handleScroll
} from '../util/scroll'
import {
    pushState,
    replaceState,
    supportsPushState
} from '../util/push-state'

export class HTML5History extends History {
    constructor(router: Router, base: ? string) {

        // 继承基础路由信息
        super(router, base);

        // 是否提供一个控制滚动条行为的方法
        const expectScroll = router.options.scrollBehavior;
        const supportsScroll = supportsPushState && expectScroll;

        // 如果支持控制滚动条且用户想控制，则记录当前页面信息
        if (supportsScroll) {
            setupScroll();
        }

        // 获取完整的URL 路径 信息
        const initLocation = getLocation(this.base);

        // 监听popstate事件，做出变化
        window.addEventListener('popstate', e => {

            // 获取当前路径信息对象
            const current = this.current

            // Avoiding first `popstate` event dispatched in some browsers but first
            // history route not updated since async guard at the same time.
            // 避免第一次popstate事件触发时(在某些浏览器)history路由不进行更新
            const location = getLocation(this.base);

            // 初始化路由时，则直接退出
            if (this.current === START && location === initLocation) {
                return
            }

            // 其余时执行路由跳转时页面高度发生变化时的滚动
            this.transitionTo(location, route => {

                // 跳转到对应的位置
                if (supportsScroll) {
                    handleScroll(router, route, current, true)
                }
            });
        });
    }

    go(n: number) {
        window.history.go(n)
    }

    push(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {
        const {
            current: fromRoute
        } = this
        this.transitionTo(location, route => {
            pushState(cleanPath(this.base + route.fullPath))
            handleScroll(this.router, route, fromRoute, false)
            onComplete && onComplete(route)
        }, onAbort)
    }

    replace(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {
        const {
            current: fromRoute
        } = this
        this.transitionTo(location, route => {
            replaceState(cleanPath(this.base + route.fullPath))
            handleScroll(this.router, route, fromRoute, false)
            onComplete && onComplete(route)
        }, onAbort)
    }

    ensureURL(push ? : boolean) {
        if (getLocation(this.base) !== this.current.fullPath) {
            const current = cleanPath(this.base + this.current.fullPath)
            push ? pushState(current) : replaceState(current)
        }
    }

    getCurrentLocation(): string {
        return getLocation(this.base)
    }
}

// 获取完整的URL路径信息
export function getLocation(base: string): string {

    // 获取当前的路径
    let path = decodeURI(window.location.pathname)

    // 如果当前路径以基础路径作为开始，则获取其具体的变化路径
    if (base && path.indexOf(base) === 0) {
        path = path.slice(base.length)
    }

    // 返回该路径下的路径(包括查询字符串与hash值)
    return (path || '/') + window.location.search + window.location.hash
}