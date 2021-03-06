# 渲染函数的调用的例子

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

该方法在我们`renderMixin`阶段调用，即我们最初初始化`Vue`原型时，现在我们先给出一个简单的模版看看如何编译**(首先说明这里涉及的`VNode`生成仅包含根`vm`实例的模版中的元素)**：

## 例子1——纯dom渲染

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

我们可以看到**节点的生成是自下而上**的，首先最开始调用的是`_c('div',{staticClass:"son"})`，那么对其调用`craeteElement()`方法，由于该节点只有两个属性，那么直接是创建一个`Vnode`节点，因为没有其他属性所以，这里直接返回该节点。返回后的节点作为下一个`_c()`函数的`children`属性进行进行生成节点，因为这三个节点都相似所以同`son`节点一样返回该节点，所以最后的结果为我们的`app`的`VNode`节点。

## 例子2——if条件块和v-for

下面来看一个稍微复杂点的，国际惯例线上结构和模版：

```html
<div id='app'>
    <div v-for="item in table">
        <div class="father" v-if="a">
            <div class="son">OK</div>
        </div>
        <div v-else>None</div>
    </div>
</div>
```

则生成的渲染函数为：

```js
with(this) {
    return _c('div', {
        attrs: {
            "id": "app"
        }
    }, _l((table), function (item) {
        return (
        _c('div', [(a) ? _c('div', {
            staticClass: "father"
        }, [_c('div', {
            staticClass: "son"
        }, [_v("OK")])]) : _c('div', [_v("None")])]));
    }), 0);
}
```

看着可能有些复杂，首先执行的第一个函数为最外层的`_l()`它会遍历给定的可遍历对象的值，然后对每个值调用后面这个**回调函数**——即`v-for`下面子节点的渲染函数。那么现在转来看这个回调函数(我们可以看到这个回调函数的形参即我们最初定义在`v-for`前面的参数)。

这个`a`为我们最初设置的`v-if`的值：

+ 取值如果为真值，这调用`_c('div', {staticClass: "father"}, [_c('div', {staticClass: "son"}, [_v("OK")])])`，还是老规矩，最先生成最底层的元素，所以先调用`_v()`生成文本节点，然后调用`_c('div', {staticClass: "son"}, [_v("OK")])`生成`son`的`VNode`节点，同理最后生成`father`的`VNode`节点；

+ 如果`a`为假值，则调用`_c('div', [_v("None")])]))`返回一个`div`节点

最后`_l()`函数生成的所有`VNode`节点作为`app`节点的子节点，生成`app`的`VNode`节点，然后返回。

## 例子3——存在组件与标准化

```html
<!-- 模版 -->
<div id='app'>
    <child1 :a="a"></child1>
    <div @click="changeA"></div>
</div>

<!-- 子组件 -->
<div>空</div>
```

渲染函数为：

```js
with(this) {
    return _c('div', {
        attrs: {
            "id": "app"
        }
    }, [_c('child1', {
        attrs: {
            "a": a
        }
    }), _v(" "), _c('div', {
        on: {
            "click": changeA
        }
    })], 1);
}
```

首先先执行`_c('child1', {attrs: {"a": a}})`，生成一个组件节点的`VNode`；然后通过`_v(" ")`生成一个文本节点(这里就是换行符)，这时在生成一个`div`的`VNode`节点，那么`app`的子节点数组就生成完毕了，但在我们的`app`生成过程中，存在一个标准化的过程，因为我们使用了组件，但是这里并没有可以标准化的地方，但我们必须要知道什么地方需要[标准化](./../渲染函数中的方法/标准化节点/README.md)。

接下来该对我们的子组件进行生成渲染函数：

```js
with (this) {
    return _c('div',[_v("空")])
}
```

比较简单，返回`div`的`VNode`节点

## 例子4——各种插槽+组件

模版

```html
<!-- 基础模版 -->
<div id='app'>
    <child1></child1>
    <child1>
        <div>插入的内容1</div>
        <div>插入的内容2</div>
    </child1>
</div>

<!-- 组件模版child1 -->
<div>
    <slot>
        <div>默认内容</div>
    </slot>
</div>
```

渲染函数为：

```js
with(this) {
    return _c('div', {
        attrs: {
            "id": "app"
        }
    }, [_c('child1'), _v(" "),
        _c('child1', [_c('div', [_v("插入的内容1")]), _v(" "), _c('div', [_v("插入的内容2")])])
    ], 1);
}
```

这次的稍微看着有些复杂，但是仔细看还是不难，使用的方法依旧是我们上一个例子中见到的那些，

子组件的渲染函数为：

```js
with(this) {
    return _c('div', [_t("default", [_c('div', [_v("默认内容")])])], 2);
}
```

首先从根模版开始，自下而上渲染，首先从根模版的子节点们开始，

```js
[
    _c('child1'),
    _v(" "),// 换行符
    _c('child1', [_c('div', [_v("插入的内容1")]),
    _v(" "),// 换行符
    _c('div', [_v("插入的内容2")])])
]
```

按序调用`createElement()(_c())`函数为它们生成`VNode`节点，首先为一个组件VNode节点，记住**无论什么节点它都只会处理生成当前节点**，不会深入去递归生成其子`VNode`节点。所以这里的结果就是创建一个`child1-VNode`，同理上面的表达式生成一个数组的`VNode`节点。最后通过根节点返回：

```js
// 返回一个根VNode节点
_c('div', {
        attrs: {
            "id": "app"
        },
    }
    [Vnode, Vnode, Vnode, Vnode, Vnode]
)
```

可以看到这里并没有涉及到子组件模版的处理。子模版的处理要待到调用`vm._update()`函数生成元素时，当要针对组件`VNode`生成元素时，就会重新开始实例化一个`vm`实例的步骤，具体过程我们不关心，此时我们来看子模版如何编译：

```js
_c('div', [_t("default", [_c('div', [_v("默认内容")])])], 2);
```

首先依然是生成`slot`元素中的内容的`VNode`节点。此时调用[`_t()`](../渲染函数中的方法/README.md#trenderslot%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%94%9f%e6%88%90vnode%e8%8a%82%e7%82%b9)方法将调用根据父组件中的插槽内容所生成的渲染函数，来生成它们的`VNode`节点，没有内容时，使用写在`<slot>`的内容所生成的`VNode`节点。完成后便返回给父`VNode`节点，整个组件就渲染完成了。
