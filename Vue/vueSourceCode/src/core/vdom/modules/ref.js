/* @flow */

import {
    remove,
    isDef
} from 'shared/util'

export default {
    create(_: any, vnode: VNodeWithData) {
        registerRef(vnode)
    },
    update(oldVnode: VNodeWithData, vnode: VNodeWithData) {
        if (oldVnode.data.ref !== vnode.data.ref) {
            registerRef(oldVnode, true)
            registerRef(vnode)
        }
    },
    destroy(vnode: VNodeWithData) {
        registerRef(vnode, true)
    }
}

export function registerRef(vnode: VNodeWithData, isRemoval: ? boolean) {

    // 获取该节点的ref属性绑定的值
    const key = vnode.data.ref;
    if (!isDef(key)) return;

    // 获取该节点所处的vm实例
    const vm = vnode.context;

    // 获取该VNode节点的组件或元素
    const ref = vnode.componentInstance || vnode.elm;

    // 获取所在vm实例的$refs对象
    const refs = vm.$refs;

    // 是否为移除该VNode节点的ref模式
    if (isRemoval) {

        // 移除时，如果为数组，则遍历删除对应的元素或组件实例
        if (Array.isArray(refs[key])) {
            remove(refs[key], ref);

        // 移除单个ref直接赋值undefined
        } else if (refs[key] === ref) {
            refs[key] = undefined
        }

    // 不移除时，则添加该节点的ref
    } else {

        // 如果是v-for下的ref
        if (vnode.data.refInFor) {

            // 将全部ref填入数组中
            if (!Array.isArray(refs[key])) {
                refs[key] = [ref];
            } else if (refs[key].indexOf(ref) < 0) {
                refs[key].push(ref);
            }

        // 非v-for的同名ref，只会重写
        } else {
            refs[key] = ref;
        }
    }
}