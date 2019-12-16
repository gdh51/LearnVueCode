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

    // 插槽元素中的默认子节点数组
    fallback: ? Array < VNode > ,

    // 插槽上的其他属性
    props : ? Object,

    // 插槽绑定的组件vm实例中的值
    bindObject : ? Object
): ? Array < VNode > {

    // 获取对应名称的插槽渲染函数
    const scopedSlotFn = this.$scopedSlots[name];
    let nodes;

    // 如果有该名称插槽
    if (scopedSlotFn) { // scoped slot

        // 初始化或直接使用插槽的属性对象
        props = props || {};

        // 这里我们绑定的值要为一个接口对象，而非单个值
        if (bindObject) {
            if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
                warn(
                    'slot v-bind without argument expects an Object',
                    this
                )
            }

            // 将作用域值直接合并到插槽元素的属性对象上
            props = extend(extend({}, bindObject), props)
        }

        // 获取插槽内容的VNode节点，并传入定义的值，若都没有则默认内容
        nodes = scopedSlotFn(props) || fallback

    // 在标准化插槽对象中不存在该对象时，在反向代理的$slots中查找，若都没有则默认内容
    } else {
        nodes = this.$slots[name] || fallback
    }

    // 为插槽元素创建一个template元素代替(2.5 slot语法)
    const target = props && props.slot
    if (target) {

        // 调用总是优化的API创建一个template VNode
        return this.$createElement('template', {
            slot: target
        }, nodes)
    } else {

        // 2.6情况直接返回nodes
        return nodes;
    }
}