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
## updateListeners()——更新vm上的自定义事件对象
其作用为：对比前后的自定义事件对象：
1. 如果用户注册时马虎了值都不给，则报错
2. 如果为新增事件，则直接添加该事件
3. 如果之前存在该事件，则替换
4. 最后移除vm实例上新事件对象中已不存在的老事件

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
    let name, def, cur, old, event;
    for (name in on) {

        // 取出事件函数
        def = cur = on[name];
        old = oldOn[name];

        // 标准化事件名(提取简写的修饰符)
        event = normalizeEvent(name);

        // 事件为对象的形式处理
        if (__WEEX__ && isPlainObject(def)) {
            cur = def.handler;
            event.params = def.params;
        }

        // 只注册了自定义函数名称，未给出任何值
        if (isUndef(cur)) {
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            );

        // 如果之前未定义过该名称的事件
        } else if (isUndef(old)) {

            if (isUndef(cur.fns)) {

                // 为该事件创建一个调度函数，帮将该事件挂载在函数的静态属性上
                cur = on[name] = createFnInvoker(cur, vm);
            }

            if (isTrue(event.once)) {

                // 如果为一次性事件，则重新创建一个特殊的调度函数
                cur = on[name] = createOnceHandler(event.name, cur, event.capture);
            }

            // 最后在该Vue实例的_event中添加该自定义函数数组
            add(event.name, cur, event.capture, event.passive, event.params);

        // 之前定义过该名称事件时，替换旧的事件函数
        } else if (cur !== old) {
            old.fns = cur;
            on[name] = old;
        }
    }

    // 最后从vm上移除已经不存在的事件
    for (name in oldOn) {
        if (isUndef(on[name])) {
            event = normalizeEvent(name);
            remove(event.name, oldOn[name], event.capture);
        }
    }
}
```

在这之中添加新事件时，封装了一层函数的函数`createFnInvoker()`，用于对所有事件的函数进行错误处理：
```js
// 创建一个调度函数，并把该函数挂载其自身属性上。
function createFnInvoker(fns: Function | Array < Function > , vm: ? Component): Function {
    function invoker() {
        const fns = invoker.fns
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
    invoker.fns = fns;
    return invoker;
}
```