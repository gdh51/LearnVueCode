/* @flow */

import {
    tip,
    toArray,
    hyphenate,
    formatComponentName,
    invokeWithErrorHandling
} from '../util/index'
import {
    updateListeners
} from '../vdom/helpers/index'

export function initEvents(vm: Component) {
    vm._events = Object.create(null);
    vm._hasHookEvent = false;

    // init parent attached events
    // 初始化挂载在组件上的自定义事件(即定义在父组件中的自己组件上的事件)
    const listeners = vm.$options._parentListeners;

    if (listeners) {
        updateComponentListeners(vm, listeners)
    }
}

let target: any

function add(event, fn) {
    target.$on(event, fn)
}

function remove(event, fn) {
    target.$off(event, fn)
}

function createOnceHandler(event, fn) {
    const _target = target
    return function onceHandler() {
        const res = fn.apply(null, arguments)
        if (res !== null) {
            _target.$off(event, onceHandler)
        }
    }
}

export function updateComponentListeners(
    vm: Component,
    listeners: Object,
    oldListeners: ? Object
) {
    target = vm;
    updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm);
    target = undefined;
}

export function eventsMixin(Vue: Class < Component > ) {

    // 用于判断是否为狗子函数
    const hookRE = /^hook:/;
    Vue.prototype.$on = function (event: string | Array < string > , fn: Function): Component {
        const vm: Component = this;

        if (Array.isArray(event)) {
            // 数组形式时，递归调用该方法添加事件
            for (let i = 0, l = event.length; i < l; i++) {
                vm.$on(event[i], fn)
            }
        } else {

            // 将事件添加至对应名称的数组中
            (vm._events[event] || (vm._events[event] = [])).push(fn);

            // optimize hook:event cost by using a boolean flag marked at registration
            // instead of a hash lookup
            // 在注册hook:event类似的事件时，使用boolean值来标记，而不是通过一个hash map来查找
            // 这样可以优化这个注册过程

            // 是否存在钩子函数
            if (hookRE.test(event)) {
                vm._hasHookEvent = true;
            }
        }

        return vm;
    }

    Vue.prototype.$once = function (event: string, fn: Function): Component {
        const vm: Component = this;

        // 封装了一下用户传入的回调函数，在调用前就清除该自定义事件
        function on() {
            vm.$off(event, on);
            fn.apply(vm, arguments);
        }
        on.fn = fn;
        vm.$on(event, on);
        return vm;
    }

    Vue.prototype.$off = function (event ? : string | Array < string > , fn ? : Function): Component {
        const vm: Component = this;

        // 未传入参数时，直接清空所有的自定义事件
        if (!arguments.length) {
            vm._events = Object.create(null);
            return vm;
        }

        // 以数组形式传入事件名时, 递归调用该函数解除函数绑定
        if (Array.isArray(event)) {
            for (let i = 0, l = event.length; i < l; i++) {
                vm.$off(event[i], fn);
            }
            return vm;
        }

        // specific event
        // 指定单个具体函数名时，清空该名称下自定义事件的全部回调函数
        const cbs = vm._events[event];
        if (!cbs) {
            return vm;
        }
        if (!fn) {
            vm._events[event] = null;
            return vm;
        }

        // 如果具体指定了某个函数，则清空该事件名下指定的函数
        let cb;
        let i = cbs.length;
        while (i--) {
            cb = cbs[i];
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1);
                break;
            }
        }
        return vm;
    }

    Vue.prototype.$emit = function (event: string): Component {
        const vm: Component = this

        // 如果用户用大写的形式触发事件，恰好有该名称为小写的事件，那么warning用户
        if (process.env.NODE_ENV !== 'production') {
            const lowerCaseEvent = event.toLowerCase();
            if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
                tip(
                    `Event "${lowerCaseEvent}" is emitted in component ` +
                    `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
                    `Note that HTML attributes are case-insensitive and you cannot use ` +
                    `v-on to listen to camelCase events when using in-DOM templates. ` +
                    `You should probably use "${hyphenate(event)}" instead of "${event}".`
                )
            }
        }

        // 取出vm实例上该名称的事件数组
        let cbs = vm._events[event];
        if (cbs) {

            // 将类数组对象转换为数组对象
            cbs = cbs.length > 1 ? toArray(cbs) : cbs;

            // 用户传入的参数
            const args = toArray(arguments, 1);
            const info = `event handler for "${event}"`;

            // 遍历调用该自定义事件的全部回调函数
            for (let i = 0, l = cbs.length; i < l; i++) {
                invokeWithErrorHandling(cbs[i], vm, args, vm, info);
            }
        }
        return vm;
    }
}