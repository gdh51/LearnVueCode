/* @flow */

import {
    _Set as Set,
    isObject
} from '../util/index'
import type {
    SimpleSet
} from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse(val: any) {
    _traverse(val, seenObjects);

    // 清空Set表
    seenObjects.clear();
}

function _traverse(val: any, seen: SimpleSet) {
    let i, keys;
    const isA = Array.isArray(val);

    // 非对象或数组或冻结属性或Vnode时直接返回
    if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
        return
    }

    // 对于对象或数组，添加它们的依赖项到seen防止循环引用
    if (val.__ob__) {
        const depId = val.__ob__.dep.id;

        // 已经进行收集则直接返回，防止循环引用
        if (seen.has(depId)) {
            return
        }
        seen.add(depId);
    }

    // 递归继续收集依赖项
    if (isA) {
        i = val.length
        while (i--) _traverse(val[i], seen);
    } else {
        keys = Object.keys(val)
        i = keys.length;
        while (i--) _traverse(val[keys[i]], seen);
    }
}