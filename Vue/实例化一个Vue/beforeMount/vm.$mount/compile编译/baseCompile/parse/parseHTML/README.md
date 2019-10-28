# parseHTML

咂一看这个函数，那是真的复杂，绝对看得你头昏烟瘴，先简单浏览一下这个函数的结构。

```js
function parseHTML(html, options) {
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

            // 当前模版前存在空格时
            let text, rest, next;
            if (textEnd >= 0) {
                rest = html.slice(textEnd);

                // 当不为标签，为文本时
                while (
                    !endTag.test(rest) &&
                    !startTagOpen.test(rest) &&
                    !comment.test(rest) &&
                    !conditionalComment.test(rest)
                ) {
                    // < in plain text, be forgiving and treat it as text
                    next = rest.indexOf('<', 1)
                    if (next < 0) break
                    textEnd += next;
                    rest = html.slice(textEnd);
                }
                text = html.substring(0, textEnd);
            }

            // 未找到 < 时，视为全部为文本
            if (textEnd < 0) {
                text = html
            }

            if (text) {
                advance(text.length)
            }

            if (options.chars && text) {
                options.chars(text, index - text.length, index)
            }
        } else {
            let endTagLength = 0
            const stackedTag = lastTag.toLowerCase()
            const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
            const rest = html.replace(reStackedTag, function (all, text, endTag) {
                endTagLength = endTag.length
                if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
                    text = text
                        .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
                        .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
                }
                if (shouldIgnoreFirstNewline(stackedTag, text)) {
                    text = text.slice(1)
                }
                if (options.chars) {
                    options.chars(text)
                }
                return ''
            })
            index += html.length - rest.length
            html = rest
            parseEndTag(stackedTag, index - endTagLength, index)
        }

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
}
```

一眼观察过来，整个解析字符串过程全是在`while`循环中完成的。

首先在while循环内部，大致按情况会进行两个操作
```js
const isPlainTextElement = makeMap('script,style,textarea', true);

// 简化的代码
while (html) {
    last = html;

    // 一般情况，只要是个非文本域类型的标签
    if (!lastTag || !isPlainTextElement(lastTag)) {
        // ...

    // 特殊标签的处理
    } else {
        // ...
    }

    // 处理完后模版字符串无变化的情况
    if (html === last) { /* ... */ }
}
```

接下来开始对第一种情况，进行深入了解，下面先看一下简化后的代码：
```js
// 找到第一个 < 的位置
let textEnd = html.indexOf('<');
if (textEnd === 0) { /**/ }

let text, rest, next;
if (textEnd >= 0) { /**/ }
if (textEnd < 0) { /**/ }
if (text) { /**/ }
if (options.chars && text)
```

首先我们对`<`字符进行了一次查找，因为之前调用`parse()`传入模版时，对模版进行了`template.trim()`处理，所以第一次找到的位置一定是0。

当我们找到`<`字符时，无非就是有6种情况涉及该字符：

- `<div>`头标签
- `<!-->`普通注释
- `<![]>`条件注释
- `</div>`闭合标签
- `<doctype>`文档类型定义
- 普通的字符

但由于处于位置的问题，它一定不是第6种情况。(因为我们最初取的是元素的`outerHTML`)，首先看一个`advance()`方法，用于更新当前模版：

```js
// 截取剩下的模版字符串， 移动当前指针的下标
function advance(n) {

    // 移动当前模版起始指针位置
    index += n;

    // 截取剩下未解析的模版
    html = html.substring(n);
}
```

具体看下源码怎么进行处理的：

```js
// 普通注释
const comment = /^<!\--/;

// 条件注释
const conditionalComment = /^<!\[/;

// 匹配文档类型定义
const doctype = /^<!DOCTYPE [^>]+>/i;

if (textEnd === 0) {

    // Comment: 处理普通注释，满足注释节点开头的匹配 <--
    if (comment.test(html)) {

        // 注释结束的地方
        const commentEnd = html.indexOf('-->');

        // 有注释的闭合存在，没有可能就是普通的内容信息了
        if (commentEnd >= 0) {

            // 如果设置要在渲染后保存注释结点信息，那就生成一个AST节点并挂载在当前父节点的子节点数组中(没有父节点则不做处理)
            if (options.shouldKeepComment) {

                // 传入的参数为具体的注释段，与注释在模版中的位置信息
                options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }

            //  更新模版，进行下一次检测
            advance(commentEnd + 3);
            continue;
        }
    }

    // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
    // 如果当前为条件注释，则直接跳过，然后更新模版
    if (conditionalComment.test(html)) {
        const conditionalEnd = html.indexOf(']>');

        if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2);
            continue;
        }
    }

    // Doctype:
    // 为文档类型定义内容时，也是直接跳过，不做任何处理
    const doctypeMatch = html.match(doctype);
    if (doctypeMatch) {
        advance(doctypeMatch[0].length)
        continue
    }

    // End tag:
    // 当为一个标签的结束标签时
    const endTagMatch = html.match(endTag);
    if (endTagMatch) {

        // 记录当前在原始模版中的位置
        const curIndex = index;

        // 更新模版和指针
        advance(endTagMatch[0].length);
        parseEndTag(endTagMatch[1], curIndex, index);
        continue;
    }

    // Start tag:
    // 解析头标签的标签和其上属性，生成未处理的ast对象
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
```

