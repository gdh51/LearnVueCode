/* @flow */

import {
    emptyObject
} from 'shared/util'
import {
    parseFilters
} from './parser/filter-parser'

type Range = {
    start ? : number,
    end ? : number
};

/* eslint-disable no-unused-vars */
export function baseWarn(msg: string, range ? : Range) {
    console.error(`[Vue compiler]: ${msg}`)
}
/* eslint-enable no-unused-vars */

export function pluckModuleFunction < F: Function > (
    modules: ? Array < Object > ,
    key : string
): Array < F > {
    return modules ?
        modules.map(m => m[key]).filter(_ => _) : []
}

export function addProp(el: ASTElement, name: string, value: string, range ? : Range, dynamic ? : boolean) {
    (el.props || (el.props = [])).push(rangeSetItem({
        name,
        value,
        dynamic
    }, range))
    el.plain = false
}

export function addAttr(el: ASTElement, name: string, value: any, range ? : Range, dynamic ? : boolean) {

    // 是否添加至动态数组
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

// add a raw attr (use this in preTransforms)
// 添加一个未处理的属性(仅在preTransforms)中使用
export function addRawAttr(el: ASTElement, name: string, value: any, range ? : Range) {
    el.attrsMap[name] = value;
    el.attrsList.push(rangeSetItem({
        name,
        value
    }, range))
}

export function addDirective(
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

function prependModifierMarker(symbol: string, name: string, dynamic ? : boolean): string {
    return dynamic ?
        `_p(${name},"${symbol}")` :
        symbol + name // mark the event as captured
}

export function addHandler(
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

export function getRawBindingAttr(
    el: ASTElement,
    name: string
) {
    return el.rawAttrsMap[':' + name] ||
        el.rawAttrsMap['v-bind:' + name] ||
        el.rawAttrsMap[name]
}

export function getBindingAttr(
    el: ASTElement,
    name: string,
    getStatic ? : boolean
): ? string {

    // 移除ast对象中attrslist中的对应属性，并返回对应动态绑定属性的  信息对象
    // 这里就是一个该属性的信息对象，包括该属性值，和位置信息
    const dynamicValue =
        getAndRemoveAttr(el, ':' + name) ||
        getAndRemoveAttr(el, 'v-bind:' + name);

    if (dynamicValue != null) {
        return parseFilters(dynamicValue);

        // 未找到该动态绑定的属性时，查找该值的静态属性
    } else if (getStatic !== false) {
        const staticValue = getAndRemoveAttr(el, name);

        // 找到时，返回该对象值的JSON字符串
        if (staticValue != null) {
            return JSON.stringify(staticValue);
        }
    }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
export function getAndRemoveAttr(
    el: ASTElement,
    name: string,
    removeFromMap ? : boolean
) : ? string {
    let val;

    // 确保map中存在该属性
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
    return val;
}

export function getAndRemoveAttrByRegex(
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