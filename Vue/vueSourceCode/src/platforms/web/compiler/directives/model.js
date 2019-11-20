/* @flow */

import config from 'core/config'
import {
    addHandler,
    addProp,
    getBindingAttr
} from 'compiler/helpers'
import {
    genComponentModel,
    genAssignmentCode
} from 'compiler/directives/model'

let warn

// in some cases, the event used has to be determined at runtime
// so we used some reserved tokens during compile.
export const RANGE_TOKEN = '__r'
export const CHECKBOX_RADIO_TOKEN = '__c'

export default function model(
    el: ASTElement,
    dir: ASTDirective,
    _warn: Function
): ? boolean {
    warn = _warn;
    const value = dir.value;
    const modifiers = dir.modifiers;
    const tag = el.tag;

    // 取出双向绑定的类型
    const type = el.attrsMap.type;

    // 禁止设置file类型的input元素
    if (process.env.NODE_ENV !== 'production') {
        // inputs with type="file" are read only and setting the input's
        // value will throw an error.
        if (tag === 'input' && type === 'file') {
            warn(
                `<${el.tag} v-model="${value}" type="file">:\n` +
                `File inputs are read only. Use a v-on:change listener instead.`,
                el.rawAttrsMap['v-model']
            )
        }
    }

    // 针对组件的双向绑定
    if (el.component) {
        genComponentModel(el, value, modifiers)

        // component v-model doesn't need extra runtime
        // 组件的v-model不需要运行时编译
        return false;
    } else if (tag === 'select') {
        genSelect(el, value, modifiers)
    } else if (tag === 'input' && type === 'checkbox') {
        genCheckboxModel(el, value, modifiers)
    } else if (tag === 'input' && type === 'radio') {
        genRadioModel(el, value, modifiers)
    } else if (tag === 'input' || tag === 'textarea') {
        genDefaultModel(el, value, modifiers)

    // 其他自定义标签视为组件
    } else if (!config.isReservedTag(tag)) {
        genComponentModel(el, value, modifiers)

        // component v-model doesn't need extra runtime
        return false;
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `<${el.tag} v-model="${value}">: ` +
            `v-model is not supported on this element type. ` +
            'If you are working with contenteditable, it\'s recommended to ' +
            'wrap a library dedicated for that purpose inside a custom component.',
            el.rawAttrsMap['v-model']
        );
    }

    // ensure runtime directive metadata
    // 确保运行时的指令数据
    return true;
}

function genCheckboxModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) {
    const number = modifiers && modifiers.number;

    // 优先处理用户自定义的动态value
    const valueBinding = getBindingAttr(el, 'value') || 'null';

    // 指定用户选中或未选中时的值
    const trueValueBinding = getBindingAttr(el, 'true-value') || 'true';
    const falseValueBinding = getBindingAttr(el, 'false-value') || 'false';

    // 向元素添加checked特性和其值表达式
    addProp(el, 'checked',
        `Array.isArray(${value})` +
        `?_i(${value},${valueBinding})>-1` + (
            trueValueBinding === 'true' ?
            `:(${value})` :
            `:_q(${value},${trueValueBinding})`
        )
    );

    // 为其添加change事件
    addHandler(el, 'change',

        // 将用户指定变量赋值给$$a
        `var $$a=${value},` +
            '$$el=$event.target,' +

            // 获取当前多选框的状态然后赋予其值
            `$$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});` +

        // v-model绑定的为数组
        'if(Array.isArray($$a)){' +

            // 将该单选框绑定的value属性的值进行修饰符过滤，然后赋值给$$v
            `var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},` +

                // 这里我看下面的判断语句应该是判断$$v是否存在于$$a数组中
                '$$i=_i($$a,$$v);' +
            `if($$el.checked){` +

                // 当被选中时且该值不处于v-model指定数组中，则将添加进去
                `$$i<0&&(${genAssignmentCode(value, '$$a.concat([$$v])')})
            }` + `else{` +

                // 未选中时，且该值处于v-model指定数组中时，去掉该值
                `$$i>-1&&(${genAssignmentCode(value, '$$a.slice(0,$$i).concat($$a.slice($$i+1))')})
            }` +

        // 当v-model绑定的值不为数组时，其值与trueValue和falseValue绑定
        `}else{${genAssignmentCode(value, '$$c')}}`,
        null, true
    )
}

function genRadioModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) {
    const number = modifiers && modifiers.number;

    // 取得value绑定的值
    let valueBinding = getBindingAttr(el, 'value') || 'null';

    // 处理该值的值
    valueBinding = number ? `_n(${valueBinding})` : valueBinding;

    // 向该元素添加checked特性，值为该函数
    addProp(el, 'checked', `_q(${value},${valueBinding})`);

    // 添加原生change事件将value属性的值赋值给用户定义的表达式
    addHandler(el, 'change', genAssignmentCode(value, valueBinding), null, true);
}

function genSelect(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) {

    // 取出.number修饰符
    const number = modifiers && modifiers.number;

    // 生成筛选函数，筛选被选中的框，对其value进行值的转换
    const selectedVal = `Array.prototype.filter` +
        `.call($event.target.options,function(o){return o.selected})` +
        `.map(function(o){var val = "_value" in o ? o._value : o.value;` +
        `return ${number ? '_n(val)' : 'val'}})`

    // 根据是否指定multiple属性，目标元素的判断语句
    const assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]'

    // 赋值为目标变量
    let code = `var $$selectedVal = ${selectedVal};`;

    // 将$$selectedVal即选中的值赋值给绑定的变量
    code = `${code} ${genAssignmentCode(value, assignment)}`;

    // 给该事件添加change事件
    addHandler(el, 'change', code, null, true);
}

function genDefaultModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
) : ? boolean {
    const type = el.attrsMap.type;

    // warn if v-bind:value conflicts with v-model
    // except for inputs with v-bind:type
    if (process.env.NODE_ENV !== 'production') {

        // 取得动态绑定value的字符串表达式
        const value = el.attrsMap['v-bind:value'] || el.attrsMap[':value'];

        // 是否动态绑定type属性
        const typeBinding = el.attrsMap['v-bind:type'] || el.attrsMap[':type'];

        // 两者都定义时，报错，提示用户希望动态绑定type代替value
        if (value && !typeBinding) {
            const binding = el.attrsMap['v-bind:value'] ? 'v-bind:value' : ':value'
            warn(
                `${binding}="${value}" conflicts with v-model on the same element ` +
                'because the latter already expands to a value binding internally',
                el.rawAttrsMap[binding]
            )
        }
    }

    const {
        lazy,
        number,
        trim
    } = modifiers || {};

    // 是否需要复合事件，仅在text与input事件下
    const needCompositionGuard = !lazy && type !== 'range';

    // 设置.lazy修饰符会从input事件降级为change
    const event = lazy ?
        'change' :
        type === 'range' ?
        RANGE_TOKEN :
        'input'

    let valueExpression = '$event.target.value';

    // 针对修饰符做处理
    if (trim) {
        valueExpression = `$event.target.value.trim()`;
    }
    if (number) {
        valueExpression = `_n(${valueExpression})`;
    }

    // 将input元素的value赋值给v-model绑定的变量
    let code = genAssignmentCode(value, valueExpression);

    // 复合事件时直接退出
    if (needCompositionGuard) {
        code = `if($event.target.composing)return;${code}`
    }

    // 将value属性与v-model绑定的变量关联
    addProp(el, 'value', `(${value})`);

    // 添加相关的事件
    addHandler(el, event, code, null, true);

    // 具有修饰符时，在失焦时要进行输入过滤
    if (trim || number) {
        addHandler(el, 'blur', '$forceUpdate()')
    }
}