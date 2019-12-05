/* @flow */

import {
    inBrowser,
    isIE9,
    warn
} from 'core/util/index'
import {
    mergeVNodeHook
} from 'core/vdom/helpers/index'
import {
    activeInstance
} from 'core/instance/lifecycle'

import {
    once,
    isDef,
    isUndef,
    isObject,
    toNumber
} from 'shared/util'

import {
    nextFrame,
    resolveTransition,
    whenTransitionEnds,
    addTransitionClass,
    removeTransitionClass
} from '../transition-util'

export function enter(vnode: VNodeWithData, toggleDisplay: ? () => void) {

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
    // 当前的vm实例总会成了<transition>组件来管理过渡。一个边缘情况是，当<transition>
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

export function leave(vnode: VNodeWithData, rm: Function) {
    const el: any = vnode.elm

    // call enter callback now
    // 调用元素的动画入场函数
    if (isDef(el._enterCb)) {
        el._enterCb.cancelled = true;
        el._enterCb();
    }

    // 解析transition标签上的属性，返回一个其上属性的键值对
    const data = resolveTransition(vnode.data.transition);

    // 如果该元素无transition标签包裹，或不为元素
    if (isUndef(data) || el.nodeType !== 1) {
        return rm()
    }

    if (isDef(el._leaveCb)) {
        return
    }

    const {
        css,
        type,
        leaveClass,
        leaveToClass,
        leaveActiveClass,
        beforeLeave,
        leave,
        afterLeave,
        leaveCancelled,
        delayLeave,
        duration
    } = data;

    // 是否使用css过渡
    const expectsCSS = css !== false && !isIE9;

    // 用户是否需要额外操作
    const userWantsControl = getHookArgumentsLength(leave);

    const explicitLeaveDuration: any = toNumber(
        isObject(duration) ? duration.leave : duration);

    // 检测动画时间是否合法
    if (process.env.NODE_ENV !== 'production' && isDef(explicitLeaveDuration)) {
        checkDuration(explicitLeaveDuration, 'leave', vnode)
    }

    // 在元素上挂载只能调用一次的_leaveCB离开的动画函数
    const cb = el._leaveCb = once(() => {
        if (el.parentNode && el.parentNode._pending) {
            el.parentNode._pending[vnode.key] = null
        }
        if (expectsCSS) {
            removeTransitionClass(el, leaveToClass)
            removeTransitionClass(el, leaveActiveClass)
        }
        if (cb.cancelled) {
            if (expectsCSS) {
                removeTransitionClass(el, leaveClass)
            }
            leaveCancelled && leaveCancelled(el)
        } else {
            rm()
            afterLeave && afterLeave(el)
        }
        el._leaveCb = null
    })

    if (delayLeave) {
        delayLeave(performLeave)
    } else {
        performLeave()
    }

    function performLeave() {
        // the delayed leave may have already been cancelled
        if (cb.cancelled) {
            return
        }
        // record leaving element
        if (!vnode.data.show && el.parentNode) {
            (el.parentNode._pending || (el.parentNode._pending = {}))[(vnode.key: any)] = vnode
        }
        beforeLeave && beforeLeave(el)
        if (expectsCSS) {
            addTransitionClass(el, leaveClass);
            addTransitionClass(el, leaveActiveClass);

            //
            nextFrame(() => {
                removeTransitionClass(el, leaveClass)
                if (!cb.cancelled) {
                    addTransitionClass(el, leaveToClass)
                    if (!userWantsControl) {
                        if (isValidDuration(explicitLeaveDuration)) {
                            setTimeout(cb, explicitLeaveDuration)
                        } else {
                            whenTransitionEnds(el, type, cb)
                        }
                    }
                }
            })
        }
        leave && leave(el, cb)
        if (!expectsCSS && !userWantsControl) {
            cb()
        }
    }
}

// only used in dev mode
// 检查动画时间是否合法
function checkDuration(val, name, vnode) {
    if (typeof val !== 'number') {
        warn(
            `<transition> explicit ${name} duration is not a valid number - ` +
            `got ${JSON.stringify(val)}.`,
            vnode.context
        )
    } else if (isNaN(val)) {
        warn(
            `<transition> explicit ${name} duration is NaN - ` +
            'the duration expression might be incorrect.',
            vnode.context
        )
    }
}

function isValidDuration(val) {
    return typeof val === 'number' && !isNaN(val)
}

/**
 * Normalize a transition hook's argument length. The hook may be:
 * 标准化transition钩子函数的参数长度，因为其钩子函数固定会传入1个element作为参数
 * - a merged hook (invoker) with the original in .fns(如事件的监听器)
 * - a wrapped component method (check ._length)调用bind后的参数长度
 * - a plain function (.length)
 */
function getHookArgumentsLength(fn: Function): boolean {
    if (isUndef(fn)) {

        // 非函数，返回false
        return false;
    }

    const invokerFns = fn.fns;
    if (isDef(invokerFns)) {

        // invoker
        // 返回第一个函数的参数长度
        return getHookArgumentsLength(
            Array.isArray(invokerFns) ?
            invokerFns[0] : invokerFns);
    } else {

        // 参数数量大于1则返回true，因为固定会传入一个el作为第一个参数
        return (fn._length || fn.length) > 1
    }
}

function _enter(_: any, vnode: VNodeWithData) {

    // 仅当其未进行显示时才调用enter函数
    if (vnode.data.show !== true) {

        // 调用enter函数，对element进行过渡操作
        enter(vnode);
    }
}

export default inBrowser ? {
    create: _enter,
    activate: _enter,
    remove(vnode: VNode, rm: Function) {
        /* istanbul ignore else */
        if (vnode.data.show !== true) {
            leave(vnode, rm)
        } else {
            rm()
        }
    }
} : {}