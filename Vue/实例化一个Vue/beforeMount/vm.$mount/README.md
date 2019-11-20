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
_____
通过上面的函数，我们可以知道`compileToFunctions()`返回的两个函数就是编译后的渲染函数和其中的静态节点的渲染函数，最后返回`mount.call(this, el, hydrating)`的调用结果。注意此处的`mount()`方法，它来源于最初的初始化Vue时挂载的方法，而非当前函数的递归调用([原函数文件](../../../vueSourceCode/src/platforms/web/runtime/index.js))：

```js
// public mount method
Vue.prototype.$mount = function (
    el ? : string | Element,
    hydrating ? : boolean
): Component {

    // 获取挂载的DOM元素
    el = el && inBrowser ? query(el) : undefined;

    // 解析组件
    return mountComponent(this, el, hydrating)
}

// 这是之前的mount方法
const mount = Vue.prototype.$mount

// 重写mount方法，这就是我们用来编译第一个Vue实例模版的方法
Vue.prototype.$mount = function
```