/* @flow */

import {
    inBrowser
} from './dom'
import {
    saveScrollPosition
} from './scroll'
import {
    genStateKey,
    setStateKey,
    getStateKey
} from './state-key'
import {
    extend
} from './misc'

// 是否支持history API 的pushState()方法
export const supportsPushState =
    inBrowser &&
    (function () {
        const ua = window.navigator.userAgent

        if (
            (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
            ua.indexOf('Mobile Safari') !== -1 &&
            ua.indexOf('Chrome') === -1 &&
            ua.indexOf('Windows Phone') === -1
        ) {
            return false
        }

        return window.history && 'pushState' in window.history
    })()

export function pushState(url ? : string, replace ? : boolean) {

    // 保持当前滚动条的位置
    saveScrollPosition();

    // try...catch the pushState call to get around Safari
    // DOM Exception 18 where it limits to 100 pushState calls
    // Safari浏览器限制只能使用100次pushState
    const history = window.history;
    try {

        // 如果是直接替换当前URL
        if (replace) {
            // preserve existing history state as it could be overriden by the user
            // 保留存在的历史记录状态，以便开发人员可以重写它
            const stateCopy = extend({}, history.state);

            // 获取当前的key值
            stateCopy.key = getStateKey();

            // 将当前URL地址替换进去
            history.replaceState(stateCopy, '', url);

        // 如果当前是更新模式，则创建一个新的key
        } else {
            history.pushState({
                key: setStateKey(genStateKey())
            }, '', url)
        }
    } catch (e) {

        // 降级方案，直接替换url
        window.location[replace ? 'replace' : 'assign'](url)
    }
}

export function replaceState(url ? : string) {

    // 调用pushState的replace模式的接口
    pushState(url, true);
}