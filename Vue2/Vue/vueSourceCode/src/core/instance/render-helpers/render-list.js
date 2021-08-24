/* @flow */

import {
    isObject,
    isDef,
    hasSymbol
} from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 */
export function renderList(

    // v-for指定的可迭代变量
    val: any,

    // v-for循环中的子节点渲染函数
    render: (
        val: any,
        keyOrIndex: string | number,
        index ? : number
    ) => VNode
): ? Array < VNode > {
    let ret: ? Array < VNode > , i, l, keys, key;

    // 传入数组或字符串时
    if (Array.isArray(val) || typeof val === 'string') {
        ret = new Array(val.length);

        // 遍历全部元素，并传入每个元素至渲染函数
        for (i = 0, l = val.length; i < l; i++) {
            ret[i] = render(val[i], i);
        }

    // 传入数字时, 从1开始为值进行传递
    } else if (typeof val === 'number') {
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            ret[i] = render(i + 1, i)
        }

    // 传入对象时，只要保证其能遍历
    } else if (isObject(val)) {

        // 是否支持迭代器
        if (hasSymbol && val[Symbol.iterator]) {
            ret = [];
            const iterator: Iterator < any > = val[Symbol.iterator]()
            let result = iterator.next();

            // 将迭代其返回值传入
            while (!result.done) {
                ret.push(render(result.value, ret.length))
                result = iterator.next()
            }

        // 不支持迭代器时(即为普通对象)，按键值顺序传入
        } else {
            keys = Object.keys(val)
            ret = new Array(keys.length)
            for (i = 0, l = keys.length; i < l; i++) {
                key = keys[i]
                ret[i] = render(val[key], key, i)
            }
        }
    }

    // 传入val为其他值时，无效，返回空数组
    if (!isDef(ret)) {
        ret = []
    }

    // 挂载v-list标记位
    (ret: any)._isVList = true;
    return ret;
}