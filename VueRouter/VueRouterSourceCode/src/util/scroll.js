/* @flow */

import type Router from "../index";
import { assert } from "./warn";
import { getStateKey, setStateKey } from "./state-key";
import { extend } from "./misc";

const positionStore = Object.create(null);

export function setupScroll() {
    // Prevent browser scroll behavior on History popstate
    // 不实用浏览器自带的滚动条行为
    if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
    }
    // Fix for #1585 for Firefox
    // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
    // Fix for #2774 Support for apps loaded from Windows file shares not mapped to network drives: replaced location.origin with
    // window.location.protocol + '//' + window.location.host
    // location.host contains the port and location.hostname doesn't
    // 修bug，支持文件协议下的滚动条行为
    const protocolAndPath =
        window.location.protocol + "//" + window.location.host;
    const absolutePath = window.location.href.replace(protocolAndPath, "");

    // preserve existing history state as it could be overriden by the user
    // 保留当前已存在的state，确保其可以为用户修改
    const stateCopy = extend({}, window.history.state);

    // 生成本次跳转滚动条的唯一key值
    stateCopy.key = getStateKey();

    // 重写当前路径的state
    window.history.replaceState(stateCopy, "", absolutePath);

    // 安装保存/还原滚动条高度的函数
    window.addEventListener("popstate", handlePopState);

    // 返回一个注销函数
    return () => {
        window.removeEventListener("popstate", handlePopState);
    };
}

export function handleScroll(
    // router实例
    router: Router,

    // 已跳转的Route
    to: Route,

    // 跳转前的Route
    from: Route,

    // 是否是通过popstate事件触发
    isPop: boolean
) {
    // 未挂载到具体的app的应用时，不执行该操作
    if (!router.app) {
        return;
    }

    // 为定义滚动条行为时，不执行该操作
    const behavior = router.options.scrollBehavior;
    if (!behavior) {
        return;
    }

    if (process.env.NODE_ENV !== "production") {
        assert(
            typeof behavior === "function",
            `scrollBehavior must be a function`
        );
    }

    // wait until re-render finishes before scrolling
    // 等待应用重新渲染完成后在进行滚动
    router.app.$nextTick(() => {
        // 获取当前key值对应的位置信息对象
        const position = getScrollPosition();
        const shouldScroll = behavior.call(
            router,
            to,
            from,

            // 仅在进行浏览器控件跳转时提供之前的页面高度信息
            isPop ? position : null
        );

        // 如果未返回任何值则不做任何操作
        if (!shouldScroll) {
            return;
        }

        // 返回一个Promise对象时,等待其resolve时滚动
        if (typeof shouldScroll.then === "function") {
            shouldScroll
                .then((shouldScroll) => {
                    scrollToPosition((shouldScroll: any), position);
                })
                .catch((err) => {
                    if (process.env.NODE_ENV !== "production") {
                        assert(false, err.toString());
                    }
                });

            // 直接返回时直接滚动
        } else {
            scrollToPosition(shouldScroll, position);
        }
    });
}

export function saveScrollPosition() {
    // 为当前的跳转路径生成唯一key值
    const key = getStateKey();

    // 记录当前页面滚动条唯一
    if (key) {
        positionStore[key] = {
            x: window.pageXOffset,
            y: window.pageYOffset,
        };
    }
}

// 每次出发pushState的时候，存储跳转前的滚动条位置
function handlePopState(e) {
    saveScrollPosition();

    // 获取当前URL下的state
    if (e.state && e.state.key) {
        setStateKey(e.state.key);
    }
}

function getScrollPosition(): ?Object {
    const key = getStateKey();
    if (key) {
        return positionStore[key];
    }
}

// 获取对应元素的高度，并将计算最终的偏移量
function getElementPosition(el: Element, offset: Object): Object {
    // 获取文档的位置
    const docEl: any = document.documentElement;

    // 通过该函数获取的值为在视窗中的位置
    const docRect = docEl.getBoundingClientRect();

    // 获取元素的位置
    const elRect = el.getBoundingClientRect();

    // 计算元素相当于文档的偏移量，我们传入的offset对象的正值相当于向元素上/左移动
    return {
        x: elRect.left - docRect.left - offset.x,
        y: elRect.top - docRect.top - offset.y,
    };
}

function isValidPosition(obj: Object): boolean {
    return isNumber(obj.x) || isNumber(obj.y);
}

function normalizePosition(obj: Object): Object {
    return {
        x: isNumber(obj.x) ? obj.x : window.pageXOffset,
        y: isNumber(obj.y) ? obj.y : window.pageYOffset,
    };
}

// 将offset对象标准化为仅有x,y字段的形式
function normalizeOffset(obj: Object): Object {
    return {
        x: isNumber(obj.x) ? obj.x : 0,
        y: isNumber(obj.y) ? obj.y : 0,
    };
}

function isNumber(v: any): boolean {
    return typeof v === "number";
}

// 以数字开头的锚点值，认为其为ID
const hashStartsWithNumberRE = /^#\d/;

// 滚动到文档对应位置
function scrollToPosition(shouldScroll, position) {
    // 确保返回的跳转位置为一个对象
    const isObject = typeof shouldScroll === "object";

    // 当返回的对象包含一个锚点或元素选择器时
    if (isObject && typeof shouldScroll.selector === "string") {
        // getElementById would still fail if the selector contains a more complicated query like #main[data-attr]
        // but at the same time, it doesn't make much sense to select an element with an id and an extra selector
        const el = hashStartsWithNumberRE.test(shouldScroll.selector) // $flow-disable-line
            ? // 以数字开头的hash值认为其为id
              document.getElementById(shouldScroll.selector.slice(1)) // $flow-disable-line
            : // 调用querySelector查询传入的
              document.querySelector(shouldScroll.selector);

        // 查询到对应元素时，
        if (el) {
            // 是否还定义相对于当前元素的偏移量(注意为对象，形式同非选择器时)
            let offset =
                shouldScroll.offset && typeof shouldScroll.offset === "object"
                    ? shouldScroll.offset
                    : {};

            // 标准化传入的offset对象
            offset = normalizeOffset(offset);

            // 计算相当于文档的偏移量
            position = getElementPosition(el, offset);

            // 确保传入的x/y都为数字
        } else if (isValidPosition(shouldScroll)) {
            // 计算相当于文档的偏移量
            position = normalizePosition(shouldScroll);
        }

        // 确保传入的x/y都为数字
    } else if (isObject && isValidPosition(shouldScroll)) {
        position = normalizePosition(shouldScroll);
    }

    // 滚动到对应位置
    if (position) {
        window.scrollTo(position.x, position.y);
    }
}
