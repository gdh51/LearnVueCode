# 处理头标签

我们知道当匹配到`<`时，有一种情况就是头标签，此时就会对头标签进行处理，具体的处理过程我们来详细看一下：

```js
// 解析头标签的标签和其上属性，生成未处理的原始匹配对象
const startTagMatch = parseStartTag();

if (startTagMatch) {

    // 处理元素对象的各种属性
    handleStartTag(startTagMatch);

    // 处理浏览器对pre/textarea的换行符问题
    if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {

        // 跳过该换行符
        advance(1);
    }
    continue;
}
```

我们先从`parseStartTag()`函数看起：

## parseStartTag()——简单解释头标签信息

这个函数用来为标签头部生成原始的匹配对象信息，会记录标签在原模版的位置信息和标签属性的具体信息。

下面是具体匹配标签的正则表达式，了解下就行了

```js
// 匹配以字母或_开头的字符串，unicodeRegExp是匹配任何字符的一个Regexp
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;

// 匹配 xxx:xxx 或 xxx
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;

// 以头标签<tagName开头的
const startTagOpen = new RegExp(`^<${qnameCapture}`);

// 头标签闭合部分(只匹配以>或 >开头的, 注意这里有空格)
const startTagClose = /^\s*(\/?)>/;

// Regular Expressions for parsing tags and attributes
// 匹配用户定义的属性，匹配时还会匹配上一个属性到现在这个属性之间的空格
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
```

下面是具体的解析过程，会从模版当前头开始匹配，先匹配前括号加标签名，之后便是一个属性一个匹配，每次匹配后都会截取模版与指针，直到匹配到头标签的后尖括号：

```js
function parseStartTag() {

    // 匹配头标签信息，这里只包括 <tagName 这部分
    const start = html.match(startTagOpen);

    // 如果匹配到了头标签
    if (start) {

        // 为匹配的标签名创建一个匹配对象
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
        while (!(end = html.match(startTagClose)) && (attr = html.matc(dynamicArgAttribute) || html.match(attribute))) {

            // 此时匹配的start包括属性上的空格
            attr.start = index;

            // 每匹配到一个属性便截取次模版并更新当前的指针，然后更新该属性在原始模版中的位置信息
            advance(attr[0].length);
            attr.end = index;

            // 将当前属性的匹配完成后，将其信息数组放入匹配对象的attrs数组中
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
```

匹配完后，返回当前原始的匹配对象，整个流程图大致如下：
![初步处理头标签](./imgs/初步处理头标签.svg)

接下来如果顺利匹配获取了匹配对象，那么就会调用`handleStartTag()`对标签的位置信息进行处理。

## handleStartTag()——处理标签DOM位置信息、属性信息

该方法首先用来处理了头标签的一些特殊的情况，如`<pre>`标签不能包含块级元素，自闭合标签不能嵌套自身等问题，之后便根据匹配对象上原始的属性数组简单处理下便挂载在新的标签对象中，根据标签具体的位置和自身情况（是否为一元标签），将标签的信息所代表的对象加入到了栈中，之后对标签上的属性全部进行处理。

>加入栈中这个情况很好理解，因为如果你不是一元标签，那么说明当前标签还处于开起状态，待里面内容处理完成后才能对其进行闭合。

具体的代码如下，因为基本上没有复杂的地方，所以直接在注释中解释：

```js
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

        // 将attrs中的各个属性进一步转换为对象形式，然后用新数组承载
        const l = match.attrs.length;
        const attrs = new Array(l);
        for (let i = 0; i < l; i++) {
            const args = match.attrs[i];
            const value = args[3] || args[4] || args[5] || '';

            // 是否需要解码换行符(兼容浏览器)
            const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href' ?
                options.shouldDecodeNewlinesForHref :
                options.shouldDecodeNewlines;

            // 对应模版中属性的位置
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
            options.start(tagName, attrs, unary, match.start, match.end)
        }
    }
```

