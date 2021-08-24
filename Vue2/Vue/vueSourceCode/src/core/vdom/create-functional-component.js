/* @flow */

import VNode, {
    cloneVNode
} from './vnode'
import {
    createElement
} from './create-element'
import {
    resolveInject
} from '../instance/inject'
import {
    normalizeChildren
} from '../vdom/helpers/normalize-children'
import {
    resolveSlots
} from '../instance/render-helpers/resolve-slots'
import {
    normalizeScopedSlots
} from '../vdom/helpers/normalize-scoped-slots'
import {
    installRenderHelpers
} from '../instance/render-helpers/index'

import {
    isDef,
    isTrue,
    hasOwn,
    camelize,
    emptyObject,
    validateProp
} from '../util/index'

export function FunctionalRenderContext(

    //
    data: VNodeData,

    // 最终要传递给组件内部的props属性
    props: Object,

    // 组件中的插槽内容
    children: ? Array < VNode > ,

    // 父级vm实例
    parent : Component,

    // 函数组件的构造函数
    Ctor: Class < Component >
) {

    // 获取原组件配置
    const options = Ctor.options;

    // ensure the createElement function in functional components
    // gets a unique context - this is necessary for correct named slot check
    // 确保createElement函数能在函数式组件中获取一个唯一的上下文（确保插槽正确）
    let contextVm;

    // 确保父级上下文为vm实例
    if (hasOwn(parent, '_uid')) {
        contextVm = Object.create(parent);
        // $flow-disable-line
        contextVm._original = parent;
    } else {
        // the context vm passed in is a functional context as well.
        // in this case we want to make sure we are able to get a hold to the
        // real context instance.
        // 此时所处于的上下文也是函数式组件，我们要确保它在一个真实的vm实例中
        contextVm = parent;
        // $flow-disable-line
        parent = parent._original;
    }

    // 是否为template编译的render函数
    const isCompiled = isTrue(options._compiled);
    const needNormalization = !isCompiled;

    this.data = data;
    this.props = props;
    this.children = children;
    this.parent = parent;
    this.listeners = data.on || emptyObject;
    this.injections = resolveInject(options.inject, parent);
    this.slots = () => {

        // 初始化普通插槽
        if (!this.$slots) {

            // 处理简单插槽和作用域插槽
            normalizeScopedSlots(
                data.scopedSlots,
                this.$slots = resolveSlots(children, parent)
            )
        }
        return this.$slots;
    }

    Object.defineProperty(this, 'scopedSlots', ({
        enumerable: true,
        get() {

            // 返回最终处理完普通插槽和作用域插槽的结果
            return normalizeScopedSlots(data.scopedSlots, this.slots())
        }
    }: any))

    // support for compiled functional template
    // 支持template版本的函数式函数
    if (isCompiled) {
        // exposing $options for renderStatic()
        this.$options = options
        // pre-resolve slots for renderSlot()
        this.$slots = this.slots()
        this.$scopedSlots = normalizeScopedSlots(data.scopedSlots, this.$slots)
    }

    // 定义渲染函数，如果设置了css作用域则定义其作用域
    if (options._scopeId) {
        this._c = (a, b, c, d) => {
            const vnode = createElement(contextVm, a, b, c, d, needNormalization)
            if (vnode && !Array.isArray(vnode)) {
                vnode.fnScopeId = options._scopeId
                vnode.fnContext = parent
            }
            return vnode
        }
    } else {
        this._c = (a, b, c, d) => createElement(contextVm, a, b, c, d, needNormalization)
    }
}

installRenderHelpers(FunctionalRenderContext.prototype)

export function createFunctionalComponent(

    // 组件的构造函数
    Ctor: Class < Component > ,

    // 组件最终的props值
    propsData: ? Object,

    // 组件节点上的属性
    data : VNodeData,

    // 组件节点所处于的上下文的vm实例
    contextVm: Component,

    // 组件插槽中的节点
    children: ? Array < VNode >
): VNode | Array < VNode > | void {

    // 定义组件时的配置
    const options = Ctor.options;
    const props = {};
    const propOptions = options.props;

    // 用户是否定义props
    if (isDef(propOptions)) {

        // 定义时，效验props的最终值和类型
        // 这里就意味着除了定义的props属性，其余传递的属性要通过data.attrs查找
        for (const key in propOptions) {
            props[key] = validateProp(key, propOptions, propsData || emptyObject)
        }

    // 未定义props属性时，其余传递给组件的属性按attrs处理
    } else {
        if (isDef(data.attrs)) mergeProps(props, data.attrs)
        if (isDef(data.props)) mergeProps(props, data.props)
    }

    // 创建调用渲染函数时的上下文环境(this)
    const renderContext = new FunctionalRenderContext(
        data,
        props,
        children,
        contextVm,
        Ctor
    );

    // 调用函数式组件的构造函数，传入其上下文，直接返回其组件内容的VNode树
    const vnode = options.render.call(null, renderContext._c, renderContext);

    // 复制根VNode节点，并为其标记上下文环境，以下处理主要用于处理旧语法bug
    if (vnode instanceof VNode) {
        return cloneAndMarkFunctionalResult(vnode, data, renderContext.parent, options, renderContext)
    } else if (Array.isArray(vnode)) {
        const vnodes = normalizeChildren(vnode) || []
        const res = new Array(vnodes.length)
        for (let i = 0; i < vnodes.length; i++) {
            res[i] = cloneAndMarkFunctionalResult(vnodes[i], data, renderContext.parent, options, renderContext)
        }
        return res
    }
}

function cloneAndMarkFunctionalResult(vnode, data, contextVm, options, renderContext) {
    // #7817 clone node before setting fnContext, otherwise if the node is reused
    // (e.g. it was from a cached normal slot) the fnContext causes named slots
    // that should not be matched to match.
    // 主要用于处理旧语法的bug，该BUG会导致节点复用时，错误的匹配命名插槽

    // 复制Vnode节点
    const clone = cloneVNode(vnode);

    // 添加额外属性
    clone.fnContext = contextVm;
    clone.fnOptions = options;
    if (process.env.NODE_ENV !== 'production') {
        (clone.devtoolsMeta = clone.devtoolsMeta || {}).renderContext = renderContext
    }

    // 复制插槽内容节点
    if (data.slot) {
        (clone.data || (clone.data = {})).slot = data.slot
    }
    return clone
}

// 将from中的属性复制至to中
function mergeProps(to, from) {
    for (const key in from) {
        to[camelize(key)] = from[key]
    }
}