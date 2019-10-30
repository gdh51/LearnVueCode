# 一群工具方法

一些Vue中的工具方法，比较长的化我就单独提出来放这里了，按需点击目录跳转

## getAttr()——获取属性

Vue中有三个方法来获取ast元素对象中的属性

### getBindingAttr()——获取bind属性

刚方法用于获取动态或静态的`name`的值字符串表达式（即`:`或`v-bind`），同时会调用`getAndRemoveAttr()`方法删除该`name`值在`AST.attrsList`中的值，注意第三个参数，唯有指明传入`false`时，才不查找静态值。

```js
function getBindingAttr(
    el: ASTElement,
    name: string,

    // 未找到动态绑定值时，是否查找静态的该值（唯有传入false时，才不找）
    getStatic ? : boolean
): ? string {

    // 移除ast对象中attrslist中的对应属性，并返回对应动态绑定属性的值
    const dynamicValue =
        getAndRemoveAttr(el, ':' + name) ||
        getAndRemoveAttr(el, 'v-bind:' + name);

    if (dynamicValue != null) {

        // 获取该对象值的函数表达式字符串
        return parseFilters(dynamicValue);

    // 未找到该动态绑定的属性时，是否查找该值的静态属性(注意这里是个全等)
    } else if (getStatic !== false) {
        const staticValue = getAndRemoveAttr(el, name);

        // 找到时，返回该对象值的JSON字符串
        if (staticValue != null) {
            return JSON.stringify(staticValue);
        }
    }
}
```

### getAndRemoveAttr()——用于移除AST对象中attrsList和attrsMap对应属性

该方法用于移除`ast`对象中给定属性，指定`removeFromMap`属性时，还会移除`attrsMap`中的该属性。返回被移除的属性的值。

```js
function getAndRemoveAttr(
    el: ASTElement,
    name: string,
    removeFromMap ? : boolean
) : ? string {
    let val;

    // 确保map中存在该属性或有值(空字符串也行)
    if ((val = el.attrsMap[name]) != null) {
        const list = el.attrsList;

        // 移除attrsList中的该名称属性
        for (let i = 0, l = list.length; i < l; i++) {
            if (list[i].name === name) {
                list.splice(i, 1)
                break
            }
        }
    }

    // 是否移除map中的该属性
    if (removeFromMap) {
        delete el.attrsMap[name];
    }

    // 返回该属性的值
    return val;
}
```

### getRawBindingAttr()——获取未处理属性的对象信息

该函数用于从`rawAttrsMap`中获取指定`name`的未处理属性的对象信息

```js
function getRawBindingAttr(
    el: ASTElement,
    name: string
) {
    return el.rawAttrsMap[':' + name] ||
        el.rawAttrsMap['v-bind:' + name] ||
        el.rawAttrsMap[name]
}
```

### getAndRemoveAttrByRegex——通过正则表达式获取未处理属性

指定一个正则表达式，获取未处理属性数组中的与该正则表达式匹配的值

```js
function getAndRemoveAttrByRegex(
    el: ASTElement,
    name: RegExp
) {
    // 剩余未处理的属性数组
    const list = el.attrsList;
    for (let i = 0, l = list.length; i < l; i++) {
        const attr = list[i];

        // 找到匹配正则表达式的属性，返回关于该属性的对象
        if (name.test(attr.name)) {
            list.splice(i, 1);
            return attr;
        }
    }
}
```

## parse——解析函数

### parseFilters()——解析过滤器

该函数用于解析模版字符串中的过滤器表达式，还是遵循从左到右对字符串进行解析，在解析的过程中，会匹配符号，但凡符号不能成对匹配，就会出错，当然这只是初步匹配，如果你要专空子，那也是可以匹配成功的；具体匹配如下：

