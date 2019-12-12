# 初始化渲染相关属性和方法

```js
function initRender(vm: Component) {

    // 该vm实例的根Vnode
    vm._vnode = null; // the root of the child tree

    // 用于存储v-once渲染的vnode片段
    vm._staticTrees = null; // v-once cached trees
    const options = vm.$options;

    // the placeholder node in paresnt tree
    // 代表父Vnode树的占位符// 占位符VNode节点，即我们使用的那个组件标签所代表的的VNode
    const parentVnode = vm.$vnode = options._parentVnode;

    // 组件Vnode所在的vm实例上下文
    const renderContext = parentVnode && parentVnode.context;

    // 将最新的插槽，和父级上下文作为参数
    // 该对象用于处理2.5以下的旧语法slot指令(无视)
    vm.$slots = resolveSlots(options._renderChildren, renderContext);
    vm.$scopedSlots = emptyObject;

    // bind the createElement fn to this instance
    // so that we get proper render context inside it.
    // args order: tag, data, children, normalizationType, alwaysNormalize
    // internal version is used by render functions compiled from templates
    // 定义一些渲染相关的方法, 这里单独在实例时绑定是因为可以获取对应实例的属性
    vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
    // normalization is always applied for the public version, used in
    // user-written render functions.
    vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

    // $attrs & $listeners are exposed for easier HOC creation.
    // they need to be reactive so that HOCs using them are always updated
    // 定义响应式的$attr,$listeners以便更新
    const parentData = parentVnode && parentVnode.data

    if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
        }, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
        }, true)
    } else {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
    }
}
```