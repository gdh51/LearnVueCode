/* @flow */

import {
    cached
} from 'shared/util'
import {
    parseFilters
} from './filter-parser'

// 默认插值表达式为{{}}
const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;

const buildRegex = cached(delimiters => {

    // $&表示与正则表达式相匹配的子串
    // 所以这里的意思就是给我们自定义的符号加上\转移符
    const open = delimiters[0].replace(regexEscapeRE, '\\$&')
    const close = delimiters[1].replace(regexEscapeRE, '\\$&')
    return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
});

type TextParseResult = {
    expression: string,
    tokens: Array < string | {
        '@binding': string
    } >
}

export function parseText(
    text: string,
    delimiters ? : [string, string]
): TextParseResult | void {

    // 根据用户是否自定义插入符来获取插值表达式的正则表达式
    const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE;

    // 没有关于插值表达式的内容，则不用解析直接返回
    if (!tagRE.test(text)) {
        return
    }
    const tokens = [];
    const rawTokens = [];

    // 上次匹配到的位置
    let lastIndex = tagRE.lastIndex = 0;
    let match, index, tokenValue;
    while ((match = tagRE.exec(text))) {

        // 当前匹配的插值表达式的起始位置
        index = match.index;

        /**
         * push text token
         * 如果当前下标大于上个匹配位下标， 说明中间有字符不匹配， 是普通的字符串，
         * 那么将这些字符串加入tokens中
         */
        if (index > lastIndex) {
            rawTokens.push(tokenValue = text.slice(lastIndex, index))
            tokens.push(JSON.stringify(tokenValue))
        }

        // tag token
        // 解析插值括号中的字符串表达式，存放至token中
        const exp = parseFilters(match[1].trim());
        tokens.push(`_s(${exp})`);
        rawTokens.push({
            '@binding': exp
        });

        // 跟随正则表达式，更新lastIndex位置为当前匹配到的字符串的之后的位置
        lastIndex = index + match[0].length
    }

    // 如果匹配结束后，上次匹配到的地方不是字符串最后，
    // 则说明后面还有一部分是普通的字符串，那么要将它们存入tokens中
    if (lastIndex < text.length) {
        rawTokens.push(tokenValue = text.slice(lastIndex))
        tokens.push(JSON.stringify(tokenValue))
    }

    // 返回解析结果
    return {
        expression: tokens.join('+'),
        tokens: rawTokens
    }
}