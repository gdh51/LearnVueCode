/* @flow */

/**
 * Expand input[v-model] with dyanmic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */

import {
    addRawAttr,
    getBindingAttr,
    getAndRemoveAttr
} from 'compiler/helpers'

import {
    processFor,
    processElement,
    addIfCondition,
    createASTElement
} from 'compiler/parser/index'

function preTransformNode(el: ASTElement, options: CompilerOptions) {

    // 抱歉，只针对input元素
    if (el.tag === 'input') {
        const map = el.attrsMap;

        // 未定义v-model属性或定义但未定义值时，不做处理
        if (!map['v-model']) {
            return;
        }

        // 动态绑定的type属性值的字符串表达式
        let typeBinding;

        // 绑定动态的type属性时, 获取其动态type表达式的字符串
        if (map[':type'] || map['v-bind:type']) {
            typeBinding = getBindingAttr(el, 'type');
        }

        // 未通过任何形式定义type属性时，会从v-bind绑定的对象中取
        if (!map.type && !typeBinding && map['v-bind']) {
            typeBinding = `(${map['v-bind']}).type`;
        }

        if (typeBinding) {

            // 获取AST元素上v-if值，移除其在attrList与attrMap上的值
            const ifCondition = getAndRemoveAttr(el, 'v-if', true);

            // 存在则包装为&&(value)
            const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``;

            // 是否定义v-else
            const hasElse = getAndRemoveAttr(el, 'v-else', true) != null;

            // 取出else-if的条件表达式
            const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true);

            // 1. checkbox
            const branch0 = cloneASTElement(el);

            // process for on the main node
            // 处理v-for属性，将结果挂载在ast元素对象上
            processFor(branch0);

            // 添加一个静态type属性至这个新建的ast元素
            addRawAttr(branch0, 'type', 'checkbox');

            // 处理该元素上的其他属性
            processElement(branch0, options);

            // 标记该AST对象为已处理, 防止二次处理
            branch0.processed = true // prevent it from double-processed

            // 重写if条件
            branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
            addIfCondition(branch0, {
                exp: branch0.if,
                block: branch0
            })

            // 其余大同小异，不对应该是都一样
            // 2. add radio else-if condition
            const branch1 = cloneASTElement(el)
            getAndRemoveAttr(branch1, 'v-for', true)
            addRawAttr(branch1, 'type', 'radio')
            processElement(branch1, options)
            addIfCondition(branch0, {
                exp: `(${typeBinding})==='radio'` + ifConditionExtra,
                block: branch1
            });
            // 3. other
            const branch2 = cloneASTElement(el)
            getAndRemoveAttr(branch2, 'v-for', true)
            addRawAttr(branch2, ':type', typeBinding)
            processElement(branch2, options)
            addIfCondition(branch0, {
                exp: ifCondition,
                block: branch2
            })

            // 对checkbox元素添加else/else-if条件
            if (hasElse) {
                branch0.else = true
            } else if (elseIfCondition) {
                branch0.elseif = elseIfCondition
            }

            return branch0;
        }
    }
}

function cloneASTElement(el) {

    // 创建一个具有剩余属性的相同ast元素对象
    return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
    preTransformNode
}