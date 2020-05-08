# 函数式组件

在`Vue`中，我们可以在定义组件时，向其添加`funtional: true`来将组件指定为一个函数式组件。在`Vue`文档的介绍中，函数式组件不会产生组件实例，仅会通过其渲染函数返回`VNode`节点树。

在通过渲染函数创建`VNode`节点的过程中，如果遇到定了`functional`属性的组件，那么会通过`createFunctionalComponent()`函数单独创建`VNode`节点。

```js
// functional component
if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
}
```

当创建组件`VNode`节点时，代码通过检测定义对应组件构造函数的`functional`来确定其是否为一个函数式组件，并通过
`createFunctionalComponent()`函数创建函数组件的`VNode`树，该函数具体如下：

```js
function createFunctionalComponent(

    // 组件的构造函数
    Ctor: Class < Component > ,

    // 组件最终的props值
    propsData: ? Object,

    // 组件节点上的属性
    data : VNodeData,

    // 组件节点所处于的上下文的vm实例
    contextVm: Component,

    // 组件插槽中的节点
    children: ? Array < VNode >
): VNode | Array < VNode > | void {

    // 定义组件时的配置
    const options = Ctor.options;
    const props = {};
    const propOptions = options.props;

    // 用户是否定义props
    if (isDef(propOptions)) {

        // 定义时，效验props的最终值和类型
        // 这里就意味着除了定义的props属性，其余传递的属性要通过data.attrs查找
        for (const key in propOptions) {
            props[key] = validateProp(key, propOptions, propsData || emptyObject)
        }

    // 未定义props属性时，其余传递给组件的属性按attrs处理
    } else {
        if (isDef(data.attrs)) mergeProps(props, data.attrs)
        if (isDef(data.props)) mergeProps(props, data.props)
    }

    // 创建调用渲染函数时的上下文环境(this)
    const renderContext = new FunctionalRenderContext(
        data,
        props,
        children,
        contextVm,
        Ctor
    );

    // 调用函数式组件的构造函数，传入其上下文，直接返回其组件内容的VNode树
    const vnode = options.render.call(null, renderContext._c, renderContext);

    // 复制根VNode节点，并为其标记上下文环境，以下处理主要用于处理旧语法bug(代码我直接删除了)
    if (vnode instanceof VNode) {
        return vnode;
    } else if (Array.isArray(vnode)) {
        return normalizeChildren(vnode) || []
    }
}
```

从上面的函数可以看出函数式组件的创建过程大约有三个步骤：

1. 整理要传递的`props`
2. 创建组件的上下文（非`vm`实例）
3. 生成组件内容包括的`VNode Tree`并返回

下面依次来看具体的代码，首先是对`props`属性的整理：

```js
// 定义组件时的配置
const options = Ctor.options;
const props = {};
const propOptions = options.props;

// 用户是否定义props
if (isDef(propOptions)) {

    // 定义时，效验props的最终值和类型
    // 这里就意味着除了定义的props属性，其余传递的属性要通过data.attrs查找
    for (const key in propOptions) {
        props[key] = validateProp(key, propOptions, propsData || emptyObject)
    }
}
```

首先是第一种情况，当我们定义了`props`时，会对每个定义`props`属性进行一个值的获取和格式、类型效验，这个过程是在`validateProp()`函数进行的，这里不具体说明，那么其他传递给组件的非`props`属性则不会存在于`props`中，需要我们去`data`中自取；

```js
// 未定义props属性时，其余传递给组件的属性按attrs处理
if (!isDef(propOptions)) {
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
}

// 将from中的属性复制至to中
function mergeProps(to, from) {
    for (const key in from) {
        to[camelize(key)] = from[key]
    }
}
```

第二种情况，就是未定义`props`时，那么所有传入给组件的属性都会被存入`props`中。

____
之后就是对函数式子组件上下文的创建，也就是我们在使用函数式组件时，渲染函数的第二个参数：

