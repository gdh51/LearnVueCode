/* @flow */

import config from '../config'
import {
    warn
} from './debug'
import {
    set
} from '../observer/index'
import {
    unicodeRegExp
} from './lang'
import {
    nativeWatch,
    hasSymbol
} from './env'

import {
    ASSET_TYPES,
    LIFECYCLE_HOOKS
} from 'shared/constants'

import {
    extend,
    hasOwn,
    camelize,
    toRawType,
    capitalize,
    isBuiltInTag,
    isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 * Options 重写策略是用来合并父与子options的, 初始为空对象
 */
const strats = config.optionMergeStrategies;

/**
 * Options with restrictions
 * 限制el/propsData属性, 只能于实例化中使用
 */
if (process.env.NODE_ENV !== 'production') {
    strats.el = strats.propsData = function (parent, child, vm, key) {
        if (!vm) {
            warn(
                `option "${key}" can only be used during instance ` +
                'creation with the `new` keyword.'
            )
        }
        return defaultStrat(parent, child)
    }
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData(to: Object, from: ? Object): Object {
    if (!from) return to;
    let key, toVal, fromVal;

    const keys = hasSymbol ?
        Reflect.ownKeys(from) :
        Object.keys(from);

    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        // in case the object is already observed...
        if (key === '__ob__') continue
        toVal = to[key];
        fromVal = from[key];
        if (!hasOwn(to, key)) {
            set(to, key, fromVal)
        } else if (
            toVal !== fromVal &&
            isPlainObject(toVal) &&
            isPlainObject(fromVal)
        ) {
            mergeData(toVal, fromVal)
        }
    }
    return to;
}

/**
 * Data
 */
export function mergeDataOrFn(
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {

    // 在组件中时，两者必须都为函数
    if (!vm) {
        // 返回其中存在的一个
        if (!childVal) {
            return parentVal;
        }
        if (!parentVal) {
            return childVal;
        }
        // when parentVal & childVal are both present,
        // we need to return a function that returns the
        // merged result of both functions... no need to
        // check if parentVal is a function here because
        // it has to be a function to pass previous merges.
        return function mergedDataFn() {
            return mergeData(
                typeof childVal === 'function' ? childVal.call(this, this) : childVal,
                typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
            );
        }

        // 合并Vue实例的data属性
    } else {
        return function mergedInstanceDataFn() {
            const instanceData = typeof childVal === 'function' ?
                childVal.call(vm, vm) :
                childVal;
            const defaultData = typeof parentVal === 'function' ?
                parentVal.call(vm, vm) :
                parentVal;

            if (instanceData) {
                return mergeData(instanceData, defaultData);
            } else {
                return defaultData;
            }
        }
    }
}

strats.data = function (
    parentVal: any,
    childVal: any,
    vm ? : Component
): ? Function {

    // 在组件中, data必须为函数
    if (!vm) {
        if (childVal && typeof childVal !== 'function') {
            process.env.NODE_ENV !== 'production' && warn(
                'The "data" option should be a function ' +
                'that returns a per-instance value in component ' +
                'definitions.',
                vm
            )

            return parentVal;
        }
        return mergeDataOrFn(parentVal, childVal);
    }

    return mergeDataOrFn(parentVal, childVal, vm);
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook(
    parentVal: ? Array < Function > ,
    childVal : ? Function | ? Array < Function >
) : ? Array < Function > {
    /**
     * 三种情况：
     * 1. 不存在childVal时， 直接返回parentVal
     * 2. 两者都存在时，返回两者数组合并的结果
     * 3. 不存在parentVal时，将childVal作为数组返回
     */
    const res = childVal ?
        (parentVal ? parentVal.concat(childVal) :
        (Array.isArray(childVal) ? childVal : [childVal]))
        : parentVal;

    // res数组去重
    return res ? dedupeHooks(res) : res;
}

function dedupeHooks(hooks) {
    // 将hooks添加至res，不添加重复的
    const res = [];
    for (let i = 0; i < hooks.length; i++) {
        if (res.indexOf(hooks[i]) === -1) {
            res.push(hooks[i]);
        }
    }
    return res;
}

LIFECYCLE_HOOKS.forEach(hook => {
    strats[hook] = mergeHook;
});

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets(
    parentVal: ? Object,
    childVal : ? Object,
    vm ? : Component,
    key : string
) : Object {
    // 将parentVal作为原型对象，childVal作为实例属性返回
    const res = Object.create(parentVal || null)
    if (childVal) {
        process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
        return extend(res, childVal);
    } else {
        return res;
    }
}

ASSET_TYPES.forEach(function (type) {
    strats[type + 's'] = mergeAssets
});

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
    parentVal: ? Object,
    childVal : ? Object,
    vm ? : Component,
    key : string
): ? Object {
    // work around Firefox's Object.prototype.watch...
    if (parentVal === nativeWatch) parentVal = undefined;
    if (childVal === nativeWatch) childVal = undefined;

    if (!childVal) return Object.create(parentVal || null)
    if (process.env.NODE_ENV !== 'production') {
        assertObjectType(key, childVal, vm)
    }
    if (!parentVal) return childVal
    const ret = {};

    // 两者都存在时, 向ret的每个属性格式化为数组并合并child和parent的属性
    extend(ret, parentVal)
    for (const key in childVal) {
        let parent = ret[key];
        const child = childVal[key];
        if (parent && !Array.isArray(parent)) {
            parent = [parent];
        }
        ret[key] = parent ?
            parent.concat(child) :
            (Array.isArray(child) ? child : [child]);
    }
    return ret;
}

/**
 * Other object hashes.
 */
strats.props =
    strats.methods =
    strats.inject =
    strats.computed = function (
        parentVal: ? Object,
        childVal : ? Object,
        vm ? : Component,
        key : string
    ): ? Object {
        if (childVal && process.env.NODE_ENV !== 'production') {
            assertObjectType(key, childVal, vm)
        }
        if (!parentVal) return childVal
        const ret = Object.create(null)
        extend(ret, parentVal)
        if (childVal) extend(ret, childVal)
        return ret
    }

/**
 * Default strategy.
 * 默认策略, 以子为依据, 返回非空一方
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
    return childVal === undefined ?
        parentVal :
        childVal
}

/**
 * Validate component names
 */
function checkComponents(options: Object) {
    for (const key in options.components) {
        validateComponentName(key)
    }
}

export function validateComponentName(name: string) {
    if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
        warn(
            'Invalid component name: "' + name + '". Component names ' +
            'should conform to valid custom element name in html5 specification.'
        )
    }
    if (isBuiltInTag(name) || config.isReservedTag(name)) {
        warn(
            'Do not use built-in or reserved HTML elements as component ' +
            'id: ' + name
        )
    }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * 将Props统一为对象的形式, 检查Options.props的语法
 */
function normalizeProps(options: Object, vm: ? Component) {
    const props = options.props;
    if (!props) return;
    const res = {};
    let i, val, name;

    // 用户数组形式定义时，每个参数必须为字符串，将其转换为对象
    if (Array.isArray(props)) {
        i = props.length
        while (i--) {
            val = props[i]
            if (typeof val === 'string') {
                name = camelize(val)
                res[name] = {
                    type: null
                }
            } else if (process.env.NODE_ENV !== 'production') {
                warn('props must be strings when using array syntax.')
            }
        }

    // 对象形式时，更具其属性的值，进行格式化
    } else if (isPlainObject(props)) {
        for (const key in props) {
            val = props[key]
            name = camelize(key)
            res[name] = isPlainObject(val) ?
                val : {
                    type: val
                }
        }

    // 两种数据类型都不是时，对不起，报错
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "props": expected an Array or an Object, ` +
            `but got ${toRawType(props)}.`,
            vm
        )
    }
    options.props = res;
}

/**
 * Normalize all injections into Object-based format
 * 将inject统一为对象的形式, 检查Options.inject的语法
 */
function normalizeInject(options: Object, vm: ? Component) {
    const inject = options.inject;
    if (!inject) return;
    const normalized = options.inject = {};

    // 数组形式时，值必须为字符串(虽然没有报错)
    if (Array.isArray(inject)) {
        for (let i = 0; i < inject.length; i++) {
            normalized[inject[i]] = {
                from: inject[i]
            }
        }

    // 对象形式时
    } else if (isPlainObject(inject)) {
        for (const key in inject) {
            const val = inject[key]
            normalized[key] = isPlainObject(val) ?
                extend({
                    from: key
                }, val) : {
                    from: val
                }
        }
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "inject": expected an Array or an Object, ` +
            `but got ${toRawType(inject)}.`,
            vm
        )
    }
}

/**
 * Normalize raw function directives into object format.
 * 在某个dir为函数形式时, 标准化options.directives为对象形式
 */
function normalizeDirectives(options: Object) {
    const dirs = options.directives
    if (dirs) {
        for (const key in dirs) {
            const def = dirs[key]
            if (typeof def === 'function') {
                dirs[key] = {
                    bind: def,
                    update: def
                }
            }
        }
    }
}

function assertObjectType(name: string, value: any, vm: ? Component) {
    if (!isPlainObject(value)) {
        warn(
            `Invalid value for option "${name}": expected an Object, ` +
            `but got ${toRawType(value)}.`,
            vm
        )
    }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
export function mergeOptions(
    parent: Object,
    child: Object,
    vm ? : Component
): Object {

    // 检查组件名称是否合法
    if (process.env.NODE_ENV !== 'production') {
        checkComponents(child);
    }

    if (typeof child === 'function') {
        child = child.options;
    }

    // 统一用户传入的props、inject、dir为对象格式
    normalizeProps(child, vm);
    normalizeInject(child, vm);
    normalizeDirectives(child);

    // Apply extends and mixins on the child options,
    // but only if it is a raw options object that isn't
    // the result of another mergeOptions call.
    // Only merged options has the _base property.
    // 在子options上应用extends/mixins属性仅当它们构造函数非Vue时
    if (!child._base) {
        if (child.extends) {
            parent = mergeOptions(parent, child.extends, vm)
        }
        if (child.mixins) {
            for (let i = 0, l = child.mixins.length; i < l; i++) {
                parent = mergeOptions(parent, child.mixins[i], vm)
            }
        }
    }

    const options = {};
    let key;

    // 合并parent中存在的key
    for (key in parent) {
        mergeField(key);
    }

    // 仅合并parent中在该child中不存在的key
    for (key in child) {
        if (!hasOwn(parent, key)) {
            mergeField(key);
        }

        function mergeField(key) {

            // 获取一个策略(已有或默认策略), 然后使用该策略对options中对应属性合并
            const strat = strats[key] || defaultStrat
            options[key] = strat(parent[key], child[key], vm, key)
        }
        return options
    }

    /**
     * Resolve an asset.
     * This function is used because child instances need access
     * to assets defined in its ancestor chain.
     * 解析options中的某个值，该函数用于子vm实例可能要使用其祖先组件中的某个属性
     */
    export function resolveAsset(
        options: Object,

        // 传入的类型
        type: string,

        // 标签名称或id
        id: string,
        warnMissing ? : boolean
    ): any {

        if (typeof id !== 'string') {
            return;
        }

        // 取出挂载在用户自定义配置上的属性
        const assets = options[type];

        // check local registration variations first
        // 优先检查是否为自有属性，优先返回自有属性
        if (hasOwn(assets, id)) return assets[id];

        // 下面分别返回其名称的-连接符式和驼峰式
        const camelizedId = camelize(id);
        if (hasOwn(assets, camelizedId)) return assets[camelizedId];
        const PascalCaseId = capitalize(camelizedId);
        if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId];

        // fallback to prototype chain
        // 如果本地变量没有则，依次检测其对应对象的原型链
        const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
        if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
            warn(
                'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
                options
            )
        }
        return res;
    }