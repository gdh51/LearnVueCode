# 组件VNode的Hook

组件`VNode`的`Hook`函数主要有4个，分别为：

- [init()——生成组件vm实例，创建其DOM片段](#init%e7%94%9f%e6%88%90%e7%bb%84%e4%bb%b6vm%e5%ae%9e%e4%be%8b%e5%88%9b%e5%bb%ba%e5%85%b6dom%e7%89%87%e6%ae%b5)
- prepatch
- [insert()——调用组件insert钩子函数](#insert%e8%b0%83%e7%94%a8%e7%bb%84%e4%bb%b6insert%e9%92%a9%e5%ad%90%e5%87%bd%e6%95%b0)
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

## insert()——调用组件insert钩子函数

该函数会在整个`DOM`被插入文档后调用，它主要是改变组件实例的`._isMounted`状态，然后调用组件的`mounted`钩子函数。

```js
function insert(vnode: MountedComponentVNode) {

    // 取出组件VNode节点的组件vm实例，与其所在的父级上下文vm实例
    const {
        context,
        componentInstance
    } = vnode;

    // 标记组件为已挂载
    if (!componentInstance._isMounted) {
        componentInstance._isMounted = true;

        // 调用组件mounted生命周期函数
        callHook(componentInstance, 'mounted')
    }

    // 如果为动态组件
    if (vnode.data.keepAlive) {

        // 如果父级上下文已挂载(换句话说就是切换动态组件时)
        if (context._isMounted) {
            // vue-router#1212
            // During updates, a kept-alive component's child components may
            // change, so directly walking the tree here may call activated hooks
            // on incorrect children. Instead we push them into a queue which will
            // be processed after the whole patch process ended.
            // 在update期间，一个动态组件的子组件可能会改变，所以直接遍历其VNode树可能会再次调用
            // 其activated-hook，所以我们将其加入到一个队列中，待patch结束在调用
            queueActivatedComponent(componentInstance);

        // 初始化渲染时，即为激活动态组件，触发其activate钩子函数
        } else {
            activateChildComponent(componentInstance, true /* direct */ )
        }
    }
}
```

对于动态组件，它对于初始化渲染和复用组件时有两种处理方式。初始化渲染时，它会调用`activateChildComponent()`函数来处理动态组件的状态:

### activateChildComponent()——激活动态组件及其子组件

该方法用于直接激活动态组件，然后对其子组件进行激活，这个过程中调用其`vm`实例的`activated`生命周期函数。

```js
function activateChildComponent(vm: Component, direct ? : boolean) {

    // 直接激活子组件时，设置其不活跃状态为false
    if (direct) {
        vm._directInactive = false;

        // 该vm实例是否处于一个不活跃的dom树中，如果是则直接返回
        if (isInInactiveTree(vm)) {
            return
        }

    // 是否为直接不活跃的mv实例，如果是则退出
    } else if (vm._directInactive) {
        return
    }

    // 是否为不活跃状态(从未激活的组件该属性就为null)
    if (vm._inactive || vm._inactive === null) {

        // 关闭不活跃状态
        vm._inactive = false;

        // 激活动态组件的子组件
        for (let i = 0; i < vm.$children.length; i++) {
            activateChildComponent(vm.$children[i]);
        }

        // 调用动态组件的activated周期函数
        callHook(vm, 'activated')
    }
}
```

该函数在入口时进行了一个判断是否为直接激活？如果是就将直接失活设置为false，但还是要通过`isInInactiveTree()`函数检测当前`vm`实例是否在一个失活的`DOM`树中，如果是则不会激活组件。

```js
function isInInactiveTree(vm) {

    // 查找其祖先vm实例，如果有一个vm实例为不活跃的，则为true
    while (vm && (vm = vm.$parent)) {
        if (vm._inactive) return true
    }
    return false
}
```

对于是否处于失活的DOM树中的检测比较简单，就是检查其组件vm实例中是否存在不活跃的vm实例，如果有则直接视为存在于不活跃的DOM树中；除了被`activateChildComponent()`方法直接激活的组件外，还有一些组件被`deactivateChildComponent()`方法失活(这里不学习)，所以这里我们不会对这些组件进行激活。
____
那么对于复用的组件是怎么处理的呢？这里出现的问题是动态组件变化时在更新组件的过程中，其子组件也可能在更新时发生变化，所以如果直接就遍历动态组件及其子组件时，有可能就会调用那些不被使用的子组件的`activate`生命周期的函数，所以此时我们调用`queueActivatedComponent()`将其占时存放在一个队列，待DOM更新完毕后，再来激活这些动态组件：

### queueActivatedComponent()——将动态组件存入更新队列中

该方法很简单，就是将组件存入一个队列中

```js
/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 * 将已激活的动态组件装入队列中，这个队列会在整个VNode树被处理完后进行处理
 */
function queueActivatedComponent(vm: Component) {

    // setting _inactive to false here so that a render function can
    // rely on checking whether it's in an inactive tree (e.g. router-view)
    // 设置_inactive为false使渲染函数可以判断它是否为一个不活跃的VNode Tree
    vm._inactive = false;
    activatedChildren.push(vm)
}
```
