/* @flow */

import {
    enter,
    leave
} from '../modules/transition'

// recursively search for possible transition defined inside the component root
// 找到transition组件中的真实根节点
function locateNode(vnode: VNode): VNodeWithData {
    return vnode.componentInstance && (!vnode.data || !vnode.data.transition) ?

        // 查询该组件的根节点(不一定为具体的元素)
        locateNode(vnode.componentInstance._vnode) : vnode;
}

export default {
    bind(el: any, {

        // 注意这里的value，解构赋值
        value
    }: VNodeDirective, vnode: VNodeWithData) {

        // 找到真实的元素(组件则为其第一个具体的顶层节点)
        vnode = locateNode(vnode);

        // 获取VNode节点的transition属性
        const transition = vnode.data && vnode.data.transition;

        // 存储元素原始的display属性
        const originalDisplay = el.__vOriginalDisplay =
            (el.style.display === 'none' ? '' : el.style.display);

        // 通过过渡动画的形式显示
        if (value && transition) {

            // 标记transition的根元素的show属性为true，即此处已经通过v-show启动了过渡
            vnode.data.show = true;

            // 执行进入过渡动画
            enter(vnode, () => {
                el.style.display = originalDisplay
            });

        // 普通的元素节点按v-show的值直接执行样式上的切换
        } else {
            el.style.display = (value ? originalDisplay : 'none');
        }
    },

    update(el: any, {
        value,
        oldValue
    }: VNodeDirective, vnode: VNodeWithData) {

        // 当值未发生变化时，不进行更新
        if (!value === !oldValue) return;

        // 找到真实的元素(组件则为其第一个具体的顶层节点)
        vnode = locateNode(vnode);
        const transition = vnode.data && vnode.data.transition;

        // 根据情况执行对应的过渡动画
        if (transition) {
            vnode.data.show = true
            if (value) {
                enter(vnode, () => {
                    el.style.display = el.__vOriginalDisplay
                })
            } else {
                leave(vnode, () => {
                    el.style.display = 'none'
                })
            }
        } else {
            el.style.display = value ? el.__vOriginalDisplay : 'none'
        }
    },

    unbind(
        el: any,
        binding: VNodeDirective,
        vnode: VNodeWithData,
        oldVnode: VNodeWithData,
        isDestroy: boolean
    ) {

        // 取消此指令绑定时，还原其属性
        if (!isDestroy) {
            el.style.display = el.__vOriginalDisplay
        }
    }
}