上面使用到的`options.comment()`方法是用来处理注释节点的，生成一个注释节点的AST对象：
```js
comment(text: string, start, end) {
    // adding anyting as a sibling to the root node is forbidden
    // comments should still be allowed, but ignored
    // 有父节点，就挂载在父节点的子数组中，标记该注释节点在原始模版中的位置信息
    if (currentParent) {
        const child: ASTText = {
            type: 3,
            text,
            isComment: true
        }

        // 开发模式下记录位置信息
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
            child.start = start
            child.end = end
        }

        currentParent.children.push(child);
    }
}
```

在上述过程中，调用了`parseEndTag()`来处理结束标签，传入了尾标签名和整个结束标签在原始模版中的位置信息，它具体的流程是：
```js
function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName;

    // 未传入结束位置时，手动获取下
    if (start == null) start = index;
    if (end == null) end = index

    // Find the closest opened tag of the same type
    // 找到最近的同类型且未闭合的标签
    if (tagName) {
        lowerCasedTagName = tagName.toLowerCase();

        // 取出存放入栈中的未闭合标签，一个个匹配
        for (pos = stack.length - 1; pos >= 0; pos--) {

            // 匹配标签名时，赶紧退出，保留pos信息
            if (stack[pos].lowerCasedTag === lowerCasedTagName) {
                break;
            }
        }
    } else {
        // If no tag name is provided, clean shop
        // 标签名都没有时，
        pos = 0;
    }

    // 通过上面，我们可以知道未匹配到对应标签时，pos的值为-1
    // 此时找到对应标签的情况时
    if (pos >= 0) {

        // Close all the open elements, up the stack
        // 闭合所有匹配位置后的开启的标签
        for (let i = stack.length - 1; i >= pos; i--) {
            if (process.env.NODE_ENV !== 'production' &&

                // 正常情况下，结束标签应该匹配栈中最后个开启的标签，不然就说明中间有无闭合标签的标签
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

            // 手动帮你闭合所有应该闭合的标签，参数为在原始模版中的位置
            if (options.end) {
                options.end(stack[i].tag, start, end);
            }
        }

        // Remove the open elements from the stack
        // 移除上面for循环中已闭合的标签
        stack.length = pos;
        lastTag = pos && stack[pos - 1].tag;

    // 全部栈中都未匹配到头标签时，两种情况，自闭和标签或br标签
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
```

这期间，调用了`options.end()`方法来进行标签的闭合，具体代码为：
```js
end(tag, start, end) {

    // 取出当前元素，pop操作
    const element = stack[stack.length - 1];
    stack.length -= 1;

    // 取出其父元素
    currentParent = stack[stack.length - 1];

    // 因为元素已经找到闭合位置了，所以就可以更新具体结束位置了
    if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end;
    }
    closeElement(element);
}
```

```js
function trimEndingWhitespace(el) {

    // remove trailing whitespace node
    // 清除el子节点中最后的空格节点(不处理v-pre标签)
    if (!inPre) {
        let lastNode;
        while (
            (lastNode = el.children[el.children.length - 1]) &&
            lastNode.type === 3 &&
            lastNode.text === ' '
        ) {
            el.children.pop()
        }
    }
}

function closeElement(element) {

    // 清空element子节点中最后的空格节点
    trimEndingWhitespace(element);

    // 非v-pre元素且元素还未处理属性时，对其属性进行处理
    if (!inVPre && !element.processed) {
        element = processElement(element, options);
    }

    // tree management
    // 当元素不为根元素且不为内部元素时
    if (!stack.length && element !== root) {

        // allow root elements with v-if, v-else-if and v-else
        // 运行根元素带有if属性
        if (root.if && (element.elseif || element.else)) {

            // 检查根元素是否为多个元素
            if (process.env.NODE_ENV !== 'production') {
                checkRootConstraints(element);
            }

            // 为根元素添加if属性
            addIfCondition(root, {
                exp: element.elseif,
                block: element
            });
        } else if (process.env.NODE_ENV !== 'production') {
            warnOnce(
                `Component template should contain exactly one root element. ` +
                `If you are using v-if on multiple elements, ` +
                `use v-else-if to chain them instead.`, {
                    start: element.start
                }
            )
        }
    }

    // 当前元素为子元素时，且未被禁用时，处理if属性与slot属性
    if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
            processIfConditions(element, currentParent)
        } else {
            if (element.slotScope) {
                // scoped slot
                // keep it in the children list so that v-else(-if) conditions can
                // find it as the prev node.
                const name = element.slotTarget || '"default"';
                (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
            }
            currentParent.children.push(element);
            element.parent = currentParent;
        }
    }

    // final children cleanup
    // filter out scoped slots
    // 对children属性进行清理，删除插槽children
    element.children = element.children.filter(c => !(c: any).slotScope);
    // remove trailing whitespace node again
    trimEndingWhitespace(element);

    // check pre state
    if (element.pre) {
        inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
        inPre = false
    }
    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
    }
}
```
