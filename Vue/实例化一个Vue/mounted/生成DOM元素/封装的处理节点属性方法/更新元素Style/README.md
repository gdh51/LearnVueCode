# updateStyle()——更新style属性

该函数用于合并所有的`style`属性，并更新到对应的`DOM`元素上去，过程与`updateClass()`有相似之处

```js
function updateStyle(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    const data = vnode.data;
    const oldData = oldVnode.data;

    // 同样的先检查是否新旧节点都不具有任何形式的style属性，没有则直接返回
    if (isUndef(data.staticStyle) && isUndef(data.style) &&
        isUndef(oldData.staticStyle) && isUndef(oldData.style)
    ) {
        return;
    }

    let cur, name;
    const el: any = vnode.elm;
    const oldStaticStyle: any = oldData.staticStyle;

    // 这里优先取标准化后的动态style的值，其次取没有标准化的
    const oldStyleBinding: any = oldData.normalizedStyle || oldData.style || {};

    // if static style exists, stylebinding already merged into it when doing normalizeStyleData
    // 如果存在静态的style属性，那么说明已经调用normalizeStyleBinding将动态style合并进其中
    const oldStyle = oldStaticStyle || oldStyleBinding;

    // 标准化新的VNode的动态style值为对象形式
    const style = normalizeStyleBinding(vnode.data.style) || {}

    // store normalized style under a different key for next diff
    // make sure to clone it if it's reactive, since the user likely wants
    // to mutate it.
    // 存储新的VNode标准化后的动态style
    vnode.data.normalizedStyle = isDef(style.__ob__) ?
        extend({}, style) : style;

    // 获取该VNode的最终style对象
    const newStyle = getStyle(vnode, true);

    // 遍历旧的style对象，同时遍历新的style对象，删除已经不存在的属性
    for (name in oldStyle) {
        if (isUndef(newStyle[name])) {
            setProp(el, name, '')
        }
    }

    // 对于其他的值有差异或新增的属性，进行更新其值
    for (name in newStyle) {
        cur = newStyle[name];
        if (cur !== oldStyle[name]) {

            // ie9 setting to null has no effect, must use empty string
            // IE 9中设置null没有效果，必须使用空字符串
            setProp(el, name, cur == null ? '' : cur)
        }
    }
}
```

首先我们可以看到`oldStyleBinding`的值会支持从`oldData.normalizedStyle`取，因为在之后我们可以看到，`oldData.normalizedStyle`的值就是标准化为对象后的`oldData.style`的值。

其次`oldStyle`的值虽然在此处为`oldStaticStyle || oldStyleBinding`，但实际上一旦经历`updateStyle()`这个流程，它的值已经为合并动态与静态`style`后的值，这里之后也会看到，所以不急。

那么现在让我们看看最新的`VNode`的动态`style`的值是如何将用户各种形式的值标准化转化为对象的，首先直接调用`normalizeStyleBinding()`：

## normalizeStyleBinding()——标准化动态style

具体来说，能够做标准化的值就两种，一种是数组，一种是字符串，而字符串形式就和静态的`style`一样了；而数组形式也只是将多个`style`对象分别存储而已。

```js
// normalize possible array / string values into Object
function normalizeStyleBinding(bindingStyle: any) : ? Object {

    // 如果为对象组成的数组，则调用toObject将其转化为一个对象
    if (Array.isArray(bindingStyle)) {
        return toObject(bindingStyle);
    }

    // 如果绑定的为字符串，则按键值的形式转化为对象
    if (typeof bindingStyle === 'string') {
        return parseStyleText(bindingStyle)
    }
    return bindingStyle;
}
```

对于多个`style`对象的数组，它的处理是将其扁平化，全部键值对添加到一个对象上去，如有重复的值则后来的覆盖前面的。这里的`toObject()`方法即将数组每个元素拿出来调用`extend()`方法，而`extend()`之前我们见过，你可以理解为浅复制：

```js
/**
 * Merge an Array of Objects into a single Object.
 */
function toObject(arr: Array < any > ): Object {
    const res = {}
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]) {
            extend(res, arr[i])
        }
    }
}
```

