# Vnode构造函数

`Vnode`构造函数在创建时，只能传入`8`个参数，而常见的是前`6`个参数分别表示**标签名、标签属性、子节点、文本节点的文本、所代表的元素、所在的上下文环境**(即所在`vm`实例)

```js
class VNode {
    tag: string | void;
    data: VNodeData | void;
    children: ? Array < VNode > ;
    text: string | void;
    elm: Node | void;
    ns: string | void;
    context: Component | void; // rendered in this component's scope
    key: string | number | void;
    componentOptions: VNodeComponentOptions | void;
    componentInstance: Component | void; // component instance
    parent: VNode | void; // component placeholder node

    // strictly internal
    // 内部属性
    raw: boolean; // contains raw HTML? (server only)
    isStatic: boolean; // hoisted static node
    isRootInsert: boolean; // necessary for enter transition check
    isComment: boolean; // empty comment placeholder?
    isCloned: boolean; // is a cloned node?
    isOnce: boolean; // is a v-once node?
    asyncFactory: Function | void; // async component factory function
    asyncMeta: Object | void;
    isAsyncPlaceholder: boolean;
    ssrContext: Object | void;
    fnContext: Component | void; // real context vm for functional nodes
    fnOptions: ? ComponentOptions; // for SSR caching
    devtoolsMeta: ? Object; // used to store functional render context for devtools
    fnScopeId: ? string; // functional scope id support

    constructor(
        tag ? : string,
        data ? : VNodeData,
        children ? : ? Array < VNode > ,
        text ? : string,
        elm ? : Node,
        context ? : Component,
        componentOptions ? : VNodeComponentOptions,
        asyncFactory ? : Function
    ) {
        // 标签名
        this.tag = tag;

        // 标签的属性
        this.data = data;

        // 标签的子节点
        this.children = children;

        // 文本节点的内容，其他节点没有
        this.text = text;

        // 对应的DOM元素
        this.elm = elm;
        this.ns = undefined;

        // 所在的vm实例
        this.context = context;
        this.fnContext = undefined
        this.fnOptions = undefined
        this.fnScopeId = undefined;

        // 标签上的key值
        this.key = data && data.key
        this.componentOptions = componentOptions
        this.componentInstance = undefined
        this.parent = undefined
        this.raw = false
        this.isStatic = false
        this.isRootInsert = true
        this.isComment = false
        this.isCloned = false
        this.isOnce = false
        this.asyncFactory = asyncFactory
        this.asyncMeta = undefined
        this.isAsyncPlaceholder = false
    }

    // DEPRECATED: alias for componentInstance for backwards compat.
    get child(): Component | void {
        return this.componentInstance
    }
}
```

它包含一个实例方法`child()`，用于返回其所在的`Vnode`所在的组件实例。

## 其他节点的创建

例如文本和注释节点，它们传入的参数只有上述参数中的`text`：

```js
// 创建一个空节点(空注释节点)
const createEmptyVNode = (text: string = '') => {
    const node = new VNode();
    node.text = text;

    // 创建的空节点为注释节点
    node.isComment = true;
    return node;
}

// 创建一个文本节点
function createTextVNode(val: string | number) {
    return new VNode(undefined, undefined, undefined, String(val))
}
```

## 克隆节点——cloneVNode()

该方法用于克隆`VNode`节点，具体使用时机暂时未知。

```js
// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 对于静态节点与插槽节点优化浅克隆，因为它们会在多次渲染时复用，
// 当有DOM操作依赖于这些元素时，克隆它们来避免错误
export function cloneVNode(vnode: VNode): VNode {
    const cloned = new VNode(
        vnode.tag,
        vnode.data,

        // #7975
        // clone children array to avoid mutating original in case of cloning
        // a child.
        // 克隆子子节点数组，防止在克隆子节点时改变原子节点数组
        vnode.children && vnode.children.slice(),
        vnode.text,
        vnode.elm,
        vnode.context,
        vnode.componentOptions,
        vnode.asyncFactory
    )
    cloned.ns = vnode.ns
    cloned.isStatic = vnode.isStatic
    cloned.key = vnode.key
    cloned.isComment = vnode.isComment
    cloned.fnContext = vnode.fnContext
    cloned.fnOptions = vnode.fnOptions
    cloned.fnScopeId = vnode.fnScopeId
    cloned.asyncMeta = vnode.asyncMeta
    cloned.isCloned = true
    return cloned;
}
```

[#7975](https://github.com/vuejs/vue/issues/7975)
