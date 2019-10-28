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
我们在生成render函数时，是通过`compileToFunctions()`来生成的，那么`compileToFunctions()`又是从何而来呢？

先看看它如何获取的：
```js
const {
    compile,
    compileToFunctions
} = createCompiler(baseOptions);

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

简单过一眼上面的代码，可以看出`compileToFunctions()`实际上就是`createCompiler()`返回的接口函数中的其中一个，如果感兴趣，可以看下下面的一个流程简述：
[createCompiler运作的具体过程](./createCompiler)

所以逛一圈回来，其实`compileToFunctions()`就是:
```js
function compileToFunctions(
    template: string,
    options ? : CompilerOptions,
    vm ? : Component
): CompiledFunctionResult {
    options = extend({}, options);

    // 取出自定义报错或内置的报错函数
    const warn = options.warn || baseWarn;
    delete options.warn;

    if (process.env.NODE_ENV !== 'production') {
        // detect possible CSP restriction
        // 检查可能的CSP限制无法使用eval函数
        try {
            new Function('return 1')
        } catch (e) {
            if (e.toString().match(/unsafe-eval|CSP/)) {
                warn(
                    'It seems you are using the standalone build of Vue.js in an ' +
                    'environment with Content Security Policy that prohibits unsafe-eval. ' +
                    'The template compiler cannot work in this environment. Consider ' +
                    'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
                    'templates into render functions.'
                )
            }
        }
    }

    // check cache
    const key = options.delimiters ?
        String(options.delimiters) + template :
        template;

    // 获取已解析的模版字符串的缓存
    if (cache[key]) {
        return cache[key];
    }

    // compile编译
    const compiled = compile(template, options);

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
        if (compiled.errors && compiled.errors.length) {
            if (options.outputSourceRange) {
                compiled.errors.forEach(e => {
                    warn(
                        `Error compiling template:\n\n${e.msg}\n\n` +
                        generateCodeFrame(template, e.start, e.end),
                        vm
                    )
                })
            } else {
                warn(
                    `Error compiling template:\n\n${template}\n\n` +
                    compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
                    vm
                )
            }
        }
        if (compiled.tips && compiled.tips.length) {
            if (options.outputSourceRange) {
                compiled.tips.forEach(e => tip(e.msg, vm))
            } else {
                compiled.tips.forEach(msg => tip(msg, vm))
            }
        }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
        return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
        if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
            warn(
                `Failed to generate render function:\n\n` +
                fnGenErrors.map(({
                    err,
                    code
                }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
                vm
            )
        }
    }

    return (cache[key] = res);
}
```