/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode, {
    cloneVNode
} from './vnode'
import config from '../config'
import {
    SSR_ATTR
} from 'shared/constants'
import {
    registerRef
} from './modules/ref'
import {
    traverse
} from '../observer/traverse'
import {
    activeInstance
} from '../instance/lifecycle'
import {
    isTextInputType
} from 'web/util/element'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    makeMap,
    isRegExp,
    isPrimitive
} from '../util/index'

export const emptyNode = new VNode('', {}, [])

const hooks = ['create', 'activate', 'update', 'remove', 'destroy'];

function sameVnode(a, b) {

    // 当两个节点的key、tag、是否为注释、data是否定义、input类型是否相同
    return (
        a.key === b.key && (
            (
                a.tag === b.tag &&
                a.isComment === b.isComment &&
                isDef(a.data) === isDef(b.data) &&
                sameInputType(a, b)
            ) || (
                isTrue(a.isAsyncPlaceholder) &&
                a.asyncFactory === b.asyncFactory &&
                isUndef(b.asyncFactory.error)
            )
        )
    )
}

function sameInputType(a, b) {
    if (a.tag !== 'input') return true
    let i
    const typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type
    const typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type
    return typeA === typeB || isTextInputType(typeA) && isTextInputType(typeB)
}

function createKeyToOldIdx(children, beginIdx, endIdx) {
    let i, key
    const map = {}
    for (i = beginIdx; i <= endIdx; ++i) {
        key = children[i].key
        if (isDef(key)) map[key] = i
    }
    return map
}

