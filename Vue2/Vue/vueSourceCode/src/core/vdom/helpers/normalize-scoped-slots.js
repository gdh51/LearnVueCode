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

    // 父组件中插槽中内容解析出来的插槽作用域对象
    // _parentVnode.data.scopedSlots
    slots: {
        [key: string]: Function
    } | void,

    // 表示未使用v-slot语法的普通插槽内容
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

    // 当具有普通的插槽内容时
    const hasNormalSlots = Object.keys(normalSlots).length > 0;

    // 作用域插槽是否稳定，不需要强制更新?
    // 如果有作用域插槽，则取其中的$stable值
    // 否则如果存在普通的插槽内容则取false
    const isStable = slots ? !!slots.$stable : !hasNormalSlots;

    // 取出基于作用域插槽的hash key值，防止复用元素
    const key = slots && slots.$key

    // 当不存在作用域插槽时，创建一个新的结果
    if (!slots) {
        res = {};

    // 第一种情况，如果当前作用域插槽已经标准化，则直接返回标准化结果
    } else if (slots._normalized) {

        // fast path 1: child component re-render only, parent did not change
        // 此时仅子组件重新渲染，父组件保存不变
        return slots._normalized

    // 第二种情况，插槽不需要强制更新，且插槽内容未变
    } else if (

        // 组件不需要强制更新
        isStable &&

        // 存在上一次处理完后的标准化插槽对象
        prevSlots &&
        prevSlots !== emptyObject &&

        // 插槽内容未变更时
        key === prevSlots.$key &&

        // 当前不为普通的插槽内容(不具有v-slot语法)
        !hasNormalSlots &&

        // 且上次的处理结果也不为普通的插槽内容
        !prevSlots.$hasNormal
    ) {
        // fast path 2: stable scoped slots w/ no normal slots to proxy,
        // only need to normalize once
        // 第二种快速处理的情况：不需要强制更新的作用域插槽且不是普通的插槽内容
        // 只需要标准化一次，即每次返回上次处理的结果
        return prevSlots
    } else {

        // 作用域插槽的初始化情况，为每个作用域插槽初始化
        res = {};
        for (const key in slots) {

            // 标准化处理插槽作用域的渲染函数
            if (slots[key] && key[0] !== '$') {

                // 三个参数分别为普通的插槽内容、具名插槽名称、具名插槽渲染函数
                res[key] = normalizeScopedSlot(normalSlots, key, slots[key]);
            }
        }
    }

    // expose normal slots on scopedSlots
    // 对于普通的插槽内容的VNode数组，将它们代理到$scopedSlots属性上
    for (const key in normalSlots) {

        // 这里只代理不同名称的，同名的会被屏蔽
        if (!(key in res)) {

            // 按名称来存放，返回一个直接访问对应普通插槽内容节点的闭包函数
            res[key] = proxyNormalSlot(normalSlots, key)
        }
    }

    // avoriaz seems to mock a non-extensible $scopedSlots object
    // and when that is passed down this would cause an error
    // 对于不可拓展的作用域插槽对象则不进行标记
    // 普通情况下对处理后的作用域插槽对象标记_normalized属性，且将标准化结果存放在内
    if (slots && Object.isExtensible(slots)) {
        (slots)._normalized = res
    }

    // 将这三个属性直接定义在在，最终的插槽对象中定义三个属性
    def(res, '$stable', isStable);
    def(res, '$key', key);

    // 是否为普通的插槽内容(不具有作用域和具名)
    def(res, '$hasNormal', hasNormalSlots);

    // 注意这里返回的结果同时挂载在组件元素的data.scopedSlots._normalized中
    return res;
}

function normalizeScopedSlot(normalSlots, key, fn) {
    const normalized = function () {
        let res = arguments.length ? fn.apply(null, arguments) : fn({})
        res = res && typeof res === 'object' && !Array.isArray(res) ?
            [res] // single vnode
            :

            // 当根节点位置有多个VNode节点时，将其标准化
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
    // 这是为使用v-slot语法但不赋予值的情况进行处理。虽然它也被编译为一个作用域插槽，
    // 但渲染函数的使用者希望它能存在于vm.$slots上，因为这种用法在语义上还是一个普通的插槽
    // 所以此处将反向代理的插槽定义在标准化的slots对象上
    if (fn.proxy) {

        // 即反向代理的具名插槽要挂载到vm.$slots中
        Object.defineProperty(normalSlots, key, {
            get: normalized,
            enumerable: true,
            configurable: true
        });
    }
    return normalized
}

function proxyNormalSlot(slots, key) {

    // 返回一个函数，函数返回值为slots[key]
    return () => slots[key];
}