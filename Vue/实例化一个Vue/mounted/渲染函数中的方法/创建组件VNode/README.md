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

然后通过`createComponent()`来创建一个组件`VNode`