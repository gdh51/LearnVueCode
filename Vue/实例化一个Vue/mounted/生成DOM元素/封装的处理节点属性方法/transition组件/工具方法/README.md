#

- [resolveTransition()——处理抽象组件中的属性](#resolvetransition%e5%a4%84%e7%90%86%e6%8a%bd%e8%b1%a1%e7%bb%84%e4%bb%b6%e4%b8%ad%e7%9a%84%e5%b1%9e%e6%80%a7)

## resolveTransition()——处理抽象组件中的属性

该函数主要用于初步处理用户定义在`<transition>`组件上的属性，它会自动的帮用户挂载默认的动画效果类(也可以通过`name`字段来指定具体的类)；如果用户定`.css`字段来关闭`css`过渡，那么将不会提供任何`css`类的挂载，:

```js
function resolveTransition(def ? : string | Object): ? Object {
    if (!def) {
        return;
    }

    // 获取解析的transition属性内的内容
    if (typeof def === 'object') {
        const res = {};

        // 只在指定css为false时，跳过css检测
        if (def.css !== false) {

            // 根据name来添加对应的css类，即使没有定义任何属性，也会添加v动画
            extend(res, autoCssTransition(def.name || 'v'))
        }

        // 添加其他属性至res中
        extend(res, def);
        return res;

    // 对于字符串形式，则返回其相关的class
    } else if (typeof def === 'string') {
        return autoCssTransition(def)
    }
}
```

大多数情况`.transition`会被解析为一个对象，里面包含用户最初定义的各种字段。此时我们要通过用户是否显示定义`css="false"`来判断是否为其添加`css`过渡`class`：如果未定义，那么调用`autoCssTransition()`根据用户定义的`name`字段来添加对应的`class`；如果同时未定义`name`字段则使用默认的`v`来补全。

### autoCssTransition()——补全过渡class

该方法根据传入的字符串参数来返回一个对应的过渡效果的类对象，对于每个`name`，在调用后都会进行缓存。

```js
// 提供一个动画名称，自动返回一个与其名称相关的动画class
const autoCssTransition: (name: string) => Object = cached(name => {
    return {
        enterClass: `${name}-enter`,
        enterToClass: `${name}-enter-to`,
        enterActiveClass: `${name}-enter-active`,
        leaveClass: `${name}-leave`,
        leaveToClass: `${name}-leave-to`,
        leaveActiveClass: `${name}-leave-active`
    };
});
```

____
在调用`autoCssTransition()`得到对应的`class`对象后，还要用`extend()`方法将其浅复制至`res`对象，之后再将全部属性也浅复制至`res`对象后返回。

## mergeVNodeHook()——合并VNode的某个钩子函数

该函数的套路和我们学习更新事件处理器时添加事件处理器的套路一样，对于同一个类型的未钩子函数，调用`createFnInvoker()`将其封装；已封装的函数则直接添加到`.fns`中即可，先看一下函数的代码：

```js
function mergeVNodeHook(def: Object, hookKey: string, hook: Function) {

    // 当def为VNode节点时，取出其hook对象，或初始化一个hook对象
    if (def instanceof VNode) {
        def = def.data.hook || (def.data.hook = {});
    }
    let invoker;

    // 取出旧的对应的hook函数
    const oldHook = def[hookKey];

    function wrappedHook() {

        // 调用最新的hook函数
        hook.apply(this, arguments);

        // important: remove merged hook to ensure it's called only once
        // and prevent memory leak
        // 从.fns中移除wrapperedHook函数，保证其只被调用一次，防止内存泄漏
        remove(invoker.fns, wrappedHook);
    }

    // 如果之前没有该类型钩子函数，则创建一个
    if (isUndef(oldHook)) {

        // no existing hook
        invoker = createFnInvoker([wrappedHook])
    } else {

        // 如果之前有该类型钩子函数，先查看是否合并过
        if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {

            // already a merged invoker
            // 合并过时，直接在.fns中添加即可
            invoker = oldHook;
            invoker.fns.push(wrappedHook)
        } else {

            // existing plain hook
            // 未合并过时，创建一个包装函数
            invoker = createFnInvoker([oldHook, wrappedHook])
        }
    }

    // 记录标记位，并重新挂载钩子函数
    invoker.merged = true;
    def[hookKey] = invoker;
}
```

总体解读下就是取出其`hook`对象，然后重写`hook[hookKey]`钩子函数中要调用的函数，每个要添加进入的函数首先都要通过`wrappedHook()`函数进行，封装，该函数调用后，会自动被移除。其次，第一次添加时，要将`hook[hookKey]`中的函数通过`createFnInvoker()`生成一个函数调度器，它会自动调用其`createFnInvoker.fns`中存储的函数；之后再次添加时，直接添加至`.fns`数组中即可。[关于`createFnInvoker()`函数](../../../../../beforeCreate/初始化Events/README.md#createfninvoker%e5%b0%81%e8%a3%85%e4%ba%8b%e4%bb%b6%e5%a4%84%e7%90%86%e5%87%bd%e6%95%b0)