import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default {
    name: 'RouterView',
    functional: true,
    props: {
        name: {
            type: String,
            default: 'default'
        }
    },
    render(_, { props, children, parent, data }) {
        // used by devtools to display a router-view badge
        // 在devtools中标记为router-view
        data.routerView = true

        // directly use parent context's createElement() function
        // so that components rendered by router-view can resolve named slots
        // 直接使用父级上下文的createElement，这样router-view就可以处理命名插槽
        const h = parent.$createElement

        // 获取router-view的命名视图名称
        const name = props.name

        // 获取当前的Route
        const route = parent.$route

        // 做view缓存
        const cache = parent._routerViewCache || (parent._routerViewCache = {})

        // determine current view depth, also check to see if the tree
        // has been toggled inactive but kept-alive.
        // 判断当前view所处于的深度，同时查看当前组件是否处于失活的kept-alive中
        let depth = 0
        let inactive = false

        // 从当前组件开始，一直找到根Router挂载的组件
        while (parent && parent._routerRoot !== parent) {
            // 查看当前组件实例的占位节点属性
            const vnodeData = parent.$vnode ? parent.$vnode.data : {}

            查看当前组件是否为routerView组件的持有者
            if (vnodeData.routerView) {
                // 如果是，那么记录当前组件所处于的深度
                depth++
            }

            if (
                vnodeData.keepAlive &&
                parent._directInactive &&
                parent._inactive
            ) {
                inactive = true
            }
            parent = parent.$parent
        }
        data.routerViewDepth = depth

        // render previous view if the tree is inactive and kept-alive
        if (inactive) {
            const cachedData = cache[name]
            const cachedComponent = cachedData && cachedData.component
            if (cachedComponent) {
                // #2301
                // pass props
                if (cachedData.configProps) {
                    fillPropsinData(
                        cachedComponent,
                        data,
                        cachedData.route,
                        cachedData.configProps
                    )
                }
                return h(cachedComponent, data, children)
            } else {
                // render previous empty view
                return h()
            }
        }

        const matched = route.matched[depth]
        const component = matched && matched.components[name]

        // render empty node if no matched route or no config component
        if (!matched || !component) {
            cache[name] = null
            return h()
        }

        // cache component
        cache[name] = { component }

        // attach instance registration hook
        // this will be called in the instance's injected lifecycle hooks
        data.registerRouteInstance = (vm, val) => {
            // val could be undefined for unregistration
            const current = matched.instances[name]
            if ((val && current !== vm) || (!val && current === vm)) {
                matched.instances[name] = val
            }
        }

        // also register instance in prepatch hook
        // in case the same component instance is reused across different routes
        ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
            matched.instances[name] = vnode.componentInstance
        }

        // register instance in init hook
        // in case kept-alive component be actived when routes changed
        data.hook.init = vnode => {
            if (
                vnode.data.keepAlive &&
                vnode.componentInstance &&
                vnode.componentInstance !== matched.instances[name]
            ) {
                matched.instances[name] = vnode.componentInstance
            }
        }

        const configProps = matched.props && matched.props[name]
        // save route and configProps in cachce
        if (configProps) {
            extend(cache[name], {
                route,
                configProps
            })
            fillPropsinData(component, data, route, configProps)
        }

        return h(component, data, children)
    }
}

function fillPropsinData(component, data, route, configProps) {
    // resolve props
    let propsToPass = (data.props = resolveProps(route, configProps))
    if (propsToPass) {
        // clone to prevent mutation
        propsToPass = data.props = extend({}, propsToPass)
        // pass non-declared props as attrs
        const attrs = (data.attrs = data.attrs || {})
        for (const key in propsToPass) {
            if (!component.props || !(key in component.props)) {
                attrs[key] = propsToPass[key]
                delete propsToPass[key]
            }
        }
    }
}

function resolveProps(route, config) {
    switch (typeof config) {
        case 'undefined':
            return
        case 'object':
            return config
        case 'function':
            return config(route)
        case 'boolean':
            return config ? route.params : undefined
        default:
            if (process.env.NODE_ENV !== 'production') {
                warn(
                    false,
                    `props in "${route.path}" is a ${typeof config}, ` +
                        `expecting an object, function or boolean.`
                )
            }
    }
}
