/* @flow */

export const emptyObject = Object.freeze({})

// These helpers produce better VM code in JS engines due to their
// explicitness and function inlining.
export function isUndef(v: any): boolean % checks {
    return v === undefined || v === null
}

export function isDef(v: any): boolean % checks {
    return v !== undefined && v !== null
}

export function isTrue(v: any): boolean % checks {
    return v === true
}

export function isFalse(v: any): boolean % checks {
    return v === false
}

/**
 * Check if value is primitive.
 */
export function isPrimitive(value: any): boolean % checks {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        // $flow-disable-line
        typeof value === 'symbol' ||
        typeof value === 'boolean'
    )
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
export function isObject(obj: mixed): boolean % checks {
    return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value, e.g., [object Object].
 */
const _toString = Object.prototype.toString

export function toRawType(value: any): string {
    return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
export function isPlainObject(obj: any): boolean {
    return _toString.call(obj) === '[object Object]'
}

export function isRegExp(v: any): boolean {
    return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
export function isValidArrayIndex(val: any): boolean {
    const n = parseFloat(String(val))
    return n >= 0 && Math.floor(n) === n && isFinite(val)
}

export function isPromise(val: any): boolean {
    return (
        isDef(val) &&
        typeof val.then === 'function' &&
        typeof val.catch === 'function'
    )
}

/**
 * Convert a value to a string that is actually rendered.
 */
export function toString(val: any): string {
    return val == null ?
        '' :
        Array.isArray(val) || (isPlainObject(val) && val.toString === _toString) ?
        JSON.stringify(val, null, 2) :
        String(val)
}

/**
 * Convert an input value to a number for persistence.
 * If the conversion fails, return original string.
 */
export function toNumber(val: string): number | string {
    const n = parseFloat(val)
    return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
export function makeMap(
    str: string,
    expectsLowerCase ? : boolean
): (key: string) => true | void {

    // 存储这些键
    const map = Object.create(null);
    const list: Array < string > = str.split(',');

    // 分别将这些值存入map表中
    for (let i = 0; i < list.length; i++) {
        map[list[i]] = true;
    }

    // 返回一个表用于检测是否存在传入的键
    return expectsLowerCase ?
        val => map[val.toLowerCase()] :
        val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 */
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if an attribute is a reserved attribute.
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * Remove an item from an array.
 */
export function remove(arr: Array < any > , item: any): Array < any > | void {
    if (arr.length) {
        const index = arr.indexOf(item);
        if (index > -1) {
            return arr.splice(index, 1)
        }
    }
}

/**
 * Check whether an object has the property.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(obj: Object | Array < * > , key: string): boolean {

    // 是否为自有属性
    return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */
export function cached < F: Function > (fn: F): F {

    // 将函数结果存储在该对象中
    const cache = Object.create(null);
    return (function cachedFn(str: string) {

        // 是否命中缓存
        const hit = cache[str];

        // 命中缓存时直接返回，否则重新调用函数取值并缓存
        return hit || (cache[str] = fn(str));
    }: any)
}

/**
 * Camelize a hyphen-delimited string.
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str: string): string => {
    return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * Capitalize a string.
 */
export const capitalize = cached((str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
    return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * Simple bind polyfill for environments that do not support it,
 * e.g., PhantomJS 1.x. Technically, we don't need this anymore
 * since native bind is now performant enough in most browsers.
 * But removing it would mean breaking code that was able to run in
 * PhantomJS 1.x, so this must be kept for backward compatibility.
 */

/* istanbul ignore next */
function polyfillBind(fn: Function, ctx: Object): Function {
    function boundFn(a) {
        const l = arguments.length
        return l ?
            l > 1 ?
            fn.apply(ctx, arguments) :
            fn.call(ctx, a) :
            fn.call(ctx)
    }

    boundFn._length = fn.length
    return boundFn
}

function nativeBind(fn: Function, ctx: Object): Function {
    return fn.bind(ctx)
}

export const bind = Function.prototype.bind ?
    nativeBind :
    polyfillBind

/**
 * Convert an Array-like object to a real Array.
 */
export function toArray(list: any, start ? : number): Array < any > {
    start = start || 0
    let i = list.length - start
    const ret: Array < any > = new Array(i);
    while (i--) {
        ret[i] = list[i + start]
    }
    return ret;
}

/**
 * Mix properties into target object.
 */
export function extend(to: Object, _from: ? Object): Object {
    for (const key in _from) {
        to[key] = _from[key]
    }
    return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
export function toObject(arr: Array < any > ): Object {
    const res = {}
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]) {
            extend(res, arr[i])
        }
    }
    return res
}

/* eslint-disable no-unused-vars */

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/).
 */
export function noop(a ? : any, b ? : any, c ? : any) {}

/**
 * Always return false.
 */
export const no = (a ? : any, b ? : any, c ? : any) => false

/* eslint-enable no-unused-vars */

/**
 * Return the same value.
 */
export const identity = (_: any) => _

/**
 * Generate a string containing static keys from compiler modules.
 */
export function genStaticKeys(modules: Array < ModuleOptions > ): string {
    return modules.reduce((keys, m) => {
        return keys.concat(m.staticKeys || [])
    }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 * 检查两个值是否大致相等，意思是如果为两个对象，那么它们对应的键和值等吗
 */
export function looseEqual(a: any, b: any): boolean {

    // 如果全等，则直接返回
    if (a === b) return true;
    const isObjectA = isObject(a);
    const isObjectB = isObject(b);

    // 如果两者都为对象
    if (isObjectA && isObjectB) {
        try {
            const isArrayA = Array.isArray(a)
            const isArrayB = Array.isArray(b)

            // 两者都为数组时，递归检测其每一个值是否松散相等
            if (isArrayA && isArrayB) {
                return a.length === b.length && a.every((e, i) => {
                    return looseEqual(e, b[i])
                });

            // 两个都为日期对象时，获取其时间是否相等
            } else if (a instanceof Date && b instanceof Date) {
                return a.getTime() === b.getTime();

            // 两个都为普通对象时，在其键值对个数一样的情况，下递归其各个值看是否相等
            } else if (!isArrayA && !isArrayB) {
                const keysA = Object.keys(a)
                const keysB = Object.keys(b)
                return keysA.length === keysB.length && keysA.every(key => {
                    return looseEqual(a[key], b[key])
                });
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }

    // 两者都不为对象时，且不全等时，则有可能为symbol，查看其值是否一样
    } else if (!isObjectA && !isObjectB) {
        return String(a) === String(b);
    } else {
        return false;
    }
}

/**
 * Return the first index at which a loosely equal value can be
 * found in the array (if value is a plain object, the array must
 * contain an object of the same shape), or -1 if it is not present.
 */
export function looseIndexOf(arr: Array < mixed > , val: mixed): number {

    // 找到第一个数组中与val值松散相等的值的下标
    for (let i = 0; i < arr.length; i++) {
        if (looseEqual(arr[i], val)) return i
    }
    return -1
}

/**
 * Ensure a function is called only once.
 */
export function once(fn: Function): Function {

    // 标记位，表示是否已经调用
    let called = false;
    return function () {
        if (!called) {
            called = true
            fn.apply(this, arguments)
        }
    }
}