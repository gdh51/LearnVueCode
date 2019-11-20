/* @flow */

import {
    warn,
    nextTick,
    emptyObject,
    handleError,
    defineReactive
} from '../util/index'

import {
    createElement
} from '../vdom/create-element'
import {
    installRenderHelpers
} from './render-helpers/index'
import {
    resolveSlots
} from './render-helpers/resolve-slots'
import {
    normalizeScopedSlots
} from '../vdom/helpers/normalize-scoped-slots'
import VNode, {
    createEmptyVNode
} from '../vdom/vnode'

import {
    isUpdatingChildComponent
} from './lifecycle'

export function initRender(vm: Component) {

    // 该vm实例的根Vnode
    vm._vnode = null; // the root of the child tree

    // 用于存储v-once渲染的vnode片段
    vm._staticTrees = null; // v-once cached trees
    const options = vm.$options;

    // the placeholder node in parent tree
    // 代表父Vnode树的占位符
    const parentVnode = vm.$vnode = options._parentVnode;

    // 父级Vnode片段的上下文
    const renderContext = parentVnode && parentVnode.context;

    // 将最新的插槽，和父级上下文作为参数
    vm.$slots = resolveSlots(options._renderChildren, renderContext);
    vm.$scopedSlots = emptyObject;

    // bind the createElement fn to this instance
    // so that we get proper render context inside it.
    // args order: tag, data, children, normalizationType, alwaysNormalize
    // internal version is used by render functions compiled from templates
    // 定义一些渲染相关的方法
    vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
    // normalization is always applied for the public version, used in
    // user-written render functions.
    vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

    // $attrs & $listeners are exposed for easier HOC creation.
    // they need to be reactive so that HOCs using them are always updated
    // 定义响应式的$attr,$listeners以便更新
    const parentData = parentVnode && parentVnode.data

    if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
        }, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
        }, true)
    } else {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
    }
}

export let currentRenderingInstance: Component | null = null

// for testing only
export function setCurrentRenderingInstance(vm: Component) {
    currentRenderingInstance = vm
}

export function renderMixin(Vue: Class < Component > ) {

    // install runtime convenience helpers
    //绑定与渲染有关的实例方法
    installRenderHelpers(Vue.prototype)

    Vue.prototype.$nextTick = function (fn: Function) {
        return nextTick(fn, this)
    }

    Vue.prototype._render = function (): VNode {
        const vm: Component = this;

        // 获取渲染函数和其父节点
        const {
            render,
            _parentVnode
        } = vm.$options

        // 存在父节点时，
        if (_parentVnode) {
            vm.$scopedSlots = normalizeScopedSlots(
                _parentVnode.data.scopedSlots,

                // 当前vm实例的具名插槽
                vm.$slots,

                // 当前vm实例的作用域插槽
                vm.$scopedSlots
            )
        }

        // set parent vnode. this allows render functions to have access
        // to the data on the placeholder node.
        vm.$vnode = _parentVnode
        // render self
        let vnode
        try {
            // There's no need to maintain a stack becaues all render fns are called
            // separately from one another. Nested component's render fns are called
            // when parent component is patched.
            currentRenderingInstance = vm
            vnode = render.call(vm._renderProxy, vm.$createElement)
        } catch (e) {
            handleError(e, vm, `render`)
            // return error render result,
            // or previous vnode to prevent render error causing blank component
            /* istanbul ignore else */
            if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
                try {
                    vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
                } catch (e) {
                    handleError(e, vm, `renderError`)
                    vnode = vm._vnode
                }
            } else {
                vnode = vm._vnode
            }
        } finally {
            currentRenderingInstance = null
        }
        // if the returned array contains only a single node, allow it
        if (Array.isArray(vnode) && vnode.length === 1) {
            vnode = vnode[0]
        }
        // return empty vnode in case the render function errored out
        if (!(vnode instanceof VNode)) {
            if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
                warn(
                    'Multiple root nodes returned from render function. Render function ' +
                    'should return a single root node.',
                    vm
                )
            }
            vnode = createEmptyVNode()
        }
        // set parent
        vnode.parent = _parentVnode
        return vnode
    }
}