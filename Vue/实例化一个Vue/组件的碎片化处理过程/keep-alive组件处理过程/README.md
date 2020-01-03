# keep-alive组件处理过程

本来想先学习`<transition>`组件的，但在查看其渲染函数过程中，发现其还用到了该组件，那么只好先学习一下该组件的工作原理。

## 初始化渲染阶段

在了解该组件的渲染函数之前，我们先看看它在生成`AST`之间的处理情况，这里我们可以直接书写一个模版，然后观察它生成的渲染函数，假如这里有个这样的模版：

```html
<div id='app'>
    <keep-alive>
        <component :is="componentName"></component>
    </keep-alive>
    <button @click="changeComponent">切换</button>
</div>
```

那么它的父实例的渲染函数就为：

```js
_c('div', {
    attrs: {
        "id": "app"
    }
}, [_c('keep-alive', [_c(componentName, {
    tag: "component"
})], 1), _v(" "), _c('button', {
    on: {
        "click": changeComponent
    }
}, [_v("切换")])], 1);
```

可以看到`keep-alive`标签也是被当作一个普通的`VNode`来对待，并没有任何的特殊属性和处理。所以我们可以直接看`keep-alive`组件在生成时，是否有特殊的处理。我们先看一个该组件是一小如何定义的：

```js
export default {
    name: 'keep-alive',
    abstract: true,
    ...
}
```

可以从上知道，它和`<transition>`组件一样，都属于抽象组件，关于抽象组件，初始化时只会在两个属性中受到影响：`initLifeCycle()`与`createComponent()`，那么在调用渲染函数时，`keep-alive`肯定会被识别为一个组件，即会调用`createComponent()`函数来创建组件的`VNode`，此时如果为抽象组件时，会将抽象组件上的属性除`prop/listener/slot`外全部清除：

```js
if (isTrue(Ctor.options.abstract)) {

     // abstract components do not keep anything
    // other than props & listeners & slot
    var slot = data.slot;
    data = {};
    if (slot) {

        // 这里即2.5的slot语法
        data.slot = slot;
    }
}
```

### keep-alive组件的render()函数

