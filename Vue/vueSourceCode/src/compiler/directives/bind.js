/* @flow */

export default function bind(el: ASTElement, dir: ASTDirective) {

    // 添加一个包装函数，用于处理v-bind的对象形式
    el.wrapData = (code: string) => {
        return `_b(${code},'${el.tag}',${dir.value},${
            dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
            }${
            dir.modifiers && dir.modifiers.sync ? ',true' : ''
        })`;
    }
}