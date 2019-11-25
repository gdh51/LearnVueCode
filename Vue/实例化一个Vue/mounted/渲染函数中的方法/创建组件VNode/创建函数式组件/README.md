# createFunctionalComponent()——创建函数式组件

想一想[函数式组件](https://cn.vuejs.org/v2/guide/render-function.html#%E5%87%BD%E6%95%B0%E5%BC%8F%E7%BB%84%E4%BB%B6)是什么：没有响应式数据、上下文的组件。

我们只需要标记组件配置`functional`为`true`即可。

```js
// functional component
// 处理函数式组件
if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
}
```
