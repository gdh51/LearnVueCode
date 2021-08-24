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

    // 初始化一个观察者对象数组, 用于存放watcher监听器们
    vm._watchers = [];
    const opts = vm.$options

    // 初始化props
    if (opts.props) initProps(vm, opts.props)

    // 初始化methods
    if (opts.methods) initMethods(vm, opts.methods)

    // 初始化data
    if (opts.data) {
        initData(vm)

    // 未定义data时，初始化一个空data并转化为响应式
    } else {
        observe(vm._data = {}, true /* asRootData */ )
    }

    // 初始化computed属性
    if (opts.computed) initComputed(vm, opts.computed)

    // 初始化watch监听器
    if (opts.watch && opts.watch !== nativeWatch) {
        initWatch(vm, opts.watch)
    }
}

function initProps(vm: Component, propsOptions: Object) {

    // 父组件或自定义传入的propsData值
    const propsData = vm.$options.propsData || {}

    // 在vm实例上定义_props的代理访问点
    const props = vm._props = {};

    // cache prop keys so that future props updates can iterate using Array
    // instead of dynamic object key enumeration.
    // 缓存prop的键名, 之后更新props时不用在次遍历对象来获取键名
    const keys = vm.$options._propKeys = [];

    // 确定其不为根vm实例
    const isRoot = !vm.$parent;

    // root instance props should be converted
    // 非根实例则要关闭Vue实例化时的依赖项收集
    if (!isRoot) {
        toggleObserving(false)
    }

    // 遍历组件原始定义的propsOptions配置
    for (const key in propsOptions) {
        keys.push(key);

        // 效验props中的各种属性，包括validate、required、type
        const value = validateProp(key, propsOptions, propsData, vm);

        // 生产环境中, 限制props名与修改props中属性
        // 为prop属性的setter定义一个报错函数，在修改该属性时报错
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
                        `overwritten
                        whenever the parent component re-renders. ` +
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
        // 在vm上代理_props中的属性
        if (!(key in vm)) {
            proxy(vm, `_props`, key)
        }
    }

    // 还原依赖项收集开关
    toggleObserving(true);
}

function initData(vm: Component) {

    // 获取组中中定义的data
    let data = vm.$options.data;

    // 获取用户定义的data的真实值, 并挂载在Vue实例的_data上
    data = vm._data = typeof data === 'function' ?

        // 获取函数值的返回值
        getData(data, vm) :
        data || {};

    // 当函数形式返回的不是对象时报错，你懂的
    if (!isPlainObject(data)) {
        data = {}
        process.env.NODE_ENV !== 'production' && warn(
            'data functions should return an object:\n' +
            'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
            vm
        )
    }

    // proxy data on instance
    // 将data的属性字段代理到vm实例上，这样我们就可以直接访问vm.xx来获取该值
    const keys = Object.keys(data);

    // 获取之前定义过的字段
    const props = vm.$options.props;
    const methods = vm.$options.methods;
    let i = keys.length;

    // 通过之前的代码我们知道，props与methods也会代理到vm实例上,
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

            // 代理data中属性到Vue实例上(即直接从vm.xx访问vm._data.xx)
            proxy(vm, `_data`, key);
        }
    }

    // 递归data使其所有属性为响应式属性
    observe(data, true /* asRootData */ )
}

