/* @flow */

import {
    warn
} from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
const regexpCompileCache: {
    [key: string]: Function
} = Object.create(null)

export function fillParams(

    // 定义在RouteRecord中的path
    path: string,

    // 路径参数
    params: ? Object,

    // 报错信息
    routeMsg : string
): string {

    // 当前路径下的子路径参数
    params = params || {};

    try {

        // 优先获取缓存，之后在考虑对当前地址进行合法的转换
        // 将RouteRecord中的path转化为函数，这样就支持/path/:id这种写法的匹配
        const filler =
            regexpCompileCache[path] ||
            (regexpCompileCache[path] = Regexp.compile(path))

        // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
        // 解决通配符路由问题
        if (params.pathMatch) params[0] = params.pathMatch

        // 合并路径参数转化为完整路径
        return filler(params, {

            // 该参数表示把转化的最终路径中特殊的符号不进转移
            // 比如/path/:id 传入{ id: ':'}, 不加pretty为/path/%3A 加了为/path/:
            pretty: true
        });
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            // Fix #3072 no warn if `pathMatch` is string
            warn(typeof params.pathMatch === 'string', `missing param for ${routeMsg}: ${e.message}`)
        }
        return ''
    } finally {

        // delete the 0 if it was added
        // 删除临时添加的路径参数
        delete params[0]
    }
}