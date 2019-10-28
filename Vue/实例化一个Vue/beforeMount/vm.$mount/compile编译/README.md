# complie

终于到了编译这一步了，现在才是正式的开始

```js
const compiled = compile(template, options);
```

而`compile()`函数来源于`createCompiler()`函数创建的接口之一，

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
        if (options.modules) {
            finalOptions.modules = (baseOptions.modules || []).concat(
                options.modules
            );
        }

        // merge custom directives
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

    const compiled = baseCompile(template.trim(), finalOptions);

    if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn);
    }

    compiled.errors = errors;
    compiled.tips = tips;
    return compiled;
}
```
