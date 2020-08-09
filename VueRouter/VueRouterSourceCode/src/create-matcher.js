/* @flow */

import type VueRouter from './index'
import {
    resolvePath
} from './util/path'
import {
    assert,
    warn
} from './util/warn'
import {
    createRoute
} from './util/route'
import {
    fillParams
} from './util/params'
import {
    createRouteMap
} from './create-route-map'
import {
    normalizeLocation
} from './util/location'

export type Matcher = {
    match: (raw: RawLocation, current ? : Route, redirectedFrom ? : Location) => Route;
    addRoutes: (routes: Array < RouteConfig > ) => void;
};

export function createMatcher(
    routes: Array < RouteConfig > ,
    router: VueRouter
): Matcher {
    const {
        pathList,
        pathMap,
        nameMap
    } = createRouteMap(routes)

    function addRoutes(routes) {

        // 添加新的路由路径，在原3表的基础上
        createRouteMap(routes, pathList, pathMap, nameMap)
    }

    function match(

        // 当前的路径字符串(包括hash)或一个路径信息的对象
        raw: RawLocation,

        // 当前的路由路径记录对象Route
        currentRoute ? : Route,
        redirectedFrom ? : Location
    ): Route {

        // 结合当前路径对象与将来的路径对象参数生成将来的路径对象
        const location = normalizeLocation(raw, currentRoute, false, router);
        const {
            name
        } = location;

        // 如果将来的路径对象指定了组件名称
        if (name) {

            // 取出指定路径下的路由信息对象
            const record = nameMap[name];
            if (process.env.NODE_ENV !== 'production') {
                warn(record, `Route with name '${name}' does not exist`)
            }

            // 如果没有该组件，则返回一个空路径信息对象
            if (!record) return _createRoute(null, location);
            const paramNames = record.regex.keys
                .filter(key => !key.optional)
                .map(key => key.name)

            if (typeof location.params !== 'object') {
                location.params = {}
            }

            // 将剩余的路径参数复制进location中
            if (currentRoute && typeof currentRoute.params === 'object') {
                for (const key in currentRoute.params) {
                    if (!(key in location.params) && paramNames.indexOf(key) > -1) {
                        location.params[key] = currentRoute.params[key]
                    }
                }
            }

            // 将参数与当前路径合并为完成的路径
            location.path = fillParams(record.path, location.params, `named route "${name}"`)

            // 创建新的路径对象返回
            return _createRoute(record, location, redirectedFrom);

        // 当指定了跳转的路径时
        } else if (location.path) {

            // 返回匹配路径的路由对象
            location.params = {}
            for (let i = 0; i < pathList.length; i++) {
                const path = pathList[i];
                const record = pathMap[path];

                // 查询匹配到的路由，同name一样创建一个路径信息对象返回
                if (matchRoute(record.regex, location.path, location.params)) {
                    return _createRoute(record, location, redirectedFrom)
                }
            }
        }

        // no match
        // 无匹配时返回个空路径信息对象
        return _createRoute(null, location)
    }

    function redirect(
        record: RouteRecord,
        location: Location
    ): Route {
        const originalRedirect = record.redirect
        let redirect = typeof originalRedirect === 'function' ?
            originalRedirect(createRoute(record, location, null, router)) :
            originalRedirect

        if (typeof redirect === 'string') {
            redirect = {
                path: redirect
            }
        }

        if (!redirect || typeof redirect !== 'object') {
            if (process.env.NODE_ENV !== 'production') {
                warn(
                    false, `invalid redirect option: ${JSON.stringify(redirect)}`
                )
            }
            return _createRoute(null, location)
        }

        const re: Object = redirect
        const {
            name,
            path
        } = re
        let {
            query,
            hash,
            params
        } = location
        query = re.hasOwnProperty('query') ? re.query : query
        hash = re.hasOwnProperty('hash') ? re.hash : hash
        params = re.hasOwnProperty('params') ? re.params : params

        if (name) {
            // resolved named direct
            const targetRecord = nameMap[name]
            if (process.env.NODE_ENV !== 'production') {
                assert(targetRecord, `redirect failed: named route "${name}" not found.`)
            }
            return match({
                _normalized: true,
                name,
                query,
                hash,
                params
            }, undefined, location)
        } else if (path) {
            // 1. resolve relative redirect
            const rawPath = resolveRecordPath(path, record)
            // 2. resolve params
            const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
            // 3. rematch with existing query and hash
            return match({
                _normalized: true,
                path: resolvedPath,
                query,
                hash
            }, undefined, location)
        } else {
            if (process.env.NODE_ENV !== 'production') {
                warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
            }
            return _createRoute(null, location)
        }
    }

    function alias(
        record: RouteRecord,
        location: Location,
        matchAs: string
    ): Route {
        const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
        const aliasedMatch = match({
            _normalized: true,
            path: aliasedPath
        })
        if (aliasedMatch) {
            const matched = aliasedMatch.matched
            const aliasedRecord = matched[matched.length - 1]
            location.params = aliasedMatch.params
            return _createRoute(aliasedRecord, location)
        }
        return _createRoute(null, location)
    }

    function _createRoute(

        // 当前匹配到的路由信息对象
        record: ? RouteRecord,

        // 当前的路径信息对象
        location : Location,

        // 重定向的地址的路径信息对象
        redirectedFrom ? : Location
    ): Route {

        // 优先进行重定向
        if (record && record.redirect) {
            return redirect(record, redirectedFrom || location)
        }

        // 其次进行别名跳转
        if (record && record.matchAs) {
            return alias(record, location, record.matchAs)
        }

        // 其余情况则创建一个新的路径信息对象返回
        return createRoute(record, location, redirectedFrom, router)
    }

    return {
        match,
        addRoutes
    }
}

function matchRoute(
    regex: RouteRegExp,
    path: string,
    params: Object
): boolean {

    // 是否匹配当前路径？
    const m = path.match(regex);

    // 不匹配时，直接返回false
    if (!m) {
        return false;

    // 匹配时，如果没有其他路径参数，则直接返回true
    } else if (!params) {
        return true
    }

    // 如果具有其他路径参数时，解决一个BUG
    for (let i = 1, len = m.length; i < len; ++i) {

        const key = regex.keys[i - 1]
        const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
        if (key) {
            // Fix #1994: using * with props: true generates a param named 0
            params[key.name || 'pathMatch'] = val
        }
    }

    return true
}

function resolveRecordPath(path: string, record: RouteRecord): string {
    return resolvePath(path, record.parent ? record.parent.path : '/', true)
}