export function createPatchFunction(backend) {
    let i, j
    const cbs = {}

    // 取出其中的操作节点与dom的方法
    const {
        modules,
        nodeOps
    } = backend;

    // 遍历钩子函数，为每个钩子函数添加其期间对属性的处理函数
    for (i = 0; i < hooks.length; ++i) {

        // 为每个生命周期初始化一个数组队列
        cbs[hooks[i]] = [];

        // 向该生命周期的任务队列中添加处理该周期内处理属性的方法
        // 只有create/update/destroy三个周期存在
        for (j = 0; j < modules.length; ++j) {
            if (isDef(modules[j][hooks[i]])) {
                cbs[hooks[i]].push(modules[j][hooks[i]]);
            }
        }
    }

    function emptyNodeAt(elm) {

        // 返回一个同挂载元素相同的VNode节点，但无children属性
        return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
    }

    function createRmCb(childElm, listeners) {
        function remove() {

            // 当remove函数数量为1时，立即移除childElm
            if (--remove.listeners === 0) {
                removeNode(childElm)
            }
        }

        // 确定remove函数的数量
        remove.listeners = listeners;

        // 返回移除函数
        return remove;
    }

    function removeNode(el) {

        // 其父节点
        const parent = nodeOps.parentNode(el);

        // element may have already been removed due to v-html / v-text
        // 元素可能因为v-html/v-text的原因，已经被移除了
        if (isDef(parent)) {

            // 移除对应的元素
            nodeOps.removeChild(parent, el)
        }
    }

    function isUnknownElement(vnode, inVPre) {
        return (
            // 不处于v-pre中
            !inVPre &&

            // 不具有命名空间
            !vnode.ns &&

            // 用户是否设置了要忽略的自定义元素
            !(
                config.ignoredElements.length &&
                config.ignoredElements.some(ignore => {
                    return isRegExp(ignore) ?
                        ignore.test(vnode.tag) :
                        ignore === vnode.tag
                })
            ) &&

            // 查询是否为未注册的自定义元素
            config.isUnknownElement(vnode.tag)
        )
    }

    // 声明一个用于记录有多少正处于创建中的v-pre节点
    let creatingElmInVPre = 0

    function createElm(

        // 新的VNode节点
        vnode,
        insertedVnodeQueue,

        // 旧节点的父元素(这里一定是元素节点)
        parentElm,

        // 旧节点的下一个节点，用作插入节点时的位置标记
        refElm,
        nested,
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
            vnode = ownerArray[index] = cloneVNode(vnode)
        }

        // 作为transition的入口检查
        // 该节点是否为当前组件的根VNode节点
        vnode.isRootInsert = !nested; // for transition enter check

        // 是否为组件，是则创建组件实例
        if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
            return
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

                // 是否为未知的元素
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
            setScope(vnode);

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

    function initComponent(vnode, insertedVnodeQueue) {

        // 是否存在等待插入的队列(组件根节点上的)，如果有则全部加入insertedVNodeQueue中
        if (isDef(vnode.data.pendingInsert)) {
            insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
            vnode.data.pendingInsert = null
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

    function isPatchable(vnode) {

        // 为组件标签时，
        while (vnode.componentInstance) {

            // 继续获取最顶层的真实DOM根元素VNode
            vnode = vnode.componentInstance._vnode
        }

        // 是否定义有标签
        return isDef(vnode.tag);
    }

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
                if (isDef(i = ancestor.context) && isDef(i = i.$options._scopeId)) {

                    // 有则设置同意的作用域属性
                    nodeOps.setStyleScope(vnode.elm, i)
                }
                ancestor = ancestor.parent
            }
        }

        // for slot content they should also get the scopeId from the host instance.
        // 对于插槽中的内容，它们也需要添加当前vm实例的scoped属性
        if (isDef(i = activeInstance) &&
            i !== vnode.context &&
            i !== vnode.fnContext &&
            isDef(i = i.$options._scopeId)
        ) {
            nodeOps.setStyleScope(vnode.elm, i)
        }
    }

    function addVnodes(parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {
        for (; startIdx <= endIdx; ++startIdx) {
            createElm(vnodes[startIdx], insertedVnodeQueue, parentElm, refElm, false, vnodes, startIdx)
        }
    }

    function invokeDestroyHook(vnode) {
        let i, j;

        // 取出节点的属性
        const data = vnode.data;

        // 如果存在
        if (isDef(data)) {

            // 调用其destroy()钩子函数
            if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode);

            // 调用module中的destroy()钩子函数
            for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
        }

        // 递归遍历子节点调用该函数。
        if (isDef(i = vnode.children)) {
            for (j = 0; j < vnode.children.length; ++j) {
                invokeDestroyHook(vnode.children[j])
            }
        }
    }

    // 移除startIdx~endIdx间的VNode
    function removeVnodes(parentElm, vnodes, startIdx, endIdx) {

        // 从左到右移除
        for (; startIdx <= endIdx; ++startIdx) {
            const ch = vnodes[startIdx];
            if (isDef(ch)) {

                // 移除元素
                if (isDef(ch.tag)) {
                    removeAndInvokeRemoveHook(ch);
                    invokeDestroyHook(ch);

                // 移除文本节点
                } else { // Text node
                    removeNode(ch.elm);
                }
            }
        }
    }

    function removeAndInvokeRemoveHook(vnode, rm) {

        // 确认是否为元素或组件节点(非文本节点或空节点)
        if (isDef(rm) || isDef(vnode.data)) {
            let i;

            // remove函数的数量(这里虽然cbs中只有一个，但是下面会创建另一个)
            const listeners = cbs.remove.length + 1;

            // 是否为递归调用
            if (isDef(rm)) {

                // we have a recursively passed down rm callback
                // increase the listeners count
                // 递归调用时，增加remove函数的数量
                rm.listeners += listeners
            } else {

                // directly removing
                // 创建remove函数，当listeners为1时，调用最终的移除函数移除元素
                rm = createRmCb(vnode.elm, listeners)
            }

            // recursively invoke hooks on child component root node
            // 如果当VNode节点为组件节点，那么递归对该组件实例调用
            if (isDef(i = vnode.componentInstance) && isDef(i = i._vnode) && isDef(i.data)) {
                removeAndInvokeRemoveHook(i, rm)
            }

            // 调用全部remove函数
            for (i = 0; i < cbs.remove.length; ++i) {
                cbs.remove[i](vnode, rm)
            }

            // 如果VNode节点自带remove hook，那么调用它
            if (isDef(i = vnode.data.hook) && isDef(i = i.remove)) {

                // 这里要传入rm函数，让其调用来计算remove数量
                i(vnode, rm)
            } else {

                // 或则调用rm()函数
                rm();
            }

        // 没有Hook函数时，直接移除即可
        } else {
            removeNode(vnode.elm)
        }
    }

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
            } else if (sameVnode(oldStartVnode, newStartVnode)) {

                // 当新旧节点头指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针右移
                patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)
                oldStartVnode = oldCh[++oldStartIdx]
                newStartVnode = newCh[++newStartIdx]
            } else if (sameVnode(oldEndVnode, newEndVnode)) {

                // 当新旧节点尾指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针左移
                patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue, newCh, newEndIdx)
                oldEndVnode = oldCh[--oldEndIdx]
                newEndVnode = newCh[--newEndIdx]
            } else if (sameVnode(oldStartVnode, newEndVnode)) {

                // 当新节点头指针，与旧节点尾指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针向内部移动
                patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue, newCh, newEndIdx)

                // 将旧节点尾指针指向的元素插入到当前旧节点尾指针指向的元素之前
                canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
                oldStartVnode = oldCh[++oldStartIdx]
                newEndVnode = newCh[--newEndIdx]
            } else if (sameVnode(oldEndVnode, newStartVnode)) {

                // 当新节点尾指针，与旧节点头指针指向的节点大致相同时，对其进行打补丁更新，然后双方指针向内部移动
                patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue, newCh, newStartIdx)

                // 将旧节点尾指针指向的元素插入到当前旧节点头指针指向的元素之前
                canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
                oldEndVnode = oldCh[--oldEndIdx]
                newStartVnode = newCh[++newStartIdx]
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

                    // 先对比其是否大致相同，相同时对其打补丁更新，情况hash表中对应的节点
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
        if (oldStartIdx > oldEndIdx) {
            refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
            addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
        } else if (newStartIdx > newEndIdx) {
            removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
        }
    }

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

    function findIdxInOld(node, oldCh, start, end) {
        for (let i = start; i < end; i++) {
            const c = oldCh[i]
            if (isDef(c) && sameVnode(node, c)) return i
        }
    }

    function patchVnode(
        oldVnode,
        vnode,
        insertedVnodeQueue,
        ownerArray,
        index,
        removeOnly
    ) {

        // 如果是同一节点，直接返回不做更改
        if (oldVnode === vnode) {
            return
        }

        if (isDef(vnode.elm) && isDef(ownerArray)) {
            // clone reused vnode
            vnode = ownerArray[index] = cloneVNode(vnode)
        }

        // 获取旧节点元素，并赋值给新节点
        const elm = vnode.elm = oldVnode.elm

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
        if (isTrue(vnode.isStatic) &&
            isTrue(oldVnode.isStatic) &&
            vnode.key === oldVnode.key &&
            (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
        ) {
            vnode.componentInstance = oldVnode.componentInstance
            return
        }

        let i
        const data = vnode.data
        if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
            i(oldVnode, vnode)
        }

        const oldCh = oldVnode.children
        const ch = vnode.children
        if (isDef(data) && isPatchable(vnode)) {
            for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
            if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
        }
        if (isUndef(vnode.text)) {
            if (isDef(oldCh) && isDef(ch)) {
                if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
            } else if (isDef(ch)) {
                if (process.env.NODE_ENV !== 'production') {
                    checkDuplicateKeys(ch)
                }
                if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
                addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
            } else if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1)
            } else if (isDef(oldVnode.text)) {
                nodeOps.setTextContent(elm, '')
            }
        } else if (oldVnode.text !== vnode.text) {
            nodeOps.setTextContent(elm, vnode.text)
        }
        if (isDef(data)) {
            if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
        }
    }

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

    // 是否对DOM元素进行注水（修饰）
    let hydrationBailed = false;

    // list of modules that can skip create hook during hydration because they
    // are already rendered on the client or has no need for initialization
    // Note: style is excluded because it relies on initial clone for future
    // deep updates (#7063).
    // 服务器渲染问题：下列属性在注水期间可以跳过上述module中create中的钩子函数，因为它们
    // 已经在客户端渲染过了或没有必要进行初始化。
    // 注意：style属性除外因为它依赖初始化的克隆来进一步的更新
    const isRenderedModule = makeMap('attrs,class,staticClass,staticStyle,key');

    // Note: this is a browser-only function so we can assume elms are DOM nodes.
    function hydrate(elm, vnode, insertedVnodeQueue, inVPre) {
        let i
        const {
            tag,
            data,
            children
        } = vnode
        inVPre = inVPre || (data && data.pre)
        vnode.elm = elm

        if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
            vnode.isAsyncPlaceholder = true
            return true
        }
        // assert node match
        if (process.env.NODE_ENV !== 'production') {
            if (!assertNodeMatch(elm, vnode, inVPre)) {
                return false
            }
        }
        if (isDef(data)) {
            if (isDef(i = data.hook) && isDef(i = i.init)) i(vnode, true /* hydrating */ )
            if (isDef(i = vnode.componentInstance)) {
                // child component. it should have hydrated its own tree.
                initComponent(vnode, insertedVnodeQueue)
                return true
            }
        }
        if (isDef(tag)) {
            if (isDef(children)) {
                // empty element, allow client to pick up and populate children
                if (!elm.hasChildNodes()) {
                    createChildren(vnode, children, insertedVnodeQueue)
                } else {
                    // v-html and domProps: innerHTML
                    if (isDef(i = data) && isDef(i = i.domProps) && isDef(i = i.innerHTML)) {
                        if (i !== elm.innerHTML) {
                            /* istanbul ignore if */
                            if (process.env.NODE_ENV !== 'production' &&
                                typeof console !== 'undefined' &&
                                !hydrationBailed
                            ) {
                                hydrationBailed = true
                                console.warn('Parent: ', elm)
                                console.warn('server innerHTML: ', i)
                                console.warn('client innerHTML: ', elm.innerHTML)
                            }
                            return false
                        }
                    } else {
                        // iterate and compare children lists
                        let childrenMatch = true
                        let childNode = elm.firstChild
                        for (let i = 0; i < children.length; i++) {
                            if (!childNode || !hydrate(childNode, children[i], insertedVnodeQueue, inVPre)) {
                                childrenMatch = false
                                break
                            }
                            childNode = childNode.nextSibling
                        }
                        // if childNode is not null, it means the actual childNodes list is
                        // longer than the virtual children list.
                        if (!childrenMatch || childNode) {
                            /* istanbul ignore if */
                            if (process.env.NODE_ENV !== 'production' &&
                                typeof console !== 'undefined' &&
                                !hydrationBailed
                            ) {
                                hydrationBailed = true
                                console.warn('Parent: ', elm)
                                console.warn('Mismatching childNodes vs. VNodes: ', elm.childNodes, children)
                            }
                            return false
                        }
                    }
                }
            }
            if (isDef(data)) {
                let fullInvoke = false
                for (const key in data) {
                    if (!isRenderedModule(key)) {
                        fullInvoke = true
                        invokeCreateHooks(vnode, insertedVnodeQueue)
                        break
                    }
                }
                if (!fullInvoke && data['class']) {
                    // ensure collecting deps for deep class bindings for future updates
                    traverse(data['class'])
                }
            }
        } else if (elm.data !== vnode.text) {
            elm.data = vnode.text
        }
        return true
    }

    function assertNodeMatch(node, vnode, inVPre) {
        if (isDef(vnode.tag)) {
            return vnode.tag.indexOf('vue-component') === 0 || (
                !isUnknownElement(vnode, inVPre) &&
                vnode.tag.toLowerCase() === (node.tagName && node.tagName.toLowerCase())
            )
        } else {
            return node.nodeType === (vnode.isComment ? 8 : 3)
        }
    }

    return function patch(oldVnode, vnode, hydrating, removeOnly) {

        // 如果当前节点已经不存在，则直接销毁旧节点并返回。
        if (isUndef(vnode)) {

            // 如果之前存在节点，那么直接调用该节点及其子节点的destroy()钩子函数
            if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
            return
        }

        // 是否为初始化的打补丁
        let isInitialPatch = false;

        // 待调用insert函数的VNode队列
        const insertedVnodeQueue = [];

        // 之前不存在节点时，即新生成了节点
        if (isUndef(oldVnode)) {

            // empty mount (likely as component), create new root element
            // 凭空挂载，比如创建组件时，直接创建一个根的DOM元素
            // 改变状态为初始化补丁状态。
            isInitialPatch = true;

            // 为VNode创建元素，并创建其所有子元素
            createElm(vnode, insertedVnodeQueue);
        } else {

            // 是否为正的元素(VNode不具有nodeType属性)
            const isRealElement = isDef(oldVnode.nodeType);

            // 当旧节点不为元素时，对比新旧节点其他信息是否相同符合同一节点类型
            if (!isRealElement && sameVnode(oldVnode, vnode)) {

                // patch existing root node
                // 当新旧节点被判定为同一VNode节点时，调用patchVnode更新DOM
                patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
            } else {

                // 当旧节点为真实的dom元素时
                if (isRealElement) {

                    // mounting to a real element
                    // check if this is server-rendered content and if we can perform
                    // a successful hydration.
                    // 挂载到一个真实的元素上。
                    // 检查是否为服务器渲染，来决定我们是否能进行一个成功的hydration行为
                    if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
                        oldVnode.removeAttribute(SSR_ATTR);

                        // 确认执行hydration行为
                        hydrating = true;
                    }

                    // 确认为服务器渲染，可以进行hydrate
                    if (isTrue(hydrating)) {
                        if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
                            invokeInsertHook(vnode, insertedVnodeQueue, true);
                            return oldVnode;
                        } else if (process.env.NODE_ENV !== 'production') {
                            warn(
                                'The client-side rendered virtual DOM tree is not matching ' +
                                'server-rendered content. This is likely caused by incorrect ' +
                                'HTML markup, for example nesting block-level elements inside ' +
                                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                                'full client-side render.'
                            )
                        }
                    }

                    // either not server-rendered, or hydration failed.
                    // create an empty node and replace it
                    // 无论是否为服务器渲染或hydration失败，
                    // 都创建一个代表该元素的空的VNode节点代替dom元素
                    oldVnode = emptyNodeAt(oldVnode);
                }

                // replacing existing element
                // 获取旧节点的DOM元素
                const oldElm = oldVnode.elm;

                // 获取该元素的父节点
                const parentElm = nodeOps.parentNode(oldElm);

                // create new node
                createElm(
                    vnode,
                    insertedVnodeQueue,
                    // extremely rare edge case: do not insert if old element is in a
                    // leaving transition. Only happens when combining transition +
                    // keep-alive + HOCs. (#4590)
                    oldElm._leaveCb ? null : parentElm,
                    nodeOps.nextSibling(oldElm)
                );

                // update parent placeholder node element, recursively
                // 递归更新父级的占位符元素节点
                if (isDef(vnode.parent)) {
                    let ancestor = vnode.parent;
                    const patchable = isPatchable(vnode);
                    while (ancestor) {
                        for (let i = 0; i < cbs.destroy.length; ++i) {
                            cbs.destroy[i](ancestor);
                        }
                        ancestor.elm = vnode.elm;
                        if (patchable) {
                            for (let i = 0; i < cbs.create.length; ++i) {
                                cbs.create[i](emptyNode, ancestor);
                            }
                            // #6513
                            // invoke insert hooks that may have been merged by create hooks.
                            // e.g. for directives that uses the "inserted" hook.
                            const insert = ancestor.data.hook.insert;
                            if (insert.merged) {
                                // start at index 1 to avoid re-invoking component mounted hook
                                for (let i = 1; i < insert.fns.length; i++) {
                                    insert.fns[i]();
                                }
                            }
                        } else {
                            registerRef(ancestor);
                        }
                        ancestor = ancestor.parent;
                    }
                }

                // destroy old node
                // 直接销毁旧元素节点和vnode
                if (isDef(parentElm)) {

                    // 移除该元素，并调用其destroy钩子函数
                    removeVnodes(parentElm, [oldVnode], 0, 0);

                // 如果未挂载元素，那么直接调用其destroy()钩子函数
                } else if (isDef(oldVnode.tag)) {
                    invokeDestroyHook(oldVnode);
                }
            }
        }

        // 为insertedVNodeQueue中的VNode调用其insert周期的函数
        invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);

        // 返回根节点的元素
        return vnode.elm;
    }
}