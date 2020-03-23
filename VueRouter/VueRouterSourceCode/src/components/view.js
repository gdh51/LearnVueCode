import {
    warn
} from '../util/warn'
import {
    extend
} from '../util/misc'

export default {
    name: 'RouterView',

    // 函数组件，无vm实例哦
    functional: true,

    // 指定命名路由
    props: {
        name: {
            type: String,
            default: 'default'
        }
    },
    render(_, {
        props,
        children,
        parent,
        data
    }) {
        // used by devtools to display a router-view badge
        data.routerView = true

        // directly use parent context's createElement() function
        // so that components rendered by router-view can resolve named slots
        // 这里我们使用父级上下文的渲染函数！以便组件可以通过name属性来进行渲染
        const h = parent.$createElement
        const name = props.name

        // 获取当前的路由信息！
        const route = parent.$route

        // 缓存使用过的组件！
        const cache = parent._routerViewCache || (parent._routerViewCache = {})

        // determine current view depth, also check to see if the tree
        // has been toggled inactive but kept-alive.
        // 查看当前router-view的深度！同样检查该节点树是否被kept-alive组件设为不活跃
        let depth = 0;
        let inactive = false;

        // 迭代查找直到挂载路由的根组件之间有几个router-view
        while (parent && parent._routerRoot !== parent) {
            const vnodeData = parent.$vnode ? parent.$vnode.data : {}
            if (vnodeData.routerView) {
                depth++
            }

            // 如果中途存在未激活的kept-alve组件，则将其激活
            if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
                inactive = true
            }
            parent = parent.$parent
        }

        // 记录当前router-view所在的深度
        data.routerViewDepth = depth

        // render previous view if the tree is inactive and kept-alive
        // 如果当前是激活的kept-alive组件，那么使用缓存中的组件
        if (inactive) {

            // 获取原始组件配置对象
            const cachedData = cache[name];
            const cachedComponent = cachedData && cachedData.component;


            if (cachedComponent) {
                // #2301
                // pass props
                if (cachedData.configProps) {
                    fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps)
                }
                return h(cachedComponent, data, children)
            } else {
                // render previous empty view
                return h()
            }
        }

        // 获取对应深度下的路径路径对象
        const matched = route.matched[depth];

        // 如果指定路由名称，则直接获取对象组件
        const component = matched && matched.components[name]

        // render empty node if no matched route or no config component
        // 无匹配，则清空缓存并返回空节点
        if (!matched || !component) {
            cache[name] = null
            return h()
        }

        // cache component
        // 缓存当前的组件
        cache[name] = {
            component
        }

        // attach instance registration hook
        // this will be called in the instance's injected lifecycle hooks
        // 将使用过的实例缓存在instance中
        data.registerRouteInstance = (vm, val) => {

            // val could be undefined for unregistration
            // 当值为undefined时可以用来注销实例
            const current = matched.instances[name]
            if (
                (val && current !== vm) ||
                (!val && current === vm)
            ) {
                matched.instances[name] = val
            }
        }

        // also register instance in prepatch hook
        // in case the same component instance is reused across different routes
        // 同时在prepatch钩子函数中将vm实例缓存起来，以便复用
        ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
            matched.instances[name] = vnode.componentInstance
        }

        // register instance in init hook
        // in case kept-alive component be actived when routes changed
        // 在初始化函数中也缓存实例，以便kept-alive组件也可以触发
        data.hook.init = (vnode) => {
            if (vnode.data.keepAlive &&
                vnode.componentInstance &&
                vnode.componentInstance !== matched.instances[name]
            ) {
                matched.instances[name] = vnode.componentInstance
            }
        }

        const configProps = matched.props && matched.props[name];

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
    let propsToPass = data.props = resolveProps(route, configProps)
    if (propsToPass) {
        // clone to prevent mutation
        propsToPass = data.props = extend({}, propsToPass)
        // pass non-declared props as attrs
        const attrs = data.attrs = data.attrs || {}
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