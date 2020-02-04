/* @flow */

import Regexp from 'path-to-regexp'
import {
    cleanPath
} from './util/path'
import {
    assert,
    warn
} from './util/warn'

export function createRouteMap(
    routes: Array < RouteConfig > ,
    oldPathList ? : Array < string > ,
    oldPathMap ? : Dictionary < RouteRecord > ,
    oldNameMap ? : Dictionary < RouteRecord >
): {
    pathList: Array < string > ,
    pathMap: Dictionary < RouteRecord > ,
    nameMap: Dictionary < RouteRecord >
} {
    // the path list is used to control path matching priority
    // 一个用于匹配路径的路径表
    const pathList: Array < string > = oldPathList || [];
    const pathMap: Dictionary < RouteRecord > = oldPathMap || Object.create(null);
    const nameMap: Dictionary < RouteRecord > = oldNameMap || Object.create(null);

    // 为每一个路由配置添加到路由map上
    routes.forEach(route => {
        addRouteRecord(pathList, pathMap, nameMap, route)
    })

    // ensure wildcard routes are always at the end
    // 确保通配符路径永远在路由表数组的最后
    for (let i = 0, l = pathList.length; i < l; i++) {

        // 找到通配符路径将其添加到路径表数组
        if (pathList[i] === '*') {
            pathList.push(pathList.splice(i, 1)[0])
            l--
            i--
        }
    }

    if (process.env.NODE_ENV === 'development') {

        // warn if routes do not include leading slashes
        // 每个路由地址都必须在首部以/开头
        const found = pathList
            // check for missing leading slash
            .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

        // 否则警告
        if (found.length > 0) {
            const pathNames = found.map(path => `- ${path}`).join('\n')
            warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
        }
    }

    // 返回三个记录路由情况的对象
    return {
        pathList,
        pathMap,
        nameMap
    }
}

function addRouteRecord(
    pathList: Array < string > ,
    pathMap: Dictionary < RouteRecord > ,
    nameMap: Dictionary < RouteRecord > ,

    // 用户定义的路由配置表
    route: RouteConfig,
    parent ? : RouteRecord,
    matchAs ? : string
) {
    // 提取配置中的路由地址和组件名称
    const {
        path,
        name
    } = route;

    // 为没配置path的用户报错
    if (process.env.NODE_ENV !== 'production') {
        assert(path != null, `"path" is required in a route configuration.`)
        assert(
            typeof route.component !== 'string',
            `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
        )
    }

    // 2.6新增api，用于将控制正则表达式路由规则的解析行为
    const pathToRegexpOptions: PathToRegexpOptions =
        route.pathToRegexpOptions || {};

    // 标准化用户配置路径
    const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

    // 路由路径匹配规则是否大小写敏感
    if (typeof route.caseSensitive === 'boolean') {

        // 同步正则表达式的大小写敏感规则
        pathToRegexpOptions.sensitive = route.caseSensitive
    }

    // 输入路由信息
    const record: RouteRecord = {
        path: normalizedPath,

        // 根据path生成一份正则表达式
        regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),

        // 该路由路径下代表的组件(默认情况下存放于default)
        components: route.components || {
            default: route.component
        },

        // 组件代表的vm实例
        instances: {},

        // 当前路由名称
        name,
        parent,
        matchAs,

        // 路由重定向路径
        redirect: route.redirect,
        beforeEnter: route.beforeEnter,

        // 路由信息元参数对象，记录该路由的信息
        meta: route.meta || {},

        // 是否将组件参数信息设置为组件实例属性
        props: route.props == null ?
            {} :
            route.components ?
            route.props :
            {
                default: route.props
            }
    }

    // 是否设置子路由路径
    if (route.children) {
        // Warn if route is named, does not redirect and has a default child route.
        // If users navigate to this route by name, the default child will
        // not be rendered (GH Issue #629)
        // 警告：如果该路由为命名路由，则不要重定向或有一个默认的子路由
        // 如果用户通过路由名称跳转到该路由时，该默认子组件不会被重新渲染
        if (process.env.NODE_ENV !== 'production') {

            // 命名路由，不具有重定向但具有具体的子路由路径
            if (
                route.name &&
                !route.redirect &&

                // 路径是否为单独的/或为空字符串
                route.children.some(child => /^\/?$/.test(child.path))
            ) {
                warn(
                    false,
                    `Named Route '${route.name}' has a default child route. ` +
                    `When navigating to this named route (:to="{name: '${
              route.name
            }'"), ` +
                    `the default child route will not be rendered. Remove the name from ` +
                    `this route and use the name of the default child route for named ` +
                    `links instead.`
                )
            }
        }

        // 遍历子路由数组，将其添加到记录中
        route.children.forEach(child => {
            const childMatchAs = matchAs ?
                cleanPath(`${matchAs}/${child.path}`) :
                undefined;

            // 递归调用该方法添加子路由
            addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
        })
    }

    // 如果Map中不存在该地址，则分别存入pathList与pathMap
    if (!pathMap[record.path]) {
        pathList.push(record.path)
        pathMap[record.path] = record
    }

    // 如果路由存在任何形式的别名
    if (route.alias !== undefined) {

        // 格式化别名为数组
        const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
        for (let i = 0; i < aliases.length; ++i) {
            const alias = aliases[i];

            // 禁止别名与路径值重复
            if (process.env.NODE_ENV !== 'production' && alias === path) {
                warn(
                    false,
                    `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
                )
                // skip in dev to make it work
                continue
            }

            // 将别名作为一个新的路由也添加到路由表中
            const aliasRoute = {
                path: alias,
                children: route.children
            }
            addRouteRecord(
                pathList,
                pathMap,
                nameMap,
                aliasRoute,
                parent,
                record.path || '/' // matchAs
            )
        }
    }

    // 如果具有路由名称，将其同时添加到路由名表中
    if (name) {
        if (!nameMap[name]) {
            nameMap[name] = record
        } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
            warn(
                false,
                `Duplicate named routes definition: ` +
                `{ name: "${name}", path: "${record.path}" }`
            )
        }
    }
}

function compileRouteRegex(
    path: string,
    pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {

    // 生成对应的正则表达式
    const regex = Regexp(path, [], pathToRegexpOptions);
    if (process.env.NODE_ENV !== 'production') {

        // 生成效验器防止填写重复的key值
        const keys: any = Object.create(null);
        regex.keys.forEach(key => {
            warn(
                !keys[key.name],
                `Duplicate param keys in route with path: "${path}"`
            )
            keys[key.name] = true
        })
    }
    return regex;
}

function normalizePath(
    path: string,
    parent ? : RouteRecord,
    strict ? : boolean
): string {

    // 严格模式下，保留path末尾的 /
    if (!strict) path = path.replace(/\/$/, '')

    // 如果以/开头，则说明为相对路径，直接返回
    if (path[0] === '/') return path

    // 初始化时，直接返回地址
    if (parent == null) return path

    // 清空全部 //
    return cleanPath(`${parent.path}/${path}`)
}