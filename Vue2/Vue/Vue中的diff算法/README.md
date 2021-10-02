# VNode 更新策略——diff 算法

之前在笔记本上已经写过一遍了，但是笔记本丢了，没办法只有重新在写一次。
咳咳好了，言归正传，首先我们介绍下当数据发生变换时，_Vue_ 怎么更新结点的。

## 数据发生变换时 Vue 如何更新节点

众所周知，`Vue` 在生成的真实 _DOM_ 是根据虚拟 `DOM VNode` 的结构生成的，当某个虚拟 _DOM_ 节点发生变化时，就会生成一个新的虚拟 _DOM_ 节点，然后在更具前后两个虚拟节点进行对比，在发现不一样时就会用新的虚拟节点替换旧的节点，然后直接在真实 _DOM_ 上进行修改。

而在这期间对比两个虚拟节点的函数就叫做`patch()`，在 `diff` 的过程中，其会一边比较两个虚拟节点一边给真实 _DOM_ 打补丁

### diff 比较时注意点

在用 diff 算法比较新旧节点时，只会在同层级比较，不会跨级比较，如：

```html
<!-- template 1 -->
<div>
    <p>模版1</p>
</div>

<!-- template 2 -->
<div>
    <span>模版2</span>
</div>
```

在上面的代码中，DOM 结构由模版 1 变为了模版 2，在此变化期间，diff 算法只会将`<div>`与`<div>`、`<p>`与`<span>`元素进行比较，而不会用`<div>`与`<span>`元素进行比较。

## diff 的流程

当数据发生变换时，我们知道改变一个 _Vue_ 中数据时，会触发其数据中定义的`setter`，在`setter`中会通过`dep.notify()`来通知订阅者 `Watcher` 更新所有的依赖项，然后 `Watcher` 就会调用`patch()`函数来给真实的 _DOM_ 打补丁, 更新对应的视图

首先我们来看以下 `patch()`函数

## patch()

以下为精简后的 patch()函数，保留了其核心功能

```js
function patch(oldVnode, vnode) {
    // 截取部分代码
    if (sameVnode(oldVnode, vnode)) {
        patchVnode(oldVnode, vnode)
    } else {
        // 当前oldVnode对应的真实元素节点
        const oEl = oldVnode.el

        // 旧元素的父元素
        let parentEle = api.parentNode(oEl)

        // 根据Vnode生成新元素
        createEle(vnode)

        if (parentEle !== null) {
            // 将新元素添加进父元素
            api.insertBefore(parentEle, vnode.el, api.nextSibling(oEl))

            // 移除以前的旧元素节点
            api.removeChild(parentEle, oldVnode.el)
            oldVnode = null
        }
    }
    // some code
    return vnode
}
```

在`patch()`过程中，根据新旧节点是否大致为同一节点，来进行进一步的判断，当大致相同时才有比较的价值，不同时则直接创建新元素进行替换即可，具体对比如下

### sameVnode()——两个节点是否在大致上相同

通过该函数来判断两个虚拟节点是否在大致上相同，如果连这个条件都不满足则直接可视为不同的节点

```js
function sameVnode(a, b) {
    // 当两个节点的key、tag、是否为注释、都具有节点属性、input类型是否相同
    return (
        a.key === b.key &&
        a.tag === b.tag &&
        a.isComment === b.isComment &&
        isDef(a.data) === isDef(b.data) &&
        sameInputType(a, b)
    )
}
```

如果新旧虚拟节点相同，那么就会对其进行进一步的比较，检查它们的子节点，调用`patchVnode()`函数

### patchVnode()

当新旧节点大致相同时，便会调用该方法对两个节点进行进一步的比较，然后对 DOM 进行对应的更新，具体过程如下(精简后)

```js
function patchVnode(oldVnode, vnode) {
    // 获取真实的DOM元素
    const el = (vnode.el = oldVnode.el)
    let i,
        oldCh = oldVnode.children,
        ch = vnode.children

    // 新旧节点是同一个时，肯定直接返回就完事了
    if (oldVnode === vnode) return

    // 两个节点为文本节点，但文本不同时，替换文本即可
    if (
        oldVnode.text !== null &&
        vnode.text !== null &&
        oldVnode.text !== vnode.text
    ) {
        api.setTextContent(el, vnode.text)
    } else {
        updateEle(el, vnode, oldVnode)

        // 当两者的子节点不同时，进行对比后更新
        if (oldCh && ch && oldCh !== ch) {
            updateChildren(el, oldCh, ch)
        } else if (ch) {
            // 之前没有子节点，现在有时，创建子节点DOM元素
            createEle(vnode) //create el's children dom
        } else if (oldCh) {
            // 之前有子节点，现在没有时，直接删除子节点
            api.removeChildren(el)
        }
    }
}
```

