/* @flow */

export function resolveScopedSlots(

    // 具名插槽对象数组
    fns: ScopedSlotsData, // see flow/vnode

    // 处理结果
    res ? : Object,

    // the following are added in 2.6
    // 是否具有动态的插槽名称，即是否需要强制更新
    hasDynamicKeys ? : boolean,

    // 是否由插槽内容生成hash key值
    contentHashKey ? : number
): {
    [key: string]: Function,
    $stable: boolean
} {

    // 取之前结果对象，或初始化
    res = res || {

        // 定义是否稳定，即是否需要强制更新
        $stable: !hasDynamicKeys
    };

    // 遍历具名插槽对象
    for (let i = 0; i < fns.length; i++) {

        // 取某个具名插槽对象
        const slot = fns[i];

        // 如果一个具名插槽的内容中仍有多个具名插槽则递归处理。
        if (Array.isArray(slot)) {
            resolveScopedSlots(slot, res, hasDynamicKeys)

        // 单个插槽则直接处理
        } else if (slot) {

            // marker for reverse proxying v-slot without scope on this.$slots
            // 给没有定义作用域的反向代理插槽提供标记
            if (slot.proxy) {
                slot.fn.proxy = true
            }

            // 将对应 插槽名：渲染函数 添加至最终结果
            res[slot.key] = slot.fn
        }
    }

    // 是否具有内容hash值
    if (contentHashKey) {
        (res: any).$key = contentHashKey
    }

    return res;
}