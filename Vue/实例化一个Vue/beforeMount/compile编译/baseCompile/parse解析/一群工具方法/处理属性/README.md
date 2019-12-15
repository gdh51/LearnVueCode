# process()——处理属性的集合

`process`函数用于处理某个属性，然后返回某个属性的对象表达式，针对不同属性，有单独的`process`函数，每次处理完一个属性，必然会删除`attrList`(未处理属性数组)中的该属性对象，特殊情况下还会删除其在`attrMap`中的值。

而对于属性的不同，有些属性最终会被添加进`attrs`(HTML属性)或`props`(DOM特性)属性中，当然Vue中的那些指令属性肯定是不会添加的，就不要想了。

目录：

- [processFor()——处理v-for表达式](#processfor%e5%a4%84%e7%90%86v-for%e8%a1%a8%e8%be%be%e5%bc%8f)
- [processKey()——处理key属性](#processkey%e5%a4%84%e7%90%86key%e5%b1%9e%e6%80%a7)
- [processRef()——处理动态ref属性](#processref%e5%a4%84%e7%90%86%e5%8a%a8%e6%80%81ref%e5%b1%9e%e6%80%a7)
- [processSlotContent()——处理作为插槽内容插入的元素](#processslotcontent%e5%a4%84%e7%90%86%e4%bd%9c%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e6%8f%92%e5%85%a5%e7%9a%84%e5%85%83%e7%b4%a0)
- [processSlotOutlet()——处理插槽位](#processslotoutlet%e5%a4%84%e7%90%86%e6%8f%92%e6%a7%bd%e4%bd%8d)
- [processComponent()——处理组件上的两个状态属性](#processcomponent%e5%a4%84%e7%90%86%e7%bb%84%e4%bb%b6%e4%b8%8a%e7%9a%84%e4%b8%a4%e4%b8%aa%e7%8a%b6%e6%80%81%e5%b1%9e%e6%80%a7)
- [processElement()——处理元素上其余的属性](#processelement%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0%e4%b8%8a%e5%85%b6%e4%bd%99%e7%9a%84%e5%b1%9e%e6%80%a7)
- [processAttrs()——处理事件修饰符与指令](#processattrs%e5%a4%84%e7%90%86%e4%ba%8b%e4%bb%b6%e4%bf%ae%e9%a5%b0%e7%ac%a6%e4%b8%8e%e6%8c%87%e4%bb%a4)
- [processPre()——处理v-pre属性](#processpre%e5%a4%84%e7%90%86v-pre%e5%b1%9e%e6%80%a7)
- [processRawAttrs()——直接标记未处理属性为已处理](#processrawattrs%e7%9b%b4%e6%8e%a5%e6%a0%87%e8%ae%b0%e6%9c%aa%e5%a4%84%e7%90%86%e5%b1%9e%e6%80%a7%e4%b8%ba%e5%b7%b2%e5%a4%84%e7%90%86)
- [processIf()——处理元素v-if/v-else/v-else-if属性](#processif%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0v-ifv-elsev-else-if%e5%b1%9e%e6%80%a7)
- [processOnce()——处理v-once属性](#processonce%e5%a4%84%e7%90%86v-once%e5%b1%9e%e6%80%a7)
- [processIfConditions()——添加else/else-if条件语句块](#processifconditions%e6%b7%bb%e5%8a%a0elseelse-if%e6%9d%a1%e4%bb%b6%e8%af%ad%e5%8f%a5%e5%9d%97)

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

该函数用于处理`ast`元素上的`key`属性，它获取`key`属性的字符串表达式，还会检测一下具体`key`值所在位置是否合法。(不理解[`getBindingAttr()`](#getbindingattr%e8%8e%b7%e5%8f%96bind%e5%b1%9e%e6%80%a7)方法的请)

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

通过上面我们可以知道，它还要确认该`ref`是否是存在于`v-for`指令中

## processSlotContent()——处理作为插槽内容插入的元素

该方法用于来处理那些作为插槽内容插入的元素，兼容2.6以下的版本，但不允许在同一个插槽混用两个版本的语法。

>不关注之前语法的同学，可以直接跳到代码分割线处

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
------------------------------------版本分割线----------------------------------
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

                    // 当已存在其他具名插槽时，默认插槽必须使用模版语法，即不能混用
                    // 解析插槽内容时，会先解析其中的模版，在解析组件，所以会出现下面这种情况
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

                // 因为中间新增了一层template元素，所以要将组件的子元素转移到template元素旗下
                slotContainer.children = el.children.filter((c: any) => {

                    // 这里要排除重复的v-slot使用，即子元素出现这种情况，这样就作用域混淆了
                    // <template v-slot="prop">
                    if (!c.slotScope) {

                        // 重新定义其父ast对象
                        c.parent = slotContainer;
                        return true;
                    }
                });

                // 设置当前组件的插槽作用域为当前插槽绑定的值
                slotContainer.slotScope = slotBinding.value || emptySlotScopeToken;

                // remove children as they are returned from scopedSlots now
                // 移除组件ast对象上的子节点数组，因为它们已经转义到作用域插槽对象中了
                // (这里也同时说明了，如果你混写了<template v-slot="prop">这种写法，那么这种写法会被直接移除)
                el.children = [];

                // mark el non-plain so data gets generated
                el.plain = false;
            }
        }
    }
}
```

这里我们只说明2.6及其以上的语法：
首先，`Vue`按`v-slot`属性定义的位置来对该属性进行处理：

1. 定义在`<template>`模版上：如果是定义在模版上，则`<template>`的位置必须位于组件内部，之后便对`slot`绑定的插槽名和`prop`属性进行字符串表达式提取
2. 直接定义在组件上时：不能与1中语法混用，然后会创建一个`<template>`元素来接替原组件的子节点数组，然后将该`<template>`元素挂载到该组件的`scopedSlots`中，然后重复1中的步骤。注意：如果你混用了1中语法，那么1中语法定义的所有子节点将被抛弃。

**无论定义在哪，都不能和旧语法混用**.

### 为什么组件后解析

这里其实不是组件后解析了，观察整个解析流程，我们可以知道，`processSlotContent()`的调用是在该元素闭合时，而`el.scopedSlots`属性的生成其实早在子元素调用`closeElement()`闭合时就已经在父元素中生成了，这之后才有`processSlotContent()`的调用，所以并不是组件后解析了。

## processSlotOutlet()——处理插槽位

该函数用于处理插槽位元素`<slot>`，获取其插槽的名称

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

## processElement()——处理元素上其余的属性

该方法分别按序处理了以下属性：

1. [`key`](#processkey%e5%a4%84%e7%90%86key%e5%b1%9e%e6%80%a7)
2. [`ref`](#processref%e5%a4%84%e7%90%86%e5%8a%a8%e6%80%81ref%e5%b1%9e%e6%80%a7)
3. [`slot`内容](#processslotcontent%e5%a4%84%e7%90%86%e4%bd%9c%e4%b8%ba%e6%8f%92%e6%a7%bd%e5%86%85%e5%ae%b9%e6%8f%92%e5%85%a5%e7%9a%84%e5%85%83%e7%b4%a0)
4. [`slot`元素](#processslotoutlet%e5%a4%84%e7%90%86%e6%8f%92%e6%a7%bd%e4%bd%8d)
5. [`component`上的属性](#processcomponent%e5%a4%84%e7%90%86%e7%bb%84%e4%bb%b6%e4%b8%8a%e7%9a%84%e4%b8%a4%e4%b8%aa%e7%8a%b6%e6%80%81%e5%b1%9e%e6%80%a7)
6. [`style/class`属性](../README.md##transformnode%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0class%e5%b1%9e%e6%80%a7)
7. [修饰符与`v-dir`属性](#processattrs%e5%a4%84%e7%90%86%e4%ba%8b%e4%bb%b6%e4%bf%ae%e9%a5%b0%e7%ac%a6%e4%b8%8e%e6%8c%87%e4%bb%a4)

```js
function processElement(
    element: ASTElement,
    options: CompilerOptions
) {

    // 初步处理key属性，返回其动态表达式
    processKey(element);

    // determine whether this is a plain element after
    // removing structural attributes
    // 检查其是否为一个简单元素，即处理完一些属性后还有属性剩余没有
    element.plain = (
        !element.key &&
        !element.scopedSlots &&
        !element.attrsList.length
    );

    // 处理动态ref属性
    processRef(element);

    // 处理元素中的插槽的内容
    processSlotContent(element);

    // 处理插槽元素
    processSlotOutlet(element);

    // 处理组件相关的属性
    processComponent(element);

    // 处理style和class属性，此处调用的是transformNode()方法
    for (let i = 0; i < transforms.length; i++) {
        element = transforms[i](element, options) || element;
    }

    // 处理剩余的处理事件修饰符与指令属性
    processAttrs(element);
    return element;
}
```

## processAttrs()——处理事件修饰符与指令

该函数用于处理`.`修饰符和`v-`指令

```js
// 匹配事件添加符
export const onRE = /^@|^v-on:/;

// 匹配指令前缀
export const dirRE = process.env.VBIND_PROP_SHORTHAND ?
    /^v-|^@|^:|^\./ :
    /^v-|^@|^:/;

// 匹配bind表达式
export const bindRE = /^:|^\.|^v-bind:/;

const propBindRE = /^\./;
const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g

function processAttrs(el) {

    // 处理剩下的属性
    const list = el.attrsList;
    let i, l, name, rawName, value, modifiers, syncGen, isDynamic;
    for (i = 0, l = list.length; i < l; i++) {
        name = rawName = list[i].name;
        value = list[i].value;

        // 属性名中书否包含vue指令语法
        if (dirRE.test(name)) {

            // mark element as dynamic
            // 标记元素为动态的
            el.hasBindings = true;

            // modifiers 解析其中的.修饰符，还会一个修饰符对象
            modifiers = parseModifiers(name.replace(dirRE, ''));

            // support .foo shorthand syntax for the .prop modifier
            // 支持.foo简写语法代替:foo.prop修饰符，用于在dom上绑定prop
            if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {
                (modifiers || (modifiers = {})).prop = true;

                // 提取绑定dom的属性名
                name = `.` + name.slice(1).replace(modifierRE, '');

            // 提取绑定属性的名称
            } else if (modifiers) {
                name = name.replace(modifierRE, '');
            }

            // 使用v-bind方式绑定时，三种形式v-bind/:/.
            if (bindRE.test(name)) { // v-bind

                // 取得绑定属性的名称
                name = name.replace(bindRE, '');

                // 解析过滤器，得出最后的字符串表达式
                value = parseFilters(value);

                // 是否为动态的属性名，是时重新提取变量名称
                isDynamic = dynamicArgRE.test(name);
                if (isDynamic) {
                    name = name.slice(1, -1);
                }
                if (
                    process.env.NODE_ENV !== 'production' &&
                    value.trim().length === 0
                ) {
                    warn(
                        `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
                    )
                }

                // 处理修饰符
                if (modifiers) {

                    // .prop修饰符时，解析属性名称
                    if (modifiers.prop && !isDynamic) {
                        name = camelize(name);

                        // 因为变量经过驼峰化，部分DOM属性要还原
                        if (name === 'innerHtml') {
                            name = 'innerHTML';
                        }
                    }

                    // 是否有camel修饰符，有时需要将-形式变量转化为驼峰式
                    if (modifiers.camel && !isDynamic) {
                        name = camelize(name);
                    }

                    // 当有sync修饰符时
                    if (modifiers.sync) {

                        // 返回sync绑定的值至$event的字符串表达式
                        // 比如          :b.sync="c", 即将c值绑定至$event
                        // 这个就是事件处理表达式
                        syncGen = genAssignmentCode(value, `$event`);

                        // 非动态绑定属性名时
                        if (!isDynamic) {

                            // 添加该事件至该ast元素对象并处理其修饰符，绑定的事件名为驼峰式
                            addHandler(
                                el,
                                `update:${camelize(name)}`,
                                syncGen,
                                null,
                                false,
                                warn,
                                list[i]
                            );

                            // 事件名称不平滑时，再添加个事件监听器
                            if (hyphenate(name) !== camelize(name)) {
                                addHandler(
                                    el,
                                    `update:${hyphenate(name)}`,
                                    syncGen,
                                    null,
                                    false,
                                    warn,
                                    list[i]
                                )
                            }
                        } else {
                            // handler w/ dynamic event name
                            // 添加动态的事件名
                            addHandler(
                                el,
                                `"update:"+(${name})`,
                                syncGen,
                                null,
                                false,
                                warn,
                                list[i],
                                true // dynamic
                            )
                        }
                    }
                }

                // 处理prop修饰符，没有该修饰符的部分dom元素的属性也必须添加prop属性
                if ((modifiers && modifiers.prop) || (
                        !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
                    )) {

                    // 特殊属性处理后添加至props
                    addProp(el, name, value, list[i], isDynamic)
                } else {

                    // 其他属性处理后添加至attrs数组
                    addAttr(el, name, value, list[i], isDynamic)
                }

            // 处理事件添加v-on
            } else if (onRE.test(name)) { // v-on
                name = name.replace(onRE, '')
                isDynamic = dynamicArgRE.test(name)
                if (isDynamic) {
                    name = name.slice(1, -1)
                }
                addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)

            // 处理元素上的指令
            } else { // normal directives

                // 假如这里有个如下指令v-focus:a.b.c="d"
                // 获取指令名称, v-focus:a
                name = name.replace(dirRE, '');

                // parse arg解析参数  匹配 [:a, a]
                const argMatch = name.match(argRE);
                let arg = argMatch && argMatch[1];
                isDynamic = false;
                if (arg) {

                    // 匹配指令名称，即v-focus
                    name = name.slice(0, -(arg.length + 1));

                    // 是否又是动态指令名称
                    if (dynamicArgRE.test(arg)) {
                        arg = arg.slice(1, -1)
                        isDynamic = true;
                    }
                }

                // 添加指令
                addDirective(el, name, rawName, value, arg, isDynamic, modifiers, list[i]);

                // 检查v-model绑定值是否是v-for中的元素别名上
                if (process.env.NODE_ENV !== 'production' && name === 'model') {
                    checkForAliasModel(el, value)
                }
            }

        // 其他字面属性，与vue无关的
        } else {
            // literal attribute
            if (process.env.NODE_ENV !== 'production') {
                const res = parseText(value, delimiters)
                if (res) {
                    warn(
                        `${name}="${value}": ` +
                        'Interpolation inside attributes has been removed. ' +
                        'Use v-bind or the colon shorthand instead. For example, ' +
                        'instead of <div id="{{ val }}">, use <div :id="val">.',
                        list[i]
                    )
                }
            }

            // 同上添加属性至ast元素
            addAttr(el, name, JSON.stringify(value), list[i]);
            // #6887 firefox doesn't update muted state if set via attribute
            // even immediately after element creation
            if (!el.component &&
                name === 'muted' &&
                platformMustUseProp(el.tag, el.attrsMap.type, name)) {
                addProp(el, name, 'true', list[i])
            }
        }
    }
}
```

该函数首先会检查属性是否为使用`vue`的指令语法，如`@`/`:`/`v-`/`.`，因为这些才支持修饰符。如果没有使用则说明是一个普通的属性而已。

### 指令处理

首先调用[`parseModifiers()`](../解析属性/README.md#parsemodifiers%e8%a7%a3%e6%9e%90%e4%bf%ae%e9%a5%b0%e7%ac%a6)解析修饰符，返回一个以修饰符名称作为字段的对象。在这之后解析了一下`.prop`修饰符，因为它比较特殊，它有两种写法：

```html
<div .name="某个属性">
<div :name.prop="某个属性">
```

第二种写法与其他修饰符解析的方式相同，所以只需要单独处理第一种写法即可。之后，再针对它们的绑定的具体的形式，划分为3种（这很好理解，修饰符是大家共同之处，可以一次性处理了）：

1. `:/v-bind`：[绑定`prop`属性](#%e5%a4%84%e7%90%86prop%e5%b1%9e%e6%80%a7)
2. `@/v-on`：[绑定事件](#%e5%a4%84%e7%90%86%e4%ba%8b%e4%bb%b6)
3. `v-`：[自定义指令](#v-%e5%a4%84%e7%90%86%e6%8c%87%e4%bb%a4)

#### :处理prop属性

处理模版上绑定的`prop`时，你懂的，当然是先取绑定的`prop`和`prop`绑定的值，对于绑定的值我们需要通过[`parseFilters()`](../解析属性/README.md#parsefilters%e8%a7%a3%e6%9e%90%e8%bf%87%e6%bb%a4%e5%99%a8)解析(说明绑定值支持过滤器`|`符号)，当然绑定的`prop`是支持动态的，解析一下是否为动态。

最后只差处理修饰符了

##### 变量修饰符处理

变量修饰符优先处理`.prop`与`.camel`修饰符，这两个修饰符在这里主要是对绑定的`prop`名称处理为驼峰形式(`.prop`中部分属性情况特殊)。

之后便是处理`.sync`修饰符，大家都应该知道该修饰符用于子组件反向修改父组件某个属性。那么首先呢，它使用[`genAssignmentCode()`](../其他属性处理方法/README.md#genassignmentcode%e5%b0%86%e5%8f%98%e9%87%8f%e4%b8%8eevent%e7%bb%91%e5%ae%9a)方法将`prop`绑定的值绑定至`$event`对象上，最后一步当然就是绑定自定义事件了，通过`.sync`修饰符绑定的事件，都是`update:name`事件(而且该事件不接受其他修饰符)。无论绑定的`prop`是否为动态值，它们都是通过[`addHandler()`](../添加属性/README.md#addhandler%e6%b7%bb%e5%8a%a0%e4%ba%8b%e4%bb%b6)来进行事件的绑定。

>这里比较有意思的是，如果我们是绑定非动态变量，那么这个变量如果不是只要是**驼峰式**或**连字符分隔式**的，那么会添加两个相同的自定义事件(名称不同)，多添加的为`-`式的，这样我们可以通过任意方式来触发这个事件。

之后就是针对`.prop`修饰符进行处理，部分元素即使不添加该修饰符，但出于其特性，也会自动添加一个；然后根据这些属性属于`property`(DOM的特性)还是`attribute`(写在HTML里面的属性)，将其分别处理后添加至元素`ast`对象的`props`或`attrs`数组中
____

#### @处理事件

这个比较简单，我直接代码扣下来看注释解释：

```js
// 事件名
    name = name.replace(onRE, '');

    // 是否为动态事件名
    isDynamic = dynamicArgRE.test(name);
    if (isDynamic) {
        name = name.slice(1, -1);
    }

    // 添加该事件
    addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)
```

忘记了再去看看[`addHandler()`](../添加属性/README.md#addhandler%e6%b7%bb%e5%8a%a0%e4%ba%8b%e4%bb%b6)

#### v-处理指令

这里貌似没有做什么处理，只是将指令参数解析出来，例如`v-f:a.b.c`就解析`name`为`v-f`，参数为`a`，然后生成一个指令对象，添加至`ast`对象上。

### 普通属性处理

对于普通的属性，首先会通过[`parseText()`](#parsetext%e8%a7%a3%e6%9e%90%e6%96%87%e6%9c%ac)检查用户是否使用插值表达式来绑定变量，因为该语法已经废弃，所以要报错。

一般情况下，将这些属性加入`ast`元素对象的`attrs`中就行了，但有些要添加至特性中。

## processPre()——处理v-pre属性

该函数用于处理元素上的`v-pre`属性，并将在该元素上标记一个`pre`属性

```js
function processPre(el) {

    // 移除ast元素对象上的attrsList
    if (getAndRemoveAttr(el, 'v-pre') != null) {

        // 添加标记位
        el.pre = true
    }
}
```

## processRawAttrs()——直接标记未处理属性为已处理

该方法用于处理那些未处理的属性，不做处理直接添加到最终的`attrs`(属性)中

```js
function processRawAttrs(el) {
    const list = el.attrsList;
    const len = list.length;
    if (len) {

        // 直接将元素属性挂载至attrs(属性)上
        const attrs: Array < ASTAttr > = el.attrs = new Array(len)
        for (let i = 0; i < len; i++) {
            attrs[i] = {
                name: list[i].name,
                value: JSON.stringify(list[i].value)
            };

            if (list[i].start != null) {
                attrs[i].start = list[i].start
                attrs[i].end = list[i].end
            }
        }

    // 该元素未有任何其他属性时
    } else if (!el.pre) {

        // non root node in pre blocks with no attributes
        el.plain = true;
    }
}
```

## processIf()——处理元素v-if/v-else/v-else-if属性

该方法用于处理元素上的显示条件指令

```js
function processIf(el) {

    // 删除未处理属性中的v-if，返回起字符串表达式
    const exp = getAndRemoveAttr(el, 'v-if')
    if (exp) {
        el.if = exp;

        // 为元素添加一个if条件属性队列，并将该条件添加
        addIfCondition(el, {
            exp: exp,
            block: el
        });

    // 没有if时处理else情况和else-if的情况
    } else {
        if (getAndRemoveAttr(el, 'v-else') != null) {
            el.else = true;
        }
        const elseif = getAndRemoveAttr(el, 'v-else-if')
        if (elseif) {
            el.elseif = elseif
        }
    }
}
```

## processOnce()——处理v-once属性

简单处理，然后添加标记位

```js
function processOnce(el) {
    const once = getAndRemoveAttr(el, 'v-once');
    if (once != null) {
        el.once = true
    }
}
```

## processIfConditions()——添加else/else-if条件语句块

该函数用于处理`v-else/v-else-if`两个语法的元素，将它们添加至前一个`v-if`元素的添加判断数组中。

```js
function processIfConditions(el, parent) {

    // 找到上一个元素节点
    const prev = findPrevElement(parent.children);

    // 前一个元素存在v-if则将该元素添加至其if条件判断数组中
    if (prev && prev.if) {
        addIfCondition(prev, {
            exp: el.elseif,
            block: el
        });

    // 否则报错，你用了v-else/v-else-if却没有对应v-if元素对应
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
            `used on element <${el.tag}> without corresponding v-if.`,
            el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
        );
    }
}
```

### findPrevElement()——找到该的前一个元素节点

该函数用于寻找上一个元素节点，期间所有文本节点会被直接丢弃

```js
// 找到当前元素的前一个节点，前一个节点必须为元素，否则报错
function findPrevElement(children: Array < any > ) : ASTElement | void {
    let i = children.length;
    while (i--) {

        // 找到元素类型的节点
        if (children[i].type === 1) {
            return children[i]
        } else {

            // 前一个节点非元素节点时且不为空时，报错
            if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
                warn(
                    `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
                    `will be ignored.`,
                    children[i]
                )
            }

            // 该节点被丢弃
            children.pop()
        }
    }
}
```
