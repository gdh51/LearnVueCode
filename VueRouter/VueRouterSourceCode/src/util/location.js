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

// 该方法用于完整化Location对象(该对象指我们定义Router-link 中to的那些路径的补全)
// 除命名路由外，其他跳转Location都会标准化
export function normalizeLocation(

    // 当前的路径字符串或其当前router-link指定的to对象
    raw: RawLocation,

    // 当前的路由路径记录对象Route（这里指未跳转前的）
    current: ? Route,

    // 是否添加到路径最后
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
        const params = next.params;

        // 仅在传入对象形式的路径参数时复制并重写(防止修改原参数)
        if (params && typeof params === 'object') {
            next.params = extend({}, params);
        }
        return next;
    }

    // relative params
    // 当无路径字符串但具有路径参数时(肯定也不存在name)，
    // 将其处理为当前路径下的子路径(即视为相对路径)
    if (!next.path && next.params && current) {
        next = extend({}, next);

        // 将其标记为已标准化
        next._normalized = true;

        // 复制合并之前路由与即将跳转的路径参数
        // 优先保留即将跳转的路径信息
        const params: any = extend(extend({}, current.params), next.params);

        // 如果跳转前Route为命名路由，则直接复用，并传入路径参数
        if (current.name) {
            next.name = current.name;
            next.params = params;

        // 不为具名路由时，则从匹配的路由中寻找
        } else if (current.matched.length) {

            // 从最后一个路径地址开始匹配
            const rawPath = current.matched[current.matched.length - 1].path;

            // 将路径补全
            next.path = fillParams(rawPath, params, `path ${current.path}`)
        } else if (process.env.NODE_ENV !== 'production') {
            warn(false, `relative params navigation requires a current route.`)
        }
        return next;
    }

    // 进入此处说明仅有path或无path且无params

    // 提出path中各个参数的信息(hash/query/path)
    const parsedPath = parsePath(next.path || '');

    // 获取跳转前路径的字符串
    const basePath = (current && current.path) || '/';

    // 要跳转的路由是否给定了路径，如果给定了则进行合并
    const path = parsedPath.path ?

        // 将相对路径转化为绝对路径(不包括查询字符串)(要跳转的路径支持../形式)
        resolvePath(parsedPath.path, basePath, append || next.append) :

        // 无path则返回上一路径路径或基础路径
        basePath;

    // 解析查询合并查询字符串
    const query = resolveQuery(
        parsedPath.query,

        // 该参数存在时，只能说明用户定义在路由中存在该参数
        next.query,

        // 用户定义解析Query的方法
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