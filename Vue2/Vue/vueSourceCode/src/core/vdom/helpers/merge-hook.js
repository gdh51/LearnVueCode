/* @flow */

import VNode from '../vnode'
import {
    createFnInvoker
} from './update-listeners'
import {
    remove,
    isDef,
    isUndef,
    isTrue
} from 'shared/util'

export function mergeVNodeHook(def: Object, hookKey: string, hook: Function) {

    // 当def为VNode节点时，取出其hook对象，或初始化一个hook对象
    if (def instanceof VNode) {
        def = def.data.hook || (def.data.hook = {});
    }
    let invoker;

    // 取出旧的对应的hook函数
    const oldHook = def[hookKey];

    function wrappedHook() {

        // 调用最新的hook函数
        hook.apply(this, arguments);

        // important: remove merged hook to ensure it's called only once
        // and prevent memory leak
        // 从.fns中移除wrapperedHook函数，保证其只被调用一次，防止内存泄漏
        remove(invoker.fns, wrappedHook);
    }

    // 如果之前没有该类型钩子函数，则创建一个
    if (isUndef(oldHook)) {

        // no existing hook
        invoker = createFnInvoker([wrappedHook])
    } else {

        // 如果之前有该类型钩子函数，先查看是否合并过
        if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {

            // already a merged invoker
            // 合并过时，直接在.fns中添加即可
            invoker = oldHook;
            invoker.fns.push(wrappedHook)
        } else {

            // existing plain hook
            // 未合并过时，创建一个包装函数
            invoker = createFnInvoker([oldHook, wrappedHook])
        }
    }

    // 记录标记位，并重新挂载钩子函数
    invoker.merged = true;
    def[hookKey] = invoker;
}