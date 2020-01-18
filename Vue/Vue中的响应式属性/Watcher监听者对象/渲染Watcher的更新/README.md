# 渲染Watcher的更新

由[前面]()我们知道了，一个属性的改变是如何联动导致各种`Watcher`的更新，这里我们进一步探讨这之中的渲染`Watcher`的更新。

首先，无论哪种`Watcher`都将根据其回调函数重新求值，渲染`Watcher`也不例外。在我们初始化渲染`Watcher`时传入的求值函数为`updateComponent()`，其作用就是重新从该组件开始重新编译和生成渲染函数(模版情况)，当然更新肯定不可能直接是全部重新编译，所以这里我们来看看他们的处理。

从上面的描述我们就可以看到，更新的起点是从受影响的`Watcher`，并非将所有的更新都进行一次。而在调用`updateComponent()`函数时，我们直接就在通过`render()`函数重新生成`VNode Tree`了，`updateComponent()`函数分为两个部分——`_render()`与`_update()`。

```js
updateComponent = function () {
    vm._update(vm._render(), hydrating);
};
```

其中`_render()`函数即对根据当前Watcher的组件的模版(或渲染函数)生成VNode，这个和初始化渲染是一样的，这里重点应该关注的是`_update()`函数：

```js
vm.$el = vm.__patch__(prevVnode, vnode);
```

同样的是在其中调用`__patch__`函数，相当于初始化渲染不同的是，这次并没有指定特殊的渲染行为，并且传入了上次渲染的同层级的`VNode`节点进行对比。其实看这个函数名就可以知道——打补丁，它对比同层级的`VNode`节点，然后对其不同进行打补丁的行为，让真实的`DOM`元素向最新的`VNode`同步。这里有个过程的[简述版本](../../../Vue中的diff算法/README.md)，如果你还愿意看我详细的唠叨下，那么可以继续往下看。

## 新旧VNode节点的diff

所谓`diff`就是找到新旧两个`VNode`节点的不同之处，然后进行处理。

### 新或旧VNode节点不存在时

首先最简单的情况就是新的`VNode`节点已经不存在了，那么我们只需要将旧的`DOM`片段删除并销毁其中的`vm`组件实例即可(当然旧的`VNode`节点也存在)。

```js
// 如果当前节点已经不存在，则直接销毁旧节点并返回。
if (isUndef(vnode)) {

    // 如果之前存在节点，那么直接调用该节点及其子节点的destroy()钩子函数
    if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
    return
}
```

既然有了这种情况，那么也有另一种简单情况：新`VNode`节点存在，旧`VNode`节点不存在，此时我们只需根据新的`VNode`节点创建元素即可。

```js
// 之前不存在节点时，即新生成了节点
if (isUndef(oldVnode)) {

    // empty mount (likely as component), create new root element
    // 凭空挂载，比如创建组件时，直接创建一个根的DOM元素
    // 改变状态为初始化补丁状态。
    isInitialPatch = true;

    // 为VNode创建元素，并创建其所有子元素
    createElm(vnode, insertedVnodeQueue);
}
```

以上情况仅出现在组件中，以根vm实例进行渲染时，`oldVnode`为一个元素。

### 两个VNode节点都存在时

当两个`VNode`节点都存在时，情况就比较复杂了，首先我们要确认，新旧`VNode`节点，是否在大体上是相同的，这个对比是通过`sameVnode()`函数，如果大体上相同，那么我们就可以复用这个节点代表的元素。

现在我们来猜想一下，满足什么条件可以称之为大体相同，从我们书写`Vue`代码触发，首先是指定`key`的节点，`key`必须相同，其次对于元素的类型和标签肯定也要一致，事实上这个函数也就是如此：

```js
function sameVnode (a, b) {

    // 当两个节点的key、tag、是否为注释、都具有节点属性、input类型是否相同
    return (
        a.key === b.key && (
            (
            a.tag === b.tag &&
                a.isComment === b.isComment &&
                isDef(a.data) === isDef(b.data) &&
                sameInputType(a, b)
            )
        )
    )
}
```

如果不满足`sameVnode()`这个条件，那么会像创建根`vm`实例一样，根据新的`VNode Tree`创建一个全新的`DOM`片段，所以这里唯一有价值的就是对于复用节点的判定:

