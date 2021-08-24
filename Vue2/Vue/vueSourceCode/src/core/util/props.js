/* @flow */

import {
    warn
} from './debug'
import {
    observe,
    toggleObserving,
    shouldObserve
} from '../observer/index'
import {
    hasOwn,
    isObject,
    toRawType,
    hyphenate,
    capitalize,
    isPlainObject
} from 'shared/util'

type PropOptions = {
    type: Function | Array < Function > | null,
    default: any,
    required: ? boolean,
    validator: ? Function
};

export function validateProp(
    key: string,
    propOptions: Object,
    propsData: Object,
    vm ? : Component
): any {

    // 获取当前prop的配置对象
    const prop = propOptions[key];

    // 是否未传入该prop值
    const absent = !hasOwn(propsData, key);

    // 获取传入组件的prop值
    let value = propsData[key];

    // 检查type是否为Boolean类型，并返回其下标(这里主要是针对数组形式的type)
    const booleanIndex = getTypeIndex(Boolean, prop.type);

    // 如果可选type存在Boolean类型，则对其值进行检查
    // 下面的实际上是将其他type的空值都转化为Boolean类型
    if (booleanIndex > -1) {

        // 如果未传入该prop值且未定义默认值时，则赋值为false
        if (absent && !hasOwn(prop, 'default')) {
            value = false;

        // 如果传入空字符串或同键名的字符串值，也认为是有值
        } else if (value === '' || value === hyphenate(key)) {
            // only cast empty string / same name to boolean if
            // boolean has higher priority
            // 两个单独的例子，在空字符串或同名的键值时
            // 如果Boolean类型具有更高的权重，则将其转化为布尔值
            const stringIndex = getTypeIndex(String, prop.type)
            if (stringIndex < 0 || booleanIndex < stringIndex) {
                value = true
            }
        }
    }

    // 检查是否有default默认值, 在该props值为undefined时，用默认值代替它
    // 这里注意是全等undefined！传入null无效
    if (value === undefined) {

        // 获取设置的default默认值
        value = getPropDefaultValue(vm, prop, key)

        // since the default value is a fresh copy,
        // make sure to observe it.
        // 因为默认值为新创建的对象, 所以需要为其转化为响应式
        const prevShouldObserve = shouldObserve;
        toggleObserving(true);

        // 对对象类型的value变更为响应式
        observe(value);
        toggleObserving(prevShouldObserve)
    }

    if (
        process.env.NODE_ENV !== 'production' &&
        // skip validation for weex recycle-list child component props
        !(__WEEX__ && isObject(value) && ('@binding' in value))
    ) {
        // 检测一个prop属性是否合法(包括type、require和valid属性)
        assertProp(prop, key, value, vm, absent)
    }
    return value;
}

/**
 * Get the default value of a prop.
 * 获取一个prop属性的默认值
 */
function getPropDefaultValue(vm: ? Component, prop : PropOptions, key: string): any {

    // 未配置默认值时, 返回undefined
    if (!hasOwn(prop, 'default')) {
        return undefined
    }

    const def = prop.default;

    // warn against non-factory defaults for Object & Array
    // 在Object/Array类型时, default必须是工厂函数的形式
    if (process.env.NODE_ENV !== 'production' && isObject(def)) {
        warn(
            'Invalid default value for prop "' + key + '": ' +
            'Props with type Object/Array must use a factory function ' +
            'to return the default value.',
            vm
        )
    }

    // the raw prop value was also undefined from previous render,
    // return previous default value to avoid unnecessary watcher trigger
    // 如果在上次渲染中该prop的值同样为undefined,
    // 那么直接返回上次渲染获取的prop默认值来避免不必要的watcher的触发
    if (vm && vm.$options.propsData &&
        vm.$options.propsData[key] === undefined &&
        vm._props[key] !== undefined
    ) {
        return vm._props[key]
    }

    // call factory function for non-Function types
    // a value is Function if its prototype is function even across different execution context
    return typeof def === 'function' && getType(prop.type) !== 'Function' ?
        def.call(vm) :
        def
}

/**
 * Assert whether a prop is valid.
 * 断言一个prop是否有效
 */
