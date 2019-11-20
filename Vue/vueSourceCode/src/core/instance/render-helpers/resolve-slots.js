/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 * 运行时助手，用于将子Vnode转换为插槽对象
 */
export function resolveSlots(
    children: ? Array < VNode > ,
    context : ? Component
): {
    [key: string]: Array < VNode >
} {

    // 没有就直接返回
    if (!children || !children.length) {
        return {}
    }

    // 初始化插槽最新
    const slots = {}
    for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];

        // 查看该子Vnode是否具有插槽才有的data属性
        const data = child.data;

        // remove slot attribute if the node is resolved as a Vue slot node
        // 移除插槽的属性，如果该节点已转换为插槽节点
        if (data && data.attrs && data.attrs.slot) {
            delete data.attrs.slot;
        }

        // named slots should only be respected if the vnode was rendered in the
        // same context.
        // 具名插槽只应该
        if ((child.context === context || child.fnContext === context) &&
            data && data.slot != null
        ) {
            const name = data.slot
            const slot = (slots[name] || (slots[name] = []))
            if (child.tag === 'template') {
                slot.push.apply(slot, child.children || [])
            } else {
                slot.push(child)
            }
        } else {
            (slots.default || (slots.default = [])).push(child)
        }
    }

    // ignore slots that contains only whitespace
    // 忽略(删除)那些只包含空格的插槽
    for (const name in slots) {
        if (slots[name].every(isWhitespace)) {
            delete slots[name]
        }
    }
    return slots;
}

function isWhitespace(node: VNode): boolean {

    // 注释节点或空白文本节点
    return (node.isComment && !node.asyncFactory) || node.text === ' '
}