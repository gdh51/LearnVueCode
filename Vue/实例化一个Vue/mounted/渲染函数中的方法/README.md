# 渲染函数中的方法

这里是介绍渲染函数中方法的目录：

## _m()——renderStatic()渲染静态节点

该方法用于渲染静态的节点dom片段，当然它自身不存在渲染函数，它调用静态渲染函数数组中对应的函数来进行渲染：

```js
function renderStatic(

    // 静态render数组中的坐标
    index: number,
    isInFor: boolean
): VNode | Array < VNode > {

    // 缓存生成的静态根节点生成的Vnode片段的结构
    const cached = this._staticTrees || (this._staticTrees = []);

    // 有缓存则直接使用
    let tree = cached[index];

    // if has already-rendered static tree and not inside v-for,
    // we can reuse the same tree.
    // 有缓存，且不再v-for中，则复用之前的
    if (tree && !isInFor) {
        return tree
    }

    // otherwise, render a fresh tree.
    // 否则渲染一个新的Vnode片段
    // 取出对应的静态渲染函数进行渲染
    tree = cached[index] = this.$options.staticRenderFns[index].call(

        // vue实例的代理对象
        this._renderProxy,
        null,

        // 用于为functional组件模版生成渲染函数
        this // for render fns generated for functional component templates
    );

    // 为该Vnode片段的节点添加静态属性标记
    markStatic(tree, `__static__${index}`, false);
    return tree;
}
```

该方法就是根据传入的静态函数的`index`，来调用`staticRenderFns`数组中对应的静态渲染函数来生成dom片段，之后调用`markStatic()`方法来标记所有的静态节点

### markStatic()——标记静态根节点

为所有静态根`Vnode`添加`isStatic`与`key`属性，未给其子节点添加哦

```js
function markStatic(
    tree: VNode | Array < VNode > ,
    key: string,
    isOnce: boolean
) {
    // 遍历全部静态根节点，为所有元素节点添加静态节点标记
    if (Array.isArray(tree)) {
        for (let i = 0; i < tree.length; i++) {
            if (tree[i] && typeof tree[i] !== 'string') {
                markStaticNode(tree[i], `${key}_${i}`, isOnce)
            }
        }
    } else {
        markStaticNode(tree, key, isOnce)
    }
}

function markStaticNode(node, key, isOnce) {
    node.isStatic = true;
    node.key = key;
    node.isOnce = isOnce;
}
```

## _c()——createElement()创建元素

该方法来自于最初的`initRender()`函数，它在最初实例化`Vue`时绑定的，那么问题来了，为什么要在实例化时绑定，因为此时绑定就能获取对应实例上的属性，那么我们看看它的函数：

```js
// args: tag, data, children, normalizationType, alwaysNormalize
vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false);
```

`_c()`函数的四个参数分别为标签名、元素属性、子节点、标准化类型；而`createElement()`函数的6个参数分别为绑定的vm实例、标签名、元素属性、子节点、标准化类型、是否深度标准化，一般情况下是否深度标准化是否定的。

```js
// wrapper function for providing a more flexible interface
// without getting yelled at by flow
function createElement(

    // 上下文环境，即vm实例
    context: Component,
    tag: any,

    // 元素属性
    data: any,

    // 子元素
    children: any,

    // 标准化类型
    normalizationType: any,
    alwaysNormalize: boolean
): VNode | Array < VNode > {

    // 是否为数组或原始类型值(这里的情况未猜测是前面多传入了一个参数)
    if (Array.isArray(data) || isPrimitive(data)) {
        normalizationType = children
        children = data
        data = undefined;
    }

    // 指定永远进行优化为true时，才有效
    if (isTrue(alwaysNormalize)) {
        normalizationType = ALWAYS_NORMALIZE
    }
    return _createElement(context, tag, data, children, normalizationType)
}

// 全等===
function isTrue(v: any): boolean % checks {
    return v === true;
}

// 是否为原始值
function isPrimitive(value: any): boolean % checks {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'symbol' ||
        typeof value === 'boolean'
    )
}
```

