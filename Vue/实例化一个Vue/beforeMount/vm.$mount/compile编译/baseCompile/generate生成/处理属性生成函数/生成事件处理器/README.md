# 生成事件处理器函数

`Vue`中通过`genHandlers()`函数来生成事件处理器函数，其结果是生成一个对象中的某个键值对，形式为：`on: handler`，其中事件处理器，其实是在用户指定的事件处理器基础之上进行包装后的一个函数。在此期间，会对其修饰符进行处理，生成一系列的条件判断语句。

具体我们先从该函数看起`genHandlers()`：

## genHandlers()——生成事件键值对

先浏览代码：

```js
function genHandlers(
    events: ASTElementHandlers,
    isNative: boolean
): string {

    // 这里的isNative仅限具有.native修饰符的事件
    const prefix = isNative ? 'nativeOn:' : 'on:';

    // 存储静态事件名称的事件处理器
    let staticHandlers = ``;

    // 存储动态事件名称的事件处理器
    let dynamicHandlers = ``;

    // 通过for循环对所有该元素上事件进行事件处理器的生成
    for (const name in events) {

        // 获得当前的事件处理器函数字符串表达式
        const handlerCode = genHandler(events[name]);

        // 根据事件名称是否为动态的，添加不同数据类型的格式(事件处理函数一致)
        if (events[name] && events[name].dynamic) {

            // 动态名称的事件为数组形式
            dynamicHandlers += `${name},${handlerCode},`
        } else {

            // 静态名称的事件为对象形式
            staticHandlers += `"${name}":${handlerCode},`
        }
    }

    // 包装为对象，去掉，号
    staticHandlers = `{${staticHandlers.slice(0, -1)}}`;

    // 根据事件名是否为动态的，返回不同的处理结果
    if (dynamicHandlers) {
        return prefix + `_d(${staticHandlers},[${dynamicHandlers.slice(0, -1)}])`;
    } else {
        return prefix + staticHandlers;
    }
}
```

从上面代码可以看出，在最初无论我们指定何种名称的事件，它都会是一个自定义事件，除非指定`.native`修饰符，但是使用过`Vue`的会知道，指定原生事件名称时，它确实是原生事件，但在该处理函数中未对这种形式进行处理。

紧接着便调用`for`循环，迭代的对每个事件对象进行处理，调用`genHandler()`生成事件处理函数字符串。

## genHandler()——生成事件处理函数字符串

Vue规定用户添加事件处理函数时，只能有四种情况：

- 方法路径地址，如`a.b.c`
- 方法路径地址的调用，如`a.b.c()`
- 函数表达式，如`function () {}`
- 单独的表达式，如`let a = b;`

>之后如有具体代码的举例，均以上面4个例子为基础

然后根据各自的情况，使用包装函数在外层进行包装，在包装函数内进行这些函数的调用，还会更具修饰符添加一些`if`条件语句，如：

```js
// 伪代码
function ($event) {
    if (xxxx) return null;
    return a.b.c();
}
```

这个过程虽然代码比较多，但其实并不复杂，先大致观看一次：

