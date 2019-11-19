# createCompiler——生成渲染函数

利用该函数会返回两个用于解析模版的接口，这个过程主要是嵌套过多，但过程不复杂

该函数用于将模版字符串转化为`render`函数。

首先看一下[baseOptions是什么](../baseOptions)

之后调用`createCompiler()`方法，通过该项基础配置来创建并暴露了两个接口：

```js
const { compile, compileToFunctions } = createCompiler(baseOptions);
```

而现在来看`createCompiler()`这个函数，发现它其实是`createCompilerCreator()`函数的返回值，如下：

```js
// callback为简写，具体用到时再解释
const createCompiler = createCompilerCreator(callback);
```

所以，我们只需要关心`createCompilerCreator()`是怎么运作的就行了：

```js
function createCompilerCreator(baseCompile: Function): Function {

    // 缓存该基础编译函数
    return function createCompiler(baseOptions: CompilerOptions) {

        // 通过缓存函数与基础属性配置创建一个编译函数
        function compile(
            template: string,
            options ? : CompilerOptions
        ): CompiledResult {
            ...编译函数，使用了baseCompile、baseOptions来进行编译
        }

        // 返回两个接口函数
        return {

            // 编译函数
            compile,

            // 这里也是一个包装函数，用闭包缓存compile函数，以方便调用，方式同createCompilerCreator一样
            compileToFunctions: createCompileToFunctionFn(compile)
        };
    }
}
```

先不关注这个函数中干了什么事，我们只需要知道`createCompilerCreator()`接收了一个回调函数同时又返回了一个回调函数。

最后综上所述，`createCompiler()`实际上就是通过`baseOptions`与`baseCompile()`(上文用`callback`代替)函数返回两个编译函数接口，它们一个用于编译，一个用于转换编译结果为函数。

而`createCompileToFunctionFn()`又是干什么的呢？

## createCompileToFunctionFn()——转换编译结果为真正的函数

该函数主要作用是作为闭包，缓存各个模版编译的结果，但是它会返回一个`compileToFunctions()`用于将编译出的渲染函数字符串通过`Function`构造函数转换为真正的函数。

注意这个函数调用时是传入了`compile()`函数作为参数的，它就是用来编译的，会在`compileToFunctions()`使用：

```js
function createCompileToFunctionFn(compile: Function): Function {

    // 缓存模版编译为渲染函数的结果
    const cache = Object.create(null)

    return function compileToFunctions(){...}
}
```

## compileToFunctions()——将渲染函数字符串转换为真正的函数

我们还是简单看下代码吧，不难，先不深入理解：

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
            // 检查可能的CSP限制无法使用eval函数，因为其会限制所有内联脚本
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
        // 缓存插值括号和模版
        const key = options.delimiters ?
            String(options.delimiters) + template :
            template;

        // 获取已解析的渲染函数的缓存
        if (cache[key]) {
            return cache[key];
        }

        // compile编译
        const compiled = compile(template, options)

        // check compilation errors/tips
        // 检查编译阶段的错误和提示，然后报错
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
        // 将编译阶段的字符串片段转换为函数
        const res = {};
        const fnGenErrors = [];
        res.render = createFunction(compiled.render, fnGenErrors);
        res.staticRenderFns = compiled.staticRenderFns.map(code => {
            return createFunction(code, fnGenErrors)
        })

        // check function generation errors.
        // this should only happen if there is a bug in the compiler itself.
        // mostly for codegen development use
        // 检查生成函数时的错误，它只会发生在compiler函数自身就有错误(即不是用户的锅)
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

        // 缓存编译结果
        return (cache[key] = res);
    }
```

简单看过一眼，我先讲述一下它的作用：**将编译得到的渲染函数字符串正式转换为函数**。我们可以看到它是基于`Function`构造函数的，是运行时编译。所以首先要防止CSP策略拒绝所有的不安全脚本。

之后通过[`compile()`](../compile编译/README.md)函数编译生成渲染函数与AST对象，然后通过`createFunction()`函数将他们通过`Function`构造函数转化为真正的函数，然后缓存它们的函数结果于`cache`中(每个模版都会缓存)

```js
function createFunction(code, errors) {
    try {
        return new Function(code)
    } catch (err) {
        errors.push({
            err,
            code
        })
        return noop
    }
}
```

**下面这个非常重要，一定要看，就是解析DOM模版过程**
[具体编译过程——compile()](../compile编译/README.md)
____

晕了没有，最后我总结下它们的逻辑结果关系：

`createCompilerCreator(baseCompile)` (调用并返回)=> `createCompiler()` (调用并返回)=> `createCompileToFunctionFn(compile)` (调用并返回)=> `compileToFunctions()` (调用)=> `compile()` (调用)=> `baseCompile()`
