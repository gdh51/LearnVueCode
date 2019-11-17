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
<div id="app">
    <div v-for="(item, index) in items">
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
____

这里按上述模版为例：

1. 由于其为一个普通的元素，只有`id`属性，所以通过[`genData()`](./处理属性生成函数/生成数据表达式/README.md)，获取其属性对象的表达式为：`"{attrs:{"id":"app"}}"`，调用[`genChildren()`](./处理属性生成函数/README.md#genchildren%e5%a4%84%e7%90%86%e5%ad%90%e5%85%83%e7%b4%a0)函数对其子元素进行处理。

2. 对于第一个子元素，首先调用[`genFor()`](./处理属性生成函数/生成影响结构的函数/README.md)生成`"_l((items), function(item,index){return _c('div',[_c('div',[_c('div'),_v(" "),_c('div')])])})"`，其中`return`部分是通过再次调用`genElement()`函数时，调用`genChildren()`所得。

3. 对于第二个子元素和第三个子元素，首先调用[`genIf`](./处理属性生成函数/生成影响结构的函数/README.md#genif%e5%a4%84%e7%90%86%e6%b8%b2%e6%9f%93%e5%87%bd%e6%95%b0%e4%b8%adif%e8%af%ad%e5%8f%a5%e5%9d%97)之后在调用[`genData()`](./处理属性生成函数/生成数据表达式/README.md)处理其指令属性，最终结果为`"(xx)?_c('div',{directives:[{name:"focus",rawName:"v-focus:a",value:(b),expression:"b",arg:"a"}]}):_c('div',{on:{"click":ccc}})"`(由于第三个元素存在于`if`条件块中，而非直接联系的`AST`对象，所以在第二个元素调用`genIf()`的同时进行生成)

4. 最终结果为`"_c('div',{attrs:{"id":"app"}},[_l((items),function(item){return _c('div',[_c('div',[_c('div'),_v(" "),_c('div')])])}),_v(" "),(xx)?_c('div',{directives:[{name:"focus",rawName:"v-focus:a",value:(b),expression:"b",arg:"a"}]}):_c('div',{on:{"click":ccc}})],2)"`

## CodegenState——存储编译状态

该类用于存储具体生成函数时的实时状态(主要是提供给静态元素)，然后还提供一些生成函数供生成渲染函数时使用：

```js
class CodegenState {
    options: CompilerOptions;
    warn: Function;
    transforms: Array < TransformFunction > ;
    dataGenFns: Array < DataGenFunction > ;
    directives: {
        [key: string]: DirectiveFunction
    };
    maybeComponent: (el: ASTElement) => boolean;
    onceId: number;
    staticRenderFns: Array < string > ;
    pre: boolean;

    constructor(options: CompilerOptions) {
        this.options = options;
        this.warn = options.warn || baseWarn;

        // 获取module中的所有的transformCode方法(这里没有)
        this.transforms = pluckModuleFunction(options.modules, 'transformCode');

        // 获取module中所有的genData方法(这里有两个)
        this.dataGenFns = pluckModuleFunction(options.modules, 'genData');

        // 获取所有的指令方法
        this.directives = extend(extend({}, baseDirectives), options.directives);

        //  是否为原生标签
        const isReservedTag = options.isReservedTag || no;

        // 一个检测函数用于查看是否为组件
        this.maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag);
        this.onceId = 0;
        this.staticRenderFns = [];
        this.pre = false;
    }
}
```

____
具体函数查看[genElement()](./处理属性生成函数/README.md)