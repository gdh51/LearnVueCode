# patch过程中用到的函数

这里主要是存放的是内置在`createPatchFunction()`闭包中的函数，这些函数将在它的返回值函数`patch()`调用时使用到。

目录：

- [baseSetAttr()——设置元素attribute](#basesetattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0attribute)
- [checkDuplicateKeys()——检查是否存在重复key值](#checkduplicatekeys%e6%a3%80%e6%9f%a5%e6%98%af%e5%90%a6%e5%ad%98%e5%9c%a8%e9%87%8d%e5%a4%8dkey%e5%80%bc)
- [setScope()——设置CSS作用域属性](#setscope%e8%ae%be%e7%bd%aecss%e4%bd%9c%e7%94%a8%e5%9f%9f%e5%b1%9e%e6%80%a7)
- [setAttr()——设置元素的属性](#setattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0%e7%9a%84%e5%b1%9e%e6%80%a7)
- [baseSetAttr()——设置元素attribute](#basesetattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0attribute)
- [insert()——向ref元素前插入指定元素](#insert%e5%90%91ref%e5%85%83%e7%b4%a0%e5%89%8d%e6%8f%92%e5%85%a5%e6%8c%87%e5%ae%9a%e5%85%83%e7%b4%a0)

## createEle()——创建一个元素，插入父节点

就和名字写的一样，该函数用于通过一个`VNode`创建一个元素，然后插入父节点的指定位置。此时它会对`VNode`上的所有属性进行处理，也就是最后的处理了，接下来先对代码过目一遍:

```js
function createElm(

        // 新的VNode节点
        vnode,

        // 带有insert-hook的VNode的队列
        insertedVnodeQueue,

        // 旧节点的父元素(这里一定是元素节点)
        parentElm,

        // 旧节点的下一个节点，用作插入节点时的位置标记
        refElm,

        // 是否不为根VNode节点
        nested,

        // 当前所存在的子VNode数组
        ownerArray,
        index
    ) {

        // 如果新节点已有对应的dom元素，且存在于ownerArray中
        // 则说明该VNode节点为复用节点
        if (isDef(vnode.elm) && isDef(ownerArray)) {

            // This vnode was used in a previous render!
            // now it's used as a new node, overwriting its elm would cause
            // potential patch errors down the road when it's used as an insertion
            // reference node. Instead, we clone the node on-demand before creating
            // associated DOM element for it.
            // 能进入这里，说明该VNode节点被复用了
            // 现在它作为一个新的节点使用，所以如果它作为一个插入的参考节点时，那么它的节点信息就可能存在错误
            // 重写该元素会导致潜在的patch错误，所以我们在创建其相关的DOM元素前先clone它的VNode节点。
            vnode = ownerArray[index] = cloneVNode(vnode);
        }

        // 作为transition的入口检查
        // 该节点是否为当前组件的根VNode节点
        vnode.isRootInsert = !nested; // for transition enter check

        // 是否为组件，是则创建组件实例
        if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
            return;
        }

        // 取出节点的属性，及其子节点数组和标签
        const data = vnode.data
        const children = vnode.children
        const tag = vnode.tag

        // 为dom元素标签时
        if (isDef(tag)) {
            if (process.env.NODE_ENV !== 'production') {

                // 如果该VNode节点为静态节点，则增加静态节点的计数
                if (data && data.pre) {
                    creatingElmInVPre++
                }
                if (isUnknownElement(vnode, creatingElmInVPre)) {
                    warn(
                        'Unknown custom element: <' + tag + '> - did you ' +
                        'register the component correctly? For recursive components, ' +
                        'make sure to provide the "name" option.',
                        vnode.context
                    )
                }
            }

            // 根据其是否具有命名空间，来创建对应的真实dom元素
            vnode.elm = vnode.ns ?
                nodeOps.createElementNS(vnode.ns, tag) :
                nodeOps.createElement(tag, vnode);

            // 设置元素的CSS作用域属性
            setScope(vnode)

            // 遍历子节点数组，创建其元素
            createChildren(vnode, children, insertedVnodeQueue);

            // 是否存在元素属性，存在时调用其cretea周期钩子函数，处理元素上的属性、事件等等
            if (isDef(data)) {
                invokeCreateHooks(vnode, insertedVnodeQueue)
            }

            // 将元素插入refElm之前
            insert(parentElm, vnode.elm, refElm)

            if (process.env.NODE_ENV !== 'production' && data && data.pre) {
                creatingElmInVPre--
            }

        // 当为注释节点时
        } else if (isTrue(vnode.isComment)) {

            // 创建一个注释节点
            vnode.elm = nodeOps.createComment(vnode.text);

            // 插入到refElm之前
            insert(parentElm, vnode.elm, refElm);

        // 当为文本节点时
        } else {

            // 创建一个文本节点
            vnode.elm = nodeOps.createTextNode(vnode.text);

            // 插入到refElm之前
            insert(parentElm, vnode.elm, refElm);
        }
    }
```

首先是对当前的`VNode`节点是否为复用的`VNode`，如果是则要调用[`cloneVNode()`](../../VNode构造函数/README.md#%e5%85%8b%e9%9a%86%e8%8a%82%e7%82%b9clonevnode)对其进行克隆，并生成一个新的`VNode`节点代替它。因为在有元素以其作为参考节点进行`DOM`的插入行为时，使用的`VNode`信息是错误的。

之后修改`vnode.isRootInsert`属性，判断其是否为从根节点开始插入的，它会在之后的过渡动画中作为是否使用初始渲染的判断条件。那么对`VNode`的节点的处理到此为止了，接下来便是产生分歧的地方，如果该`VNode`节点为组件节点，那么它将调用`createComponent()`创建一个组件；如果不是，那么好，说明其为一个真实节点，对它进行完最后的处理就可以将其添加到`DOM`结构中去了。

>这里我们只说明是元素的情况，组件的情况请看下面的函数[`createComponent()`]

在不是组件的情况中，国际惯例，三种情况，[文本节点](#%e6%96%87%e6%9c%ac%e8%8a%82%e7%82%b9)，[元素节点]()，[注释节点](#%e6%b3%a8%e9%87%8a%e8%8a%82%e7%82%b9)，先拿好捏的痱子开始：

### 文本节点

对于文本节点的处理，非常简单，即创建该节点，然后插入到`DOM`中即可。

```js
// 创建一个文本节点
vnode.elm = nodeOps.createTextNode(vnode.text);

// 插入到refElm之前
insert(parentElm, vnode.elm, refElm);
```

创建文本节点的方法[`createTextNode()`](../封装的dom方法/README.md#createtextnode%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e6%96%87%e4%bb%b6%e8%8a%82%e7%82%b9)
插入节点的方法[`insert()`](#insert%e5%90%91ref%e5%85%83%e7%b4%a0%e5%89%8d%e6%8f%92%e5%85%a5%e6%8c%87%e5%ae%9a%e5%85%83%e7%b4%a0)

### 注释节点

注释节点和文本节点的处理情况一样：

```js
// 创建一个注释节点
vnode.elm = nodeOps.createComment(vnode.text);

// 插入到refElm之前
insert(parentElm, vnode.elm, refElm);
```

创建注释节点的方法为[`createComment()`](../封装的dom方法/README.md#createcomment%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e6%b3%a8%e9%87%8a%e8%8a%82%e7%82%b9)

### 元素节点

首先通过`isUnknownElement()`方法判断当前的元素是否为未知的元素，这里如果用户要使用自己自定义的元素，那么要先进行注册，否则会被认为是未注册的组件。

没有问题后便调用[`createElement()`](../封装的dom方法/README.md#createelement%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e5%85%83%e7%b4%a0%e8%8a%82%e7%82%b9)或[`createElementNS()`](../封装的dom方法/README.md#createelementns%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e5%91%bd%e5%90%8d%e7%a9%ba%e9%97%b4%e5%85%83%e7%b4%a0%e8%8a%82%e7%82%b9)为其创建`DOM`元素节点：

```js
// 根据其是否具有命名空间，来创建对应的真实dom元素
vnode.elm = vnode.ns ?
    nodeOps.createElementNS(vnode.ns, tag) :
    nodeOps.createElement(tag, vnode);
```

之后便使用[`setScope()`](#setscope%e8%ae%be%e7%bd%aecss%e4%bd%9c%e7%94%a8%e5%9f%9f%e5%b1%9e%e6%80%a7)来为该元素设置当前组件的`css`作用域。然后遍历子节点数组，为子节点创建[`createChildren()`](#createchildren%e9%81%8d%e5%8e%86%e5%ad%90%e8%8a%82%e7%82%b9%e6%95%b0%e7%bb%84%e5%88%9b%e5%bb%ba%e5%85%83%e7%b4%a0%e8%8a%82%e7%82%b9)元素节点

最后调用[`invokeCreateHooks()`](#invokecreatehooks%e8%b0%83%e7%94%a8create%e7%94%9f%e5%91%bd%e5%91%a8%e6%9c%9f%e7%9a%84%e9%92%a9%e5%ad%90%e5%87%bd%e6%95%b0)处理`VNode`节点中所有的属性，例如`class/style/v-dir`，事件挂载等等。

最后，调用[`insert()`](#insert%e5%90%91ref%e5%85%83%e7%b4%a0%e5%89%8d%e6%8f%92%e5%85%a5%e6%8c%87%e5%ae%9a%e5%85%83%e7%b4%a0)方法将该元素插入指定元素之前。

## createComponent()

## setScope()——设置CSS作用域属性

该函数用于检查节点是否需要设置`CSS`的作用域，如果需要则通过对每个元素添加和该`vm`实例唯一对应的`attribute`来进行设置

```js
// set scope id attribute for scoped CSS.
// this is implemented as a special case to avoid the overhead
// of going through the normal attribute patching process.
// 设置CSS属性的作用域
// 这是一个单独的实现，防止对元素的普通attribute进行patch时造成额外的开销
function setScope(vnode) {
    let i;

    // 该VNode节点是否存在属性作用域，有则设置
    if (isDef(i = vnode.fnScopeId)) {
        nodeOps.setStyleScope(vnode.elm, i);

    // 没有则
    } else {
        let ancestor = vnode

        // 遍历该vm实例中的祖先节点，继承它的作用域属性
        while (ancestor) {

            // 是否存在vm实例并且该实例上是否存在_scopeId
            if (isDef(i = ancestor.context) && isDef(i =i.$options._scopeId)) {

                // 有则设置同意的作用域属性
                nodeOps.setStyleScope(vnode.elm, i)
            }
            ancestor = ancestor.parent
        }
    }

    // for slot content they should also get the scopeId from the host instance.
    // 对于插槽中的内容，它们也需要添加当前vm实例的scoped属性
    // 当前更新中的vm实例
    if (isDef(i = activeInstance) &&

        // VNode节点所处的vm实例不与当前的更新的实例相同
        i !== vnode.context &&
        i !== vnode.fnContext &&
        isDef(i = i.$options._scopeId)
    ) {
        nodeOps.setStyleScope(vnode.elm, i)
    }
}
```

除了自身的那些`VNode`节点外，还要对当前插槽中的内容同样设置当前`vm`实例的`CSS`作用域。

## checkDuplicateKeys()——检查是否存在重复key值

该方法用于检查子节点数组中的`key`值是否存在重复的情况。

```js
// 检查子节点数组中是否存在重复的key
function checkDuplicateKeys(children) {

    // 一个key值的map对象
    const seenKeys = {};

    // 遍历子节点数组，检查它们的key值是否重复
    for (let i = 0; i < children.length; i++) {
        const vnode = children[i]
        const key = vnode.key;

        // 重复时报错
        if (isDef(key)) {
            if (seenKeys[key]) {
                warn(
                    `Duplicate keys detected: '${key}'. This may cause an update error.`,
                    vnode.context
                )
            } else {

                // 没重复时存入map对象中
                seenKeys[key] = true
            }
        }
    }
}
```

## setAttr()——设置元素的属性

该方法用于兼容性处理元素的各种属性的设置，它会根据其属性名和值来进行设置，大致分为5类：

- 自定义标签
- 布尔值的属性
- 枚举类型的属性
- 命名空间属性
- 其他情况

这里就说明下什么是枚举类型的属性，因为没常见过。所谓**枚举类型的属性就是该属性必须要一个值**，三选一`true/false/''`。不能写这种形式`<div contenteditable></div>`

```js
function setAttr(el: Element, key: string, value: any) {

    // 自定义元素标签，则直接设置属性
    if (el.tagName.indexOf('-') > -1) {
        baseSetAttr(el, key, value);

    // 是否值为布尔值的属性，真对该属性即使没值也要设置
    } else if (isBooleanAttr(key)) {

        // set attribute for blank value
        // e.g. <option disabled>Select one</option>

        // 是否为假值，假值直接移除
        if (isFalsyAttrValue(value)) {
            el.removeAttribute(key)
        } else {

            // technically allowfullscreen is a boolean attribute for <iframe>,
            // but Flash expects a value of "true" when used on <embed> tag
            // 处理flash的allowfullscreen属性的特殊情况
            // 除flash的特殊情况外，其余的布尔值属性真值的值为自己的名称
            value = key === 'allowfullscreen' && el.tagName === 'EMBED' ?
                'true' : key;
            el.setAttribute(key, value);
        }

    // 如果为枚举属性(枚举属性特点为必有值)
    } else if (isEnumeratedAttr(key)) {
        el.setAttribute(key, convertEnumeratedValue(key, value));

    // 如果为命名空间属性
    } else if (isXlink(key)) {

        // 假值则移除
        if (isFalsyAttrValue(value)) {
            el.removeAttributeNS(xlinkNS, getXlinkProp(key));

        // 真值则添加命名空间
        } else {
            el.setAttributeNS(xlinkNS, key, value);
        }

    // 其余情况直接设置
    } else {
        baseSetAttr(el, key, value);
    }
}
```

### 枚举属性的处理

对于处理枚举属性时，具体的枚举属性的检验函数为`isEnumeratedAttr()`：

```js
const isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck');
```

而对于其值的处理，允许用于传入任何值，`Vue`会在内部调用`convertEnumeratedValue()`进行处理，真值一律处理为`true`(除`contenteditable`属性的几个特定字符串值外)：

```js
// 可供contenteditable选择的属性
const isValidContentEditableValue = makeMap('events,caret,typing,plaintext-only');

const convertEnumeratedValue = (key: string, value: any) => {
    return isFalsyAttrValue(value) || value === 'false' ? 'false'
        // allow arbitrary string value for contenteditable
        // contenteditable运行几个可选字符串属性值
        : (key === 'contenteditable' && isValidContentEditableValue(value) ?
        value : 'true');
}

const isFalsyAttrValue = (val: any): boolean => {

    // 验证null与undefined   验证false
    return val == null || val === false
}
```

### 布尔值的处理

对于布尔值的处理，首先是调用`isBooleanAttr()`进行属性的检查：

```js
const isBooleanAttr = makeMap(
    'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
    'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
    'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
    'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
    'required,reversed,scoped,seamless,selected,sortable,translate,' +
    'truespeed,typemustmatch,visible'
);
```

同样此处对假值的处理是调用的`isFalsyAttrValue()`(注意价值里面不包括`''`)，对于假值，布尔值属性会直接移除该值；而对于真值，除`Flash`插件的特殊情况外，其余的值都为自己的属性名称。

### 命名空间属性的处理

对于命名空间属性的处理差不多和布尔值一样，如果是假值就移除；如果为真值，则直接添加，这里对于其验证的几个函数就不学习了，有兴趣自己去找。

### 其他情况与自定义标签

这两种情况的处理方法一样，就是调用下面的`baseSetAttr()`方法直接设置属性。

## baseSetAttr()——设置元素attribute

该方法会针对给定的值来设置元素的某个属性，如果是假值，那么会直接移除该属性；真值当然是直接设置对应属性。

```js
function baseSetAttr(el, key, value) {

    // 如果设置的属性值为假值，则移除该属性
    if (isFalsyAttrValue(value)) {
        el.removeAttribute(key);

    // 设置的值为真值的情况
    } else {
        // #7138: IE10 & 11 fires input event when setting placeholder on
        // <textarea>... block the first input event and remove the blocker
        // immediately.
        // 如果设置的为placeholder属性，则需要一些处理，当然这个处理只对初始渲染有用
        if (
            isIE && !isIE9 &&
            el.tagName === 'TEXTAREA' &&
            key === 'placeholder' && value !== '' && !el.__ieph
        ) {

            // 堵塞函数
            const blocker = e => {

                // 阻止冒泡和其他事件监听函数的执行
                e.stopImmediatePropagation();

                // 然后移除该阻塞函数
                el.removeEventListener('input', blocker)
            }

            // 移除该阻塞函数
            el.addEventListener('input', blocker);

            // IE placeholder补丁标记位
            el.__ieph = true /* IE placeholder patched */
        };

        // 设置placeholder属性
        el.setAttribute(key, value);
    }
}
```

这个过程中还有一个关于`IE10/11`的`BUG`：当设置`placeholder`时，会立即触发`textarea`元素的`input`事件。针对这个`BUG`，并不能彻底解决，只能在初次渲染的时候，进行一次修复；如果设置动态的`placeholder`则还会触发该`bug`

## insert()——向ref元素前插入指定元素

该方法即向插入指定的`ref`前插入元素，如果没有指定`ref`则相当于`el.appendChild()`将插入父节点的最后一个子节点位置。

```js
function insert(parent, elm, ref) {
    if (isDef(parent)) {
        if (isDef(ref)) {
            if (nodeOps.parentNode(ref) === parent) {
                nodeOps.insertBefore(parent, elm, ref)
            }
        } else {
            nodeOps.appendChild(parent, elm)
        }
    }
}
```

## createChildren()——遍历子节点数组创建元素节点

方法很简单，就是为每个元素调用[`createElm()`](#createele%e5%88%9b%e5%bb%ba%e4%b8%80%e4%b8%aa%e5%85%83%e7%b4%a0%e6%8f%92%e5%85%a5%e7%88%b6%e8%8a%82%e7%82%b9)方法来创建元素，如果仅一个节点而不是数组，那么则为一个文本节点，则直接添加到子节点中即可。

```js
function createChildren(vnode, children, insertedVnodeQueue) {

    // 多个子节点时
    if (Array.isArray(children)) {

        // 检查它们的key值是否存在重复的情况(没有就不说了)
        if (process.env.NODE_ENV !== 'production') {
            checkDuplicateKeys(children)
        }

        // 遍历子节点数组来创建子节点的元素
        for (let i = 0; i < children.length; ++i) {
            createElm(children[i], insertedVnodeQueue, vnode.elm, null, true, children, i)
        }

    // 仅一个文本节点，直接将其添加到当前元素的子数组中
    } else if (isPrimitive(vnode.text)) {
        nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text)))
    }
}
```

这其中调用了[`checkDuplicateKeys()`](#checkduplicatekeys%e6%a3%80%e6%9f%a5%e6%98%af%e5%90%a6%e5%ad%98%e5%9c%a8%e9%87%8d%e5%a4%8dkey%e5%80%bc)来查看子节点中是否存在重复的`key`值，因为`key`值必须唯一。

## invokeCreateHooks()——调用create生命周期的钩子函数

该方法用于同一调用`VNode`节点`create`周期的钩子函数，这些函数就是用来处理元素的那些指令、样式、类等等，[详细请看](../封装的处理节点属性方法/README.md)。这些方法是同一的，每个元素节点都会调用。

```js
// 调用create周期的钩子函数
function invokeCreateHooks(vnode, insertedVnodeQueue) {

    // 调用所有create周期的对指令处理的钩子函数
    for (let i = 0; i < cbs.create.length; ++i) {

        // 由于是新的节点，所以不存在旧节点，这里用一个空节点代替。
        // 更新节点上的属性
        cbs.create[i](emptyNode, vnode)
    }
    i = vnode.data.hook // Reuse variable
    if (isDef(i)) {

        // 处理后的钩子函数中，存在create周期的钩子函数则调用
        if (isDef(i.create)) i.create(emptyNode, vnode);

        // 如果存在insert阶段的钩子函数，那么将该节点加入inserted队列
        if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
    }
}
```

这里我们可以看到`insert`阶段的钩子函数，会存入该队列中，等待节点插入文档时调用。
