/* @flow */

// 匹配函数表达式
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*(?:[\w$]+)?\s*\(/;

// 匹配函数调用即()
const fnInvokeRE = /\([^)]*?\);*$/;

// 属性查找表达式
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/;

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

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
const genGuard = condition => `if(${condition})return null;`

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

export function genHandlers(
    events: ASTElementHandlers,
    isNative: boolean
): string {

    // 这里的isNative仅限具有.native修饰符的事件
    const prefix = isNative ? 'nativeOn:' : 'on:';
    let staticHandlers = ``;
    let dynamicHandlers = ``;
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
    staticHandlers = `{${staticHandlers.slice(0, -1)}}`;

    // 根据事件名是否为动态的，返回不同的处理结果
    if (dynamicHandlers) {
        return prefix + `_d(${staticHandlers},[${dynamicHandlers.slice(0, -1)}])`;
    } else {
        return prefix + staticHandlers;
    }
}

// Generate handler code with binding params on Weex
/* istanbul ignore next */
function genWeexHandler(params: Array < any > , handlerCode: string) {
    let innerHandlerCode = handlerCode
    const exps = params.filter(exp => simplePathRE.test(exp) && exp !== '$event')
    const bindings = exps.map(exp => ({
        '@binding': exp
    }))
    const args = exps.map((exp, i) => {
        const key = `$_${i + 1}`
        innerHandlerCode = innerHandlerCode.replace(exp, key)
        return key
    })
    args.push('$event')
    return '{\n' +
        `handler:function(${args.join(',')}){${innerHandlerCode}},\n` +
        `params:${JSON.stringify(bindings)}\n` +
        '}'
}

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
                )
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

function genKeyFilter(keys: Array < string > ): string {

    // 生成键名修饰符检测表达式
    return (
        // make sure the key filters only apply to KeyboardEvents
        // #9441: can't use 'keyCode' in $event because Chrome autofill fires fake
        // key events that do not have keyCode property...
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

    // 具体键名时，返回_k()函数表达式
    const keyCode = keyCodes[key];
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