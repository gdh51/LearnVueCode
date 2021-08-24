/* @flow */

import {
    dirRE,
    onRE
} from './parser/index'

type Range = {
    start ? : number,
    end ? : number
};

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
const prohibitedKeywordRE = new RegExp('\\b' + (
    'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
    'super,throw,while,yield,delete,export,import,return,switch,default,' +
    'extends,finally,continue,debugger,function,arguments'
).split(',').join('\\b|\\b') + '\\b')

// these unary operators should not be used as property/method names
// 匹配一元操作符，如delete (xxx)
const unaryOperatorsRE = new RegExp('\\b' + (
    'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)')

// strip strings in expressions
// 匹配字符串即"" ''等等
const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// detect problematic expressions in a template
// 检查模版中有问题的表达式
export function detectErrors(ast: ? ASTNode, warn : Function) {
    if (ast) {
        checkNode(ast, warn);
    }
}

function checkNode(node: ASTNode, warn: Function) {

    // 元素节点
    if (node.type === 1) {

        // 检测其全部属性
        for (const name in node.attrsMap) {

            // 检测是否为vue指令
            if (dirRE.test(name)) {

                // 取出指令的表达式
                const value = node.attrsMap[name];
                if (value) {

                    // 取出其指令对应的解析对象
                    const range = node.rawAttrsMap[name];

                    // v-for指令
                    if (name === 'v-for') {
                        checkFor(node, `v-for="${value}"`, warn, range);

                    // v-on指令
                    } else if (onRE.test(name)) {
                        checkEvent(value, `${name}="${value}"`, warn, range)

                    // 其他指令
                    } else {
                        checkExpression(value, `${name}="${value}"`, warn, range)
                    }
                }
            }
        }

        // 迭代检查子节点
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                checkNode(node.children[i], warn)
            }
        }

    // 插值表达式检查
    } else if (node.type === 2) {
        checkExpression(node.expression, node.text, warn, node)
    }
}

function checkEvent(exp: string, text: string, warn: Function, range ? : Range) {

    // 替换掉其中的字符串
    const stipped = exp.replace(stripStringRE, '');

    // 是否将一些一元操作符用于作为变量,匹配如 delete (xxx)
    const keywordMatch: any = stipped.match(unaryOperatorsRE)

    // 防止使用vue内置的$delete方法误报错
    if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
        warn(
            `avoid using JavaScript unary operator as property name: ` +
            `"${keywordMatch[0]}" in expression ${text.trim()}`,
            range
        )
    }

    // 检查事件的表达式是否合法
    checkExpression(exp, text, warn, range)
}

// 检查v-for，这里的text为完整的v-for表达式
function checkFor(node: ASTElement, text: string, warn: Function, range ? : Range) {
    checkExpression(node.for || '', text, warn, range);

    // 检查3个标识符是否合法
    checkIdentifier(node.alias, 'v-for alias', text, warn, range)
    checkIdentifier(node.iterator1, 'v-for iterator', text, warn, range)
    checkIdentifier(node.iterator2, 'v-for iterator', text, warn, range)
}

function checkIdentifier(
    ident: ? string,
    type : string,
    text: string,
    warn: Function,
    range ? : Range
) {
    if (typeof ident === 'string') {
        try {

            // 检查标识符是否正确
            new Function(`var ${ident}=_`)
        } catch (e) {
            warn(`invalid ${type} "${ident}" in expression: ${text.trim()}`, range)
        }
    }
}

function checkExpression(exp: string, text: string, warn: Function, range ? : Range) {

    // 检查表达式是否合法
    try {
        new Function(`return ${exp}`)
    } catch (e) {
        const keywordMatch = exp.replace(stripStringRE, '').match(prohibitedKeywordRE)
        if (keywordMatch) {
            warn(
                `avoid using JavaScript keyword as property name: ` +
                `"${keywordMatch[0]}"\n  Raw expression: ${text.trim()}`,
                range
            )
        } else {
            warn(
                `invalid expression: ${e.message} in\n\n` +
                `    ${exp}\n\n` +
                `  Raw expression: ${text.trim()}\n`,
                range
            )
        }
    }
}