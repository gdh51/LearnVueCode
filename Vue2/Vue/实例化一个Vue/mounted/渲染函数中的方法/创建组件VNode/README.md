# createComponent()——创建组件VNode

该方法用于创建组件的`VNode`节点，它存在于`createElement()`方法中，当满足以下条件时调用：

```js

// 具体的非原生标签，无元素属性或不为v-pre节点，
if (typeof tag === 'string' && !config.isReservedTag(tag) && (!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
    // component
    vnode = createComponent(Ctor, data, context, children, tag);
}

if (typeof tag !== 'string') {
    vnode = createComponent(tag, data, context, children);
}
```

其中[`resolveAsset()`](../../其他工具方法/README.md)方法为获取`context.$options.components`中的`tag`的值，这里可以理解为我们挂载在组件中的组件对象。

然后通过`createComponent()`来创建一个组件`VNode`：

```js
function createComponent(

    // 组件的配置实例对象
    Ctor: Class < Component > | Function | Object | void,

    // 外置与组件元素上的属性
    data: ? VNodeData,

    // 当前组件所处于的上下文对象，即父组件
    context : Component,

    // 当前组件中的子节点们
    children: ? Array < VNode > ,

    // 组件名称
    tag ? : string
): VNode | Array < VNode > | void {

    // 不存在组件配置对象时直接返回。
    if (isUndef(Ctor)) {
        return;
    }

    // 取出基础Vue构造函数
    const baseCtor = context.$options._base

    // plain options object: turn it into a constructor
    // 如果是组件配置对象时，将配置与基础配置对象混合，
    // 并生成一个新的构造函数
    if (isObject(Ctor)) {

        // 生成组件的构造函数
        Ctor = baseCtor.extend(Ctor);
    }

    // if at this stage it's not a constructor or an async component factory,
    // reject.
    // 如果在这一步它还不是一个构造或工厂函数，那么报错
    if (typeof Ctor !== 'function') {
        if (process.env.NODE_ENV !== 'production') {
            warn(`Invalid Component definition: ${String(Ctor)}`, context)
        }
        return
    }

    // async component
    let asyncFactory;

    // 是否具有cid(只有通过extend生成的组件构造函数才有)
    if (isUndef(Ctor.cid)) {

        // 处理异步组件
        asyncFactory = Ctor;
        Ctor = resolveAsyncComponent(asyncFactory, baseCtor);
        if (Ctor === undefined) {
            // return a placeholder node for async component, which is rendered
            // as a comment node but preserves all the raw information for the node.
            // the information will be used for async server-rendering and hydration.
            return createAsyncPlaceholder(
                asyncFactory,
                data,
                context,
                children,
                tag
            )
        }
    }

    // 初始化节点的属性
    data = data || {};

    // resolve constructor options in case global mixins are applied after
    // component constructor creation
    // 检查构造函数的父级构造函数前后两个版本的options以防全局的mixins是在组件构造函数后调用
    resolveConstructorOptions(Ctor);

    // transform component v-model data into props & events
    // 将v-model属性转换为对应的属性与事件(包括组件中的model配置)
    if (isDef(data.model)) {
        transformModel(Ctor.options, data);
    }

    // extract props
    // 获取组件的`props/propsData`在该VM实例中的值
    const propsData = extractPropsFromVNodeData(data, Ctor, tag)

    // functional component
    // 处理函数式组件
    if (isTrue(Ctor.options.functional)) {
        return createFunctionalComponent(Ctor, propsData, data, context, children)
    }

    // extract listeners, since these needs to be treated as
    // child component listeners instead of DOM listeners
    // 提取事件监听器，这些事件监听器为自定义事件监听器而非DOM的
    const listeners = data.on;

    // replace with listeners with .native modifier
    // so it gets processed during parent component patch.
    // 将之前的元素的on属性全部替换为dom监听器，这样它可以在父组件打补丁时被处理
    data.on = data.nativeOn;

    // 是否为抽象组件
    if (isTrue(Ctor.options.abstract)) {
        // abstract components do not keep anything
        // other than props & listeners & slot
        // 抽象组件除了props、listeners、slot外不保留任何属性

        // work around flow
        // 清空data，只保留slot
        const slot = data.slot;
        data = {}
        if (slot) {
            data.slot = slot;
        }
    }

    // install component management hooks onto the placeholder node
    // 初始化组件的生命周期的各种钩子函数到data中(用于处理元素属性)
    installComponentHooks(data)

    // return a placeholder vnode
    // 返回一个占位符VNode
    const name = Ctor.options.name || tag
    const vnode = new VNode(
        `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data, undefined, undefined, undefined, context, {
            Ctor,
            propsData,
            listeners,
            tag,
            children
        },
        asyncFactory
    );

    return vnode;
}
```

首先梳理一下创建组件`VNode`的流程：

如果是普通的组件，那么基于根的`Vue`构造函数和当前的组件配置创建一个基于当前所处父级`vm`实例上下文的组件构造函数：

```js
// plain options object: turn it into a constructor
// 如果是组件配置对象时，将配置与基础配置对象混合，
// 并生成一个新的构造函数
if (isObject(Ctor)) {

    // 生成组件的构造函数
    Ctor = baseCtor.extend(Ctor);
}

