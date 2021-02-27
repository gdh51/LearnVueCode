/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import {
    warn,
    makeMap,
    isNative
} from '../util/index'

let initProxy

if (process.env.NODE_ENV !== 'production') {

    // 一个以下字段的hash表，在表中存在以下某个字段时返回true
    const allowedGlobals = makeMap(
        'Infinity,undefined,NaN,isFinite,isNaN,' +
        'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
        'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
        'require' // for Webpack/Browserify
    )

    // 一些警告函数，用于Proxy的拦截
    const warnNonPresent = (target, key) => {
        warn(
            `Property or method "${key}" is not defined on the instance but ` +
            'referenced during render. Make sure that this property is reactive, ' +
            'either in the data option, or for class-based components, by ' +
            'initializing the property. ' +
            'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
            target
        )
    }

    const warnReservedPrefix = (target, key) => {
        warn(
            `Property "${key}" must be accessed with "$data.${key}" because ` +
            'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
            'prevent conflicts with Vue internals' +
            'See: https://vuejs.org/v2/api/#data',
            target
        )
    }

    const hasProxy =
        typeof Proxy !== 'undefined' && isNative(Proxy)

    if (hasProxy) {
        const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
        config.keyCodes = new Proxy(config.keyCodes, {
            set(target, key, value) {
                if (isBuiltInModifier(key)) {
                    warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
                    return false
                } else {
                    target[key] = value
                    return true
                }
            }
        })
    }

    const hasHandler = {
        has(target, key) {

            // 是否存在该访问字段
            const has = key in target

            // 查看该字段是否为全局变量（允许访问全局变量）
            const isAllowed = allowedGlobals(key) ||

                // 以_开头但不定义在data中属性
                (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))

            // 如果是空属性或非法属性
            if (!has && !isAllowed) {
                if (key in target.$data) warnReservedPrefix(target, key)
                else warnNonPresent(target, key)
            }
            return has || !isAllowed
        }
    }

    const getHandler = {
        get(target, key) {

            // 当前VM实例上无该key字段（要么是没代理上来，要么是真没有该字段）
            if (typeof key === 'string' && !(key in target)) {

                // 如果该字段存在于data中，那说明该字段用了内部命名形式命名_/$
                if (key in target.$data) warnReservedPrefix(target, key)

                // 缺失该字段，报错
                else warnNonPresent(target, key)
            }
            return target[key]
        }
    }

    initProxy = function initProxy(vm) {
        if (hasProxy) {
            // determine which proxy handler to use
            const options = vm.$options

            // 是否为webpack运行时通过template编译的render函数
            const handlers = options.render && options.render._withStripped ?
                getHandler :
                hasHandler
            vm._renderProxy = new Proxy(vm, handlers)
        } else {
            vm._renderProxy = vm
        }
    }
}

export {
    initProxy
}