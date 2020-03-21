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
    path: string,
    params: ? Object,
    routeMsg : string
): string {

    // 当前路径下的子路径参数
    params = params || {};

    try {

        // 优先获取缓存，之后在考虑对当前地址进行合法的转换
        // 这里是逆向将reg转化为string
        const filler =
            regexpCompileCache[path] ||
            (regexpCompileCache[path] = Regexp.compile(path))

        // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
        // 添加通配符匹配的信息
        if (params.pathMatch) params[0] = params.pathMatch

        // 将当前路径转化为编码字符串
        return filler(params, {
            pretty: true
        })
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