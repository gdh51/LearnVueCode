# 初始化渲染相关属性和方法

通过`initRender()`方法，为组件`vm`实例添加**其在父级上下文中定义的属性**。对于任意`vm`实例，它会在其上挂载2个用于创建`DOM`元素的方法(这个不是这里的重点，暂时不用关心)。

```js
function initRender(vm: Component) {

    // 该vm实例的根Vnode
    vm._vnode = null; // the root of the child tree

    // 用于存储v-once渲染的vnode片段
    vm._staticTrees = null; // v-once cached trees
    const options = vm.$options;

    // the placeholder node in parent tree
    // // 占位符VNode节点，即我们在父级上下文中使用的那个组件标签所代表的的VNode
    const parentVnode = vm.$vnode = options._parentVnode;

    // 组件Vnode所在的vm实例上下文
    const renderContext = parentVnode && parentVnode.context;

    // _renderChildren表示VNode在父级上下文中里面的子VNode节点数组(即插槽内容)
    // 这里是在处理2.5语法，对于2.6语法，只处理简写的插槽语法(即无任何具名插槽)
    vm.$slots = resolveSlots(options._renderChildren, renderContext);

    // 初始化作用域插槽对象
    vm.$scopedSlots = emptyObject;

    // bind the createElement fn to this instance
    // so that we get proper render context inside it.
    // args order: tag, data, children, normalizationType, alwaysNormalize
    // internal version is used by render functions compiled from templates
    // 定义一些渲染相关的方法
    vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false);
    // normalization is always applied for the public version, used in
    // user-written render functions.
    vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true);

    // $attrs & $listeners are exposed for easier HOC creation.
    // they need to be reactive so that HOCs using them are always updated
    // 暴露出$attrs和$listeners两个属性以便创建高阶组件
    // 它们需要变为响应式的，以便响应式更新
    // 组件VNode节点上的属性
    const parentData = parentVnode && parentVnode.data

    if (process.env.NODE_ENV !== 'production') {

        // 在当前组件实例上定义$attrs属性(即我们定义在组件标签上的属性)
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
        }, true);

        // 在当前组件实例上定义$listeners属性(即我们定义在组件标签上的事件监听器)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
        }, true)
    } else {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
    }
}
```

## resolveSlots()——普通插槽内容

该方法用于处理普通的插槽内容，即不使用`v-slot`语法的插槽，比如下面这种：

```html
<component>
    <div></div>
</component>

<!-- 这种也要处理，特殊情况 -->
<component>
    <template v-slot:default>
    <div></div>
</component>
```

那么其具体代码如下(已删除旧语法逻辑)：

```js
/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 * 运行时助手，用于将组件插槽中子节点Vnode添加到插槽对象上
 */
function resolveSlots(

    // 普通的插槽内容(未使用v-slot语法)
    children: ? Array < VNode > ,

    // 组件所在的vm实例上下文
    context : ? Component
): {
    [key: string]: Array < VNode >
} {

    // 如果组件并没有传入普通的插槽内容，则直接返回空对象
    // 如果使用纯粹的作用域插槽则在此处就返回
    if (!children || !children.length) {
        return {}
    }

    // 初始化p它插槽对象
    const slots = {};

    slots.default = [...children];

    return slots;
}

function isWhitespace(node: VNode): boolean {

    // 注释节点或空白文本节点
    return (node.isComment && !node.asyncFactory) || node.text === ' '
}
```

以上方法的处理结果简单说明下就是将普通插槽内容所代表的子节点属性定义在`$slots.default`下。
