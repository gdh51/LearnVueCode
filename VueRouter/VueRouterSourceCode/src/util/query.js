/* @flow */

import {
    warn
} from './warn'

const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
const encode = str => encodeURIComponent(str)
    .replace(encodeReserveRE, encodeReserveReplacer)
    .replace(commaRE, ',')

const decode = decodeURIComponent

export function resolveQuery(

    // 路径自带的query
    query: ? string,

    // 跳转路由携带的query
    extraQuery : Dictionary < string > = {},

    // 自定义解析方法
    _parseQuery: ? Function
): Dictionary < string > {

    // 是否提供查询字符串的解析函数，没有提供时，使用自带的
    const parse = _parseQuery || parseQuery
    let parsedQuery;

    // 解析查询字符串返回对象
    try {
        parsedQuery = parse(query || '')
    } catch (e) {
        process.env.NODE_ENV !== 'production' && warn(false, e.message)
        parsedQuery = {}
    }

    // 合并query，冲突时优先保留跳转的query
    for (const key in extraQuery) {
        parsedQuery[key] = extraQuery[key]
    }
    return parsedQuery
}

function parseQuery(query: string): Dictionary < string > {
    const res = {}

    query = query.trim().replace(/^(\?|#|&)/, '')

    if (!query) {
        return res
    }

    query.split('&').forEach(param => {
        const parts = param.replace(/\+/g, ' ').split('=')
        const key = decode(parts.shift())
        const val = parts.length > 0 ?
            decode(parts.join('=')) :
            null

        if (res[key] === undefined) {
            res[key] = val
        } else if (Array.isArray(res[key])) {
            res[key].push(val)
        } else {
            res[key] = [res[key], val]
        }
    })

    return res
}

export function stringifyQuery(obj: Dictionary < string > ): string {
    const res = obj ? Object.keys(obj).map(key => {
        const val = obj[key]

        if (val === undefined) {
            return ''
        }

        if (val === null) {
            return encode(key)
        }

        if (Array.isArray(val)) {
            const result = []
            val.forEach(val2 => {
                if (val2 === undefined) {
                    return
                }
                if (val2 === null) {
                    result.push(encode(key))
                } else {
                    result.push(encode(key) + '=' + encode(val2))
                }
            })
            return result.join('&')
        }

        return encode(key) + '=' + encode(val)
    }).filter(x => x.length > 0).join('&') : null
    return res ? `?${res}` : ''
}