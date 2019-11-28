# __patch__()——根据Vnode打补丁生成dom元素

该函数是在最初初始化`Vue`类的时候添加至`Vue.prototype`上的，具体来源于`createPatchFunction({ nodeOps, modules })`，是不是感觉这个套路和之前的`createCompileFunction()`很像，首先，我们先看其传入的两个参数：

- `nodeOps`：[原生操作`DOM`的方法的封装](./封装的dom方法/README.md)。
- `modules`：[`VNode`节点属性的处理方法的封装](./封装的处理节点属性方法/README.md)

现在看看源码(*由于该函数源码过于庞大，主要是其中定义了很多函数，我只搬它的逻辑流程代码，其他的使用时再进行学习*)

```js
const hooks = ['create', 'activate', 'update', 'remove', 'destroy'];

function createPatchFunction(backend) {
    let i, j
    const cbs = {}

    // 取出其中的操作节点与dom的方法
    const {
        modules,
        nodeOps
    } = backend;

    // 遍历钩子函数，为每个钩子函数添加其期间对属性的处理函数
    for (i = 0; i < hooks.length; ++i) {

        // 为每个生命周期初始化一个数组队列
        cbs[hooks[i]] = [];

        // 向该生命周期的任务队列中添加处理该周期内处理属性的方法
        // 只有create/update/destroy三个周期存在
        for (j = 0; j < modules.length; ++j) {
            if (isDef(modules[j][hooks[i]])) {
                cbs[hooks[i]].push(modules[j][hooks[i]]);
            }
        }
    }

    // 声明一个用于记录有多少处于v-pre中的节点
    let creatingElmInVPre = 0;

    // 是否对DOM元素进行注水（修饰）
    let hydrationBailed = false;

    // list of modules that can skip create hook during hydration because they
    // are already rendered on the client or has no need for initialization
    // Note: style is excluded because it relies on initial clone for future
    // deep updates (#7063).
    // 服务器渲染问题：下列属性在注水期间可以跳过上述module中create中的钩子函数，因为它们
    // 已经在客户端渲染过了或没有必要进行初始化。
    // 注意：style属性除外因为它依赖初始化的克隆来进一步的更新
    const isRenderedModule = makeMap('attrs,class,staticClass,staticStyle,key');

    // 返回patch函数
    return function patch () {};
}
```

可以看出，该`patch()`函数是根据是否在浏览器渲染会产生不同的效果的，这里有个名次`hydrate`具体我们会在学习完后来解释；通过该函数我们可以看出它初始化了一些生命周期的钩子函数，然后就返回了一个`patch()`函数，这也就是我们`createCompileFunction()`的返回值了。

那么我们现在具体来看看`patch()`函数具体包含的内容：
