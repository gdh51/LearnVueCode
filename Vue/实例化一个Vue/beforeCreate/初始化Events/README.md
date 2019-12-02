# initEvent

该函数用于初始化用户添加在组件上的自定义事件。

>在看这个方法之前，先来看看我们在Vue构造函数初始化时，添加的四个关于处理事件的实例方法
[点击前往-Vue事件处理相关](../Vue事件处理相关)

首先当然是定义一个用于存放事件的数组容器，然后调用`updateComponentListeners()`方法更新`Vue`实例的事件监听器：

```js
function initEvents(vm: Component) {
    vm._events = Object.create(null);
    vm._hasHookEvent = false;

    // init parent attached events
    // 初始化挂载在组件上的自定义事件(即定义在父组件中的自己组件上的事件)
    const listeners = vm.$options._parentListeners;

    if (listeners) {
        updateComponentListeners(vm, listeners)
    }
}
```

调用`updateComponentListeners()`方法的目的就是在`target`指向的`Vue`实例上更新其自定义事件对象中的事件：

```js
// 用于指定事件挂载的对象，此处就是Vue实例
let target = null;
function updateComponentListeners(
    vm,
    listeners,
    oldListeners
) {
    target = vm;
    updateListeners(listeners, oldListeners || {}, add, remove$1, createOnceHandler, vm);
    target = undefined;
}

// 这里的add和remove$1为
function add(event, fn) {
    target.$on(event, fn)
}

function remove(event, fn) {
    target.$off(event, fn)
}

// 这个一次性函数处理器
function createOnceHandler(event, fn) {
    const _target = target;
    return function onceHandler() {
        const res = fn.apply(null, arguments)
        if (res !== null) {
            _target.$off(event, onceHandler)
        }
    }
}
```

`updateListeners()`具体用于更新事件对象上的自定义事件，有就继续添加，已不存在的事件就删除等等：

## updateListeners()——更新xx上的事件对象

该函数是一个用于更新事件监听器的封装函数，不仅仅是用于上述的更新自定义事件，之后也会使用该函数来更新`DOM`事件。你可以理解该函数为一个`diff`函数，用于找出前后两个事件对象的不同，然后进行增删改的操作，但总体的`diff`的过程如下：

1. 如果当前存在最新的事件对象，但未给出回调函数则报错。
2. 如果为新增事件，则直接添加该事件。
3. 如果之前的事件对象与当前事件对象都存在该事件但回调函数中存在差异，则替换。
4. 最后移除新事件对象中已不存在的老事件

```js
function updateListeners(

    // 新的自定义事件对象
    on: Object,

    // 旧的自定义事件对象
    oldOn: Object,

    // 用于添加自定义事件和删除的函数
    add: Function,
    remove: Function,
    createOnceHandler: Function,
    vm: Component
) {
    let name, // 事件的名称
        def, // 最新该事件的回调函数
        cur, // 当前处理中该事件的回调函数
        old, // 之前该事件的回调函数
        event;

    // 这里进行遍历，所以on对象中一定存在某个事件，但可能该事件无值
    for (name in on) {

        // 取出事件的回调函数(可能为数组队列)
        def = cur = on[name];
        old = oldOn[name];

        // 标准化事件名(提取简写的修饰符)
        event = normalizeEvent(name);

        // 最新的该事件，只注册了该事件，但未给出回调函数
        if (isUndef(cur)) {
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            );

        // 当前存在该事件，如果之前未注册过该事件，则分为以下情况处理
        } else if (isUndef(old)) {

            // 当前最新的事件的处理函数未再之前注册过
            if (isUndef(cur.fns)) {

                // 为该事件创建一个调度函数，帮将该事件挂载在函数的静态属性上
                cur = on[name] = createFnInvoker(cur, vm);
            }

            // 如存在.once修饰符则在进行一层封装
            if (isTrue(event.once)) {

                // 如果为一次性事件，则重新创建一个特殊的调度函数
                cur = on[name] = createOnceHandler(event.name, cur, event.capture);
            }

            // 最后在该Vue实例的_event中添加该事件的回调函数数组
            add(event.name, cur, event.capture, event.passive, event.params);

        // 之前定义过该名称事件，但两者现在不同，则替换旧的事件函数
        } else if (cur !== old) {

            // 同样注意这个标记位，直接替换里面的函数就可以不同重新创建一个Invoker
            old.fns = cur;

            // 覆盖新的事件处理对象
            on[name] = old;
        }
    }

    // 最后移除那些已经不存在的事件
    for (name in oldOn) {
        if (isUndef(on[name])) {
            event = normalizeEvent(name);
            remove(event.name, oldOn[name], event.capture);
        }
    }
}
```

