/* @flow */

export function resolvePath(
    relative: string,
    base: string,
    append ? : boolean
): string {

    // 获取当前relative传入的具体是什么类型的属性
    const firstChar = relative.charAt(0);

    // 如果为路径，则直接返回
    if (firstChar === '/') {
        return relative
    }

    // 如果为查询字符串或hash值则拼接后返回
    if (firstChar === '?' || firstChar === '#') {
        return base + relative
    }

    // 不符合时则将base传入的路径地址进行分隔
    const stack = base.split('/')

    // remove trailing segment if:
    // - not appending
    // - appending to trailing slash (last segment is empty)
    if (!append || !stack[stack.length - 1]) {
        stack.pop()
    }

    // resolve relative path
    const segments = relative.replace(/^\//, '').split('/')
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        if (segment === '..') {
            stack.pop()
        } else if (segment !== '.') {
            stack.push(segment)
        }
    }

    // ensure leading slash
    if (stack[0] !== '') {
        stack.unshift('')
    }

    return stack.join('/')
}

// 解析URL，转换为参数形式
export function parsePath(path: string): {
    path: string;
    query: string;
    hash: string;
} {
    let hash = ''
    let query = ''

    const hashIndex = path.indexOf('#')
    if (hashIndex >= 0) {
        hash = path.slice(hashIndex)
        path = path.slice(0, hashIndex)
    }

    const queryIndex = path.indexOf('?')
    if (queryIndex >= 0) {
        query = path.slice(queryIndex + 1)
        path = path.slice(0, queryIndex)
    }

    // 返回对应部分的字符串表达式
    return {
        path,
        query,
        hash
    }
}

// 清空全部 //
export function cleanPath(path: string): string {
    return path.replace(/\/\//g, '/');
}