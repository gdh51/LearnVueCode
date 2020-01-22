/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import {
    mark,
    measure
} from '../util/perf'
import {
    createEmptyVNode
} from '../vdom/vnode'
import {
    updateComponentListeners
} from './events'
import {
    resolveSlots
} from './render-helpers/resolve-slots'
import {
    toggleObserving
} from '../observer/index'
import {
    pushTarget,
    popTarget
} from '../observer/dep'

import {
    warn,
    noop,
    remove,
    emptyObject,
    validateProp,
    invokeWithErrorHandling
} from '../util/index'

// 当前进行更新的vm实例
export let activeInstance: any = null

// 是否在更新子组件
export let isUpdatingChildComponent: boolean = false

// 该函数用于将当前的更新的实例变更为传入的实例，并存储上一个更新的实例
export function setActiveInstance(vm: Component) {

    // 储存上一个更新的vm实例
    const prevActiveInstance = activeInstance;

    // 设置更新的vm实例为当前实例;
    activeInstance = vm;

    // 返回一个接口，用于切换为上一个实例
    return () => {
        activeInstance = prevActiveInstance
    }
}

export function initLifecycle(vm: Component) {
    const options = vm.$options;

    // locate first non-abstract parent
    // 定位第一个非抽象的父级组件vm实例(如keep-alive/transition为抽象组件)
    let parent = options.parent;
    if (parent && !options.abstract) {
        while (parent.$options.abstract && parent.$parent) {
            parent = parent.$parent;
        }

        // 将该组件加入其子组件队列
        parent.$children.push(vm);
    }

    // 定义根vm实例和父级vm实例
    vm.$parent = parent;
    vm.$root = parent ? parent.$root : vm;

    // 存放该vm实例中的组件vm实例
    vm.$children = [];
    vm.$refs = {};

    // 存储该vm实例上全部的Watcher实例
    vm._watcher = null

    // keep-alive组件未激活状态
    vm._inactive = null

    // keep-alive组件是否直接失活状态
    vm._directInactive = false

    // DOM结构是否已挂载至浏览器页面
    vm._isMounted = false

    // 该vm实例是否已销毁
    vm._isDestroyed = false
    vm._isBeingDestroyed = false
}

export function lifecycleMixin(Vue: Class < Component > ) {
    Vue.prototype._update = function (vnode: VNode, hydrating ? : boolean) {
        const vm: Component = this;

        // 上一个元素(如果为根实例，那么此时就为挂载的元素)
        const prevEl = vm.$el;

        // 上一个Vnode节点(如果为根实例那么此时就为空)(其他时候为根VNode节点)
        const prevVnode = vm._vnode;

        // 设置当前更新的vm实例，并存储上一个vm实例，
        // 返回一个用于切换为上一个实例的函数
        const restoreActiveInstance = setActiveInstance(vm);

        // 将当前VNode节点，挂载至_vnode(所以当前节点)
        vm._vnode = vnode;

        // Vue.prototype.__patch__ is injected in entry points
        // based on the rendering backend used.
        // __patch__基于是否为后端渲染，已在Vue初始化时已经注入原型上(此时为浏览器渲染)

        // 存不在上一个VNode时
        if (!prevVnode) {

            // initial render
            // 初始化渲染后
            vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */ )
        } else {
            // updates
            vm.$el = vm.__patch__(prevVnode, vnode)
        }

        // 释放当前vm实例
        restoreActiveInstance()

        // update __vue__ reference
        if (prevEl) {
            prevEl.__vue__ = null
        }
        if (vm.$el) {
            vm.$el.__vue__ = vm
        }
        // if parent is an HOC, update its $el as well
        // 如果父级为高阶组件，也更新它的$el
        if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
            vm.$parent.$el = vm.$el
        }

        // updated hook is called by the scheduler to ensure that children are
        // updated in a parent's updated hook.
    }

    Vue.prototype.$forceUpdate = function () {
        const vm: Component = this
        if (vm._watcher) {
            vm._watcher.update()
        }
    }

    Vue.prototype.$destroy = function () {
        const vm: Component = this
        if (vm._isBeingDestroyed) {
            return
        }
        callHook(vm, 'beforeDestroy')
        vm._isBeingDestroyed = true
        // remove self from parent
        const parent = vm.$parent
        if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
            remove(parent.$children, vm)
        }
        // teardown watchers
        if (vm._watcher) {
            vm._watcher.teardown()
        }
        let i = vm._watchers.length
        while (i--) {
            vm._watchers[i].teardown()
        }
        // remove reference from data ob
        // frozen object may not have observer.
        if (vm._data.__ob__) {
            vm._data.__ob__.vmCount--
        }
        // call the last hook...
        vm._isDestroyed = true
        // invoke destroy hooks on current rendered tree
        vm.__patch__(vm._vnode, null)
        // fire destroyed hook
        callHook(vm, 'destroyed')
        // turn off all instance listeners.
        vm.$off()
        // remove __vue__ reference
        if (vm.$el) {
            vm.$el.__vue__ = null
        }
        // release circular reference (#6759)
        if (vm.$vnode) {
            vm.$vnode.parent = null
        }
    }
}

