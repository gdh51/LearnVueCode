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

        // 按定义顺序标准化好的RouteRecords
        pathList,

        // 按路由地址path->RouteRecord的Map
        pathMap,

        // 按路由名称name->RouteRecord的Map
        nameMap
    } = createRouteMap(routes);

    function addRoutes(routes) {

        // 添加新的路由路径，在原3表的基础上
        createRouteMap(routes, pathList, pathMap, nameMap)
    }

    function match(

        // 当前的路径字符串(包括hash)或一个路径信息的对象
        raw: RawLocation,

        // 当前的路由路径记录对象Route（也即跳转前的）
        currentRoute ? : Route,
        redirectedFrom ? : Location
    ): Route {

        // 结合当前路径对象与将来的路径对象参数生成将来的Location
        const location = normalizeLocation(raw, currentRoute, false, router);

        // 优先查看Location是否制定命名路由
        const {
            name
        } = location;

        if (name) {

            // 取出指定命名路由的RouteRecord
            const record = nameMap[name];
            if (process.env.NODE_ENV !== 'production') {
                warn(record, `Route with name '${name}' does not exist`)
            }

            // 如果没有该组件，则返回一个空路由路径记录对象Route
            if (!record) return _createRoute(null, location);

            // 返回动态参数的名称组成的数组
            const paramNames = record.regex.keys
                .filter(key => !key.optional)
                .map(key => key.name)

            if (typeof location.params !== 'object') {
                location.params = {}
            }

            // 填充Location对象缺失的动态路径参数值
            // 如果之前的Route存在路径参数
            if (currentRoute && typeof currentRoute.params === 'object') {

                // 则遍历它的对象字段
                for (const key in currentRoute.params) {

                    // 前路由路径参数字段不存在当前跳转路径中时且该参数为路径必须的动态参数时
                    if (!(key in location.params) && paramNames.indexOf(key) > -1) {

                        // 将跳转路径继承上一个路由的Route的字段值
                        location.params[key] = currentRoute.params[key]
                    }
                }
            }

            // 填充动态参数至RouteRecord.path
            location.path = fillParams(record.path, location.params, `named route "${name}"`)

            // 创建新的路径对象返回
            return _createRoute(record, location, redirectedFrom);

        // 当指定了跳转的路径时
        } else if (location.path) {

            location.params = {};

            // 遍历路径列表查找于路径匹配的RouteRecord
            for (let i = 0; i < pathList.length; i++) {
                const path = pathList[i];
                const record = pathMap[path];

                // 查询匹配到的路由，将path中的动态参数填充到params中
                if (matchRoute(record.regex, location.path, location.params)) {

                    // 为即将跳转路径填充params参数
                    return _createRoute(record, location, redirectedFrom)
                }
            }
        }

        // no match
        // 无匹配时返回个空路径信息对象
        return _createRoute(null, location)
    }

    function redirect(

        // 即将要跳转的RouteRecord
        record: RouteRecord,

        // 即将要跳转的Location
        location: Location
    ): Route {

        // 获取重定向地址
        const originalRedirect = record.redirect

        // 如果定义的重定向地址为函数，则创建一个即将跳转的Route传入后调用
        let redirect = typeof originalRedirect === 'function' ?
            originalRedirect(createRoute(record, location, null, router)) :
            originalRedirect

        // 重新获取重定向后的Raw Location对象
        if (typeof redirect === 'string') {
            redirect = {
                path: redirect
            }
        }

        // 返回的Raw Location对象非对象或字符串时，报错
        if (!redirect || typeof redirect !== 'object') {
            if (process.env.NODE_ENV !== 'production') {
                warn(
                    false, `invalid redirect option: ${JSON.stringify(redirect)}`
                )
            }
            return _createRoute(null, location)
        }

        // 获取重定向的Raw Location对象
        const re: Object = redirect;
        const {
            name,
            path
        } = re;

        // 为其填充query/hash/params等参数
        let {
            query,
            hash,
            params
        } = location;
        query = re.hasOwnProperty('query') ? re.query : query;
        hash = re.hasOwnProperty('hash') ? re.hash : hash;
        params = re.hasOwnProperty('params') ? re.params : params;

        // 如果返回的Raw Location对象为命名路由
        if (name) {
            // resolved named direct
            const targetRecord = nameMap[name]
            if (process.env.NODE_ENV !== 'production') {
                assert(targetRecord, `redirect failed: named route "${name}" not found.`)
            }

            // 直接创建标准化的Location对象重新走match流程
            return match({
                _normalized: true,
                name,
                query,
                hash,
                params
            }, undefined, location);

        // 如果重定向Raw Location为path类型
        } else if (path) {

            // 1. resolve relative redirect
            // 1. 重定向的path可以以重定向前path进行相对跳转
            const rawPath = resolveRecordPath(path, record);

            // 2. resolve params
            // 2. 填充动态参值
            const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)

            // 3. rematch with existing query and hash
            // 3. 重新调用match匹配重定向后的RouteRecord
            return match({
                _normalized: true,
                path: resolvedPath,
                query,
                hash
            }, undefined, location);

        // 剩余情况就报错
        } else {
            if (process.env.NODE_ENV !== 'production') {
                warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
            }
            return _createRoute(null, location)
        }
    }

    function alias(

        // 别名跳转的RouteRecord（即别名跳转的RouteRecord）
        record: RouteRecord,

        // 别名跳转的Location对象
        location: Location,

        // 别名对应的真实路径
        matchAs: string
    ): Route {

        // 填充真实path中的动态参数
        const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)

        // 重新走match匹配，获取真实的Route
        const aliasedMatch = match({
            _normalized: true,
            path: aliasedPath
        });

        // 如果获取到了Route
        if (aliasedMatch) {

            // 获取其匹配的RouteRecords
            const matched = aliasedMatch.matched;

            // 取精准匹配的那个RouteRecord
            const aliasedRecord = matched[matched.length - 1];

            // 创建新的Route，利用真实的RouteRecord和别名的Location
            location.params = aliasedMatch.params;
            return _createRoute(aliasedRecord, location);
        }

        // 未匹配时，生成空的Record
        return _createRoute(null, location)
    }

    function _createRoute(

        // 当前匹配到的RouteRecord
        record: ? RouteRecord,

        // 当前的路径信息对象
        location : Location,

        // 重定向的地址的路径信息对象
        redirectedFrom ? : Location
    ): Route {

        // 如果该路径定义有重定向，则进行重定向
        if (record && record.redirect) {
            return redirect(record, redirectedFrom || location)
        }

        // 如果RouteRecord存在别名，优先进行别名路径查询
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

    // RouteRecord的path的RegExp表达式
    regex: RouteRegExp,

    // 跳转的路径
    path: string,

    // 跳转的路径参数
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

    // 如果具有其他路径参数时，填充路径中动态参数值
    for (let i = 1, len = m.length; i < len; ++i) {

        // 获取动态参数的key名
        const key = regex.keys[i - 1];

        // 获取对于动态参数的值
        const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]

        // 将该参数值赋值上去
        if (key) {
            // Fix #1994: using * with props: true generates a param named 0
            params[key.name || 'pathMatch'] = val
        }
    }

    return true
}

// 将重定向的path和重定向前的RouteRecord的上一级path来进行合并
// 即我们可以在重定向前的path上进行相对跳转(append行为)
function resolveRecordPath(path: string, record: RouteRecord): string {
    return resolvePath(path, record.parent ? record.parent.path : '/', true)
}