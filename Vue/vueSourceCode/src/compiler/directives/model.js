/* @flow */

/**
 * Cross-platform code generation for component v-model
 */
export function genComponentModel(
    el: ASTElement,
    value: string,
    modifiers: ? ASTModifiers
): ? boolean {

    // 提取上面的修饰符
    const {
        number,
        trim
    } = modifiers || {};

    const baseValueExpression = '$$v';
    let valueExpression = baseValueExpression;

    // 如果有trim修饰符则需对用户输入字符串值进行首尾去空格处理
    if (trim) {
        valueExpression =
            `(typeof ${baseValueExpression} === 'string'` +
            `? ${baseValueExpression}.trim()` +
            `: ${baseValueExpression})`
    }

    // 如果具有.number修饰符则需要将值转换为数字
    if (number) {
        valueExpression = `_n(${valueExpression})`
    }

    // 生成赋值表达式
    const assignment = genAssignmentCode(value, valueExpression);

    // 返回处理的model对象
    el.model = {
        value: `(${value})`,
        expression: JSON.stringify(value),
        callback: `function (${baseValueExpression}) {${assignment}}`
    };
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
export function genAssignmentCode(
    value: string,
    assignment: string
) : string {

    // 将value解析为路径+最后一个键名的形式
    const res = parseModel(value);

    // 不以[]结尾或没有.操作符时，即没有任何操作符时
    if (res.key === null) {

        // 绑定该表达式值为$event
        return `${value}=${assignment}`
    } else {

        // 创建一个新值或更改该属性的值绑定为$event
        // 注意这个地方，即使你绑定一个不存在的对象的值也行
        return `$set(${res.exp}, ${res.key}, ${assignment})`
    }
}

/**
 * Parse a v-model expression into a base path and a final key segment.
 * Handles both dot-path and possible square brackets.
 *
 * Possible cases:
 *
 * - test
 * - test[key]
 * - test[test1[key]]
 * - test["a"][key]
 * - xxx.test[a[a].test1[key]]
 * - test.xxx.a["asa"][test1[key]]
 *
 */

let len, str, chr, index, expressionPos, expressionEndPos

type ModelParseResult = {
    exp: string,
    key: string | null
}

export function parseModel(val: string): ModelParseResult {
    // Fix https://github.com/vuejs/vue/pull/7730
    // allow v-model="obj.val " (trailing whitespace)
    val = val.trim();

    // 解析的字符串表达式长度
    len = val.length;

    // 不存在[]，或存在[]之后还存在其他字符时
    if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
        index = val.lastIndexOf('.');

        // ]之后还存在.操作符时，提取.后面的键值为key
        if (index > -1) {
            return {
                exp: val.slice(0, index),
                key: '"' + val.slice(index + 1) + '"'
            }
        } else {
            return {
                exp: val,
                key: null
            }
        }
    }

    // 以[]结尾的字符串表达式
    str = val;
    index = expressionPos = expressionEndPos = 0

    while (!eof()) {

        // 下一个字符
        chr = next();

        // 如果当前字符为单引号或双引号，解析到下一个同样引号为止
        if (isStringStart(chr)) {
            parseString(chr);

        // 当前为[时，解析到与当前[配对的]位置
        } else if (chr === 0x5B) {
            parseBracket(chr)
        }
    }

    return {

        // []前的字符串表达式
        exp: val.slice(0, expressionPos),

        // []内的字符串表达式
        key: val.slice(expressionPos + 1, expressionEndPos)
    }
}

// 解析下一个字符串的下一个字符，并更新指针
function next(): number {
    return str.charCodeAt(++index)
}

// 是否解析完毕
function eof(): boolean {
    return index >= len
}

function isStringStart(chr: number): boolean {

    // 是否为' 或 "
    return chr === 0x22 || chr === 0x27;
}

function parseBracket(chr: number): void {
    let inBracket = 1;

    // 起始引号位置
    expressionPos = index;
    while (!eof()) {
        chr = next()
        if (isStringStart(chr)) {
            parseString(chr)
            continue
        }

        // 另一个[
        if (chr === 0x5B) inBracket++

        // 反括号]
        if (chr === 0x5D) inBracket--

        // 当解析完配对的[]时，返回最后的下标
        if (inBracket === 0) {
            expressionEndPos = index
            break
        }
    }
}

function parseString(chr: number): void {
    const stringQuote = chr;

    // 因为当前为引号，所以一直解析到另一个同样的引号未知
    while (!eof()) {
        chr = next();
        if (chr === stringQuote) {
            break
        }
    }
}