export function getData(data: Function, vm: Component): any {

    // #7573 disable dep collection when invoking data getters
    // 禁止在调用getter时收集依赖项，防止重复收集依赖项
    pushTarget();
    try {

        // 获取函数的返回值(即返回的对象)
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

    // 在当前vm上挂载存放computed的Watcher的属性
    const watchers = vm._computedWatchers = Object.create(null);

    // computed properties are just getters during SSR
    // (忽视)计算属性仅作为getter在服务器渲染下
    const isSSR = isServerRendering()

    for (const key in computed) {
        const userDef = computed[key];

        // 获取计算属性的取值器
        const getter = typeof userDef === 'function' ? userDef : userDef.get;
        if (process.env.NODE_ENV !== 'production' && getter == null) {
            warn(
                `Getter is missing for computed property "${key}".`,
                vm
            )
        }

        // 为计算属性声明一个观察者对象，用于观察其他(变量)依赖项的变换
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
        // 组件定义的计算属性已经定义在组件原型上(即我们编写代码的组件的)。
        // 所以此时我们只需要将其定义在当前的实例对象上。
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

    // 是否应该缓存，仅在非服务器渲染下缓存
    const shouldCache = !isServerRendering();

    // 根据computed定义的类型来获取对应的getter
    if (typeof userDef === 'function') {
        sharedPropertyDefinition.get = shouldCache ?
            createComputedGetter(key) :

            // 服务器渲染getter(其实就是直接的函数求值)
            createGetterInvoker(userDef)
        sharedPropertyDefinition.set = noop
    } else {

        // 这里同上就不重复了
        sharedPropertyDefinition.get = userDef.get ?
            shouldCache && userDef.cache !== false ?
            createComputedGetter(key) :
            createGetterInvoker(userDef.get) :
            noop
        sharedPropertyDefinition.set = userDef.set || noop
    }

    // 未定义computed属性的setter时，为其定义一个报错setter，
    // 当执行赋值行为时就报错
    if (process.env.NODE_ENV !== 'production' &&
        sharedPropertyDefinition.set === noop) {
        sharedPropertyDefinition.set = function () {
            warn(
                `Computed property "${key}" was assigned to but it has no setter.`,
                this
            )
        }
    }

    // 在target(这里其实就是vm实例)上定义该computed属性的getter(访问器)
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter(key) {

    // 封装取值函数
    return function computedGetter() {

        // 取出对应computed属性的Watcher对象
        const watcher = this._computedWatchers && this._computedWatchers[key]

        if (watcher) {

            // 如果当前Watcher允许重新求值，那么就对Watcher重新求值
            // 这里的dirty相当于是否允许求值，会在该Watcher的依赖项变更时变为true
            if (watcher.dirty) {
                watcher.evaluate()
            }

            // 收集依赖项
            if (Dep.target) {
                watcher.depend()
            }

            // 返回当前Watcher的值
            return watcher.value;
        }
    }
}

function createGetterInvoker(fn) {

    // 封装了原函数，直接的函数求值
    return function computedGetter() {
        return fn.call(this, this)
    }
}

function initMethods(vm: Component, methods: Object) {

    // 获取props中设置的属性
    const props = vm.$options.props

    // 如果方法名与props中属性名重复或为保留字则报错
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

        // 在vm实例上挂载该方法, 当该方法不为函数时, 直接清空,
        // 同时将方法的this指向绑定为当前vm实例
        vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
    }
}

function initWatch(vm: Component, watch: Object) {

    // 遍历用户定义的watch
    for (const key in watch) {
        const handler = watch[key];

        // 对watch的类型分别处理创建Watcher
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i])
            }
        } else {
            createWatcher(vm, key, handler)
        }
    }
}

// 该函数用于格式化参数，然后调用$watch API
function createWatcher(
    vm: Component,
    expOrFn: string | Function,

    // 定义的实际watch，可能有对象或字符串，函数形式
    handler: any,
    options ? : Object
) {

    // 处理对象形式的watch
    if (isPlainObject(handler)) {

        // 对象形式的watch，将其视为options
        options = handler;

        // 提出里面的函数处理器赋值给handler
        handler = handler.handler;
    }

    // 当对应watch值为字符串时, 取vm实例上的该值所代表的的方法
    if (typeof handler === 'string') {
        handler = vm[handler];
    }

    // 注册watch，调用原型API，参数分别为watch名、函数处理器、watch配置对象
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
        const vm: Component = this;

        // 如果为对象，则格式化后在进行创建
        if (isPlainObject(cb)) {
            return createWatcher(vm, expOrFn, cb, options)
        }

        // 存储配置对象，定义特定字段user
        options = options || {};
        options.user = true;

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