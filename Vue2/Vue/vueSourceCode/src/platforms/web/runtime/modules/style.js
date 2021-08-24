/* @flow */

import {
    getStyle,
    normalizeStyleBinding
} from 'web/util/style'
import {
    cached,
    camelize,
    extend,
    isDef,
    isUndef,
    hyphenate
} from 'shared/util'

const cssVarRE = /^--/;
const importantRE = /\s*!important$/;
const setProp = (el, name, val) => {

    // 是否为css变量声明，是则直接添加
    if (cssVarRE.test(name)) {
        el.style.setProperty(name, val);

    // 属性值中是否存在!important标记，如果存在手动添加其值
    } else if (importantRE.test(val)) {
        el.style.setProperty(hyphenate(name), val.replace(importantRE, ''), 'important')
    } else {

        // 返回其标准化名称(即有些部分浏览器支持的属性，会自动替我们加上前缀)
        const normalizedName = normalize(name);

        // 提供数组形式的值时，会设置每一个值，浏览器可以取自己能识别的值使用
        if (Array.isArray(val)) {
            // Support values array created by autoprefixer, e.g.
            // {display: ["-webkit-box", "-ms-flexbox", "flex"]}
            // Set them one by one, and the browser will only set those it can recognize
            for (let i = 0, len = val.length; i < len; i++) {
                el.style[normalizedName] = val[i]
            }

        // 其他时候直接设置值即可
        } else {
            el.style[normalizedName] = val
        }
    }
}

const vendorNames = ['Webkit', 'Moz', 'ms'];

let emptyStyle;
const normalize = cached(function (prop) {

    // 取一个空的样式map表
    emptyStyle = emptyStyle || document.createElement('div').style;

    // 驼峰化属性名
    prop = camelize(prop);

    // 对于普通的属性，直接返回其名称
    if (prop !== 'filter' && (prop in emptyStyle)) {
        return prop;
    }

    // 大写属性名的首字母
    const capName = prop.charAt(0).toUpperCase() + prop.slice(1);

    // 对于未查找到的属性，为其添加浏览器厂商前缀后在查找一次，返回其存在的名称
    for (let i = 0; i < vendorNames.length; i++) {
        const name = vendorNames[i] + capName
        if (name in emptyStyle) {
            return name;
        }
    }
});

function updateStyle(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    const data = vnode.data;
    const oldData = oldVnode.data;

    // 同样的先检查是否新旧节点都不具有任何形式的style属性，没有则直接返回
    if (isUndef(data.staticStyle) && isUndef(data.style) &&
        isUndef(oldData.staticStyle) && isUndef(oldData.style)
    ) {
        return;
    }

    let cur, name;
    const el: any = vnode.elm;
    const oldStaticStyle: any = oldData.staticStyle;

    // 这里优先取标准化后的动态style的值，其次取没有标准化的
    const oldStyleBinding: any = oldData.normalizedStyle || oldData.style || {};

    // if static style exists, stylebinding already merged into it when doing normalizeStyleData
    // 如果存在静态的style属性，那么说明已经调用normalizeStyleBinding将动态style合并进其中
    const oldStyle = oldStaticStyle || oldStyleBinding;

    // 标准化新的VNode的动态style值为对象形式
    const style = normalizeStyleBinding(vnode.data.style) || {}

    // store normalized style under a different key for next diff
    // make sure to clone it if it's reactive, since the user likely wants
    // to mutate it.
    // 存储新的VNode标准化后的动态style
    vnode.data.normalizedStyle = isDef(style.__ob__) ?
        extend({}, style) : style;

    // 获取该VNode的最终style对象
    const newStyle = getStyle(vnode, true);

    // 遍历旧的style对象，同时遍历新的style对象，删除已经不存在的属性
    for (name in oldStyle) {
        if (isUndef(newStyle[name])) {
            setProp(el, name, '')
        }
    }

    // 对于其他的值有差异或新增的属性，进行更新其值
    for (name in newStyle) {
        cur = newStyle[name];
        if (cur !== oldStyle[name]) {

            // ie9 setting to null has no effect, must use empty string
            // IE 9中设置null没有效果，必须使用空字符串
            setProp(el, name, cur == null ? '' : cur)
        }
    }
}

export default {
    create: updateStyle,
    update: updateStyle
}