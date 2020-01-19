/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, {
    pushTarget,
    popTarget
} from '../observer/dep'
import {
    isUpdatingChildComponent
} from './lifecycle'

import {
    set,
    del,
    observe,
    defineReactive,
    toggleObserving
} from '../observer/index'

import {
    warn,
    bind,
    noop,
    hasOwn,
    hyphenate,
    isReserved,
    handleError,
    nativeWatch,
    validateProp,
    isPlainObject,
    isServerRendering,
    isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
}

// 拦截target对象的getter与setter使其查询或修改属性时，直接跨级修改sourceKey中的属性
export function proxy(target: Object, sourceKey: string, key: string) {

    // 直接跨层访问
    sharedPropertyDefinition.get = function proxyGetter() {
        return this[sourceKey][key]
    }
    sharedPropertyDefinition.set = function proxySetter(val) {
        this[sourceKey][key] = val
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState(vm: Component) {
    // 初始化一个观察者对象, 用于存放watcher定义的监听器
    vm._watchers = []
    const opts = vm.$options

    if (opts.props) initProps(vm, opts.props)

    if (opts.methods) initMethods(vm, opts.methods)

    if (opts.data) {
        initData(vm)
    } else {
        observe(vm._data = {}, true /* asRootData */ )
    }

    if (opts.computed) initComputed(vm, opts.computed)

    if (opts.watch && opts.watch !== nativeWatch) {
        initWatch(vm, opts.watch)
    }
}

function initProps(vm: Component, propsOptions: Object) {

    // options中定义的原始的props
    const propsData = vm.$options.propsData || {}

    // 在vm实例上定义_props的代理
    const props = vm._props = {}
    // cache prop keys so that future props updates can iterate using Array
    // instead of dynamic object key enumeration.
    // 缓存prop的键名, 之后更新props时不用在次遍历对象来获取键名
    const keys = vm.$options._propKeys = []
    const isRoot = !vm.$parent
    // root instance props should be converted
    if (!isRoot) {
        toggleObserving(false)
    }

    for (const key in propsOptions) {
        keys.push(key)

        // 效验props中对属性的配置
        const value = validateProp(key, propsOptions, propsData, vm)
        /* istanbul ignore else */

        // 生产环境中, 限制props名与修改props中属性
        if (process.env.NODE_ENV !== 'production') {
            const hyphenatedKey = hyphenate(key)
            if (isReservedAttribute(hyphenatedKey) ||
                config.isReservedAttr(hyphenatedKey)) {
                warn(
                    `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
                    vm
                )
            }

            // 定义一个setter, 在用户改变props某个属性时, 触发该setter来报错
            defineReactive(props, key, value, () => {
                if (!isRoot && !isUpdatingChildComponent) {
                    warn(
                        `Avoid mutating a prop directly since the value will be ` +
                        `overwritten whenever the parent component re-renders. ` +
                        `Instead, use a data or computed property based on the prop's ` +
                        `value. Prop being mutated: "${key}"`,
                        vm
                    )
                }
            })
        } else {
            defineReactive(props, key, value)
        }
        // static props are already proxied on the component's prototype
        // during Vue.extend(). We only need to proxy props defined at
        // instantiation here.
        // 在vm上代理_props
        if (!(key in vm)) {
            proxy(vm, `_props`, key)
        }
    }
    toggleObserving(true)
}

function initData(vm: Component) {
    let data = vm.$options.data;

    // 获取用户定义的data, 然后挂载在Vue实例的_data上
    data = vm._data = typeof data === 'function' ?
        getData(data, vm) :
        data || {};

    // 当函数形式返回的不是对象时报错你懂的
    if (!isPlainObject(data)) {
        data = {}
        process.env.NODE_ENV !== 'production' && warn(
            'data functions should return an object:\n' +
            'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
            vm
        )
    }

    // proxy data on instance
    const keys = Object.keys(data)
    const props = vm.$options.props
    const methods = vm.$options.methods
    let i = keys.length

    // 通过之前的代码我们知道，props与methods会代理到vm实例上,
    // 所以此处data中属性名不能与其重复且不能为保留字
    while (i--) {
        const key = keys[i]
        if (process.env.NODE_ENV !== 'production') {
            if (methods && hasOwn(methods, key)) {
                warn(
                    `Method "${key}" has already been defined as a data property.`,
                    vm
                )
            }
        }
        if (props && hasOwn(props, key)) {
            process.env.NODE_ENV !== 'production' && warn(
                `The data property "${key}" is already declared as a prop. ` +
                `Use prop default value instead.`,
                vm
            )
        } else if (!isReserved(key)) {

            // 代理data中属性到Vue实例上
            proxy(vm, `_data`, key)
        }
    }

    // 递归data使其所有属性为响应式属性
    observe(data, true /* asRootData */ )
}

export function getData(data: Function, vm: Component): any {
    // #7573 disable dep collection when invoking data getters
    pushTarget()
    try {

        // 返回函数形式中定义的对象
        return data.call(vm, vm)
    } catch (e) {
        handleError(e, vm, `data()`)
        return {}
    } finally {
        popTarget()
    }
}

const computedWatcherOptions = {
    lazy: true
}

