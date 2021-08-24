# Vue 事件处理相关的方法

在 `Vue` 最初初始化时(`eventsMixin()`)方法中，我们曾将 4 个事件相关的处理方法添加至 `Vue` 的原型对象上，现在来逐个看一下各个函数：

> 注册后的自定义事件存放在 `Vue` 实例的`_events` 属性中

```js
// 用于判断是否为狗子函数
const hookRE = /^hook:/;
```

下面按事件周期来介绍以下这 4 个函数：

- [$on——注册一个或多个事件](#on%e6%b3%a8%e5%86%8c%e4%b8%80%e4%b8%aa%e6%88%96%e5%a4%9a%e4%b8%aa%e4%ba%8b%e4%bb%b6)
- [$off——取消一个自定义事件](#off%e5%8f%96%e6%b6%88%e4%b8%80%e4%b8%aa%e8%87%aa%e5%ae%9a%e4%b9%89%e4%ba%8b%e4%bb%b6)
- [$once——注册一次性事件](#once%e6%b3%a8%e5%86%8c%e4%b8%80%e6%ac%a1%e6%80%a7%e4%ba%8b%e4%bb%b6)
- [$emit——触发自定义事件](#emit%e8%a7%a6%e5%8f%91%e8%87%aa%e5%ae%9a%e4%b9%89%e4%ba%8b%e4%bb%b6)

## $on——注册一个或多个事件

首先是向`Vue`实例注册自定义事件的方法，支持同时向多个自定义事件注册同一个函数；注册后每一个自定义事件都是挂载在该事件名的数组队列中的：

```js
Vue.prototype.$on = function(
    event: string | Array<string>,
    fn: Function
): Component {
    const vm: Component = this;

    if (Array.isArray(event)) {
        // 数组形式时，递归调用该方法添加事件
        for (let i = 0, l = event.length; i < l; i++) {
            vm.$on(event[i], fn);
        }
    } else {
        // 将事件添加至对应名称的数组中
        (vm._events[event] || (vm._events[event] = [])).push(fn);

        // optimize hook:event cost by using a boolean flag marked at registration
        // instead of a hash lookup
        // 在注册hook:event类似的事件时，使用boolean值来标记，而不是通过一个hash map来查找
        // 这样可以优化这个注册过程

        // 是否存在钩子函数
        if (hookRE.test(event)) {

            // 标记该实例有通过$on注册的生命周期事件
            vm._hasHookEvent = true;
        }
    }

    return vm;
};
```

在介绍`$once`之前必须知道如何取消一个自定义事件

## $off——取消一个自定义事件

该方法用于取消一个事件，可以指定具体该事件的函数，但要注意如果该函数不存在于该事件队列中，则不会做任何事:

```js
Vue.prototype.$off = function(
    event?: string | Array<string>,
    fn?: Function
): Component {
    const vm: Component = this;

    // 未传入参数时，直接清空所有的自定义事件
    if (!arguments.length) {
        vm._events = Object.create(null);
        return vm;
    }

    // 以数组形式传入事件名时, 递归调用该函数解除函数绑定
    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            vm.$off(event[i], fn);
        }
        return vm;
    }

    // 指定单个具体函数名时，清空该名称下自定义事件的全部回调函数
    const cbs = vm._events[event];
    if (!cbs) {
        return vm;
    }
    if (!fn) {
        vm._events[event] = null;
        return vm;
    }

    // 如果具体指定了某个函数，则清空该事件名下指定的函数
    let cb;
    let i = cbs.length;
    while (i--) {
        cb = cbs[i];
        if (cb === fn || cb.fn === fn) {
            cbs.splice(i, 1);
            break;
        }
    }
    return vm;
};
```

熟悉了这两个函数后，我们就可以来看一下`$once`方法了

## $once——注册一次性事件

我可以通过该方法来注册一个一次性的自定义事件，在其调用后，立刻自动注销，其实就是`$on`+`$off`方法的语法糖

```js
Vue.prototype.$once = function(event: string, fn: Function): Component {
    const vm: Component = this;

    // 封装了一下用户传入的回调函数，在调用前就清除该自定义事件
    function on() {
        vm.$off(event, on);
        fn.apply(vm, arguments);
    }

    // 这里挂载.fn属性上是因为所以函数会挂在上面
    on.fn = fn;
    vm.$on(event, on);
    return vm;
};
```

最后呢就是触发这些自定义方法的函数`$emit`

## $emit——触发自定义事件

这个方法用来触发我们的自定义事件，传入其事件名与想传入的参数，它会调用该事件数组中的所有自定义事件回调函数：

```js
Vue.prototype.$emit = function(event: string): Component {
    const vm: Component = this;

    // 如果用户用大写的形式触发事件，恰好有该名称为小写的事件，那么warning用户
    if (process.env.NODE_ENV !== 'production') {
        const lowerCaseEvent = event.toLowerCase();
        if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
            tip(
                `Event "${lowerCaseEvent}" is emitted in component ` +
                    `${formatComponentName(
                        vm
                    )} but the handler is registered for "${event}". ` +
                    `Note that HTML attributes are case-insensitive and you cannot use ` +
                    `v-on to listen to camelCase events when using in-DOM templates. ` +
                    `You should probably use "${hyphenate(
                        event
                    )}" instead of "${event}".`
            );
        }
    }
    let cbs = vm._events[event];
    if (cbs) {
        // 将类数组对象转换为数组对象
        cbs = cbs.length > 1 ? toArray(cbs) : cbs;

        // 用户传入的参数
        const args = toArray(arguments, 1);
        const info = `event handler for "${event}"`;

        // 遍历调用该自定义事件的全部回调函数
        for (let i = 0, l = cbs.length; i < l; i++) {
            invokeWithErrorHandling(cbs[i], vm, args, vm, info);
        }
    }
    return vm;
};
```

在调用这些事件时，是通过下面这个函数来实现的：

### invokeWithErrorHandling()

该函数就是对一个回调函数的调用额外进行了错误处理的封装，容易理解：

```js
function invokeWithErrorHandling(
    handler: Function,
    context: any,
    args: null | any[],
    vm: any,
    info: string
) {
    let res;
    try {

        // 根据是否存在参数调用不同的call/apply方法来执行回调函数
        res = args ? handler.apply(context, args) : handler.call(context);

        // 返回的非被响应式观察的对象，且为Promise实例时，则对其进行错误处理
        if (res && !res._isVue && isPromise(res) && !res._handled) {
            res.catch(e => handleError(e, vm, info + ` (Promise/async)`));
            // issue #9511
            // avoid catch triggering multiple times when nested calls
            // 避免在嵌套调用时，多次触发catch函数
            res._handled = true;
        }
    } catch (e) {
        handleError(e, vm, info);
    }
    return res;
}
```