```js
if (!isRealElement && sameVnode(oldVnode, vnode)) {
    // patch existing root node
    patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
}
```

从上面也同时反应，一个组件是否复用至少要**其占位节点**满足`sameVnode()`才行，接下来就是一个递归调用`patchVnode()`函数对每个`VNode`节点打补丁的过程，下面来看看这个函数：

```js
function patchVnode(
    oldVnode,
    vnode,

    // insert队列，用于触发insert钩子函数
    insertedVnodeQueue,

    // 所在的子节点数组
    ownerArray,

    // 所在子节点数组的位置
    index,
    removeOnly
) {

    // 如果是同一节点，直接返回不做更改
    if (oldVnode === vnode) {
        return
    }

    // TransitionGroup组件专属，用于重写节点
    if (isDef(vnode.elm) && isDef(ownerArray)) {

        // clone reused vnode
        vnode = ownerArray[index] = cloneVNode(vnode)
    }

    // 获取旧节点元素，并赋值给新节点，相当于该VNode节点复用DOM节点了
    const elm = vnode.elm = oldVnode.elm

    // 处理异步节点，无视
    if (isTrue(oldVnode.isAsyncPlaceholder)) {
        if (isDef(vnode.asyncFactory.resolved)) {
            hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
        } else {
            vnode.isAsyncPlaceholder = true
        }
        return
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    // 复用静态VNode Tree的DOM节点
    // 仅在该Vnode节点是cloned的情况下——如果新的节点不是克隆的，那么就意味着渲染函数
    // 已经通过热重置API重置，此时我们就需要重新渲染。
    if (isTrue(vnode.isStatic) &&
        isTrue(oldVnode.isStatic) &&
        vnode.key === oldVnode.key &&
        (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
        // 静态节点树直接复制组件实例，不做处理返回
        vnode.componentInstance = oldVnode.componentInstance
        return
    }

    let i;
    const data = vnode.data;

    // 为组件Vnode调用prepatch函数，做预处理，更新组件上的数据和插槽等等
    if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
        i(oldVnode, vnode);
    }

    const oldCh = oldVnode.children;
    const ch = vnode.children;

    // 仅当其具有真实DOM结构时，进行属性更新
    if (isDef(data) && isPatchable(vnode)) {

        // 调用之前初始化属性时的函数，更新属性
        for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)

        // 调用组件的update函数(普通组件无)
        if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
    }

    // 如果当前节点为元素节点，则查看其子节点数组是否存在，来判断下一步
    if (isUndef(vnode.text)) {

        // 新旧VNoed节点都同时存在子节点数组
        if (isDef(oldCh) && isDef(ch)) {
            if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)

        // 之前没有子节点数组，现在有
        } else if (isDef(ch)) {
            if (process.env.NODE_ENV !== 'production') {
                checkDuplicateKeys(ch)
            }
            if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
            addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)

        // 之前有现在没有子节点数组，则直接移除
        } else if (isDef(oldCh)) {
            removeVnodes(elm, oldCh, 0, oldCh.length - 1)

        // 子节点为文本节点则直接更新
        } else if (isDef(oldVnode.text)) {
            nodeOps.setTextContent(elm, '')
        }

    // 如果当前节点为文本节点且文本改变，那么直接改变其文本即可
    } else if (oldVnode.text !== vnode.text) {
        nodeOps.setTextContent(elm, vnode.text)
    }

    // 调用组件的postpatch函数(普通组件无)
    if (isDef(data)) {
        if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
    }
}
```

首先能进入该函数，已经说明了当前节点已经可复用了，所以我们可以看到下面这一行代码，直接将元素赋值给了新的VNode节点：

```js
const elm = vnode.elm = oldVnode.elm;
```

然后就是处理静态节点，针对静态节点，`Vue`直接是不处理直接返回：

```js
if (isTrue(vnode.isStatic) &&
    isTrue(oldVnode.isStatic) &&
    vnode.key === oldVnode.key &&
    (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
) {
    // 静态节点树直接复制组件实例，不做处理返回
    vnode.componentInstance = oldVnode.componentInstance
    return
}
```

对于组件的节点，则直接调用组件的`prepatch`钩子函数更新组件实例上的各种属性：

