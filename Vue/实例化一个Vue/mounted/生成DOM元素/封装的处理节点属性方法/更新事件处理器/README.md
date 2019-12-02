# updateDOMListener()——更新dom事件处理器

该函数用于对比新旧两个`VNode`节点上的`on`事件对象，然后对当前的`DOM`元素进行事件处理函数的更新。

```js

// 处理的元素
let target: any;

function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {

    // 新旧节点都没有事件监听器，则直接返回
    if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
        return
    }

    // 新旧事件对象
    const on = vnode.data.on || {};
    const oldOn = oldVnode.data.on || {};

    // 取出新节点的dom元素
    target = vnode.elm;

    // 标准化v-model绑定的事件
    normalizeEvents(on);

    // 对比前后的事件对象，然后向target上添加事件
    updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context)

    // 清空target
    target = undefined;
}
```

首先，依然是没有事件就退出，不做处理。

首先是调用`normalizeEvents()`函数处理`v-model`的特殊情况：

## normalizeEvents()——处理v-model的特殊情况

主要就是处理`IE`的`<input type="range">`上绑定的`v-model`，因为它只支持`change`事件，其他浏览器是支持该元素的`input`事件的。并且处理该元素的事件时，会将其该事件永远放于事件队列的第一位。

```js
// normalize v-model event tokens that can only be determined at runtime.
// 标准化v-model的token，只能在运行时确定
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
// 将其放至事件处理器数组的第一位，以保证v-model的回调函数能在其他回调函数前触发
function normalizeEvents(on) {

    // 是否为range类型的input的双向绑定
    if (isDef(on[RANGE_TOKEN])) {

        // IE input[type=range] only supports `change` event
        // IE 只支持change事件
        const event = isIE ? 'change' : 'input';

        // 将该事件至于事件处理函数的第一位
        on[event] = [].concat(on[RANGE_TOKEN], on[event] || []);

        // 删除该占位符token
        delete on[RANGE_TOKEN];
    }

    // This was originally intended to fix #4521 but no longer necessary
    // after 2.5. Keeping it for backwards compat with generated code from < 2.4
    // 用于解决#4521问题，但现在没有必要，现在只用于向后兼容
    // v-model是否定义在checkbox上
    if (isDef(on[CHECKBOX_RADIO_TOKEN])) {

        // 将其至于回调函数队列的第一个位置
        on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
        delete on[CHECKBOX_RADIO_TOKEN]
    }
}
```

下面还有一种特殊的情况，但现在已经不做任何处理了，意思是这段代码永远不会运行:

```js
if (isDef(on[CHECKBOX_RADIO_TOKEN])) {

    // 将其至于回调函数队列的第一个位置
    on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
    delete on[CHECKBOX_RADIO_TOKEN]
}
```

## updateListeners()——更新target的事件

接下来是调用`updateListeners()`来对比两个`on`事件对象，来对指定的`target`上更新对应的事件。该函数最初出现的`initEvent()`函数之中([复习`updateListeners()`](../../../beforeCreate/初始化Events/README.md#updatelisteners%e6%9b%b4%e6%96%b0xx%e4%b8%8a%e7%9a%84%e4%ba%8b%e4%bb%b6%e5%af%b9%e8%b1%a1))

那么就下来我们需要学习的就是这几个用于增删改事件的方法了：

### add()——向DOM元素添加事件

这个函数本来比较简单，但是涉及到一个`BUG`，[原地址](https://github.com/vuejs/vue/issues/6566)，[#6566，同时关于add()函数的处理](./#6566--冒泡bug/REAMDE.md)，这里会同该`bug`一起对该方法进行学习。

### remove()——移除DOM元素事件

该函数没什么好讲的，就是`removeEventListener()`方法的封装。

```js
function remove(
    name: string,
    handler: Function,
    capture: boolean,
    _target ? : HTMLElement
) {

    // 直接移除该事件
    (_target || target).removeEventListener(
        name,
        handler._wrapper || handler,
        capture
    )
}
```

### createOnceHandler()——创建一次性的事件

该事件用于创建一次性的事件，调用后自动解除事件。

```js
function createOnceHandler(event, handler, capture) {

    // 用一个闭包来存储当前的目标元素
    const _target = target // save current target element in closure

    // 返回一个调用函数，用来调用事件处理器
    return function onceHandler() {

        // 调用该函数，然后调用remove函数移除事件处理器
        const res = handler.apply(null, arguments)
        if (res !== null) {
            remove(event, onceHandler, capture, _target)
        }
    }
}
```

该函数代码很简单，但是这时可能你会有个疑惑，因为同种事件都是封装为一个`invokeWithErrorHandling()`处理器函数，那么如果添加为一次性事件到时候处理器不是会全部都移除吗？

其实不然，`Vue`在模版解析的阶段，会将`.once`事件修饰符解析为`~`添加到事件名的最前面。这就会单独形成另一个事件。如果同时具有两个`.once`事件呢，那么就会变成数组的形式一次性解除事件处理函数。
