/* @flow */

import {
    parseText
} from 'compiler/parser/text-parser'
import {
    getAndRemoveAttr,
    getBindingAttr,
    baseWarn
} from 'compiler/helpers'

function transformNode(el: ASTElement, options: CompilerOptions) {
    const warn = options.warn || baseWarn;

    // 提取静态的class属性
    const staticClass = getAndRemoveAttr(el, 'class');
    if (process.env.NODE_ENV !== 'production' && staticClass) {

        // 返回普通字符串(包含插值表达式)的解析结果(解析为token)
        const res = parseText(staticClass, options.delimiters);

        // 报错，静止在非v-bind中插入动态值
        if (res) {
            warn(
                `class="${staticClass}": ` +
                'Interpolation inside attributes has been removed. ' +
                'Use v-bind or the colon shorthand instead. For example, ' +
                'instead of <div class="{{ val }}">, use <div :class="val">.',
                el.rawAttrsMap['class']
            )
        }
    }

    // 直接将class值存放至静态class
    if (staticClass) {
        el.staticClass = JSON.stringify(staticClass)
    }

    // 获取class动态值，并存放至classBinding
    const classBinding = getBindingAttr(el, 'class', false /* getStatic */ )
    if (classBinding) {
        el.classBinding = classBinding
    }
}

function genData(el: ASTElement): string {
    let data = ''
    if (el.staticClass) {
        data += `staticClass:${el.staticClass},`
    }
    if (el.classBinding) {
        data += `class:${el.classBinding},`
    }
    return data
}

export default {
    staticKeys: ['staticClass'],
    transformNode,
    genData
}