```js
const data = vnode.data;

// 为组件Vnode调用prepatch函数，做预处理，更新组件上的数据和插槽等等
if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
    i(oldVnode, vnode);
}
```

之后调用`update`钩子函数更新我们之前初始化的元素节点上的各种属性，同时调用我们定义的组件`udpate`生命周期函数：

```js
// 仅当其具有真实DOM结构时，进行属性更新
if (isDef(data) && isPatchable(vnode)) {

    // 调用之前初始化属性时的函数，更新属性
    for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)

    // 调用组件的update函数(普通组件无)
    if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
}
```

到此为止，对一个节点的更新就全部完成了，接下来便是对该节点的子节点数组的更新，由于之前的了解这里会运用特殊的算法对子数组进行筛选来更新，但首先要处理一次最简单的情况：即新旧`VNode`节点是否具有子节点数组。

```js
// 如果当前节点为元素节点，则查看其子节点数组是否存在，来判断下一步
if (isUndef(vnode.text)) {

    // 新旧VNoed节点都同时存在子节点数组
    if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)

    // 之前没有子节点数组，现在有
    } else if (isDef(ch)) {

        // 检查子数组中是否定义有重复的key值
        if (process.env.NODE_ENV !== 'production') {
            checkDuplicateKeys(ch)
        }
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)

    // 之前有现在没有子节点数组，则直接移除
    } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1)

    // 子节点为文本节点则直接更新
    } else if (isDef(oldVnode.text)) {
        nodeOps.setTextContent(elm, '')
    }

// 如果当前节点为文本节点且文本改变，那么直接改变其文本即可
} else if (oldVnode.text !== vnode.text) {
    nodeOps.setTextContent(elm, vnode.text)
}
```

首先能进入这个`if`语句则说明最新的`VNode`节点为一个元素节点，那么那么现在只需要对比新旧元素的子节点数组即可，可能出现以下情况：

- 旧节点有子节点数组，新节点无子节点数组
- 旧节点无子节点数组，新节点有子节点数组
- 新旧节点都有子节点数组

针对前两种情况，解决方法就比较简单，即新增或删除对应子节点数组即可。这里没有什么可以对比的更新地方，所以这里主要`diff`的地方第三种情况，可见调用的是`updateChildren()`方法：

