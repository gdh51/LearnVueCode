# 渲染函数的调用

这里主要介绍渲染函数如何调用，因为之前我们在`initRender()`阶段挂载了很多简化名称的函数，现在我们知道了它们要用于渲染函数中，这里我们通过真实的例子来一个个进行解析。先看一下我们编译出的渲染函数中那些简写函数的由来：

```js
function installRenderHelpers(target: any) {
    target._o = markOnce
    target._n = toNumber
    target._s = toString
    target._l = renderList
    target._t = renderSlot
    target._q = looseEqual
    target._i = looseIndexOf
    target._m = renderStatic
    target._f = resolveFilter
    target._k = checkKeyCodes
    target._b = bindObjectProps
    target._v = createTextVNode
    target._e = createEmptyVNode
    target._u = resolveScopedSlots
    target._g = bindObjectListeners
    target._d = bindDynamicKeys
    target._p = prependModifier
}
```

该方法在我们`renderMixin`阶段调用，即我们最初初始化`Vue`原型时，现在我们先给出一个简单的模版看看如何编译：

```html
<div id="app">
    <div class="father">
        <div class="son"></div>
    </div>
</div>
```

该模版生成的渲染函数为：

```js
const compiled = {
    render: "with(this){return _m(0)}",
    staticRenderFns: [
        `with(this){
            return (_c('div',
                        {attrs:{"id":"app"}},
                        [_c('div',{staticClass:"father"},
                            [_c('div',{staticClass:"son"})]
                        )]
                    ))
        }`
    ]
}
```

这里的`this`即指代的该`vue`实例，这里我先说，渲染过程中的入口为`render()`函数，`staticRenderFns`数组只是一个存储的静态函数的地方，调用的`_m(index)`函数。调用该函数的会取出之前已渲染的`Vnode`片段，或创建一个新的，它的`index`参数表示`staticRenderFns`数组中静态渲染函数的下标，那么这时你就明白了，相当于调用`staticRenderFns`中的静态函数，那么话不多说，直接看静态渲染函数。

我们可以看到**节点的生成是自下而上**的，首先最开始调用的是`_c('div',{staticClass:"son"})`，那么对其调用`craeteElement()`方法