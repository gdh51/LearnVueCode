# 处理头标签
我们知道当匹配到`<`时，有一种情况就是头标签，此时就会对头标签进行处理，具体的处理过程我们来详细看一下：
```js
// 解析头标签的标签和其上属性，生成未处理的原始ast对象
const startTagMatch = parseStartTag();

if (startTagMatch) {

    // 处理元素ast对象的各种属性
    handleStartTag(startTagMatch);
    if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
        advance(1);
    }
    continue;
}
```

我们先从`parseStartTag()`函数看起

## parseStartTag()
这个函数用来为标签头部生成原始的ast对象信息，会记录标签在原模版的位置信息和标签属性的具体信息。

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
```

下面是具体的解析过程，会从模版当前头开始匹配，先匹配前括号加标签名，之后便是一个属性一个匹配，每次匹配后都会截取模版与指针，直到匹配到头标签的后尖括号：

```js
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
        while (!(end = html.match(startTagClose)) && (attr = html.matc(dynamicArgAttribute) || html.match(attribute))) {
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
```

匹配完后，返回当前原始的AST对象，整个流程图大致如下：
![初步处理头标签](./imgs/初步处理头标签.svg)