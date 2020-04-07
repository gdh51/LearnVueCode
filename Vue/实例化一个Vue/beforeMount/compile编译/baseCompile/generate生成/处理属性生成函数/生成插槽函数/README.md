# 生成插槽函数表达式

`Vue`通过`genScopedSlots()`来处理`2.6+`中的插槽语法，将其生成为渲染函数表达式。

```js
function genScopedSlots(

    // 组件元素对象
    el: ASTElement,

    // 作用域插槽对象，里面会按插槽名称分发对应插槽中的元素节点
    slots: {
        [key: string]: ASTElement
    },
    state: CodegenState
) : string {

    // by default scoped slots are considered "stable", this allows child
    // components with only scoped slots to skip forced updates from parent.
    // 默认情况下，作用域插槽被认为是"稳定的"，这使得只有唯一作用域插槽的子组件可以跳过
    // 由父元素带来的强制更新
    // but in some cases we have to bail-out of this optimization
    // 但在一些情况下，我们不能这样做这些优化
    // for example if the slot contains dynamic names, has v-if or v-for on them...
    // 比如，组件元素为v-for渲染，或其作用域插槽包含动态的具名插槽、v-if、v-for
    let needsForceUpdate = el.for || Object.keys(slots).some(key => {

        // 取出当前具有v-slot的标签ast对象
        const slot = slots[key];

        // 该标签对象上是否具有v-for或v-if或具有动态插槽名称
        // 或子元素中还嵌套存在slot元素都需要强制更新
        return (
            slot.slotTargetDynamic ||
            slot.if ||
            slot.for ||
            containsSlotChild(slot) // is passing down slot from parent which may be dynamic
        )
    });

    // #9534: if a component with scoped slots is inside a conditional branch,
    // it's possible for the same component to be reused but with different
    // compiled slot content. To avoid that, we generate a unique key based on
    // the generated code of all the slot contents.
    // 如果一个带有作用域插槽的组件存在一组if条件语句中，那么在if条件变换时，
    // 如果另一个if条件的组件也为同一个组件，那么它会复用组件，但编译的插槽内容不一样
    // 为了避免这种情况，我们生成一个以插槽中内容为基础生成的key值定义在组件上
    let needsKey = !!el.if;

    // OR when it is inside another scoped slot or v-for (the reactivity may be
    // disconnected due to the intermediate scope variable)
    // 或则，当一个具有插槽的组件在另一个组件的插槽中，或具有v-for
    // #9438, #9506
    // TODO: this can be further optimized by properly analyzing in-scope bindings
    // 这里可以进一步优化，通过适当的分析作用域绑定，当作用域变量不再使用时跳过强制更新
    // and skip force updating ones that do not actually use scope variables.

    // 同样以下情况也需要强制更新
    if (!needsForceUpdate) {
        let parent = el.parent;
        while (parent) {

            // 如果当前使用了插槽作用域的组件处于另一个插槽作用域(非默认插槽作用域)中
            // 或当前组件处于v-for也需要强制更新
            if (
                (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
                parent.for
            ) {
                needsForceUpdate = true;
                break;
            }

            // 父级存在if条件块，则也需要key值来防止复用
            if (parent.if) {
                needsKey = true;
            }

            // 一直查询到顶层
            parent = parent.parent;
        }
    }

    // 为每个插槽生成插槽函数表达式
    const generatedSlots = Object.keys(slots)
        .map(key => genScopedSlot(slots[key], state))
        .join(',');

    // 根据是否需要强制更新和key来生成最后的函数
    return `scopedSlots:_u([${generatedSlots}]${needsForceUpdate ? `,null,true` : ``}
        ${!needsForceUpdate && needsKey ? `,null,false,${hash(generatedSlots)}` : ``})`;
}
```

## 针对编译问题的修复

可以看出该函数前半部分主要是在针对`bug`进行修改，主要有两个问题：

