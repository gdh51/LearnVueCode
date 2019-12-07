/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import {
    isTextInputType
} from 'web/util/element'
import {
    looseEqual,
    looseIndexOf
} from 'shared/util'
import {
    mergeVNodeHook
} from 'core/vdom/helpers/index'
import {
    warn,
    isIE9,
    isIE,
    isEdge
} from 'core/util/index'

if (isIE9) {
    // http://www.matts411.com/post/internet-explorer-9-oninput/
    document.addEventListener('selectionchange', () => {
        const el = document.activeElement
        if (el && el.vmodel) {
            trigger(el, 'input')
        }
    })
}

const directive = {
    inserted(el, binding, vnode, oldVnode) {

        // 处理select标签bug
        if (vnode.tag === 'select') {

            // #6903
            if (oldVnode.elm && !oldVnode.elm._vOptions) {

                // 之前的该元素不为select元素时，手动向新的VNode节点添加该组件更新后的钩子函数
                mergeVNodeHook(vnode, 'postpatch', () => {
                    directive.componentUpdated(el, binding, vnode)
                });

            // 同一元素时，检查v-model绑定值，然后设置选中项
            } else {
                setSelected(el, binding, vnode.context)
            }

            // 遍历所有的options，并对其调用getValue函数，获取它们的值
            el._vOptions = [].map.call(el.options, getValue);

        // 文本框类型的元素时
        } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
            el._vModifiers = binding.modifiers;

            // 在非change模式下，为其绑定复合事件
            if (!binding.modifiers.lazy) {
                el.addEventListener('compositionstart', onCompositionStart);
                el.addEventListener('compositionend', onCompositionEnd);
                // Safari < 10.2 & UIWebView doesn't fire compositionend when
                // switching focus before confirming composition choice
                // this also fixes the issue where some browsers e.g. iOS Chrome
                // fires "change" instead of "input" on autocomplete.
                el.addEventListener('change', onCompositionEnd);

                if (isIE9) {
                    el.vmodel = true
                }
            }
        }
    },

    componentUpdated(el, binding, vnode) {

        // 处理selected元素
        if (vnode.tag === 'select') {

            // 同样，选择最新v-model值的option
            setSelected(el, binding, vnode.context);

            // in case the options rendered by v-for have changed,
            // it's possible that the value is out-of-sync with the rendered options.
            // detect such cases and filter out values that no longer has a matching
            // option in the DOM.
            // 如果通过v-for渲染的options发生了变化，那么渲染的options的value可能会不同步
            // 此时我们需要判断这种情况，然后过滤掉那些已经不在dom中的值

            // 获取之前options中的全部值
            const prevOptions = el._vOptions;

            // 获取最新的options中的全部值的数组
            const curOptions = el._vOptions = [].map.call(el.options, getValue);

            // 前后两者是否在对应下标下存在不同的值
            if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {

                // trigger change event if
                // no matching option found for at least one value
                // 触发change事件即使仅存在一个option的值不等
                // 是否需要重新
                const needReset = el.multiple ?

                    // 只要有binding.value中存在一个值与curOptions中的任何值不等，则返回true
                    binding.value.some(v => hasNoMatchingOption(v, curOptions)) :

                    // v-model绑定的值发生变化时，如果v-model新值不与任何options中值相等
                    binding.value !== binding.oldValue && hasNoMatchingOption(binding.value, curOptions)

                // 手动触发该元素的change事件
                if (needReset) {
                    trigger(el, 'change');
                }
            }
        }
    }
}

function setSelected(el, binding, vm) {

    // 根据v-model值设置选中项
    actuallySetSelected(el, binding, vm)

    // IE中在设置一次(可能是某个bug)
    if (isIE || isEdge) {
        setTimeout(() => {
            actuallySetSelected(el, binding, vm);
        }, 0);
    }
}

function actuallySetSelected(el, binding, vm) {
    const value = binding.value;
    const isMultiple = el.multiple;

    // 当前为多选，但v-model绑定的不是数组时，报错
    if (isMultiple && !Array.isArray(value)) {
        process.env.NODE_ENV !== 'production' && warn(
            `<select multiple v-model="${binding.expression}"> ` +
            `expects an Array value for its binding, but got ${
        Object.prototype.toString.call(value).slice(8, -1)
      }`,
            vm
        )
        return;
    }
    let selected, option;
    for (let i = 0, l = el.options.length; i < l; i++) {
        option = el.options[i];
        if (isMultiple) {

            // 当前v-model的值是否与当前的option值相等，相等则应该为被选中的option
            selected = looseIndexOf(value, getValue(option)) > -1;

            // 如果当前option与v-model指定值得出结果不同，则更新
            if (option.selected !== selected) {
                option.selected = selected
            }
        } else {

            // 单个时，找到第一个等于v-model值的options并选中，然后退出
            if (looseEqual(getValue(option), value)) {
                if (el.selectedIndex !== i) {
                    el.selectedIndex = i
                }
                return;
            }
        }
    }

    // 不为多选的其他情况，则取消所有的选中
    if (!isMultiple) {
        el.selectedIndex = -1
    }
}

function hasNoMatchingOption(value, options) {

    // 没有任何值与value相等则返回true，存在至少一个值相等则返回false
    return options.every(o => !looseEqual(o, value));
}

// 获取options的值
function getValue(option) {
    return '_value' in option ?
        option._value :
        option.value
}

function onCompositionStart(e) {
    e.target.composing = true
}

function onCompositionEnd(e) {
    // prevent triggering an input event for no reason
    if (!e.target.composing) return
    e.target.composing = false
    trigger(e.target, 'input')
}

// 触发该元素的change事件
function trigger(el, type) {
    const e = document.createEvent('HTMLEvents')
    e.initEvent(type, true, true);
    el.dispatchEvent(e);
}

export default directive