/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import {
    arrayMethods
} from './array'
import {
    def,
    warn,
    hasOwn,
    hasProto,
    isObject,
    isPlainObject,
    isPrimitive,
    isUndef,
    isValidArrayIndex,
    isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
    shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * Observer会挂载到每一个被观察的对象。一旦挂载，
 * 这个观察者就会将该对象的键值对转化为可以收集和触发依赖项更新的getter/setter
 */
export class Observer {
    value: any
    dep: Dep

    // number of vms that have this object as root $data
    // 若为根$data的vm实例的数量
    vmCount: number

    constructor(value: any) {

        // 获取当前值
        this.value = value;

        // 为该对象本身声明一个依赖项，用于检测该对象本身属性的删除或增加
        // 这里我们假定其为#dep1
        this.dep = new Dep();
        this.vmCount = 0;

        // 在该对象的_ob_属性上绑定该观察者对象
        def(value, '__ob__', this);

        // 根据不同类型的对象类型值，分别调用不同方法对其字段进行响应式处理
        if (Array.isArray(value)) {

            // 是否可以只用__proto__属性来访问原型对象
            if (hasProto) {
                // 当浏览器可以使用__proto__属性时, 将value原型指向arrayMethods
                protoAugment(value, arrayMethods)
            } else {

                // 没有该属性时, 直接在value上挂载所有数组方法
                copyAugment(value, arrayMethods, arrayKeys)
            }
            this.observeArray(value)
        } else {
            // 遍历data中属性, 使每一个属性变为响应式并将其添加依赖到对应视图
            this.walk(value)
        }
    }

    /**
     * Walk through all properties and convert them into
     * getter/setters. This method should only be called when
     * value type is Object.
     * 遍历所有属性，将它们转化为getter/setters形式。(仅在为Object时这么做)
     */
    walk(obj: Object) {
        const keys = Object.keys(obj)
        for (let i = 0; i < keys.length; i++) {

            // 重写所以的对象键值对
            defineReactive(obj, keys[i]);
        }
    }

    /**
     * Observe a list of Array items.
     */
    observeArray(items: Array < any > ) {

        // 对数组中每个元素调用观察方法
        for (let i = 0, l = items.length; i < l; i++) {
            observe(items[i])
        }
    }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
    target.__proto__ = src
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array < string > ) {
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        def(target, key, src[key])
    }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 为一个值创建一个观察者实例，如果观察成功则返回一个该观察者否则返回
 * 该值已有的观察者
 */
export function observe(value: any, asRootData: ? boolean): Observer | void {

    // 被设置的值要为对象，但不能为VNode，否则退出
    if (!isObject(value) || value instanceof VNode) {
        return
    }

    // 定义观察对象类型
    let ob: Observer | void;

    // 如果已有观察者对象，则直接使用该对象并返回
    if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
        ob = value.__ob__;
    } else if (
        shouldObserve &&
        !isServerRendering() &&

        // (这句检测已经是没有必要的，因为在最开始有isObject进行了检查)
        (Array.isArray(value) || isPlainObject(value)) &&
        Object.isExtensible(value) &&

        // 防止给vm添加观察者对象
        !value._isVue
    ) {
        ob = new Observer(value);
    }

    // 如果为根观察者对象，则增加其观察的vm数量值
    if (asRootData && ob) {
        ob.vmCount++
    }
    return ob;
}

/**
 * Define a reactive property on an Object.
 * 在一个对象上定义一个响应式属性
 */
export function defineReactive(
    obj: Object,
    key: string,
    val: any,
    customSetter ? : ? Function,

    // 是否深度递归进行响应式处理，默认为false
    shallow ? : boolean
) {
    // 实例化一个该属性的观察者队列
    const dep = new Dep();

    const property = Object.getOwnPropertyDescriptor(obj, key);

    // 如果不可配置则直接返回
    if (property && property.configurable === false) {
        return
    }

    // cater for pre-defined getter/setters
    // 获取用户定义的原始getter/setter
    const getter = property && property.get;
    const setter = property && property.set;

    // 在无getter但有setter时, 通过setter获取一次值作为该属性的原始值
    if ((!getter || setter) && arguments.length === 2) {
        val = obj[key]
    }

    // 递归处理val为对象的值，将其转化为响应式
    let childOb = !shallow && observe(val);
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            const value = getter ? getter.call(obj) : val
            if (Dep.target) {

                // 将当前属性添加到对应组件的Dep()对象中去
                dep.depend();
                if (childOb) {
                    childOb.dep.depend()
                    if (Array.isArray(value)) {
                        dependArray(value)
                    }
                }
            }
            return value
        },
        set: function reactiveSetter(newVal) {
            const value = getter ? getter.call(obj) : val

            // 值未变更则直接返回
            if (newVal === value || (newVal !== newVal && value !== value)) {
                return
            }

            // 调用自定义setter，比如_props会添加一个
            if (process.env.NODE_ENV !== 'production' && customSetter) {
                customSetter()
            }
            // #7981: for accessor properties without setter
            // 如果仅有getter却无setter也直接返回
            if (getter && !setter) return

            // 定义setter时，用setter求值
            if (setter) {
                setter.call(obj, newVal);
            } else {

                // 否则直接更新值
                val = newVal
            }

            // 在要深度响应化时，递归进行响应化处理当前对象值
            childOb = !shallow && observe(newVal);

            // 触发更新依赖项
            dep.notify()
        }
    })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 更新target上key位置值为val
 */
export function set(target: Array < any > | Object, key: any, val: any): any {
    if (process.env.NODE_ENV !== 'production' &&
        (isUndef(target) || isPrimitive(target))
    ) {
        warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
    }

    //更新数组key位置值为val
    if (Array.isArray(target) && isValidArrayIndex(key)) {
        target.length = Math.max(target.length, key)
        target.splice(key, 1, val)
        return val
    }

    // target上存在该自有属性则在更新
    if (key in target && !(key in Object.prototype)) {
        target[key] = val
        return val
    }

    // 静止在vue实例或$data属性上直接声明属性
    const ob = (target: any).__ob__
    if (target._isVue || (ob && ob.vmCount)) {
        process.env.NODE_ENV !== 'production' && warn(
            'Avoid adding reactive properties to a Vue instance or its root $data ' +
            'at runtime - declare it upfront in the data option.'
        )
        return val
    }

    // 暂存
    if (!ob) {
        target[key] = val
        return val
    }
    defineReactive(ob.value, key, val)
    ob.dep.notify()
    return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array < any > | Object, key: any) {
    if (process.env.NODE_ENV !== 'production' &&
        (isUndef(target) || isPrimitive(target))
    ) {
        warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
    }
    if (Array.isArray(target) && isValidArrayIndex(key)) {
        target.splice(key, 1)
        return
    }
    const ob = (target: any).__ob__
    if (target._isVue || (ob && ob.vmCount)) {
        process.env.NODE_ENV !== 'production' && warn(
            'Avoid deleting properties on a Vue instance or its root $data ' +
            '- just set it to null.'
        )
        return
    }
    if (!hasOwn(target, key)) {
        return
    }
    delete target[key]
    if (!ob) {
        return
    }
    ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array < any > ) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i]
        e && e.__ob__ && e.__ob__.dep.depend()
        if (Array.isArray(e)) {
            dependArray(e)
        }
    }
}