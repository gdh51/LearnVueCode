/* @flow */

import {
    isDef
} from 'shared/util'
import {
    isAsyncPlaceholder
} from './is-async-placeholder'

export function getFirstComponentChild(children: ? Array < VNode > ): ? VNode {
    if (Array.isArray(children)) {

        // 遍历子节点数组，获取其中第一个数组节点
        for (let i = 0; i < children.length; i++) {
            const c = children[i];

            // 返回异步组件或组件节点
            if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
                return c
            }
        }
    }
}