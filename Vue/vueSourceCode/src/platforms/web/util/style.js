/* @flow */

import {
    cached,
    extend,
    toObject
} from 'shared/util'

export const parseStyleText = cached(function (cssText) {
    const res = {};

    // 匹配;但后面最近的地方不能单独出现未闭合的)，举个例子;())匹配成功，但;)不行
    // 不匹配 ; xxx) ，但匹配; (xxxxxx)
    const listDelimiter = /;(?![^(]*\))/g;

    // 匹配属性值  即 : xxx ，$1 中存放匹配到的属性值
    const propertyDelimiter = /:(.+)/;
    cssText.split(listDelimiter).forEach(function (item) {
        if (item) {
            const tmp = item.split(propertyDelimiter)

            // 按键值方式存放至res对象中
            tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim());
        }
    })
    return res;
});

// merge static and dynamic style data on the same vnode
function normalizeStyleData(data: VNodeData): ? Object {
    const style = normalizeStyleBinding(data.style)
    // static style is pre-processed into an object during compilation
    // and is always a fresh object, so it's safe to merge into it
    return data.staticStyle ?
        extend(data.staticStyle, style) :
        style
}

// normalize possible array / string values into Object
export function normalizeStyleBinding(bindingStyle: any) : ? Object {
    if (Array.isArray(bindingStyle)) {
        return toObject(bindingStyle)
    }
    if (typeof bindingStyle === 'string') {
        return parseStyleText(bindingStyle)
    }
    return bindingStyle
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 */
export function getStyle(vnode: VNodeWithData, checkChild: boolean) : Object {
    const res = {}
    let styleData

    if (checkChild) {
        let childNode = vnode
        while (childNode.componentInstance) {
            childNode = childNode.componentInstance._vnode
            if (
                childNode && childNode.data &&
                (styleData = normalizeStyleData(childNode.data))
            ) {
                extend(res, styleData)
            }
        }
    }

    if ((styleData = normalizeStyleData(vnode.data))) {
        extend(res, styleData)
    }

    let parentNode = vnode
    while ((parentNode = parentNode.parent)) {
        if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
            extend(res, styleData)
        }
    }
    return res
}