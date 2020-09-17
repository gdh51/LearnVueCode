# 函数式路由跳转

函数式跳转主要调用 5 个 api：

- [router.push——push 式跳转](#routerpushpush-式跳转)
- [router.replace——replace 式跳转](#routerreplacereplace-式跳转)

那么这里就按常用的顺序来进行学习。

## router.push——push 式跳转

首先看函数，该函数也是我们平时调用的函数，只是大家可能平时不实用第二个和第三个参数。

```js
router.push(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {

    // 指定更新完成或中断的回调函数时，调用Promise进行更新
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
        return new Promise((resolve, reject) => {
            this.history.push(location, resolve, reject)
        });

    // 当通过link跳转时，调用对应的历史模式进行组件更新
    } else {
        this.history.push(location, onComplete, onAbort)
    }
}
```

像我们平时使用时，就是走的第一种情况，此时会返回一个`Promise`，老规矩我们还是把`hitstory`作为`html5`处理，那么此时进行这样的调用：

```js
history.push(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {

    // 获取当前(跳转前)的Route
    const {
        current: fromRoute
    } = this;

    this.transitionTo(location, route => {
        pushState(cleanPath(this.base + route.fullPath))
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
    }, onAbort)
}
```

看到这里你也许就明白了，就和初始化一样，同样也是调用[`history.transitionTo()`](../../../路由模式/base基础模式/实例方法/README.md#route过渡切换historytransitionto)来进行路由跳转，那么在`Route`切换成功后，那么就会执行以下函数：

```js
(route) => {
  // 调用pushState()进行浏览器跳转
  pushState(cleanPath(this.base + route.fullPath));

  // 查看滚动条行为
  handleScroll(this.router, route, fromRoute, false);

  // 执行自定义的完成函数，未传入时则resolve整个Promise对象，表示Route跳转完毕
  onComplete && onComplete(route);
};
```

这里我们不探讨滚动条的处理。对于我们传入的`onComplete()`函数(第二个参数)，其传入最新的`Route`最为参数。

除此之外，我们知道在执行完上面这个函数后，会立刻调用[`html5.ensureURL()`](../../../路由模式/history模式/实例方法/README.md#切换浏览器urlhistoryensureurl)进行`pushState()`跳转(和上面方法中的该同名方法一样)，但是没事`html5.ensureURL()`方法会在确保`URL`未变更时，才会调用，所以相对于没有调用该方法。

那么`router.push()`方法就到此为止。

## router.replace——replace 式跳转

下面是`router.replace()`这个`api`和`router.push()`基本上一样，区别就在于切换浏览器`URL`时调用的`replaceState()`

```js
router.replace(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
        return new Promise((resolve, reject) => {
            this.history.replace(location, resolve, reject)
            })
    } else {
        this.history.replace(location, onComplete, onAbort)
    }
}
```

其中`history.replace()`如下：

```js
replace(location: RawLocation, onComplete ? : Function, onAbort ? : Function) {
    const {
        current: fromRoute
    } = this
    this.transitionTo(location, route => {
        replaceState(cleanPath(this.base + route.fullPath))
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
    }, onAbort)
}
```

而`replaceState()`其实就是对`pushState()`的封装调用，执行`replace`模式而已：

```js
function replaceState(url?: string) {
  // 调用pushState的replace模式的接口
  pushState(url, true);
}
```

那么`router.replace()`模式也到此为止。
