# baseCompiler——解析模版为ast与render函数

还记得之前创建编译函数时，利用闭包缓存的`baseCompiler()`函数吗，它用于正式解析模版，代码如下：

```js
function baseCompile(
    template: string,
    options: CompilerOptions
): CompiledResult {

    // 根据模版生成ast树，返回根AST元素节点对象
    const ast = parse(template.trim(), options);

    // 针对静态节点的优化
    if (options.optimize !== false) {
        optimize(ast, options)
    }
    const code = generate(ast, options);
    return {
        ast,
        render: code.render,
        staticRenderFns: code.staticRenderFns
    }
}
```

很明显这里有三部曲：`parse()`、`optimize()`、`generate()`

1. [parse()——解析模版为AST对象](./parse解析/README.md)
2. [optimze()——标记静态节点](./optimze优化/README.md)
3. [generate()——生成渲染函数](./generate生成/README.md)