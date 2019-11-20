/* @flow */

import {
    warn,
    invokeWithErrorHandling
} from 'core/util/index'
import {
    cached,
    isUndef,
    isTrue,
    isPlainObject
} from 'shared/util'

// 标准化自定义事件的名称，这里是针对添加简写修饰符的情况
const normalizeEvent = cached((name: string): {
    name: string,
    once: boolean,
    capture: boolean,
    passive: boolean,
    handler ? : Function,
    params ? : Array < any >
} => {
    // 提取具体的修饰含义，从这里我们可以看出修饰符的顺序不能有错，否则有可能会无效
    const passive = name.charAt(0) === '&';
    name = (passive ? name.slice(1) : name);
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = (once ? name.slice(1) : name);
    const capture = name.charAt(0) === '!';
    name = (capture ? name.slice(1) : name);
    return {
        name,
        once,
        capture,
        passive
    };
})

// 创建一个调度函数，并把该函数挂载其自身属性上。
export function createFnInvoker(fns: Function | Array < Function > , vm: ? Component): Function {
    function invoker() {
        const fns = invoker.fns
        if (Array.isArray(fns)) {
            const cloned = fns.slice()
            for (let i = 0; i < cloned.length; i++) {
                invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
            }
        } else {
            // return handler return value for single handlers
            return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
        }
    }
    invoker.fns = fns;
    return invoker;
}

export function updateListeners(
    on: Object,
    oldOn: Object,
    add: Function,
    remove: Function,
    createOnceHandler: Function,
    vm: Component
) {
    let name, def, cur, old, event;
    for (name in on) {

        // 取出事件函数
        def = cur = on[name];
        old = oldOn[name];

        // 标准化事件名(提取简写的修饰符)
        event = normalizeEvent(name);

        // 事件为对象的形式处理
        if (__WEEX__ && isPlainObject(def)) {
            cur = def.handler
            event.params = def.params
        }

        if (isUndef(cur)) {
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            );

        // 如果未定义过该名称的事件
        } else if (isUndef(old)) {

            if (isUndef(cur.fns)) {

                // 为该事件创建一个调度函数，帮将该事件挂载在函数的静态属性上
                cur = on[name] = createFnInvoker(cur, vm);
            }

            if (isTrue(event.once)) {

                // 如果为一次性事件，则创新创建一个特殊的调度函数
                cur = on[name] = createOnceHandler(event.name, cur, event.capture)
            }

            // 最后在该Vue实例的_event中添加该自定义函数数组
            add(event.name, cur, event.capture, event.passive, event.params);

        // 之前定义过该名称事件时，替换旧的事件函数
        } else if (cur !== old) {
            old.fns = cur
            on[name] = old
        }
    }

    // 最后从vm上移除已经不存在的事件
    for (name in oldOn) {
        if (isUndef(on[name])) {
            event = normalizeEvent(name);
            remove(event.name, oldOn[name], event.capture);
        }
    }
}