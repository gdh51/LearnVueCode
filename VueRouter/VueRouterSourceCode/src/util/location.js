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

    // 当前的路径字符串或其当前router-link指定的to对象
    raw: RawLocation,

    // 当前地址对应的路径地址对象（这里指未跳转前的）
    current: ? Route,

    // 是否添加到最后
    append : ? boolean,

    // 路由实例
    router : ? VueRouter
): Location {

    // 将路径字符串同一为对象形式(next就表示即将要跳转的路径)
    let next: Location = typeof raw === 'string' ? {
        path: raw
    } : raw;

    // named target
    // 如果已经标准化则直接返回处理后的结果
    if (next._normalized) {
        return next;

    // 如果跳转的为命名路由，则复制(某种意义上是深复制)其属性后直接返回
    } else if (next.name) {
        next = extend({}, raw);
        const params = next.params
        if (params && typeof params === 'object') {
            next.params = extend({}, params);
        }
        return next;
    }

    // relative params
    // 当无路径字符串但具有路径对象时，将其处理为当前路径下的子路径(即视为相对路径)
    if (!next.path && next.params && current) {
        next = extend({}, next);

        // 将其标记为已初始化
        next._normalized = true;

        // 复制并合并当前路由信息中的路径信息与要跳转的路径信息参数
        // 优先保留要跳转的路径信息
        const params: any = extend(extend({}, current.params), next.params);

        // 如果当前路径对象具有命名组件，那么直接复用并更新子路径信息
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

    // 提出url中各个参数的信息(hash/query/path)
    const parsedPath = parsePath(next.path || '');

    // 获取跳转前路径的字符串
    const basePath = (current && current.path) || '/';

    // 要跳转的路由是否给定了路径，如果给定了则进行合并
    const path = parsedPath.path ?

        // 处理路径为最终路径
        resolvePath(parsedPath.path, basePath, append || next.append) :

        // 否则返回上一个路由的路径
        basePath;

    // 解析查询合并查询字符串
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

    // 返回标准化后结果
    return {
        _normalized: true,
        path,
        query,
        hash
    };
}