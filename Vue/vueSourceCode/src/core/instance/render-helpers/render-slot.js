/* @flow */

import {
    extend,
    warn,
    isObject
} from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 */
export function renderSlot(

    // 插槽名称
    name: string,
    fallback: ? Array < VNode > ,
    props : ? Object,
    bindObject : ? Object
): ? Array < VNode > {

    // 取出对应名称的作用域插槽
    const scopedSlotFn = this.$scopedSlots[name];
    let nodes;

    // 如果有作用域插槽
    if (scopedSlotFn) { // scoped slot
        props = props || {}
        if (bindObject) {
            if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
                warn(
                    'slot v-bind without argument expects an Object',
                    this
                )
            }
            props = extend(extend({}, bindObject), props)
        }
        nodes = scopedSlotFn(props) || fallback

    // 不存在作用域插槽时，节点取原本插槽的或自带的VNode
    } else {
        nodes = this.$slots[name] || fallback
    }

    //
    const target = props && props.slot
    if (target) {

        // 调用总是优化的API创建一个template VNode
        return this.$createElement('template', {
            slot: target
        }, nodes)
    } else {
        return nodes;
    }
}