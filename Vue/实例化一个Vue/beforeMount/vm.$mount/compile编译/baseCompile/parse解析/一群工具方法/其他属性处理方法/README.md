# 其他属性处理方法

这里是一些不具有大同性的属性处理方法：

- [genAssignmentCode()——将变量赋值给另一个变量](#genassignmentcode%e5%b0%86%e5%8f%98%e9%87%8f%e8%b5%8b%e5%80%bc%e7%bb%99%e5%8f%a6%e4%b8%80%e4%b8%aa%e5%8f%98%e9%87%8f)
- [checkRootConstraints()——检测模版更元素合法性](#checkrootconstraints%e6%a3%80%e6%b5%8b%e6%a8%a1%e7%89%88%e6%9b%b4%e5%85%83%e7%b4%a0%e5%90%88%e6%b3%95%e6%80%a7)

## genAssignmentCode()——将变量赋值给另一个变量

该函数用于解析一个变量，将该变量与另一个变量进行绑定，绑定的方式有两种：

1. 无深度变量直接绑定
2. 具有深度的变量，只绑定其最后键的值

具体[`parseModel()`](../解析属性/README.md#parsemodel%e8%a7%a3%e6%9e%90%e5%af%b9%e8%b1%a1)的解析过程请跳转查看

```js
function genAssignmentCode(
    value: string,
    assignment: string
) : string {

    // 将value解析为路径+最后一个键名的形式
    const res = parseModel(value);

    // 不以[]结尾或没有.操作符时，即没有任何操作符时
    if (res.key === null) {

        // 将assignment 表达式赋值给value
        return `${value}=${assignment}`
    } else {

        // 创建一个新值或更改该属性的值绑定为value
        // 注意这个地方，即使你绑定一个不存在的对象的值也行
        return `$set(${res.exp}, ${res.key}, ${assignment})`
    }
}
```

## checkRootConstraints()——检测模版更元素合法性

该函数用于检测模版的根元素是否和法：

1. 不能为可能为多个元素的元素，如`slot` `template`
2. 不能具有`v-for`属性

```js
function checkRootConstraints(el) {

    // 不能用slot、template作为根元素，因为它们可能含有多个元素
    if (el.tag === 'slot' || el.tag === 'template') {
        warnOnce(
            `Cannot use <${el.tag}> as component root element because it may ` +
            'contain multiple nodes.', {
                start: el.start
            }
        )
    }

    // 根节点不能使用v-for属性
    if (el.attrsMap.hasOwnProperty('v-for')) {
        warnOnce(
            'Cannot use v-for on stateful component root element because ' +
            'it renders multiple elements.',
            el.rawAttrsMap['v-for']
        )
    }
}
```