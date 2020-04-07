# 插槽在Vue整个生命周期的处理过程

这里我们将会学习一个插槽(包括作用域插槽)在整个`Vue`实例生命周期是怎么生成和处理。按我们的常识，我们知道插槽在子组件中定义，而在父组件中使用，那么具体其为什么可以访问到子组件中的变量(作用域插槽)，我们来一探究竟。

>※阅读该文的前提读者必须要有对`Vue`的生命周期有一点了解。

我们从两个部分来看一个插槽运作的生命周期：

- [模版转化为渲染函数(未直接使用渲染函数)](#%e6%a8%a1%e7%89%88%e8%bd%ac%e5%8c%96%e4%b8%ba%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0%e6%9c%aa%e7%9b%b4%e6%8e%a5%e4%bd%bf%e7%94%a8%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0)
- 组件更新(未写)

最后还有一些问题，和手动编写渲染函数时，如何使用插槽

- [一些问题的探讨](#%e4%b8%80%e4%ba%9b%e9%97%ae%e9%a2%98%e7%9a%84%e6%8e%a2%e8%ae%a8)
- [手动编写渲染函数时，如何书写插槽](#%e6%89%8b%e5%8a%a8%e7%bc%96%e5%86%99%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0%e6%97%b6%e5%a6%82%e4%bd%95%e4%b9%a6%e5%86%99%e6%8f%92%e6%a7%bd)

>这里我只会涉及`2.6`及其以上的语法，因为旧语法在`3.0`马上会被移除。

## 模版转化为渲染函数(未直接使用渲染函数)

在解析模版的过程中一个插槽的处理会经历三个地方：

- [`ast`对象解析生成(如果使用模版编译)](#ast%e5%af%b9%e8%b1%a1%e8%a7%a3%e6%9e%90%e7%94%9f%e6%88%90)
- [渲染函数的生成(根据`ast`对象生成渲染函数)](#%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0%e7%9a%84%e7%94%9f%e6%88%90%e6%a0%b9%e6%8d%aeast%e5%af%b9%e8%b1%a1%e7%94%9f%e6%88%90%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0)
- [渲染函数的调用](#%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0%e7%9a%84%e8%b0%83%e7%94%a8)

现在我们分别从这三个地方入手，来查看这一具体的过程

### `ast`对象解析生成

首先`Vue`根据我们定义的`DOM`模版来生成对应的`ast`对象(抽象语法树)。此时我们要知道，**只有标签在闭合时，才开始处理其中插槽属性(即模版解析到反标签处，才会开始对标签上的属性进行处理)**(知道有这么回事就行)，所以其子节点中的属性是**优先**于父组件处理的。

>模版解析中处理插槽的方法一共两个：[`processSlotOutlet()`](../../beforeMount/compile编译/baseCompile/parse解析/一群工具方法/处理属性/README.md#processslotoutlet%e5%a4%84%e7%90%86%e6%8f%92%e6%a7%bd%e4%bd%8d)与[`processSlotContent()`](../../beforeMount/compile编译/baseCompile/parse解析/一群工具方法/处理属性/README.md#processslotcontent%e5%a4%84%e7%90%86%e4%bd%9c%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e6%8f%92%e5%85%a5%e7%9a%84%e5%85%83%e7%b4%a0)，前者用于处理`<slot>`元素，后者用于处理我们组件标签中具有`v-slot`的插槽内容(不处理简写语法)。*(这里不对这两个函数具体解析，具体内容可以点击函数名称查看，里面有详细的解释)*

- [组件插槽内容的解析](#%e7%bb%84%e4%bb%b6%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%9a%84%e8%a7%a3%e6%9e%90)
- [组件定义的插槽元素的解析](#%e7%bb%84%e4%bb%b6%e5%ae%9a%e4%b9%89%e7%9a%84%e6%8f%92%e6%a7%bd%e5%85%83%e7%b4%a0%e7%9a%84%e8%a7%a3%e6%9e%90)

#### 组件插槽内容的解析

按照模版的解析顺序，那么首先是对**父级组件的模版**进行解析，那么对于父组件标签里面插入内容而言，此时对组件插入的内容的处理的结果就有两种：

- 第一种，**不使用`v-slot`语法**：将解析出来的插槽内容所代表的`ast`对象，直接挂载到组件的`ast`对象的子数组中，此时的情况如下：

```js
// 没有任何v-slot语法
<component>
    <template>
        <div></div>
    <template>
</component>
```

第一种情况出现的情况只有一种，即**不使用任何插槽语法**。(`v-slot`)，这种情况下虽然调用了`processSlotContent()`方法，但其实没有做任何处理。所以对于这种情况生成的`ast`结果为：

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

这个语法下的模版，之后就不会在继续处理(它的`ast`结构)了，我们标记这种情况为**简写语法**

- 第二种：使用`v-slot`语法：这种情况下的处理结果又有两种情况，但两种情况的处理结果其实就是在是其中的一种，`Vue`在内部会为你处理你省略语法部分。这两种情况就是**以`v-slot`定义的位置**来进行区别：

1. **`v-slot`定义在`template`标签上**，这种情况下，会在`template`元素的`ast`对象上定义三个属性：

即

```html
<component>
    <template v-slot="nameA">
        <div></div>
    <template>
</component>
```

三个属性具体含义及其最终的`ast`对象结构，见注释：

```js
template.slotTarget = name; // 插槽名称
template.slotTargetDynamic = dynamic; // 插槽名称是否为动态语法
template.slotScope = slotBinding.value || emptySlotScopeToken; // 插槽作用域，即v-slot后面那个取值

// 最终的AST结构
AST = [
    {
        name: 'component',
        children: [

            // 即template元素
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

2. **`v-slot`直接定义在组件上**。此时，它会生成一个`<tempalte>`元素的`ast`对象来做做组件插槽内容的父元素，这个`<tempalte>`元素的`ast`会继承那些插槽属性。最后该`<tempalte>`元素的`ast`对象会以其插槽名称为键名定义在组件元素的`ast`对象的`scopedSlots`属性上。这种情况的模版解析前后大致构造为：

```html
<!-- 解析前 -->
<component v-slot:name="prop">
    <div></div>
</component>

<!-- 解析后 -->
<component>
    <template v-slot:name="prop">
        <div></div>
    </template>
</component>
```

这种情况的处理过程可以描述为手动还原为`情况1`的结构，不过其做得更彻底，将组件元素中的子节点都转移到了`component.scopedSlots`中，已经不存在其子节点数组中了，具体过程为：

```js
let slots = component.scopedSlots;

// 为插槽创建一个template ast元素对象，将其存放在scopedSlots[slotName]中
// 并指定其父元素为当前组件
const slotContainer = slots[name] = createASTElement('template', [], el);

// slotContainer表示新建的中间层template元素，其为父元素为组件元素
slotContainer.slotTarget = name; // 插槽名称
slotContainer.slotTargetDynamic = dynamic; // 插槽名称是否为动态语法
slotContainer.slotScope = slotBinding.value || emptySlotScopeToken; // 插槽作用域，即v-slot后面那个取值

// 将组件中的子节点转移到该template中，
// 这里含义就是替我写了第一种语法
slotContainer.children = component.children.filter(function (c) {

    // 在这种语法下，如果还在插槽内容中使用了如下模版的内容(即定义其他的作用域插槽)，
    // 则将其删除
    // <template v-slot="prop">
    if (!c.slotScope) {

        // 重新定义其父ast对象
        c.parent = slotContainer;
        return true
    }
});

// remove children as they are returned from scopedSlots now
// 移除原组件ast对象上的子节点数组，因为它们已经转移到作用域插槽对象中了
// (这里也同时说明了，如果你混写了<template v-slot="prop">这种写法，那么这种写法会被直接移除)
component.children = [];
```

那么现在 `组件元素——新增的template元素——原组件的子节点们`三种的关系变为如下：

```js

// 最终的AST结构
AST = [
    {
        name: 'component',
        scopedSlots: {
            slotName1: {
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

____
对比`v-slot`的两种处理情况，我们可以看到还是有差异，具体差异点在第一种情况还**未对作用域插槽进行处理**，组件中的插槽内容仍处于组件元素的子节点数组中。

为什么不当时(`processSlotContent()`方法中)就做这个操作呢？我觉得主要的原因有三点：

1. 无论是哪个元素，都需要与其父元素建立关系，那么这部分逻辑可以抽离为公共部分。
2. `processSlotContent()`解析定义`v-slot`了的`<template>`元素时，其父组件的子节点未必解析完毕，不需要每解析到一个具有`v-slot`属性的元素就对组件的子节点数组进行一次过滤(它不像直接将`v-slot`定义在组件上，因为那时组件元素的子元素已经解析完毕)。
3. 使用`<template>`时可能会使用`v-if/v-else(-if)`等语法，那时不必重复对具有相同关系(父子)的元素进行处理。

那么如下就是一个将作用域插槽从组件的`children`中转移到`scopedSlots`的过程：

```js
// 当前元素为子元素时，且非被禁用的标签(脚本标签)
if (currentParent && !element.forbidden) {

    // 如果当前处理的元素具有v-else-if或v-else属性
    // 将其添加到上一个v-if元素的if条件块里面
    if (element.elseif || element.else) {
        // ...
    } else {

        // 当当前元素为作用域插槽时(且不具有v-else/v-else-if)
        // (这种情况仅会出现在在组件内template上定义v-slot，
        // 此时我们知道template元素还在组件元素的children中，
        // 所以我们要对其所在位置进行转义)
        if (element.slotScope) {

            // scoped slot
            // 获取当前作用域插槽的名称
            const name = element.slotTarget || '"default"';

            // 将代表该作用域插槽的元素存储到父元素的scopedSlots集合中
            (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        }

        // keep it in the children list so that v-else(-if) conditions can
        // find it as the prev node.
        // 将当前元素加入父元素的子队列中，所以v-else(-if)的块能通过前一个节点找到
        currentParent.children.push(element);
        element.parent = currentParent;
    }
}

// final children cleanup
// filter out scoped slots
// 对子节点数组中的作用域插槽节点进行清理，移除具有作用域插槽的元素
// (因为上面我们已经将其转移到父元素scopedSlots中，如果这里还出现则说明是错误的语法)
element.children = element.children.filter(c => !(c: any).slotScope);
```

从代码我们可以看到，将组件的子节点的作用域插槽元素们进行转移后，其已不存在`component.children`，所以进行一次清除它们的工作，同时这里其实还将在错误位置使用的`<template v-slot>`的元素清除(如你在非组件中使用)，一举两得。

经过这些处理，最终组件插槽的内容所代表的节点都处于`component.scopedSlots`对应插槽名称的键值中了！

##### 两者v-slot的用法处理后，父组件元素仍有差异

如果你刚刚仔细观察了代码，那么你会发现，两种`v-slot`语法处理完成后，得到的组件元素对象仍有不同，即使你想表达的是同一个意思，如：

```html
<!-- 语法1 -->
<component v-slot="prop">
</component>

<!-- 语法2 -->
<component>
    <template v-slot="prop">
    </template>
</component>
```

它们的区别就是`语法1`中会将组件的`children`清空，而`语法2`中会保留非作用域插槽元素。

##### 使用v-slot时，两种语法混用导致的问题

在这个过滤过程中，其实是防止这种嵌套`v-slot`的用法，这种写法是错误的，但`Vue`内部帮用户规避掉了：

```html
<!-- 此时只会保留com组件上的v-slot，之后其他定义v-slot的模版及其子元素都将直接舍弃 -->
<component v-slot="a">
    <template v-slot="b">

    </template>
</component>
```

所以一旦使用了在组件上定义`v-slot`的语法，那么组件中的`<template v-slot>`语法都将无效，它会被舍弃。

#### 组件定义的插槽元素的解析

对于`<slot>`元素的解析就比较中规中矩，只是调用`processSlotOutlet()`对其上定义的插槽名和作用域进行提取，其余的和常规的元素处理流程一样。

### 渲染函数的生成(根据`ast`对象生成渲染函数)

待模版解析完毕，就该根据解析出来的`dom`树构建出对应的渲染函数了，那么这里主要是说明组件的作用域插槽属性(`component.scopedSlots`)会生成哪些代码，及其含义。

>这里我们需要对render()函数有一定的了解，防止不知道某些字段的含义

那么在这个过程中，对插槽的处理主要集中在这两个代码段，由于`2.6`语法处理后的作用域插槽是在组件元素`scopedSlots`属性上，所以我们可以知道前者用于处理`2.6`以下的语法，后者才为正式的插槽处理：

```js
// slot target
// only for non-scoped slots
// 处理插槽旧语法
if (el.slotTarget && !el.slotScope) {
    data += "slot:" + (el.slotTarget) + ",";
}

// scoped slots
// 处理组件的作用域插槽
if (el.scopedSlots) {
    data += (genScopedSlots(el, el.scopedSlots, state)) + ",";
}
```

那么如果存在`.scopedSlots`属性，则说明该组件为存在作用域插槽，则此时调用[`genScopedSlots(el, el.scopedSlots, state)`](../../beforeMount/compile编译/baseCompile/generate生成/处理属性生成函数/生成插槽函数/README.md)方法。在`genScopedSlots()`方法内部，会对某个作用域插槽调用`genScopedSlot()`方法，将其单独编译，最后将其全部组合为以下的形式的对象字符串表达式：

```js
// 这里为了展示将其表现为对象，实则为字符串
// 这是genScopedSlots()方法编译后的结果
const result = [{
    key: 'default',
    fn: renderFunction/** 插槽内容的渲染函数 */
},
{
    key: 'slot1',
    fn: renderFunction/** 插槽内容的渲染函数 */
}];
```

之后`genScopedSlots()`使用`_u()`函数将其包裹，并返回如下的字段：

```js
`scopedSlots: _u([ {key:"default",fn: render} ])`
```

这个字段起始就是我们定义渲染函数时，传入的第二个参数上的字段：

```js
let render = c('div', {
    scopedSlots: _u([ {key:"default",fn: render} ])
});
```

那么我们现在的问题就变成了`_u()`这个函数是什么？

实际上它就是[`resolveScopedSlots()`](../../mounted/渲染函数中的方法/README.md#uresolvescopedslots%e5%88%9d%e6%ad%a5%e5%a4%84%e7%90%86%e5%85%b7%e5%90%8d%e6%8f%92%e6%a7%bd)函数，它用于来将传入的`.scopedSlots`中的具名插槽对象们处理为一个更准确的结果，这个准确体现在它是否需要在组件更新时复用等等，它的返回值大致形式如下

```js
let scopedSlots = {
    $stable: true,
    $key: 123123123,
    default: renderFunction,
    other: renderFunction
}
```

以上代码具体字段含义为：

- `$key`：表示插槽内容是否在更新时复用
- `$stable`：插槽的渲染函数是否需要每次重新计算
- `name: fn`: 表示对应作用域插槽的渲染函数

在于未定义作用域的插槽上，还会在其渲染函数定义一个`.proxy`属性，它表示是否将该具名插槽函数直接代理到`vm.$scopedSlots`上。

那么最终这个渲染函数的插槽部分应该为这种样子：

```js
let renderPart = c('div', {
    scopedSlots: {
        $stable: true,
        $key: 123123123,
        default: renderFunction,
        other: renderFunction
    }
});
```

### 渲染函数的调用

上述的最后一个阶段其实应该算在这部分，不过问题不大。

>接下来这部分涉及到`Vue`实例的生命周期，所以需要一定的了解。

通过之前的处理，我们可以知道，写在父模版组件中的插槽内容，现在以一个函数的形式存储在了渲染组件的`createElement()`函数的第二个参数中，在渲染函数调用后，它会存放在组件`VNode`节点的`.data.scopedSlots`属性中。

我们知道，作用域插槽访问的变量是子组件实例上的变量，根据刚刚的了解，我们知道**子组件的渲染函数被封装为一个函数，那么我们只要在调用该函数时，传入对应要访问的变量，那么就可以达到目的**！基于这个想法，我们来看看*该函数在`Vue`生命周期的什么位置被调用*。

首先父组件的`beforeCreate`阶段调用`initRender()`方法，如果我们使用的`v-slot`语法，那么下面两个值为空对象，因为作用域插槽对象并不存在节点的`children`中而是`.scopedSlots`属性中(但并不意味着它们没用)：

```js
// 不具有插槽的父组件中，以下两个值均为空对象
vm.$slots = resolveSlots(options._renderChildren, renderContext);
vm.$scopedSlots = emptyObject;
```

接下来就是父组件渲染函数的调用，此时对于组件则创建其组件`Vnode`并创建其组件的`vm`实例并传入组件元素插槽内容中的子节点们(为使用`v-slot`的情况下)，它们会被存放在初始化子`vm`实例的`options._renderChildren`中，那么此时就进入了子组件的`beforeCreate`阶段，此时仍调用`initRender()`函数，<!--代写-->。

之后便是对子组件模版的解析，由于我们定义了`<slot>`元素，它会在生成渲染函数时，通过[`genSlot()`](../../mounted/渲染函数中的方法/README.md#uresolvescopedslots%e5%88%9d%e6%ad%a5%e5%a4%84%e7%90%86%e5%85%b7%e5%90%8d%e6%8f%92%e6%a7%bd)函数解析为`_t()`函数。

在调用其渲染函数之前，子组件`vm`实例需要对父组件中提取出来的作用域插槽函数们进行一个处理，具体过程如下：

```js
if (_parentVnode) {

    // 将作用域插槽和普通的插槽内容进行标准化处理
    vm.$scopedSlots = normalizeScopedSlots(

        // 父组件中解析出来的作用域插槽对象
        _parentVnode.data.scopedSlots,

        // 父组件中的普通插槽内容(即不使用v-slot语法)
        vm.$slots,

        // 上一次的标准化处理结果
        vm.$scopedSlots
    );
}
```

处理完之后，我们边弄从`vm.$scopedSlots`上从对应插槽名称(默认为`default`)，上访问对应插槽内容的`VNode`生成函数。

随后调用渲染函数，刚才我们说过`<slot>`元素生成了`_t()`函数，该函数即为[`renderSlot()`](../../mounted/渲染函数中的方法/README.md#trenderslot%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%94%9f%e6%88%90vnode%e8%8a%82%e7%82%b9)该函数的主要职能是调用之前生成的插槽作用域函数并传入子组件中想要访问的变量来生成对应的`Vnode`节点。

```js
// 伪代码
function renderSlot(slotName, defaultContent, props, bindProp) {

    // 取出对应作用域插槽的Vnode函数
    const scopedSlotFn = this.$scopedSlots[slotName];
    let finalProps = {};

    // 合并要传入的属性
    extend(extend(finalProps, bindProp), props);

    // 调用返回作用域插槽的根Vnode，如果未使用插槽，则返回定义的默认内容
    return scopedSlotFn(finalProps) || defaultContent(finalProps);
}
```

到此为止，插槽的内容就被渲染成对应的`VNode`和`dom`元素。

#### 简写语法的处理——普通的插槽内容(不使用v-slot)

上面讲述的都是`v-slot`语法的处理情况，但我们在上面也提到了这种情况：

```html
<!-- 没有任何v-slot语法 -->
<!-- 假设这为父组件 -->
<component>
    <template>
        <div></div>
    <template>
</component>
```

刚刚提到在`Vue`实例初始化的`beforeCreate`阶段，有以下代码：

```js
// 处理普通的插槽内容
vm.$slots = resolveSlots(options._renderChildren, renderContext);
vm.$scopedSlots = emptyObject;
```

这段代码在具有`<slot>`元素的子组件中才有效，其中上面的`$slots`中包含的就是父组件中插槽内容所代表的子节点数组。那么这里就有一个`options._renderChildren`和`renderContext`需要知道，前者可以理解为`component.children`子节点数组，后者则为父组件`vm`实例，通过`resolveSlots()`函数，将全部节点转移到`$slots.default`数组中，该函数可以理解为如下：

```js
function resolveSlots(

    // 普通的插槽内容(即组件中的子节点)
    children
){

    // 如果组件并没有传入普通的插槽内容，则直接返回空对象
    // 如果使用纯粹的作用域插槽则在此处就返回
    if (!children || !children.length) {
        return {}
    }

    // 初始化p它插槽对象
    const slots = {};

    slots.default = [...children];

    return slots;
}
```

## 一些问题的探讨

通过上个板块内容的探讨，我们可能仍会存在一些疑问，比如，如果模版书写为以下情况，那么会同时生成普通插槽内容和作用域插槽内容，那`Vue`是如何决定使用谁？

```html
<component>
    <template v-slot:default></template>
    <div></div>
</component>
```

上述的情况可谓是边缘情况，按照文档学习完毕后，你肯定知道只会渲染作用域插槽的内容，但通过刚刚的源码学习，我们来详细的分析下。

首先是组件插槽内容的解析，它解析结果对应[`v-slot`语法解析的第一种情况](#%e7%bb%84%e4%bb%b6%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e7%9a%84%e8%a7%a3%e6%9e%90)，此时它会解析为如下结构：

```js
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
        }
        children: [{
                name: 'div'
        }]
    }
];
```

可以看到，其未对`children`中子元素进行清除，那么在子组件初始化时，会通过`resolveSlots()`将`div`元素的`VNode`节点存储在`vm.$slots.default`中，而插槽节点们则处于组件节点的`.slotScopes`属性上。

不过没关系，在调用子组件渲染函数前，会有一个`normalizeScopedSlots()`方法处理这普通插槽和作用域插槽，它会优先返回作用域插槽的该插槽名称的函数。

(可能还有问题，但是我暂时想不起来了)

## 手动编写渲染函数时，如何书写插槽

这里就比较偏向实际编写渲染函数时，如何使用插槽呢？

这里我们可以使用内部的`_name`类型的函数，但是在不了解的情况下应该尽量避免使用，尽量用其他方式来达到同样的目的，比如下面这个渲染函数：

```js
// 父组件
function render(c) {
    return c('component', {
        scopedSlots: {
            slotName: (props) => c('div', props.a)
        }
    });
}

// 子组件
function render(c) {
    return this.$scopedSlots.a({
        a: this.a
    }) || c('div', '默认');
}

// 骚写法
function render(c) {
    return this._t('a', c('div', '默认'), { a: this.a });
}
```

其具体就可以翻译为：

```html
<!-- 父 -->
<component v-slot:slotName="xxx">
    <div>{{ xxx.a }}</div>
</component>

<!-- 子 -->
<slot name="a">
    <div>默认</div>
</slot>
```

我可以在子组件通过`this.$scopedSlots[name]`来访问对应具名插槽的子节点生成函数。
