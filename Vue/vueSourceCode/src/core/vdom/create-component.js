/* @flow */

import VNode from './vnode'
import {
    resolveConstructorOptions
} from 'core/instance/init'
import {
    queueActivatedComponent
} from 'core/observer/scheduler'
import {
    createFunctionalComponent
} from './create-functional-component'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    isObject
} from '../util/index'

import {
    resolveAsyncComponent,
    createAsyncPlaceholder,
    extractPropsFromVNodeData
} from './helpers/index'

import {
    callHook,
    activeInstance,
    updateChildComponent,
    activateChildComponent,
    deactivateChildComponent
} from '../instance/lifecycle'

import {
    isRecyclableComponent,
    renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
    init(vnode: VNodeWithData, hydrating: boolean): ? boolean {
        if (
            vnode.componentInstance &&
            !vnode.componentInstance._isDestroyed &&
            vnode.data.keepAlive
        ) {
            // kept-alive components, treat as a patch
            const mountedNode: any = vnode // work around flow
            componentVNodeHooks.prepatch(mountedNode, mountedNode)
        } else {
            const child = vnode.componentInstance = createComponentInstanceForVnode(
                vnode,
                activeInstance
            )
            child.$mount(hydrating ? vnode.elm : undefined, hydrating)
        }
    },

    prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
        const options = vnode.componentOptions
        const child = vnode.componentInstance = oldVnode.componentInstance
        updateChildComponent(
            child,
            options.propsData, // updated props
            options.listeners, // updated listeners
            vnode, // new parent vnode
            options.children // new children
        )
    },

    insert(vnode: MountedComponentVNode) {
        const {
            context,
            componentInstance
        } = vnode
        if (!componentInstance._isMounted) {
            componentInstance._isMounted = true
            callHook(componentInstance, 'mounted')
        }
        if (vnode.data.keepAlive) {
            if (context._isMounted) {
                // vue-router#1212
                // During updates, a kept-alive component's child components may
                // change, so directly walking the tree here may call activated hooks
                // on incorrect children. Instead we push them into a queue which will
                // be processed after the whole patch process ended.
                queueActivatedComponent(componentInstance)
            } else {
                activateChildComponent(componentInstance, true /* direct */ )
            }
        }
    },

    destroy(vnode: MountedComponentVNode) {
        const {
            componentInstance
        } = vnode
        if (!componentInstance._isDestroyed) {
            if (!vnode.data.keepAlive) {
                componentInstance.$destroy()
            } else {
                deactivateChildComponent(componentInstance, true /* direct */ )
            }
        }
    }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