`patchNode()`干了以下的事：

1. 若新旧虚拟节点指向同一对象(相同)，直接返回，否则跳转`2`
2. 是否都为文本节点但文本不同，满足条件时直接替换文本，否则跳转`3`
3. 根据两个虚拟节点的是否有子节点来进行判断，只有旧节点有时跳转`4`，只有新节点有时跳转`5`，否则跳转`6`
4. 新节点不存在子节点，所以直接删除 DOM 元素子节点即可。
5. 因为旧节点不存在子节点，所以直接为 DOM 元素创建子节点即可。
6. 两者都有子节点且不同，`updateChildren()`调用进一步对其进行对比

### updateChildren()——对子节点对比后进行更新

该方法分别在两个节点上用双指针来对子节点进行对比，来更新 _DOM_ 元素，具体代码如下：

```js
function updateChildren(
    parentElm,
    oldCh,
    newCh,
    insertedVnodeQueue,
    removeOnly
) {
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
    const canMove = !removeOnly

    // 当新旧两个节点的头尾指针没有一个相遇，就继续进行对比
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (isUndef(oldStartVnode)) {
            // 当旧节点的头指针指向的节点不存在时，左指针右移
            oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
        } else if (isUndef(oldEndVnode)) {
            // 当旧节点的尾指针指向的节点不存在时，指针左移
            oldEndVnode = oldCh[--oldEndIdx]
        } else if (sameVnode(oldStartVnode, newStartVnode)) {
            // 当新旧节点头指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针右移
            patchVnode(
                oldStartVnode,
                newStartVnode,
                insertedVnodeQueue,
                newCh,
                newStartIdx
            )
            oldStartVnode = oldCh[++oldStartIdx]
            newStartVnode = newCh[++newStartIdx]
        } else if (sameVnode(oldEndVnode, newEndVnode)) {
            // 当新旧节点尾指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针左移
            patchVnode(
                oldEndVnode,
                newEndVnode,
                insertedVnodeQueue,
                newCh,
                newEndIdx
            )
            oldEndVnode = oldCh[--oldEndIdx]
            newEndVnode = newCh[--newEndIdx]
        } else if (sameVnode(oldStartVnode, newEndVnode)) {
            // 当新节点头指针，与旧节点尾指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针向内部移动
            patchVnode(
                oldStartVnode,
                newEndVnode,
                insertedVnodeQueue,
                newCh,
                newEndIdx
            )

            // 将旧节点尾指针指向的元素插入到当前旧节点尾指针指向的元素之前
            canMove &&
                nodeOps.insertBefore(
                    parentElm,
                    oldStartVnode.elm,
                    nodeOps.nextSibling(oldEndVnode.elm)
                )
            oldStartVnode = oldCh[++oldStartIdx]
            newEndVnode = newCh[--newEndIdx]
        } else if (sameVnode(oldEndVnode, newStartVnode)) {
            // 当新节点尾指针，与旧节点头指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针向内部移动
            patchVnode(
                oldEndVnode,
                newStartVnode,
                insertedVnodeQueue,
                newCh,
                newStartIdx
            )

            // 将旧节点尾指针指向的元素插入到当前旧节点头指针指向的元素之前
            canMove &&
                nodeOps.insertBefore(
                    parentElm,
                    oldEndVnode.elm,
                    oldStartVnode.elm
                )
            oldEndVnode = oldCh[--oldEndIdx]
            newStartVnode = newCh[++newStartIdx]
        } else {
            // 当4个指针都没有对应大致相等的节点时，通过其子节点的key值生成指针之间hash表，来看是否有相同的key

            // 第一次时生成旧节点上两指针之间的子节点与其对应key的hash表
            if (isUndef(oldKeyToIdx)) {
                oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
            }

            // 新节点的头指针指向节点的key是否在该hash表中
            idxInOld = isDef(newStartVnode.key)
                ? // 存在时，直接返回该子节点
                  oldKeyToIdx[newStartVnode.key]
                : // 否则直接遍历旧节点的子节点数组对象，查看是否相等
                  findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)

            // 两种方式都未找到时，创建新的子节点
            if (isUndef(idxInOld)) {
                // New element
                createElm(
                    newStartVnode,
                    insertedVnodeQueue,
                    parentElm,
                    oldStartVnode.elm,
                    false,
                    newCh,
                    newStartIdx
                )
            } else {
                // 找到相同key或是同一个vnode节点的节点时
                vnodeToMove = oldCh[idxInOld]

                // 先对比其是否大致相同，相同时对其打补丁更新，情况hash表中对应的节点
                if (sameVnode(vnodeToMove, newStartVnode)) {
                    patchVnode(
                        vnodeToMove,
                        newStartVnode,
                        insertedVnodeQueue,
                        newCh,
                        newStartIdx
                    )

                    // 注意这里将旧节点移除了
                    oldCh[idxInOld] = undefined

                    // 将找到的节点元素插入到旧节点头指针指向的元素之前
                    canMove &&
                        nodeOps.insertBefore(
                            parentElm,
                            vnodeToMove.elm,
                            oldStartVnode.elm
                        )
                } else {
                    // same key but different element. treat as new element
                    // key相同但元素不相同时，直接生成新元素替换指针位置的元素
                    createElm(
                        newStartVnode,
                        insertedVnodeQueue,
                        parentElm,
                        oldStartVnode.elm,
                        false,
                        newCh,
                        newStartIdx
                    )
                }
            }

            // 新节点头节点与头指针右移一个
            newStartVnode = newCh[++newStartIdx]
        }
    }

    // 如果此时旧节点头指针超过尾指针，则说明有新增的节点
    if (oldStartIdx > oldEndIdx) {
        refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
        addVnodes(
            parentElm,
            refElm,
            newCh,
            newStartIdx,
            newEndIdx,
            insertedVnodeQueue
        )

        // 新节点头指针超过尾指针，说明有多余的旧节点，删除旧节点
    } else if (newStartIdx > newEndIdx) {
        removeVnodes(oldCh, oldStartIdx, oldEndIdx)
    }
}

// 对比是否大致相同
function findIdxInOld(node, oldCh, start, end) {
    for (let i = start; i < end; i++) {
        const c = oldCh[i]
        if (isDef(c) && sameVnode(node, c)) return i
    }
}
```

