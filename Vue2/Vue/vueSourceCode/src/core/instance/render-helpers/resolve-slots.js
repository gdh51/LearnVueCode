/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 * 运行时助手，用于将子Vnode转换为插槽对象，该函数主要用于处理2.5语法。在2.6语法中，仅对
 * 组件标签未指定任何插槽名的内容才进行处理
 */
export function resolveSlots(

    // 组件标签中内容(即我们写在父vm实例中的组件标签里面的插槽内容的VNode)
    children: ? Array < VNode > ,

    // 组件所在的vm实例上下文
    context : ? Component
): {
    [key: string]: Array < VNode >
} {

    // 如果组件并没有传入插槽内容，则直接返回
    if (!children || !children.length) {
        return {}
    }

    // 初始化插槽属性
    const slots = {};

    // 遍历插槽中的节点
    for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];

        // 查看该子Vnode的属性
        const data = child.data;

        // remove slot attribute if the node is resolved as a Vue slot node
        // 移除插槽的属性，如果该节点已被解析为插槽节点(该属性为2.5语法slot="name")
        if (data && data.attrs && data.attrs.slot) {

            // 这里删除的原因是因为除了data.attrs.slot，data.slot也存在
            delete data.attrs.slot;
        }

        // named slots should only be respected if the vnode was rendered in the
        // same context.
        // 只有当具名插槽的内容里面的节点和该组件VNode在同一个上下文时，才进行渲染(2.5语法slot="name")
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