1. 默认情况下，插槽作用域允许其中的子组件跳过由于父组件的强制更新，但[一些情况](#%e6%83%85%e5%86%b51%e5%bc%ba%e5%88%b6%e6%9b%b4%e6%96%b0)下不允许
2. 当一个带有作用域插槽的组件处于`if`条件中时，如果在`if`条件块其他分支仍是使用的该组件，那么它会复用，但它也会编译出不同的插槽内容。

### 情况1——强制更新

针对该组件的情况`1`，对这些情况进行单独的排查，这些情况有：

- 组件元素为`v-for`渲染
- 组件的作用域插槽存在`v-if`语句块
- 组件的作用域插槽具有动态插槽名称
- 组件的作用域插槽使用`v-for`渲染
- 使用了插槽作用域的组件处于另一个插槽作用域(非默认插槽作用域)中或当前组件处于`v-for`(和`情况1-描述1`的不同，这种情况是处于一个组件的内部)也需要强制更新

```js
let needsForceUpdate = el.for || Object.keys(slots).some(key => {

    // 取出当前具有v-slot的标签ast对象
    const slot = slots[key];

    // 该标签对象上是否具有v-for或v-if或具有动态插槽名称
    // 或子元素中还嵌套存在slot元素都需要强制更新
    return (
        slot.slotTargetDynamic ||
        slot.if ||
        slot.for ||
        containsSlotChild(slot) // is passing down slot from parent which may be dynamic
    )
});
```

其中`containsSlotChild()`运用递归的方式继续排查组件的插槽内容中是否具有`<slot>`元素(即三层的组件关系，我们在`root`中定义插槽内容，`father`层传递其插槽内容，内容在`child`层呈现)。

```js
function containsSlotChild(el: ASTNode): boolean {

    // 只对元素进行排查
    if (el.type === 1) {

        // 具有插槽
        if (el.tag === 'slot') {
            return true
        }

        // 递归查询子元素是否具有slot元素
        return el.children.some(containsSlotChild)
    }
    return false;
}
```

具体就是如下这种情况：

```html
<!-- root -->
<father>
    some text
</father>

<!-- father -->
<child>
    <slot></slot>
</child>

<!-- child -->
<template>
    <slot></slot>
</template>
```

同样以下情况也需要强制更新(对应`情况1-描述5`)

```js
if (!needsForceUpdate) {
    let parent = el.parent;
    while (parent) {

        // 如果当前使用了插槽作用域的组件处于另一个插槽作用域(非默认插槽作用域)中
        // 或当前组件处于v-for也需要强制更新
        if (
            (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
            parent.for
        ) {
            needsForceUpdate = true;
            break;
        }

        // 父级存在if条件块，则也需要key值来防止复用
        if (parent.if) {
            needsKey = true;
        }

        // 一直查询到顶层
        parent = parent.parent;
    }
}
```

### 情况2——重复渲染

针对`2`，`Vue`基于插槽内容提供了一个唯一的`key`来帮助进行更新，但要满足两个条件：

- 组件通过`v-if/v-else(-if)`渲染
- 该组件不需强制更新时，其祖先元素不为插槽或作用域插槽且不存在`v-for`中，此时祖先处于祖先元素的`v-if/v-else(-if)`条件块中

```js
// 如果一个带有作用域插槽的组件存在一组if条件语句中，那么在if条件变换时，
// 如果另一个if条件的组件也为同一个组件，那么它会复用组件，但编译的插槽内容不一样
// 为了避免这种情况，我们生成一个以插槽中内容为基础生成的key值定义在组件上
let needsKey = !!el.if;

// 同样以下情况也需要强制更新
if (!needsForceUpdate) {
    let parent = el.parent;
    while (parent) {

        // 如果当前使用了插槽作用域的组件处于另一个插槽作用域(非默认插槽作用域)中
        // 或当前组件处于v-for也需要强制更新
        if (
            (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
            parent.for
        ) {
            needsForceUpdate = true;
            break;
        }

        // 父级存在if条件块，则也需要key值来防止复用
        if (parent.if) {
            needsKey = true;
        }

        // 一直查询到顶层
        parent = parent.parent;
    }
}
```

之后便调用`genScopedSlot()`为每一个插槽生成表达式：

```js
// 为每个插槽生成插槽函数表达式
const generatedSlots = Object.keys(slots)
    .map(key => genScopedSlot(slots[key], state))
    .join(',');
```

## genScopedSlot()——生成插槽表达式

该函数为单个作用域插槽生成了一个渲染函数表达式，其中包含该**插槽名**和其内部**子节点的渲染函数**，它大约是这样的`{key: slotName, fn: slotRenderFn}`，具体过程如下：

```js
function genScopedSlot(
    el: ASTElement,
    state: CodegenState
): string {

    // 如未处理v-if属性，则优先处理该属性，处理完后再调用该方法处理插槽属性
    if (el.if && !el.ifProcessed) {
        return genIf(el, state, genScopedSlot, `null`)
    }

    // 如未处理v-for属性，则优先处理该属性，处理完后再调用该方法处理插槽属性
    if (el.for && !el.forProcessed) {
        return genFor(el, state, genScopedSlot)
    }

    // 获取插槽的作用域(其实就是指定的值，给插槽传递的值)
    const slotScope = el.slotScope === emptySlotScopeToken ? `` : String(el.slotScope);

    // 这里直接简化为2.6语法，删除2.5语法部分
    // 这里比较清晰，对某个作用域插槽中的元素编译为一个函数，
    // 传入的参数为提供的作用域值
    const fn = `function(${slotScope}){
        return ${genChildren(el, state) || 'undefined'}
    }`;

    // reverse proxy v-slot without scope on this.$slots
    // 为没有指定作用域的插槽进行反向代理
    const reverseProxy = slotScope ? `` : `,proxy:true`;

    // 返回该插槽的产生的对象字符串表达式，包括编译的函数和插槽名称
    return `{key:${el.slotTarget || `"default"`},fn:${fn}${reverseProxy}}`
}
```

首先针对在插槽的组件，其先进行判断是否具有影响`dom`结构的两个指令语法`v-for`与`v-if`，如果有，则要优先进行处理，因为之后该元素是否、怎么渲染取决于它们。

之后与其他元素节点一样，调用它们生成渲染函数表达式，不同的是作用域插槽的表达式是封装在函数中的，这样我们可以通过传入一个值，这些节点就可以访问这个值了。

```js
const fn = `function(${slotScope}){
    return ${genChildren(el, state) || 'undefined'}
}`;
```

这里举个例子，有一个这样的模版，因为我们现在这个函数是处理插槽，所以这里就是该`<template>`元素，当然这是一种错误写法：

```html
<child1 v-slot:xxx="someprop">
    <template v-if="condition" v-slot="anotherprop">
        <div>
            <div></div>
        </div>
    </template>
</child1>
```

从上面我们可以知道，我们指定的插槽属性，是作为函数的形参的，所以可以指定任意的值；之后根据是否为`<template>`元素开始出现两种情况：

- 是，是否具有`if`条件块：
  - 具有：调用`genChildren()`处理子元素生成渲染函数，为`function(anotherprop){return [_c('div',[_c('div')])]}`
  - 不具有：返回`undefined`，生成的结果为`function(anotherprop){return undefined}`
- 否：则直接调用`genElement()`函数生成渲染函数

最后组成对象，以`key`为插槽名，`fn`为渲染函数的形式返回，即`{key:slotName, fn: renderFn}`，就是`genScopedSlot()`函数的返回值了。
____
现在回到我们的`genScopedSlots()`函数，我们已经知道`generatedSlots`的值就是所有插槽生成的渲染函数对象的连续字符串了，不出意外，最后它肯定是个数组。

最后根据是否需要强制更新和`key`来防止重复更新，生成一个插槽键值对。

```js
return `scopedSlots:_u([${generatedSlots}]${needsForceUpdate ? `,null,true` : ``}${!needsForceUpdate && needsKey ? `,null,false,${hash(generatedSlots)}` : ``})`;
```

这里使用`hash()`函数对其中的生成的插槽渲染函数进行了处理，根据之前修复的`bug`可以知道，它会被用作唯一的`key`值：

```js
// times33 散列函数
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return hash >>> 0;
}
```

这里我把所有可能的值列出来：

- `scopedSlots:_u([{key: key1, fn: fn1}, {key: key2, fn: fn2}], null, true)`
- `scopedSlots:_u([{key: key1, fn: fn1}, {key: key2, fn: fn2}])`
- `scopedSlots:_u([{key: key1, fn: fn1}, {key: key2, fn: fn2}], null, false, 1010123)`

## 针对slot元素的处理——genSlot()

`Vue`对于`<slot>`元素中的默认内容进行了处理，之后对其上的属性和绑定的作用域进行了处理：

```js
function genSlot(el: ASTElement, state: CodegenState): string {

    // 获取插槽定义的名称
    const slotName = el.slotName || '"default"';

    // 获取子元素数组的渲染函数表达式(用作后备内容)
    const children = genChildren(el, state);

    // 从这里可以看到第一个参数为插槽名称，第二个参数为插槽默认内容
    let res = `_t(${slotName}${children ? `,${children}` : ''}`;

    // 获取插槽上的其他attribute属性
    const attrs = el.attrs || el.dynamicAttrs ?
        genProps((el.attrs || []).concat(el.dynamicAttrs || []).map(attr => ({

            // slot props are camelized
            // 将插槽上的属性驼峰化
            name: camelize(attr.name),
            value: attr.value,
            dynamic: attr.dynamic
        }))) : null;

    // 如果插槽不具有默认内容，但具有绑定的属性
    const bind = el.attrsMap['v-bind'];
    if ((attrs || bind) && !children) {
        res += `,null`
    }

    // 第三个参数为定义在slot上的属性
    if (attrs) {
        res += `,${attrs}`
    }

    // 如果通过bind绑定则不能存在attrs属性，两者不能共存
    if (bind) {
        res += `${attrs ? '' : ',null'},${bind}`
    }
    return res + ')'
}
```

相关方法连接：

- [genProps()](../生成数据表达式/README.md#genprops%e8%bd%ac%e5%8c%96%e4%b8%ba%e8%bf%90%e8%a1%8c%e6%97%b6%e7%bc%96%e8%af%91%e4%bb%a3%e7%a0%81)
- [genChildren()](../README.md)