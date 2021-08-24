/* @flow */

import {
    addProp
} from 'compiler/helpers'

export default function text(el: ASTElement, dir: ASTDirective) {
    if (dir.value) {

        // 简单的添加个特性
        addProp(el, 'textContent', `_s(${dir.value})`, dir)
    }
}