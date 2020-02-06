/* @flow */
import {
    inBrowser
} from './dom'

// use User Timing api (if present) for more accurate key precision
// 使用User Timing来获取更精准的时间
const Time =
    inBrowser && window.performance && window.performance.now ?
    window.performance :
    Date

export function genStateKey(): string {

    // 取当前时间保留三位小数
    return Time.now().toFixed(3)
}

let _key: string = genStateKey()

export function getStateKey() {
    return _key
}

export function setStateKey(key: string) {
    return (_key = key)
}