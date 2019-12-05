# 入场过渡

首先是入场过渡，它会在元素被添加到`DOM`时开始执行过渡，而元素被添加到`DOM`也有两种方式：

- `activate`：动态组件被激活时
- `created`：`DOM`元素生成时

这两个阶段都是调用的同一个函数`_enter()`:

```js
function _enter(_: any, vnode: VNodeWithData) {

    // 仅当其未进行显示时才调用enter函数
    if (vnode.data.show !== true) {

        // 调用enter函数，对element进行过渡操作
        enter(vnode);
    }
}
```

该函数在确保元素未显示(`.show !== true`)的情况下调用模块内部的`enter()`方法开始执行一系列的动画操作。

## enter()——执行入场动画

该函数集成了所有对动画的处理，所以说比较复杂。用户可以通过`css`或`js`来对`<transition>`所包含的元素进行动画操作，碍于函数的长度，我们通过截取代码片段来学习(即下面这部分代码仅供快速浏览和对比，好来查找之后代码片段具体所在的部分)：

```js
function enter(vnode: VNodeWithData,  : ? () => void) {

    // 获取要进行动画节点的元素
    const el: any = vnode.elm;

    // call leave callback now
    // 是否有离开的回调函数，有则调用
    if (isDef(el._leaveCb)) {
        el._leaveCb.cancelled = true
        el._leaveCb()
    }

    // 获取transition标签上的属性，对其进行处理
    const data = resolveTransition(vnode.data.transition);

    // 如果没有transition属性，则直接返回
    if (isUndef(data)) {
        return
    }

    // 如果有定义进入时的函数，或不为元素节点，则直接退出
    if (isDef(el._enterCb) || el.nodeType !== 1) {
        return;
    }

    // 提取其transition中的具体的属性
    const {
        css,

        // Vue需要监听的过渡类型
        type,
        enterClass,
        enterToClass,
        enterActiveClass,
        appearClass,
        appearToClass,
        appearActiveClass,
        beforeEnter,
        enter,
        afterEnter,
        enterCancelled,
        beforeAppear,
        appear,
        afterAppear,
        appearCancelled,
        duration
    } = data;

    // activeInstance will always be the <transition> component managing this
    // transition. One edge case to check is when the <transition> is placed
    // as the root node of a child component. In that case we need to check
    // <transition>'s parent for appear check.
    // 当前的vm实例总会成了组件来管理<transition>的过渡。一个边缘情况是，当<transition>
    // 作为一个子组件的根VNode节点时，我们需要查找其父节点
    let context = activeInstance;

    // 获取当前vm实例的根节点
    let transitionNode = activeInstance.$vnode;

    // 一直向上查找，直到找到transition所在的上下文vm实例
    while (transitionNode && transitionNode.parent) {
        context = transitionNode.context;
        transitionNode = transitionNode.parent;
    }

    // 是否需要初始化渲染，需要初始化渲染即vm实例还未挂载DOM上或当前动画节点不为根节点
    const isAppear = !context._isMounted || !vnode.isRootInsert;

    // 如果已经显示且未指定在初始渲染时使用过渡或初始渲染函数，则直接返回
    if (isAppear && !appear && appear !== '') {
        return;
    }

    // 仅在需要初始化渲染且存在appear类取用appear类，默认使用css类
    const startClass = isAppear && appearClass ?
        appearClass : enterClass;
    const activeClass = isAppear && appearActiveClass ?
        appearActiveClass : enterActiveClass;
    const toClass = isAppear && appearToClass ?
        appearToClass : enterToClass;

    // 优先取用appear类型的过渡函数，默认使用css类过渡函数
    const beforeEnterHook = isAppear ?
        (beforeAppear || beforeEnter) : beforeEnter;

    // enter函数优先取appear中定义的，没有则取用enter定义的
    const enterHook = isAppear ?
        (typeof appear === 'function' ? appear : enter) : enter;
    const afterEnterHook = isAppear ?
        (afterAppear || afterEnter) : afterEnter;
    const enterCancelledHook = isAppear ?
        (appearCancelled || enterCancelled) : enterCancelled;

    // 计算动画时间(ms)，这里可以为进入动画和离开动画分别指定时间
    const explicitEnterDuration: any = toNumber(
        isObject(duration) ? duration.enter : duration );

    // 检查定义的动画时间间隔是否合法
    if (process.env.NODE_ENV !== 'production' && explicitEnterDuration != null) {
        checkDuration(explicitEnterDuration, 'enter', vnode)
    }

    // 是否使用css动画(指定css为false或IE9时不使用)
    const expectsCSS = (css !== false) && !isIE9;

    // 获取进入时动画的钩子函数的参数数量(大于1个，则表明用户想通过该参数操作)
    const userWantsControl = getHookArgumentsLength(enterHook);

    // 给元素添加一次性的进入时动画的函数
    const cb = el._enterCb = once(() => {

        // 执行css动画时，移除enter-to与enter-active的class
        if (expectsCSS) {
            removeTransitionClass(el, toClass);
            removeTransitionClass(el, activeClass);
        }

        // 如果该回调被取消，则直接移除enter的class
        if (cb.cancelled) {
            if (expectsCSS) {
                removeTransitionClass(el, startClass)
            }

            // 并执行取消的回调函数
            enterCancelledHook && enterCancelledHook(el)
        } else {

            // 没被取消时，则直接调用after-enter的回调函数
            afterEnterHook && afterEnterHook(el)
        }

        // 清空进入时的回调函数
        el._enterCb = null
    });

    // 节点是否显示
    if (!vnode.data.show) {

        // remove pending leave element on enter by injecting an insert hook
        // 注入一个insert钩子函数来移除准备要在进入动画时移除的元素
        // 想该VNode的hook对象中insert钩子函数中封装并添加一个函数
        mergeVNodeHook(vnode, 'insert', () => {
            const parent = el.parentNode
            const pendingNode = parent && parent._pending && parent._pending[vnode.key]
            if (pendingNode &&
                pendingNode.tag === vnode.tag &&
                pendingNode.elm._leaveCb
            ) {
                pendingNode.elm._leaveCb()
            }
            enterHook && enterHook(el, cb)
        })
    }

    // start enter transition
    // 开始进入的动画，调用用户定义的beforeEnter函数
    beforeEnterHook && beforeEnterHook(el);

    // 根据是否使用css样式来决定之后的操作
    if (expectsCSS) {

        // 添加enter与enter-acitve的class
        addTransitionClass(el, startClass);
        addTransitionClass(el, activeClass);

        // 在下一次屏幕刷新时，移除enter的class
        nextFrame(() => {
            removeTransitionClass(el, startClass);

            // 如果没有取消，则添加剩余的动画class
            if (!cb.cancelled) {

                // 添加enter-to的class
                addTransitionClass(el, toClass);

                // 此时，如果用户不想操作动画，则在动画执行完的时间间隔后，执行刚才的cb
                if (!userWantsControl) {

                    // 当进入动画指定间隔时间时，在间隔时间后移除enter系列的所有class
                    if (isValidDuration(explicitEnterDuration)) {
                        setTimeout(cb, explicitEnterDuration);

                    // 否则，自动侦测过渡类型并执行动画
                    } else {
                        whenTransitionEnds(el, type, cb)
                    }
                }
            }
        })
    }

    // 如果VNode节点已经显示
    if (vnode.data.show) {
        toggleDisplay && toggleDisplay();

        // 执行进入的钩子函数
        enterHook && enterHook(el, cb)
    }

    // 若不使用css，且用户对js动画函数不进行额外的控制，则直接调用回调，执行之后的回调函数
    if (!expectsCSS && !userWantsControl) {
        cb()
    }
}
```

