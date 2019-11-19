## query()——查询 dom 中某个元素

```js
function query(el: string | Element): Element {
    // 用户定义为字符串形式，那么通过querySelector找到第一个符合选择器的
    if (typeof el === 'string') {
        const selected = document.querySelector(el);

        // 没找到，提示并创建一个空的div元素
        if (!selected) {
            process.env.NODE_ENV !== 'production' &&
                warn('Cannot find element: ' + el);

            return document.createElement('div');
        }
        return selected;

        // 用户挂载的真实DOM元素时，直接返回
    } else {
        return el;
    }
}
```

## createCompiler——编译函数的生成

我们在生成`render`函数时，是通过`compileToFunctions()`来生成的，那么`compileToFunctions()`又是从何而来呢？

先看看它如何获取的：

```js
const {
    compile,
    compileToFunctions
} = createCompiler(baseOptions);
```

简单过一眼上面的代码，可以看出`compileToFunctions()`实际上就是`createCompiler()`返回的接口函数中的其中一个，下面是其运作的具体流程，可以待会再看：
[createCompiler运作的具体过程](./createCompiler/README.md)
_____

之后我们调用`compileToFunctions()`生成了两个渲染函数——全部节点、单独静态节点的

```js
const { render, staticRenderFns } = compileToFunctions(
    template,
    {
        outputSourceRange: process.env.NODE_ENV !== 'production',

        // 是否应该解码换行符(在chrome和IE下有bug)
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,

        // 分隔符
        delimiters: options.delimiters,

        // 注释
        comments: options.comments
    },
    this
);
```

`compileToFunctions()`函数通过两个阶段(生成+转换)来将模版转换一个真正的渲染函数，现在必须看了
[createCompiler运作及其生成渲染函数的过程](./createCompiler/README.md)