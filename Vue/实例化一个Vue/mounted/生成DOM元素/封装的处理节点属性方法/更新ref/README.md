# 更新ref元素

这里有各个阶段`Vue`如何更新`ref`中的元素。在某个阶段，都是通过的`registerRef()`函数来进行的`ref`引用的注册。

## registerRef()——注册或注销ref节点

该函数用于注册或注销定义有`ref`属性的标签。但指定第二个参数为`true`时会进行注销操作。在注册`ref`时可以注册为多个同名的`ref`，但仅限于存在于`v-for`名下的`ref`，其他情况同名只会进行重写。

```js
function registerRef(vnode: VNodeWithData, isRemoval: ? boolean) {

    // 获取该节点的ref属性绑定的值
    const key = vnode.data.ref;
    if (!isDef(key)) return;

    // 获取该节点所处的vm实例
    const vm = vnode.context;

    // 获取该VNode节点的组件或元素
    const ref = vnode.componentInstance || vnode.elm;

    // 获取所在vm实例的$refs对象
    const refs = vm.$refs;

    // 是否为移除该VNode节点的ref模式
    if (isRemoval) {

        // 移除时，如果为数组，则遍历删除对应的元素或组件实例
        if (Array.isArray(refs[key])) {
            remove(refs[key], ref);

        // 移除单个ref直接赋值undefined
        } else if (refs[key] === ref) {
            refs[key] = undefined
        }

    // 不移除时，则添加该节点的ref
    } else {

        // 如果是v-for下的ref
        if (vnode.data.refInFor) {

            // 将全部ref填入数组中
            if (!Array.isArray(refs[key])) {
                refs[key] = [ref];
            } else if (refs[key].indexOf(ref) < 0) {
                refs[key].push(ref);
            }

        // 非v-for的同名ref，只会重写
        } else {
            refs[key] = ref;
        }
    }
}
```

该函数比较简单，就是单纯的数组操作，其中移除使用的`remove()`方法，才在`transition`组件中见过。就是对数组中某个全等于第二个参数的值移除。

## create阶段

该阶段时，调用函数代码如下：

```js
create(_: any, vnode: VNodeWithData) {
    registerRef(vnode);
}
```

就是将该`VNode`节点的`ref`属性注册到存在的vm实例上去。

## updated阶段

在节点进行更新时，如果该节点的`ref`值发生变化，那么要分别调用一次`registerRef()`来注销与重新注册。

```js
update(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
        registerRef(oldVnode, true)
        registerRef(vnode)
    }
}
```

## destroy阶段

在组件销毁阶段，单纯的调用该函数注销`vm`实例上对应的`ref`引用

```js
destroy(vnode: VNodeWithData) {
    registerRef(vnode, true)
}
```