### 阶段1——处理参数

首先进入动画时，先查看元素是否已经注册了离开的过渡**完成后**的回调函数，如果有则说明该元素正在执行离开的过渡动画但未执行最后的完成回调。此时直接取消原本时间后的回调函数并立刻执行来结束。(`_leaveCb`在过渡的离开阶段才会定义)

```js
// 获取要进行动画节点的元素
const el: any = vnode.elm;

// call leave callback now
// 是否有离开的回调函数，有则调用
if (isDef(el._leaveCb)) {
    el._leaveCb.cancelled = true;
    el._leaveCb()
}
```

之后便是调用[`resolveTransition()`](../工具方法/README.md#resolvetransition%e5%a4%84%e7%90%86%e6%8a%bd%e8%b1%a1%e7%bb%84%e4%bb%b6%e4%b8%ad%e7%9a%84%e5%b1%9e%e6%80%a7)函数来将用户定义在`<transition>`标签上的各种属性处理后整合到一个对象中(这些属性虽然定义在`<transition>`组件上，但会被处理到`<transition>`组件内的非抽象根元素的`.transition`上)

```js
// 获取transition标签上的属性，对其进行处理
const data = resolveTransition(vnode.data.transition);

// 如果没有transition属性，则直接返回
if (isUndef(data)) {
    return
}

// 如果有定义进入时的函数，或不为元素节点，则直接退出
if (isDef(el._enterCb) || el.nodeType !== 1) {
    return;
}
```

若未有任何关于`<transition>`组件的属性，则直接返回，说明没有该组件的参与，同时如果已挂载了`._enterCb`则说明已经调用过该函数，但未处理完，那么直接返回防止重复调用。
____
之后便是对刚刚提取的属性的单独提取：

```js
// 提取其transition中的具体的属性
const {
    css,

    // Vue需要监听的过渡类型
    type,
    enterClass,
    enterToClass,
    enterActiveClass,
    appearClass,
    appearToClass,
    appearActiveClass,
    beforeEnter,
    enter,
    afterEnter,
    enterCancelled,
    beforeAppear,

    // 是否在初始渲染时执行效果，指定函数或布尔值
    appear,
    afterAppear,
    appearCancelled,

    // 动画时间
    duration
} = data;
```

具体属性的函数建议[立即阅读我们的文档.jpg](https://cn.vuejs.org/v2/api/#transition)

之后便是对`<transition>`组件所处的上下文的确认，我们要确保其所在的上下文是否已经在`DOM`中挂载，或需不需要在初始渲染中使用过渡效果。

```js
// activeInstance will always be the <transition> component managing this
// transition. One edge case to check is when the <transition> is placed
// as the root node of a child component. In that case we need to check
// <transition>'s parent for appear check.
// 当前的vm实例总会成了组件来管理<transition>的过渡。一个边缘情况是，当<transition>
// 作为一个子组件的根VNode节点时，我们需要查找其父节点
let context = activeInstance;

// 获取当前vm实例的根节点
let transitionNode = activeInstance.$vnode;

// 一直向上查找，直到找到transition所在的上下文vm实例
while (transitionNode && transitionNode.parent) {
    context = transitionNode.context;
    transitionNode = transitionNode.parent;
}

// 是否需要初始化渲染，需要初始化渲染即vm实例还未挂载DOM上或当前动画节点不为根节点
const isAppear = !context._isMounted || !vnode.isRootInsert;

// 如果已经显示且未指定在初始渲染时使用过渡或初始渲染函数，则直接返回
if (isAppear && !appear && appear !== '') {
    return;
}
```

通过上面这一小截代码我们可以看到，`<transition>`组件会归属到包含其的`vm`实例中管理，且未特殊指明`appear`属性，它不会在初始化渲染时进行过渡时。

接下来便是对`css-class`或`js`回调函数的处理，在同时定义`appear`类型和普通类型的过渡时，优先取用`appear`类型的过渡；优先在初始化渲染时使用`appear`类的`class`

```js
// 仅在需要初始化渲染且存在appear类取用appear类，默认使用css类
const startClass = (isAppear && appearClass) ?
    appearClass : enterClass;
const activeClass = (isAppear && appearActiveClass) ?
    appearActiveClass : enterActiveClass;
const toClass = (isAppear && appearToClass) ?
    appearToClass : enterToClass;

// 优先取用appear类型的过渡函数，默认使用css类过渡函数
const beforeEnterHook = isAppear ?
    (beforeAppear || beforeEnter) : beforeEnter;

    // enter函数优先取appear中定义的，没有则取用enter定义的
const enterHook = isAppear ?
    (typeof appear === 'function' ? appear : enter) : enter;
const afterEnterHook = isAppear ?
    (afterAppear || afterEnter) : afterEnter;
const enterCancelledHook = isAppear ?
    (appearCancelled || enterCancelled) : enterCancelled;

// 计算动画时间(ms)，这里可以为进入动画和离开动画分别指定时间
const explicitEnterDuration: any = toNumber(
    isObject(duration) ? duration.enter : duration );

// 检查定义的动画时间间隔是否合法
if (process.env.NODE_ENV !== 'production' && explicitEnterDuration != null){
    checkDuration(explicitEnterDuration, 'enter', vnode)
}

// 是否使用css动画(指定css为false或IE9时不使用)
const expectsCSS = (css !== false) && !isIE9;
```

>这里说个题外话，上面对于css-class的选择，使用的运算符为&&和三元运算符，当两者一起使用时，[&&的优先级大于三元运算符](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Operator_Precedence)，靠下面这个小例子可以说明:

```js
let a = 'a',
    b = 'b',
    c = undefined,
    d = c && a ? a : b;
// d为'b'，如果三元运算符优先级大于&&则d为undefined
```