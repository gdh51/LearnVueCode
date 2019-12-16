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

    // 当前组件vm实例所代表的组件VNode上的作用域插槽对象
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

    // 是否具有标准化后的插槽对象(如果还没有则说明还未初始化过，肯定需要一次强制更新)
    const hasNormalSlots = Object.keys(normalSlots).length > 0;

    // 是否稳定，不需要强制更新?组件VNode是否具有作用域插槽，
    // 有，则取作用域插槽中.$stable值；
    // 无，取是否具有标准化后的插槽对象的反值
    const isStable = slots ? !!slots.$stable : !hasNormalSlots;

    // 取出基于插槽内容生成的hash key值，防止复用元素
    const key = slots && slots.$key

    // 若当前组件VNode中不存在插槽内容，则为其定义一个空的插槽
    if (!slots) {
        res = {};

    // 第一种情况，子组件更新，父组件不进行更新
    // 该组件VNode的插槽对象是否已经标准化
    } else if (slots._normalized) {

        // fast path 1: child component re-render only, parent did not change
        // 第一种开始更新方法：仅子组件更新，父组件不更新
        // 如果已经标准化，那么直接返回其标准化后的结果
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
        !hasNormalSlots &&

        // 是否已经标准化
        !prevSlots.$hasNormal
    ) {
        // fast path 2: stable scoped slots w/ no normal slots to proxy,
        // only need to normalize once
        // 第二种快速处理的情况：不需要强制更新的作用域插槽且不带有未标准化的插槽，只需要标准化一次
        return prevSlots
    } else {

        // 初始化情况，为每个插槽对象初始化
        res = {};
        for (const key in slots) {

            // 标准化处理插槽作用域的渲染函数
            if (slots[key] && key[0] !== '$') {
                res[key] = normalizeScopedSlot(normalSlots, key, slots[key]);
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
    // 如果vm.$slots可扩展，那么将标准化后的对象挂载到vm.$slots._normalized上
    if (slots && Object.isExtensible(slots)) {
        (slots)._normalized = res
    }

    // 将这三个属性直接定义在在，最终的插槽对象中定义三个属性
    def(res, '$stable', isStable);
    def(res, '$key', key);

    // 是否已经标准化
    def(res, '$hasNormal', hasNormalSlots);
    return res
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