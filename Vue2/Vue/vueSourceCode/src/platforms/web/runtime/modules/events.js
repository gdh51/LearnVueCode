/* @flow */

import {
    isDef,
    isUndef
} from 'shared/util'
import {
    updateListeners
} from 'core/vdom/helpers/index'
import {
    isIE,
    isFF,
    supportsPassive,
    isUsingMicroTask
} from 'core/util/index'
import {
    RANGE_TOKEN,
    CHECKBOX_RADIO_TOKEN
} from 'web/compiler/directives/model'
import {
    currentFlushTimestamp
} from 'core/observer/scheduler'

// normalize v-model event tokens that can only be determined at runtime.
// 标准化v-model的token，只能在运行时确定
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
// 将其放至事件处理器数组的第一位，以保证v-model的回调函数能在其他回调函数前触发
function normalizeEvents(on) {

    // 是否为range类型的input的双向绑定
    if (isDef(on[RANGE_TOKEN])) {

        // IE input[type=range] only supports `change` event
        // IE 只支持change事件
        const event = isIE ? 'change' : 'input';

        // 将该事件至于事件处理函数的第一位
        on[event] = [].concat(on[RANGE_TOKEN], on[event] || []);

        // 删除该占位符token
        delete on[RANGE_TOKEN];
    }
    // This was originally intended to fix #4521 but no longer necessary
    // after 2.5. Keeping it for backwards compat with generated code from < 2.4
    // 用于解决#4521问题，但现在没有必要，现在只用于向后兼容
    // v-model是否定义在checkbox上
    if (isDef(on[CHECKBOX_RADIO_TOKEN])) {

        // 将其至于回调函数队列的第一个位置
        on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
        delete on[CHECKBOX_RADIO_TOKEN]
    }
}

let target: any

function createOnceHandler(event, handler, capture) {

    // 用一个闭包来存储当前的目标元素
    const _target = target // save current target element in closure

    // 返回一个调用函数，用来调用事件处理器
    return function onceHandler() {

        // 调用该函数，然后调用remove函数移除事件处理器
        const res = handler.apply(null, arguments)
        if (res !== null) {
            remove(event, onceHandler, capture, _target)
        }
    }
}

// #9446: Firefox <= 53 (in particular, ESR 52) has incorrect Event.timeStamp
// implementation and does not fire microtasks in between event propagation, so
// safe to exclude.
// 在Vue是不是微任务阶段进行更新时或且FF版本小于53时，不使用微任务修复
const useMicrotaskFix = isUsingMicroTask && !(isFF && Number(isFF[1]) <= 53)

function add(
    name: string,
    handler: Function,
    capture: boolean,
    passive: boolean
) {
    // async edge case #6566: inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // the solution is simple: we save the timestamp when a handler is attached,
    // and the handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    // 异步边缘情况：假设事件委托的情况，子元素的点击事件触发导致dom重新进行patch，
    // 事件监听器会在patch时添加至父元素，然后再通过冒泡触发父节点的事件。这种情况发生的原因是因为
    // 浏览器会在事件冒泡期间触发微任务队列的调用。
    if (useMicrotaskFix) {

        // 当前开始刷新队列的时间，事件被添加的时间要延后
        const attachedTimestamp = currentFlushTimestamp;

        // 获取未封装前的事件监听器
        const original = handler;
        handler = original._wrapper = function (e) {
            if (
                // no bubbling, should always fire.
                // 如果不是由冒泡触发，则永远直接触发
                // this is just a safety net in case event.timeStamp is unreliable in
                // certain weird environments...
                // 因为这是以防万一，在有些环境中事件的时间戳不可靠
                // 这个是判断是否为冒泡或捕获触发的事件
                e.target === e.currentTarget ||

                // event is fired after handler attachment
                // 事件会在处理器添加后被调用
                // 这里表示只有创建时间在开始刷新队列之后的事件才会调用
                e.timeStamp >= attachedTimestamp ||

                // bail for environments that have buggy event.timeStamp implementations
                // #9462 iOS 9 bug: event.timeStamp is 0 after history.pushState
                // #9681 QtWebEngine event.timeStamp is negative value
                // 平稳退化，有些环境的该值为0，或负数，有些环境在调用history API后该值为0
                e.timeStamp <= 0 ||

                // #9448 bail if event is fired in another document in a multi-page
                // electron/nw.js app, since event.timeStamp will be using a different
                // starting reference
                // 兼容有些环境，如有些事件在另一个文档中被调用。这就会导致timeStamp会有一个不同的
                // 开始值
                e.target.ownerDocument !== document
            ) {
                return original.apply(this, arguments);
            }
        };
    }

    // 添加事件
    target.addEventListener(
        name,
        handler,
        supportsPassive ?
        {
            capture,
            passive
        } :
        capture
    )
}

function remove(
    name: string,
    handler: Function,
    capture: boolean,
    _target ? : HTMLElement
) {

    // 直接移除该事件
    (_target || target).removeEventListener(
        name,
        handler._wrapper || handler,
        capture
    )
}

function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {

    // 新旧节点都没有事件监听器，则直接返回
    if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
        return
    }

    // 新旧事件对象
    const on = vnode.data.on || {};
    const oldOn = oldVnode.data.on || {};

    // 取出新节点的dom元素
    target = vnode.elm;

    // 标准化v-model绑定的事件
    normalizeEvents(on);

    // 对比前后的事件对象，然后向target上添加事件
    updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context)

    // 清空target
    target = undefined;
}

export default {
    create: updateDOMListeners,
    update: updateDOMListeners
}