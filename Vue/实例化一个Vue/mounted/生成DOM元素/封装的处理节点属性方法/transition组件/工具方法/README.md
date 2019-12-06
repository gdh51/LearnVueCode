# 过渡动画中的工具方法

目录：

- [resolveTransition()——处理抽象组件中的属性](#resolvetransition%e5%a4%84%e7%90%86%e6%8a%bd%e8%b1%a1%e7%bb%84%e4%bb%b6%e4%b8%ad%e7%9a%84%e5%b1%9e%e6%80%a7)
- [getHookArgumentsLength()——获取钩子函数参数长度](#gethookargumentslength%e8%8e%b7%e5%8f%96%e9%92%a9%e5%ad%90%e5%87%bd%e6%95%b0%e5%8f%82%e6%95%b0%e9%95%bf%e5%ba%a6)
- [mergeVNodeHook()——合并VNode的某个钩子函数](#mergevnodehook%e5%90%88%e5%b9%b6vnode%e7%9a%84%e6%9f%90%e4%b8%aa%e9%92%a9%e5%ad%90%e5%87%bd%e6%95%b0)
- [addTransitionClass()——向指定元素添加class](#addtransitionclass%e5%90%91%e6%8c%87%e5%ae%9a%e5%85%83%e7%b4%a0%e6%b7%bb%e5%8a%a0class)
- [removeTransitionClass()——向指定元素移除过渡class](#removetransitionclass%e5%90%91%e6%8c%87%e5%ae%9a%e5%85%83%e7%b4%a0%e7%a7%bb%e9%99%a4%e8%bf%87%e6%b8%a1class)
- [nextFrame()——下下帧执行回调函数](#nextframe%e4%b8%8b%e4%b8%8b%e5%b8%a7%e6%89%a7%e8%a1%8c%e5%9b%9e%e8%b0%83%e5%87%bd%e6%95%b0)
- [whenTransitionEnds()——在过渡结束时执行回调](#whentransitionends%e5%9c%a8%e8%bf%87%e6%b8%a1%e7%bb%93%e6%9d%9f%e6%97%b6%e6%89%a7%e8%a1%8c%e5%9b%9e%e8%b0%83)
- [once()——只执行一次的函数](#once%e5%8f%aa%e6%89%a7%e8%a1%8c%e4%b8%80%e6%ac%a1%e7%9a%84%e5%87%bd%e6%95%b0)

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

## getHookArgumentsLength()——获取钩子函数参数长度

该函数用于获取用户的钩子函数的参数长度是否大于1的。因为通过`Vue`处理后其上的函数可能存在三种情况：

- 使用`invoker`包装，函数存储在`.fns`中
- 通过`polybind()`绑定后，形参存储在`._length`
- 普通的函数，`.length`为参数

所以要排除所有情况来进行查询，仅在其形参大于1个时，返回`true`

```js
/**
 * Normalize a transition hook's argument length. The hook may be:
 * 标准化transition钩子函数的参数长度，因为其钩子函数固定会传入1个element作为参数
 * - a merged hook (invoker) with the original in .fns(如事件的监听器)
 * - a wrapped component method (check ._length)调用bind后的参数长度
 * - a plain function (.length)
 */
function getHookArgumentsLength(fn: Function): boolean {
    if (isUndef(fn)) {

        // 非函数，返回false
        return false;
    }

    const invokerFns = fn.fns;
    if (isDef(invokerFns)) {

        // invoker
        // 返回第一个函数的参数长度
        return getHookArgumentsLength(
            Array.isArray(invokerFns) ?
            invokerFns[0] : invokerFns);
    } else {

        // 参数数量大于1则返回true，因为固定会传入一个el作为第一个参数
        return (fn._length || fn.length) > 1
    }
}
```

## addTransitionClass()——向指定元素添加class

该函数主要用于定向处理执行过渡的元素的`class`，它会在其元素声明一个`._transitionClasses`属性用来存放正在执行的动画的`class`，并向其元素添加该`class`。

```js
function addTransitionClass(el: any, cls: string) {

    // 获取或初始化_transitionClasses(用于装载过渡中的class)
    const transitionClasses = el._transitionClasses || (el._transitionClasses = []);

    // 该class不存在于其中则添加
    if (transitionClasses.indexOf(cls) < 0) {

        // 添加至其过渡classes数组
        transitionClasses.push(cls);

        // 添加至dom中
        addClass(el, cls);
    }
}

const whitespaceRE = /\s+/

/**
 * Add class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 * 兼容性的添加class，因为IE的svg元素不支持classList属性
 */
function addClass(el: HTMLElement, cls: ? string) {

    // 传入空格直接返回或无值
    if (!cls || !(cls = cls.trim())) {
        return
    }

    // 支持classList属性的class的添加
    if (el.classList) {

        // 添加多个class时，分开后逐个添加
        if (cls.indexOf(' ') > -1) {
            cls.split(whitespaceRE).forEach(c => el.classList.add(c))
        } else {
            el.classList.add(cls)
        }

    // 不支持时的添加
    } else {

        // 调用setAttribute添加
        const cur = ` ${el.getAttribute('class') || ''} `
        if (cur.indexOf(' ' + cls + ' ') < 0) {
            el.setAttribute('class', (cur + cls).trim())
        }
    }
}
```

`addClass()`主要用于处理`IE`的`svg`兼容性问题(万恶的`IE`)

## removeTransitionClass()——向指定元素移除过渡class

该函数和[`addTransitionClass()`](#addtransitionclass%e5%90%91%e6%8c%87%e5%ae%9a%e5%85%83%e7%b4%a0%e6%b7%bb%e5%8a%a0class)一样，不过是反向的——移除`class`。同样的也是为了向`IE`妥协。

```js
function removeTransitionClass(el: any, cls: string) {

    // 移除_transition中的
    if (el._transitionClasses) {
        remove(el._transitionClasses, cls);
    }

    // 移除元素上的
    removeClass(el, cls);
}

function remove(arr: Array < any > , item: any): Array < any > | void {
    if (arr.length) {

        // 移除数组中的指定项
        const index = arr.indexOf(item);
        if (index > -1) {
            return arr.splice(index, 1)
        }
    }
}

function removeClass(el: HTMLElement, cls: ? string) {

    // 无值或空格直接返回
    if (!cls || !(cls = cls.trim())) {
        return;
    }

    // 支持classList属性时
    if (el.classList) {

        // 移除多个class
        if (cls.indexOf(' ') > -1) {
            cls.split(whitespaceRE).forEach(c => el.classList.remove(c));

        // 移除单个
        } else {
            el.classList.remove(cls)
        }

        // 当不存在class时，还要移除该属性
        if (!el.classList.length) {
            el.removeAttribute('class')
        }
    } else {
        let cur = ` ${el.getAttribute('class') || ''} `
        const tar = ' ' + cls + ' ';

        // 移除所有的指定class片段
        while (cur.indexOf(tar) >= 0) {
            cur = cur.replace(tar, ' ')
        }

        cur = cur.trim();

        // 重新赋值class
        if (cur) {
            el.setAttribute('class', cur);

            // 无class时移除该属性
        } else {
            el.removeAttribute('class')
        }
    }
}
```


## nextFrame()——下下帧执行回调函数

该函数用于在下下帧时执行某个函数，默认使用`requestAnimationFrame()`，向下兼容使用`setTimeout`。

```js
// binding to window is necessary to make hot reload work in IE in strict mode
// 绑定至window有利于在IE浏览器严格模式下进行热重载
// 优先使用requestAnimationFrame，降级使用setTimeout或直接调用
const raf = inBrowser ? (window.requestAnimationFrame ?
    window.requestAnimationFrame.bind(window) : setTimeout)
    :  fn => fn();

// 下一帧执行回调函数(下下次宏任务执行fn)
function nextFrame(fn: Function) {
    raf(() => {
        raf(fn);
    });
}
```

除了最糟糕的情况，其两个都是下一个宏任务阶段执行。

### 问题

这里肯定有疑问，为什么`nextFrame()`函数要嵌套一层执行，而不是直接执行。这是因为如果`Vue`更新是使用的宏任务模式，那么该函数就相当于同时和更新执行了，就不会产生过渡效果了。这里要保证是在其至少下一个宏任务阶段执行。(这里涉及到了任务执行和渲染顺序，自行了解)

## whenTransitionEnds()——在过渡结束时执行回调

该函数就是用于自动查找过渡的时间，并在过渡结束时执行指定的回调函数。

这个自动查找功能来源于[`getTransitionInfo()`](#gettransitioninfo%e9%80%9a%e8%bf%87css%e8%8e%b7%e5%8f%96%e8%bf%87%e6%b8%a1%e5%8a%a8%e7%94%bb%e4%bf%a1%e6%81%af)函数，之后我们会将，这里可以先在代码中的注释中了解下它返回的几个参数的含义。

```js
function whenTransitionEnds(
    el: Element,

    // 过渡的类型，animation或 transition
    expectedType: ? string,
    cb : Function
) {
    const {

        // 元素的过渡类型
        type,

        // 过渡时间
        timeout,

        // 有几个要执行过渡的属性
        propCount
    } = getTransitionInfo(el, expectedType);

    // 不具有类型时，直接执行回调函数(此时就不会执行过渡了)
    if (!type) return cb();

    // 确认过渡事件类型
    const event: string = type === TRANSITION ? transitionEndEvent : animationEndEvent;

    // 已完成过渡的属性个数
    let ended = 0;

    // 结束时回调——移除事件监听器并移除相关动画类
    const end = () => {
        el.removeEventListener(event, onEnd);
        cb();
    };
    const onEnd = e => {

        // 只会执行动画元素使用
        if (e.target === el) {

            // 仅在所有属性的动画全都执行完成后调用回调函数
            if (++ended >= propCount) {
                end();
            }
        }
    };

    // 若超时但未完成动画，则手动调用回调函数
    setTimeout(() => {
        if (ended < propCount) {
            end()
        }
    }, timeout + 1);
    el.addEventListener(event, onEnd);
}
```

代码比较简单，就是通过其元素上过渡动画的事件来处理，但要注意的时，在`css`指定多个过渡属性时，**每个属性完成过渡时都会触发一次对应类型过渡的事件**。所以这个地方你可以看到，设置有一个`ended`哨兵变量来保证全部属性都过渡完成后在执行回调函数；为了防止其事件发生堵塞，这里还设置有一个定时器来作为保险，如果在指定的动画时间内未执行完所有属性的过渡动画，那么就通过定时器来条用执行回调函数。

那么现在我们来看下`getTransitionInfo()`函数如何获取的过渡动画的信息。

### getTransitionInfo()——通过css获取过渡动画信息

首先，先看一下Vue针对过渡属性和事件的嗅探:

```js
const hasTransition = inBrowser && !isIE9;
const TRANSITION = 'transition';
const ANIMATION = 'animation';

// Transition property/event sniffing
// 过渡属性和事件嗅探
let transitionProp = 'transition'
let transitionEndEvent = 'transitionend'
let animationProp = 'animation'
let animationEndEvent = 'animationend'
if (hasTransition) {

    if (window.ontransitionend === undefined &&
        window.onwebkittransitionend !== undefined
    ) {
        transitionProp = 'WebkitTransition'
        transitionEndEvent = 'webkitTransitionEnd'
    }
    if (window.onanimationend === undefined &&
        window.onwebkitanimationend !== undefined
    ) {
        animationProp = 'WebkitAnimation'
        animationEndEvent = 'webkitAnimationEnd'
    }
}
```

可见不是每个浏览器都支持，那么现在进入正片：

```js
// all 和 transform都是
const transformRE = /\b(transform|all)(,|$)/;
function getTransitionInfo(el: Element, expectedType ? : ? string) : {
    type: ? string;
    propCount: number;
    timeout: number;
    hasTransform: boolean;
} {

    // 获取元素的样式表信息
    const styles: any = window.getComputedStyle(el);

    // JSDOM may return undefined for transition properties
    // 分别获取过渡或动画的各种信息，但注意可能会返回undefined(如有多个值则以, 分隔)
    const transitionDelays: Array < string > = (styles[transitionProp + 'Delay'] || '').split(', ')
    const transitionDurations: Array < string > = (styles[transitionProp + 'Duration'] || '').split(', ');

    // 获取其超时时间
    const transitionTimeout: number = getTimeout(transitionDelays, transitionDurations)
    const animationDelays: Array < string > = (styles[animationProp + 'Delay'] || '').split(', ')
    const animationDurations: Array < string > = (styles[animationProp + 'Duration'] || '').split(', ')
    const animationTimeout: number = getTimeout(animationDelays, animationDurations)

    let type: ? string
    let timeout = 0;

    // 确认有几组动画属性
    let propCount = 0;

    // 根据过渡类型，确认以上三个值
    if (expectedType === TRANSITION) {
        if (transitionTimeout > 0) {
            type = TRANSITION
            timeout = transitionTimeout
            propCount = transitionDurations.length
        }
    } else if (expectedType === ANIMATION) {
        if (animationTimeout > 0) {
            type = ANIMATION
            timeout = animationTimeout
            propCount = animationDurations.length
        }
    } else {

        // 未指定类型时，取两者中最大的值
        timeout = Math.max(transitionTimeout, animationTimeout)
        type = timeout > 0 ?
            transitionTimeout > animationTimeout ?
            TRANSITION :
            ANIMATION :
            null
        propCount = type ?
            (type === TRANSITION ?
            transitionDurations.length : animationDurations.length)
            : 0;
    }

    // 是否为transform/all类型过渡动画
    const hasTransform: boolean =
        type === TRANSITION &&
        transformRE.test(styles[transitionProp + 'Property']);

    // 返回自动测试的结果
    return {
        type,

        // 过渡的时间间隔
        timeout,

        // 过渡的属性个数
        propCount,

        // 过渡属性中是否含有transform/all
        hasTransform
    };
}
```

可以看出该函数以对应元素的`style`对象上具体`transform`或`animation`的值来提取对应的属性。这里要说明一下，我们可以一次性定义多组属性的动画，如`transition: width 3s ease, height .3s ease`，待提取到样式表对象中时，相同属性会以`,`分隔。

其次上面计算超时时间其实就是计算全部属性动画当中，其`延迟执行时间+动画执行时间`最大的，调用的`getTimeout()`方法：

```js
function getTimeout(delays: Array < string > , durations: Array < string > ): number {

    // 因为delays的数量肯定是小于等于durations的，所以将它们的数量至少与duration匹配
    while (delays.length < durations.length) {
        delays = delays.concat(delays);
    }

    // 返回其中delay + duration最高的，作为超时时间
    return Math.max.apply(null, durations.map((d, i) => {

        // 转换为ms单位
        return toMs(d) + toMs(delays[i]);
    }));
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer numbers
// in a locale-dependent way, using a comma instead of a dot.
// 旧版本的Chromium格式化浮点数字时，会使用，而不是.
// If comma is not replaced with a dot, the input will be rounded down (i.e. acting
// as a floor function) causing unexpected behaviors
// 如果，没有被.取代那么输入值将会被四舍五入(表现得为Math.floor)达不到预期
function toMs(s: string): number {
    return Number(s.slice(0, -1).replace(',', '.')) * 1000
}
```

## once()——只执行一次的函数

函数和简单，就是用闭包设置一个标记变量来判断函数是否已经调用过，之后在调用时就直接返回不执行。

```js
function once(fn: Function): Function {

    // 标记位，表示是否已经调用
    let called = false;
    return function () {
        if (!called) {
            called = true
            fn.apply(this, arguments)
        }
    }
}
```