export function mountComponent(
    vm: Component,
    el: ? Element,
    hydrating ? : boolean
): Component {
    vm.$el = el;

    // 当不存在渲染函数时
    if (!vm.$options.render) {

        // 将当前渲染函数赋值为创建一个空的VNode节点的函数
        vm.$options.render = createEmptyVNode
        if (process.env.NODE_ENV !== 'production') {
            /* istanbul ignore if */
            if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
                vm.$options.el || el) {
                warn(
                    'You are using the runtime-only build of Vue where the template ' +
                    'compiler is not available. Either pre-compile the templates into ' +
                    'render functions, or use the compiler-included build.',
                    vm
                )
            } else {
                warn(
                    'Failed to mount component: template or render function not defined.',
                    vm
                )
            }
        }
    }

    // 调用该vm实例的beforeMount狗子函数
    callHook(vm, 'beforeMount');

    let updateComponent

    // 赋值updateComponent函数，记录是否记录渲染性能
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        updateComponent = () => {
            const name = vm._name
            const id = vm._uid
            const startTag = `vue-perf-start:${id}`
            const endTag = `vue-perf-end:${id}`

            mark(startTag)

            const vnode = vm._render()
            mark(endTag)
            measure(`vue ${name} render`, startTag, endTag)

            mark(startTag)
            vm._update(vnode, hydrating)
            mark(endTag)
            measure(`vue ${name} patch`, startTag, endTag)
        }
    } else {
        updateComponent = () => {
            vm._update(vm._render(), hydrating)
        }
    }

    // we set this to vm._watcher inside the watcher's constructor
    // since the watcher's initial patch may call $forceUpdate (e.g. inside child
    // component's mounted hook), which relies on vm._watcher being already defined
    // 为vue的dom创建一个watcher
    new Watcher(vm, updateComponent, noop, {
        before() {
            if (vm._isMounted && !vm._isDestroyed) {
                callHook(vm, 'beforeUpdate')
            }
        }
    }, true /* isRenderWatcher */ )
    hydrating = false

    // manually mounted instance, call mounted on self
    // mounted is called for render-created child components in its inserted hook
    if (vm.$vnode == null) {
        vm._isMounted = true
        callHook(vm, 'mounted');
    };

    return vm
}

