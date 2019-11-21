/* @flow */

import {
    def
} from 'core/util/lang'
import {
    normalizeChildren
} from 'core/vdom/helpers/normalize-children'
import {
    emptyObject
} from 'shared/util'

export function normalizeScopedSlots(

    // 父节点使用的子节点的具名插槽
    slots: {
        [key: string]: Function
    } | void,
    normalSlots: {
        [key: string]: Array < VNode >
    },

    // 上次被使用了的组件提供的插槽
    prevSlots ? : {
        [key: string]: Function
    } | void
): any {
    let res;

    // 是否存在slot语法(2.5语法具名插槽)
    const hasNormalSlots = Object.keys(normalSlots).length > 0;

    // 是否稳定，父元素使用插槽时，$stable属性为true；未使用时，不具有插槽
    const isStable = slots ? !!slots.$stable : !hasNormalSlots;

    // 取出插槽的key值
    const key = slots && slots.$key
    if (!slots) {
        res = {};

    // 第一种情况，子组件更新，父组件不进行更新
    } else if (slots._normalized) {
        // fast path 1: child component re-render only, parent did not change
        return slots._normalized

    // 第二种情况，稳定作用域的插槽
    } else if (
        isStable &&
        prevSlots &&
        prevSlots !== emptyObject &&
        key === prevSlots.$key &&
        !hasNormalSlots &&
        !prevSlots.$hasNormal
    ) {
        // fast path 2: stable scoped slots w/ no normal slots to proxy,
        // only need to normalize once
        return prevSlots
    } else {
        res = {}
        for (const key in slots) {
            if (slots[key] && key[0] !== '$') {
                res[key] = normalizeScopedSlot(normalSlots, key, slots[key])
            }
        }
    }
    // expose normal slots on scopedSlots
    for (const key in normalSlots) {
        if (!(key in res)) {
            res[key] = proxyNormalSlot(normalSlots, key)
        }
    }
    // avoriaz seems to mock a non-extensible $scopedSlots object
    // and when that is passed down this would cause an error
    if (slots && Object.isExtensible(slots)) {
        (slots)._normalized = res
    }
    def(res, '$stable', isStable)
    def(res, '$key', key)
    def(res, '$hasNormal', hasNormalSlots)
    return res
}

function normalizeScopedSlot(normalSlots, key, fn) {
    const normalized = function () {
        let res = arguments.length ? fn.apply(null, arguments) : fn({})
        res = res && typeof res === 'object' && !Array.isArray(res) ?
            [res] // single vnode
            :
            normalizeChildren(res)
        return res && (
                res.length === 0 ||
                (res.length === 1 && res[0].isComment) // #9658
            ) ? undefined :
            res
    }
    // this is a slot using the new v-slot syntax without scope. although it is
    // compiled as a scoped slot, render fn users would expect it to be present
    // on this.$slots because the usage is semantically a normal slot.
    if (fn.proxy) {
        Object.defineProperty(normalSlots, key, {
            get: normalized,
            enumerable: true,
            configurable: true
        })
    }
    return normalized
}

function proxyNormalSlot(slots, key) {
    return () => slots[key]
}