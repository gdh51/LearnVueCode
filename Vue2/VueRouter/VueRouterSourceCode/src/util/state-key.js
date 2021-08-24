/* @flow */
import { inBrowser } from "./dom";

// use User Timing api (if present) for more accurate key precision
const Time =
    inBrowser && window.performance && window.performance.now
        ? window.performance
        : Date;

export function genStateKey(): string {
    return Time.now().toFixed(3);
}

// 第一次的时候key值
let _key: string = genStateKey();

// 获取当前的key值
export function getStateKey() {
    return _key;
}

// 生成新的key值，提供给下一个路由跳转使用
export function setStateKey(key: string) {
    return (_key = key);
}