```js
// 匹配函数表达式
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*(?:[\w$]+)?\s*\(/;

// 匹配函数调用即()
const fnInvokeRE = /\([^)]*?\);*$/;

// 属性查找表达式
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/;

function genHandler(handler: ASTElementHandler | Array < ASTElementHandler > ): string {

    // 未写入事件处理器，返回空函数
    if (!handler) {
        return 'function(){}'
    }

    // 多个事件处理器时，迭代使用该函数生成单个渲染函数后组成数组
    if (Array.isArray(handler)) {
        return `[${handler.map(handler => genHandler(handler)).join(',')}]`;
    }

    // 是否为方法在vue实例中的路径，即a.b.fn
    const isMethodPath = simplePathRE.test(handler.value);

    // 是否为函数表达式
    const isFunctionExpression = fnExpRE.test(handler.value);

    // 同第一种一样，不过匹配的是函数调用，即a.b.fn()
    const isFunctionInvocation = simplePathRE.test(handler.value.replace(fnInvokeRE, ''))

    // 没有修饰符时
    if (!handler.modifiers) {

        // 是方法路径或函数表达式时，直接返回其字符串表达式
        if (isMethodPath || isFunctionExpression) {
            return handler.value
        }

        // 忽略
        if (__WEEX__ && handler.params) {
            return genWeexHandler(handler.params, handler.value)
        }

        // 其他情况时，如果是函数调用，则返回函数调用结果的函数表达式，否则返回简单的调用
        return `function($event){${
            isFunctionInvocation ? `return ${handler.value}` : handler.value}}`; // inline statement
    } else {

        // 处理具有修饰符时
        let code = '';
        let genModifierCode = '';
        const keys = [];

        // 这里提醒下，键值是以键值对的形式存在，即 键名：Boolean，且只存在存在的键值
        for (const key in handler.modifiers) {

            // 是否为原生事件类的修饰器
            if (modifierCode[key]) {

                // 将修饰器代表的条件按修饰器顺序添加
                genModifierCode += modifierCode[key];

                // left/right
                // 如果是键值修饰符的化要添加该键值
                if (keyCodes[key]) {
                    keys.push(key)
                }

            // 有精准修饰符时，只允许被修饰的按键单独触发
            } else if (key === 'exact') {
                const modifiers: ASTModifiers = (handler.modifiers: any);

                // 字符串表达式含义为：当不为被修饰的键值时，返回
                genModifierCode += genGuard(
                    ['ctrl', 'shift', 'alt', 'meta']

                    // 排除以上4个修饰符中用户定义了的
                    .filter(keyModifier => !modifiers[keyModifier])
                    .map(keyModifier => `$event.${keyModifier}Key`)
                    .join('||')
                );
            } else {
                // 其他普通键值时，直接添加进keys数组
                keys.push(key)
            }
        }

        // 存在指定键位的修饰符时，生成相关的判断筛选语句
        if (keys.length) {
            code += genKeyFilter(keys);
        }

        // Make sure modifiers like prevent and stop get executed after key filtering
        // 确保事件行为在条件判断语句后执行
        if (genModifierCode) {
            code += genModifierCode;
        }

        // 根据传入字符串表达式的形式，不同的方式调用函数
        const handlerCode = isMethodPath ?
            `return ${handler.value}($event)` :
            isFunctionExpression ?
            `return (${handler.value})($event)` :
            isFunctionInvocation ?

            // 这里可以看出函数调用形式时，未传入事件对象$event
            `return ${handler.value}` :
            handler.value;

        // 无视
        if (__WEEX__ && handler.params) {
            return genWeexHandler(handler.params, code + handlerCode)
        }

        // 返回最终的事件处理函数
        return `function($event){${code}${handlerCode}}`
    }
}
```

对于事件处理器的个数和是否有事件处理器的处理我们就不解释了，主要解释下处理一个事件处理器的具体流程。

### 处理单个事件处理器流程

首先我们可以看到，先要对用户定义的事件处理器为何种形式进行判断，大体只有4种情况：

- 方法路径地址，如`a.b.c`
- 方法路径地址的调用，如`a.b.c()`
- 函数表达式，如`function () {}`
- 单独的表达式，如`let a = b;`

其中，不符合前三种情况的，直接按第四种情况处理，之后按照是否有事件修饰符又分了两种情况来进行处理：

