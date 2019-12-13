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

    // 当前组件vm实例所代表的VNode上的作用域插槽对象
    // _parentVnode.data.scopedSlots
    slots: {
        [key: string]: Function
    } | void,

    // 标准化后的插槽对象
    // vm.$slots
    normalSlots: {
        [key: string]: Array < VNode >
    },

    // 当前组件vm实例的作用域插槽对象
    // vm.$scopedSlots
    prevSlots ? : {
        [key: string]: Function
    } | void
): any {
    let res;

    // 是否具有标准化后的插槽对象
    const hasNormalSlots = Object.keys(normalSlots).length > 0;

    // 是否稳定?组件VNode是否具有作用域插槽，
    // 有，则取作用域插槽中.$stable值；
    // 无，取是否具有标准化后的插槽对象的反值
    const isStable = slots ? !!slots.$stable : !hasNormalSlots;

    // 取出作用域插槽的$key值
    const key = slots && slots.$key

    // 若当前组件VNode中不存在作用域插槽时，初始化作用域插槽对象
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
    // 暴露scopedSlots中普通的插槽
    // 遍历标准化后的插槽对象
    for (const key in normalSlots) {

        // 将标准化后对象里面的各个插槽对象存储在res中
        if (!(key in res)) {

            // 存放一个可以直接从中查询对应名称插槽对象的函数
            res[key] = proxyNormalSlot(normalSlots, key)
        }
    }

    // avoriaz seems to mock a non-extensible $scopedSlots object
    // and when that is passed down this would cause an error
    // avoriaz工具似乎模拟了一个不能扩展的$scopedSlots对象，档期通过它时会导致一个错误
    // 正常情况下无视该语句
    if (slots && Object.isExtensible(slots)) {
        (slots)._normalized = res
    }

    // 为最终的插槽对象定义三个属性
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

    // 返回一个函数，函数返回值为slots[key]
    return () => slots[key];
}