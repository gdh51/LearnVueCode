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

// 该函数用于处理当前路由跳转的参数信息
export function normalizeLocation(

    // 当前URL地址或其当前router-link指定的to对象
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

    // 如果为命名路由，则复制(某种意义上是深复制)其属性后直接返回
    } else if (next.name) {
        next = extend({}, raw);
        const params = next.params
        if (params && typeof params === 'object') {
            next.params = extend({}, params);
        }
        return next;
    }

    // relative params
    // 当无其他路由信息，而有路径信息时，将其处理为当前路径下的子路径
    if (!next.path && next.params && current) {
        next = extend({}, next);

        // 将其标记为已初始化
        next._normalized = true;

        // 复制并合并当前路由信息中的路径信息与要跳转的路径信息参数
        // 优先保留要跳转的路径信息
        const params: any = extend(extend({}, current.params), next.params);

        // 如果当前路由的组件使用命名形式，那么直接复用并更新子路径信息
        if (current.name) {
            next.name = current.name;
            next.params = params;

        // 没有具有路由名称时，则从匹配的路由中寻找
        } else if (current.matched.length) {

            // 优先取最后一个路径地址
            const rawPath = current.matched[current.matched.length - 1].path;

            // 获取跳转地址的url字符串
            next.path = fillParams(rawPath, params, `path ${current.path}`)
        } else if (process.env.NODE_ENV !== 'production') {
            warn(false, `relative params navigation requires a current route.`)
        }
        return next
    }

    // 获取URL，各部分的路径信息
    const parsedPath = parsePath(next.path || '');

    // 获取当前路径的字符串
    const basePath = (current && current.path) || '/';

    // 是否解析到路径地址，如果是则需要进行一个合并处理，否则使用现有的
    const path = parsedPath.path ?
        resolvePath(parsedPath.path, basePath, append || next.append) :
        basePath

    const query = resolveQuery(
        parsedPath.query,
        next.query,
        router && router.options.parseQuery
    )

    // 优先获取跳转地址的hash
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