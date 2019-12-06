/* @flow */

import {
    inBrowser,
    isIE9
} from 'core/util/index'
import {
    addClass,
    removeClass
} from './class-util'
import {
    remove,
    extend,
    cached
} from 'shared/util'

export function resolveTransition(def ? : string | Object): ? Object {
    if (!def) {
        return;
    }

    // 获取解析的transition属性内的内容
    if (typeof def === 'object') {
        const res = {};

        // 只在指定css为false时，跳过css检测
        if (def.css !== false) {

            // 根据name来添加对应的css类，即使没有定义任何属性，也会添加v动画
            extend(res, autoCssTransition(def.name || 'v'))
        }

        // 添加其他属性至res中
        extend(res, def);
        return res;

    // 对于字符串形式，则返回其相关的class
    } else if (typeof def === 'string') {
        return autoCssTransition(def)
    }
}

// 提供一个动画名称，自动返回一个与其名称相关的动画class
const autoCssTransition: (name: string) => Object = cached(name => {
    return {
        enterClass: `${name}-enter`,
        enterToClass: `${name}-enter-to`,
        enterActiveClass: `${name}-enter-active`,
        leaveClass: `${name}-leave`,
        leaveToClass: `${name}-leave-to`,
        leaveActiveClass: `${name}-leave-active`
    }
});

export const hasTransition = inBrowser && !isIE9;
const TRANSITION = 'transition';
const ANIMATION = 'animation';

// Transition property/event sniffing
// 过渡属性和事件嗅探
export let transitionProp = 'transition'
export let transitionEndEvent = 'transitionend'
export let animationProp = 'animation'
export let animationEndEvent = 'animationend'
if (hasTransition) {

    if (window.ontransitionend === undefined &&
        window.onwebkittransitionend !== undefined
    ) {
        transitionProp = 'WebkitTransition'
        transitionEndEvent = 'webkitTransitionEnd'
    }
    if (window.onanimationend === undefined &&
        window.onwebkitanimationend !== undefined
    ) {
        animationProp = 'WebkitAnimation'
        animationEndEvent = 'webkitAnimationEnd'
    }
}

// binding to window is necessary to make hot reload work in IE in strict mode
// 绑定至window有利于在IE浏览器严格模式下进行热重载
// 优先使用requestAnimationFrame，降级使用setTimeout或直接调用
const raf = inBrowser ? (window.requestAnimationFrame ?
    window.requestAnimationFrame.bind(window) : setTimeout)
    :  fn => fn();

// 下一帧执行回调函数(下下次宏任务执行fn)
export function nextFrame(fn: Function) {
    raf(() => {
        raf(fn);
    });
}

export function addTransitionClass(el: any, cls: string) {

    // 获取或初始化_transitionClasses(用于装载过渡中的class)
    const transitionClasses = el._transitionClasses || (el._transitionClasses = []);

    // 该class不存在于其中则添加
    if (transitionClasses.indexOf(cls) < 0) {

        // 添加至其过渡classes数组
        transitionClasses.push(cls);

        // 添加至dom中
        addClass(el, cls);
    }
}

export function removeTransitionClass(el: any, cls: string) {

    // 移除_transition中的
    if (el._transitionClasses) {
        remove(el._transitionClasses, cls);
    }

    // 移除元素上的
    removeClass(el, cls);
}

export function whenTransitionEnds(
    el: Element,

    // 过渡的类型，animation或 transition
    expectedType: ? string,
    cb : Function
) {

    // 获取元素的过渡类型，和时间以及有几个需要过渡的属性
    const {
        type,
        timeout,
        propCount
    } = getTransitionInfo(el, expectedType);

    // 不具有类型时，直接执行回调函数(此时就不会执行过渡了)
    if (!type) return cb();

    // 确认过渡事件类型
    const event: string = type === TRANSITION ? transitionEndEvent : animationEndEvent;

    // 已完成过渡的属性个数
    let ended = 0;

    // 结束时回调——移除事件监听器并移除相关动画类
    const end = () => {
        el.removeEventListener(event, onEnd);
        cb();
    };
    const onEnd = e => {

        // 只会执行动画元素使用
        if (e.target === el) {

            // 仅在所有属性的动画全都执行完成后调用回调函数
            if (++ended >= propCount) {
                end();
            }
        }
    };

    // 若超时但未完成动画，则手动调用回调函数
    setTimeout(() => {
        if (ended < propCount) {
            end()
        }
    }, timeout + 1);
    el.addEventListener(event, onEnd);
}

const transformRE = /\b(transform|all)(,|$)/;

export function getTransitionInfo(el: Element, expectedType ? : ? string) : {
    type: ? string;
    propCount: number;
    timeout: number;
    hasTransform: boolean;
} {

    // 获取元素的样式表信息
    const styles: any = window.getComputedStyle(el);

    // JSDOM may return undefined for transition properties
    // 分别获取过渡或动画的各种信息，但注意可能会返回undefined
    const transitionDelays: Array < string > = (styles[transitionProp + 'Delay'] || '').split(', ')
    const transitionDurations: Array < string > = (styles[transitionProp + 'Duration'] || '').split(', ')
    const transitionTimeout: number = getTimeout(transitionDelays, transitionDurations)
    const animationDelays: Array < string > = (styles[animationProp + 'Delay'] || '').split(', ')
    const animationDurations: Array < string > = (styles[animationProp + 'Duration'] || '').split(', ')
    const animationTimeout: number = getTimeout(animationDelays, animationDurations)

    let type: ? string
    let timeout = 0;

    // 确认有几组动画属性
    let propCount = 0;

    // 根据过渡类型，确认以上三个值
    if (expectedType === TRANSITION) {
        if (transitionTimeout > 0) {
            type = TRANSITION
            timeout = transitionTimeout
            propCount = transitionDurations.length
        }
    } else if (expectedType === ANIMATION) {
        if (animationTimeout > 0) {
            type = ANIMATION
            timeout = animationTimeout
            propCount = animationDurations.length
        }
    } else {

        // 未指定类型时，取两者中最大的值
        timeout = Math.max(transitionTimeout, animationTimeout)
        type = timeout > 0 ?
            transitionTimeout > animationTimeout ?
            TRANSITION :
            ANIMATION :
            null
        propCount = type ?
            (type === TRANSITION ?
            transitionDurations.length : animationDurations.length)
            : 0;
    }

    // 是否为transform类型动画
    const hasTransform: boolean =
        type === TRANSITION &&
        transformRE.test(styles[transitionProp + 'Property']);

    // 返回自动测试的结果
    return {
        type,

        // 过渡的时间间隔
        timeout,

        // 过渡的属性个数
        propCount,

        // 过渡属性中是否含有transform
        hasTransform
    };
}

function getTimeout(delays: Array < string > , durations: Array < string > ): number {

    // 因为delays的数量肯定是小于等于durations的，所以将它们的数量至少与duration匹配
    while (delays.length < durations.length) {
        delays = delays.concat(delays);
    }

    // 返回其中delay + duration最高的，作为超时时间
    return Math.max.apply(null, durations.map((d, i) => {

        // 转换为ms单位
        return toMs(d) + toMs(delays[i]);
    }));
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer numbers
// in a locale-dependent way, using a comma instead of a dot.
// 旧版本的Chromium格式化浮点数字时，会使用，而不是.
// If comma is not replaced with a dot, the input will be rounded down (i.e. acting
// as a floor function) causing unexpected behaviors
// 如果，没有被.取代那么输入值将会被四舍五入(表现得为Math.floor)达不到预期
function toMs(s: string): number {
    return Number(s.slice(0, -1).replace(',', '.')) * 1000
}