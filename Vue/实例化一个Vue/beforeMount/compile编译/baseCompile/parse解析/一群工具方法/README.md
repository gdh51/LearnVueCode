# 一群工具方法

一些Vue中的工具方法，比较长的化我就单独提出来放这里了，按需点击目录跳转

- [处理属性——process()](./处理属性)
- [获取属性——getAttr()](./获取属性)
- [解析属性——parse()](./解析属性)
- [添加属性——addAttr()](./添加属性)

下面为几个处理函数，

## transform——属性处理函数

Vue中有3个这种函数用于处理ast元素对象的属性

分别为：

- [preTransformNode()——处理双向绑定的input元素](#pretransformnode%e5%a4%84%e7%90%86%e5%8f%8c%e5%90%91%e7%bb%91%e5%ae%9a%e7%9a%84input%e5%85%83%e7%b4%a0)
- [transformNode()——处理元素class属性](#transformnode%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0class%e5%b1%9e%e6%80%a7)
- [transformNode()——处理元素内联style属性](#transformnode%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0%e5%86%85%e8%81%94style%e5%b1%9e%e6%80%a7)

### preTransformNode()——处理双向绑定的input元素

该方法用于专门对使用`v-model`的`input`元素做单独的预处理。

```js
function preTransformNode(el: ASTElement, options: CompilerOptions) {

    // 抱歉，只针对input元素
    if (el.tag === 'input') {
        const map = el.attrsMap;

        // 未定义v-model属性或定义但未定义值时，不做处理
        if (!map['v-model']) {
            return;
        }

        // 动态绑定的type属性值的字符串表达式
        let typeBinding;

        // 绑定动态的type属性时, 获取其动态type表达式的字符串
        if (map[':type'] || map['v-bind:type']) {

            // 这里虽然可以获取静态的type值，但进入这里的条件是需要动态type值的
            typeBinding = getBindingAttr(el, 'type');
        }

        // 未通过任何形式定义type属性时，会从v-bind绑定的对象中取
        if (!map.type && !typeBinding && map['v-bind']) {
            typeBinding = `(${map['v-bind']}).type`;
        }

        // 具有动态绑定的type
        if (typeBinding) {

            // 获取AST元素上v-if值，移除其在attrList与attrMap上的值
            const ifCondition = getAndRemoveAttr(el, 'v-if', true);

            // 存在则包装为&&(value)
            const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``;

            // 是否定义v-else
            const hasElse = getAndRemoveAttr(el, 'v-else', true) != null;

            // 取出else-if的条件表达式
            const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true);

            // 1. checkbox
            const branch0 = cloneASTElement(el);

            // process for on the main node
            // 处理v-for属性，将结果挂载在ast元素对象上
            processFor(branch0);

            // 添加一个静态type属性至这个新建的ast元素
            addRawAttr(branch0, 'type', 'checkbox');

            // 处理该元素上的其他属性，比如动态属性，指令还有普通的属性
            processElement(branch0, options);

            // 标记该AST对象为已处理, 防止二次处理
            branch0.processed = true; // prevent it from double-processed

            // 添加该元素显示的条件
            branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
            addIfCondition(branch0, {
                exp: branch0.if,
                block: branch0
            });

            // 其余两个一样
            // 2. add radio else-if condition
            const branch1 = cloneASTElement(el)
            getAndRemoveAttr(branch1, 'v-for', true)
            addRawAttr(branch1, 'type', 'radio')
            processElement(branch1, options)
            addIfCondition(branch0, {
                exp: `(${typeBinding})==='radio'` + ifConditionExtra,
                block: branch1
            })
            // 3. other
            const branch2 = cloneASTElement(el)
            getAndRemoveAttr(branch2, 'v-for', true)
            addRawAttr(branch2, ':type', typeBinding)
            processElement(branch2, options)
            addIfCondition(branch0, {
                exp: ifCondition,
                block: branch2
            })

            // 对checkbox元素添加else/else-if条件
            if (hasElse) {
                branch0.else = true
            } else if (elseIfCondition) {
                branch0.elseif = elseIfCondition
            }

            return branch0
        }
    }
}
```

被处理的`input`元素必须要具有`v-model`属性且必须绑定一个动态的`type`属性，或绑定一个动态的对象，对象中存在`type`这个属性。

不满足上述条件时，不做处理，之后便是对三个处理元素显示情况的元素做处理，分别为`v-if`、`v-else`、`v-else-if`，每处理一个属性都会删除对应`ast`元素对象`attrList`(未处理属性数组)上的对应属性的值，这里还会删除它们在`attrMap`上的值。

___
之后因为`input`为一元元素，所以要对其进行闭合，而针对它的`type`属性，闭合要分为三种情况：

1. `checkbox`
2. `radio`
3. `other`

但是当闭合一个元素时，都是一样的方式，之后的属性处理也大致一样——调用`cloneASTElement()`创建闭合元素的ast对象：

```js
function cloneASTElement(el) {

    // 创建一个具有剩余属性的相同ast元素对象
    return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}
```

>上面需要注意的是`slice()`方法，这说明了几个分支type拥有的属性是一样的，但维护的不是一个队列。(不懂我在说什么就无视)

之后变身调用[`processFor()`](./处理属性/README.md#processfor%e5%a4%84%e7%90%86v-for%e8%a1%a8%e8%be%be%e5%bc%8f)处理其`v-for`属性

___
闭合完毕后，接下来便是处理[v-for](../一群工具方法/处理属性/README.md)属性，之后调用[`addRawAttr()`](./添加属性/README.md#addrawattr%e6%b7%bb%e5%8a%a0%e5%8e%9f%e5%a7%8b%e5%b1%9e%e6%80%a7)添加一个未处理的`type`属性至这个新建的`input`元素上，最后调用[`processElement()`](./处理属性/README.md#processelement%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0%e4%b8%8a%e5%85%b6%e4%bd%99%e7%9a%84%e5%b1%9e%e6%80%a7)处理其余的属性。
___

处理完后，使用`process`标记该元素已初步处理完毕，最后重写`v-if`的判断条件，加入元素的`type`类型。

待三个类型都处理完后，返回第一个分支，**注意这里，貌似其他的两个分支都废弃了，其实它们的联系已经建立在if条件对象数组中了**。

### transformNode()——处理元素class属性

该函数用于处理元素的`class`属性的动态值与静态值，其中[`parseText()`](./解析属性/README.md#parsetext%e8%a7%a3%e6%9e%90%e6%96%87%e6%9c%ac)用来将`class`表达式解析为`token`(这其实是兼容以前的写法，现在用`v-bind`代替了动态值写法了)

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
其中关于[`parseStyleText()`](./解析属性/README.md#parsestyletext%e8%a7%a3%e6%9e%90%e9%9d%99%e6%80%81style%e5%ad%97%e7%ac%a6%e4%b8%b2)信息在上方

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