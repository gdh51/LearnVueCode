# 处理尾标签

现在我们可以来了解一下是怎么处理尾标签的了：

```js
// End tag:
// 当为一个标签的结束标签时
const endTagMatch = html.match(endTag);
if (endTagMatch) {

    // 记录尾标签开始位置
    const curIndex = index;

    // 更新模版和指针
    advance(endTagMatch[0].length);

    // index-curIndex就为尾标签长度
    parseEndTag(endTagMatch[1], curIndex, index);
    continue;
}
```

从上面可以知道，获取到匹配标签后，直接调用`advance()`方法，截取模版去掉了尾标签所在部分，并更新了指针，这一部分没什么好说的，具体看下怎么解析结束标签的——[parseEndTag()——闭合该标签与之内的所有标签](../../一群工具方法/解析属性/README.md#parseendtag%e9%97%ad%e5%90%88%e8%af%a5%e6%a0%87%e7%ad%be%e4%b8%8e%e4%b9%8b%e5%86%85%e7%9a%84%e6%89%80%e6%9c%89%e6%a0%87%e7%ad%be)

## options.end()——闭合元素

闭合当前标签，并处理其剩余的属性。

```js
end(tag, start, end) {

    // 下面这两步操作统称pop()
    // 该元素头标签的ast对象
    const element = stack[stack.length - 1];
    // pop stack
    stack.length -= 1;

    // 确定父元素
    currentParent = stack[stack.length - 1];
    if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end
    }
    closeElement(element);
}
```

首先这里每闭合一个元素，都会将栈中的对应头标签删除，然后调用[`closeElement()`](../处理头标签/README.md#closeelementelement%e9%97%ad%e5%90%88%e5%85%83%e7%b4%a0)处理元素剩余的属性并建立和父元素的关系，元素的闭合就完成了。

但是我们刚刚在[外层函数](#parseendtag%e9%97%ad%e5%90%88%e8%af%a5%e6%a0%87%e7%ad%be%e4%b8%8e%e4%b9%8b%e5%86%85%e7%9a%84%e6%89%80%e6%9c%89%e6%a0%87%e7%ad%be)可以看见在闭合完标签后，又清空了一次`stack`，其实在编译中有两个`stack`，分别在[`parseHTML()`](../README.md)与[`parse()`](../../README.md)函数中，这里可以把前者中的`stack`理解为后者的复制版本，只用于之后闭合标签时的查找；而大多数处理是后者的`stack`。