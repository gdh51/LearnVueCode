/* @flow */

import {
    hasOwn
} from 'shared/util'
import {
    warn,
    hasSymbol
} from '../util/index'
import {
    defineReactive,
    toggleObserving
} from '../observer/index'

export function initProvide(vm: Component) {
    const provide = vm.$options.provide
    if (provide) {
        vm._provided = typeof provide === 'function' ?
            provide.call(vm) :
            provide
    }
}

export function initInjections(vm: Component) {

    // 找到inject中所有的key值在祖先vm实例中的函数，返回一个键值对象
    const result = resolveInject(vm.$options.inject, vm);
    if (result) {
        // 关闭响应项收集
        toggleObserving(false);

        // 遍历定义响应式属性，如果在是开发模式，还要添加一个自定义setter来禁止用户修改
        Object.keys(result).forEach(key => {
            if (process.env.NODE_ENV !== 'production') {
                defineReactive(vm, key, result[key], () => {
                    warn(
                        `Avoid mutating an injected value directly since the changes will be ` +
                        `overwritten whenever the provided component re-renders. ` +
                        `injection being mutated: "${key}"`,
                        vm
                    )
                })
            } else {
                defineReactive(vm, key, result[key])
            }
        })
        toggleObserving(true);
    }
}

export function resolveInject(inject: any, vm: Component): ? Object {
    if (inject) {
        // inject is :any because flow is not smart enough to figure out cached
        const result = Object.create(null);
        const keys = hasSymbol ? Reflect.ownKeys(inject) : Object.keys(inject);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // #6574 in case the inject object is observed...
            if (key === '__ob__') continue;
            const provideKey = inject[key].from;
            let source = vm;

            // 迭代，找到第一个祖先组件provided属性上该名的方法
            while (source) {
                if (source._provided && hasOwn(source._provided, provideKey)) {
                    result[key] = source._provided[provideKey]
                    break
                }
                source = source.$parent;
            }

            // 找到根组件都没有，查看是否配置有默认属性，
            // 如果有配置默认属性，则使用默认属性中的函数，否则报错
            if (!source) {
                if ('default' in inject[key]) {
                    const provideDefault = inject[key].default;
                    result[key] = typeof provideDefault === 'function' ?
                        provideDefault.call(vm) :
                        provideDefault
                } else if (process.env.NODE_ENV !== 'production') {
                    warn(`Injection "${key}" not found`, vm)
                }
            }
        }
        return result;
    }
}