export function createComponent(

    // 组件的配置实例对象
    Ctor: Class < Component > | Function | Object | void,

    // 外置与组件元素上的属性
    data: ? VNodeData,

    // 当前组件所处于的上下文对象，即父组件
    context : Component,

    // 当前组件中的子节点们
    children: ? Array < VNode > ,

    // 组件名称
    tag ? : string
): VNode | Array < VNode > | void {

    // 不存在组件配置对象时直接返回。
    if (isUndef(Ctor)) {
        return;
    }

    // 取出基础Vue构造函数
    const baseCtor = context.$options._base

    // plain options object: turn it into a constructor
    // 如果是组件配置对象时，将配置与基础配置对象混合，
    // 并生成一个新的构造函数
    if (isObject(Ctor)) {

        // 生成组件的构造函数
        Ctor = baseCtor.extend(Ctor);
    }

    // if at this stage it's not a constructor or an async component factory,
    // reject.
    // 如果在这一步它还不是一个构造或工厂函数，那么报错
    if (typeof Ctor !== 'function') {
        if (process.env.NODE_ENV !== 'production') {
            warn(`Invalid Component definition: ${String(Ctor)}`, context)
        }
        return
    }

    // async component
    let asyncFactory;

    // 是否具有cid(只有通过extend生成的组件构造函数才有)
    if (isUndef(Ctor.cid)) {

        // 处理异步组件
        asyncFactory = Ctor;
        Ctor = resolveAsyncComponent(asyncFactory, baseCtor);
        if (Ctor === undefined) {
            // return a placeholder node for async component, which is rendered
            // as a comment node but preserves all the raw information for the node.
            // the information will be used for async server-rendering and hydration.
            return createAsyncPlaceholder(
                asyncFactory,
                data,
                context,
                children,
                tag
            )
        }
    }

    // 初始化节点的属性
    data = data || {};

    // resolve constructor options in case global mixins are applied after
    // component constructor creation
    // 检查构造函数的父级构造函数前后两个版本的options以防全局的mixins是在组件构造函数后调用
    resolveConstructorOptions(Ctor);

    // transform component v-model data into props & events
    // 将v-model属性转换为对应的属性与事件(包括组件中的model配置)
    if (isDef(data.model)) {
        transformModel(Ctor.options, data);
    }

    // extract props
    const propsData = extractPropsFromVNodeData(data, Ctor, tag)

    // functional component
    if (isTrue(Ctor.options.functional)) {
        return createFunctionalComponent(Ctor, propsData, data, context, children)
    }

    // extract listeners, since these needs to be treated as
    // child component listeners instead of DOM listeners
    const listeners = data.on
    // replace with listeners with .native modifier
    // so it gets processed during parent component patch.
    data.on = data.nativeOn

    if (isTrue(Ctor.options.abstract)) {
        // abstract components do not keep anything
        // other than props & listeners & slot

        // work around flow
        const slot = data.slot
        data = {}
        if (slot) {
            data.slot = slot
        }
    }

    // install component management hooks onto the placeholder node
    installComponentHooks(data)

    // return a placeholder vnode
    const name = Ctor.options.name || tag
    const vnode = new VNode(
        `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data, undefined, undefined, undefined, context, {
            Ctor,
            propsData,
            listeners,
            tag,
            children
        },
        asyncFactory
    )

    // Weex specific: invoke recycle-list optimized @render function for
    // extracting cell-slot template.
    // https://github.com/Hanks10100/weex-native-directive/tree/master/component
    /* istanbul ignore if */
    if (__WEEX__ && isRecyclableComponent(vnode)) {
        return renderRecyclableComponentTemplate(vnode)
    }

    return vnode;
}

export function createComponentInstanceForVnode(
    vnode: any, // we know it's MountedComponentVNode but flow doesn't
    parent: any, // activeInstance in lifecycle state
): Component {
    const options: InternalComponentOptions = {
        _isComponent: true,
        _parentVnode: vnode,
        parent
    }
    // check inline-template render functions
    const inlineTemplate = vnode.data.inlineTemplate
    if (isDef(inlineTemplate)) {
        options.render = inlineTemplate.render
        options.staticRenderFns = inlineTemplate.staticRenderFns
    }
    return new vnode.componentOptions.Ctor(options)
}

function installComponentHooks(data: VNodeData) {
    const hooks = data.hook || (data.hook = {})
    for (let i = 0; i < hooksToMerge.length; i++) {
        const key = hooksToMerge[i]
        const existing = hooks[key]
        const toMerge = componentVNodeHooks[key]
        if (existing !== toMerge && !(existing && existing._merged)) {
            hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
        }
    }
}

function mergeHook(f1: any, f2: any): Function {
    const merged = (a, b) => {
        // flow complains about extra args which is why we use any
        f1(a, b)
        f2(a, b)
    }
    merged._merged = true
    return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel(options, data: any) {

    // 是否指定prop绑定的值，否则默认绑定其value属性
    const prop = (options.model && options.model.prop) || 'value';

    // 是否指定v-model绑定的事件，默认绑定input
    const event = (options.model && options.model.event) || 'input';

    // 在元素属性中添加绑定的元素属性的值
    (data.attrs || (data.attrs = {}))[prop] = data.model.value;

    // 获取元素上的事件处理器对象
    const on = data.on || (data.on = {});

    // 取出该类型的事件对象
    const existing = on[event];
    const callback = data.model.callback;

    // 如果存在同类型事件，转化为数组添加添加在最前
    if (isDef(existing)) {
        if (
            Array.isArray(existing) ?

            // 不为同一事件处理函数
            existing.indexOf(callback) === -1 :
            existing !== callback
        ) {
            on[event] = [callback].concat(existing)
        }
    } else {

        // 不存在时，直接添加
        on[event] = callback
    }
}