# module——处理VNode属性的方法

首先该数组中的方法都用来处理`VNode`节点的属性的，没错，就是`vue`中的那些指令属性的处理：

先看看该数组的由来：

```js
// the directive module should be applied last, after all
// built-in modules have been applied.
// 指令型的模块应该最后调用，待所有内置模块调用后
const modules = platformModules.concat(baseModules);
```

现在还不懂是正常的。那么`platformModules`为：

```js
[
    attrs: {
        create: updateAttrs,
        update: updateAttrs
    },
    klass:{
        create: updateClass,
        update: updateClass
    },
    events:{
        create: updateDOMListeners,
        update: updateDOMListeners
    },
    domProps:{
        create: updateDOMProps,
        update: updateDOMProps
    },
    style:{
        create: updateStyle,
        update: updateStyle
    },
    transition:inBrowser ? {
        create: _enter,
        activate: _enter,
        remove () {}
    } : {}
]
```

那么`baseModules`为：

```js
[
    ref: {
        create () {},
        update () {},
        destroy () {}
    },
    directives: {
        create: updateDirectives,
        update: updateDirectives,
        destroy: function unbindDirectives () {}
    }
]
```

导致了解一下是什么就够了。

## create周期中的钩子函数

`create`周期中的钩子函数函数共8个：
![create周期的钩子函数](./imgs/create&#32;hooks.png)，

它们用于对那些`vue`指令进行处理，就按上述中的顺序进行调用，现在分别来看看它们具体的调用:

- [updateAttrs()——更新dom元素attribute](#updateattrs%e6%9b%b4%e6%96%b0dom%e5%85%83%e7%b4%a0attribute)

### updateAttrs()——更新dom元素attribute

该方法用于对比新旧`VNode`的`attr`对象来对`DOM`元素的`attribute`属性进行更新。

首先，对比它们两个`attr`对象间的差异的，存在差异就直接将最新的更新在`DOM`元素上；
其次，对比完后，对于一些已经不存在的`attr`，那么要移除`DOM`元素上的这些`attribute`。

```js
function updateAttrs(oldVnode: VNodeWithData, vnode: VNodeWithData) {

    // 取出组件的配置(即我们定义组件的对象)
    const opts = vnode.componentOptions;

    // 如果存在且该组件的构造函数，且用户指定不继承attribute属性时，直接返回
    // https://cn.vuejs.org/v2/api/#inheritAttrs
    if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {

        // 未对应props的其他属性将不作为attribute绑定在组件的元素上
        return
    }

    // 如果新旧节点均未有属性，那么不做处理，直接退出函数
    if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
        return
    }
    let key, cur, old;

    // 取出新的VNode节点的dom元素
    const elm = vnode.elm;

    // 旧VNode节点与新VNode节点的属性
    const oldAttrs = oldVnode.data.attrs || {};
    let attrs: any = vnode.data.attrs || {};

    // clone observed objects, as the user probably wants to mutate it
    // 如果attrs为被观察的对象，则需对其一次克隆，因为用户可能会在之后改变它
    if (isDef(attrs.__ob__)) {
        attrs = vnode.data.attrs = extend({}, attrs);
    }

    // 遍历新节点中的所有属性，只对两者中的差异属性进行更新
    for (key in attrs) {

        // 当前VNode存在的属性
        cur = attrs[key];

        // 旧的VNode同样名称的属性
        old = oldAttrs[key];

        // 如果存在差异，就将新的属性更新到新节点
        if (old !== cur) {
            setAttr(elm, key, cur);
        }
    }

    // #4391: in IE9, setting type can reset value for input[type=radio]
    // IE9中，重新设置type属性后，会重置其value值
    // #6666: IE/Edge forces progress value down to 1 before setting a max
    // IE/edge 浏览器存在这样一个问题。如果当前max为一个值，那么如果我们设置一个value
    // 大于该值时，那么value会等于max。而在Vue中由于是按值出现的顺序设置的，如果value设置在max
    // 之前，那么就可能导致value的值为1(因为1为默认max值)
    // 所以这里要对其值重新进行一次设置
    if ((isIE || isEdge) && attrs.value !== oldAttrs.value) {
        setAttr(elm, 'value', attrs.value)
    }

    // 再次遍历旧的属性对象，移除那些已不存在的属性
    for (key in oldAttrs) {

        // 如果在新的attribute中年已不存在该属性，那么移除
        if (isUndef(attrs[key])) {

            // 如果为命名空间xlink，则移除元素的该命名空间属性
            if (isXlink(key)) {
                elm.removeAttributeNS(xlinkNS, getXlinkProp(key));

            // 除特殊的几个不可枚举的属性外，其他属性直接移除
            } else if (!isEnumeratedAttr(key)) {
                elm.removeAttribute(key)
            }
        }
    }
}
```

首先是对用户是否关闭全局的`inheritAttrs`，这个属性默认为`undefined`，但只有指定为`false`时才关闭(官网说默认值为`true`，可能是便于理解)，关闭该属性后，多余的传递给组件的`props`属性将不会作为`attributte`，而是直接消失。

其次，设置属性调用的[`setAttr()`](../patch过程中的其他函数/README.md#setattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0%e7%9a%84%e5%b1%9e%e6%80%a7)方法，就对原生`setAttribute`的封装，里面包含各种属性情况的处理，非常完善，看了可以增加知识。

>这其中还有一个`IE/EDGE`的小`BUG`，那就是`progress`标签的`value`与`max`属性设置的前后会导致真实的情况反应不一样：
>如果先设置`value`再设置`max`，那么`value`为`1`。
>这个原因是因为如果设置的`value`超过当前的`max`值时，会导致`value = max`，默认情况下`max = 1`，所有产生了这个`bug`。

其实这也说得通，不像`BUG`，可能是规范的问题。

### updateClass()——更新元素的class

该函数用于处理元素的`class`，没什么难点，主要注意的就是处理组件时，会将组件上的类合并到组件根节点上。

```js
function updateClass(oldVnode: any, vnode: any) {
    const el = vnode.elm;
    const data: VNodeData = vnode.data;
    const oldData: VNodeData = oldVnode.data;

    // 如果新节点没有任何关于class的属性且旧节点也没有，则直接返回
    if (
        isUndef(data.staticClass) &&
        isUndef(data.class) && (
            isUndef(oldData) || (
                isUndef(oldData.staticClass) &&
                isUndef(oldData.class)
            )
        )
    ) {
        return;
    }

    // 处理组件的class，如组件上的和组件根节点上的class
    let cls = genClassForVnode(vnode)

    // handle transition classes
    // 处理transition元素的class
    const transitionClass = el._transitionClasses;

    // 合并transition的class
    if (isDef(transitionClass)) {
        cls = concat(cls, stringifyClass(transitionClass))
    }

    // set the class
    // 只要当前新的class与之前的不一样则设置最新的class
    if (cls !== el._prevClass) {
        el.setAttribute('class', cls);

        // 存储之前的class属性
        el._prevClass = cls;
    }
}
```

首先依然是对新旧节点的对比，只有两者都不含`class`属性时，才会直接返回，之后是调用`genClassForVnode()`对`class`属性的处理：

#### genClassForVnode()——处理组件class、生成class字符串

如标题所说，该方法用于处理组件的`class`与生成最终的`class`字符串，对于组件的`class`，有两种处理方式：

1. 从组件根节点向上找，合并
2. 从组件标签向其实例根节点找合并

其代码为：

```js
function genClassForVnode(vnode: VNodeWithData): string {

    // 获取当前节点的属性
    let data = vnode.data;

    // 暂时定义父子节点，待会会进行更新
    let parentNode = vnode;
    let childNode = vnode;

    // 通过组件标签，查找该标签的根节点，合并两者的属性
    while (isDef(childNode.componentInstance)) {

        // 获取该vm实例的根节点
        childNode = childNode.componentInstance._vnode;

        // 合并根节点与当前组件实例上的属性
        if (childNode && childNode.data) {
            data = mergeClassData(childNode.data, data)
        }
    }

    // 通过组件的根节点向上查找组件标签，合并两者class
    while (isDef(parentNode = parentNode.parent)) {

        // 如果父节点存在节点属性，则合并它们的class属性
        if (parentNode && parentNode.data) {
            data = mergeClassData(data, parentNode.data);
        }
    }

    // 返回最终动态和静态class拼接的结果
    return renderClass(data.staticClass, data.class)
}
```

其中合并组件节点和组件根节点上的`class`调用的方法为`mergeClassData()`

#### mergeClassData()——合并节点的class

 同样是对静态`class`与动态`class`不同的合并方式，静态`class`合并属性则是的调用`concat()`方法，将两个属性拼接为一个字符串；而动态`class`合并属性则是将其添加至一个数组中。

```js
function mergeClassData(child: VNodeData, parent: VNodeData): {
    staticClass: string,
    class: any
} {
    return {
        staticClass: concat(child.staticClass, parent.staticClass),

        // 如果子节点存在动态的class则合并父级的，不存在则直接取用父级的
        class: isDef(child.class) ?
            [child.class, parent.class] :
            parent.class
    }
}

function concat(a: ? string, b : ? string): string {

    //  class属性的专用拼接函数
    return a ? b ? (a + ' ' + b) : a : (b || '')
}
```

注意`mergeClassData()`返回了一个新的对象，所以不会修改节点中原有的`data`对象。
____
最后调用`renderClass()`将最终拼接为字符串返回：

#### renderClass()——拼接静态class与动态class

该函数同样是调用`concat()`函数将最终的两个字符串拼接在一起。

```js
function renderClass(
    staticClass: ? string,
    dynamicClass : any
): string {

    // 存在定义的class时，转化为合适的字符串返回
    if (isDef(staticClass) || isDef(dynamicClass)) {
        return concat(staticClass, stringifyClass(dynamicClass))
    }

    // 不存在时返回空字符串
    return '';
}
```

由于我们知道动态`class`是一个对象(数组)，所以我们要对其进行字符串化，则是调用`stringifyClass()`函数：

#### stringifyClass()——字符串化动态class对象

该方法会根据最终的动态`clas`s的形式来进行处理，由之前的处理我们可以看出，如果没有进行两个节点的动态`class`的合并那么它是一个任意值；但合并后它就为一个数组。

```js
function stringifyClass(value: any): string {

    // 处理多个动态的class，因为多个会进行拼接为数组
    if (Array.isArray(value)) {
        return stringifyArray(value)
    }

    // 处理单个动态的class，如果为对象形式则直接用对象形式的处理
    if (isObject(value)) {
        return stringifyObject(value)
    }

    // 字符串形式时直接返回
    if (typeof value === 'string') {
        return value;
    }

    return '';
}
```

下面是其两个字符串化的方法：

```js
function stringifyArray(value: Array < any > ): string {
    let res = '';
    let stringified;

    // 遍历逐个调用stringifyClass转化为字符串
    for (let i = 0, l = value.length; i < l; i++) {
        if (isDef(stringified = stringifyClass(value[i])) && stringified !== '') {
            if (res) res += ' '
            res += stringified
        }
    }
    return res;
}

function stringifyObject(value: Object): string {

    // 对于对象形式的class，其值为真值的，就拼接在一起
    let res = ''
    for (const key in value) {
        if (value[key]) {
            if (res) res += ' '
            res += key
        }
    }
    return res;
}
```

`stringifyArray()`方法就是遍历所有对象形式的`class`，为每个对象在递归调用一次`stringifyClass()`来处理。