// if at this stage it's not a constructor or an async component factory,
// reject.
// 如果在这一步它还不是一个构造或工厂函数，那么报错
if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
        warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
}
```

创建是基于[`Vue.extend()`](../../../../实例化一个Vue/组件的构造函数/README.md)函数。每当它创建一个组件构造函数后，都会按父级构造函数的`cid`为标识符**缓存**在该组件对象(即我们定义的那个组件对象)中。

接下来是对异步组件的处理，这里我们占时先留坑，应该没怎么用到，先不进行学习。
____
之后便是提前对组件上的某些属性进行处理：

1. 调用[`resolveConstructorOptions(Ctor)`](../../../beforeCreate/合并Options/README.md#resolveconstructoroptions%e8%b0%83%e6%95%b4%e6%9e%84%e9%80%a0%e5%87%bd%e6%95%b0options)同步祖先构造函数中的`options`，
2. 调用[`transformModel()`](../../其他工具方法/README.md#transformmodel%e5%a4%84%e7%90%86%e7%bb%84%e4%bb%b6%e4%b8%8av-model)处理组件上的`v-model`属性
3. 调用[`extractPropsFromVNodeData()`](../../其他工具方法/README.md#extractpropsfromvnodedata%e6%8f%90%e5%8f%96%e7%bb%84%e4%bb%b6%e7%9a%84prop%e5%80%bc)获取组件中定义的`props/propsData`的值
4. 处理组件上的自定义监听器

之后根据是否为抽象组件(`transition`与`keep-alive`组件)，来决定保留哪些属性(抽象组件基本上要清空所有属性)。

然后调用`installComponentHooks()`为该组件构造函数挂载一些用于处理组件生成元素生命周期的钩子函数：

## installComponentHooks()——初始化组件的钩子函数

这里初始化的并不是生命周期的钩子函数，而是用于更新`DOM`的钩子函数，它只会初始化一次，在初始化时如果已有构造函数，则会将原生的添加至第一个。

```js
function installComponentHooks(data: VNodeData) {

    // 初始化该组件的钩子函数
    const hooks = data.hook || (data.hook = {});

    // 向其添加钩子函数
    for (let i = 0; i < hooksToMerge.length; i++) {
        const key = hooksToMerge[i];

        // 已存在的钩子函数
        const existing = hooks[key];

        // 原始的钩子函数
        const toMerge = componentVNodeHooks[key];

        // 不存在或两个函数不等或未混合时，向hooks中添加该钩子函数
        if (existing !== toMerge && !(existing && existing._merged)) {
            hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
        }
    }
}

// 在已存在时添加时，优先调用原始的钩子函数
function mergeHook(f1: any, f2: any): Function {
    const merged = (a, b) => {
        // flow complains about extra args which is why we use any
        f1(a, b)
        f2(a, b)
    }

    // 打上标记位
    merged._merged = true
    return merged;
}
```

____
最后，根据这些处理好的数据，全部存储在新建的`VNode`节点中，等待进一步的处理，返回该`VNode`节点

## componentVNodeHooks——关于组件VNode节点的钩子函数

因为还没涉及到，所以暂时先留坑。

```js
// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
    init(vnode: VNodeWithData, hydrating: boolean): ? boolean {
        if (
            vnode.componentInstance &&
            !vnode.componentInstance._isDestroyed &&
            vnode.data.keepAlive
        ) {
            // kept-alive components, treat as a patch
            const mountedNode: any = vnode // work around flow
            componentVNodeHooks.prepatch(mountedNode, mountedNode)
        } else {
            const child = vnode.componentInstance = createComponentInstanceForVnode(
                vnode,
                activeInstance
            )
            child.$mount(hydrating ? vnode.elm : undefined, hydrating)
        }
    },

    prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
        const options = vnode.componentOptions
        const child = vnode.componentInstance = oldVnode.componentInstance
        updateChildComponent(
            child,
            options.propsData, // updated props
            options.listeners, // updated listeners
            vnode, // new parent vnode
            options.children // new children
        )
    },

    insert(vnode: MountedComponentVNode) {
        const {
            context,
            componentInstance
        } = vnode
        if (!componentInstance._isMounted) {
            componentInstance._isMounted = true
            callHook(componentInstance, 'mounted')
        }
        if (vnode.data.keepAlive) {
            if (context._isMounted) {
                // vue-router#1212
                // During updates, a kept-alive component's child components may
                // change, so directly walking the tree here may call activated hooks
                // on incorrect children. Instead we push them into a queue which will
                // be processed after the whole patch process ended.
                queueActivatedComponent(componentInstance)
            } else {
                activateChildComponent(componentInstance, true /* direct */ )
            }
        }
    },

    destroy(vnode: MountedComponentVNode) {
        const {
            componentInstance
        } = vnode
        if (!componentInstance._isDestroyed) {
            if (!vnode.data.keepAlive) {
                componentInstance.$destroy()
            } else {
                deactivateChildComponent(componentInstance, true /* direct */ )
            }
        }
    }
}

const hooksToMerge = Object.keys(componentVNodeHooks);
```
