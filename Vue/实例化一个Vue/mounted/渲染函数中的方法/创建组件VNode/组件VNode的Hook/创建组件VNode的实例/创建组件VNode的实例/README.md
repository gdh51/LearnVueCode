# createComponentInstanceForVnode()——为VNode节点创建组件实例

该函数就像根Vue构造函数一样，不同的是其合并`$options`阶段的不同，还有就是它不会主动调用`$mount()`函数来生成`DOM`。

```js
function createComponentInstanceForVnode(
    // 组件VNode节点
    vnode: any, // we know it's MountedComponentVNode but flow doesn't

    // 组件的父组件
    parent: any, // activeInstance in lifecycle state
): Component {

    // 配置组件的option
    const options: InternalComponentOptions = {
        _isComponent: true,

        // 这里可以看出_parentVNode即代表组件标签节点
        _parentVnode: vnode,
        parent
    };

    // check inline-template render functions
    // 是否为内联模版
    const inlineTemplate = vnode.data.inlineTemplate;

    // 如果为内联模版组件，那么提前为其定义渲染函数
    if (isDef(inlineTemplate)) {
        options.render = inlineTemplate.render
        options.staticRenderFns = inlineTemplate.staticRenderFns
    }

    // 调用之前创建的Vue组件构造函数创建组件实例，重复根Vue实例的过程
    return new vnode.componentOptions.Ctor(options);
}
```

这里我们可以看到，之前在合并`$options`时的`.parentVnode`其实就是组件标签节点，而`_isComponent`属性会在初始化组件实例时被标记为`true`。当然这些都是仅存于`options`中的配置。

对于内联模版的组件，则直接为其挂载了渲染函数，不会再建立模版解析编译阶段。

最后调用模版构造函数为其创建一个组件`vm`实例，这个过程和[Vue构造函数](../../../../../.../../../README.MD)一样
