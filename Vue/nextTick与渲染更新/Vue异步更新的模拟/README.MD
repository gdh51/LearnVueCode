## timerFunc——event loop 任务类型的选择

在 Vue 中`timerFunc()`有以下三种，按以下情况选取：

1. 优先选择`microtask`微任务
2. 再按浏览器兼容性降级使用`Promise` ——> `MutationObserver` ——> `setImmediate` ——> `setTimeout`

```js
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