```js
const validDivisionCharRE = /[\w).+\-_$\]]/;

function parseFilters(exp: string): string {

    // 是否在单引号中
    let inSingle = false;

    // 是否在双引号中
    let inDouble = false;

    // 模版字符串
    let inTemplateString = false;

    // 正则表达式
    let inRegex = false;

    // 特殊括号的栈
    let curly = 0;
    let square = 0;
    let paren = 0;

    // 上一个管道符的后一个字符的位置
    let lastFilterIndex = 0;
    let c, prev, i, expression, filters;

    for (i = 0; i < exp.length; i++) {

        // 上一个字符的ascii🐎
        prev = c;

        // 当前字符的ascii🐎
        c = exp.charCodeAt(i);

        // 留个问题，这里为什么要用十六进制
        // 为什么有些JS和CSS里面的中文字符要转成十六进制的？

        if (inSingle) {

            // c为 , prev 不为 \
            if (c === 0x27 && prev !== 0x5C) inSingle = false;
        } else if (inDouble) {

            // c 为 " ,prev 不为 \
            if (c === 0x22 && prev !== 0x5C) inDouble = false;
        } else if (inTemplateString) {

            // c 为 `,prev不为\
            if (c === 0x60 && prev !== 0x5C) inTemplateString = false;
        } else if (inRegex) {

            // c 为 / ,prev不为\
            if (c === 0x2f && prev !== 0x5C) inRegex = false;
        } else if (

            // c为 |(管道符), 而c前后的字符不为管道符，且无任何括号符号时
            c === 0x7C && // pipe
            exp.charCodeAt(i + 1) !== 0x7C &&
            exp.charCodeAt(i - 1) !== 0x7C &&
            !curly && !square && !paren
        ) {
            // 第一次遇到|时，创建新的管道符表达式
            if (expression === undefined) {

                // first filter, end of expression
                // 最后一个管道符号的位置的后一个符号
                lastFilterIndex = i + 1;

                // 截取管道符左侧的表达式
                expression = exp.slice(0, i).trim()
            } else {

                // 已存在时, 更新lastFilterIndex，然后将新的表达式加入队列中
                pushFilter()
            }
        } else {

            // 处理其他情况
            switch (c) {
                case 0x22:
                    inDouble = true;
                    break // "
                case 0x27:
                    inSingle = true;
                    break // '
                case 0x60:
                    inTemplateString = true;
                    break // `
                case 0x28:
                    paren++;
                    break // (
                case 0x29:
                    paren--;
                    break // )
                case 0x5B:
                    square++;
                    break // [
                case 0x5D:
                    square--;
                    break // ]
                case 0x7B:
                    curly++;
                    break // {
                case 0x7D:
                    curly--;
                    break // }
            }

            if (c === 0x2f) { // /
                let j = i - 1;
                let p;

                // find first non-whitespace prev char
                // 找到前面第一个非空格字符
                for (; j >= 0; j--) {
                    p = exp.charAt(j);
                    if (p !== ' ') break
                }

                // 未找到p或不匹配任何字符符号时
                if (!p || !validDivisionCharRE.test(p)) {

                    // 正则表达式
                    inRegex = true;
                }
            }
        }
    }

    // 未有表达式时，则整个字符串就是表达式
    if (expression === undefined) {
        expression = exp.slice(0, i).trim();

    // 之前有表达式，所以最后还要截取下最后的表达式
    } else if (lastFilterIndex !== 0) {
        pushFilter()
    }

    function pushFilter() {

        // 取当上一个管道符到现在管道符直接的表达式
        (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim());
        lastFilterIndex = i + 1;
    }

    // 多个表达式时，逐个包装表达式
    if (filters) {
        for (i = 0; i < filters.length; i++) {
            expression = wrapFilter(expression, filters[i])
        }
    }

    // 最后结果为 _fn("fnName")(arguments)
    return expression;
}

function wrapFilter(exp: string, filter: string): string {
    const i = filter.indexOf('(');

    // 存入表达式不存在()时，直接包装返回
    if (i < 0) {
        // _f: resolveFilter
        return `_f("${filter}")(${exp})`

    // 存入表达式存在()，即也是个函数调用时
    } else {

        // 函数名
        const name = filter.slice(0, i);

        // 函数有参数时，为 arg) 没有时就为 )
        const args = filter.slice(i + 1);

        // 将exp作为参数拼接在后面
        return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
    }
}
```

从上面我们可以看出匹配时，对于括号会进行计数，唯有前后括号抵消后，才能算一个匹配合格的匹配项；如果没有`|`符号在表达式中，那么只会算一个表达式；如果出现`|`符号，那么每个`|`符号左右都会为一个匹配项，但凡出现`|`符号，就会用`_f()`函数进行包装。

举个例子：
```js
// 转换前                        转换后
'acscsa'                =>          'absdsad'

// 转换前                              转换后
'a|fn1(arg1)|b|fn2(arg2)'  =>     '_f("fn2")(arg2)'
```

由之前的代码可以知道，`expression`为`a`，然后按`filters`数组顺序`[fn1(arg1), b, fn2(arg2)]`处理分别为`_f("fn1")(a,arg1)` => `_f("b")(_f("fn1")(a,arg1))` => `_f("fn2")(_f("b")(_f("fn1")(a,arg1)),arg2)`。

### parseText()——解析文本

该函数用于将一串包含插值表达式的字符串解析为一个词元对象(`tokens`)

>首先它使用正则表达式从字符串的头开始匹配，分别使用两个指针，一个表示当前匹配到的插值表达式的起始位置(`index`)，另一个表示上一次匹配到的插值表达式的位置(`lastIndex`)。

每次匹配到插值表达式时，会截取匹配到的值，然后更新`lastIndex`；如果在一次匹配中 `index > lastIndex` 就说明在这两个匹配项之间还存在普通的字符串，就先截取这些普通的字符串在存放现在这个匹配项的值；在匹配结束后，如果`index`与`lastIndex`不等，则又说明最后次匹配后，后面存在普通的字符串，还要做一次截取操作。

```js
// 默认插值表达式为{{}}
const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;

