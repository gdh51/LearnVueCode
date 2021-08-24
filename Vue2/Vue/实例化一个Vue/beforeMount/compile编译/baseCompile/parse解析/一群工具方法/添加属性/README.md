# addAttr()——添加属性

Vue中有两个方法用于添加属性，一种是添加的未处理的原始属性，另一种是添加的已处理的。

## addRawAttr()——添加原始属性

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

## addAttr()——添加已处理属性

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

## addProp()——向元素添加个prop属性

向`ast`元素添加个`props`数组，该`prop`非`attr`

```js
function addProp(el: ASTElement, name: string, value: string, range ? : Range, dynamic ? : boolean) {
    (el.props || (el.props = [])).push(rangeSetItem({
        name,
        value,
        dynamic
    }, range))
    el.plain = false
}
```

## addHandler()——添加事件

顾名思义该方法用于向元素的ast对象添加事件队列，期间还要处理各种事件修饰符；增对该事件的重要程度来决定是否将事件置于最前(前提是之前只有一个事件处理器)

```js
// 该方法用于根据是否为动态事件名，将事件名转化字符串表达式
function prependModifierMarker(symbol: string, name: string, dynamic ? : boolean): string {
    return dynamic ?
        `_p(${name},"${symbol}")` :
        symbol + name // mark the event as captured
}

const emptyObject = Object.freeze({});

function addHandler(
    el: ASTElement,
    name: string,

    // 事件表达式
    value: string,

    // 事件修饰符
    modifiers: ? ASTModifiers,

    // 是否优先调用，仅限队列中只有一个函数处理器时
    important ? : boolean,
    warn ? : ? Function,
    range ? : Range,
    dynamic ? : boolean
) {

    // 检查是否有事件修饰符
    modifiers = modifiers || emptyObject;

    // warn prevent and passive modifier
    // 禁止passive和prevent一起使用，因为passive是要触发默认行为的
    if (
        process.env.NODE_ENV !== 'production' && warn &&
        modifiers.prevent && modifiers.passive
    ) {
        warn(
            'passive and prevent can\'t be used together. ' +
            'Passive handler can\'t prevent default event.',
            range
        )
    }

    // normalize click.right and click.middle since they don't actually fire
    // this is technically browser-specific, but at least for now browsers are
    // the only target envs that have right/middle clicks.
    // 标准化鼠标右键或中间的点击事件，当前只在浏览器中有效
    // 以下是针对添加特殊修饰符的点击事件
    if (modifiers.right) {

        // 鼠标右键事件仅在contextmenu中有效
        if (dynamic) {
            name = `(${name})==='click'?'contextmenu':(${name})`
        } else if (name === 'click') {
            name = 'contextmenu'
            delete modifiers.right;
        }

    // 鼠标中间支持的事件仅为mouseup
    } else if (modifiers.middle) {
        if (dynamic) {
            name = `(${name})==='click'?'mouseup':(${name})`
        } else if (name === 'click') {
            name = 'mouseup';
        }
    }

    // check capture modifier
    // 处理其他修饰符
    if (modifiers.capture) {
        delete modifiers.capture
        name = prependModifierMarker('!', name, dynamic)
    }
    if (modifiers.once) {
        delete modifiers.once
        name = prependModifierMarker('~', name, dynamic)
    }
    if (modifiers.passive) {
        delete modifiers.passive
        name = prependModifierMarker('&', name, dynamic)
    }

    let events;

    // 根据是否具有原生事件修饰符，根据该属性要创建不同的事件收容对象
    if (modifiers.native) {
        delete modifiers.native
        events = el.nativeEvents || (el.nativeEvents = {})
    } else {
        events = el.events || (el.events = {})
    }

    // 创建一个事件处理器对象
    const newHandler: any = rangeSetItem({
        value: value.trim(),
        dynamic
    }, range);

    // 如果事件监听器最初不为空，将修饰符对象添加至新的事件处理器上
    if (modifiers !== emptyObject) {
        newHandler.modifiers = modifiers;
    }

    // 取出该名称的事件队列
    const handlers = events[name];

    // 存在数组形式的处理器队列则添加进去
    if (Array.isArray(handlers)) {
        important ? handlers.unshift(newHandler) : handlers.push(newHandler);

    // 存在单个处理器时，根据是否重要，添加进入并更改其处理器顺序
    } else if (handlers) {
        events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
    } else {

        // 没有时就直接赋值即可
        events[name] = newHandler;
    }

    el.plain = false;
}
```

## addDirective()——添加指令对象

该函数用于生成一个指令对象，添加至`ast`元素对象上。

```js
function addDirective(
    el: ASTElement,
    name: string,
    rawName: string,
    value: string,
    arg: ? string,
    isDynamicArg : boolean,
    modifiers: ? ASTModifiers,
    range ? : Range
) {
    (el.directives || (el.directives = [])).push(rangeSetItem({
        name,
        rawName,
        value,
        arg,
        isDynamicArg,
        modifiers
    }, range))
    el.plain = false;
}
```

## addIfCondition()——添加if判断条件对象

比较简单，判断条件就是一个队列，将新的判断条件对象加入即可。

```js
function addIfCondition(el: ASTElement, condition: ASTIfCondition) {

    // 是否有判断条件对象？没有新建一个
    if (!el.ifConditions) {
        el.ifConditions = []
    }

    // 加入判断条件对象
    el.ifConditions.push(condition)
}
```