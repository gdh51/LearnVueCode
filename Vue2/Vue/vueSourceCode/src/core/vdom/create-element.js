/* @flow */

import config from '../config'
import VNode, {
    createEmptyVNode
} from './vnode'
import {
    createComponent
} from './create-component'
import {
    traverse
} from '../observer/traverse'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    isObject,
    isPrimitive,
    resolveAsset
} from '../util/index'

import {
    normalizeChildren,
    simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
export function createElement(

    // 上下文环境，即vm实例
    context: Component,
    tag: any,

    // 元素属性
    data: any,

    // 子元素
    children: any,

    // 标准化类型
    normalizationType: any,
    alwaysNormalize: boolean
): VNode | Array < VNode > {

    // 是否为数组或原始类型值(这里的情况未猜测是前面多传入了一个参数)
    if (Array.isArray(data) || isPrimitive(data)) {
        normalizationType = children
        children = data
        data = undefined;
    }

    // 指定永远进行优化为true时，才有效
    if (isTrue(alwaysNormalize)) {
        normalizationType = ALWAYS_NORMALIZE
    }
    return _createElement(context, tag, data, children, normalizationType)
}

export function _createElement(
    context: Component,
    tag ? : string | Class < Component > | Function | Object,
    data ? : VNodeData,
    children ? : any,
    normalizationType ? : number
): VNode | Array < VNode > {

    // 禁止使用使用有监听器属性的对象作为data
    if (isDef(data) && isDef((data: any).__ob__)) {
        process.env.NODE_ENV !== 'production' && warn(
            `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
            'Always create fresh vnode data objects in each render!',
            context
        )

        // 否则返回空Vnode节点
        return createEmptyVNode()
    }

    // object syntax in v-bind
    if (isDef(data) && isDef(data.is)) {
        tag = data.is
    }

    // 无标签，这种情况就is属性设置了一个假值
    if (!tag) {
        // in case of component :is set to falsy value
        return createEmptyVNode()
    }

    // warn against non-primitive key
    // 确认该原始值的key值，如果不是原始值则警告
    if (process.env.NODE_ENV !== 'production' &&
        isDef(data) && isDef(data.key) && !isPrimitive(data.key)
    ) {
        if (!__WEEX__ || !('@binding' in data.key)) {
            warn(
                'Avoid using non-primitive value as key, ' +
                'use string/number value instead.',
                context
            )
        }
    }

    // support single function children as default scoped slot
    // 允许单个的函数作为唯一的子节点即默认插槽
    if (Array.isArray(children) &&
        typeof children[0] === 'function'
    ) {
        data = data || {}
        data.scopedSlots = {
            default: children[0]
        }
        children.length = 0
    }

    // 根据标准化等级进行标准化
    if (normalizationType === ALWAYS_NORMALIZE) {
        children = normalizeChildren(children)
    } else if (normalizationType === SIMPLE_NORMALIZE) {
        children = simple5NormalizeChildren(children)
    }


    let vnode, ns;

    // 直接提供标签名时，按照提供标签名的情况进行创建Vnode节点
    if (typeof tag === 'string') {
        let Ctor;

        // 获取该节点所处的命名空间
        ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);

        // 如果为原生标签
        if (config.isReservedTag(tag)) {
            // platform built-in elements
            vnode = new VNode(
                config.parsePlatformTagName(tag), data, children,
                undefined, undefined, context
            )

        // 无属性或非静态节点
        } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
            // component
            vnode = createComponent(Ctor, data, context, children, tag)
        } else {
            // unknown or unlisted namespaced elements
            // check at runtime because it may get assigned a namespace when its
            // parent normalizes children
            // 未知或未列出命名空间的元素，待运行时再来检查，因为它们可能会在其父节点标准化时赋值
            vnode = new VNode(
                tag, data, children,
                undefined, undefined, context
            )
        }
    } else {

        // direct component options / constructor
        // 直接的组件属性或构造函数// 直接的组件属性或构造函数
        vnode = createComponent(tag, data, context, children)
    }

    // 最后对节点进行处理
    if (Array.isArray(vnode)) {
        return vnode;

    // 对单个节点的属性进行处理
    } else if (isDef(vnode)) {
        if (isDef(ns)) applyNS(vnode, ns);
        if (isDef(data)) registerDeepBindings(data);
        return vnode

    // 无节点生成则返回空节点
    } else {
        return createEmptyVNode()
    }
}

function applyNS(vnode, ns, force) {
    vnode.ns = ns
    if (vnode.tag === 'foreignObject') {
        // use default namespace inside foreignObject
        ns = undefined
        force = true
    }
    if (isDef(vnode.children)) {
        for (let i = 0, l = vnode.children.length; i < l; i++) {
            const child = vnode.children[i]
            if (isDef(child.tag) && (
                    isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
                applyNS(child, ns, force)
            }
        }
    }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
// 当使用:style或:class时保证父元素的重新渲染
function registerDeepBindings(data) {

    // 动态绑定style属性时，遍历该属性收集依赖项
    if (isObject(data.style)) {
        traverse(data.style)
    }
    if (isObject(data.class)) {
        traverse(data.class)
    }
}