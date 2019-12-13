/* @flow */

import config from '../config'
import {
    initProxy
} from './proxy'
import {
    initState
} from './state'
import {
    initRender
} from './render'
import {
    initEvents
} from './events'
import {
    mark,
    measure
} from '../util/perf'
import {
    initLifecycle,
    callHook
} from './lifecycle'
import {
    initProvide,
    initInjections
} from './inject'
import {
    extend,
    mergeOptions,
    formatComponentName
} from '../util/index'

let uid = 0

export function initMixin(Vue: Class < Component > ) {
    //给Vue原型添加初始化函数
    Vue.prototype._init = function (options ? : Object) {
        const vm: Component = this
        // a uid
        vm._uid = uid++

        let startTag, endTag
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            startTag = `vue-perf-start:${vm._uid}`
            endTag = `vue-perf-end:${vm._uid}`
            mark(startTag)
        }

        // a flag to avoid this being observed
        vm._isVue = true

        // 组件vm实例
        if (options && options._isComponent) {

            // optimize internal component instantiation
            // since dynamic options merging is pretty slow, and none of the
            // internal component options needs special treatment.
            // 优化组件内部的组件，因为动态options合并低效，而且没有内部组件的options
            // 需要特殊的处理
            initInternalComponent(vm, options);

        // 根VM实例
        } else {
            vm.$options = mergeOptions(
                resolveConstructorOptions(vm.constructor), // 构造函数上的默认配置
                options || {}, // 用户自定义配置
                vm
            )
        }
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production') {
            initProxy(vm)
        } else {
            vm._renderProxy = vm
        }
        // expose real self
        vm._self = vm
        initLifecycle(vm)
        initEvents(vm)
        initRender(vm)
        callHook(vm, 'beforeCreate')
        initInjections(vm) // resolve injections before data/props
        initState(vm)
        initProvide(vm) // resolve provide after data/props
        callHook(vm, 'created')

        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            vm._name = formatComponentName(vm, false);
            mark(endTag);
            measure(`vue ${vm._name} init`, startTag, endTag);
        }

        if (vm.$options.el) {
            vm.$mount(vm.$options.el);
        }
    }
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {

    // 将定义的组件对象置于原型对象并为组件实例定义$options
    const opts = vm.$options = Object.create(vm.constructor.options);

    // doing this because it's faster than dynamic enumeration.
    // 直接为其添加属性，因为它比动态枚举更快

    // 取出该vm实例代表的组件VNode(即我们在父级上下文使用的组件标签代表的VNode)
    const parentVnode = options._parentVnode;

    // 父vm实例
    opts.parent = options.parent;

    // 为其添加该vm实例代表的组件VNode
    opts._parentVnode = parentVnode;

    // 取出定义在父vm实例上下文，该组件标签上的属性
    const vnodeComponentOptions = parentVnode.componentOptions

    // 组件上定义的attrs
    opts.propsData = vnodeComponentOptions.propsData;

    // 父级上下文中组件标签定义的事件监听器
    opts._parentListeners = vnodeComponentOptions.listeners;

    // 父级上下文中组件标签内的子VNode
    opts._renderChildren = vnodeComponentOptions.children;

    // 组件标签的名称
    opts._componentTag = vnodeComponentOptions.tag

    // 组件是否为渲染函数，如果是，挂载在vm.$options中
    if (options.render) {
        opts.render = options.render;
        opts.staticRenderFns = options.staticRenderFns;
    }
}

export function resolveConstructorOptions(Ctor: Class < Component > ) {

    // 获取构造函数上的options属性
    let options = Ctor.options;

    // 如果该构造函数有父级(没有父级弹什么mixins)
    if (Ctor.super) {

        // 获取父级组件构造函数的options
        const superOptions = resolveConstructorOptions(Ctor.super);

        // 获取父级构造函数上options
        const cachedSuperOptions = Ctor.superOptions;

        // 当父级options与缓存的options不同时(因为这两个都是对同一个对象的引用详情参考Vue.extend函数), 更新缓存
        if (superOptions !== cachedSuperOptions) {

            // super option changed,
            // need to resolve new options.
            // 父级options变动时，更新其缓存
            Ctor.superOptions = superOptions;

            // check if there are any late-modified/attached options (#4976)
            // 一个记录最新Options与原始差异的对象
            const modifiedOptions = resolveModifiedOptions(Ctor);

            // update base extend options
            // 将两者差异属性追加到组件的options上(即用户编写的组件模块文件里面的配置)
            if (modifiedOptions) {
                extend(Ctor.extendOptions, modifiedOptions);
            }

            // 更新组件的Superoptions
            options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);

            // 更新组件名称挂载的组件
            if (options.name) {
                options.components[options.name] = Ctor
            }
        }
    }
    return options;
}

// 对比新旧两个options，返回其变更部分填充的对象
function resolveModifiedOptions(Ctor: Class < Component > ): ? Object {
    let modified;
    const latest = Ctor.options;

    // 组件密封的对上一个父级属性的copy
    const sealed = Ctor.sealedOptions;

    // 遍历封装的Options与现有的Options, 将其不同(必须全等)的key/value
    // 存入modified对象中返回
    for (const key in latest) {

        // 全等，用来筛选与原始options不同的部分
        if (latest[key] !== sealed[key]) {
            if (!modified) modified = {};
            modified[key] = latest[key];
        }
    }
    return modified;
}