而对于字符串形式的动态`style`则完全和静态的`style`一样，详情可以看[parseStyleText()](../../../../beforeMount/compile编译/baseCompile/parse解析/一群工具方法/解析属性/README.md#parsestyletext%e8%a7%a3%e6%9e%90%e9%9d%99%e6%80%81style%e5%ad%97%e7%ac%a6%e4%b8%b2)的解析过程。

无论如何`normalizeStyleBinding()`的结果是返回动态`style`对象的所包含的`style`的键值对。
____

回到`updateStyle()`函数，此时我们将新`VNode`的动态`style`标准化后的对象挂载在其`data.normalizedStyle`中，也就是我们一开始取`oldStyleBinding`值的地方。

之后调用`getStyle()`方法来获取最新`VNode`的合并静态和动态`style`的对象：

## getStyle()——获取最终的样式对象

该方法会合并当前`VNode`节点的动态与静态的样式信息为一个对象，增对组件`VNode`，还会合并其上面的属性，合并的规则为**父级节点会重写子节点**，所以我们写在组件标签上的样式如果与组件的根节点有重复，则会覆盖其属性。其查询的规则和`updateClass`一样。

```js
/**
 * parent component style should be after child's
 * so that parent component's style could override it
 * 父组件的style的处理应该在子组件之后，所以
 * 父组件的style会重写子组件的style
 */
export function getStyle(vnode: VNodeWithData, checkChild: boolean) : Object {
    const res = {}
    let styleData;

    // 是否查询子组件(这里一定为true)
    if (checkChild) {
        let childNode = vnode;

        // 当前VNode节点是否为组件标签
        while (childNode.componentInstance) {

            // 获取组件标签的根节点
            childNode = childNode.componentInstance._vnode;

            // 如果组件的根节点有任何style属性，将其合并后添加至最终结果中
            if (
                childNode && childNode.data &&
                (styleData = normalizeStyleData(childNode.data))
            ) {
                extend(res, styleData)
            }
        }
    }

    // 将当前节点的所有style处理为一个对象后添加至res
    if ((styleData = normalizeStyleData(vnode.data))) {
        extend(res, styleData)
    }

    let parentNode = vnode;

    // 通过元素的根节点，向上查找组件，合并其style属性
    while ((parentNode = parentNode.parent)) {
        if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
            extend(res, styleData)
        }
    }
    return res;
}
```

具体如何遍历组件的根节点和组件节点就不继续描述(注释中有)，这里主要学习下其中的`normalizeStyleData()`方法，它用于将该节点的父子节点的`style`的样式信息进行标准化。

### normalizeStyleData()——标准化样式信息

首先浏览下，这里是调用[`normalizeStyleBinding()`](#normalizestylebinding%e6%a0%87%e5%87%86%e5%8c%96%e5%8a%a8%e6%80%81style)对其父节点或子节点的动态`style`进行标准化，最后通过`extend()`方法将其添加到`data.staticStyle`中，这里也就是为什么一开始我们通过`oldData.staticStyle`就能得到旧的`VNode`的最终`style`对象

```js
// merge static and dynamic style data on the same vnode
// 合并同一个VNode上的静态和动态的style
function normalizeStyleData(data: VNodeData): ? Object {

    // 获取动态style的标准化对象
    const style = normalizeStyleBinding(data.style);

    // static style is pre-processed into an object during compilation
    // and is always a fresh object, so it's safe to merge into it
    // 静态style已经在编译阶段进行了预处理，变成了一个对象的形式，
    // 所以这里可以直接将两者进行合并
    return data.staticStyle ?
        extend(data.staticStyle, style) :
        style
}
```

____
通过`getStyle()`获取一个`VNode`节点的完整`style`对象信息后，就可以对比新旧`style`对象进行增删改操作了。这个过程还是一样，已不存在于新的`style`对象中，则删除，在这个前提下，如果有差异则更新。增对其操作属性值则是使用的`setProp()`方法：

## setProp()——更新DOM元素style

该方法就正式用于设置`style`属性及其值了，它会自动帮我们侦测浏览器支持的属性。

这里设置属性值大约有3种情况：

- 设置`css`变量
- 设置带有`!important`的属性值
- 其他

设置属性统一调用的是`style.setProperty()`这个`API`，我以前都不知道，一直是直接使用的赋值的方式(当然它们是等价的)。

```js
const cssVarRE = /^--/;
const importantRE = /\s*!important$/;
const setProp = (el, name, val) => {

    // 是否为css变量声明，是则直接添加
    if (cssVarRE.test(name)) {
        el.style.setProperty(name, val);

    // 属性值中是否存在!important标记，如果存在手动添加其值
    } else if (importantRE.test(val)) {
        el.style.setProperty(hyphenate(name), val.replace(importantRE, ''), 'important')
    } else {

        // 返回其标准化名称(即有些部分浏览器支持的属性，会自动替我们加上前缀)
        const normalizedName = normalize(name);

        // 提供数组形式的值时，会设置每一个值，浏览器可以取自己能识别的值使用
        if (Array.isArray(val)) {
            // Support values array created by autoprefixer, e.g.
            // {display: ["-webkit-box", "-ms-flexbox", "flex"]}
            // Set them one by one, and the browser will only set those it can recognize
            for (let i = 0, len = val.length; i < len; i++) {
                el.style[normalizedName] = val[i]
            }

        // 其他时候直接设置值即可
        } else {
            el.style[normalizedName] = val
        }
    }
}
```

具体我们只学习下其中第三种情况，它调用了`normalize()`函数，那么它是干什么的呢？

### normalize()——标准化属性名称

该函数就是用于来标准化一个`CSS`属性的名称，它也就是我们所说的自动侦测浏览器支持的属性名称，并添加前缀。原理很简单，就是查询并缓存一次浏览器支持的所有`style`属性，然后在添加用户指定属性时，自动为其添加前缀组成兼容的属性名，然后去之前生成的`style`表中去查询是否存在，存在则返回，之后便用作属性名。

```js
const vendorNames = ['Webkit', 'Moz', 'ms'];

let emptyStyle;
const normalize = cached(function (prop) {

    // 取一个空的样式map表
    emptyStyle = emptyStyle || document.createElement('div').style;

    // 驼峰化属性名
    prop = camelize(prop);

    // 对于普通的属性，直接返回其名称
    if (prop !== 'filter' && (prop in emptyStyle)) {
        return prop;
    }

    // 大写属性名的首字母
    const capName = prop.charAt(0).toUpperCase() + prop.slice(1);

    // 对于未查找到的属性，为其添加浏览器厂商前缀后在查找一次，返回其存在的名称
    for (let i = 0; i < vendorNames.length; i++) {
        const name = vendorNames[i] + capName
        if (name in emptyStyle) {
            return name;
        }
    }
});
```

____
另外我们可以看出`setProp()`中支持数组形式的动态`style`的值，说明我们可以设置多个值来匹配任意一个`style`属性，浏览器会选择其中一个有效的值使用。

到此为止整个更新`style`的过程就结束了。
