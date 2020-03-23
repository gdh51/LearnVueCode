/* @flow */

import {
    createRoute,
    isSameRoute,
    isIncludedRoute
} from '../util/route'
import {
    extend
} from '../util/misc'
import {
    normalizeLocation
} from '../util/location'
import {
    warn
} from '../util/warn'

// work around weird flow bug
const toTypes: Array < Function > = [String, Object]
const eventTypes: Array < Function > = [String, Array]

const noop = () => {}

export default {
    name: 'RouterLink',
    props: {

        // 跳转的路由地址信息
        to: {
            type: toTypes,
            required: true
        },

        // 希望该组件表达的元素
        tag: {
            type: String,
            default: 'a'
        },

        // 是否精准激活(不匹配子路径)
        exact: Boolean,

        // 是否为相对路径形式添加path(就是和./一样)
        append: Boolean,

        // 是否用replace代替push(导航后不会留下记录)
        replace: Boolean,

        // 当前被点击时添加的class
        activeClass: String,

        // 被精准激活时添加的class
        exactActiveClass: String,

        // 修改触发的事件类型
        event: {
            type: eventTypes,
            default: 'click'
        }
    },
    render(h: Function) {

        // 获取路由表，和当前路径信息对象
        const router = this.$router

        // 当前路径的路由记录对象
        const current = this.$route
        const {
            location,
            route,
            href
        } = router.resolve(
            this.to,
            current,
            this.append
        );

        const classes = {}

        // 获取全局的class
        const globalActiveClass = router.options.linkActiveClass
        const globalExactActiveClass = router.options.linkExactActiveClass
        // Support global empty active class
        const activeClassFallback =
            globalActiveClass == null ? 'router-link-active' : globalActiveClass
        const exactActiveClassFallback =
            globalExactActiveClass == null ?
            'router-link-exact-active' :
            globalExactActiveClass
        const activeClass =
            this.activeClass == null ? activeClassFallback : this.activeClass
        const exactActiveClass =
            this.exactActiveClass == null ?
            exactActiveClassFallback :
            this.exactActiveClass

        const compareTarget = route.redirectedFrom ?
            createRoute(null, normalizeLocation(route.redirectedFrom), null, router) :
            route

        // 是否为相同路由跳转
        classes[exactActiveClass] = isSameRoute(current, compareTarget)
        classes[activeClass] = this.exact ?
            classes[exactActiveClass] :

            // 后者是否为前者的子路由
            isIncludedRoute(current, compareTarget)

        const handler = e => {
            if (guardEvent(e)) {
                if (this.replace) {
                    router.replace(location, noop)
                } else {
                    router.push(location, noop)
                }
            }
        }

        // 默认添加点击事情
        const on = {
            click: guardEvent
        }
        if (Array.isArray(this.event)) {
            this.event.forEach(e => {
                on[e] = handler
            })
        } else {
            on[this.event] = handler
        }

        const data: any = {
            class: classes
        }

        // 有插槽时，将属性传递给插槽元素
        const scopedSlot = !this.$scopedSlots.$hasNormal &&
            this.$scopedSlots.default &&
            this.$scopedSlots.default({
                href,
                route,
                navigate: handler,
                isActive: classes[activeClass],
                isExactActive: classes[exactActiveClass]
            })

        if (scopedSlot) {

            // 当插入一个时，直接返回
            if (scopedSlot.length === 1) {
                return scopedSlot[0];

            // 插入了多个插槽元素
            } else if (scopedSlot.length > 1 || !scopedSlot.length) {
                if (process.env.NODE_ENV !== 'production') {
                    warn(
                        false,
                        `RouterLink with to="${
              this.to
            }" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.`
                    )
                }
                return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
            }
        }

        // 默认使用a标签做包裹元素
        if (this.tag === 'a') {
            data.on = on
            data.attrs = {
                href
            }
        } else {

            // find the first <a> child and apply listener and href
            // 找到第一个a标签为其添加事件监听器！
            const a = findAnchor(this.$slots.default)
            if (a) {
                // in case the <a> is a static node
                // 防止该元素被作为一个静态节点
                a.isStatic = false

                // 为该节点整上路由的属性
                const aData = (a.data = extend({}, a.data))
                aData.on = aData.on || {}
                // transform existing events in both objects into arrays so we can push later
                for (const event in aData.on) {
                    const handler = aData.on[event]
                    if (event in on) {
                        aData.on[event] = Array.isArray(handler) ? handler : [handler]
                    }
                }
                // append new listeners for router-link
                for (const event in on) {
                    if (event in aData.on) {
                        // on[event] is always a function
                        aData.on[event].push(on[event])
                    } else {
                        aData.on[event] = handler
                    }
                }

                const aAttrs = (a.data.attrs = extend({}, a.data.attrs))
                aAttrs.href = href
            } else {

                // doesn't have <a> child, apply listener to self
                // 如果不是a标签，则整在定义的元素上
                data.on = on
            }
        }

        return h(this.tag, data, this.$slots.default)
    }
}

function guardEvent(e) {
    // don't redirect with control keys
    if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
    // don't redirect when preventDefault called
    if (e.defaultPrevented) return
    // don't redirect on right click
    if (e.button !== undefined && e.button !== 0) return
    // don't redirect if `target="_blank"`
    if (e.currentTarget && e.currentTarget.getAttribute) {
        const target = e.currentTarget.getAttribute('target')
        if (/\b_blank\b/i.test(target)) return
    }
    // this may be a Weex event which doesn't have this method
    if (e.preventDefault) {
        e.preventDefault()
    }
    return true
}

// 从当前子节点数组中找到第一个a标签节点
function findAnchor(children) {
    if (children) {
        let child
        for (let i = 0; i < children.length; i++) {
            child = children[i]
            if (child.tag === 'a') {
                return child
            }
            if (child.children && (child = findAnchor(child.children))) {
                return child
            }
        }
    }
}