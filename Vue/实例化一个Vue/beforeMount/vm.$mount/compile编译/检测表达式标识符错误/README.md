# 检查表达式修饰符错误——detectErrors()

该方法用来检查编译形成的AST元素对象中的指令中的表达式和修饰符是否符合规范，通过递归调用`checkNode()`方法实现，从根节点开始检查：

```js
function detectErrors(ast: ? ASTNode, warn : Function) {
    if (ast) {
        checkNode(ast, warn);
    }
}
```

## checkNode()——遍历检查节点

该方法只对元素和插值表达式节点进行检查，检查它们的`vue`指令语法中的修饰符和表达式

```js
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
```

## checkFor()——检查v-for指令

该方法会对`v-for`表达式中的所有修饰符和表达式的合法性进行检测，这里的表达式主要是我们`v-for`迭代的对象。

```js
// 检查v-for，这里的text为完整的v-for表达式
function checkFor(node: ASTElement, text: string, warn: Function, range ? : Range) {
    checkExpression(node.for || '', text, warn, range);

    // 检查3个标识符是否合法
    checkIdentifier(node.alias, 'v-for alias', text, warn, range)
    checkIdentifier(node.iterator1, 'v-for iterator', text, warn, range)
    checkIdentifier(node.iterator2, 'v-for iterator', text, warn, range)
}
```

举个例子如`v-for="item in items"`，这我们对`items`调用[`checkExpression()`](#checkexpression%e6%a3%80%e6%9f%a5%e8%a1%a8%e8%be%be%e5%bc%8f%e5%90%88%e6%b3%95%e6%80%a7)因为它可以是个表达式，不仅仅是个变量，而对`item`调用[`checkIdentifier()`](#checkidentifier%e6%a3%80%e6%9f%a5%e4%bf%ae%e9%a5%b0%e7%ac%a6%e5%90%88%e6%b3%95%e6%80%a7)，因为它只是一个修饰符

## checkEvent()——检查事件中的参数

该方法用于检查指定的事件中的参数，且不能在其中使用一元操作符。

```js
// these unary operators should not be used as property/method names
// 匹配一元操作符，如delete (xxx)
const unaryOperatorsRE = new RegExp('\\b' + (
    'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)');

// strip strings in expressions
// 匹配字符串即"" ''等等
const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g;

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
```

最后也会调用`checkExpression()`检测其表达式的合法性

## checkExpression()——检查表达式合法性

该函数用于来检查其表达式变量的合法性

```js
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
```

## checkIdentifier()——检查修饰符合法性

关注其中一句话就行，该函数用于来验证其修饰符变量的合法性

```js
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
```
