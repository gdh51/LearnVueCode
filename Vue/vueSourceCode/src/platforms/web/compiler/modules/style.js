/* @flow */

import {
    parseText
} from 'compiler/parser/text-parser'
import {
    parseStyleText
} from 'web/util/style'
import {
    getAndRemoveAttr,
    getBindingAttr,
    baseWarn
} from 'compiler/helpers'

function transformNode(el: ASTElement, options: CompilerOptions) {
    const warn = options.warn || baseWarn
    const staticStyle = getAndRemoveAttr(el, 'style');
    if (staticStyle) {

        // 检测是否在静态style属性中使用插值表达式语法，有就报错
        if (process.env.NODE_ENV !== 'production') {
            const res = parseText(staticStyle, options.delimiters)
            if (res) {
                warn(
                    `style="${staticStyle}": ` +
                    'Interpolation inside attributes has been removed. ' +
                    'Use v-bind or the colon shorthand instead. For example, ' +
                    'instead of <div style="{{ val }}">, use <div :style="val">.',
                    el.rawAttrsMap['style']
                )
            }
        }

        // 将style字符串对象形式的键值对转换为JSON字符串后挂载在staticStyle上
        el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
    }

    // 绑定动态值
    const styleBinding = getBindingAttr(el, 'style', false /* getStatic */ )
    if (styleBinding) {
        el.styleBinding = styleBinding
    }
}

function genData(el: ASTElement): string {
    let data = ''
    if (el.staticStyle) {
        data += `staticStyle:${el.staticStyle},`
    }
    if (el.styleBinding) {
        data += `style:(${el.styleBinding}),`
    }
    return data
}

export default {
    staticKeys: ['staticStyle'],
    transformNode,
    genData
}