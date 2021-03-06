/* @flow */

import type Router from "../index";
import { History } from "./base";
import { cleanPath } from "../util/path";
import { getLocation } from "./html5";
import { setupScroll, handleScroll } from "../util/scroll";
import { pushState, replaceState, supportsPushState } from "../util/push-state";

export class HashHistory extends History {
    constructor(router: Router, base: ?string, fallback: boolean) {
        super(router, base);

        // check history fallback deeplinking
        // 检查是否为降级而来，如果是则要更新当前地址的URL，并则直接返回
        if (fallback && checkFallback(this.base)) {
            return;
        }

        // 更新当前hash值，确保以根路径为起始
        ensureSlash();
    }

    // this is delayed until the app mounts
    // to avoid the hashchange listener being fired too early
    // 你懂的，有些浏览器初始化加载时会意外触发popState
    setupListeners() {

        // 用于注销路由事件监听器的队列，如果里面有函数，则说明已监听
        if (this.listeners.length > 0) {
            return;
        }
        const router = this.router;
        const expectScroll = router.options.scrollBehavior;
        const supportsScroll = supportsPushState && expectScroll;

        if (supportsScroll) {
            this.listeners.push(setupScroll());
        }

        const handleRoutingEvent = () => {

            // 获取跳转前Route
            const current = this.current;

            // 确保hash模式下URL形式正确
            if (!ensureSlash()) {
                return;
            }

            // 获取当前的完整path(包括查询字符串)
            this.transitionTo(getHash(), route => {

                // 是否处理滚动条
                if (supportsScroll) {
                    handleScroll(this.router, route, current, true);
                }

                // 不支持浏览器history模式时，通过replaceHash替换路由
                if (!supportsPushState) {

                    // 直接重写hash值
                    replaceHash(route.fullPath);
                }
            });
        };

        // 优先通过浏览器history模式完成监听
        const eventType = supportsPushState ? "popstate" : "hashchange";
        window.addEventListener(eventType, handleRoutingEvent);
        this.listeners.push(() => {
            window.removeEventListener(eventType, handleRoutingEvent);
        });
    }

    push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
        const { current: fromRoute } = this;
        this.transitionTo(
            location,
            (route) => {
                pushHash(route.fullPath);
                handleScroll(this.router, route, fromRoute, false);
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
                replaceHash(route.fullPath);
                handleScroll(this.router, route, fromRoute, false);
                onComplete && onComplete(route);
            },
            onAbort
        );
    }

    go(n: number) {
        window.history.go(n);
    }

    ensureURL(push?: boolean) {
        const current = this.current.fullPath;
        if (getHash() !== current) {
            push ? pushHash(current) : replaceHash(current);
        }
    }

    getCurrentLocation() {
        return getHash();
    }
}

// 检查是否为降级形式的hash模式
function checkFallback(base) {
    // 获取当前URL的路径(包括查询字符串与hash值)
    const location = getLocation(base);

    // 如果不是以/#开头，则将其替换为baseURL + /# + 路径 的形式
    if (!/^\/#/.test(location)) {
        window.location.replace(cleanPath(base + "/#" + location));
        return true;
    }
}

// 确保hash模式的URL正确
function ensureSlash(): boolean {
    // 获取hash值
    const path = getHash();

    // 确保当前为/起始
    if (path.charAt(0) === "/") {
        return true;
    }

    // 否则替换为/起始
    replaceHash("/" + path);
    return false;
}

export function getHash(): string {
    // We can't use window.location.hash here because it's not
    // consistent across browsers - Firefox will pre-decode it!
    // 我们不能直接window.location.hash，因为各个浏览器的行为不一致
    let href = window.location.href;
    const index = href.indexOf("#");
    // empty path
    if (index < 0) return "";

    href = href.slice(index + 1);
    // decode the hash but not the search or hash
    // as search(query) is already decoded
    // https://github.com/vuejs/vue-router/issues/2708
    const searchIndex = href.indexOf("?");
    if (searchIndex < 0) {
        const hashIndex = href.indexOf("#");
        if (hashIndex > -1) {
            href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex);
        } else href = decodeURI(href);
    } else {
        href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex);
    }

    return href;
}

// 根据当前的hash路径，生成URL
function getUrl(path) {
    const href = window.location.href;
    const i = href.indexOf("#");
    const base = i >= 0 ? href.slice(0, i) : href;
    return `${base}#${path}`;
}

function pushHash(path) {
    if (supportsPushState) {
        pushState(getUrl(path));
    } else {
        window.location.hash = path;
    }
}

function replaceHash(path) {
    // 是否支持history API的pushState方法
    if (supportsPushState) {
        // 支持时则使用该方法替换URL
        replaceState(getUrl(path));

        // 否则降级使用location.replace替换
    } else {
        window.location.replace(getUrl(path));
    }
}
