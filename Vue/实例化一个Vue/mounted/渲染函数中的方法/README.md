# 渲染函数中的方法

这里是介绍渲染函数中方法的目录：

- [_c()——createElement()创建元素](#createelement%e5%88%9b%e5%bb%bavnode%e8%8a%82%e7%82%b9)
- [_m()——renderStatic()渲染静态节点](#mrenderstatic%e6%b8%b2%e6%9f%93%e9%9d%99%e6%80%81%e8%8a%82%e7%82%b9)
- [_l()——renderList()渲染v-for列表](#lrenderlist%e6%b8%b2%e6%9f%93v-for%e5%88%97%e8%a1%a8)
- [_v()——createTextVNode()创建纯文本节点](#vcreatetextvnode%e5%88%9b%e5%bb%ba%e7%ba%af%e6%96%87%e6%9c%ac%e8%8a%82%e7%82%b9)
- [_u()——resolveScopedSlots()初步处理具名插槽](#uresolvescopedslots%e5%88%9d%e6%ad%a5%e5%a4%84%e7%90%86%e5%85%b7%e5%90%8d%e6%8f%92%e6%a7%bd)
- [_t()——renderSlot()为插槽内容生成VNode节点](#trenderslot%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%94%9f%e6%88%90vnode%e8%8a%82%e7%82%b9)

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
    // 确认v-bind:is绑定的标签，优先取它
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
            default: children[0];
        }
        children.length = 0
    }

    // 根据标准化等级进行标准化，这里标准化的原因是因为，
    // 有些内置组件可能包含多个根节点
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
        // 这里ctx.$vnode表示vm实例的组件VNode
        ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);

        // 如果为原生标签
        if (config.isReservedTag(tag)) {
            // platform built-in elements
            vnode = new VNode(
                config.parsePlatformTagName(tag), data, children,
                undefined, undefined, context
            )

        // 无属性或非静态节点的组件
        } else if ((!data || !data.pre) &&
        /* 这里在获取用户定义的组件是否存在 */isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
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

3. 根据标准化等级，针对子节点进行标准化。

4. 事到至此就该对该元素的标签进行确认了，如果我们指定的是动态的变量在这里也会开始求值了。(这里的动态标签名的情况即指`:is`语法)
   1. 如果标签名为字符串，那么就是一个确切的标签，那么不是原生标签就是组件标签
   2. 如果标签名是对象，那么就是一个组件

5. 最后返回这个`Vnode`节点。

[源码文件](../../../vueSourceCode/src/core/vdom/create-element.js)

下面是具体如何生成组件：

### createComponent()——创建组件VNode

该方法用于创建组件的`VNode`节点，具体处理三种组件：

- 异步组件
- 普通组件
- 函数式组件

[详情](./创建组件VNode/README.md)
____
最后如果还留有元素属性时，要对其中的`:style/:class`属性进行依赖项的收集，防止其变更时无法更新。

## _l()——renderList()渲染v-for列表

该函数用于渲染`v-for`队列，它会遍历我们传入的可迭代的值(即使是对象也没关系)，然后按其可迭代的个数来生成`VNode`节点，返回这些节点的数组。

```js
function renderList(

    // v-for指定的可迭代变量
    val: any,

    // v-for循环中的子节点渲染函数
    render: (
        val: any,
        keyOrIndex: string | number,
        index ? : number
    ) => VNode
): ? Array < VNode > {
    let ret: ? Array < VNode > , i, l, keys, key;

    // 传入数组或字符串时
    if (Array.isArray(val) || typeof val === 'string') {
        ret = new Array(val.length);

        // 遍历全部元素，并传入每个元素至渲染函数
        for (i = 0, l = val.length; i < l; i++) {
            ret[i] = render(val[i], i);
        }

    // 传入数字时, 从1开始为值进行传递
    } else if (typeof val === 'number') {
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            ret[i] = render(i + 1, i)
        }

    // 传入对象时，只要保证其能遍历
    } else if (isObject(val)) {

        // 是否支持迭代器
        if (hasSymbol && val[Symbol.iterator]) {
            ret = [];
            const iterator: Iterator < any > = val[Symbol.iterator]()
            let result = iterator.next();

            // 将迭代其返回值传入
            while (!result.done) {
                ret.push(render(result.value, ret.length))
                result = iterator.next()
            }

        // 不支持迭代器时(即为普通对象)，按键值顺序传入
        } else {
            keys = Object.keys(val)
            ret = new Array(keys.length)
            for (i = 0, l = keys.length; i < l; i++) {
                key = keys[i]
                ret[i] = render(val[key], key, i)
            }
        }
    }

    // 传入val为其他值时，无效，返回空数组
    if (!isDef(ret)) {
        ret = []
    }

    // 挂载v-list标记位
    (ret: any)._isVList = true;
    return ret;
}
```

我们可以看到，对于数组和含有迭代器的对象或字符串，它们会遍历它们，然后按它们每个元素为单位来生成`Vnode`节点；而对于数字，它按`1~num`给定数字的方式来生成；对于不可迭代的对象，它按键值对个数来生成`Vnode`节点。

**无论如何，在调用渲染函数时，都会传入所有的相关参数**，具体能使用哪些参数，根据用户定义情况。

## _v()——createTextVNode()创建纯文本节点

注意创建出的文本节点`data`属性为`undefined`;

该函数就是直接创建个文本`VNode`节点，非常简单，无其他操作[详情](../VNode构造函数/README.md#%e5%85%b6%e4%bb%96%e8%8a%82%e7%82%b9%e7%9a%84%e5%88%9b%e5%bb%ba)

## _u()——resolveScopedSlots()初步处理具名插槽

该函数用于初步处理具名插槽对象，为其定义是否需要强制更新的属性`$stable`与一些反向代理属性。

```js
function resolveScopedSlots(

    // 具名插槽对象数组
    fns: ScopedSlotsData, // see flow/vnode

    // 处理结果
    res ? : Object,

    // the following are added in 2.6
    // 是否具有动态的插槽名称，即是否需要强制更新
    hasDynamicKeys ? : boolean,

    // 是否由插槽内容生成hash key值
    contentHashKey ? : number
): {
    [key: string]: Function,
    $stable: boolean
} {

    // 取之前结果对象，或初始化
    res = res || {

        // 定义是否稳定，即是否需要强制更新
        $stable: !hasDynamicKeys
    };

    // 遍历具名插槽对象
    for (let i = 0; i < fns.length; i++) {

        // 取某个具名插槽对象
        const slot = fns[i];

        // 如果一个具名插槽的内容中仍有多个具名插槽则递归处理。
        if (Array.isArray(slot)) {
            resolveScopedSlots(slot, res, hasDynamicKeys)

        // 单个插槽则直接处理
        } else if (slot) {

            // marker for reverse proxying v-slot without scope on this.$slots
            // 给没有定义作用域的反向代理插槽提供标记
            if (slot.proxy) {
                slot.fn.proxy = true
            }

            // 将对应 插槽名：渲染函数 添加至最终结果
            res[slot.key] = slot.fn
        }
    }

    // 是否具有内容hash值
    if (contentHashKey) {
        (res: any).$key = contentHashKey
    }

    return res;
}
```

## _t()——renderSlot()为插槽内容生成VNode节点

该函数用于为指定的具名插槽中的内容生成其`VNode`节点数组，并在没有内容时，使用定义在组件中的默认内容。

```js
function renderSlot(

    // 插槽名称
    name: string,

    // 插槽元素中的默认子节点数组
    fallback: ? Array < VNode > ,

    // 插槽上的其他属性
    props : ? Object,

    // 插槽绑定的组件vm实例中的值
    bindObject : ? Object
): ? Array < VNode > {

    // 获取对应名称的插槽渲染函数
    const scopedSlotFn = this.$scopedSlots[name];
    let nodes;

    // 如果有该名称插槽
    if (scopedSlotFn) { // scoped slot

        // 初始化或直接使用插槽的属性对象
        props = props || {};

        // 这里我们绑定的值要为一个接口对象，而非单个值
        if (bindObject) {
            if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
                warn(
                    'slot v-bind without argument expects an Object',
                    this
                )
            }

            // 将作用域值直接合并到插槽元素的属性对象上
            props = extend(extend({}, bindObject), props)
        }

        // 获取插槽内容的VNode节点，并传入定义的值，若都没有则默认内容
        nodes = scopedSlotFn(props) || fallback

    // 在标准化插槽对象中不存在该对象时，在反向代理的$slots中查找，若都没有则默认内容
    } else {
        nodes = this.$slots[name] || fallback
    }

    // 为插槽元素创建一个template元素代替(2.5 slot语法)
    const target = props && props.slot
    if (target) {

        // 调用总是优化的API创建一个template VNode
        return this.$createElement('template', {
            slot: target
        }, nodes)
    } else {

        // 2.6情况直接返回nodes
        return nodes;
    }
}
```

从上面的函数我们就可以知道我们为插槽绑定的值必须要为一个对象(接口，这是规范)
