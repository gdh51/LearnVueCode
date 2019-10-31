# process()——处理属性的集合

`process`函数用于处理某个属性，然后返回某个属性的对象表达式，针对不同属性，有单独的`process`函数，每次处理完一个属性，必然会删除`attrList`(未处理属性数组)中的该属性对象，特殊情况下还会删除其在`attrMap`中的值。

## processFor()——处理v-for表达式

处理`v-for`的字符串表达式，返回一个对象，对象包含其具体的位置的变量：

```js
function processFor(el: ASTElement) {
    let exp;

    // 获取v-for的字符串表达式
    if ((exp = getAndRemoveAttr(el, 'v-for'))) {

        // 匹配v-for表达式，将上代表的值的转换为对象形式
        const res = parseFor(exp);

        // 将属性嫁接到ast元素对象上去
        if (res) {
            extend(el, res);
        } else if (process.env.NODE_ENV !== 'production') {
            warn(
                `Invalid v-for expression: ${exp}`,
                el.rawAttrsMap['v-for']
            )
        }
    }
}
```

首先其会获取该属性在未处理属性列表(`attrList`)中的对象，如果存在该属性才会开始解析，解析是调用的[parseFor()](../解析属性/README.md#parsefor%e8%a7%a3%e6%9e%90v-for)方法，会将`v-for`表达式中的各个变量解析成一个对象结构，最后将各个变量扁平化后挂载在元素的`ast`对象上。
____
假如有个以下模版

```html
<div v-for="(alias1, alias2) of values"></div>
```

则解析结果为

```js
const ast = {

    //...其他属性
    alias: alias1,
    iterator1: alias2
    for: values
}
```

## processKey()——处理key属性

该函数用于处理`ast`元素上的`key`属性，它获取`key`属性的字符串表达式，还会检测一下具体`key`值所在位置是否合法。不理解[`getBindingAttr()`](#getbindingattr%e8%8e%b7%e5%8f%96bind%e5%b1%9e%e6%80%a7)方法的请

```js
function processKey(el) {

    // 获取key值字符串表达式
    const exp = getBindingAttr(el, 'key');

    // 检查是否在非法元素上使用key
    if (exp) {
        if (process.env.NODE_ENV !== 'production') {

            // 禁止在模版元素上定义key属性
            if (el.tag === 'template') {
                warn(
                    `<template> cannot be keyed. Place the key on real elements instead.`,
                    getRawBindingAttr(el, 'key')
                )
            }

            // 提示不要在抽象元素上用key属性
            if (el.for) {
                const iterator = el.iterator2 || el.iterator1;
                const parent = el.parent;
                if (iterator && iterator === exp && parent && parent.tag === 'transition-group') {
                    warn(
                        `Do not use v-for index as key on <transition-group> children, ` +
                        `this is the same as not using keys.`,
                        getRawBindingAttr(el, 'key'),
                        true /* tip */
                    )
                }
            }
        }
        el.key = exp;
    }
}
```

## processRef()——处理动态ref属性

该函数用于处理ast元素对象的`ref`属性的字符串表达式值

```js
function processRef(el) {

    // 获取ref的表达式字符串
    const ref = getBindingAttr(el, 'ref');

    if (ref) {

        // 挂载至AST元素上
        el.ref = ref;

        // ref是否在v-for中
        el.refInFor = checkInFor(el);
    }
}

function checkInFor(el: ASTElement): boolean {
    let parent = el;

    // 找到第一个具有v-for属性的祖先元素
    while (parent) {
        if (parent.for !== undefined) {
            return true;
        }
        parent = parent.parent;
    }

    // 没找到则说明没有在v-for指令中
    return false;
}
```

## processSlotContent()——处理作为插槽内容插入的元素

该方法用于来处理那些作为插槽内容插入的元素，兼容2.6以下的版本，但不允许在同一个插槽混用两个版本的语法。

在2.6及其以上版本中，无论哪一种写法，其实处理效果都一样，都会在含有一个默认`template`元素来承载插槽内容。

```js
// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
// 处理作为插入slot的组件
function processSlotContent(el) {
    let slotScope;

    // 旧语法，处理作用域插槽，处理作为模版插入的标签
    if (el.tag === 'template') {

        // 处理scope属性, 该属性已在高版本废弃，所以提示用户不要再使用
        slotScope = getAndRemoveAttr(el, 'scope');

        if (process.env.NODE_ENV !== 'production' && slotScope) {
            warn(
                `the "scope" attribute for scoped slots have been deprecated and ` +
                `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
                `can also be used on plain elements in addition to <template> to ` +
                `denote scoped slots.`,
                el.rawAttrsMap['scope'],
                true
            )
        }

        // 处理slot-scope属性
        el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope');

    // 不再模版上使用时
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {

        // 同v-for属性一起使用时，报错，提示用户两者优先级冲突
        if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
            warn(
                `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
                `(v-for takes higher priority). Use a wrapper <template> for the ` +
                `scoped slot to make it clearer.`,
                el.rawAttrsMap['slot-scope'],
                true
            )
        }
        el.slotScope = slotScope;
    }

    // slot="xxx"
    // 旧语法：获取slot的字符串表达式值，支持获取动态值
    const slotTarget = getBindingAttr(el, 'slot');

    // 旧语法：处理插槽绑定的插槽名称
    if (slotTarget) {

        // 获取内容绑定的插槽名称，默认绑定目标为default
        el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget;

        // 是否绑定的是动态属性目标
        el.slotTargetDynamic = !!(el.attrsMap[':slot'] || el.attrsMap['v-bind:slot'])

        // preserve slot as an attribute for native shadow DOM compat
        // only for non-scoped slots.
        // 为非template元素预备一个插槽属性(不支持2.6版本下)
        if (el.tag !== 'template' && !el.slotScope) {

            // 为el添加一个已处理的slot属性(添加在新的属性中)
            addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'));
        }
    }

    // 2.6 v-slot syntax
    // 2.6 v-slot 语法
    if (process.env.NEW_SLOT_SYNTAX) {

        // 插入模版的情况
        if (el.tag === 'template') {

            // v-slot on <template>
            // 处理掉模版上的v-slot属性
            const slotBinding = getAndRemoveAttrByRegex(el, slotRE);
            if (slotBinding) {

                if (process.env.NODE_ENV !== 'production') {

                    // 新旧版本语法一起用，报错
                    if (el.slotTarget || el.slotScope) {
                        warn(
                            `Unexpected mixed usage of different slot syntaxes.`,
                            el
                        )
                    }

                    // 使用template的v-slot语法，而父级元素不是组件，则报错
                    if (el.parent && !maybeComponent(el.parent)) {
                        warn(
                            `<template v-slot> can only appear at the root level inside ` +
                            `the receiving the component`,
                            el
                        )
                    }
                }

                const {

                    // 插槽名称字符串表达式
                    name,

                    // 插槽名是否为动态的
                    dynamic
                } = getSlotName(slotBinding);

                // 在ast元素上设置插槽名称与是否为动态名称
                el.slotTarget = name;
                el.slotTargetDynamic = dynamic;

                // 插槽指定的prop值(没有则指定默认值)
                el.slotScope = slotBinding.value || emptySlotScopeToken // force it into a scoped slot for perf
            }
        } else {

            // v-slot on component, denotes default slot
            // 直接在组件上使用插槽，则表示使用默认插槽
            const slotBinding = getAndRemoveAttrByRegex(el, slotRE);
            if (slotBinding) {
                if (process.env.NODE_ENV !== 'production') {

                    // 当前使用v-slot的不是组件 ,报错
                    if (!maybeComponent(el)) {
                        warn(
                            `v-slot can only be used on components or <template>.`,
                            slotBinding
                        )
                    }

                    // 混合两者版本的语法使用，报错
                    if (el.slotScope || el.slotTarget) {
                        warn(
                            `Unexpected mixed usage of different slot syntaxes.`,
                            el
                        )
                    }

                    // 已有作用域插槽时，报错
                    if (el.scopedSlots) {
                        warn(
                            `To avoid scope ambiguity, the default slot should also use ` +
                            `<template> syntax when there are other named slots.`,
                            slotBinding
                        )
                    }
                }

                // add the component's children to its default slot
                // 初始化插槽
                const slots = el.scopedSlots || (el.scopedSlots = {});

                // 处理并返回插槽名称，和是否为动态名称
                const {
                    name,
                    dynamic
                } = getSlotName(slotBinding);

                // 为插槽创建一个代表默认插槽的模版ast元素对象，并指定其父元素为当前组件
                const slotContainer = slots[name] = createASTElement('template', [], el);
                slotContainer.slotTarget = name;
                slotContainer.slotTargetDynamic = dynamic;

                // 因为中间新增了一层template元素，所以要重写它们的父子关系（必须要未绑定插槽作用域的）
                slotContainer.children = el.children.filter((c: any) => {
                    if (!c.slotScope) {
                        c.parent = slotContainer;
                        return true;
                    }
                });

                // 设置当前组件的插槽作用域为当前插槽绑定的值
                slotContainer.slotScope = slotBinding.value || emptySlotScopeToken;

                // remove children as they are returned from scopedSlots now
                // 移除组件的子数组，将插槽ast对象转移到scopedSlots对象上
                el.children = [];

                // mark el non-plain so data gets generated
                el.plain = false;
            }
        }
    }
}
```

## processSlotOutlet()——处理插槽位

该函数用于处理插槽位元素，获取其插槽的名称

```js
// handle <slot/> outlets
function processSlotOutlet(el) {

    // 处理模版中留出的插槽位
    if (el.tag === 'slot') {

        // 获取插槽名称
        el.slotName = getBindingAttr(el, 'name');

        // 在slot元素上定义key时，进行报错
        if (process.env.NODE_ENV !== 'production' && el.key) {
            warn(
                `\`key\` does not work on <slot> because slots are abstract outlets ` +
                `and can possibly expand into multiple elements. ` +
                `Use the key on a wrapping element instead.`,
                getRawBindingAttr(el, 'key')
            )
        }
    }
}
```

## processComponent()——处理组件上的两个状态属性

该函数用来处理组件上的两个状态——`is`与`inline-template`

```js
function processComponent(el) {
    let binding;

    // 处理当前元素绑定的组件
    if ((binding = getBindingAttr(el, 'is'))) {
        el.component = binding;
    }

    // 当前元素是否使用内联模版
    if (getAndRemoveAttr(el, 'inline-template') != null) {
        el.inlineTemplate = true;
    }
}
```
