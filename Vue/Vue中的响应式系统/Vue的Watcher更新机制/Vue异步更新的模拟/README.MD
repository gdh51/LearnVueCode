# Vue异步更新时间的选择

在`Vue`更新`Watcher`时，选择的事件循环时间端无法两个：

- 当前微任务阶段
- 下一个宏任务阶段

`Vue`优先选择第一种情况，降级选择第二种情况，然后这种选择决定于`timerFunc()`函数的初始化结果。

## timerFunc——event loop 任务类型的选择

在`Vue`中`timerFunc()`有以下三种，按以下情况选取：

1. 优先选择`microtask`微任务
2. 再按浏览器兼容性降级使用`Promise` ——> `MutationObserver` ——> `setImmediate` ——> `setTimeout`

```js
// 是否使用微任务
let isUsingMicroTask = false;

// 等待执行的函数的队列
const callbacks = [];

// 是否需要等待执行当前的调度任务执行完毕
let pending = false;

if (typeof Promise !== 'undefined' && isNative(Promise)) {
    const p = Promise.resolve();
    timerFunc = () => {
        // 在当前宏任务结束后执行回调
        p.then(flushCallbacks);
        // In problematic UIWebViews, Promise.then doesn't completely break, but
        // it can get stuck in a weird state where callbacks are pushed into the
        // microtask queue but the queue isn't being flushed, until the browser
        // needs to do some other work, e.g. handle a timer. Therefore we can
        // "force" the microtask queue to be flushed by adding an empty timer.
        if (isIOS) setTimeout(noop);
    };
    isUsingMicroTask = true;
} else if (
    !isIE &&
    typeof MutationObserver !== 'undefined' &&
    (isNative(MutationObserver) ||
        // PhantomJS and iOS 7.x
        MutationObserver.toString() === '[object MutationObserverConstructor]')
) {
    // Use MutationObserver where native Promise is not available,
    // e.g. PhantomJS, iOS7, Android 4.4
    // (#6466 MutationObserver is unreliable in IE11)
    // 不支持promise情况下微任务的降级方案,上面的描述是支持的版本
    // 关于MutationObserver自行百度
    let counter = 1;
    const observer = new MutationObserver(flushCallbacks);
    const textNode = document.createTextNode(String(counter));
    observer.observe(textNode, {
        characterData: true
    });

    timerFunc = () => {
        counter = (counter + 1) % 2;
        textNode.data = String(counter);
    };

    isUsingMicroTask = true;
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    // Fallback to setImmediate.
    // Techinically it leverages the (macro) task queue,
    // but it is still a better choice than setTimeout.
    // node环境中的优先选择，虽然是宏任务但是比setTimtout更优
    timerFunc = () => {
        setImmediate(flushCallbacks);
    };
} else {
    // Fallback to setTimeout.
    timerFunc = () => {
        setTimeout(flushCallbacks, 0);
    };
}

// 在微任务阶段或下一个宏任务阶段执行nextTick中所有的回调即我们刚刚存入callbacks队列中的函数
function flushCallbacks() {

    // 允许开起下一轮任务循环
    pending = false;

    // 复制原队列并清空原队列
    const copies = callbacks.slice(0);
    callbacks.length = 0;

    // 执行callback中的任务
    for (let i = 0; i < copies.length; i++) {
        copies[i]();
    }
}
```

## nextTick()——基于Vue异步更新的模拟函数

那么在之前选择了更新的时间段的情况下，该函数就用于调度这个这个更新，并像更新队列中添加更新时执行的回调函数。

```js
const callbacks = [];

// 是否等待当前timeFunc执行完毕
let pending = false;

function nextTick(cb?: Function, ctx?: Object) {
    let _resolve;

    // 将下一轮渲染要执行的回调函数加入队列。
    callbacks.push(() => {
        if (cb) {
            try {
                cb.call(ctx);
            } catch (e) {
                handleError(e, ctx, 'nextTick');
            }
        } else if (_resolve) {
            _resolve(ctx);
        }
    });

    // 启用一个event loop的任务来进行视图更新
    if (!pending) {
        pending = true;
        timerFunc();
    }

    // 未传入回调函数时，返回一个空promise，并会在微任务执行时进行resolve
    if (!cb && typeof Promise !== 'undefined') {
        return new Promise(resolve => {
            _resolve = resolve;
        });
    }
}
```

这里我们可以看出`nextTick()`函数干了两件事：

1. 依次存储本轮`eventLoop`中全部`nextTick()`传入的的回调函数
2. 调用一次`timerFunc()`来在下一次`eventloop`时依次执行这些回调
3. **未传入回调函数**的时候，在下一轮`eventloop`时返回一个`fullfilled`状态的`Promise`对象

在该函数中也即微任务阶段或下一个宏任务阶段便会执行`flushCallbacks()`, `flushCallbacks()`函数中便取出之前通过`nextTick()`函数存入的回调函数来依次执行。当是由`Dep`变更引起的更新时，`callback`数组的第一个函数一般为`flushSchedulerQueue()`，它负责更新`Watcher`。当然也可以由我们调用`Vue.prototype.$nextTick()`接口来启动，该接口如下：

```js
// 封装的nextTick函数
Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
}
```
