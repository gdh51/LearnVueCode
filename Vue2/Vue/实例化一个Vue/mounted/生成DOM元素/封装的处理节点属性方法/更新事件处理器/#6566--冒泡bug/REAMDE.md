# add()——函数与bug #6556

[原案例](https://jsbin.com/qejofexedo/edit?html,js,output)

首先从这个例子可以看出，点击文字`Expand is True`，正常情况，通过冒泡应该只有`countB`进行增加，而例子中两者都进行了增加。下面直接将例子模版放下面：

```html
<div class="panel" id="app">
    <div class="header" v-if="expand">
        <i @click="expand = false, countA++">Expand is True</i>
    </div>
    <div class="expand" v-if="!expand" @click="expand = true, countB++">
        <i>Expand is False</i>
    </div>
    <div>
        countA: {{countA}}
    </div>
    <div>
        countB: {{countB}}
    </div>
    Please Click `Expand is Ture`.
</div>
```

问题原因是因为`header`与`expand`结构相同，在`patch`阶段会复用该`DOM`元素。我们知道`patch`阶段一般情况下是微任务阶段，而**事件冒泡的时间恰好也是在微任务阶段之间**。由于复用了`DOM`元素，所以会在`patch`阶段对外层的`DOM`元素进行添加事件处理器，然后此时事件冒泡到外层，触发了外层元素的事件，导致了两个数值都进行了增加。

## add()函数

先过目一眼`add()`函数，是不是感觉很复杂。

```js
// #9446: Firefox <= 53 (in particular, ESR 52) has incorrect Event.timeStamp
// implementation and does not fire microtasks in between event propagation, so
// safe to exclude.
// 在Vue是不是微任务阶段进行更新时或且FF版本小于53时，不使用微任务修复
const useMicrotaskFix = isUsingMicroTask && !(isFF && Number(isFF[1]) <= 53)

function add(
    name: string,
    handler: Function,
    capture: boolean,
    passive: boolean
) {
    // async edge case #6566: inner click event triggers patch, event handler
    // attached to outer element during patch, and triggered again. This
    // happens because browsers fire microtask ticks between event propagation.
    // the solution is simple: we save the timestamp when a handler is attached,
    // and the handler would only fire if the event passed to it was fired
    // AFTER it was attached.
    // 异步边缘情况：假设事件委托的情况，子元素的点击事件触发导致dom重新进行patch，
    // 事件监听器会在patch时添加至父元素，然后再通过冒泡触发父节点的事件。这种情况发生的原因是因为
    // 浏览器会在事件冒泡期间触发微任务队列的调用。
    if (useMicrotaskFix) {

        // 当前开始刷新队列的时间，事件被添加的时间要延后，但可以理解为事件添加的时间
        const attachedTimestamp = currentFlushTimestamp;

        // 获取未封装前的事件监听器
        const original = handler;
        handler = original._wrapper = function (e) {
            if (
                // no bubbling, should always fire.
                // 如果不是由冒泡触发，则永远直接触发
                // this is just a safety net in case event.timeStamp is unreliable in
                // certain weird environments...
                // 因为这是以防万一，在有些环境中事件的时间戳不可靠
                // 这个是判断是否为冒泡或捕获触发的事件
                e.target === e.currentTarget ||

                // event is fired after handler attachment
                // 事件会在处理器添加后被调用
                // 这里表示只有创建时间在开始刷新队列之后的事件才会调用
                e.timeStamp >= attachedTimestamp ||

                // bail for environments that have buggy event.timeStamp implementations
                // #9462 iOS 9 bug: event.timeStamp is 0 after history.pushState
                // #9681 QtWebEngine event.timeStamp is negative value
                // 平稳退化，有些环境的该值为0，或负数，有些环境在调用history API后该值为0
                e.timeStamp <= 0 ||

                // #9448 bail if event is fired in another document in a multi-page
                // electron/nw.js app, since event.timeStamp will be using a different
                // starting reference
                // 兼容有些环境，如有些事件在另一个文档中被调用。这就会导致timeStamp会有一个不同的
                // 开始值
                e.target.ownerDocument !== document
            ) {
                return original.apply(this, arguments);
            }
        };
    }

    // 添加事件
    target.addEventListener(
        name,
        handler,
        supportsPassive ?
        {
            capture,
            passive
        } :
        capture
    )
}
```

看完该函数，我们的主要的关注点在`if`条件语句中，由于最开始阐述了发生错误的原因，所以这里不再解释了。在添加该事件的事件监听器时，就用闭包将**该事件被添加的时间**存储了起来(这里准确说事件被添加的时间在这之后)。如果每次触发刷新队列时，会更新[`currentFlushTimestamp`](../../../../../../nextTick与渲染更新/README.md#flushschedulerqueue%e6%9b%b4%e6%96%b0watcher)的值，以记录下一个`patch`过程中要被添加的事件的时间。

## 解决方案

因为创建一个事件对象时，会存在一个事件对象被触发时的时间(**注意：这就意味着如果是通过冒泡的形式触发该事件，那么每个事件的`event.timeStamp`都一样，为最初被触发的时间**)。同时，在添加事件监听器时，我们记录下**上一次**开始刷新队列的时间(即上次更新`Watcher`的时间)。通过对比它们两个的值(即`currentFlushTimestamp > e.timeStamp`)，就可以得出哪些事件监听器是之后在刷新队列时添加上去的。

## 解决方案的由来(即为什么这么做)

就拿我们之前出问题的`DOM`结构来举例，当我们最初初始化全部`Vue`实例时，即最初的队列刷新时间为`0`，所以此时注册事件监听器时，`currentFlushTimestamp`值取`0`。当我们点击`Expand is True`时，首先触发内部元素的点击事件，此时`e.timeStamp`的值为任意大于`0`的数值，所以被点击的元素会调用事件处理函数，此时事件处理函数会改变`countA`的值与`expand`，导致重新刷新队列，然后进入微任务阶段更新队列。此时因为两个元素结构相似，所以会复用，此时会在外部元素上添加一个新的事件以及事件处理器，因为我们知道`currentFlushTimestamp`取最新刷新队列的值，所以该值是肯定小于`e.timeStamp`的。之后便是事件冒泡到父元素触发父元素的事件，注意此时的`e.timeStamp`与子元素的一样。所以如果是在刷新队列时添加的事件处理器，就会导致`currentFlushTimestamp > e.timeStamp`，这也就间距说明了该事件不应该被调用，因为不是原结构的事件处理函数。

**该方法的关键之处就在于事件冒泡过程中`e.timeStamp`始终为最初触发事件的值，而不是每个事件触发时的值。**

还有一个解决方法，那就是给外部的父元素添加一个`key`值，防止其复用。
