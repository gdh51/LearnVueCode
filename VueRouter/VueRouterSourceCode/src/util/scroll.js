/* @flow */

import type Router from '../index'
import {
    assert
} from './warn'
import {
    getStateKey,
    setStateKey
} from './state-key'

const positionStore = Object.create(null)

export function setupScroll() {
    // Fix for #1585 for Firefox
    // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
    // Fix for #2774 Support for apps loaded from Windows file shares not mapped to network drives: replaced location.origin with
    // window.location.protocol + '//' + window.location.host
    // location.host contains the port and location.hostname doesn't
    // 修复winodw下不支持通过文件协议直接打开的网站
    const protocolAndPath = window.location.protocol + '//' + window.location.host;

    // 获取当前路径
    const absolutePath = window.location.href.replace(protocolAndPath, '');

    // 将当前地址替换到网页，并保存当前页面的位置
    window.history.replaceState({
        key: getStateKey()
    }, '', absolutePath);

    // 注册popstate事件，当用户前进或后退时存储
    window.addEventListener('popstate', e => {

        // 每次切换地址时，将上一个路径的滚动条的位置信息保存下来
        saveScrollPosition();

        // 更新全局的key
        if (e.state && e.state.key) {
            setStateKey(e.state.key);
        }
    });
}

export function handleScroll(

    // 路由实例
    router: Router,

    // 跳转的路由记录信息对象
    to: Route,

    // 跳转前的路由记录信息对象
    from: Route,

    // 是否是通过popstate事件触发
    isPop: boolean
) {

    // 如果当前没有任何vm实例挂载则直接返回不进行处理
    if (!router.app) {
        return
    }

    // 如果用户没有定义滚动行为，也直接退出
    const behavior = router.options.scrollBehavior
    if (!behavior) {
        return
    }

    if (process.env.NODE_ENV !== 'production') {
        assert(typeof behavior === 'function', `scrollBehavior must be a function`)
    }

    // wait until re-render finishes before scrolling
    // 在组件渲染完成后在进行滚动
    router.app.$nextTick(() => {

        // 获取当前key值下最初所处于的位置信息
        const position = getScrollPosition();

        // 获取用户定义的滚动位置
        const shouldScroll = behavior.call(
            router,
            to,
            from,
            isPop ? position : null
        );

        // 如果用户未定义行为则直接返回
        if (!shouldScroll) {
            return
        }

        // 如果返回promise，则待promise状态改变时在更新
        if (typeof shouldScroll.then === 'function') {
            shouldScroll
                .then(shouldScroll => {
                    scrollToPosition((shouldScroll: any), position)
                })
                .catch(err => {
                    if (process.env.NODE_ENV !== 'production') {
                        assert(false, err.toString())
                    }
                })
        } else {

            // 普通的情况，则直接滚动到对应位置
            scrollToPosition(shouldScroll, position)
        }
    })
}

export function saveScrollPosition() {

    // 获取一个key值
    const key = getStateKey();

    // 将当前key值的位置的页面信息存入store中
    if (key) {
        positionStore[key] = {
            x: window.pageXOffset,
            y: window.pageYOffset
        }
    }
}

function getScrollPosition(): ? Object {
    const key = getStateKey()
    if (key) {
        return positionStore[key]
    }
}

function getElementPosition(el: Element, offset: Object) : Object {

    // 获取html元素在视窗的位置信息
    const docEl: any = document.documentElement;
    const docRect = docEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    //  返回元素在整个html视图中的位置，这里要减去用户设置的偏移量
    return {
        x: elRect.left - docRect.left - offset.x,
        y: elRect.top - docRect.top - offset.y
    }
}

function isValidPosition(obj: Object): boolean {
    return isNumber(obj.x) || isNumber(obj.y)
}

function normalizePosition(obj: Object): Object {
    return {
        x: isNumber(obj.x) ? obj.x : window.pageXOffset,
        y: isNumber(obj.y) ? obj.y : window.pageYOffset
    }
}

function normalizeOffset(obj: Object): Object {
    return {
        x: isNumber(obj.x) ? obj.x : 0,
        y: isNumber(obj.y) ? obj.y : 0
    }
}

function isNumber(v: any): boolean {
    return typeof v === 'number'
}

// 以数字开头的锚点
const hashStartsWithNumberRE = /^#\d/

function scrollToPosition(shouldScroll, position) {
    const isObject = typeof shouldScroll === 'object';

    // 滚动到#锚点的处理
    if (isObject && typeof shouldScroll.selector === 'string') {

        // getElementById would still fail if the selector contains a more complicated query like #main[data-attr]
        // but at the same time, it doesn't make much sense to select an element with an id and an extra selector
        const el = hashStartsWithNumberRE.test(shouldScroll.selector) // $flow-disable-line
            ?
            document.getElementById(shouldScroll.selector.slice(1)) // $flow-disable-line
            :

            // 支持选择器模式匹配
            document.querySelector(shouldScroll.selector)

        // 如果找到对应的元素
        if (el) {
            // 获取用户是否定义offset
            let offset =
                shouldScroll.offset && typeof shouldScroll.offset === 'object' ?
                shouldScroll.offset : {};

            // 标准化offset的数值
            offset = normalizeOffset(offset);

            // 获取元素在html元素中最终的偏移量
            position = getElementPosition(el, offset);
        } else if (isValidPosition(shouldScroll)) {
            position = normalizePosition(shouldScroll)
        }
    } else if (isObject && isValidPosition(shouldScroll)) {
        position = normalizePosition(shouldScroll)
    }

    // 滚动吧！
    if (position) {
        window.scrollTo(position.x, position.y)
    }
}