const buildRegex = cached(delimiters => {

    // $&表示与正则表达式相匹配的子串
    // 所以这里的意思就是给我们自定义的符号加上\转移符
    const open = delimiters[0].replace(regexEscapeRE, '\\$&')
    const close = delimiters[1].replace(regexEscapeRE, '\\$&')
    return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
});

function parseText(
    text: string,
    delimiters ? : [string, string]
): TextParseResult | void {

    // 根据用户是否自定义插入符来获取插值表达式的正则表达式
    const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE;

    // 没有关于插值表达式的内容，则不用解析直接返回
    if (!tagRE.test(text)) {
        return
    }
    const tokens = [];
    const rawTokens = [];

    // 上次匹配到的位置
    let lastIndex = tagRE.lastIndex = 0;
    let match, index, tokenValue;
    while ((match = tagRE.exec(text))) {

        // 当前匹配的插值表达式的起始位置
        index = match.index;

        /**
         * push text token
         * 如果当前下标大于上个匹配位下标， 说明中间有字符不匹配， 是普通的字符串，
         * 那么将这些字符串加入tokens中
         */
        if (index > lastIndex) {
            rawTokens.push(tokenValue = text.slice(lastIndex, index))
            tokens.push(JSON.stringify(tokenValue))
        }

        // tag token
        // 解析插值括号中的字符串表达式，存放至token中
        const exp = parseFilters(match[1].trim());
        tokens.push(`_s(${exp})`);
        rawTokens.push({
            '@binding': exp
        });

        // 跟随正则表达式，更新lastIndex位置为当前匹配到的字符串的之后的位置
        lastIndex = index + match[0].length
    }

    // 如果匹配结束后，上次匹配到的地方不是字符串最后，
    // 则说明后面还有一部分是普通的字符串，那么要将它们存入tokens中
    if (lastIndex < text.length) {
        rawTokens.push(tokenValue = text.slice(lastIndex))
        tokens.push(JSON.stringify(tokenValue))
    }

    // 返回解析结果
    return {
        expression: tokens.join('+'),
        tokens: rawTokens
    }
}
```

### parseStyleText()——解析静态style字符串

该函数将静态内联`style`字符串解析为对象键值对形式

```js
const parseStyleText = cached(function (cssText) {
    const res = {};

    // 匹配;但后面最近的地方不能单独出现未闭合的)，举个例子;())匹配成功，但;)不行
    // 不匹配 ; xxx) ，但匹配; (xxxxxx)
    const listDelimiter = /;(?![^(]*\))/g;

    // 匹配属性值  即 : xxx ，$1 中存放匹配到的属性值
    const propertyDelimiter = /:(.+)/;
    cssText.split(listDelimiter).forEach(function (item) {
        if (item) {
            const tmp = item.split(propertyDelimiter)

            // 按键值方式存放至res对象中
            tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim());
        }
    })
    return res;
});
```

## Process()——处理属性的集合

`process`函数用于处理某个属性，然后返回某个属性的对象表达式，针对不同属性，有单独的`process`函数。

### processFor()——处理v-for表达式

处理v-for的字符串表达式，返回一个对象，对象包含其具体的位置的变量：

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

function parseFor(exp: string): ? ForParseResult {

    // 以下会以一个例子举例解释，当然最好的方式还是自己debugger
    // 匹配 v-for中的两个别名  如   (val, index) in values
    const inMatch = exp.match(forAliasRE);
    if (!inMatch) return;
    const res = {};

    // 匹配数据来源   匹配values
    res.for = inMatch[2].trim();

    // 匹配用户定义的单个值  匹配 val,index
    const alias = inMatch[1].trim().replace(stripParensRE, '');

    // 匹配 ,index
    const iteratorMatch = alias.match(forIteratorRE);
    if (iteratorMatch) {

        // 匹配第一个值 val
        res.alias = alias.replace(forIteratorRE, '').trim();

        // 匹配第二个值 index
        res.iterator1 = iteratorMatch[1].trim();

        // 如果还有第三个值是，存放第三个值
        if (iteratorMatch[2]) {
            res.iterator2 = iteratorMatch[2].trim()
        }

    // 仅一个值情况，即 val in values  这种情况
    } else {
        res.alias = alias;
    }
    return res;
}
```

### processKey()——处理key属性

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

### processRef()——处理动态ref属性

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

### processSlotContent()——处理作为插槽内容插入的元素

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

### processSlotOutlet()——处理插槽位

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

### processComponent()——处理组件上的两个状态属性

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

## addAttr()——添加属性

