/* @flow */

import {
    isRegExp,
    remove
} from 'shared/util'
import {
    getFirstComponentChild
} from 'core/vdom/helpers/index'

type VNodeCache = {
    [key: string]: ? VNode
};

function getComponentName(opts: ? VNodeComponentOptions): ? string {
    return opts && (opts.Ctor.options.name || opts.tag)
}

function matches(pattern: string | RegExp | Array < string > , name: string) : boolean {

    // 支持数组形式
    if (Array.isArray(pattern)) {
        return pattern.indexOf(name) > -1;

    // 支持a,b,c这种字符串形式
    } else if (typeof pattern === 'string') {
        return pattern.split(',').indexOf(name) > -1;

    // 支持正则表达式
    } else if (isRegExp(pattern)) {
        return pattern.test(name);
    }

    return false
}

function pruneCache(keepAliveInstance: any, filter: Function) {
    const {
        cache,
        keys,
        _vnode
    } = keepAliveInstance
    for (const key in cache) {
        const cachedNode: ? VNode = cache[key]
        if (cachedNode) {
            const name: ? string = getComponentName(cachedNode.componentOptions)
            if (name && !filter(name)) {
                pruneCacheEntry(cache, key, keys, _vnode)
            }
        }
    }
}

function pruneCacheEntry(
    cache: VNodeCache,
    key: string,
    keys: Array < string > ,
    current ? : VNode
) {
    const cached = cache[key];

    // 在当前key值的缓存VNode不为当前的激活组件时，将该组件实例销毁
    if (cached && (!current || cached.tag !== current.tag)) {
        cached.componentInstance.$destroy()
    }

    // 清空该key值的组件VNode
    cache[key] = null;

    // 移除该key值
    remove(keys, key);
}

const patternTypes: Array < Function > = [String, RegExp, Array]

export default {
    name: 'keep-alive',
    abstract: true,

    props: {
        include: patternTypes,
        exclude: patternTypes,
        max: [String, Number]
    },

    created() {
        this.cache = Object.create(null)
        this.keys = []
    },

    destroyed() {
        for (const key in this.cache) {
            pruneCacheEntry(this.cache, key, this.keys)
        }
    },

    mounted() {
        this.$watch('include', val => {
            pruneCache(this, name => matches(val, name))
        })
        this.$watch('exclude', val => {
            pruneCache(this, name => !matches(val, name))
        })
    },

    render() {

        // 获取插槽中的组件
        const slot = this.$slots.default

        // 获取插槽子节点中，第一个组件节点(不递归查找)
        const vnode: VNode = getFirstComponentChild(slot);

        // 获取组件的配置对象
        const componentOptions: ? VNodeComponentOptions = vnode && vnode.componentOptions

        if (componentOptions) {

            // check pattern
            // 获取组件名称
            const name: ? string = getComponentName(componentOptions)
            const {
                include,
                exclude
            } = this;

            // 匹配筛选条件，不满住包括的条件或满足被排除的条件时
            if (
                // not included
                (include && (!name || !matches(include, name))) ||
                // excluded
                (exclude && name && matches(exclude, name))
            ) {
                // 返回第一个组件VNode节点
                return vnode
            }

            // 满足条件时
            const {
                cache,
                keys
            } = this;

            // 取出该组件VNode的key值，或新生成一个
            const key: ? string = vnode.key == null
                // same constructor may get registered as different local components
                // so cid alone is not enough (#3269)
                ?
                componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '') :
                vnode.key;

            // 优先从缓存中取出该key值的vm实例
            if (cache[key]) {
                vnode.componentInstance = cache[key].componentInstance;

                // make current key freshest
                // 每次重新使用该组件时，保证当前的组件在组件队列中处于最新的位置
                // 防止超栈时被优先删除
                remove(keys, key);
                keys.push(key)
            } else {

                // 当为新的key值时，将其VNode节点存入，并将key值存入
                cache[key] = vnode;
                keys.push(key);

                // prune oldest entry
                // 当保存的组件超过限制时，删除最先保存的
                if (this.max && keys.length > parseInt(this.max)) {

                    // 清除队列最先的缓存与其vm实例
                    pruneCacheEntry(cache, keys[0], keys, this._vnode)
                }
            }

            // 为其插槽中的组件代表的VNode定义一个keepAlive字段
            vnode.data.keepAlive = true
        }

        // 返回组件节点或插槽内容中的第一个子节点
        return vnode || (slot && slot[0])
    }
}