上述处理过程中，我们**并未对标签的匹配对象进行修改**，而是对原属性数组进行处理后，生成新的`attrs`数组来存放这份信息，该信息被挂载在`stack`数组中代表当前头标签的对象中。

其实上面的文字描述过程中，我还没有具体提到`options.start()`，因为比较复杂，我们现在来看一下，它开始正式对对象的属性进行处理：
(先初略看一下，下面我会根据代码一个一个解释)

```js
start(tag, attrs, unary, start, end) {

    // check namespace.
    // inherit parent ns if there is one
    // 检查是否有命名空间，有就继承父级的命名空间
    const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

    // handle IE svg bug
    // 处理IE浏览器svg的bug
    if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
    }

    // 创建元素的AST对象
    let element: ASTElement = createASTElement(tag, attrs, currentParent);

    // 有命名空间就挂载该属性
    if (ns) {
        element.ns = ns
    }


    if (process.env.NODE_ENV !== 'production') {
        if (options.outputSourceRange) {

            // 添加该元素在原始模版中的位置信息
            element.start = start;
            element.end = end;

            // 将原始匹配对象由数组形式转换为对象形式
            element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
                cumulated[attr.name] = attr;
                return cumulated;
            }, {});
        }

        // 检测属性名中是否含有非法符号
        attrs.forEach(attr => {
            if (invalidAttributeRE.test(attr.name)) {
                warn(
                    `Invalid dynamic argument expression: attribute names cannot contain ` +
                    `spaces, quotes, <, >, / or =.`, {
                        start: attr.start + attr.name.indexOf(`[`),
                        end: attr.start + attr.name.length
                    }
                )
            }
        });
    }

    // 使用了禁止的标签时报错(script或style)
    if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
            'Templates should only be responsible for mapping the state to the ' +
            'UI. Avoid placing tags with side-effects in your templates, such as ' +
            `<${tag}>` + ', as they will not be parsed.', {
                start: element.start
            }
        )
    }

    // apply pre-transforms
    // 如果是input标签且定义有v-model属性时，才会对其进行一次预处理
    for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element;
    }

    // // 确认当前元素是否在父元素有v-pre属性的元素中
    if (!inVPre) {

        // 移除AST attr中v-pre属性，并给元素添加pre属性作为标记
        processPre(element);

        // 检测元素是否具有标记
        if (element.pre) {

            // 标记当前编译状态
            // 未到闭合元素之前，都处于该元素之中，所以不做编译处理
            inVPre = true;
        }
    }

    // 该元素是否为pre元素
    if (platformIsPreTag(element.tag)) {
        inPre = true;
    }

    // 当前元素处于v-pre元素或父元素中，不处理for/if/once属性
    if (inVPre) {
        processRawAttrs(element);

    // 如果元素还未完全处理完毕时
    } else if (!element.processed) {
        // structural directives

        // 处理v-for属性
        processFor(element);

        // 处理v-if v-else v-else-if属性
        processIf(element);

        // 处理v-once属性
        processOnce(element);
    }

    // 如果还未确定根元素时，那当前元素作为根元素
    if (!root) {
        root = element;

        // 检查根节点是否可能不为一个元素
        if (process.env.NODE_ENV !== 'production') {
            checkRootConstraints(root);
        }
    }

    // 如果不是一元元素，那么替换父元素为当前元素，并推入栈中等待闭合
    if (!unary) {
        currentParent = element;
        stack.push(element);
    } else {

        // 为一元元素时，直接闭合
        closeElement(element);
    }
},
```

首先我们可以看到该函数处理下标签命名空间兼容性问题后，便通过`createASTElement()`方法生成了代表元素的AST对象，传入的参数`attrs`是我们在[`handleStartTag()`](#handlestarttag%e5%a4%84%e7%90%86%e6%a0%87%e7%ad%bedom%e4%bd%8d%e7%bd%ae%e4%bf%a1%e6%81%af%e5%b1%9e%e6%80%a7%e4%bf%a1%e6%81%af)时，生成的新的属性数组。

生成的AST对象的`attrsMap`属性，即，将`attrs`由数组形式转化为对应属性名键值形式，放个图大家感受下：

![初步生成的元素AST](./imgs/初步生成的元素AST.png)

下面是代码：

```js
function createASTElement(
    tag: string,

    // 新的简单处理的属性数组
    attrs: Array < ASTAttr > ,
    parent: ASTElement | void
): ASTElement {
    return {
        type: 1,
        tag,

        // 原始匹配对象上简单处理后的属性数组
        attrsList: attrs,

        // 将属性按键值形式添加至对象中
        attrsMap: makeAttrsMap(attrs),
        rawAttrsMap: {},
        parent,
        children: []
    }
}

function makeAttrsMap(attrs: Array < Object > ): Object {
    const map = {};

    // 将属性按键值形式添加至对象中
    for (let i = 0, l = attrs.length; i < l; i++) {

        // 属性重复时，提示用户(对这种情况就是你写在模版里面时会出现)，此时新值会覆盖旧值
        if (
            process.env.NODE_ENV !== 'production' &&
            map[attrs[i].name] && !isIE && !isEdge
        ) {
            warn('duplicate attribute: ' + attrs[i].name, attrs[i])
        }
        map[attrs[i].name] = attrs[i].value
    }
    return map;
}
```

之后便是对AST元素对象的位置信息进行补充，然后又对AST对象上的`rawAttrsMap`属性进行更新，这个属性其实就是`attrs`数组转换为对象的形式：属性名做键名，之前的数组元素做值，还是放张图：
![rawAttrsMap](./imgs/rawAttrsMap.png)

之后便是调用`preTransforms`数组中的方法，对ast元素对象上一些属性进行预处理；`preTransforms`数组中仅存在一个方法即`preTransformNode()`，该方法只是针对`<input>`元素来做单独的处理的。

能被做处理的`input`元素还应该满足两个条件：

1. 具有`v-model`属性
2. 动态定义了`type`属性

具体[preTransformNode()](../../一群工具方法/README.md#pretransformnode%e5%a4%84%e7%90%86%e5%8f%8c%e5%90%91%e7%bb%91%e5%ae%9a%e7%9a%84input%e5%85%83%e7%b4%a0)

接下来会检查该元素是否处于具有`v-pre`的祖先元素中，是则跳过该段代码，不是则检测当前元素是否具有`v-pre`属性，具有时调用[`processPre()`](../../一群工具方法/处理属性/README.md#processpre%e5%a4%84%e7%90%86v-pre%e5%b1%9e%e6%80%a7)给该元素添加`pre`标记位，并标记当前检测从当前元素深度开始的元素都不进行编译处理。
___

接下来是对`<pre>`元素的检测，是该元素时，标记当前检测开始处于该元素中。之后是针对是否处于`v-pre`的元素中，做出的两种处理：

- 处于：调用[`processRawAttrs()`](../../一群工具方法/处理属性/README.md#processrawattrs%e7%9b%b4%e6%8e%a5%e6%a0%87%e8%ae%b0%e6%9c%aa%e5%a4%84%e7%90%86%e5%b1%9e%e6%80%a7%e4%b8%ba%e5%b7%b2%e5%a4%84%e7%90%86)处理
- 不处于且从未处理过该元素属性时：分别处理[`v-for`](../../一群工具方法/处理属性/README.md#processfor%e5%a4%84%e7%90%86v-for%e8%a1%a8%e8%be%be%e5%bc%8f)/[`v-if`](../../一群工具方法/处理属性/README.md#processif%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0v-ifv-elsev-else-if%e5%b1%9e%e6%80%a7)/[`v-once`](../../一群工具方法/处理属性/README.md#processonce%e5%a4%84%e7%90%86v-once%e5%b1%9e%e6%80%a7)属性

之后就是对当前模版中的根元素的确认，并调用`checkRootConstraints()`检查其是否合法，最后检测该元素是否为一元元素：

- 是：使用[`closeElement(element)`](#closeelementelement%e9%97%ad%e5%90%88%e5%85%83%e7%b4%a0)进行闭合
- 否：该元素还缺个闭合标签，所以将该元素推入`stack`中，更新当前父元素为该元素(为下一个元素的父元素做准备)

### closeElement(element)——闭合元素

先看代码，因为不简单，为先总结下，处理元素剩余的属性，然后建立和父元素的关系：

```js
    function closeElement(element) {

        // 清空最后的空格节点
        trimEndingWhitespace(element);

        // 非处于v-pre元素中且元素还未完成属性处理时，对其剩余属性进行处理
        if (!inVPre && !element.processed) {
            element = processElement(element, options);
        }

        // tree management
        // 当元素不为根元素且当前元素不处于其他元素内部时
        if (!stack.length && element !== root) {

            // allow root elements with v-if, v-else-if and v-else
            // 允许根元素带有if属性，当前元素是否存在else条件语法
            if (root.if && (element.elseif || element.else)) {

                // 检查当前元素是否为多个元素
                if (process.env.NODE_ENV !== 'production') {
                    checkRootConstraints(element);
                }

                // 将该元素添加至另一个条件判断中
                addIfCondition(root, {
                    exp: element.elseif,
                    block: element
                });
            } else if (process.env.NODE_ENV !== 'production') {

                // 报错，肯定用了多个元素做根元素
                warnOnce(
                    `Component template should contain exactly one root element. ` +
                    `If you are using v-if on multiple elements, ` +
                    `use v-else-if to chain them instead.`, {
                        start: element.start
                    }
                )
            }
        }

        // 当前元素为子元素时，且未被禁用时
        if (currentParent && !element.forbidden) {

            // 处理元素elseif与else条件
            if (element.elseif || element.else) {

                // 添加该元素至上一个v-if元素的显示判断条件队列中
                processIfConditions(element, currentParent)
            } else {

                // 具有插槽绑定值时
                if (element.slotScope) {

                    // scoped slot
                    // 插槽名称
                    const name = element.slotTarget || '"default"';

                    // 将该元素存储到父元素的插槽作用域中
                    (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
                }

                // keep it in the children list so that v-else(-if) conditions can
                // find it as the prev node.
                // 将当前元素加入父元素的子队列中
                currentParent.children.push(element);
                element.parent = currentParent;
            }
        }

        // final children cleanup
        // filter out scoped slots
        // 最后对children属性进行清理，删除插槽元素
        element.children = element.children.filter(c => !(c: any).slotScope);

        // remove trailing whitespace node again
        // 这个为就不用解释了
        trimEndingWhitespace(element);

        // check pre state
        // 最后归还状态
        if (element.pre) {
            inVPre = false;
        }
        if (platformIsPreTag(element.tag)) {
            inPre = false;
        }

        // apply post-transforms
        // 只存在于weex下
        for (let i = 0; i < postTransforms.length; i++) {
            postTransforms[i](element, options)
        }
    }
```

首先国际管理，调用`trimEndingWhitespace()`清除子节点中最后的全部空白节点：

```js
function trimEndingWhitespace(el) {

    // remove trailing whitespace node
    // 清除最后的全部空格节点
    if (!inPre) {
        let lastNode;

        // 尾节点不为空白节点就结束
        while (
            (lastNode = el.children[el.children.length - 1]) &&
            lastNode.type === 3 &&
            lastNode.text === ' '
        ) {
            el.children.pop()
        }
    }
}
```

之后调用[processElement()](../../一群工具方法/处理属性/README.md#processelement%e5%a4%84%e7%90%86%e5%85%83%e7%b4%a0%e4%b8%8a%e5%85%b6%e4%bd%99%e7%9a%84%e5%b1%9e%e6%80%a7)对元素的剩余属性进行处理，包括`vue`的各种语法属性，和一些普通属性。(**前提是该元素属性未处理完且不存在于`v-pre`元素中**)
___

接下来是检查当前元素是否是这种情况——**该元素不为根元素且当前元素不处于其他元素内部时**，按我之前的理解它肯定应该是个根元素。再继续看就会发现，Vue允许有多个根节点，但它们之间必须存在`v-if`/`v-else`/`v-else-if`之类的关系:

```js
// 允许多个根元素，但必须存在条件显示关系
if (root.if && (element.elseif || element.else)) {

    // 检查当前元素是否为多个元素
    if (process.env.NODE_ENV !== 'production') {
        checkRootConstraints(element);
    }

    // 将该元素添加至另一个条件判断中
    addIfCondition(root, {
        exp: element.elseif,
        block: element
    });
}
```

处理完根元素，当然现在该处理子元素了，但凡该子元素未被禁用，它就会被处理，具体处理方式两种，也很容易想：

- 具有`v-else`/`v-else-if`，就将其加入`v-if`元素的条件队列中
- 其余元素加入父元素子队列中

```js
// 当前元素为子元素时，且未被禁用时
if (currentParent && !element.forbidden) {

    // 处理元素elseif与else条件
    if (element.elseif || element.else) {

        // 添加该元素至上一个v-if元素的显示判断条件队列中
        processIfConditions(element, currentParent)
    } else {

        // 具有插槽绑定值时
        if (element.slotScope) {

            // scoped slot
            // 插槽名称
            const name = element.slotTarget || '"default"';

            // 将该元素存储到父元素的插槽作用域中
            (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        }

        // keep it in the children list so that v-else(-if) conditions can
        // find it as the prev node.
        // 将当前元素加入父元素的子队列中
        currentParent.children.push(element);
        element.parent = currentParent;
    }
}
```

上面[`processIfConditions()`](../../一群工具方法/处理属性/README.md#processifconditions%e6%b7%bb%e5%8a%a0elseelse-if%e6%9d%a1%e4%bb%b6%e8%af%ad%e5%8f%a5%e5%9d%97)就是用来将`v-else/v-else-if`元素添加至`v-if`元素的显示条件队列的。
___

之后清除父元素下的插槽元素，然后还原两个`pre`状态，就结束了。

## shouldIgnoreFirstNewline()——处理头标签后换行符

待我们处理完一个新的标签头时，还会检查该元素是否为`pre`或`textarea`元素，如果是则要查看模版当前位置是否为换行符，是要直接跳过。

```js
// #5992
// 是否为pre/textarea元素
const isIgnoreNewlineTag = makeMap('pre,textarea', true);

// 符合上面的条件，然后下一个元素为换行符时，忽略
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n';
```

具体原因是因为这两个元素自身在开始标记之后会立即放置一个`\n`，即使我们并没有换行，即

```html
<pre>
    html
</pre>

<pre>html</pre>
```

上面两种写法是等价的。[W3C文档说明](https://html.spec.whatwg.org/multipage/syntax.html#element-restrictions)
[#5992 Vue issue](https://github.com/vuejs/vue/issues/5992)

## 总结——结尾

到此为止对一个头标签的解析就结束了，我们可以总结一下这个过程，总共分为两个阶段：

1. 通过`while`循环，从标签`<`解析到`>`，生成匹配对象，将其中的属性按键值形式添加至`attrs`中
2. 生成该元素的`ast`元素对象，解析该匹配对象`attrs`中的属性到该`ast`对象上，再按该元素是否为一元元素做出两种抉择：
   1. 一元元素：闭合该元素
   2. 非一元元素：将该元素推入`stack`中等待闭合