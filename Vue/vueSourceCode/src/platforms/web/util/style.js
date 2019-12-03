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
// 合并同一个VNode上的静态和动态的style
function normalizeStyleData(data: VNodeData): ? Object {

    // 获取动态style的标准化对象
    const style = normalizeStyleBinding(data.style);

    // static style is pre-processed into an object during compilation
    // and is always a fresh object, so it's safe to merge into it
    // 静态style已经在编译阶段进行了预处理，变成了一个对象的形式，
    // 所以这里可以直接将两者进行合并
    return data.staticStyle ?
        extend(data.staticStyle, style) :
        style
}

// normalize possible array / string values into Object
export function normalizeStyleBinding(bindingStyle: any) : ? Object {

    // 如果为对象组成的数组，则调用toObject将其转化为一个对象
    if (Array.isArray(bindingStyle)) {
        return toObject(bindingStyle);
    }

    // 如果绑定的为字符串，则按键值的形式转化为对象
    if (typeof bindingStyle === 'string') {
        return parseStyleText(bindingStyle)
    }
    return bindingStyle;
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 * 父组件的style的处理应该在子组件之后，所以
 * 父组件的style会重写子组件的style
 */
export function getStyle(vnode: VNodeWithData, checkChild: boolean) : Object {
    const res = {}
    let styleData;

    // 是否查询子组件(这里一定为true)
    if (checkChild) {
        let childNode = vnode;

        // 当前VNode节点是否为组件标签
        while (childNode.componentInstance) {

            // 获取组件标签的根节点
            childNode = childNode.componentInstance._vnode;

            // 如果组件的根节点有任何style属性，将其合并后添加至最终结果中
            if (
                childNode && childNode.data &&
                (styleData = normalizeStyleData(childNode.data))
            ) {
                extend(res, styleData)
            }
        }
    }

    // 将当前节点的所有style处理为一个对象后添加至res
    if ((styleData = normalizeStyleData(vnode.data))) {
        extend(res, styleData)
    }

    let parentNode = vnode;

    // 通过元素的根节点，向上查找组件，合并其style属性
    while ((parentNode = parentNode.parent)) {
        if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
            extend(res, styleData)
        }
    }
    return res;
}