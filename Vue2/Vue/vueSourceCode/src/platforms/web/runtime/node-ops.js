/* @flow */

import {
    namespaceMap
} from 'web/util/index'

export function createElement(tagName: string, vnode: VNode): Element {

    // 创建该标签的节点
    const elm = document.createElement(tagName);

    // 除select元素外，其他元素直接返回
    if (tagName !== 'select') {
        return elm
    }

    // false or null will remove the attribute but undefined will not
    // 如果select元素存在multiple属性且它的值为null或false就移除该属性，而undefined不会
    // (而事实上三个值都会移除，所以暂时不清楚用处)
    if (vnode.data && vnode.data.attrs && vnode.data.attrs.multiple !== undefined) {
        elm.setAttribute('multiple', 'multiple')
    }
    return elm
}

export function createElementNS(namespace: string, tagName: string): Element {

    // 创建一个具有命名空间的元素
    return document.createElementNS(namespaceMap[namespace], tagName)
}

// 创建一个文本节点
export function createTextNode(text: string): Text {
    return document.createTextNode(text)
}

// 创建一个注释节点
export function createComment(text: string): Comment {
    return document.createComment(text)
}

// 将新节点在插入指定节点之前
export function insertBefore(parentNode: Node, newNode: Node, referenceNode: Node) {
    parentNode.insertBefore(newNode, referenceNode)
}

// 移除子节点中的某个具体的节点
export function removeChild(node: Node, child: Node) {
    node.removeChild(child)
}

// 向当前子节点的最后加入一个节点
export function appendChild(node: Node, child: Node) {
    node.appendChild(child)
}

// 返回当前节点的父节点
export function parentNode(node: Node): ? Node {
    return node.parentNode
}

// 返回当前节点的下一个节点
export function nextSibling(node: Node) : ? Node {
    return node.nextSibling
}


// 返回当前节点的标签名
export function tagName(node: Element) : string {
    return node.tagName
}

// 设置当前节点的文本内容
export function setTextContent(node: Node, text: string) {
    node.textContent = text
}

// 设置当前节点的样式作用域
export function setStyleScope(node: Element, scopeId: string) {
    node.setAttribute(scopeId, '')
}