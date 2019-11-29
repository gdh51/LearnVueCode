/* @flow */

import {
    isDef,
    isUndef
} from 'shared/util'

import {
    concat,
    stringifyClass,
    genClassForVnode
} from 'web/util/index'

function updateClass(oldVnode: any, vnode: any) {
    const el = vnode.elm;
    const data: VNodeData = vnode.data;
    const oldData: VNodeData = oldVnode.data;

    // 如果新节点没有任何关于class的属性且旧节点也没有，则直接返回
    if (
        isUndef(data.staticClass) &&
        isUndef(data.class) && (
            isUndef(oldData) || (
                isUndef(oldData.staticClass) &&
                isUndef(oldData.class)
            )
        )
    ) {
        return;
    }

    // 处理组件的class，如组件上的和组件根节点上的class
    let cls = genClassForVnode(vnode)

    // handle transition classes
    // 处理transition元素的class
    const transitionClass = el._transitionClasses;

    // 合并transition的class
    if (isDef(transitionClass)) {
        cls = concat(cls, stringifyClass(transitionClass))
    }

    // set the class
    // 只要当前新的class与之前的不一样则设置最新的class
    if (cls !== el._prevClass) {
        el.setAttribute('class', cls);

        // 存储之前的class属性
        el._prevClass = cls;
    }
}

export default {
    create: updateClass,
    update: updateClass
}