# 组件VNode的Hook

组件`VNode`的`Hook`函数主要有4个，分别为：

- [init()——生成组件vm实例，创建其DOM片段](#init%e7%94%9f%e6%88%90%e7%bb%84%e4%bb%b6vm%e5%ae%9e%e4%be%8b%e5%88%9b%e5%bb%ba%e5%85%b6dom%e7%89%87%e6%ae%b5)
- prepatch
- insert
- destroy

```js
const componentVNodeHooks = {
    init () {},
    prepatch () {},
    insert () {},
    destroy () {}
}
```

## init()——生成组件vm实例，创建其DOM片段

该方法用于为组件节点生成其对应的`vm`实例，然后创建解析其模版生成`DOM`片段。

```js
function init(vnode: VNodeWithData, hydrating: boolean): ? boolean {
    if (// 是否该组件节点已存在vm实例
        vnode.componentInstance &&

        // 该组件vm实例未注销
        !vnode.componentInstance._isDestroyed &&

        // 该组件为动态组件
        vnode.data.keepAlive
    ) {
        // kept-alive components, treat as a patch
        const mountedNode: any = vnode // work around flow
        componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {

        // 为组件VNode创建其组件实例并挂载在其componentInstance上
        const child = vnode.componentInstance = createComponentInstanceForVnode(
            vnode,

            // 当前处理的vm实例，也即组件实例的父实例
            activeInstance
        );

        // 调用$mount函数创建
        child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
}
```

对于`<keep-alive>`动态组件它不会做这些操作，因为我们从这里可以知道，初始化组件时，并没有`.componentInstance`这个属性，所以此处是再次复用这个组件时它会直接调用[`prepatch()`](#prepatch%e9%a2%84%e5%a4%84%e7%90%86patch%e6%93%8d%e4%bd%9c)函数对组件`VNode`节点进行处理。
____
正常情况下，它会先调用[`createComponentInstanceForVnode()`](./创建组件VNode的实例/创建组件VNode的实例/README.md)函数为组件创建组件的`vm`实例，然后通过该实例手动调用[`$mount()`](../../../../beforeMount/README.md)解析模版生成`DOM`结构。

## prepatch()——预处理patch操作

该函数用于更新子组件

```js
function prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {

    // 新VNode节点的组件配置
    const options = vnode.componentOptions;

    // 新的VNode节点组件实例属性继承旧VNode节点的
    const child = vnode.componentInstance = oldVnode.componentInstance;

    // 更新子组件
    updateChildComponent(
        child,
        options.propsData, // updated props
        options.listeners, // updated listeners
        vnode, // new parent vnode
        options.children // new children
    )
}
```

暂时不看这个函数