```js
// 创建调用渲染函数时的上下文环境(this)
const renderContext = new FunctionalRenderContext(
    data,
    props,
    children,
    contextVm,
    Ctor
);

function FunctionalRenderContext(

    // 组件节点的上的属性
    data: VNodeData,

    // 最终要传递给组件内部的props属性
    props: Object,

    // 组件中的插槽内容
    children: ? Array < VNode > ,

    // 父级vm实例
    parent : Component,

    // 函数组件的构造函数
    Ctor: Class < Component >
) {

    // 获取原组件配置
    const options = Ctor.options;

    // ensure the createElement function in functional components
    // gets a unique context - this is necessary for correct named slot check
    // 确保createElement函数能在函数式组件中获取一个唯一的上下文（确保插槽正确）
    let contextVm;

    // 确保父级上下文为vm实例
    if (hasOwn(parent, '_uid')) {
        contextVm = Object.create(parent);
        // $flow-disable-line
        contextVm._original = parent;
    } else {
        // the context vm passed in is a functional context as well.
        // in this case we want to make sure we are able to get a hold to the
        // real context instance.
        // 此时所处于的上下文也是函数式组件，我们要确保它在一个真实的vm实例中
        contextVm = parent;
        // $flow-disable-line
        parent = parent._original;
    }

    // 是否为template编译的render函数
    const isCompiled = isTrue(options._compiled);
    const needNormalization = !isCompiled;

    this.data = data;
    this.props = props;
    this.children = children;
    this.parent = parent;
    this.listeners = data.on || emptyObject;
    this.injections = resolveInject(options.inject, parent);
    this.slots = () => {

        // 初始化普通插槽
        if (!this.$slots) {

            // 处理简单插槽和作用域插槽
            normalizeScopedSlots(
                data.scopedSlots,
                this.$slots = resolveSlots(children, parent)
            )
        }
        return this.$slots;
    }

    Object.defineProperty(this, 'scopedSlots', ({
        enumerable: true,
        get() {

            // 返回最终处理完普通插槽和作用域插槽的结果
            return normalizeScopedSlots(data.scopedSlots, this.slots())
        }
    }: any))

    // support for compiled functional template
    // 支持template版本的函数式函数
    if (isCompiled) {
        // exposing $options for renderStatic()
        this.$options = options
        // pre-resolve slots for renderSlot()
        this.$slots = this.slots()
        this.$scopedSlots = normalizeScopedSlots(data.scopedSlots, this.$slots)
    }

    // 定义渲染函数，如果设置了css作用域则定义其作用域
    if (options._scopeId) {
        this._c = (a, b, c, d) => {
            const vnode = createElement(contextVm, a, b, c, d, needNormalization)
            if (vnode && !Array.isArray(vnode)) {
                vnode.fnScopeId = options._scopeId
                vnode.fnContext = parent
            }
            return vnode
        }
    } else {
        this._c = (a, b, c, d) => createElement(contextVm, a, b, c, d, needNormalization)
    }
}
```

从上面创建函数式上下文的函数可以看出，其除了不创建响应式属性之外，其他地方与创建`vm`实例的模式实际上是差不多的。上面的参数也是`Vue`教程中展示过的，这里就不进行叙述了。

____
由于函数式组件不创建`Vue`实例，所以其处理组件内容的`VNode`节点会在此时就进行：

```js
// 调用函数式组件的构造函数，传入其上下文，直接返回其组件内容的VNode树
const vnode = options.render.call(null, renderContext._c, renderContext);

// 复制根VNode节点，并为其标记上下文环境，以下处理主要用于处理旧语法bug(代码我直接删除了)
if (vnode instanceof VNode) {
    return vnode;
} else if (Array.isArray(vnode)) {
    return normalizeChildren(vnode) || [];
}
```

正常来说，一个组件其内部渲染函数的`VNode`生成要具体到其创建`vm`实例之后，而函数式组件则在遇到组件节点时直接完成了。

综上所述，函数式组件的特点就是这些，由于没有具体的`vm`实例，所以没有动态更新的开销，那么函数式子组件的更新会随着父组件的更新而**被动**更新。此时如果我们在函数式组件的渲染函数中通过`context.parent`访问到父级实例上或其他`vm`实例的响应式属性，那么此时会进行响应式收集，具体响应式属性的依赖项会被收集到父级实例中，因为此时处于父级组件渲染函数的渲染函数计算中。

TODO

- `Router-view` 组件为什么使用父级的`createElement`函数进行`Vnode`的生成
