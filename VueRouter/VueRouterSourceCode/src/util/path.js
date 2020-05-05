/* @flow */

export function resolvePath(

    // 相对路径（也有可能是一个完整的路径）
    relative: string,

    // 相对路径的基础路径
    base: string,

    // 是否直接添加在基础路径后
    append ? : boolean
): string {

    // 获取当前relative传入的具体是什么类型的属性
    const firstChar = relative.charAt(0);

    // 如果是以/开头，则视为绝对路径
    if (firstChar === '/') {
        return relative
    }

    // 如果为查询字符串或hash值则拼接后返回
    if (firstChar === '?' || firstChar === '#') {
        return base + relative;
    }

    // 当作为相对路径时，首先将之前的路径进行切割
    const stack = base.split('/');

    // remove trailing segment if:
    // 移除最后的参数如果满足以下参数
    // - not appending
    // - 不在末尾进行添加
    // - appending to trailing slash (last segment is empty)
    // - 或路径以/结尾时，要将其删除
    if (!append || !stack[stack.length - 1]) {
        stack.pop()
    }

    // resolve relative path
    // 解析相对路径字符串
    const segments = relative.replace(/^\//, '').split('/');
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        // 如果当前路径为..则移除
        if (segment === '..') {
            stack.pop();

        // 其他情况时加入到最终路径栈中
        } else if (segment !== '.') {
            stack.push(segment);
        }
    }

    // ensure leading slash
    // 确保路径以/开头
    if (stack[0] !== '') {
        stack.unshift('')
    }

    // 返回最终路径
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