```js
function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
    let oldStartIdx = 0
    let newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx, idxInOld, vnodeToMove, refElm

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    // removeOnly是一个特殊的标记，专用于
    // <transition-group>组件移除在离开过渡动画中正确位置的元素
    const canMove = !removeOnly

    if (process.env.NODE_ENV !== 'production') {
        checkDuplicateKeys(newCh)
    }

    // 当新旧两个节点的头尾指针没有一个相遇，就继续进行对比
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (isUndef(oldStartVnode)) {

            // 当旧节点的头指针指向的节点不存在时，左指针右移
            oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
        } else if (isUndef(oldEndVnode)) {

            // 当旧节点的尾指针指向的节点不存在时，指针左移
            oldEndVnode = oldCh[--oldEndIdx]

        // 当新旧两个头指针相等时
        } else if (sameVnode(oldStartVnode, newStartVnode)) {

            // 当新旧节点头指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针右移
            patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)
            oldStartVnode = oldCh[++oldStartIdx]
            newStartVnode = newCh[++newStartIdx]

        // 当新旧节点两个尾指针指向节点相同时
        } else if (sameVnode(oldEndVnode, newEndVnode)) {

            // 当新旧节点尾指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针左移
            patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue, newCh, newEndIdx)
            oldEndVnode = oldCh[--oldEndIdx]
            newEndVnode = newCh[--newEndIdx]

        // 当旧的头指针节点与新的尾指针节点相同时
        } else if (sameVnode(oldStartVnode, newEndVnode)) {

            // 当新节点头指针，与旧节点尾指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针向内部移动
            patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue, newCh, newEndIdx)

            // 将旧节点尾指针指向的元素插入到当前旧节点尾指针指向的元素的下一个元素之前
            canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
            oldStartVnode = oldCh[++oldStartIdx]
            newEndVnode = newCh[--newEndIdx]

        // 当旧的尾指针节点与新的头指针节点相同时
        } else if (sameVnode(oldEndVnode, newStartVnode)) {

            // 当新节点尾指针，与旧节点头指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针向内部移动
            patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)

            // 将旧节点尾指针指向的元素插入到当前旧节点头指针指向的元素之前
            canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
            oldEndVnode = oldCh[--oldEndIdx]
                newStartVnode = newCh[++newStartIdx];

        // 其他情况，优先查找是否有相同节点
        } else {
            // 当4个指针都没有对应大致相等的节点时，通过其子节点的key值生成指针之间hash表，来看是否有相同的key

            // 第一次时生成旧节点上两指针之间的子节点与其对应key的hash表
            if (isUndef(oldKeyToIdx)) {
                oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
            }

            // 新节点的头指针指向节点的key是否在该hash表中
            idxInOld = isDef(newStartVnode.key)

                // 存在时，直接返回该子节点
                ?
                oldKeyToIdx[newStartVnode.key]

                // 否则直接遍历旧节点的子节点数组对象，查看是否相等
                :
                findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)

            // 两种方式都未找到时，创建新的子节点
            if (isUndef(idxInOld)) { // New element
                createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm, false, newCh, newStartIdx)
            } else {

                // 找到相同key或是同一个vnode节点的节点时
                vnodeToMove = oldCh[idxInOld]

                // 先对比其是否大致相同，相同时对该节点进行打补丁更新，同时清空hash表中对应的节点
                if (sameVnode(vnodeToMove, newStartVnode)) {
                    patchVnode(vnodeToMove, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)
                    oldCh[idxInOld] = undefined

                    // 将找到的节点元素插入到旧节点头指针指向的元素之前
                    canMove && nodeOps.insertBefore(parentElm, vnodeToMove.elm, oldStartVnode.elm)
                } else {

                    // same key but different element. treat as new element
                    // key相同但元素不相同时，直接生成新元素替换指针位置的元素
                    createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm, false, newCh, newStartIdx)
                }
            }

            // 新节点头节点与头指针右移一个
            newStartVnode = newCh[++newStartIdx]
        }
    }

    // 当新旧节点的任意一对指针相遇时，说明已经遍历过一次了，就结束比较了
    // 此时根据是哪对指针率先相遇来决定之后的节点。
    // 如果是旧指针相遇，那么说明新节点中有一部分节点是新增的，那么直接为其添加
    if (oldStartIdx > oldEndIdx) {
        refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
        addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)

    // 如果是新指针相遇，那么说明旧节点中有一部分节点是多余的，那么就直接删除
    } else if (newStartIdx > newEndIdx) {
        removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
    }
}
```

针对子数组节点，这里采用了对照对比的方式，分别分为旧的子节点数组与新的子节点数组。然后对于每一个节点数组同时启用两个指针，从头部和尾部开始进行对比。 但凡旧指针与新指针指向的节点符合`sameVnode()`条件，那么就说明两个指针指向的是同一个那么此时我们就可以不改变原元素，直接根据新旧指针的位置，将元素调度过去即可，然后递归调用`patchVnode()`函数处理当前元素。

清楚了原理，那么我们可以来看下它是按何种方式来对比的，(下面的叙述，前一个指旧`Vnode`节点的指针，后一个指新`Vnode`节点的指针)：

1. 头头指针对比
2. 尾尾指针对比
3. 头尾指针对比
4. 尾头指针对比
5. 旧节点头指针在全部节点中查找

上述的对比方式是按遍历的方式进行的，直到任意一对指针相遇为止，此时又存在两种情况：

- 新指针对率先相遇
- 旧指针对率先相遇

那么这两个情况分别意味着什么呢？其实很好理解：**如果新指针对率先相遇，那么说明旧子节点数组中指针之间的节点已经在新的子节点数组中被删除了，所以我们要删除它们代表的元素；如果是旧指针对率先相遇，那么就说明新的子节点数组头尾两个指针之间的元素为新增的，那么直接添加即可。**

那么如此往复，直至所有的`VNode`节点都对比完毕，整个`patchVnode()`的过程也就结束了，最后退出到`patch()`函数，调用重新插入节点的钩子函数：

```js
// 为insertedVNodeQueue中的VNode调用其insert周期的函数
invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);
```

之后整个渲染`Watcher`的更新过程就结束了。
