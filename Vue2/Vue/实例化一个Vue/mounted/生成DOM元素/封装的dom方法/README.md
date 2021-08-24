# nodeOps——封装的操作DOM的方法

该对象也是初始化`Vue`类时进行创建的，其中主要包含的是基于`VNode`操作`DOM`节点的方法，如果你对原生`JS`熟悉，那么一看就懂（这里直接是导入该模块中的全部方法，转换后就为`Object.freeze()`这种形式）：

```js
const nodeOps = Object.freeze({
    createElement: createElement,
    createElementNS: createElementNS,
    createTextNode: createTextNode,
    createComment: createComment,
    insertBefore: insertBefore,
    removeChild: removeChild,
    appendChild: appendChild,
    parentNode: parentNode,
    nextSibling: nextSibling,
    tagName: tagName,
    setTextContent: setTextContent,
    setStyleScope: setStyleScope
});
```

目录：

- [createElement()——创建一个元素节点](#createelement%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e5%85%83%e7%b4%a0%e8%8a%82%e7%82%b9)
- [createElementNS()——创建一个命名空间元素节点](#createelementns%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e5%91%bd%e5%90%8d%e7%a9%ba%e9%97%b4%e5%85%83%e7%b4%a0%e8%8a%82%e7%82%b9)
- [createTextNode()——创建一个文件节点](#createtextnode%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e6%96%87%e4%bb%b6%e8%8a%82%e7%82%b9)
- [createComment()——创建一个注释节点](#createcomment%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e6%b3%a8%e9%87%8a%e8%8a%82%e7%82%b9)
- [insertBefore()——在指定节点后前加入新节点](#insertbefore%e5%9c%a8%e6%8c%87%e5%ae%9a%e8%8a%82%e7%82%b9%e5%90%8e%e5%89%8d%e5%8a%a0%e5%85%a5%e6%96%b0%e8%8a%82%e7%82%b9)
- [removeChild()——移除指定的子节点](#removechild%e7%a7%bb%e9%99%a4%e6%8c%87%e5%ae%9a%e7%9a%84%e5%ad%90%e8%8a%82%e7%82%b9)
- [appendChild()——向当前子节点的最后加入一个节点](#appendchild%e5%90%91%e5%bd%93%e5%89%8d%e5%ad%90%e8%8a%82%e7%82%b9%e7%9a%84%e6%9c%80%e5%90%8e%e5%8a%a0%e5%85%a5%e4%b8%80%e4%b8%aa%e8%8a%82%e7%82%b9)
- [parentNode()——返回当前节点的父节点](#parentnode%e8%bf%94%e5%9b%9e%e5%bd%93%e5%89%8d%e8%8a%82%e7%82%b9%e7%9a%84%e7%88%b6%e8%8a%82%e7%82%b9)
- [nextSibling()——返回当前节点的下一个节点](#nextsibling%e8%bf%94%e5%9b%9e%e5%bd%93%e5%89%8d%e8%8a%82%e7%82%b9%e7%9a%84%e4%b8%8b%e4%b8%80%e4%b8%aa%e8%8a%82%e7%82%b9)
- [tagName()——返回当前节点标签名](#tagname%e8%bf%94%e5%9b%9e%e5%bd%93%e5%89%8d%e8%8a%82%e7%82%b9%e6%a0%87%e7%ad%be%e5%90%8d)
- [setTextContent()——设置当前节点的文本内容](#settextcontent%e8%ae%be%e7%bd%ae%e5%bd%93%e5%89%8d%e8%8a%82%e7%82%b9%e7%9a%84%e6%96%87%e6%9c%ac%e5%86%85%e5%ae%b9)
- [setStyleScope()——设置当前节点的样式的作用域](#setstylescope%e8%ae%be%e7%bd%ae%e5%bd%93%e5%89%8d%e8%8a%82%e7%82%b9%e7%9a%84%e6%a0%b7%e5%bc%8f%e7%9a%84%e4%bd%9c%e7%94%a8%e5%9f%9f)

[SourceCode](../../../../vueSourceCode/src/platforms/web/runtime/node-ops.js)

## createElement()——创建一个元素节点

该方法用于创建一个元素节点，当为`select`元素时会进行特殊的处理，但是目前还不清楚其含义，因为我实测三个值都会移除`multiple`属性，恰好相反将`!==`改为`===`时，是满足注释的条件的：

```js
function createElement(tagName: string, vnode: VNode): Element {

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
```

## createElementNS()——创建一个命名空间元素节点

创建一个具有命名空间的元素

```js
const namespaceMap = {
    svg: 'http://www.w3.org/2000/svg',
    math: 'http://www.w3.org/1998/Math/MathML'
};

function createElementNS(namespace: string, tagName: string): Element {

    // 创建一个具有命名空间的元素
    return document.createElementNS(namespaceMap[namespace], tagName)
}
```

## createTextNode()——创建一个文件节点

```js
function createTextNode(text: string): Text {
    return document.createTextNode(text)
}
```

## createComment()——创建一个注释节点

```js
// 创建一个注释节点
export function createComment(text: string): Comment {
    return document.createComment(text)
}
```

## insertBefore()——在指定节点后前加入新节点

```js
function insertBefore(parentNode: Node, newNode: Node, referenceNode: Node) {
    parentNode.insertBefore(newNode, referenceNode)
}
```

## removeChild()——移除指定的子节点

```js
function removeChild(node: Node, child: Node) {
    node.removeChild(child)
}
```

## appendChild()——向当前子节点的最后加入一个节点

```js
// 向当前子节点的最后加入一个节点
function appendChild(node: Node, child: Node) {
    node.appendChild(child)
}
```

## parentNode()——返回当前节点的父节点

```js
// 返回当前节点的父节点
function parentNode(node: Node): ? Node {
    return node.parentNode
}
```

## nextSibling()——返回当前节点的下一个节点

```js
// 返回当前节点的下一个节点
function nextSibling(node: Node) : ? Node {
    return node.nextSibling
}
```

## tagName()——返回当前节点标签名

```js
// 返回当前节点的标签名
function tagName(node: Element) : string {
    return node.tagName
}
```

## setTextContent()——设置当前节点的文本内容

```js
// 设置当前节点的文本内容
function setTextContent(node: Node, text: string) {
    node.textContent = text
}
```

## setStyleScope()——设置当前节点的样式的作用域

这个就有必要说一下了，这个当我们给样式设置`scoped`属性时就会设置。

```js
// 设置当前节点的样式作用域
function setStyleScope(node: Element, scopeId: string) {
    node.setAttribute(scopeId, '')
}
```