function initComputed(vm: Component, computed: Object) {

    // 在当前vm上挂载computed的Watcher
    const watchers = vm._computedWatchers = Object.create(null)

    // computed properties are just getters during SSR
    // (忽视)计算属性仅作为getter在服务器渲染下
    const isSSR = isServerRendering()

    for (const key in computed) {
        const userDef = computed[key];
        const getter = typeof userDef === 'function' ? userDef : userDef.get;
        if (process.env.NODE_ENV !== 'production' && getter == null) {
            warn(
                `Getter is missing for computed property "${key}".`,
                vm
            )
        }

        if (!isSSR) {

            // create internal watcher for the computed property.
            // 为计算属性创建watcher并收集依赖项
            watchers[key] = new Watcher(
                vm,
                getter || noop,
                noop,
                computedWatcherOptions
            )
        }

        // component-defined computed properties are already defined on the
        // component prototype. We only need to define computed properties defined
        // at instantiation here.
        if (!(key in vm)) {
            defineComputed(vm, key, userDef)
        } else if (process.env.NODE_ENV !== 'production') {
            if (key in vm.$data) {
                warn(`The computed property "${key}" is already defined in data.`, vm)
            } else if (vm.$options.props && key in vm.$options.props) {
                warn(`The computed property "${key}" is already defined as a prop.`, vm)
            }
        }
    }
}

export function defineComputed(
    target: any,
    key: string,
    userDef: Object | Function
) {
    const shouldCache = !isServerRendering()
    if (typeof userDef === 'function') {
        sharedPropertyDefinition.get = shouldCache ?
            createComputedGetter(key) :
            createGetterInvoker(userDef)
        sharedPropertyDefinition.set = noop
    } else {
        sharedPropertyDefinition.get = userDef.get ?
            shouldCache && userDef.cache !== false ?
            createComputedGetter(key) :
            createGetterInvoker(userDef.get) :
            noop
        sharedPropertyDefinition.set = userDef.set || noop
    }
    if (process.env.NODE_ENV !== 'production' &&
        sharedPropertyDefinition.set === noop) {
        sharedPropertyDefinition.set = function () {
            warn(
                `Computed property "${key}" was assigned to but it has no setter.`,
                this
            )
        }
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter(key) {
    return function computedGetter() {

        // 取出对应computed属性的watcher对象
        const watcher = this._computedWatchers && this._computedWatchers[key]
        if (watcher) {

            // 当为computed属性时，为watcher进行依赖项收集
            if (watcher.dirty) {
                watcher.evaluate()
            }
            if (Dep.target) {
                watcher.depend()
            }
            return watcher.value
        }
    }
}

function createGetterInvoker(fn) {
    return function computedGetter() {
        return fn.call(this, this)
    }
}

function initMethods(vm: Component, methods: Object) {
    const props = vm.$options.props

    // 如方法名已在props中定义或为保留字则报错
    for (const key in methods) {
        if (process.env.NODE_ENV !== 'production') {
            if (typeof methods[key] !== 'function') {
                warn(
                    `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
                    `Did you reference the function correctly?`,
                    vm
                )
            }
            if (props && hasOwn(props, key)) {
                warn(
                    `Method "${key}" has already been defined as a prop.`,
                    vm
                )
            }
            if ((key in vm) && isReserved(key)) {
                warn(
                    `Method "${key}" conflicts with an existing Vue instance method. ` +
                    `Avoid defining component methods that start with _ or $.`
                )
            }
        }

        // 在vm实例上挂载该方法, 当该方法不为函数时, 直接清空, 将方法的this指向绑定为当前vm实例
        vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
    }
}

function initWatch(vm: Component, watch: Object) {
    for (const key in watch) {
        const handler = watch[key];

        // 对watch的类型分别处理
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i])
            }
        } else {
            createWatcher(vm, key, handler)
        }
    }
}

function createWatcher(
    vm: Component,
    expOrFn: string | Function,
    handler: any,
    options ? : Object
) {

    // 处理对象形式的watch
    if (isPlainObject(handler)) {
        options = handler;
        handler = handler.handler;
    }

    // 当对应watch值为字符串时, 取vm实例上的该值所代表的的方法
    if (typeof handler === 'string') {
        handler = vm[handler];
    }

    // 注册watch
    return vm.$watch(expOrFn, handler, options)
}

export function stateMixin(Vue: Class < Component > ) {
    // flow somehow has problems with directly declared definition object
    // when using Object.defineProperty, so we have to procedurally build up
    // the object here.
    // flow在使用Object.defineProperty声明对象时会遇到一些问题，所以我们必须将其类型
    // 声明通过程序的方式展示出来

    // data属性的查询器
    const dataDef = {}
    dataDef.get = function () {
        return this._data
    }

    // props属性的查询器
    const propsDef = {};
    propsDef.get = function () {
        return this._props
    }

    // 为$data与$props添加setter，不允许用户修改这两个属性
    if (process.env.NODE_ENV !== 'production') {
        dataDef.set = function () {
            warn(
                'Avoid replacing instance root $data. ' +
                'Use nested data properties instead.',
                this
            )
        }
        propsDef.set = function () {
            warn(`$props is readonly.`, this)
        }
    }

    // 定义两个查询vm实例data与props的属性
    Object.defineProperty(Vue.prototype, '$data', dataDef);
    Object.defineProperty(Vue.prototype, '$props', propsDef);

    Vue.prototype.$set = set
    Vue.prototype.$delete = del

    Vue.prototype.$watch = function (
        expOrFn: string | Function,
        cb: any,
        options ? : Object
    ): Function {
        const vm: Component = this
        if (isPlainObject(cb)) {
            return createWatcher(vm, expOrFn, cb, options)
        }

        options = options || {}
        options.user = true

        // 参数分别为 当前vm实例, watcher名, 回调函数, watcher配置
        const watcher = new Watcher(vm, expOrFn, cb, options);

        // 设置immediate时, 在注册完watcher后立即触发一次
        if (options.immediate) {
            try {
                cb.call(vm, watcher.value)
            } catch (error) {
                handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
            }
        }

        // 返回一个用于销毁watcher的函数
        return function unwatchFn() {
            watcher.teardown()
        }
    }
}