即`2.6`版本中，它只会保留传给抽象组件的`prop`和挂载在其上的**非原生事件**。之后中间的处理同普通的组件一样，对于它插槽中内容的处理，同[插槽处理过程中的简写情况](../插槽整个处理过程/REAMDE.md#%e7%ae%80%e5%86%99%e8%af%ad%e6%b3%95%e7%9a%84%e5%a4%84%e7%90%86)，此时将一直平稳延续到其渲染函数的调用，下面是它的渲染函数：

```js
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
    return vnode || (slot && slot[0]);
}
```

我们可以看到`keep-alive`组件相当于一个中间层组件，自身并不产生任何元素，它作为一个中间层，来缓存那些使用过的`vm`实例。

首先我们要确保插入`keep-alive`插槽中的内容的根元素中，存在组件。如果不存在组件，那么它就会直接被返回，浪费实例化组件带来的开销：

```js
// 获取插槽中的组件
const slot = this.$slots.default

// 获取插槽子节点中，第一个组件节点(不递归查找)
const vnode: VNode = getFirstComponentChild(slot);

// 获取组件的配置对象
const componentOptions: ? VNodeComponentOptions = vnode && vnode.componentOptions

if (componentOptions) {
    ....
}

// 返回组件节点或插槽内容中的第一个子节点
return vnode || (slot && slot[0]);
```

首先，上面的函数先获取插槽中的内容，因为它使用的是[简写语法](../插槽整个处理过程/REAMDE.md#%e7%ae%80%e5%86%99%e8%af%ad%e6%b3%95%e7%9a%84%e5%a4%84%e7%90%86)，所以可以在`$slots.default`中直接访问到插槽内容中的`VNode`节点数组。

#### 插槽中内容为普通元素

但`keep-alive`组件实际上只对组件有用，所以这`VNode`节点数组中必须包含一个组件节点。此处调用[`getFirstComponentChild()`](../工具方法整理/REAMDE.md#getfirstcomponentchild%e8%8e%b7%e5%8f%96%e5%ad%90%e8%8a%82%e7%82%b9%e4%b8%ad%e7%ac%ac%e4%b8%80%e4%b8%aa%e7%bb%84%e4%bb%b6%e8%8a%82%e7%82%b9)获取其中的第一个组件节点。当然如果没有获取到，那说明全部为真实的元素`VNode`节点，此时就返回其中的第一个节点(这就意味着多个真实元素节点做根节点时，之后的就会被舍弃)。

#### 插槽中内容为组件

那么如果是个组件节点呢？此时按我们平时的用法大致可以猜到：首先匹配插槽名称和过滤条件，然后使用对应的组件`VNode`。具体的情况也就是如此：

```js
// check pattern
// 获取组件名称
const name: ? string = getComponentName(componentOptions);
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
```

首先，匹配当前组件的名称，如果用户定义了`include`和`exclude`属性，那么首先会匹配它，如果当前组件不匹配，那么会直接返回获取到的组件`VNode`节点。如果通过了检验，此时就有两种情况，我们先从**初始化**的情况说其。此时就会根据组件**所处的上下文**生成一个`key`值，然后再在`keep-alive`组件`vm`实例上定义一个`cache`缓存对象，将该`key`值存入其中，每个`key`值都对应当前激活的组件的`VNode`节点。如果是复用一个已存在的组件，那么就会直接从`cache`中取出并更新缓存队列。

#### 缓存对象？队列？

如代码所写的那些，`cache`是一个对象，但它重新定义了一个`keys`数组来维护这个缓存对象。我们可以给`keep-alive`定义`max`属性来限制其缓存`vm`实例的个数，在超栈时将**最旧**的`vm`实例删除。关于该队列的维护，我们只需要关注在设置`max`属性下的情况：

```js
// 优先从缓存中取出该key值的vm实例
if (cache[key]) {

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
```

从上面代码可以看到，当复用一个旧的组件`VNode`时，会将被复用的组件的`key`值直接“移动”到`keys`数组的最后，这很好理解，这相当于刷新了最近的死亡时间(这里我定义死亡时间为组件距离现在没有被用到的时间)，至少说明该组件已经不是已经久不使用的组件了；当缓存一个新的组件时，如果当前存储的`vm`实例超过了队列长度，那么就要销毁最近的缓存`vm`实例并清空缓存。

- [匹配组件名使用的matches()方法](../工具方法整理/REAMDE.md#matches%e5%8c%b9%e9%85%8d%e6%9f%90%e4%b8%aa%e5%ad%97%e7%ac%a6%e4%b8%b2)
- [销毁缓存中vm实例使用的pruneCacheEntry()方法](../工具方法整理/REAMDE.md#prunecacheentry%e5%88%a0%e9%99%a4%e7%bc%93%e5%ad%98%e4%b8%ad%e6%8c%87%e5%ae%9a%e7%9a%84vm%e5%ae%9e%e4%be%8b)

____
那么通过`keep-alive`组件的渲染函数，它返回了其中插槽内容中的组件`VNode`节点，接下来又是针对它进行`patch()`操作生成真实`DOM`元素。但由于返回的节点也为组件节点，所以通过`patch()`函数开始为该组件`VNode`开启另一个组件生命周期。与其他组件的生命周期不同的是，在全部`vm`实例完成编译、生成`DOM Tree`后，在插入`DOM`节点阶段，与其他组件的钩子函数不同，它还会额外执行其[`insert()`](../../mounted/渲染函数中的方法/创建组件VNode/组件VNode的Hook/README.md#insert%e8%b0%83%e7%94%a8%e7%bb%84%e4%bb%b6insert%e9%92%a9%e5%ad%90%e5%87%bd%e6%95%b0)函数的一部分逻辑，来调用其组件及其组件内部组件的所有`activated()`钩子函数。

在初次创建`keep-alive`组件时，被启动的组件会直接通过[`activateChildComponent()`](../../)函数调用`activate`钩子函数。之后在渲染出对应的元素节点，对于`keep-alive`组件的渲染就完成了。

## 组件更新

在复用时，会通过`queueActivatedComponent()`被添加到一个队列中，在更新结束后，同一调用它们的`activate`钩子函数。
