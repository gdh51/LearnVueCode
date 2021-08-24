/* @flow */

import {
    isDef,
    isObject
} from 'shared/util'

export function genClassForVnode(vnode: VNodeWithData): string {

    // 获取当前节点的属性
    let data = vnode.data;

    // 暂时定义父子节点
    let parentNode = vnode;
    let childNode = vnode;

    // 组件节点，该节点是否组件节点
    while (isDef(childNode.componentInstance)) {

        // 获取该vm实例的根节点
        childNode = childNode.componentInstance._vnode;

        // 合并根节点与当前组件实例上的属性
        if (childNode && childNode.data) {
            data = mergeClassData(childNode.data, data)
        }
    }

    // 组件的根节点合并class
    while (isDef(parentNode = parentNode.parent)) {

        // 如果父节点存在节点属性，则合并它们的class属性
        if (parentNode && parentNode.data) {
            data = mergeClassData(data, parentNode.data);
        }
    }

    // 返回最终动态和静态class拼接的结果
    return renderClass(data.staticClass, data.class)
}

function mergeClassData(child: VNodeData, parent: VNodeData): {
    staticClass: string,
    class: any
} {
    return {
        staticClass: concat(child.staticClass, parent.staticClass),

        // 如果子节点存在动态的class则合并父级的，不存在则直接取用父级的
        class: isDef(child.class) ?
            [child.class, parent.class] :
            parent.class
    }
}

export function renderClass(
    staticClass: ? string,
    dynamicClass : any
): string {

    // 存在定义的class时，转化为合适的字符串返回
    if (isDef(staticClass) || isDef(dynamicClass)) {
        return concat(staticClass, stringifyClass(dynamicClass))
    }

    // 不存在时返回空字符串
    return '';
}

export function concat(a: ? string, b : ? string): string {

    //  class属性的专用拼接函数
    return a ? b ? (a + ' ' + b) : a : (b || '')
}

export function stringifyClass(value: any): string {

    // 处理多个动态的class，因为多个会进行拼接为数组
    if (Array.isArray(value)) {
        return stringifyArray(value)
    }

    // 处理单个冬天的class，直接用对象形式的处理
    if (isObject(value)) {
        return stringifyObject(value)
    }

    // 字符串形式时直接返回
    if (typeof value === 'string') {
        return value;
    }

    return '';
}

function stringifyArray(value: Array < any > ): string {
    let res = '';
    let stringified;

    // 遍历逐个调用stringifyClass转化为字符串
    for (let i = 0, l = value.length; i < l; i++) {
        if (isDef(stringified = stringifyClass(value[i])) && stringified !== '') {
            if (res) res += ' '
            res += stringified
        }
    }
    return res;
}

function stringifyObject(value: Object): string {

    // 对于对象形式的class，其值为真值的，就拼接在一起
    let res = ''
    for (const key in value) {
        if (value[key]) {
            if (res) res += ' '
            res += key
        }
    }
    return res;
}