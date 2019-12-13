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
    // // 占位符VNode节点，即我们在父级上下文中使用的那个组件标签所代表的的VNode
    const parentVnode = vm.$vnode = options._parentVnode;

    // 组件Vnode所在的vm实例上下文
    const renderContext = parentVnode && parentVnode.context;

    // _renderChildren表示VNode在父级上下文中里面的子VNode节点数组(即插槽内容)
    // 这里是在处理2.5语法，对于2.6语法，只处理简写的插槽语法(即无任何具名插槽)
    vm.$slots = resolveSlots(options._renderChildren, renderContext);

    // 初始化作用域插槽对象
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
    // 暴露出$attrs和$listeners两个属性以便创建高阶组件
    // 它们需要变为响应式的，以便响应式更新
    // 组件VNode节点上的属性
    const parentData = parentVnode && parentVnode.data

    if (process.env.NODE_ENV !== 'production') {

        // 在当前组件实例上定义$attrs属性(即我们定义在组件标签上的属性)
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
        }, true);

        // 在当前组件实例上定义$listeners属性(即我们定义在组件标签上的事件监听器)
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

            // 当前组件vm实例所在父级上下文中的组件标签VNode
            _parentVnode
        } = vm.$options

        // 存在父节点时(根Vue实例不存在)
        if (_parentVnode) {

            // 为组件实例.$scopedSlots定义一个可以访问$slots的对象
            vm.$scopedSlots = normalizeScopedSlots(

                // 当前组件vm实例所代表的VNode上的作用域插槽对象
                _parentVnode.data.scopedSlots,

                // 当前组件vm的总体的插槽对象(该对象只在2.5版本旧语法slot的情况下存在)
                vm.$slots,

                // 当前组件vm实例的作用域插槽对象
                vm.$scopedSlots
            )
        }

        // set parent vnode. this allows render functions to have access
        // to the data on the placeholder node.
        // 设置父节点，这允许渲染函数可以通过该节点来访问父节点上的data
        vm.$vnode = _parentVnode;

        // render self
        let vnode;
        try {
            // There's no need to maintain a stack becaues all render fns are called
            // separately from one another. Nested component's render fns are called
            // when parent component is patched.
            // 这里没有必要去维护一个栈，因为所有渲染函数会独立调用。
            // 嵌套的组件渲染函数会在其父组件打补丁时进行渲染
            currentRenderingInstance = vm;

            // 调用渲染函数，生成我们根Vue实例的Vnode节点们
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

            // 清空当前渲染的实例
            currentRenderingInstance = null
        }

        // if the returned array contains only a single node, allow it
        // 如果返回的节点数组中只存在一个节点，则承认它，如果返回多个根节点，那么对不起报错
        if (Array.isArray(vnode) && vnode.length === 1) {
            vnode = vnode[0]
        }

        // return empty vnode in case the render function errored out
        // 不允许有多个根节点，此时返回空的VNode节点以防渲染函数出错
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
        // 设置该节点的parent，为该vm实例的占位符。
        vnode.parent = _parentVnode
        return vnode;
    }
}