虽然这么多代码，但其实`updateChildren()`函数做了以下的事：

1. 分别按新旧节点的子节点分为两组数组，然后在每组的头和尾安排两个指针指向头尾的节点。

2. 对新旧两组节点的指针按顺序进行 6 种方式的比较，每次比较后会移动指针，6 种分别为：
    1. 当前**旧**节点**头**指针处是否有节点，没有时，头指针向右移一位。
    2. 当前**旧**节点**尾**指针处是否有节点，没有时，尾指针向左移一位。
    3. **新旧节点的头指针进行对比**，匹配时保持当前 `DOM` 结构不变，**将新旧节点的头指针右移一个单位**
       <br>
    4. **新旧节点的尾指针进行对比**，匹配时保持当前 `DOM` 结构不变，**将新旧节点的尾指针左一个单位**
       <br>
    5. **新**节点的**尾**指针与**旧**节点的**头**指针进行对比。匹配时，将**旧**节点的**头**指针指向的节点的 _DOM_ 元素插入到尾指针指向的节点的 _DOM_ 元素之后。**同时新节点尾指左移一个单位，旧节点头指针右移一个单位**。
       <br>
    6. **新**节点的**头**指针与**旧**节点的**尾**指针进行对比。匹配时，将**旧**节点的**尾**指针指向的节点的 _DOM_ 元素插入到**头**指针指向的节点的 _DOM_ 元素之前。**同时新节点头指针右移一个单位，旧节点尾指针左移一个单位**。
       <br>
3. 如果 4 中方式的比较都没有相同的节点，则按下面三个方法来更新(**执行完毕后新节点头指针向右移动一位**)：
    1. 按旧节点的子节点的`key`值来生成一个`hash`表，每个`key`值对应其`VNode`节点，在查看当前新节点的头指针指向的`VNode`的`key`是否存在于`hash`表中，**存在则插入到旧节点头指针所对应的元素之前**，**并移除这个同类型的旧节点**。
       <br>
    2. 如果没有时，就查询旧节点两个指针之间是否存在一个`VNode`对象与新节点头指针执行的`VNode`相等，**相等则插入到旧节点头指针所对应的元素之前**，**并移除这个同类型的旧节点**。
        > 此处移除节点的原因是为了防止在最后处理未处理的节点时，重复处理该节点
    3. 否则在旧节点头指针所对应的元素之前新创建一个元素。
       <br>
