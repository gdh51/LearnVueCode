# createCompiler
利用该函数会返回两个用于解析模版的接口，这个过程主要是嵌套过多，但过程不复杂

该函数用于将模版字符串转化为`render`函数。

首先看一下[baseOptions是什么](./baseOptions)


之后调用`createCompiler()`方法，通过该项基础配置来创建并暴露了两个接口：
```js
const { compile, compileToFunctions } = createCompiler(baseOptions);
```

而现在来看`createCompiler()`这个函数，发现它其实是`createCompilerCreator()`函数的返回值
```js
// callback为简写，具体用到时再解释
const createCompiler = createCompilerCreator(callback);
```

所以，我们只需要关心`createCompilerCreator()`是怎么运作的就行了
```js
function createCompilerCreator(baseCompile: Function): Function {

    // 缓存该基础编译函数
    return function createCompiler(baseOptions: CompilerOptions) {

        // 通过缓存函数与基础属性配置创建一个编译函数
        function compile(
            template: string,
            options ? : CompilerOptions
        ): CompiledResult {
            ...编译函数，使用了baseCompile、baseOptions
        }

        // 返回两个接口函数
        return {
            compile,

            // 这里也是一个包装函数，用闭包缓存compile函数，以方便调用，方式同createCompilerCreator一样
            compileToFunctions: createCompileToFunctionFn(compile)
        };
    }
}
```

先不关注这个函数中干了什么事，我们只需要知道`createCompilerCreator()`接收了一个回调函数同时又返回了一个回调函数。

最后综上所述，`createCompiler()`实际上就是通过`baseOptions`与`baseCompile()`(上文用`callback`代替)函数返回两个编译函数接口。