- [有事件修饰符](#%e6%9c%89%e4%ba%8b%e4%bb%b6%e4%bf%ae%e9%a5%b0%e7%ac%a6)
- [无事件修饰符](#%e6%97%a0%e4%ba%8b%e4%bb%b6%e4%bf%ae%e9%a5%b0%e7%ac%a6)

我们先看简单的，无事件修饰符的情况

#### 无事件修饰符

由于代码比较少，我就直接截取过来了：

```js
// 是方法路径或函数表达式时，直接返回其字符串表达式
if (isMethodPath || isFunctionExpression) {
    return handler.value;
}

// 其他情况时，如果是函数调用，则返回函数调用结果的函数表达式，否则返回简单的调用
return `function($event){${
    isFunctionInvocation ? `return ${handler.value}` : handler.value}}`; // inline statement
```

比较简单，如果是**情况1(方法路径地址)**或**情况3(函数表达式)**，则直接返回其字符串表达式值即可；如果是**情况2(函数调用)**则返回`funtion($event){return fn()}`这样的表达式，我们可以看到**函数调用形式不会带有**`$event`**事件对象**，其余其他情况只是简单的对表达式的调用——`funtion($event){let a = 1;...}`。

#### 有事件修饰符

有事件修饰符的情况就稍微有点复杂，也就对修饰符进行了处理，这里我们就可以知道为什么修饰符的顺序会产生不同的效果。

首先对修饰符进行了归类处理，大致按我的理解分为三种情况：

- [事件自带属性的修饰符](#%e4%ba%8b%e4%bb%b6%e8%87%aa%e5%b8%a6%e5%b1%9e%e6%80%a7%e7%9a%84%e4%bf%ae%e9%a5%b0%e7%ac%a6)
- [`.exact`修饰符](#exact%e4%bf%ae%e9%a5%b0%e7%ac%a6)
- 其他字母修饰符或键码，如`a/111`

##### 事件自带属性的修饰符

该分支用来处理修饰符是事件自带的原始属性或方法的情况，生成一些条件语句，它们会修饰符的顺序按序组合在一起，所以**修饰符的顺序会影响事件的调用**！

```js
const modifierCode: {
    [key: string]: string
} = {
    stop: '$event.stopPropagation();',
    prevent: '$event.preventDefault();',
    self: genGuard(`$event.target !== $event.currentTarget`),
    ctrl: genGuard(`!$event.ctrlKey`),
    shift: genGuard(`!$event.shiftKey`),
    alt: genGuard(`!$event.altKey`),
    meta: genGuard(`!$event.metaKey`),
    left: genGuard(`'button' in $event && $event.button !== 0`),
    middle: genGuard(`'button' in $event && $event.button !== 1`),
    right: genGuard(`'button' in $event && $event.button !== 2`)
}

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
const genGuard = condition => `if(${condition})return null;`

// 是否为原生事件类的修饰器
if (modifierCode[key]) {

    // 将修饰器代表的条件按修饰器顺序添加
    genModifierCode += modifierCode[key];

    // left/right
    // 两个特殊的键位，稍后还要单独对两个键值进行限制
    if (keyCodes[key]) {
        keys.push(key);
    }
}

// KeyboardEvent.keyCode aliases
// 键盘事件keyCode的别名
const keyCodes: {
    [key: string]: number | Array < number >
} = {
    esc: 27,
    tab: 9,
    enter: 13,
    space: 32,
    up: 38,
    left: 37,
    right: 39,
    down: 40,
    'delete': [8, 46]
}
```

针对`left/right`两个属性，还需要单独进行处理，将它添加到一个`keys`数组中，它主要用于生成一个匹配这些`keys`值的`if`语句，之后会知道。

##### .exact修饰符

该修饰符用来限制修饰符条件：

```js
// 所有的修饰符
const modifiers: ASTModifiers = (handler.modifiers: any);

// 字符串表达式含义为：当不为被修饰的键值情况时，返回
genModifierCode += genGuard(
    ['ctrl', 'shift', 'alt', 'meta']

    // 排除以上4个修饰符中用户定义了的
    .filter(keyModifier => !modifiers[keyModifier])
    .map(keyModifier => `$event.${keyModifier}Key`)

    // 生成if条件语句
    .join('||')
);
```

这里我就举个例子，假如用户定义一个该例`@click.ctrl.shift.b.exact`，那么最终生成的表达式为`if($event.altKey||$event.metaKey)return null;`
____
至于最后一种情况，就是直接将该修饰符假如`keys`数组即可，那么问题来了，`keys`数组是干什么的？

##### 处理keys数组——处理其他修饰符

针对`keys`数组中的修饰符，会为它们生成一个超大的`if`条件判断语句，在其判断条件中按序添加它们。

```js
// 存在指定键位的修饰符时，生成相关的判断筛选语句
if (keys.length) {
    code += genKeyFilter(keys);
}

// 生成key的if表达式过滤器
function genKeyFilter(keys: Array < string > ): string {

    // 生成键名修饰符检测表达式
    return (
        // make sure the key filters only apply to KeyboardEvents
        // #9441: can't use 'keyCode' in $event because Chrome autofill fires fake
        // key events that do not have keyCode property...
        // 确认为键盘事件
        `if(!$event.type.indexOf('key')&&` +
        `${keys.map(genFilterCode).join('&&')})return null;`
    )
}

function genFilterCode(key: string): string {

    // 输入的是键码时，返回键码判断表达式
    const keyVal = parseInt(key, 10);
    if (keyVal) {
        return `$event.keyCode!==${keyVal}`;
    }

    // 具体键名时，返回其键码
    const keyCode = keyCodes[key];

    // 事件名，为了兼容性可以会有多个名称，对，你没有看错，就是说你的IE
    const keyName = keyNames[key];
    return (
        `_k($event.keyCode,` +
        `${JSON.stringify(key)},` +
        `${JSON.stringify(keyCode)},` +
        `$event.key,` +
        `${JSON.stringify(keyName)}` +
        `)`
    )
}

// KeyboardEvent.key aliases
// 键盘事件key的别名
const keyNames: {
    [key: string]: string | Array < string >
} = {
    // #7880: IE11 and Edge use `Esc` for Escape key name.
    esc: ['Esc', 'Escape'],
    tab: 'Tab',
    enter: 'Enter',
    // #9112: IE11 uses `Spacebar` for Space key name.
    space: [' ', 'Spacebar'],
    // #7806: IE11 uses key names without `Arrow` prefix for arrow keys.
    up: ['Up', 'ArrowUp'],
    left: ['Left', 'ArrowLeft'],
    right: ['Right', 'ArrowRight'],
    down: ['Down', 'ArrowDown'],
    // #9112: IE11 uses `Del` for Delete key name.
    'delete': ['Backspace', 'Delete', 'Del']
}
```

从代码中我们可以看出，通过`genKeyFilter()`生成了一个`if`条件语句，这个`if`条件字符串语句具有多个并行(`&&`)的条件，首先第一个条件就是必须要是键盘事件才行；之后的事件是根据`keys`数组中具有的键值进行生成的。

通过`genFilterCode()`函数我们可以知道，指定具体键值时，我们还可以指定其键码，所以会生成两种形式的表达式：

- 针对键码的判断条件，最终结果为`$event.keyCode!== a number`
- 针对键值的判断条件（兼容`key`与`keyCode`），最终结果为`_k($event.keyCode, a, undefined, $event.key, undefined`

我们可以知道在第二种情况下，除非特殊键，其他键是不会提供一个对象来进行键值和键名查询的。
____
之后便将两个生成的条件语句进行拼接，确保和事件属性方法的调用拼接在后面，应该比较条件如果都不成立，那么也没有执行的必要。

```js
// 确保事件行为在条件判断语句后执行
if (genModifierCode) {
    code += genModifierCode;
}
```

最后还要对我们**事件处理器的返回值**和**用户自定义的方法的调用**进行处理，同样的4种情况：

- 方法路径地址：返回该方法调用的返回值并传入事件对象(`return fn($event)`)
- 方法路径地址的调用：返回该方法调用的返回值，传入的参数为用户定义时调用的参数(`return fn(arg1,arg2)`)
- 函数表达式：返回该表达式调用的返回值并传入事件对象(`return function(){}($event)`)
- 单独的表达式：无返回值，仅调用(`let a = b`)

```js
// 根据传入字符串表达式的形式，不同的方式调用函数
const handlerCode = isMethodPath ?
    `return ${handler.value}($event)` :
    isFunctionExpression ?
    `return (${handler.value})($event)` :
    isFunctionInvocation ?

    // 这里可以看出函数调用形式时，未传入事件对象$event
    `return ${handler.value}` : handler.value;
```

最后将全部代码用包装函数进行包装后返回：

```js
// 返回最终的事件处理函数
return `function($event){${code}${handlerCode}}`
```

就不解释了。
____
回到我们的`genHandlers()`函数，我们处理完`genHandler()`函数，从中得到了函数处理器的具体代码的字符串表达式后，根据事件名是否为动态的，生成两种数据类型的表达式：

- 动态事件名称：数组
- 静态事件名称：对象

```js
// 根据事件名称是否为动态的，添加不同数据类型的格式(事件处理函数一致)
        if (events[name] && events[name].dynamic) {

            // 动态名称的事件为数组形式
            dynamicHandlers += `${name},${handlerCode},`
        } else {

            // 静态名称的事件为对象形式
            staticHandlers += `"${name}":${handlerCode},`
        }
```

假如我们这里有一个动态名称的事件，我们注册时为`@[dynamic]="fn"`，这最后生成为`dynamic,function(){return fn($event)}`；静态的`@static="fn"`则为`static:fn`

```html
<div @[dynamic]="fn" @static="fn">
```

最后根据是否有动态名称的事件，生成两种形式的表达式。

```js
// 根据事件名是否为动态的，返回不同的处理结果
if (dynamicHandlers) {
    return prefix + `_d(${staticHandlers},[${dynamicHandlers.slice(0, -1)}])`;
} else {
    return prefix + staticHandlers;
}
```

动态为：`on/nativeOn:_d({static:fn},[dynamic,function(){return fn($event)}])`
静态为：`on/nativeOn:{static:fn}`
