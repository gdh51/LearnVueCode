/* @flow */

import type VueRouter from '../index'
import {
    stringifyQuery
} from './query'

const trailingSlashRE = /\/?$/

export function createRoute(
    record: ? RouteRecord,
    location : Location,
    redirectedFrom ? : ? Location,
    router ? : VueRouter
): Route {

    // 获取用户提供的提取查询字符串的自定义函数
    const stringifyQuery = router && router.options.stringifyQuery;

    // 提取当前地址的查询字符串对象
    let query: any = location.query || {}
    try {
        // 深度克隆query对象
        query = clone(query)
    } catch (e) {}

    // 记录当前地址的路由路径信息
    const route: Route = {
        name: location.name || (record && record.name),
        meta: (record && record.meta) || {},
        path: location.path || '/',
        hash: location.hash || '',
        query,
        params: location.params || {},

        // 返回完整的URL地址
        fullPath: getFullPath(location, stringifyQuery),

        // 将当前路由及其所有父级路由按序添加到该数组
        matched: record ? formatMatch(record) : []
    }

    // 如果是从定向，那么还要记录从定向之前的地址
    if (redirectedFrom) {
        route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
    }

    // 返回该当前路由信息的对象，并不允许修改
    return Object.freeze(route)
}

// 处数组浅克隆外，其他的进行深克隆
function clone(value) {
    if (Array.isArray(value)) {
        return value.map(clone)
    } else if (value && typeof value === 'object') {
        const res = {}
        for (const key in value) {
            res[key] = clone(value[key])
        }
        return res
    } else {
        return value
    }
}

// the starting route that represents the initial state
// 标识初始状态的起始路径
export const START = createRoute(null, {
    path: '/'
});

// 将当前子路由的记录表，按子->父->根的顺序存放在该数组中
function formatMatch(record: ? RouteRecord): Array < RouteRecord > {
    const res = [];

    // 将此路径下所有的路由记录对象添加到res中
    while (record) {
        res.unshift(record)
        record = record.parent
    }
    return res;
}

function getFullPath({
        path,
        query = {},
        hash = ''
    },
    _stringifyQuery
): string {

    // 优先使用用户定义的提取查询字符串函数，否则使用默认的
    const stringify = _stringifyQuery || stringifyQuery;

    // 返回完整的URL地址
    return (path || '/') + stringify(query) + hash
}

export function isSameRoute(a: Route, b: ? Route): boolean {

    // 为初始化路由则直接返回
    if (b === START) {
        return a === b;

    // 无路由时直接返回false
    } else if (!b) {
        return false

    // 如果存在路径时
    } else if (a.path && b.path) {
        return (

            // 将路径末尾的/清除掉后，是否相等
            a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&

            // hash值也要想等
            a.hash === b.hash &&

            // 且query一样
            isObjectEqual(a.query, b.query)
        )

    // 当不为路径而是指定命名路由时
    } else if (a.name && b.name) {

        // 同样是满足这些条件相同
        return (
            a.name === b.name &&
            a.hash === b.hash &&
            isObjectEqual(a.query, b.query) &&
            isObjectEqual(a.params, b.params)
        )
    } else {
        return false
    }
}

function isObjectEqual(a = {}, b = {}): boolean {
    // handle null value #1566
    if (!a || !b) return a === b
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
        return false
    }
    return aKeys.every(key => {
        const aVal = a[key]
        const bVal = b[key]
        // check nested equality
        if (typeof aVal === 'object' && typeof bVal === 'object') {
            return isObjectEqual(aVal, bVal)
        }
        return String(aVal) === String(bVal)
    })
}

export function isIncludedRoute(current: Route, target: Route): boolean {
    return (
        current.path.replace(trailingSlashRE, '/').indexOf(
            target.path.replace(trailingSlashRE, '/')
        ) === 0 &&
        (!target.hash || current.hash === target.hash) &&
        queryIncludes(current.query, target.query)
    )
}

function queryIncludes(current: Dictionary < string > , target: Dictionary < string > ): boolean {
    for (const key in target) {
        if (!(key in current)) {
            return false
        }
    }
    return true
}