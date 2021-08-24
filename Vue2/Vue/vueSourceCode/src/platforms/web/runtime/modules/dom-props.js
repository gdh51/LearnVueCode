/* @flow */

import {
    isDef,
    isUndef,
    extend,
    toNumber
} from 'shared/util'
import {
    isSVG
} from 'web/util/index'

let svgContainer

function updateDOMProps(oldVnode: VNodeWithData, vnode: VNodeWithData) {

    // 当新旧节点都不具有property属性时，直接退出
    if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
        return
    }
    let key, cur;
    const elm: any = vnode.elm;
    const oldProps = oldVnode.data.domProps || {};
    let props = vnode.data.domProps || {};

    // clone observed objects, as the user probably wants to mutate it
    // 复制被观察者对象，因为用户可以想通过它触发更新，所以进行浅拷贝
    if (isDef(props.__ob__)) {
        props = vnode.data.domProps = extend({}, props);
    }

    // 清空旧的已不存在的property属性
    // 遍历旧的property对象
    for (key in oldProps) {

        // 如果新的property对象中无该值，则清空该property
        if (!(key in props)) {
            elm[key] = ''
        }
    }

    // 遍历新的property
    for (key in props) {
        cur = props[key];

        // ignore children if the node has textContent or innerHTML,
        // as these will throw away existing DOM nodes and cause removal errors
        // on subsequent patches (#3360)
        // 如果具有textContent属性或innerHTML属性，则忽略该元素的子节点。
        if (key === 'textContent' || key === 'innerHTML') {

            // 如果该VNode节点存在子节点，则直接清空
            if (vnode.children) vnode.children.length = 0;

            // 如果属性没有变化则跳过该属性进入下一个属性
            if (cur === oldProps[key]) continue;

            // #6601 work around Chrome version <= 55 bug where single textNode
            // replaced by innerHTML/textContent retains its parentNode property
            // 被innerHTML/textContent替换的文件节点仍会保留parentNode属性
            if (elm.childNodes.length === 1) {
                elm.removeChild(elm.childNodes[0])
            }
        }

        // value属性而不是progress元素
        if (key === 'value' && elm.tagName !== 'PROGRESS') {

            // store value as _value as well since
            // non-string values will be stringified
            // 存储value属性作为_value属性，因为非字符串值会被序列化
            elm._value = cur;

            // avoid resetting cursor position when value is the same
            // 在当前值相同时，避免重设其光标位置
            const strCur = isUndef(cur) ? '' : String(cur);

            // 是否应该更新当前的值(获取焦点或值未变时都不更新)
            if (shouldUpdateValue(elm, strCur)) {
                elm.value = strCur
            }
        } else if (key === 'innerHTML' && isSVG(elm.tagName) && isUndef(elm.innerHTML)) {

            // SVG的innerHTML
            // IE doesn't support innerHTML for SVG elements
            svgContainer = svgContainer || document.createElement('div')
            svgContainer.innerHTML = `<svg>${cur}</svg>`
            const svg = svgContainer.firstChild
            while (elm.firstChild) {
                elm.removeChild(elm.firstChild)
            }
            while (svg.firstChild) {
                elm.appendChild(svg.firstChild)
            }

        // 其余属性，只要值发生了变化，则直接进行同步
        } else if (
            // skip the update if old and new VDOM state is the same.
            // `value` is handled separately because the DOM value may be temporarily
            // out of sync with VDOM state due to focus, composition and modifiers.
            // value的值会单独进行处理，因为DOM的value可能会因为聚焦的情况，复合事件或修饰符
            // 导致与VDOM的状态不同步
            // This  #4521 by skipping the unnecesarry `checked` update.
            // 跳过不必要的checked更新
            cur !== oldProps[key]
        ) {
            // some property updates can throw
            // e.g. `value` on <progress> w/ non-finite value
            try {
                elm[key] = cur
            } catch (e) {}
        }
    }
}

// check platforms/web/util/attrs.js acceptValue
type acceptValueElm = HTMLInputElement | HTMLSelectElement | HTMLOptionElement;

// 两个条件，首先不能是在复合事件中，其次还未更新value的值等等
function shouldUpdateValue(elm: acceptValueElm, checkVal: string): boolean {

    // 不在复合事件中，且元素不为option
    return (!elm.composing && (
        elm.tagName === 'OPTION' ||

        // 该元素是否为焦点元素且还未同步最新的value值
        isNotInFocusAndDirty(elm, checkVal) ||

        // 在具有修饰符或没有的情况下是否还未同步最新的value值
        isDirtyWithModifiers(elm, checkVal)
    ));
}

function isNotInFocusAndDirty(elm: acceptValueElm, checkVal: string): boolean {

    // return true when textbox (.number and .trim) loses focus and its value is
    // not equal to the updated value
    // 当文本框失去焦点或其值与最新值不相等时，返回true
    let notInFocus = true;

    // #6157
    // work around IE bug when accessing document.activeElement in an iframe
    try {

        // 当前具有焦点的元素不是elm
        notInFocus = document.activeElement !== elm
    } catch (e) {}

    return notInFocus && elm.value !== checkVal
}

function isDirtyWithModifiers(elm: any, newVal: string): boolean {
    const value = elm.value;
    const modifiers = elm._vModifiers; // injected by v-model runtime

    // 具有修饰符的情况
    if (isDef(modifiers)) {
        if (modifiers.number) {
            return toNumber(value) !== toNumber(newVal)
        }
        if (modifiers.trim) {
            return value.trim() !== newVal.trim()
        }
    }
    return value !== newVal;
}

export default {
    create: updateDOMProps,
    update: updateDOMProps
}