这里可以看出`createElement()`函数并非正真的处理函数，而是包装起来用作对其传入参数的处理，还是可以看出第六个参数除非指定为`true`，不然永远不主动进行标准化。

### _createElement()——创建Vnode节点

该函数正式用于创建`Vnode`节点，当然只创建，不干其他的。

```js
function _createElement(
    context: Component,
    tag ? : string | Class < Component > | Function | Object,
    data ? : VNodeData,
    children ? : any,
    normalizationType ? : number
): VNode | Array < VNode > {

    // 禁止使用使用已被监听的对象作为data
    if (isDef(data) && isDef((data: any).__ob__)) {
        process.env.NODE_ENV !== 'production' && warn(
            `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
            'Always create fresh vnode data objects in each render!',
            context
        )

        // 否则返回空Vnode节点
        return createEmptyVNode()
    }

    // object syntax in v-bind
    if (isDef(data) && isDef(data.is)) {
        tag = data.is
    }

    // 无标签，这种情况就is属性设置了一个假值
    if (!tag) {

        // in case of component :is set to falsy value
        return createEmptyVNode()
    }

    // warn against non-primitive key
    // 确认该原始值的key值，如果不是原始值则警告
    if (process.env.NODE_ENV !== 'production' &&
        isDef(data) && isDef(data.key) && !isPrimitive(data.key)
    ) {
        if (!__WEEX__ || !('@binding' in data.key)) {
            warn(
                'Avoid using non-primitive value as key, ' +
                'use string/number value instead.',
                context
            )
        }
    }

    // support single function children as default scoped slot
    // 允许单个的函数作为唯一的子节点即默认插槽
    if (Array.isArray(children) &&
        typeof children[0] === 'function'
    ) {
        data = data || {}
        data.scopedSlots = {
            default: children[0]
        }
        children.length = 0
    }

    // 根据标准化等级进行标准化
    if (normalizationType === ALWAYS_NORMALIZE) {
        children = normalizeChildren(children)
    } else if (normalizationType === SIMPLE_NORMALIZE) {
        children = simple5NormalizeChildren(children)
    }


    let vnode, ns;
    // 直接提供标签名时，按照提供标签名的情况进行创建Vnode节点
    if (typeof tag === 'string') {
        let Ctor;

        // 获取该节点所处的命名空间
        ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);

        // 如果为原生标签
        if (config.isReservedTag(tag)) {
            // platform built-in elements
            vnode = new VNode(
                config.parsePlatformTagName(tag), data, children,
                undefined, undefined, context
            )

        // 无属性或非静态节点
        } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
            // component
            vnode = createComponent(Ctor, data, context, children, tag)
        } else {
            // unknown or unlisted namespaced elements
            // check at runtime because it may get assigned a namespace when its
            // parent normalizes children
            // 未知或未列出命名空间的元素，待运行时再来检查，因为它们可能会在其父节点标准化时赋值
            vnode = new VNode(
                tag, data, children,
                undefined, undefined, context
            )
        }

    // 未提供标签名时，说明为组件
    } else {

        // direct component options / constructor
        // 直接的组件属性或构造函数// 直接的组件属性或构造函数
        vnode = createComponent(tag, data, context, children)
    }

    // 最后对节点进行处理
    if (Array.isArray(vnode)) {
        return vnode;

    // 对单个节点的属性进行处理
    } else if (isDef(vnode)) {
        if (isDef(ns)) applyNS(vnode, ns);

        // 如果存在动态style或class属性，则要对其进行依赖项收集，便于父组件的重新渲染
        if (isDef(data)) registerDeepBindings(data);
        return vnode

    // 无节点生成则返回空节点
    } else {
        return createEmptyVNode();
    }
}
```

1. 首先对承载数据的`data`对象进行检查，防止其为已被观察的对象(一般情况不会因为我们操作不到这个属性，除非自己写渲染函数)。

2. 接下来是对`tag`属性的确认，确保其存在，无论以何种形式，否则返回一个空的`Vnode`节点。