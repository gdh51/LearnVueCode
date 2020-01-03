# 工具方法

此处整理该文件夹下用到的工具方法

目录：

- [getFirstComponentChild()——获取子节点中第一个组件节点](#getfirstcomponentchild%e8%8e%b7%e5%8f%96%e5%ad%90%e8%8a%82%e7%82%b9%e4%b8%ad%e7%ac%ac%e4%b8%80%e4%b8%aa%e7%bb%84%e4%bb%b6%e8%8a%82%e7%82%b9)
- [matches()——匹配某个字符串](#matches%e5%8c%b9%e9%85%8d%e6%9f%90%e4%b8%aa%e5%ad%97%e7%ac%a6%e4%b8%b2)
- [getComponentName()——获取组件名称](#getcomponentname%e8%8e%b7%e5%8f%96%e7%bb%84%e4%bb%b6%e5%90%8d%e7%a7%b0)
- [pruneCacheEntry()——删除缓存中指定的vm实例](#prunecacheentry%e5%88%a0%e9%99%a4%e7%bc%93%e5%ad%98%e4%b8%ad%e6%8c%87%e5%ae%9a%e7%9a%84vm%e5%ae%9e%e4%be%8b)

## getFirstComponentChild()——获取子节点中第一个组件节点

该函数用于获取传入的子节点数组中的**第一个**组件节点，如果没有则返回`undefined`

```js
function getFirstComponentChild(children: ? Array < VNode > ): ? VNode {
    if (Array.isArray(children)) {

        // 遍历子节点数组，获取其中第一个数组节点
        for (let i = 0; i < children.length; i++) {
            const c = children[i];

            // 返回异步组件或组件节点
            if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
                return c
            }
        }
    }
}
```

## matches()——匹配某个字符串

用于动态组件中匹配组件名称。匹配库支持字符串、数组和正则表达式三种情况。(字符串情况为`componentA,componentB,componentC`)

```js
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
```

## getComponentName()——获取组件名称

该方法用于获取组件名称，优先获取组件自有的，其次是我们定义给组件的`is`中的组件名称。

```js
function getComponentName(opts: ? VNodeComponentOptions): ? string {

    // 优先返回组件自带名称，其次才是is定义的组件名称
    return opts && (opts.Ctor.options.name || opts.tag)
}
```

## pruneCacheEntry()——删除缓存中指定的vm实例

该方法用于删除缓存中指定`key`值的`vm`实例。删除的`vm`实例不能为当前正在使用的`vm`实例。

```js
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
```