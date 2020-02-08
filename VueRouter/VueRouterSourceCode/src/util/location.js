/* @flow */

import type VueRouter from '../index'
import {
    parsePath,
    resolvePath
} from './path'
import {
    resolveQuery
} from './query'
import {
    fillParams
} from './params'
import {
    warn
} from './warn'
import {
    extend
} from './misc'

export function normalizeLocation(

    // 当前URL地址
    raw: RawLocation,

    // 当前地址对应的信息对象
    current: ? Route,

    // 是否添加到最后
    append : ? boolean,

    // 路由器
    router : ? VueRouter
): Location {

    // 将URL地址格式化为对象
    let next: Location = typeof raw === 'string' ? {
        path: raw
    } : raw;

    // named target
    // 如果已经标准化则直接返回
    if (next._normalized) {
        return next;

    //如果为命名对象，则浅复制后返回
    } else if (next.name) {
        next = extend({}, raw)
        const params = next.params
        if (params && typeof params === 'object') {
            next.params = extend({}, params)
        }
        return next
    }

    // relative params
    // 如果当前无路径信息，但有查询字符串信息
    if (!next.path && next.params && current) {
        next = extend({}, next);
        next._normalized = true;

        // 合并路由信息中的查询字符串参数
        const params: any = extend(extend({}, current.params), next.params);

        // 更新当前信息对象的信息
        if (current.name) {
            next.name = current.name
            next.params = params
        } else if (current.matched.length) {
            const rawPath = current.matched[current.matched.length - 1].path
            next.path = fillParams(rawPath, params, `path ${current.path}`)
        } else if (process.env.NODE_ENV !== 'production') {
            warn(false, `relative params navigation requires a current route.`)
        }
        return next
    }

    const parsedPath = parsePath(next.path || '')
    const basePath = (current && current.path) || '/'
    const path = parsedPath.path ?
        resolvePath(parsedPath.path, basePath, append || next.append) :
        basePath

    const query = resolveQuery(
        parsedPath.query,
        next.query,
        router && router.options.parseQuery
    )

    let hash = next.hash || parsedPath.hash
    if (hash && hash.charAt(0) !== '#') {
        hash = `#${hash}`
    }

    return {
        _normalized: true,
        path,
        query,
        hash
    }
}