Vue中有两个方法用于添加属性，一种是添加的未处理的原始属性，另一种是添加的已处理的。

### addRawAttr()——添加原始属性

该函数用于向一个`AST`元素对象添加一个未经处理的新属性，其属性会添加到`attrsList`与`attrsMap`上，还可以设置范围：

```js
// add a raw attr (use this in preTransforms)
// 添加一个未处理的属性(仅在preTransforms)中使用
function addRawAttr(el: ASTElement, name: string, value: any, range ? : Range) {
    el.attrsMap[name] = value;

    // 设置属性的范围(在这个地方未指定range时就没有)
    el.attrsList.push(rangeSetItem({
        name,
        value
    }, range))
}

function rangeSetItem(
    item: any,
    range ? : {
        start ? : number,
        end ? : number
    }
) {
    // 设置range属性，未指定时取用item中的该值
    if (range) {
        if (range.start != null) {
            item.start = range.start
        }
        if (range.end != null) {
            item.end = range.end
        }
    }
    return item;
}
```

### addAttr()——添加已处理属性

该函数也用于为ast元素对象添加一个元素，不同于addRawAttr的地方是，它添加的属性是经过处理的，且它添加属性的位置是新建的。

```js
function addAttr(el: ASTElement, name: string, value: any, range ? : Range, dynamic ? : boolean) {

    // 是否添加至动态数组(添加的属性的位置都是新增的)
    const attrs = dynamic ?
        (el.dynamicAttrs || (el.dynamicAttrs = [])) :
        (el.attrs || (el.attrs = []));
    attrs.push(rangeSetItem({
        name,
        value,
        dynamic
    }, range));

    // 更改元素扁平化属性
    el.plain = false
}
```

## transform——属性处理函数

Vue中有4个这种函数用于处理ast元素对象的属性

分别为：

- preTransformNode
- [transformNode(class)](#transformnode%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0class%e5%b1%9e%e6%80%a7)
- [transformNode(style)](#transformnode%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0%e5%86%85%e8%81%94style%e5%b1%9e%e6%80%a7)

### transformNode()——处理元素class属性

该函数用于处理元素的`class`属性的动态值与静态值，其中[`parseText()`](#parsetext%e8%a7%a3%e6%9e%90%e6%96%87%e6%9c%ac)用来将`class`表达式解析为`token`(这其实是兼容以前的写法，现在用`v-bind`代替了动态值写法了)

```js
function transformNode(el: ASTElement, options: CompilerOptions) {
    const warn = options.warn || baseWarn;

    // 提取静态的class属性
    const staticClass = getAndRemoveAttr(el, 'class');
    if (process.env.NODE_ENV !== 'production' && staticClass) {

        // 返回普通字符串(包含插值表达式)的解析结果(解析为token)
        const res = parseText(staticClass, options.delimiters);

        // 报错，静止在非v-bind中插入动态值
        if (res) {
            warn(
                `class="${staticClass}": ` +
                'Interpolation inside attributes has been removed. ' +
                'Use v-bind or the colon shorthand instead. For example, ' +
                'instead of <div class="{{ val }}">, use <div :class="val">.',
                el.rawAttrsMap['class']
            )
        }
    }

    // 直接将class值存放至静态class
    if (staticClass) {
        el.staticClass = JSON.stringify(staticClass)
    }

    // 获取class动态值，并存放至classBinding
    const classBinding = getBindingAttr(el, 'class', false /* getStatic */ )
    if (classBinding) {
        el.classBinding = classBinding;
    }
}
```

### transformNode()——处理元素内联style属性

该函数用于处理元素的内联`style`属性的动态值与静态值，
其中关于[`parseStyleText()`](#parsestyletext%e8%a7%a3%e6%9e%90%e9%9d%99%e6%80%81style%e5%ad%97%e7%ac%a6%e4%b8%b2)信息在上方

```js
function transformNode(el: ASTElement, options: CompilerOptions) {
    const warn = options.warn || baseWarn
    const staticStyle = getAndRemoveAttr(el, 'style');
    if (staticStyle) {

        // 检测是否在静态style属性中使用插值表达式语法，有就报错
        if (process.env.NODE_ENV !== 'production') {
            const res = parseText(staticStyle, options.delimiters)
            if (res) {
                warn(
                    `style="${staticStyle}": ` +
                    'Interpolation inside attributes has been removed. ' +
                    'Use v-bind or the colon shorthand instead. For example, ' +
                    'instead of <div style="{{ val }}">, use <div :style="val">.',
                    el.rawAttrsMap['style']
                )
            }
        }

        // 将style字符串对象形式的键值对转换为JSON字符串后挂载在staticStyle上
        el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
    }

    // 绑定动态值
    const styleBinding = getBindingAttr(el, 'style', false /* getStatic */ )
    if (styleBinding) {
        el.styleBinding = styleBinding
    }
}
```