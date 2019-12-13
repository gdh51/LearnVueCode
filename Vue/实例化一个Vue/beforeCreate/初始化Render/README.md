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

## resolveSlots()——处理2.5 slot="name"属性

该方法是完全为了处理`2.5`以下的旧插槽语法而产生的，对于新语法，其只会返回一个空对象(所以可以忽略)。

### 2.5方法下的该方法

```js
/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 * 运行时助手，用于将子Vnode转换为插槽对象，该函数主要用于处理2.5语法。在2.6语法中，仅对
 * 组件标签未指定任何插槽名的内容才进行处理
 */
function resolveSlots(

    // 组件标签中内容(即我们写在父vm实例中的组件标签里面的插槽内容的VNode)
    children: ? Array < VNode > ,

    // 组件所在的vm实例上下文
    context : ? Component
): {
    [key: string]: Array < VNode >
} {

    // 如果组件并没有传入插槽内容，则直接返回
    if (!children || !children.length) {
        return {}
    }

    // 初始化插槽属性
    const slots = {};

    // 遍历插槽中的节点
    for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];

        // 查看该子Vnode的属性
        const data = child.data;

        // remove slot attribute if the node is resolved as a Vue slot node
        // 移除插槽的属性，如果该节点已被解析为插槽节点(该属性为2.5语法slot="name")
        if (data && data.attrs && data.attrs.slot) {

            // 这里删除的原因是因为除了data.attrs.slot，data.slot也存在
            delete data.attrs.slot;
        }

        // named slots should only be respected if the vnode was rendered in the
        // same context.
        // 只有当具名插槽的内容里面的节点和该组件VNode在同一个上下文时，才进行渲染(2.5语法slot="name")
        if ((child.context === context || child.fnContext === context) &&
            data && data.slot != null
        ) {
            // 插槽命名
            const name = data.slot;

            // 取出该插槽内的子节点，或为其初始化一个子节点数组
            const slot = (slots[name] || (slots[name] = []));

            // 若该节点为template，则跳过模版元素，将其子VNode节点直接存入该名称slot对象数组中
            if (child.tag === 'template') {
                slot.push.apply(slot, child.children || [])
            } else {

                // 非模版元素直接添加
                slot.push(child)
            }
        } else {

            // 非slot="name"语法时，即我们下面举例的情况，将其加入slots.default中
            (slots.default || (slots.default = [])).push(child)
        }
    }

    // ignore slots that contains only whitespace
    // 忽略(删除)那些只包含空格的插槽
    for (const name in slots) {
        if (slots[name].every(isWhitespace)) {
            delete slots[name]
        }
    }
    return slots;
}

function isWhitespace(node: VNode): boolean {

    // 注释节点或空白文本节点
    return (node.isComment && !node.asyncFactory) || node.text === ' '
}
```

可以看到，在`2.5`方法中，该方法会将具有`slot="name"`属性的模版的子`VNode`存放在其对应的`slots[name] = [VNodes]`数组中，其中子`VNode`节点数组中的空白元素会被删除。

### 2.6语法下的该方法

对于2.6仅有以下情况可以进入该函数，但其实这种情况也是2.5存在的默认语法：

```html
<child1>
    <template>
        <div>任意内容</div>
    </template>
</child1>
```

即不指定任何插槽命名，直接使用默认插槽，在这种情况下，该方法相当于：

```js
function resolveSlots(

    // 组件标签中内容(即我们写在父vm实例中的组件标签里面的插槽内容的VNode)
    children: ? Array < VNode > ,

    // 组件所在的vm实例上下文
    context : ? Component
): {
    [key: string]: Array < VNode >
} {

    // 如果组件并没有传入插槽内容，则直接返回
    if (!children || !children.length) {
        return {}
    }

    // 初始化插槽属性
    const slots = {};

    // 非slot="name"语法时，即我们下面举例的情况，将其加入slots.default中
    (slots.default || (slots.default = [])).push(children)

    // ignore slots that contains only whitespace
    // 忽略(删除)那些只包含空格的插槽
    if (slots.default.every(isWhitespace)) {
        delete slots.default;
    }

    return slots;
}
```

即结果就是将模版中的子`VNode`直接存放在`slots.default = [VNode]`中。

### 为什么没对2.6具名插槽进行处理

这里没对`2.6`中具名插槽的`VNode`处理的原因很简单，它必须在其组件实例中进行处理，因为如果我们要为插槽传递一个`prop`，根据我们的认知，渲染函数生成`DOM`时，获取组件`vm`实例上的数据，必须处于该`vm`实例中，所以我们必须在那里进行处理。

在`Vue 3.0`中该方法也肯定会被删除大部分，或完全移除。