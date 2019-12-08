# updateAttrs()——更新dom元素attribute

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

其次，设置属性调用的[`setAttr()`](../../patch过程中的其他函数/README.md#setattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0%e7%9a%84%e5%b1%9e%e6%80%a7)方法，就对原生`setAttribute`的封装，里面包含各种属性情况的处理，非常完善，看了可以增加知识。

>这其中还有一个`IE/EDGE`的小`BUG`，那就是`progress`标签的`value`与`max`属性设置的前后会导致真实的情况反应不一样：
>如果先设置`value`再设置`max`，那么`value`为`1`。
>这个原因是因为如果设置的`value`超过当前的`max`值时，会导致`value = max`，默认情况下`max = 1`，所有产生了这个`bug`。

其实这也说得通，不像`BUG`，可能是规范的问题。
