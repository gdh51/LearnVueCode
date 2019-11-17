# 生成影响dom结构的渲染函数

可能一开始看题目还有点懵逼，但按我的理解就是`v-for`与`v-if`，因为它们会影响`dom`的逻辑结构，所以在`genElement()`的过程中，它们的优先级较高。

## genFor()——处理渲染函数中v-for

处理方式比较简单，首先是检测了一下是否在组件上使用`v-for`但未设置`key`值，是就报错，之后便用包装函数包装了下元素生成的渲染函数，直接看代码直观一些：

```js
function genFor(
    el: any,
    state: CodegenState,

    // 指定的gen函数
    altGen ? : Function,

    // 指定的helper函数
    altHelper ? : string
): string {

    // 分别找到v-for表达式中的变量名
    const exp = el.for;
    const alias = el.alias;
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : '';
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : '';

    // 如果组件使用v-for则必须指定key值
    if (process.env.NODE_ENV !== 'production' &&
        state.maybeComponent(el) &&
        el.tag !== 'slot' &&
        el.tag !== 'template' &&
        !el.key
    ) {
        state.warn(
            `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
            `v-for should have explicit keys. ` +
            `See https://vuejs.org/guide/list.html#key for more info.`,
            el.rawAttrsMap['v-for'],
            true /* tip */
        )
    }

    // 添加已处理标记位
    el.forProcessed = true; // avoid recursion
    return `${altHelper || '_l'}((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +

        // 调用指定的gen函数或genElement继续处理元素剩下的属性
        `return ${(altGen || genElement)(el, state)}` +
        '})';
}
```

在最后返回值中的第二个包装函数中，再次调用了`gen()`函数对元素进行生成渲染函数，这里可以指定具体的`gen()`函数，但纵观代码，可以发现只有在[`genScopedSlot()`](../生成插槽函数/README.md)函数中，指定了具体的`gen()`函数，其余都是调用[`genElement()`](../README.md)函数来生成渲染函数；`altHelper`从未自定义指定过。

所以不管怎样，假如有一个这样的模版：

```html
<div v-for="(item, index) of items">
```

则，最后的结果为：`_l((items),function(item,index){return renderFn})`

## genIf()——处理渲染函数中if语句块

其实这个函数包含两个部分，真正起作用的是`genIfConditions()`函数，`genIf()`只起了个添加标记位的作用

```js
function genIf(
    el: any,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {
    el.ifProcessed = true; // avoid recursion
    return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}
```

### genIfConditions()——处理if条件块，形成三元判断语句

该函数根据`if`条件块各自的条件按序生成三元语句和渲染函数，当第一个`if`条件被拒绝时，会取下一个`else-if`语句的条件，以此类推，大约是这样的结果`if condition ? if render : else-if condition ? else-if render : else render`

```js
function genIfConditions(
    conditions: ASTIfConditions,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {

    // 不存在if条件块，返回一个空函数
    if (!conditions.length) {
        return altEmpty || '_e()';
    }

    // 取出当前的if条件块
    const condition = conditions.shift();

    // 具有if条件表达式时，生成条件语句块
    if (condition.exp) {

        // 根据if条件语句块来就行下一个函数的生成
        // 为true时，进入当前的block块，为false时，继续检查下一个if块
        // 结果就为多个三元语句的嵌套
        return `(${condition.exp})?${genTernaryExp(condition.block)}:${
            genIfConditions(conditions, state, altGen, altEmpty)}`
    } else {

        // 没有if条件表达式时，直接生成渲染函数即可
        return `${genTernaryExp(condition.block)}`;
    }

    // v-if with v-once should generate code like (a)?_m(0):_m(1)
    // 生成三元表达式
    function genTernaryExp(el) {

        // 具有指定的生成器时，则调用，否则检测是否具有once属性，在处理其他属性
        return altGen ? altGen(el, state) :
            (el.once ? genOnce(el, state) : genElement(el, state));
    }
}
```

首先，在不存在`if`条件块时，直接返回`_e()`空函数，而前面的`altEmpty`在当前编译版本中不存在，所以可以无视。

接下来就是该函数的核心部分，递归生成了一串三元表达式：

```js
 // 具有if条件表达式时，生成条件语句块
if (condition.exp) {

    // 根据if条件语句块来就行下一个函数的生成
    // 为true时，进入当前的block块，为false时，继续检查下一个if块
    // 结果就为多个三元语句的嵌套
    return `(${condition.exp})?${genTernaryExp(condition.block)}:${
        genIfConditions(conditions, state, altGen, altEmpty)}`
} else {

    // 没有if条件表达式时，直接生成渲染函数即可
    return `${genTernaryExp(condition.block)}`;
}
```

上面的`condition.exp`也就是`if`条件块成立的条件表达式，不熟悉建议打个断点看一看；那么上面的语句含义就是除`else`语句外，其余都会被转化为三元语句，那么现在来看一下这个三元语句的具体转换过程：

```js
`(${condition.exp})?${genTernaryExp(condition.block)}:${
    genIfConditions(conditions, state, altGen, altEmpty)}`;

function genTernaryExp(el) {

    // 具有指定的生成器时，则调用，否则检测是否具有once属性，在处理其他属性
    return altGen ? altGen(el, state) :
        (el.once ? genOnce(el, state) : genElement(el, state));
}
```

通过`genTernaryExp()`函数可以来确认具体调用哪一个`gen()`函数来生成渲染函数，当然优先级最高的还是用户指定一个`gen()`时，其次根据是否具有`v-once`属性，默认情况下统一调用`genElement()`函数生成渲染函数。
