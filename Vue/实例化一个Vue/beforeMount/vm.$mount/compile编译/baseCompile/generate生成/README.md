# generate()——生成render函数

`generate()`函数通过反复调用`genElement()`来对所有的`ast`对象及其它们的属性来进行处理，最终的结果是生成一个多层嵌套的函数字符串。

```js
function generate(
    ast: ASTElement | void,
    options: CompilerOptions
): CodegenResult {

    // 创建一个代码的状态栈
    const state = new CodegenState(options);

    // 生成render函数的字符串
    const code = ast ? genElement(ast, state) : '_c("div")';

    // 返回渲染接口
    return {
        render: `with(this){return ${code}}`,
        staticRenderFns: state.staticRenderFns
    };
}
```

假如我们这里有一个这样的简单的`html`模版

```html
<div>
    <div v-for="item in items">
        <div v-once>
            <div></div>
            <div></div>
        </div>
    </div>
    <div v-focus:a="b" v-if="xx"></div>
    <div v-else="xx" @click="ccc"></div>
</div>
```

假设你已经知道它们生成了的怎样的AST语法对象，那么现在起，我们从`generate()`函数开始看起

首先通过`CodegenState`创建了一个当前生成`render`函数的状态栈，之后调用`genElement()`函数开始生成渲染函数。

由于其为一个普通的元素，没有任何属性，所以