/* @flow */

const whitespaceRE = /\s+/

/**
 * Add class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 * 兼容性的添加class，因为IE的svg元素不支持classList属性
 */
export function addClass(el: HTMLElement, cls: ? string) {

    // 传入空格直接返回或无值
    if (!cls || !(cls = cls.trim())) {
        return
    }

    // 支持classList属性的class的添加
    if (el.classList) {

        // 添加多个class时，分开后逐个添加
        if (cls.indexOf(' ') > -1) {
            cls.split(whitespaceRE).forEach(c => el.classList.add(c))
        } else {
            el.classList.add(cls)
        }

    // 不支持时的添加
    } else {

        // 调用setAttribute添加
        const cur = ` ${el.getAttribute('class') || ''} `
        if (cur.indexOf(' ' + cls + ' ') < 0) {
            el.setAttribute('class', (cur + cls).trim())
        }
    }
}

/**
 * Remove class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 */
export function removeClass(el: HTMLElement, cls: ? string) {

    // 无值或空格直接返回
    if (!cls || !(cls = cls.trim())) {
        return;
    }

    // 支持classList属性时
    if (el.classList) {

        // 移除多个class
        if (cls.indexOf(' ') > -1) {
            cls.split(whitespaceRE).forEach(c => el.classList.remove(c));

        // 移除单个
        } else {
            el.classList.remove(cls)
        }

        // 当不存在class时，还要移除该属性
        if (!el.classList.length) {
            el.removeAttribute('class')
        }
    } else {
        let cur = ` ${el.getAttribute('class') || ''} `
        const tar = ' ' + cls + ' ';

        // 移除所有的指定class片段
        while (cur.indexOf(tar) >= 0) {
            cur = cur.replace(tar, ' ')
        }

        cur = cur.trim();

        // 重新赋值class
        if (cur) {
            el.setAttribute('class', cur);

            // 无class时移除该属性
        } else {
            el.removeAttribute('class')
        }
    }
}