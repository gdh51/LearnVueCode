# beforeMount——编译渲染函数

整个`beforeMount`与`Mounted`阶段其实都是在`$mount`函数中发生，我们先来看前半部分`beforeMount`阶段发生了什么。

首先是`$mount`函数的代码总览：

```js
// 这是之前的mount方法，用于挂载组件
const mount = Vue.prototype.$mount;

Vue.prototype.$mount = function (
    el ? : string | Element,
    hydrating ? : boolean
): Component {

    // 获取真实的dom元素
    el = el && query(el);

    if (el === document.body || el === document.documentElement) {
        process.env.NODE_ENV !== 'production' && warn(
            `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
        )
        return this;
    }

    const options = this.$options;

    // resolve template/el and convert to render function
    // 将模版转换为render函数
    if (!options.render) {

        // 获取模版
        let template = options.template;

        // 各种方式获取字符串模版(下面的if/else语句都是)
        if (template) {
            if (typeof template === 'string') {
                if (template.charAt(0) === '#') {
                    template = idToTemplate(template);

                    if (process.env.NODE_ENV !== 'production' && !template) {
                        warn(
                            `Template element not found or is empty: ${options.template}`,
                            this
                        )
                    }
                }

            // 当模版为真实元素时，获取其内容的字符串
            } else if (template.nodeType) {
                template = template.innerHTML;

            // 报错否则
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    warn('invalid template option:' + template, this)
                }
                return this;
            }

        // 如果是直接写在DOM中的，那么获取书写的dom的字符串表达式
        } else if (el) {
            template = getOuterHTML(el);
        }

        if (template) {

            // 给编译过程过一个时间标记
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile')
            }

            // 将模版编译为render函数
            const {
                render,
                staticRenderFns
            } = compileToFunctions(template, {
                outputSourceRange: process.env.NODE_ENV !== 'production',
                shouldDecodeNewlines,
                shouldDecodeNewlinesForHref,
                delimiters: options.delimiters,
                comments: options.comments
            }, this);
            options.render = render
            options.staticRenderFns = staticRenderFns

            // 记录编译的性能情况
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile end')
                measure(`vue ${this._name} compile`, 'compile', 'compile end')
            }
        }
    }

    return mount.call(this, el, hydrating)
}
```

## 查询具体挂载的元素

我们可以看到后来的这个`$mount()`函数是被重写过的，之后我们会看到重写前的该函数，我们先看其编译的步骤，首先是通过`query()`函数来获取我们将要挂载的具体的元素：

```js
// 获取真实的dom元素
el = el && query(el);
```

该方法用于查询用户挂载的DOM元素，没有找到时会创建一个空的`div`来进行代替；你可以用选择器的形式表示或则直接挂载一个真实的DOM元素。

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

调用该方法后，我们就获取了我们真正写在`DOM`中根元素了，如果没有找到也没关系，它会创建一个空元素代替，但注意不能挂载在`body/html`两个元素上。

## 获取模版内容

随后如果用户没有定义`render`函数，那么`Vue`就会开启一个解析编译的过程，这个过程是基于我们刚刚挂载的元素的内容或我们自己定义的模版，下面是该过程的一个伪代码：

```js
if (options.template) {
    if (/*属性查询器*/) {
        template = idToTemplate(template);
    } else if (/* 元素节点 */) {

    }
} else if (el) {
    template = getOuterHTML(el);
}
```

看看我简化后的代码就可以知道，我们的模版也可以以三种方式存在：

- 指定具体元素
- 指定元素查询器
- 不指定模版，但指定`el`属性

### 指定元素查询器

指定查询器的这种方式只支持指定`id`查询器，其会返回该元素下的子元素的字符串模版。

```js
const idToTemplate = cached(id => {
    const el = query(id);
    return el && el.innerHTML;
});
```

虽然这里可以看出是调用`query()`方法获取的元素，不是`id`查询器也没关系，但是能调用`idToTemplate()`的前提就是以`#`开头。

### 指定具体元素

指定具体元素时比较简单，返回其`innerHTML`。

### 不指定模版

当不指定模版时，必须要指定过`el`属性，不同的是，它会调用`getOuterHTML(el)`提取该元素下的`outerHTML`，这时就包含了该元素。

```js
/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {

    // 支持outerHTML属性时，直接调用
    if (el.outerHTML) {
        return el.outerHTML

    // 不支持时，包装下，通过innerHTML获取
    } else {
        const container = document.createElement('div');
        container.appendChild(el.cloneNode(true));
        return container.innerHTML
    }
}
```

我们可以看到该方法是兼容的。

## 解析模版

带取得模版后，便开始调用`compileToFunctions()`将模版解析成渲染函数，这个过程非常复杂，但弄清了对后面有帮助

### createCompiler——创建编译函数

通过查询其导入的文件，我们得到如下结论，它来自于`createCompiler()`函数返回的接口：

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

接下来我们只需要弄清楚`createCompiler()`函数是什么就行了：[createCompiler运作的具体过程](./createCompiler/README.md)[源码地址](../../vueSourceCode/src/platforms/web/entry-runtime-with-compiler.js)
______

现在我们知道了，调用`compileToFunctions()`生成了两个渲染函数——全部节点、单独静态节点的渲染函数，它通过两个阶段(生成+转换)来将模版转换一个真正的渲染函数。它返回的两个函数就是编译后的渲染函数和其中的静态节点的渲染函数，最后返回`mount.call(this, el, hydrating)`的调用结果。注意此处的`mount()`方法，它来源于最初的初始化Vue时挂载的方法，而非当前函数的递归调用([原函数文件](../../vueSourceCode/src/platforms/web/runtime/index.js))：

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
Vue.prototype.$mount = function () {...}
```

按函数名称来看，接下来我们该递归下去挂载组件了，那么我们来看看`mountComponent()`函数[源码地址](../../vueSourceCode/src/core/instance/lifecycle.js)：

```js
function mountComponent(
    vm: Component,
    el: ? Element,
    hydrating ? : boolean
): Component {
    vm.$el = el;

    // 当原始配置中不存在渲染函数时
    if (!vm.$options.render) {

        // 将当前渲染函数赋值为创建一个空的VNode节点的函数
        vm.$options.render = createEmptyVNode
        if (process.env.NODE_ENV !== 'production') {

            if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
                vm.$options.el || el) {
                warn(
                    'You are using the runtime-only build of Vue where the template ' +
                    'compiler is not available. Either pre-compile the templates into ' +
                    'render functions, or use the compiler-included build.',
                    vm
                )
            } else {
                warn(
                    'Failed to mount component: template or render function not defined.',
                    vm
                )
            }
        }
    }

    // 调用该vm实例的beforeMount狗子函数
    callHook(vm, 'beforeMount');

    ................Mount阶段
}
```

这里我们只用看前半部分，直到`beforeMount`钩子函数被调用为止，其实除了挂载了一个用于创建空VNode节点的函数外，`beforeMount`阶段就告一段落了，接下来便是[`Mounted`](../mounted/README.md)阶段了。
