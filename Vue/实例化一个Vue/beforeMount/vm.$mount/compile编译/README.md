# complie

终于到了编译这一步了，现在才是正式的开始

```js
const compiled = compile(template, options);
```

而`compile()`函数来源于`createCompiler()`函数创建的接口之一，该方法用于解析DOM模版，然后生成渲染函数，检测其指令语法中的变量和表达式是否合法：

```js
function compile(template: string, options?: CompilerOptions): CompiledResult {
    const finalOptions = Object.create(baseOptions);
    const errors = [];
    const tips = [];

    let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg);
    };

    if (options) {
        if (
            process.env.NODE_ENV !== 'production' &&
            options.outputSourceRange
        ) {
            // 匹配模版字符串首部的空格
            const leadingSpaceLength = template.match(/^\s*/)[0].length;

            warn = (msg, range, tip) => {
                const data: WarningMessage = {
                    msg
                };
                if (range) {
                    if (range.start != null) {
                        data.start = range.start + leadingSpaceLength;
                    }
                    if (range.end != null) {
                        data.end = range.end + leadingSpaceLength;
                    }
                }
                (tip ? tips : errors).push(data);
            };
        }

        // merge custom modules
        // 合并自定义的modules，用于之后的节点处理
        if (options.modules) {
            finalOptions.modules = (baseOptions.modules || []).concat(
                options.modules
            );
        }

        // merge custom directives
        // 合并自定义指令gen函数，用于在之后生成render函数中处理
        if (options.directives) {
            finalOptions.directives = extend(
                Object.create(baseOptions.directives || null),
                options.directives
            );
        }

        // copy other options
        // 将其他配置合并到最终配置上
        for (const key in options) {
            if (key !== 'modules' && key !== 'directives') {
                finalOptions[key] = options[key];
            }
        }
    }

    // 挂载提示函数
    finalOptions.warn = warn;

    // 编译生成渲染函数
    const compiled = baseCompile(template.trim(), finalOptions);

    if (process.env.NODE_ENV !== 'production') {

        // 检查ast元素中指令语法中的表达式和变量是否合法
        detectErrors(compiled.ast, warn);
    }

    compiled.errors = errors;
    compiled.tips = tips;
    return compiled;
}
```

从代码中我们可以看见，它会有一个最终配置对象，来接收自定义配置和基础配置，这些接收到的配置将会在生成`AST`元素对象和渲染函数中被使用。

在这里面最关键的是[`baseCompile()`](./baseCompile/README.md)函数，它就是用于来生成渲染函数和`AST`对象的；生成完之后其会调用[`detectErrors()`](./检测表达式标识符错误/README.md)方法，对生成的`AST`对象中所有的`vue`指令表达式中的变量和表达式的合法性进行检查，之后整个编译阶段就结束了。