export function updateChildComponent(
    vm: Component,

    // props的值
    propsData: ? Object,
    listeners : ? Object,
    parentVnode : MountedComponentVNode,

    // 组件的占位节点
    renderChildren: ? Array < VNode >
) {
    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = true
    }

    // determine whether component has slot children
    // we need to do this before overwriting $options._renderChildren.
    // 判断组件是否有插槽节点，在重写$options._rrenderChildren前必须要确认

    // check if there are dynamic scopedSlots (hand-written or compiled but with
    // dynamic slot names). Static scoped slots compiled from template has the
    // "$stable" marker.
    // 检查是否有动态作用域插槽。通过模版编译的静态作用域插槽具有$stable标记
    const newScopedSlots = parentVnode.data.scopedSlots
    const oldScopedSlots = vm.$scopedSlots

    // 是否具有动态插槽
    const hasDynamicScopedSlot = !!(
        (newScopedSlots && !newScopedSlots.$stable) ||
        (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
        (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key)
    )

    // Any static slot children from the parent may have changed during parent's
    // update. Dynamic scoped slots may also have changed. In such cases, a forced
    // update is necessary to ensure correctness.
    // 任何静态插槽的子节点数组在其父节点的更新中都可以会改变。动态作用域插槽也是。这种情况下
    // 必须通过强制更新来保证它们的正确
    const needsForceUpdate = !!(
        renderChildren || // has new static slots
        vm.$options._renderChildren || // has old static slots
        hasDynamicScopedSlot
    )

    // 更新占位符VNode
    vm.$options._parentVnode = parentVnode
    vm.$vnode = parentVnode // update vm's placeholder node without re-render

    // 更新组件根节点的父节点
    if (vm._vnode) { // update child tree's parent
        vm._vnode.parent = parentVnode
    }

    // 重写子节点数组
    vm.$options._renderChildren = renderChildren

    // update $attrs and $listeners hash
    // these are also reactive so they may trigger child update if the child
    // used them during render
    // 更新节点属性和监听器
    // 它们都是响应式的，所以更新它们时可能会触发其他渲染更新
    vm.$attrs = parentVnode.data.attrs || emptyObject
    vm.$listeners = listeners || emptyObject

    // update props
    // 更新props属性的值
    if (propsData && vm.$options.props) {
        toggleObserving(false)
        const props = vm._props
        const propKeys = vm.$options._propKeys || []
        for (let i = 0; i < propKeys.length; i++) {
            const key = propKeys[i]
            const propOptions: any = vm.$options.props // wtf flow?
            props[key] = validateProp(key, propOptions, propsData, vm)
        }
        toggleObserving(true)
        // keep a copy of raw propsData
        vm.$options.propsData = propsData
    }

    // update listeners
    listeners = listeners || emptyObject
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)

    // resolve slots + force update if has children
    // 更新插槽，并强制更新
    if (needsForceUpdate) {
        vm.$slots = resolveSlots(renderChildren, parentVnode.context)
        vm.$forceUpdate()
    }

    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = false
    }
}

function isInInactiveTree(vm) {

    // 查找其祖先vm实例，如果有一个vm实例为不活跃的，则为true
    while (vm && (vm = vm.$parent)) {
        if (vm._inactive) return true
    }
    return false
}

export function activateChildComponent(vm: Component, direct ? : boolean) {

    // 直接激活子组件时，设置其不活跃状态为false
    if (direct) {
        vm._directInactive = false;

        // 该vm实例是否处于一个不活跃的dom树中，如果是则直接返回
        if (isInInactiveTree(vm)) {
            return
        }

        // 是否为直接不活跃的mv实例，如果是则退出
    } else if (vm._directInactive) {
        return
    }

    // 是否为不活跃状态
    if (vm._inactive || vm._inactive === null) {

        // 关闭不活跃状态
        vm._inactive = false;

        // 激活动态组件的子组件
        for (let i = 0; i < vm.$children.length; i++) {
            activateChildComponent(vm.$children[i])
        }

        // 调用动态组件的activated周期函数
        callHook(vm, 'activated')
    }
}

export function deactivateChildComponent(vm: Component, direct ? : boolean) {
    if (direct) {
        vm._directInactive = true
        if (isInInactiveTree(vm)) {
            return
        }
    }
    if (!vm._inactive) {
        vm._inactive = true
        for (let i = 0; i < vm.$children.length; i++) {
            deactivateChildComponent(vm.$children[i])
        }
        callHook(vm, 'deactivated')
    }
}

export function callHook(vm: Component, hook: string) {
    // #7573 disable dep collection when invoking lifecycle hooks
    pushTarget()
    const handlers = vm.$options[hook]
    const info = `${hook} hook`
    if (handlers) {
        for (let i = 0, j = handlers.length; i < j; i++) {
            invokeWithErrorHandling(handlers[i], vm, null, vm, info)
        }
    }
    if (vm._hasHookEvent) {
        vm.$emit('hook:' + hook)
    }
    popTarget()
}