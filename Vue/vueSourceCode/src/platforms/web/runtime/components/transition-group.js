/* @flow */

// Provides transition support for list items.
// supports move transitions using the FLIP technique.

// Because the vdom's children update algorithm is "unstable" - i.e.
// it doesn't guarantee the relative positioning of removed elements,
// we force transition-group to update its children into two passes:
// in the first pass, we remove all nodes that need to be removed,
// triggering their leaving transition; in the second pass, we insert/move
// into the final desired state. This way in the second pass removed
// nodes will remain where they should be.

// VDOM的更新算法是不稳定的，即它不能保证准确的移除对应位置的元素
// 我们强制transition-group通过两步去更新它们的子元素
// 1. 我们移除所以需要被移除的元素，并处罚它们的移除动画
// 2. 将要插入的元素和移动的元素移动到对应位置
// 这样在第二部被移除的节点就会在它该在的位置

import { warn, extend } from 'core/util/index'
import { addClass, removeClass } from '../class-util'
import { transitionProps, extractTransitionData } from './transition'
import { setActiveInstance } from 'core/instance/lifecycle'

import {
    hasTransition,
    getTransitionInfo,
    transitionEndEvent,
    addTransitionClass,
    removeTransitionClass
} from '../transition-util'

const props = extend(
    {
        tag: String,
        moveClass: String
    },
    transitionProps
)

delete props.mode

export default {
    props,

    beforeMount() {
        const update = this._update
        this._update = (vnode, hydrating) => {
            const restoreActiveInstance = setActiveInstance(this)
            // force removing pass
            this.__patch__(
                this._vnode,
                this.kept,
                false, // hydrating
                true // removeOnly (!important, avoids unnecessary moves)
            )
            this._vnode = this.kept
            restoreActiveInstance()
            update.call(this, vnode, hydrating)
        }
    },

    render(h: Function) {
        const tag: string = this.tag || this.$vnode.data.tag || 'span'
        const map: Object = Object.create(null)

        // 上一次渲染时的子节点数组
        const prevChildren: Array<VNode> = (this.prevChildren = this.children)
        const rawChildren: Array<VNode> = this.$slots.default || []

        // 重置本次渲染的节点数组
        const children: Array<VNode> = (this.children = [])

        // 获取用户传入的过渡props信息
        const transitionData: Object = extractTransitionData(this)

        for (let i = 0; i < rawChildren.length; i++) {
            const c: VNode = rawChildren[i]

            // 进行渲染的列表必须定义key值
            if (c.tag) {
                if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
                    // 将当前的节点加入数组，并记录在map中
                    children.push(c)
                    map[c.key] = c
                    ;(c.data || (c.data = {})).transition = transitionData
                } else if (process.env.NODE_ENV !== 'production') {
                    const opts: ?VNodeComponentOptions = c.componentOptions
                    const name: string = opts
                        ? opts.Ctor.options.name || opts.tag || ''
                        : c.tag
                    warn(`<transition-group> children must be keyed: <${name}>`)
                }
            }
        }

        // 如果存在之前渲染状态
        if (prevChildren) {
            // 区分要移除的节点与要保留的节点，并获取它们的位置信息
            const kept: Array<VNode> = []
            const removed: Array<VNode> = []
            for (let i = 0; i < prevChildren.length; i++) {
                const c: VNode = prevChildren[i]
                c.data.transition = transitionData
                c.data.pos = c.elm.getBoundingClientRect()
                if (map[c.key]) {
                    kept.push(c)
                } else {
                    removed.push(c)
                }
            }

            this.kept = h(tag, null, kept)
            this.removed = removed
        }

        return h(tag, null, children)
    },

    updated() {
        // 获取渲染前的节点
        const children: Array<VNode> = this.prevChildren
        const moveClass: string = this.moveClass || (this.name || 'v') + '-move'

        // 如果无节点或当前节点正处于动画中则移除
        if (!children.length || !this.hasMove(children[0].elm, moveClass)) {
            return
        }

        // we divide the work into three loops to avoid mixing DOM reads and writes
        // in each iteration - which helps prevent layout thrashing.
        // 我们将其分为3个迭代来防止DOM的读写的同时进行（防止布局混乱）
        children.forEach(callPendingCbs)

        // 获取当前元素目前所在的位置(即已保留的元素在新的位置，未保留已经没了)
        children.forEach(recordPosition)

        // 为这些元素应用动画效果
        children.forEach(applyTranslation)

        // force reflow to put everything in position
        // assign to this to avoid being removed in tree-shaking
        // 强制刷新布局
        this._reflow = document.body.offsetHeight

        children.forEach((c: VNode) => {
            if (c.data.moved) {
                const el: any = c.elm
                const s: any = el.style

                // 添加过渡类
                addTransitionClass(el, moveClass)

                // 移除过渡信息
                s.transform = s.WebkitTransform = s.transitionDuration = ''

                // 订阅过渡完成事件，在过渡完成时移除过渡动画class
                el.addEventListener(
                    transitionEndEvent,
                    (el._moveCb = function cb(e) {
                        if (e && e.target !== el) {
                            return
                        }
                        if (!e || /transform$/.test(e.propertyName)) {
                            el.removeEventListener(transitionEndEvent, cb)
                            el._moveCb = null
                            removeTransitionClass(el, moveClass)
                        }
                    })
                )
            }
        })
    },

    methods: {
        hasMove(el: any, moveClass: string): boolean {
            if (!hasTransition) {
                return false
            }

            if (this._hasMove) {
                return this._hasMove
            }
            // Detect whether an element with the move class applied has
            // CSS transitions. Since the element may be inside an entering
            // transition at this very moment, we make a clone of it and remove
            // all other transition classes applied to ensure only the move class
            // is applied.
            const clone: HTMLElement = el.cloneNode()
            if (el._transitionClasses) {
                el._transitionClasses.forEach((cls: string) => {
                    removeClass(clone, cls)
                })
            }
            addClass(clone, moveClass)
            clone.style.display = 'none'
            this.$el.appendChild(clone)
            const info: Object = getTransitionInfo(clone)
            this.$el.removeChild(clone)
            return (this._hasMove = info.hasTransform)
        }
    }
}

function callPendingCbs(c: VNode) {
    /* istanbul ignore if */
    if (c.elm._moveCb) {
        c.elm._moveCb()
    }
    /* istanbul ignore if */
    if (c.elm._enterCb) {
        c.elm._enterCb()
    }
}

function recordPosition(c: VNode) {
    c.data.newPos = c.elm.getBoundingClientRect()
}

function applyTranslation(c: VNode) {
    const oldPos = c.data.pos
    const newPos = c.data.newPos
    const dx = oldPos.left - newPos.left
    const dy = oldPos.top - newPos.top
    if (dx || dy) {
        c.data.moved = true
        const s = c.elm.style
        s.transform = s.WebkitTransform = `translate(${dx}px,${dy}px)`
        s.transitionDuration = '0s'
    }
}