function assertProp(
    prop: PropOptions,
    name: string,
    value: any,
    vm: ? Component,

    // 是否未传入prop值
    absent : boolean
) {

    // 当设置required但未传入值时
    if (prop.required && absent) {
        warn(
            'Missing required prop: "' + name + '"',
            vm
        )
        return;
    }

    // 当设置required时，传入null会直接通过效验
    if (value == null && !prop.required) {
        return
    }
    let type = prop.type;

    // 是否效验通过，当传入非true的type时，一开始是不通过的
    let valid = !type || type === true
    const expectedTypes = [];

    // 格式化type中的类型筛选，将其格式为数组
    if (type) {

        // 首先格式化为数组
        if (!Array.isArray(type)) {
            type = [type]
        }

        // 遍历type中各个类型，看prop值是否符合其中一个类型
        // 这里还有个条件为!valid，所以一旦有一个值效验成功，
        for (let i = 0; i < type.length && !valid; i++) {

            // 断言该type类型，并返回结果
            const assertedType = assertType(value, type[i]);

            // 将定义的type转化为字符串后重新加入expectedTypes
            expectedTypes.push(assertedType.expectedType || '');

            // 变更效验值状态
            valid = assertedType.valid;
        }
    }

    // 如果valid值仍为false，则报错类型检查未通过
    if (!valid) {
        warn(
            getInvalidTypeMessage(name, value, expectedTypes),
            vm
        )
        return
    }

    // 如果用户设置效验器
    const validator = prop.validator;
    if (validator) {

        // 若效验器返回false则说明效验未通过，则报错
        if (!validator(value)) {
            warn(
                'Invalid prop: custom validator check failed for prop "' + name + '".',
                vm
            )
        }
    }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType(value: any, type: Function): {
    valid: boolean;
    expectedType: string;
} {
    let valid;

    // 获取该类型的函数名称，即Object则返回Object字符串
    const expectedType = getType(type);

    // 这里的普通值检查使用的typeof，所以要进行区分
    if (simpleCheckRE.test(expectedType)) {
        const t = typeof value;
        valid = t === expectedType.toLowerCase()
        // for primitive wrapper objects
        if (!valid && t === 'object') {
            valid = value instanceof type
        }

    // 单独检测普通对象
    } else if (expectedType === 'Object') {
        valid = isPlainObject(value);

    // 效验数组
    } else if (expectedType === 'Array') {
        valid = Array.isArray(value);

    // 自定义构造函数的值也能进行效验
    } else {
        valid = value instanceof type
    }
    return {
        valid,
        expectedType
    }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 * 使用函数的字符串名称是检查内置的类型，因为在不同vms或iframes中直接的
 * 比较会失败
 */
function getType(fn) {

    // 返回该type类型的函数名称
    const match = fn && fn.toString().match(/^\s*function (\w+)/);
    return match ? match[1] : ''
}

function isSameType(a, b) {
    return getType(a) === getType(b)
}

// 检查expectedTypes
function getTypeIndex(type, expectedTypes): number {

    // 验证非数组情况
    if (!Array.isArray(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1
    }

    // 验证expectedTypes为数组的情况
    for (let i = 0, len = expectedTypes.length; i < len; i++) {

        // 返回符合条件的下标
        if (isSameType(expectedTypes[i], type)) {
            return i;
        }
    }
    return -1
}

function getInvalidTypeMessage(name, value, expectedTypes) {
    let message = `Invalid prop: type check failed for prop "${name}".` +
        ` Expected ${expectedTypes.map(capitalize).join(', ')}`
    const expectedType = expectedTypes[0]
    const receivedType = toRawType(value)
    const expectedValue = styleValue(value, expectedType)
    const receivedValue = styleValue(value, receivedType)
    // check if we need to specify expected value
    if (expectedTypes.length === 1 &&
        isExplicable(expectedType) &&
        !isBoolean(expectedType, receivedType)) {
        message += ` with value ${expectedValue}`
    }
    message += `, got ${receivedType} `
    // check if we need to specify received value
    if (isExplicable(receivedType)) {
        message += `with value ${receivedValue}.`
    }
    return message
}

function styleValue(value, type) {
    if (type === 'String') {
        return `"${value}"`
    } else if (type === 'Number') {
        return `${Number(value)}`
    } else {
        return `${value}`
    }
}

function isExplicable(value) {
    const explicitTypes = ['string', 'number', 'boolean']
    return explicitTypes.some(elem => value.toLowerCase() === elem)
}

function isBoolean(...args) {
    return args.some(elem => elem.toLowerCase() === 'boolean')
}