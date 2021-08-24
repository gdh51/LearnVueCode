/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import {
    makeMap,
    no
} from 'shared/util'
import {
    isNonPhrasingTag
} from 'web/compiler/util'
import {
    unicodeRegExp
} from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;

// 匹配以字母或_开头的字符串
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;

// 匹配 xxx:xxx 或 xxx
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;

// 头标签开合部分
const startTagOpen = new RegExp(`^<${qnameCapture}`);

// 头标签闭合部分(只匹配>或 >, 注意这里有空格)
const startTagClose = /^\s*(\/?)>/;

// 匹配尾标签
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
const doctype = /^<!DOCTYPE [^>]+>/i;
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/;
const conditionalComment = /^<!\[/;

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&amp;': '&',
    '&#10;': '\n',
    '&#9;': '\t',
    '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
// 是否为pre/textarea元素
const isIgnoreNewlineTag = makeMap('pre,textarea', true);

// 符合上面的条件，然后下一个元素为换行符时，忽略
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr(value, shouldDecodeNewlines) {
    const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
    return value.replace(re, match => decodingMap[match])
}

export function parseHTML(html, options) {
    const stack = [];
    const expectHTML = options.expectHTML;
    const isUnaryTag = options.isUnaryTag || no;
    const canBeLeftOpenTag = options.canBeLeftOpenTag || no;

    // 一个指针，表示当前解析到原始模版的具体位置
    let index = 0;
    let last, lastTag;
    while (html) {
        last = html;

        // Make sure we're not in a plaintext content element like script/style
        // 确保我们不在script/style元素中
        if (!lastTag || !isPlainTextElement(lastTag)) {
            let textEnd = html.indexOf('<');

            // 当前截取的模版起始为<(无空格换行符等等)
            // 第一个位置匹配到<无非是5种情况
            // 1. <div>头标签
            // 2. <!-->普通注释
            // 3. <![]>条件注释
            // 4. </div>闭合标签
            // 5. <doctype>文档类型定义
            if (textEnd === 0) {
                // Comment:
                if (comment.test(html)) {
                    const commentEnd = html.indexOf('-->');

                    // 是个注释结点嘚
                    if (commentEnd >= 0) {

                        // 如果设置要保存注释结点，那么将注释结点化为AST并挂载在当前父节点下（没有父节点就算了）
                        if (options.shouldKeepComment) {
                            options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
                        }

                        advance(commentEnd + 3);
                        continue;
                    }
                }

                // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
                // 如果当前为条件注释，则直接前进，不进行保存
                if (conditionalComment.test(html)) {
                    const conditionalEnd = html.indexOf(']>')

                    if (conditionalEnd >= 0) {
                        advance(conditionalEnd + 2)
                        continue
                    }
                }

                // Doctype:
                // 是否为doctype标签
                const doctypeMatch = html.match(doctype)
                if (doctypeMatch) {
                    advance(doctypeMatch[0].length)
                    continue
                }

                // End tag:
                // 是否为一个闭合标签, 如果是则截取模版，然后将
                const endTagMatch = html.match(endTag);
                if (endTagMatch) {
                    const curIndex = index;
                    advance(endTagMatch[0].length);
                    parseEndTag(endTagMatch[1], curIndex, index)
                    continue;
                }

                // Start tag:
                // 解析头标签，生成ast对象
                const startTagMatch = parseStartTag();

                if (startTagMatch) {

                    // 处理元素ast对象的各种属性
                    handleStartTag(startTagMatch);
                    if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
                        advance(1);
                    }
                    continue;
                }
            }

            let text, rest, next;

            // 模版第一位为<或<前存在其他字符
            if (textEnd >= 0) {

                // 取首个<后的模版
                rest = html.slice(textEnd);

                // 从当前<开始不能组成一个标签时，取下一个<直至解析到标签或头标签前部分
                // 简单说就是取到下一个疑是标签的<为止
                while (
                    !endTag.test(rest) &&

                    // 这里匹配开标签前部分
                    !startTagOpen.test(rest) &&
                    !comment.test(rest) &&
                    !conditionalComment.test(rest)
                ) {
                    // < in plain text, be forgiving and treat it as text
                    // 说明当前<是字符串，那么再取下一个<的位置
                    next = rest.indexOf('<', 1);

                    // 说明没有标签了，剩下全为文本
                    if (next < 0) break;

                    // 将下个< 之前的文本追加上去
                    textEnd += next;

                    // 继续截取模版，取最新<后的模版
                    rest = html.slice(textEnd);
                }

                // 截取模版开始到下一个<之间的文本
                text = html.substring(0, textEnd);
            }

            // 未找到 < 时，视为全部为文本
            if (textEnd < 0) {
                text = html
            }

            if (text) {

                // 存在文本时，更新模版
                advance(text.length);
            }

            // 创建文本的ast对象
            if (options.chars && text) {
                options.chars(text, index - text.length, index);
            }
        } else {
            let endTagLength = 0;
            const stackedTag = lastTag.toLowerCase();

            // 存储该标签头标签后到闭合标签为止的的正则表达式
            const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'));

            // 直接找到该标签的闭合标签
            const rest = html.replace(reStackedTag, function (all, text, endTag) {
                endTagLength = endTag.length;

                // 非这特殊标签包括noscript标签时的其他特殊文本标签时，取出其文本内容
                if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
                    text = text
                        .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
                        .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
                }

                // 老问题，textarea和pre头标签后会自带个换行符
                if (shouldIgnoreFirstNewline(stackedTag, text)) {
                    text = text.slice(1)
                }

                // 将中间的文本生成文本节点
                if (options.chars) {
                    options.chars(text);
                }
                return ''
            });

            // 手动移动指针和截取模版
            index += html.length - rest.length;
            html = rest;
            parseEndTag(stackedTag, index - endTagLength, index);
        }

        // 解析前后模版未变，那么剩下的全作为文本解析
        if (html === last) {
            options.chars && options.chars(html)
            if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
                options.warn(`Mal-formatted tag at end of template: "${html}"`, {
                    start: index + html.length
                })
            }
            break;
        }
    }

    // Clean up any remaining tags
    parseEndTag()

    // 截取剩下的模版字符串， 移动当前指针的下标
    function advance(n) {
        index += n
        html = html.substring(n)
    }

    function parseStartTag() {

        // 匹配头标签信息，这里只包括 <tagName 这部分
        const start = html.match(startTagOpen);

        // 如果匹配到了头标签
        if (start) {

            // 为匹配的标签名创建一个ast对象
            const match = {
                tagName: start[1],
                attrs: [],
                start: index
            };

            // 截取剩下的模版，并移动当前指针
            advance(start[0].length);

            // 匹配标签上的属性
            // 一次循环提取一个标签的属性，并移动指针，直到当前指针指向标签的>
            let end,  // 头标签的尾号，只匹配以>或 >开头(前面有个空格)
                attr; // 当前匹配到的属性，一次匹配一个
            while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
                attr.start = index;

                // 每匹配到一个属性便截取次模版并更新当前的指针，然后更新该属性在原始模版中的位置信息
                advance(attr[0].length);
                attr.end = index;

                // 将当前属性的匹配完成后，将其信息数组放入ast对象的attrs数组中
                match.attrs.push(attr);
            }

            // 匹配到头标签的>时，这个标签的属性信息就解析完成了，更新下该标签在原始模版中位置信息，并截取模版
            if (end) {

                // 头标签最后的/，自闭和标签就有，比如input元素
                match.unarySlash = end[1];
                advance(end[0].length);
                match.end = index;
                return match;
            }
        }
    }

    function handleStartTag(match) {

        // 标签名
        const tagName = match.tagName;

        // 是否为一元标签
        const unarySlash = match.unarySlash;

        // 处理两种特殊情况
        if (expectHTML) {

            // 如果上一个未闭合的元素是p时，则其中不能包含块级元素，要手动闭合p元素
            if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
                parseEndTag(lastTag);
            }

            // 如果上一个未闭合的元素和现在的标签是同一标签，且为自闭和标签，那么要闭合当前标签
            if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
                parseEndTag(tagName);
            }
        }

        // 是否为一元标签，头标签自带/ 或符合以下的原生标签
        const unary = isUnaryTag(tagName) || !!unarySlash;

        // 将attrs中的各个属性进一步转换为对象形式
        const l = match.attrs.length;
        const attrs = new Array(l);
        for (let i = 0; i < l; i++) {
            const args = match.attrs[i];
            const value = args[3] || args[4] || args[5] || '';

            // 是否需要解码换行符(兼容浏览器)
            const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href' ?
                options.shouldDecodeNewlinesForHref :
                options.shouldDecodeNewlines;

            // 重写原数组元素中的元素
            attrs[i] = {
                name: args[1],
                value: decodeAttr(value, shouldDecodeNewlines)
            };

            // 开发模式下记录属性的在原始模版中的具体位置信息
            if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {

                // 因为之前匹配的属性条时，可能前面包含空格，所以要加上空格的长度
                attrs[i].start = args.start + args[0].match(/^\s*/).length;
                attrs[i].end = args.end;
            }
        }

        // 非一元标签时，说明其为一个前面打开的标签，后面还需一个闭合标签，所以将其存入栈中暂存
        if (!unary) {
            stack.push({
                tag: tagName,
                lowerCasedTag: tagName.toLowerCase(),
                attrs: attrs,
                start: match.start,
                end: match.end
            });

            // 此时更新当前标签为上一个处理的标签
            lastTag = tagName;
        }

        if (options.start) {

            // 传入参数为当前标签在原始模版中的位置信息，和属性的信息
            options.start(tagName, attrs, unary, match.start, match.end)
        }
    }

    function parseEndTag(tagName, start, end) {
        let pos, lowerCasedTagName;
        if (start == null) start = index;
        if (end == null) end = index

        // Find the closest opened tag of the same type
        // 找到最近的同类型标签，未找到则pos为-1
        if (tagName) {
            lowerCasedTagName = tagName.toLowerCase();
            for (pos = stack.length - 1; pos >= 0; pos--) {
                if (stack[pos].lowerCasedTag === lowerCasedTagName) {
                    break;
                }
            }
        } else {
            // If no tag name is provided, clean shop
            // 未提供标签名时，清空之后的标签
            pos = 0;
        }

        // 找到对应标签的情况时
        if (pos >= 0) {

            // Close all the open elements, up the stack
            for (let i = stack.length - 1; i >= pos; i--) {
                if (process.env.NODE_ENV !== 'production' &&
                    (i > pos || !tagName) &&
                    options.warn
                ) {
                    options.warn(
                        `tag <${stack[i].tag}> has no matching end tag.`, {
                            start: stack[i].start,
                            end: stack[i].end
                        }
                    )
                }
                if (options.end) {
                    options.end(stack[i].tag, start, end)
                }
            }

            // Remove the open elements from the stack
            stack.length = pos
            lastTag = pos && stack[pos - 1].tag
        } else if (lowerCasedTagName === 'br') {
            if (options.start) {
                options.start(tagName, [], true, start, end)
            }
        } else if (lowerCasedTagName === 'p') {
            if (options.start) {
                options.start(tagName, [], false, start, end)
            }
            if (options.end) {
                options.end(tagName, start, end)
            }
        }
    }
}