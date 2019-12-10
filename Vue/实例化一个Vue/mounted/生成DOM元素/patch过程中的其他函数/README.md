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

>这里我们只说明是元素的情况，组件的情况请看下面的函数[`createComponent()`]，由于组件并不为元素所以，此处会直接退出

在不是组件的情况中，国际惯例，三种情况，[文本节点](#%e6%96%87%e6%9c%ac%e8%8a%82%e7%82%b9)，[元素节点](#%e5%85%83%e7%b4%a0%e8%8a%82%e7%82%b9)，[注释节点](#%e6%b3%a8%e9%87%8a%e8%8a%82%e7%82%b9)，先拿好捏的痱子开始：

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

## createComponent()——创建组件实例与其DOM片段

该方法用于为组件`VNode`节点创建其对应的组件`vm`实例，并将其模版转换为`DOM`片段。

```js
function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {

    // 获取节点的属性
    let i = vnode.data;

    // 如果存在属性则说明至少不为一个普通的元素
    if (isDef(i)) {

        // 是否为重新激活的动态组件(即使是组件VNode第一次进入时，是不存在.componentInstance属性的)
        const isReactivated = isDef(vnode.componentInstance) && i.keepAlive;

        // 如果存在初始化钩子函数则调用(仅组件中存在)
        if (isDef(i = i.hook) && isDef(i = i.init)) {

            // 调用初始化init()函数，创建组件实例与其dom片段(客户端渲染，不进行注水)
            i(vnode, false /* hydrating */ );
        }

        // after calling the init hook, if the vnode is a child component
        // it should've created a child instance and mounted it. the child
        // component also has set the placeholder vnode's elm.
        // in that case we can just return the element and be done.
        // 调用初始化钩子函数后，如果该VNode是子组件。那么它已经创建了子实例并挂载。
        // 子组件同样也已经设置了其占位符元素(挂载的元素)
        // 这样我们可以直接返回这个元素
        if (isDef(vnode.componentInstance)) {

            // 初始化组件VNode的属性
            initComponent(vnode, insertedVnodeQueue);

            // 将组件的根节点插入指定元素之前
            insert(parentElm, vnode.elm, refElm);

            // 如果其为重新激活的动态组件，那么
            if (isTrue(isReactivated)) {
                reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
            }
            return true
        }
    }
}
```

首先，该函数任何VNode节点都可以进入，所以它其实也是一个检测函数。我们的组件VNode节点首先都具有一个固定的`hook`对象，里面包含了其生命周期的函数，所以通过检测`VNode.data`就可以筛选出一些非组件`VNode`节点了。

>这里我们先不谈keep-alive动态组件，等会再提

那么我们如何筛选出剩下的节点呢？这里就是通过其`vnode.componentInstance`属性，这个属性一开始即使是组件标签也是不具有的，但它通过下面这一步，就会生成：

```js
// 如果存在初始化钩子函数则调用(仅组件中存在)
if (isDef(i = i.hook) && isDef(i = i.init)) {

    // 调用初始化init()函数，创建组件实例与其dom片段(客户端渲染，不进行注水)
    i(vnode, false /* hydrating */ );
}
```

那么这一步在干什么呢？其实就是调用组件生命周期[`componentVNodeHooks.init()`](../../渲染函数中的方法/创建组件VNode/组件VNode的Hook/README.md#init%e7%94%9f%e6%88%90%e7%bb%84%e4%bb%b6vm%e5%ae%9e%e4%be%8b%e5%88%9b%e5%bb%ba%e5%85%b6dom%e7%89%87%e6%ae%b5)，它会为其生成一个`vm`实例，然后编译其模版生成`DOM`片段。

如果是组件，那么自然我们就会进入最后一个`if`语句中，虽然我们已经生成了组件实例和`DOM`模版，但是我们还并未让其插入现有的`DOM`片段中，且我们组件`VNode`上面的属性也并没有处理(普通的`VNode`处理属性用的函数[`invokeCreateHooks()`](../封装的处理节点属性方法/README.md))，所以我们需要在[`initComponent()`](#initcomponent%e5%a4%84%e7%90%86%e7%bb%84%e4%bb%b6vnode%e5%b1%9e%e6%80%a7)干这些事情。最后我们将其插入到顶层`DOM`结构的对应位置。

### 复用动态组件

首先我们可以看到，进入时，就会判断该`VNode`节点是否为组件节点，且具有`keepAlive`属性，当两者都具有时，说明这是一个**非第一次渲染**中被复用的动态组件。

```js
// 是否为重新激活的动态组件(即使是组件VNode第一次进入时，是不存在.componentInstance属性的)
const isReactivated = isDef(vnode.componentInstance) && i.keepAlive;

if (isTrue(isReactivated)) {
    reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
}
```

如果是复用的动态组件，那么我们在普通的处理之际会调用`reactivateComponent()`进行特殊的处理。

## initComponent()——处理组件VNode属性

该函数用于处理组件`VNode`上的各种属性，将其添加到其对应的`DOM`元素上。

```js
function initComponent(vnode, insertedVnodeQueue) {

    // 是否存在等待插入的队列(组件根节点上的)，如果有则全部加入insertedVNodeQueue中
    if (isDef(vnode.data.pendingInsert)) {
        insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
        vnode.data.pendingInsert = null;
    }

    // 将组件VNode的elm同步到组件实例的$el
    vnode.elm = vnode.componentInstance.$el;

    // 是否能进行patch操作(只要组件中存在任何真实元素VNode节点就行)
    if (isPatchable(vnode)) {

        // 调用该函数处理组件VNode上的属性
        invokeCreateHooks(vnode, insertedVnodeQueue);

        // 设置该VNode节点的组件作用域
        setScope(vnode);
    } else {

        // empty component root.
        // 空的组件根节点时
        // skip all element-related modules except for ref (#3455)
        // 除了更新ref外跳过所有的其他属性的更新
        registerRef(vnode);

        // make sure to invoke the insert hook
        // 确保调用insert的钩子函数
        insertedVnodeQueue.push(vnode)
    }
}
```

这里可以看到组件的`VNode.elm`是与根元素同样的；由于组件处理完后要插入`insertedVnodeQueue`队列的节点无法直接加入到我们当前最顶的`insertedVnodeQueue`队列中，所以只能在根`VNode.data`中来实现，所以这里将组件编译后要在`insert`阶段调用`hook`的`VNode`节点全部加入顶层的`insertedVnodeQueue`队列：

```js
// 是否存在等待插入的队列(组件根节点上的)，如果有则全部加入insertedVNodeQueue中
if (isDef(vnode.data.pendingInsert)) {
    insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
    vnode.data.pendingInsert = null;
}
```

接下来便是处理一种边界情况，假如有个如下的组件模版：

```js
<div v-if="a" ref="div"></div>
```

虽然它是一个组件，但是当其`a`为`false`时，该组件就为一个空组件，我们就不对其进行任何处理，但是保留其`ref`属性的处理。这里调用[`isPatchable()`](#ispatchablevnode%e6%98%af%e5%90%a6%e8%83%bd%e8%bf%9b%e8%a1%8cpatch)函数来判断其是否能进行`patch`操作。正常的组件(非空)，则直接调用[`invokeCreateHooks()`](#invokecreatehooks%e8%b0%83%e7%94%a8create%e7%94%9f%e5%91%bd%e5%91%a8%e6%9c%9f%e7%9a%84%e9%92%a9%e5%ad%90%e5%87%bd%e6%95%b0)开始处理属性，然后调用[`setScope()`](#setscope%e8%ae%be%e7%bd%aecss%e4%bd%9c%e7%94%a8%e5%9f%9f%e5%b1%9e%e6%80%a7)设置`css`作用域；而空组件则只调用[`registerRef()`](../封装的处理节点属性方法/更新ref/README.md)注册一个`ref`属性。

## reactivateComponent()——拒绝复用动态组件过渡动画问题

该函数是专用于为复用的动态组件解决其过渡动画无法正常调用的问题

但我目前还不知道具体原因，我会在了解所有流程后在看一次，**留坑**

```js
function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    // 专为#4339问题的解决方案：当一个重新被激活的动态组件内含有transition组件时，
    // 不会执行动画，因为其过渡动画created周期的钩子函数不会调用。目前除了以下方式没有
    // 更好的解决方式
    let innerNode = vnode;

    // 找到执行过渡动画的根节点，为其执行动画
    while (innerNode.componentInstance) {

        // 找到内部节点的根VNode节点
        innerNode = innerNode.componentInstance._vnode;

        // 当前innerNode是否为transition中的根VNode节点,是则调用其activate函数
        if (isDef(i = innerNode.data) && isDef(i = i.transition)) {
            for (i = 0; i < cbs.activate.length; ++i) {
                cbs.activate[i](emptyNode, innerNode)
            }

            // 将其加入inserted队列，等待调用其insert-hook更新过渡动画m,
            insertedVnodeQueue.push(innerNode)
            break
        }
    }

    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    insert(parentElm, vnode.elm, refElm)
}
```

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

## isPatchable()——VNode是否能进行patch

该函数由来判断一个组件是否能进行`patch()`操作，必须要保证一个组件中存在真实的`DOM`元素`VNode`才能进行`patch()`操作。

```js
function isPatchable(vnode) {

    // 为组件标签时，
    while (vnode.componentInstance) {

        // 继续获取最顶层的真实DOM根元素VNode
        vnode = vnode.componentInstance._vnode
    }

    // 是否定义有标签
    return isDef(vnode.tag);
}
```

## invokeInsertHook()——调用VNode的insert周期的钩子函数

该函数用于处理组件中的那些要调用`insert()`函数的`VNode`，如果为根节点，那么则为调用这些`insert()`函数

```js
function invokeInsertHook(vnode, queue, initial) {

    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    // 延期调用组件根节点insert函数，待真正插入到文档中调用它们(即最顶层根节点插入文档时)
    // 确认为初始化且该根VNode节点存在父节点，那么将insertVNode队列存入组件VNode的属性中
    if (isTrue(initial) && isDef(vnode.parent)) {
        vnode.parent.data.pendingInsert = queue
    } else {

        // 对于最顶层根节点，直接调用其insert-hook函数
        for (let i = 0; i < queue.length; ++i) {
            queue[i].data.hook.insert(queue[i])
        }
    }
}
```

具体的`insert()`函数一般包括，普通组件、过渡组件、`v-model`。

## removeVnodes()——移除