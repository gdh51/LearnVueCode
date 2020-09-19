/* @flow */

import type Router from "../index";
import { History } from "./base";
import { cleanPath } from "../util/path";
import { START } from "../util/route";
import { setupScroll, handleScroll } from "../util/scroll";
import { pushState, replaceState, supportsPushState } from "../util/push-state";

export class HTML5History extends History {
    constructor(router: Router, base: ?string) {
        // 继承基础路由行为
        super(router, base);

        // 获取初始化Location(完整的URL的path，包括查询字符串)
        this._startLocation = getLocation(this.base);
    }

    setupListeners() {
        // 用于注销路由事件监听器的队列，如果里面有函数，则说明已监听
        if (this.listeners.length > 0) {
            return;
        }

        const router = this.router;

        // 自定义的scrollBehavior函数
        const expectScroll = router.options.scrollBehavior;

        // 是否支持滚动条行为
        const supportsScroll = supportsPushState && expectScroll;

        // 支持时，安装滚动条行为监听函数
        if (supportsScroll) {
            this.listeners.push(setupScroll());
        }

        // 监听popstate事件(即通过浏览器前进后退)，做出路由更新
        const handleRoutingEvent = () => {
            // 获取跳转前的路由路径信息对象
            const current = this.current;

            // Avoiding first `popstate` event dispatched in some browsers but first
            // history route not updated since async guard at the same time.
            // 避免第一次`popstate`时间在START Route解析异步组件时更新
            const location = getLocation(this.base);

            // 所以当为初始化路由时且路径包括hash值都没有改变的情况下，直接退出
            if (this.current === START && location === initLocation) {
                return;
            }

            // 进行路由跳转
            this.transitionTo(location, (route) => {
                // 跳转完成时，处理当前页面的滚动条高度
                if (supportsScroll) {
                    handleScroll(router, route, current, true);
                }
            });

            window.addEventListener("popstate", handleRoutingEvent);
            this.listeners.push(() => {
                window.removeEventListener("popstate", handleRoutingEvent);
            });
        };
    }

    go(n: number) {
        window.history.go(n);
    }

    push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
        // 获取当前(跳转前)的Route
        const { current: fromRoute } = this;

        this.transitionTo(
            location,
            (route) => {
                // 调用pushState()进行浏览器跳转
                pushState(cleanPath(this.base + route.fullPath));

                // 查看滚动条行为
                handleScroll(this.router, route, fromRoute, false);

                // 执行自定义的完成函数
                onComplete && onComplete(route);
            },
            onAbort
        );
    }

    replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
        const { current: fromRoute } = this;
        this.transitionTo(
            location,
            (route) => {
                replaceState(cleanPath(this.base + route.fullPath));
                handleScroll(this.router, route, fromRoute, false);
                onComplete && onComplete(route);
            },
            onAbort
        );
    }

    ensureURL(push?: boolean) {
        // 确认当前路径和当前Route中路径(包含hash/query)是否不相同
        if (getLocation(this.base) !== this.current.fullPath) {
            // 返回完整路径进行浏览器地址更新
            const current = cleanPath(this.base + this.current.fullPath);

            // 正式更新浏览器地址
            push ? pushState(current) : replaceState(current);
        }
    }

    // 获取当前的完整路径信息
    getCurrentLocation(): string {
        return getLocation(this.base);
    }
}

// 获取完整的URL路径信息
export function getLocation(base: string): string {
    // 获取当前的路径
    let path = decodeURI(window.location.pathname);

    // 如果当前路径以基础路径作为开始，则获取其具体的变化路径
    if (base && path.indexOf(base) === 0) {
        path = path.slice(base.length);
    }

    // 返回该路径下的路径(包括查询字符串与hash值)
    return (path || "/") + window.location.search + window.location.hash;
}