4. 当新旧节点的指针任意一对相交(**超过**)时，结束比较。
5. 此时根据新旧序列谁完成的交叉判定处理新增节点还是卸载旧节点
    1. 旧节点完成的交叉，则说明可能新节点还有部分没有遍历完毕，需要进行新增
    2. 新节点完成的交叉，则说明旧节点可能还有部分没有遍历完毕，需要卸载

对于步骤`5`，其表示在主流程结束，对剩余未交叉的序列进行检查：

1. 如果旧节点先进行交叉，那么其会检查还未遍历的新节点序列(即`newStartIdx <-> newEndIdx`之间)，对它们调用`addVnodes()`函数进行新节点创建：

```js
// 旧序列已经相交
if (oldStartIdx > oldEndIdx) {
    refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
    addVnodes(
        parentElm,
        refElm,
        newCh,
        newStartIdx,
        newEndIdx,
        insertedVnodeQueue
    )
}

function addVnodes(
    parentElm,
    refElm,
    vnodes,
    startIdx,
    endIdx,
    insertedVnodeQueue
) {
    // 遍历未遍历的序列间，进行新增节点
    for (; startIdx <= endIdx; ++startIdx) {
        createElm(
            vnodes[startIdx],
            insertedVnodeQueue,
            parentElm,
            refElm,
            false,
            vnodes,
            startIdx
        )
    }
}
```

2. 如果新节点发生了相交，那么遍历旧节点未遍历的区间(即`oldStartIdx <-> oldEndIdx`)，将不存在的节点移除。

```js
// 旧节点未相交，新节点相交了，将未处理的旧节点卸载了
else if (newStartIdx > newEndIdx) {
    removeVnodes(oldCh, oldStartIdx, oldEndIdx)
}

function removeVnodes(vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
        var ch = vnodes[startIdx]
        if (isDef(ch)) {
            if (isDef(ch.tag)) {
                removeAndInvokeRemoveHook(ch)
                invokeDestroyHook(ch)
            } else {
                // Text node
                removeNode(ch.elm)
            }
        }
    }
}
```

现在给出如下图的一个例子：

![步骤1](./img/step1.png)

在最开始新旧节点的指针为：

```js
;(oldStartIdx = c), (oldEndIdx = b)
;(newStartIdx = a), (newEndIdx = d)
```

由于任何指针的指向节点都不匹配，所以按旧节点头尾两个指针的全部节点的`key`值，生成一个`Map`：

```js
// 伪代码
const map = {
    a: VNode a,
    d: VNode d
}
```

根据`Map`，我们知道旧节点队列中存在一个`VNode`与新节点队列中`a`的`key`值一样，那么我们将其对应的`DOM`元素直接取出，然后将其插入到`oldStartIdx`指针对应元素的之前，此时将旧的`a`节点移除，然后`newStartIdx`指针向右移动一个单位，此时应该如下图所示：

![步骤2](./img/step2.png)

此时的指针和节点为：

```js
;(newStartIdx = b), (newEndIdx = d)
;(oldStartIdx = c), (oldEndIdx = b)
```

然后，4 个指针进行对比，可得知`newStartIdx = oldEndIdx`, 此时将`oldEndIdx`节点对应的元素插入到`oldStartIdx`指针对应的元素之前即可，然后匹配的两个指针分别向中间移动一位，如图：

![步骤三](./img/step3.png)

此时的指针对应的节点为：

```js
;(oldStartIdx = c), (oldEndIdx = d)
;(newStartIdx = c), (newEndIdx = d)
```

之后，4 个指针进行对比，两个的头指针都相等，所以不需要替换 _DOM_ 元素直接将匹配的指针进行移动即可：

![步骤四](./img/step4.png)

此时的指针对应的节点为：

```js
;(oldStartIdx = undefined), (oldEndIdx = d)
;(newStartIdx = d), (newEndIdx = d)
```

此时由于`oldStartIdx`指向已删除的`a`节点，所以此时`oldStartIdx`向右移一位：

![步骤五](./img/step5.png)

最后，`4`个指针进行对比， 新旧头指针相等，因此跳过，新旧头指针向右移一位：

![步骤六](./img/step6.png)

至此，新旧指针头尾同时发生交叉，主流程结束。

虽然两个指针都交叉了，但由于先检查的旧指针的交叉状况，所以需要进入`addVnodes()`函数对是否需要新增节点进行检查，由于新增节点肯定是位于`newStartIdx <-> newEndIdx`之间的，但其已经超界了，所以此处不需要新增节点。

到此为止整个`patch()`流程就结束了。

接下来用流程图总结下整个`diff`的过程：
![diff流程](./img/patch.svg)
