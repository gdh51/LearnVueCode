# updateClass()——更新元素的class

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

## genClassForVnode()——处理组件class、生成class字符串

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

## mergeClassData()——合并节点的class

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

## renderClass()——拼接静态class与动态class

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

## stringifyClass()——字符串化动态class对象

该方法会根据最终的动态`class`的形式来进行处理，由之前的处理我们可以看出，如果没有进行两个节点的动态`class`的合并那么它是一个任意值；但合并后它就为一个数组。

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

`stringifyArray()`方法就是遍历所有对象形式的`class`，为每个对象在递归调用一次`stringifyClass()`来进行处理。
