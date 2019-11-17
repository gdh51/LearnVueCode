# 处理双向绑定v-model

`Vue`通过`model()`函数来处理各种元素的`v-model`绑定语法，待会我们可以知道其针对以下情况分别进行了运行时编译代码的生成：

- [组件、非原生标签](#%e7%bb%84%e4%bb%b6%e9%9d%9e%e5%8e%9f%e7%94%9f%e6%a0%87%e7%ad%begencomponentmodel)
- [复选框`<select>`](#%e5%a4%8d%e9%80%89%e6%8c%89%e9%92%aecheckboxgencheckboxmodel)
- [单选按钮`radio`](#%e5%8d%95%e9%80%89%e6%8c%89%e9%92%aeradiogenradiomodel)
- [复选按钮`checkbox`](#%e5%a4%8d%e9%80%89%e6%8c%89%e9%92%aecheckboxgencheckboxmodel)
- [文本输入框`<input type="text">`、`<textarea>`](#%e6%96%87%e6%9c%ac%e8%be%93%e5%85%a5%e6%a1%86gendefaultmodel)

```js
function model(
    el: ASTElement,
    dir: ASTDirective,
    _warn: Function
): ? boolean {
    warn = _warn;
    const value = dir.value;
    const modifiers = dir.modifiers;
    const tag = el.tag;

    // 取出双向绑定的类型
    const type = el.attrsMap.type;

    // 禁止设置file类型的input元素
    if (process.env.NODE_ENV !== 'production') {
        // inputs with type="file" are read only and setting the input's
        // value will throw an error.
        if (tag === 'input' && type === 'file') {
            warn(
                `<${el.tag} v-model="${value}" type="file">:\n` +
                `File inputs are read only. Use a v-on:change listener instead.`,
                el.rawAttrsMap['v-model']
            )
        }
    }

    // 针对组件的双向绑定
    if (el.component) {
        genComponentModel(el, value, modifiers)

        // component v-model doesn't need extra runtime
        // 组件的v-model不需要运行时编译
        return false;
    } else if (tag === 'select') {
        genSelect(el, value, modifiers)
    } else if (tag === 'input' && type === 'checkbox') {
        genCheckboxModel(el, value, modifiers)
    } else if (tag === 'input' && type === 'radio') {
        genRadioModel(el, value, modifiers)
    } else if (tag === 'input' || tag === 'textarea') {
        genDefaultModel(el, value, modifiers)

    // 其他自定义标签视为组件
    } else if (!config.isReservedTag(tag)) {
        genComponentModel(el, value, modifiers)

        // component v-model doesn't need extra runtime
        return false;
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `<${el.tag} v-model="${value}">: ` +
            `v-model is not supported on this element type. ` +
            'If you are working with contenteditable, it\'s recommended to ' +
            'wrap a library dedicated for that purpose inside a custom component.',
            el.rawAttrsMap['v-model']
        );
    }

    // ensure runtime directive metadata
    // 确保运行时的指令数据
    return true;
}
```

对于修饰符的处理，大家都一样，对于`.trim`修饰符就调用`.trim()`方法，对于`.number`修饰符就调用`_n()`方法。

从上面的代码可以看出，其首先命令禁止了在`<input type="file">`的元素上使用`v-model`，之后就是针对不同情况进行的处理：

## 组件、非原生标签——genComponentModel()

通过该函数处理了组件、非原生标签上的`v-model`属性，对其的`.number`与`.trim`修饰符也进行了处理：

```js
function genComponentModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
): ? boolean {

    // 提取上面的修饰符
    const {
        number,
        trim
    } = modifiers || {};

    const baseValueExpression = '$$v';
    let valueExpression = baseValueExpression;

    // 如果有trim修饰符则需对用户输入字符串值进行首尾去空格处理
    if (trim) {
        valueExpression =
            `(typeof ${baseValueExpression} === 'string'` +
            `? ${baseValueExpression}.trim()` +
            `: ${baseValueExpression})`
    }

    // 如果具有.number修饰符则需要将值转换为数字
    if (number) {
        valueExpression = `_n(${valueExpression})`
    }

    // 生成赋值表达式
    const assignment = genAssignmentCode(value, valueExpression);

    // 返回处理的model对象
    el.model = {
        value: `(${value})`,
        expression: JSON.stringify(value),
        callback: `function (${baseValueExpression}) {${assignment}}`
    };
}
```

通过该函数我们知道它并没有返回一个运行时编译字符串，而是返回了一个相关的对象。对于`.trim`的处理结果其生成了这样一个表达式`(typeof $$v === 'string'? $$v.trim(): $$v)`；而`.number`的处理结果为`_n($$v)`(这里如果之前处理过`.trim`则再其结果基础上调用该函数)。最后通过[`genAssignmentCode()`](../../../../parse解析/一群工具方法/其他属性处理方法/README.md#genassignmentcode%e5%b0%86%e5%8f%98%e9%87%8f%e8%b5%8b%e5%80%bc%e7%bb%99%e5%8f%a6%e4%b8%80%e4%b8%aa%e5%8f%98%e9%87%8f)将`$$v`的处理结果赋值给我们使用`v-model`时定义的变量。

>这里的组件以`<child v-model.trim.number='propA'>`为例

如果以上例为例则结果为：

```js
el.model = {
    value: `(propA)`,
    expression: 'propA',
    callback: `function ($$v) { propA = _n((typeof $$v === 'string'? $$v.trim(): $$v))}`
}
```

## 复选框select——genSelect()

该函数用于生成运行时编译表达式，大致含义是返回被选中的`<option>`元素的值

```js
function genSelect(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) {

    // 取出.number修饰符
    const number = modifiers && modifiers.number;

    // 生成筛选函数，筛选被选中的框，对其value进行值的转换
    const selectedVal = `Array.prototype.filter` +
        `.call($event.target.options,function(o){return o.selected})` +
        `.map(function(o){var val = "_value" in o ? o._value : o.value;` +
        `return ${number ? '_n(val)' : 'val'}})`

    // 根据是否指定multiple属性，目标元素的判断语句
    const assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]'

    // 赋值为目标变量
    let code = `var $$selectedVal = ${selectedVal};`;

    // 将$$selectedVal即选中的值赋值给绑定的变量
    code = `${code} ${genAssignmentCode(value, assignment)}`;

    // 给该事件添加change事件
    addHandler(el, 'change', code, null, true);
}
```

从`selectedVal`变量可以看出其代码的含义为返回`<option>`元素中被选中的项的值的数组集合；`assignment`则为根据是否为多选来判断以何种数据类型来返回选中值，然后将得到的选中值赋值给`$$selectedVal`变量，最后将表达式用来作为`change`事件的回调。

这里直接简单描述下`code`变量的最终结果：`var $$selectedVal = 被选中的值; propA = $$selectedVal`

## 单选按钮radio——genRadioModel()

该函数用于向单选按钮添加双向绑定，过程比较简单：

```js
function genRadioModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) {
    const number = modifiers && modifiers.number;

    // 取得value绑定的值
    let valueBinding = getBindingAttr(el, 'value') || 'null';

    // 处理该值的值
    valueBinding = number ? `_n(${valueBinding})` : valueBinding;

    // 向该元素添加checked特性，值为该函数
    addProp(el, 'checked', `_q(${value},${valueBinding})`);

    // 添加原生change事件将value属性的值赋值给用户定义的表达式
    addHandler(el, 'change', genAssignmentCode(value, valueBinding), null, true);
}
```

首先通过[`getBindingAttr()`](../../../../parse解析/一群工具方法/获取属性/README.md#getbindingattr%e8%8e%b7%e5%8f%96bind%e5%b1%9e%e6%80%a7)函数来确认该单选按钮绑定的`value`，优先取动态值。该选项只支持`.nubmer`修饰符，之后添加了一个特性与`change`事件来赋值给双向绑定的值，什么意思呢，就是该元素被选中时，那么`v-model`绑定的值就为`value`属性的值。

## 复选按钮checkbox——genCheckboxModel()

复选框基本上也与单选框差不多，不同的是它支持`v-model`绑定两种不同类型的值——数组、其他值。当指定为数组时，会将选择的元素添加至数组反之移除；而不为数组时，则可以根据选择的状态指定两个不同的值。

```js
function genCheckboxModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) {
    const number = modifiers && modifiers.number;

    // 优先处理用户自定义的动态value
    const valueBinding = getBindingAttr(el, 'value') || 'null';

    // 指定用户选中或未选中时的值
    const trueValueBinding = getBindingAttr(el, 'true-value') || 'true';
    const falseValueBinding = getBindingAttr(el, 'false-value') || 'false';

    // 向元素添加checked特性和其值表达式
    addProp(el, 'checked',
        `Array.isArray(${value})` +
        `?_i(${value},${valueBinding})>-1` + (
            trueValueBinding === 'true' ?
            `:(${value})` :
            `:_q(${value},${trueValueBinding})`
        )
    );

    // 为其添加change事件
    addHandler(el, 'change',

        // 将用户指定变量赋值给$$a
        `var $$a=${value},` +
            '$$el=$event.target,' +

            // 获取当前多选框的状态然后赋予其值
            `$$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});` +

        // v-model绑定的为数组
        'if(Array.isArray($$a)){' +

            // 将该单选框绑定的value属性的值进行修饰符过滤，然后赋值给$$v
            `var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},` +

                // 这里我看下面的判断语句应该是判断$$v是否存在于$$a数组中
                '$$i=_i($$a,$$v);' +
            `if($$el.checked){` +

                // 当被选中时且该值不处于v-model指定数组中，则将添加进去
                `$$i<0&&(${genAssignmentCode(value, '$$a.concat([$$v])')})
            }` + `else{` +

                // 未选中时，且该值处于v-model指定数组中时，去掉该值
                `$$i>-1&&(${genAssignmentCode(value, '$$a.slice(0,$$i).concat($$a.slice($$i+1))')})
            }` +

        // 当v-model绑定的值不为数组时，其值与trueValue和falseValue绑定
        `}else{${genAssignmentCode(value, '$$c')}}`,
        null, true
    )
}
```

从上面添加的`change`事件可以看出，根据`v-model`绑定值的不同，产生了不同的效果。这里提一下`true-value`和`false-value`，因为没怎么经常使用，这两个值表示`v-model`绑定的值不为数组时，复选框选中状态和未选中状态时，其`value`属性对应的值，不设置时分别为`true`和`false`

## 文本输入框——genDefaultModel()

该方法用于处理对文本框的双向绑定，是唯一一个支持`.lazy`操作符的双向绑定，且其会针对输入法做出优化，虽然这里并未体现出来。

```js
function genDefaultModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) : ? boolean {
    const type = el.attrsMap.type;

    // warn if v-bind:value conflicts with v-model
    // except for inputs with v-bind:type
    if (process.env.NODE_ENV !== 'production') {

        // 取得动态绑定value的字符串表达式
        const value = el.attrsMap['v-bind:value'] || el.attrsMap[':value'];

        // 是否动态绑定type属性
        const typeBinding = el.attrsMap['v-bind:type'] || el.attrsMap[':type'];

        // 两者都定义时，报错，提示用户希望动态绑定type代替value
        if (value && !typeBinding) {
            const binding = el.attrsMap['v-bind:value'] ? 'v-bind:value' : ':value'
            warn(
                `${binding}="${value}" conflicts with v-model on the same element ` +
                'because the latter already expands to a value binding internally',
                el.rawAttrsMap[binding]
            )
        }
    }

    const {
        lazy,
        number,
        trim
    } = modifiers || {};

    // 是否需要复合事件，仅在text与input事件下
    const needCompositionGuard = !lazy && type !== 'range';

    // 设置.lazy修饰符会从input事件降级为change
    const event = lazy ?
        'change' :
        type === 'range' ?
        RANGE_TOKEN :
        'input'

    let valueExpression = '$event.target.value';

    // 针对修饰符做处理
    if (trim) {
        valueExpression = `$event.target.value.trim()`;
    }
    if (number) {
        valueExpression = `_n(${valueExpression})`;
    }

    // 将input元素的value赋值给v-model绑定的变量
    let code = genAssignmentCode(value, valueExpression);

    // 复合事件时直接退出
    if (needCompositionGuard) {
        code = `if($event.target.composing)return;${code}`
    }

    // 将value属性与v-model绑定的变量关联
    addProp(el, 'value', `(${value})`);

    // 添加相关的事件
    addHandler(el, event, code, null, true);

    // 具有修饰符时，在失焦时要进行输入过滤
    if (trim || number) {
        addHandler(el, 'blur', '$forceUpdate()')
    }
}
```

从代码可以看出，添加`.lazy`修饰符后会降级`input`事件为`change`，且针对输入法输入，会直接退出`input/change`事件。
____

从`model()`方法可以看出，除[`genComponentModel()`](#%e7%bb%84%e4%bb%b6%e9%9d%9e%e5%8e%9f%e7%94%9f%e6%a0%87%e7%ad%begencomponentmodel)不会需要在操作指令时添加运行时编译的代码外，其他都会。
