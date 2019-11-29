/* @flow */

import {
    isIE,
    isIE9,
    isEdge
} from 'core/util/env'

import {
    extend,
    isDef,
    isUndef
} from 'shared/util'

import {
    isXlink,
    xlinkNS,
    getXlinkProp,
    isBooleanAttr,
    isEnumeratedAttr,
    isFalsyAttrValue,
    convertEnumeratedValue
} from 'web/util/index'

function updateAttrs(oldVnode: VNodeWithData, vnode: VNodeWithData) {

    // 取出组件的配置(即我们定义组件的对象)
    const opts = vnode.componentOptions;

    // 如果存在且该组件的构造函数，且用户指定不继承attribute属性时，直接返回
    // https://cn.vuejs.org/v2/api/#inheritAttrs
    if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {

        // 未对应props的其他属性将不作为attribute绑定在组件的元素上
        return
    }

    // 如果新旧节点均未有属性，那么不做处理，直接退出函数
    if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
        return
    }
    let key, cur, old;

    // 取出新的VNode节点的dom元素
    const elm = vnode.elm;

    // 旧VNode节点与新VNode节点的属性
    const oldAttrs = oldVnode.data.attrs || {};
    let attrs: any = vnode.data.attrs || {};

    // clone observed objects, as the user probably wants to mutate it
    // 如果attrs为被观察的对象，则需对其一次克隆，因为用户可能会在之后改变它
    if (isDef(attrs.__ob__)) {
        attrs = vnode.data.attrs = extend({}, attrs);
    }

    // 如果在新的attribute中年已不存在该属性，那么移除
    for (key in attrs) {

        // 当前VNode存在的属性
        cur = attrs[key];

        // 旧的VNode同样名称的属性
        old = oldAttrs[key];

        // 如果存在差异，就将新的属性更新到新节点
        if (old !== cur) {
            setAttr(elm, key, cur);
        }
    }

    // #4391: in IE9, setting type can reset value for input[type=radio]
    // IE9中，重新设置type属性后，会重置其value值
    // #6666: IE/Edge forces progress value down to 1 before setting a max
    // IE/edge 浏览器存在这样一个问题。如果当前max为一个值，那么如果我们设置一个value
    // 大于该值时，那么value会等于max。而在Vue中由于是按值出现的顺序设置的，如果value设置在max
    // 之前，那么就可能导致value的值为1(因为1为默认max值)
    // 所以这里要对其值重新进行一次设置
    if ((isIE || isEdge) && attrs.value !== oldAttrs.value) {

        // 重新设置value属性
        setAttr(elm, 'value', attrs.value)
    }

    // 再次遍历旧的属性对象
    for (key in oldAttrs) {

        //如果旧值为undefined，那么说明这是个一元属性
        if (isUndef(attrs[key])) {

            // 如果为命名空间xlink，则移除元素的该命名空间属性
            if (isXlink(key)) {
                elm.removeAttributeNS(xlinkNS, getXlinkProp(key));

            // 除特殊的几个不可枚举的属性外，其他属性直接移除
            } else if (!isEnumeratedAttr(key)) {
                elm.removeAttribute(key)
            }
        }
    }
}

function setAttr(el: Element, key: string, value: any) {

    // 元素标签为原生标签，则直接设置属性
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
            value = key === 'allowfullscreen' && el.tagName === 'EMBED' ?
                'true' :
                key
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

export default {
    create: updateAttrs,
    update: updateAttrs
}