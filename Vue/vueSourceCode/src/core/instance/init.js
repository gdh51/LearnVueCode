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

        // 合并Options属性
        if (options && options._isComponent) {
            // optimize internal component instantiation
            // since dynamic options merging is pretty slow, and none of the
            // internal component options needs special treatment.
            // 暂存, 内部选项
            initInternalComponent(vm, options)
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
    const opts = vm.$options = Object.create(vm.constructor.options)
    // doing this because it's faster than dynamic enumeration.
    const parentVnode = options._parentVnode
    opts.parent = options.parent
    opts._parentVnode = parentVnode

    const vnodeComponentOptions = parentVnode.componentOptions
    opts.propsData = vnodeComponentOptions.propsData
    opts._parentListeners = vnodeComponentOptions.listeners
    opts._renderChildren = vnodeComponentOptions.children
    opts._componentTag = vnodeComponentOptions.tag

    if (options.render) {
        opts.render = options.render
        opts.staticRenderFns = options.staticRenderFns
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