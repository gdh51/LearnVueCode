# baseCompiler——解析模版为ast与render函数
还记得之前创建编译函数时，利用闭包缓存的`baseCompiler()`函数吗，它用于正式解析模版，代码如下：
```js
function baseCompile(
    template: string,
    options: CompilerOptions
): CompiledResult {

    // 根据模版生成ast树
    const ast = parse(template.trim(), options);
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
很明显这里有三部曲：parse、optimize、generate