首先先看看`normalizeEvent()`函数是个什么东西：

```js
// 标准化事件的名称，这里是针对事件添加简写的修饰符的情况
const normalizeEvent = cached((name: string): {
    name: string,
    once: boolean,
    capture: boolean,
    passive: boolean,
    handler ? : Function,
    params ? : Array < any >
} => {
    // 提取具体的修饰含义，从这里我们可以看出修饰符的顺序不能有错，否则有可能会无效
    const passive = name.charAt(0) === '&';
    name = (passive ? name.slice(1) : name);
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = (once ? name.slice(1) : name);
    const capture = name.charAt(0) === '!';
    name = (capture ? name.slice(1) : name);
    return {
        name,
        once,
        capture,
        passive
    };
});
```

比较简单，就是对于那些直接在事件名称中添加简写修饰符的处理函数。
____

这里往细的说，可以说明对比两个事件对象的后两个情况：

- [新增事件的情况](#%e6%96%b0%e5%a2%9e%e4%ba%8b%e4%bb%b6%e7%9a%84%e6%83%85%e5%86%b5)
- [同个事件前后回调函数存在差异](#%e5%90%8c%e4%b8%aa%e4%ba%8b%e4%bb%b6%e5%89%8d%e5%90%8e%e5%9b%9e%e8%b0%83%e5%87%bd%e6%95%b0%e5%ad%98%e5%9c%a8%e5%b7%ae%e5%bc%82)

### 新增事件的情况

首先是**新增事件**的情况，这种情况会查看事件的是否存在一个`.fns`标记，该标记用于证明该事件的处理函数是否已经通过`createFnInvoker()`封装过，防止重复封装。具体封装过程如下：

#### createFnInvoker()——封装事件处理函数

在添加事件处理函数前，会调用`createFnInvoker()`对原事件处理函数(也可能是处理函数数组)，该函数主要将全部函数封装为一个，然后一次性进行调用，并注册错误处理机制：

```js
// 创建一个调度函数，并把该函数挂载其自身属性上。
function createFnInvoker(fns: Function | Array < Function > , vm: ? Component): Function {
    function invoker() {
        const fns = invoker.fns;

        // 根据该事件的处理函数个数继续不同方式的调用
        if (Array.isArray(fns)) {
            const cloned = fns.slice();
            for (let i = 0; i < cloned.length; i++) {
                invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
            }
        } else {
            // return handler return value for single handlers
            return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
        }
    }

    // 标记位，表示已经封装过，同时存放原来的事件处理函数
    invoker.fns = fns;
    return invoker;
}
```

仔细看这个函数我们就会发现：**同一个类型的事件，更新事件处理器时，只用更新其中的`.fns`里面的回调函数**。

其中[invokeWithErrorHandling](../Vue事件处理相关/README.md#invokewitherrorhandling)为一个函数调用的封装，增加了错误处理的功能。

### 同个事件前后回调函数存在差异

这种情况下，因为刚刚看过[`createFnInvoker()`]是如何封装和调用的，所以直接将旧的`.fns`中的事件处理函数替换掉，然后再将旧的事件处理函数赋值给新的事件对象即可。

```js
if (cur !== old) {

    // 同样注意这个标记位，直接替换里面的函数就可以不同重新创建一个Invoker
    old.fns = cur;

    // 覆盖新的事件处理对象
    on[name] = old;
}
```

____

具体这个过程中设计到对`target`(即事件所挂载的目标)的处理，这是根据其传入的回调决定的，这里不具体说明。

