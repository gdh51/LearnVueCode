# 插槽在Vue整个生命周期的处理过程

这里我会讲述一个插槽在整个`Vue`实例生命周期是怎么生成和处理，但这只是代码层面上的，且读者必须要有对`Vue`的生命周期有一点了解。好的，我们现在开始，一个插槽的生命周期分为两个大部分：

- 初始化渲染
- 组件更新

这里我只会涉及`2.6`及其以上的语法，因为旧语法在`3.0`马上会被移除。

## 初始化渲染

在初始化过程中一个插槽的处理会流经两个地方：

- `AST`对象解析生成
- 渲染函数的生成

在渲染函数生成`VNode`节点时，就已经不存在关于插槽的`VNode`节点了，所以初始化时，涉及插槽的地方仅限上述两个部分，现在我们按实例的生命周期来看整个过程。

### ast对象解析生成时

首先是根据我们定义的`DOM`模版生成对应的`AST`对象(抽象语法树)阶段，此时我们要知道，**只有标签在闭合时，才开始处理其中插槽属性**([查看此处的代码](../../beforeMount/compile编译/baseCompile/parse解析/parseHTML/处理头标签/README.md#closeelementelement%e9%97%ad%e5%90%88%e5%85%83%e7%b4%a0))，所以其子节点的插槽属性是**优先**于父组件处理的。

>处理插槽的方法一共两个：[`processSlotOutlet()`](../../beforeMount/compile编译/baseCompile/parse解析/一群工具方法/处理属性/README.md#processslotoutlet%e5%a4%84%e7%90%86%e6%8f%92%e6%a7%bd%e4%bd%8d)与[`processSlotContent()`](../../beforeMount/compile编译/baseCompile/parse解析/一群工具方法/处理属性/README.md#processslotcontent%e5%a4%84%e7%90%86%e4%bd%9c%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e6%8f%92%e5%85%a5%e7%9a%84%e5%85%83%e7%b4%a0)，前者用于处理`<slot>`元素，后者用于处理我们组件标签中的内容。*(这里不对这两个函数具体解析，但会给出传送门，具体内容麻烦点进去自己看)*

按照模版的解析顺序，那么首先是对父级组件的模版进行解析，那么对于父组件标签里面插入内容而言，此时对组件插入的内容的处理的结果就有两种：

- 第一种：将解析出来的插槽内容所代表的`AST`对象，直接挂载到组件的`AST`对象的子数组中，此时的情况如下：

```js
// 没有任何v-slot语法
<component>
    <template>
        <div></div>
    <template>
</component>
```

第一种情况出现的情况只有一种，即**不使用任何插槽语法**。(`v-slot`)，这种情况下虽然调用了[`processSlotContent()`](../../beforeMount/compile编译/baseCompile/parse解析/一群工具方法/处理属性/README.md#processslotcontent%e5%a4%84%e7%90%86%e4%bd%9c%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e6%8f%92%e5%85%a5%e7%9a%84%e5%85%83%e7%b4%a0)方法，但其实没有做任何处理。所以对于这种情况生成的`AST`结果为：

```js
// 最终的AST结构
AST = [
    {
        name: 'component',
        children: [
            {
                name: 'template',
                children: [
                    { name: 'div' ....}
                ]
            }
        ]
    }
];
```

这个语法下的模版，之后就不会在继续处理(它的`AST`结构)了，我们标记这种情况为**简写语法**

- 第二种：使用`v-slot`语法

这种情况下的处理结果又有两种情况，但两种情况的处理结果其实就是在向一种结果靠拢，这两种情况就是以`v-slot`定义的位置区别：

1. `v-slot`定义在`template`标签上，这种情况下，会在`template`元素的`ast`对象上定义三个属性：

即

```html
<component>
    <template v-slot="nameA">
        <div></div>
    <template>
</component>
```

```js
template.slotTarget = name; // 插槽名称
template.slotTargetDynamic = dynamic; // 插槽名称是否为动态语法
template.slotScope = slotBinding.value || emptySlotScopeToken; // 插槽作用域，即v-slot后面那个取值

// 最终的AST结构
AST = [
    {
        name: 'component',
        children: [
            {
                name: 'template',
                slotTarget: 'slotName', // 插槽的名称
                slotTargetDynamic: false, // 插槽是否使用动态的名称
                slotScope: 'bindValue' // 插槽绑定的值
                children: [
                    { name: 'div' ....}
                ]
            }
        ]
    }
];
```

2. `v-slot`直接 定义在组件上。此时，它会生成一个`tempalte`元素的`AST`对象来做中间层，然后同样的将上面的那些属性增加以到这个`template`的`ast`对象上，而组件的`ast`上会增加一个`scopedSlots`属性来存放这个`template`的AST对象：

即

```html
<component v-slot="nameA">
    <template>
        <div></div>
    <template>
</component>
```

即现在 `组件标签——新增的template标签——原组件的子节点` 三种的关系变为如下：

```js
template.slotTarget = name; // 插槽名称
template.slotTargetDynamic = dynamic; // 插槽名称是否为动态语法
template.slotScope = slotBinding.value || emptySlotScopeToken; // 插槽作用域，即v-slot后面那个取值

// 在组件的ast对象的scopedSlots对象中，按该插槽名称，将生成的模版元素ast对象挂载在其上
component.scopedSlots[name] = template;

// 最终的AST结构
AST = [
    {
        name: 'component',
        scopedSlots: {
            slotName: {
                name: 'template',
                slotTarget: 'slotName', // 插槽的名称
                slotTargetDynamic: false, // 插槽是否使用动态的名称
                slotScope: 'bindValue' // 插槽绑定的值
                children: [
                    { name: 'div' ....}
                ]
            }
        },

        children: [/** 此时子数组为空 */]
    }
];
```

增加了新的`template` `ast`对象后，我们还需要将原组件中的子节点转义到`template`的子元素中，这个转移过程中，我们要过滤掉其他用法的`v-slot`的情况：

```js
slotContainer.children = component.children.filter(function (c) {

    // 去掉那些使用了v-slot的template
    if (!c.slotScope) {
        c.parent = slotContainer;
        return true
    }
});

// 直接清空组件的子节点ast对象数组
component.children = [];
```

在这个过滤过程中，其实是防止这种嵌套`v-slot`的用法，这种写法是错误的，但`Vue`内部帮用户规避掉了：

```html
<!-- 此时只会保留com组件上的v-slot，之后其他定义v-slot的模版及其子元素都将直接舍弃 -->
<com v-slot="a">
    <template v-slot="b">

    </template>
</com>
```

所以一旦使用了在组件上定义`v-slot`的语法，那么组件中的其他地方的`v-slot`语法都将无效，它会使从定义`v-slot`起的**整棵节点树舍弃**。
____
很明显1种语法中，`Vue`还没有做转移子节点这个操作。为什么不当时就做这个操作呢？这主要是因为下面这段代码的最后两句，因为如果我们当时就执行这个操作那么我们要在`processSlotContent()`方法中，重复判断一次这个`template`元素是否具有`if`语句块，并且**任何元素**，都会有确认父元素和加入父元素子数组这个操作，总结下就是，**会产生多余的代码**。所以，闭合标签时，我们判断下当前闭合的标签`ast`对象是否有`.slotScope`这个属性，如果有那么我们只需将该元素存入到组件`ast`对象的`scopedSlots[slotName]`中：

```js
if (element.elseif || element.else) {
    //...............................
} else {
    // 处理template元素上的v-slot作用域
    if (element.slotScope) {
        // scoped slot
        // keep it in the children list so that v-else(-if) conditions can
        // find it as the prev node.
        var name = element.slotTarget || '"default"';

        // 将该template元素挂载到组件的scopedSlots[name]中
        (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element;
    }

    // 就是因为下面这两句的关系
    currentParent.children.push(element);
    element.parent = currentParent;
}
```

到此为止，父组件对组件插槽内容`AST`对象的处理就结束了，接下来是由此`AST`生成渲染函数的处理。

### render()渲染函数的生成

生成渲染函数，对插槽的处理主要是基于`.scopedSlots`属性，为如下语句：

```js
// slot target
// only for non-scoped slots
if (el.slotTarget && !el.slotScope) {
    data += "slot:" + (el.slotTarget) + ",";
}

// scoped slots
if (el.scopedSlots) {
    data += (genScopedSlots(el, el.scopedSlots, state)) + ",";
}
```

这里我们只关注`2.6`的语法，由于第一个`if`语句，不会在`2.6`语法任何地方出现，所以这里我们只关心第二个`if`语句处理。此时调用[`genScopedSlots(el, el.scopedSlots, state)`](../../beforeMount/compile编译/baseCompile/generate生成/处理属性生成函数/生成插槽函数/README.md)方法。此处仍是自行查看，它会将传入的作用域插槽(即刚才组件上的`.scopedSlots`属性对象)先处理为以下形式：

```js
const result = [{
    key: 'default',
    fn: renderFunction/** 插槽内容的渲染函数 */
},
{
    key: 'slot1',
    fn: renderFunction/** 插槽内容的渲染函数 */
}];
```

在由其他条件生成一个`scopedSlots`字段挂载在组件`VNode`节点的`.data`属性中，它由一个`_u()`函数包裹：

```js
Component.VNode.data = {
    scopedSlots: _u([ {key:"default",fn: render()} ])
}
```

待`render()`渲染函数调用时，首先会调用[`resolveScopedSlots()`](../../mounted/渲染函数中的方法/README.md#uresolvescopedslots%e5%88%9d%e6%ad%a5%e5%a4%84%e7%90%86%e5%85%b7%e5%90%8d%e6%8f%92%e6%a7%bd)函数来处理`.scopedSlots`中的具名插槽对象，以上的属性就会被处理为这样一个字段：

```js
Component.VNode.data = {
    scopedSlots: {
        $stable: true,
        default: renderFunction
    }
};
```

其中`$stable`表示是否**不需要强制更新插槽中的子组件**，其他字段表示`具名插槽名称：插槽内容的渲染函数`。

但此时还不会对这些属性进行处理，它会存放在组件`VNode`节点的`.data.scopedSlots`属性中，因为我们知道，一个具有作用域的插槽，获取的值是**子组件中**的值，即这些渲染函数要在子组件的`vm`实例中去调用该渲染函数。

所以我们接着查看子组件`vm`实例的生命周期，首先调用`initRender()`方法，由于是`2.6`的语法所以两个值也不会有任何处理：

```js
// 下面两个值实际都为一个空对象
vm.$slots = resolveSlots(options._renderChildren, renderContext);
vm.$scopedSlots = emptyObject;
```

此时我们的组件中肯定会存在一个`<slot>`插槽元素由来承载插槽内容，但是在`AST`对象解析时，它还是被当作普通的元素处理——生成一个`<slot>` `ast`对象，不过对其上的`name`字段会存储为`slotName`。接下来便是生成渲染函数的过程，`<slot>`元素将会被解析为`_t()`函数，它的第一个参数为插槽名称，第二个为其中的子节点数组，第三个为元素上的属性，第四为该插槽绑定的值。

```js
// 举例   后两个参数为slot元素上的属性和v-bind准备提供给插槽内容的属性
_t("default",[_c('div',[_v("默认内容")])], NodeAttribute, bindObject)
```

而我们的`_t`函数即[`renderSlot()`](../../mounted/渲染函数中的方法/README.md#trenderslot%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%94%9f%e6%88%90vnode%e8%8a%82%e7%82%b9)，但在调用该函数前，还需要在`_render()`函数中调用`normalizeScopedSlots()`函数标准化一次`vm`实例上的各种插槽属性：

```js
// 这里的_parentVnode为我们使用的组件标签所代表的VNode
if (_parentVnode) {
    vm.$scopedSlots = normalizeScopedSlots(

        // 组件VNode标签中使用的作用域插槽对象
        _parentVnode.data.scopedSlots,

        // 当前实例中的插槽对象
        vm.$slots,

        // 当前实例中的作用域插槽
        vm.$scopedSlots
    );
}
```

通过`normalizeScopedSlots()`函数，会包装所有具名插槽内容渲染函数，然后处理之前的反向代理(即没有指定作用域的`v-slot`)的情况，具体结果这里直接给出：

```js
let res = {
    $stable: true,// 是否需要强制更新,
    $key: 12301231,// 插槽内容的hash值
    $hasNormal: false, // 是否已经标准化
    default: wrapperRenderFunction,
    slotA: wrapperRenderFunction,

    // 假设这个插槽作用域为反向代理型
    proxySlotA: wrapperRenderFunction
}
_parentVnode.data.scopedSlots._normalize = res;
vm.$slots = {
    proxySlotA: wrapperRenderFunction
};
vm.$scopedSlots = res;
```

从上面的结果可以看出`vm.$scopedSlots`中会包含所有标准化处理后的插槽作用域，这样一来，插槽内容中的渲染函数就转移到组件中了，待会我们就可以借用它们来渲染组件的插槽中的内容了。

接下来就是正式调用渲染函数时，调用`_t()`函数([`renderSlot()`](../../mounted/渲染函数中的方法/README.md#trenderslot%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%94%9f%e6%88%90vnode%e8%8a%82%e7%82%b9))处理我们实际用到的插槽，该函数就会优先从`vm.$scopedSlots`中取出渲染函数来生成插槽内容的`VNode`节点，若没有则从`vm.$slots`中取，若没有插槽内容则用`slot`元素中默认内容代替，最后返回组件插槽内容生成的子节点。

到此为止，一个插槽的相关处理就结束了。

### 简写语法的处理

上面讲述的都是`v-slot`语法的处理情况，但我们在上面也提到了这种情况：

```html
// 没有任何v-slot语法
<component>
    <template>
        <div></div>
    <template>
</component>
```

之前我们只提到了在生成`AST`阶段的处理，现在我们来看下之后对它的处理。

由于它没有任何插槽属性，所以在`AST`生成`Render()`函数的阶段，它也不会进行任何关于插槽属性的处理，然后开始根据`Render()`函数生成`VNode`节点及其元素时，此时解析到组件标签，要为组件生成一个`VNode`节点时，此时重点来了，它会在组件`VNode`的`.componentOptions`属性上将其子节点数组挂载上去：

```js
new VNode(
    ("vue-component-" + (Ctor.cid) + (name ? ("-" + name) : '')),
    data, undefined, undefined, undefined, context, {
    Ctor: Ctor,
    propsData: propsData,
    listeners: listeners,
    tag: tag,

    // 注意下面这行
    children: children
});
```

上述代码中，我进行了注释的那行即表示之前我们模版中组件的子元素数组们。之后在初始组件实例时，会调用`initInternalComponent`将这些子节点转移到组件实例的`.$options._renderChildren`中。紧接着就会对组件实例调用各种`init()`类函数，其中在调用`initRender()`时，会在其中调用`resolveSlots()`函数，顺利将这些子节点又复制到组件实例的`.$slots.default`中。到此为止情况就和我们之前处理`v-slot`语法时的情况一样了，这里也就不再多描述了。
