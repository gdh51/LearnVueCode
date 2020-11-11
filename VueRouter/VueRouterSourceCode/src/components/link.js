/* @flow */

import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'
import { extend } from '../util/misc'
import { normalizeLocation } from '../util/location'
import { warn } from '../util/warn'

// work around weird flow bug
const toTypes: Array<Function> = [String, Object]
const eventTypes: Array<Function> = [String, Array]

const noop = () => {}

export default {
    name: 'RouterLink',
    props: {
        // 跳转的Raw Location
        to: {
            type: toTypes,
            required: true
        },

        // 默认渲染的标签
        tag: {
            type: String,
            default: 'a'
        },

        // 当前路径是否精准匹配该Raw Location对象·？设置该属性时仅精准匹配时
        // 才添加激活的class
        exact: Boolean,

        // 是否将当前的to.path直接添加在路径后面
        append: Boolean,

        // 浏览器切换路由的行为，是否采用replace行为
        replace: Boolean,

        // 当前router-link的to被当前路径匹配时添加的class
        activeClass: String,
        exactActiveClass: String,

        // 辅助功能，可以不关注
        ariaCurrentValue: {
            type: String,
            default: 'page'
        },

        // 触发导航的事件类型
        event: {
            type: eventTypes,
            default: 'click'
        }
    },
    render(h: Function) {
        // 提取当前所在路径的Route
        const router = this.$router
        const current = this.$route

        // 获取关于要跳转Raw Location生成的各种信息
        const { location, route, href } = router.resolve(
            this.to,
            current,
            this.append
        )

        const classes = {}

        // 默认激活时，添加的class
        const globalActiveClass = router.options.linkActiveClass

        // 默认精准激活时，添加的class
        const globalExactActiveClass = router.options.linkExactActiveClass
        // Support global empty active class
        // 降级，允许不指定全局的默认值
        const activeClassFallback =
            globalActiveClass == null ? 'router-link-active' : globalActiveClass
        const exactActiveClassFallback =
            globalExactActiveClass == null
                ? 'router-link-exact-active'
                : globalExactActiveClass

        // 有独立的指定值时使用独立的指定值
        const activeClass =
            this.activeClass == null ? activeClassFallback : this.activeClass
        const exactActiveClass =
            this.exactActiveClass == null
                ? exactActiveClassFallback
                : this.exactActiveClass

        // 如果未重定向则·创建新的Route
        const compareTarget = route.redirectedFrom
            ? createRoute(
                  null,
                  normalizeLocation(route.redirectedFrom),
                  null,
                  router
              )
            : route

        // 当前的Route与to的匹配，则实装激活的class
        classes[exactActiveClass] = isSameRoute(current, compareTarget)

        // 非精准匹配时，包含即应用对应的class
        classes[activeClass] = this.exact
            ? classes[exactActiveClass]
            : isIncludedRoute(current, compareTarget)

        const ariaCurrentValue = classes[exactActiveClass]
            ? this.ariaCurrentValue
            : null

        // 点击跳转的路由事件
        const handler = e => {
            if (guardEvent(e)) {
                // Route切换
                if (this.replace) {
                    router.replace(location, noop)
                } else {
                    router.push(location, noop)
                }
            }
        }

        const on = { click: guardEvent }

        // 多类型时，为每个类型添加
        if (Array.isArray(this.event)) {
            this.event.forEach(e => {
                on[e] = handler
            })
        } else {
            on[this.event] = handler
        }

        const data: any = { class: classes }

        // 使用作用域插槽时，为其传递相关的信息
        const scopedSlot =
            !this.$scopedSlots.$hasNormal &&
            this.$scopedSlots.default &&
            this.$scopedSlots.default({
                href,
                route,
                navigate: handler,
                isActive: classes[activeClass],
                isExactActive: classes[exactActiveClass]
            })

        // 使用作用域插槽时，导航行为要自己定义
        if (scopedSlot) {
            // 只允许用户传递具有根节点的插槽内容，因为要添加事件
            if (scopedSlot.length === 1) {
                return scopedSlot[0]

                // 多个节点时创建一个span元素包裹
            } else if (scopedSlot.length > 1 || !scopedSlot.length) {
                if (process.env.NODE_ENV !== 'production') {
                    warn(
                        false,
                        `RouterLink with to="${this.to}" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.`
                    )
                }
                return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
            }
        }

        // 默认使用a元素
        if (this.tag === 'a') {
            data.on = on
            data.attrs = { href, 'aria-current': ariaCurrentValue }
        } else {
            // find the first <a> child and apply listener and href
            // 使用非作用域插槽时，找到第一个a元素为其应用导航行为
            const a = findAnchor(this.$slots.default)
            if (a) {
                // in case the <a> is a static node
                // 防止a是静态节点
                a.isStatic = false
                const aData = (a.data = extend({}, a.data))
                aData.on = aData.on || {}
                // transform existing events in both objects into arrays so we can push later
                // 将事件的装载形式统一转换为数组方便处理
                for (const event in aData.on) {
                    const handler = aData.on[event]
                    if (event in on) {
                        aData.on[event] = Array.isArray(handler)
                            ? handler
                            : [handler]
                    }
                }
                // append new listeners for router-link
                // 将路由的事件添加到同类型事件的最后
                for (const event in on) {
                    if (event in aData.on) {
                        // on[event] is always a function
                        aData.on[event].push(on[event])
                    } else {
                        aData.on[event] = handler
                    }
                }

                // 继承原attrs并写入新的href与aria-curreent
                const aAttrs = (a.data.attrs = extend({}, a.data.attrs))
                aAttrs.href = href
                aAttrs['aria-current'] = ariaCurrentValue
            } else {
                // doesn't have <a> child, apply listener to self
                data.on = on
            }
        }

        return h(this.tag, data, this.$slots.default)
    }
}

// 导航函数，决定是否导航
function guardEvent(e) {
    // don't redirect with control keys
    if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
    // don't redirect when preventDefault called
    // 如果已被阻止默认行为则不进行导航
    if (e.defaultPrevented) return
    // don't redirect on right click
    // 鼠标右键不触发
    if (e.button !== undefined && e.button !== 0) return
    // don't redirect if `target="_blank"`
    // 以新开窗口的形式不触发
    if (e.currentTarget && e.currentTarget.getAttribute) {
        const target = e.currentTarget.getAttribute('target')
        if (/\b_blank\b/i.test(target)) return
    }
    // this may be a Weex event which doesn't have this method
    if (e.preventDefault) {
        // 阻止a标签默认行为
        e.preventDefault()
    }
    return true
}

// 找到第一个锚点元素
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
