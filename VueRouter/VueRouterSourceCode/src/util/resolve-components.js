/* @flow */

import {
    _Vue
} from '../install'
import {
    warn,
    isError
} from './warn'

// 加载异步组件，从该函数我们可以看到异步组件是一个并行加载的流程
export function resolveAsyncComponents(matched: Array < RouteRecord > ): Function {
    return (to, from, next) => {

        // 是否为异步组件(默认不是)
        let hasAsync = false;

        // 加载状态，0为完成，大于1表示在进行异步加载
        let pending = 0;
        let error = null;

        flatMapComponents(matched, (def, _, match, key) => {

            // if it's a function and doesn't have cid attached,
            // assume it's an async component resolve function.
            // 如果其为一个没有cid的函数(即未注册的组件)，则假设其为一个异步解析组件函数
            // we are not using Vue's default async resolving mechanism because
            // we want to halt the navigation until the incoming component has been
            // resolved.
            // 我们不使用Vue默认的异步解析机制，因为我们要在加载这个组件时中断路由的导航，
            // 待组件加载完毕后在继续路由导航的跳转
            if (typeof def === 'function' && def.cid === undefined) {
                hasAsync = true
                pending++

                const resolve = once(resolvedDef => {
                    if (isESModule(resolvedDef)) {
                        resolvedDef = resolvedDef.default
                    }

                    // save resolved on async factory in case it's used elsewhere
                    // 创建组件构造函数
                    def.resolved = typeof resolvedDef === 'function' ?
                        resolvedDef :
                        _Vue.extend(resolvedDef);

                    // 配置命名视图组件构造函数
                    match.components[key] = resolvedDef
                    pending--;

                    // 全部异步组件加载完毕时，进行下一个hook的调用
                    if (pending <= 0) {
                        next()
                    }
                })

                const reject = once(reason => {
                    const msg = `Failed to resolve async component ${key}: ${reason}`
                    process.env.NODE_ENV !== 'production' && warn(false, msg)
                    if (!error) {
                        error = isError(reason) ?
                            reason :
                            new Error(msg)
                        next(error)
                    }
                })

                let res
                try {

                    // 这里说明不仅仅可以通过import来导入组件，
                    // 我们也可以自定义导入行为，手动年来resolve组件的载入
                    res = def(resolve, reject)
                } catch (e) {
                    reject(e)
                }

                // 是否返回一个值，异步组件必须返回一个值这个值必须为Promise对象，
                // 或含有Promise对象
                if (res) {

                    // 当返回一个promise对象时，链式调用上面定义的resolve函数
                    if (typeof res.then === 'function') {
                        res.then(resolve, reject)
                    } else {
                        // new syntax in Vue 2.3
                        const comp = res.component
                        if (comp && typeof comp.then === 'function') {
                            comp.then(resolve, reject)
                        }
                    }
                }
            }
        })

        // 如果不存在仍和异步组件，则直接进行下一个hook
        if (!hasAsync) next()
    }
}

export function flatMapComponents(
    matched: Array < RouteRecord > ,
    fn: Function
): Array < ? Function > {

    // 对每个路由记录调用类似数组的forEach方法，分别传入组件配置、具体实例
    return flatten(matched.map(m => {

        // 遍历命名视图路由，对对应组件和实例调用fn回调,
        // 此处的fn实际为返回这些组件中名为key的导航守卫
        return Object.keys(m.components).map(key => fn(
            m.components[key],
            m.instances[key],
            m,
            key
        ))
    }))
}

// 扁平化一层arr数组
export function flatten(arr: Array < any > ): Array < any > {
    return Array.prototype.concat.apply([], arr)
}

const hasSymbol =
    typeof Symbol === 'function' &&
    typeof Symbol.toStringTag === 'symbol'

function isESModule(obj) {
    return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once(fn) {
    let called = false
    return function (...args) {
        if (called) return
        called = true
        return fn.apply(this, args)
    }
}