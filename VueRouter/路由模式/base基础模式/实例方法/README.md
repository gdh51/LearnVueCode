# Base路由模式的实例方法

以下为`Base`模式下的实例方法，所有的路由的大多数方法都是基于`Base`模式的实例方法进行构建的：

- [Route过渡切换——history.transitionTo()](#route过渡切换historytransitionto)
- [提交Route进行切换——history.confirmTransition()](#提交route进行切换historyconfirmtransition)

## Route过渡切换——history.transitionTo()

该方法用于通过提交当前`URL`的路径信息，来加载新的`Route`，并更新组件等等。整个方法由两部分组成：

1. 新的`Route`的生成
2. 新的`Route`的提交与更新

惯例，先浏览一下代码：

```js
history.transitionTo(

    // 未处理的当前位置信息(比如路径字符串)
    location: RawLocation,

    // 路由切换完成时调用的函数
    onComplete ? : Function,

    // 路由切换中断时调用的函数
    onAbort ? : Function
) {

    // 获取匹配当前位置信息对象location而产生的新的Route
    const route = this.router.match(location, this.current);

    // 提交路由Route更新
    this.confirmTransition(
        route,
        () => {

            // 更新当前的Route
            this.updateRoute(route);

            // 初始化时该函数为空
            onComplete && onComplete(route);

            // 进行URL的跳转
            this.ensureURL();

            // fire ready cbs once
            // 调用初始化onReady函数(仅调用一次)
            if (!this.ready) {
                this.ready = true
                this.readyCbs.forEach(cb => {
                    cb(route)
                })
            }
        },
        err => {
            if (onAbort) {
                onAbort(err)
            }
            if (err && !this.ready) {
                this.ready = true
                this.readyErrorCbs.forEach(cb => {
                    cb(err)
                })
            }
        }
    )
}
```

### 新的`Route`的生成

新的`Route`是通过在解析`URL`路径得到`Location`并得到对于匹配到的`RouteRecord`，最终来生成新的`Route`：

```js
// 获取匹配当前位置信息对象location而产生的新的Route
const route = this.router.match(location, this.current);
```

该方法调用的是`router`的实例方法`match()`，还记得我们生成`RouteRecords`表时的方法吗，这些并没有暴露出来，而是返回了两个接口`match()/addRoute()`，`router`就是帮我调用了这两个接口：

```js
router.match(
    // 未处理的路径信息对象
    raw: RawLocation,
    current ? : Route,
    redirectedFrom ? : Location
): Route {

    // 调用RouteRecord路由表内部接口查找匹配的路由路径
    return this.matcher.match(raw, current, redirectedFrom)
}
```

那么让我们先具体来看看这个[`matcher.match()`](../../../RouteRecord/两个接口/README.md)方法

## 提交Route进行切换——history.confirmTransition()

取得了即将要跳转的`Route`后，我们就可以正式提交这份`Route`，进行路由跳转了。但是具体是否跳转，还得取决于我们定义的各种`hooks`是否允许。

在看`history.confirmTransition()`的调用信息前，我们先来康康这个函数构造：

```js
// 提交路由更新
confirmTransition(route: Route, onComplete: Function, onAbort ? : Function) {

    // 保存跳转前Route
    const current = this.current;

    // 定义中断函数，错误回调仅在主动调用push/replace时触发
    const abort = err => {

        // after merging https://github.com/vuejs/vue-router/pull/2771 we
        // When the user navigates through history through back/forward buttons
        // we do not want to throw the error. We only throw it if directly calling
        // push/replace. That's why it's not included in isError
        // 我们仅在用户直接通过History API调用push/replace时报错
        // 确保错误类型不为内部错误，为其他Error类的错误
        if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {

            // 调用onError回调
            if (this.errorCbs.length) {
                this.errorCbs.forEach(cb => {
                    cb(err)
                })
            } else {

                // 未捕获时报错
                warn(false, 'uncaught error during route navigation:')
                console.error(err)
            }
        }

        // 直接调用最终的终止函数
        onAbort && onAbort(err)
    }

    // 跳转前后的路径信息对象是否相同？(即转化为URL后全等)
    if (
        isSameRoute(route, current) &&

        // in the case the route map has been dynamically appended to
        // 如果匹配的组件也相同，那么说明route是动态添加的
        route.matched.length === current.matched.length
    ) {

        // 根据当前URL情况看是否加载URL
        this.ensureURL();
        return abort(new NavigationDuplicated(route))
    }

    // 根据当前Route与之前的Route，计算出要销毁的组件与新创建的组件
    const {
        updated,
        deactivated,
        activated
    } = resolveQueue(
        this.current.matched,
        route.matched
    );

    // 在路由跳转前处理要调用的Hooks们，将它们统一添加到queue队列中
    // 添加更新顺序的队列，按不活跃函数的路由守卫-> 触发 beforeEach钩子 -> 触发update函数 ->
    // 触发活跃组件的beforeEnter -> 触发异步组件的
    const queue: Array < ? NavigationGuard > = [].concat(

        // in-component leave guards
        // 获取要离开的路由组件的beforeRouteLeave函数（父->子顺序）
        extractLeaveGuards(deactivated),

        // global before hooks
        // 获取全局的beforeEach导航守卫
        this.router.beforeHooks,

        // in-component update hooks
        // 获取未变更组件的beforeRouteUpdate函数(子->父)
        extractUpdateHooks(updated),

        // in-config enter guards
        // 获取新增的RouteRecord中的beforeEnter函数
        activated.map(m => m.beforeEnter),

        // async components
        // 获取加载异步路由(或普通路由的函数)
        resolveAsyncComponents(activated)
    );

    // 将当前(将要跳转的)Route设置为等待处理
    this.pending = route;

    // 重写hook函数，允许用户中断路由变更
    const iterator = (hook: NavigationGuard, next) => {

        // 如果又切换了路由则直接终止
        if (this.pending !== route) {
            return abort()
        }
        try {

            // 为每个hook分别传入to和from路由信息，以及一个next函数
            hook(route, current, (to: any) => {

                // 如果传入false则停止路由跳转，并跳转至上一个URL
                if (to === false || isError(to)) {

                    // next(false) -> abort navigation, ensure current URL
                    this.ensureURL(true);
                    abort(to);

                // 重定向到其他URL
                } else if (
                    typeof to === 'string' ||
                    (typeof to === 'object' &&
                        (typeof to.path === 'string' || typeof to.name === 'string'))
                ) {
                    // next('/') or next({ path: '/' }) -> redirect
                    abort()
                    if (typeof to === 'object' && to.replace) {
                        this.replace(to)
                    } else {
                        this.push(to)
                    }
                } else {

                    // confirm transition and pass on the value
                    // 无内鬼，继续执行下一个路由守卫
                    next(to)
                }
            })
        } catch (e) {
                abort(e)
        }
    }

    // 执行第一个批queue，执行完毕后调用下面的回调
    runQueue(queue, iterator, () => {

        // 后进回调函数，待路由提交，组件实例创建后调用
        const postEnterCbs = [];

        // 检测当前Route是否变更为即将跳转的路由
        const isValid = () => this.current === route

        // wait until async components are resolved before
        // extracting in-component enter guards
        // 等待异步组件加载完毕，再将beforeRouteEnter和beforeResolve
        // 作为hooks加入一个单独的执行队列中
        const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
        const queue = enterGuards.concat(this.router.resolveHooks);

        // 执行beforeRouteEnter和beforeResolve的hooks
        runQueue(queue, iterator, () => {

            // 如果目标路由发现变化，则终止
            if (this.pending !== route) {
                return abort()
            }

            // 加载完毕，清空加载中的路由·
            this.pending = null
            onComplete(route);

            // 在新的组件实例更新完毕后，调用beforeRouteEnter函数中传入next中的函数
            if (this.router.app) {
                this.router.app.$nextTick(() => {
                    postEnterCbs.forEach(cb => {
                        cb()
                    })
                })
            }
        })
    })
}
```

总结：太长了，不是人看的。

好的言归正传，其实该方法按流程大致可以分为：

1. 确认是否需要进行新的`Route`加载(对比旧的)
2. 提取`Route`正式确认前的`hooks`，依次调度这些`hooks`
3. 提取`Route`确认后的`hooks`并调度

那么就按这些流程进行学习：

### 确认是否需要进行新的`Route`加载

并非生成了新的`Route`就会进行路由`Route`的更新，首先我们要确定跳转前的`Route`和即将跳转的`Route`，只要它们转化的完整`URL`(包括`hash/query`)，存在丝毫的不同，那么我们就认为其为一个不同的`Route`。

```js
// 跳转前后的路径信息对象是否相同？(即转化为URL后全等)
if (
    isSameRoute(route, current) &&

    // in the case the route map has been dynamically appended to
    // 防止动态的添加RouteRecord
    route.matched.length === current.matched.length
) {

    // 根据当前URL情况看是否加载URL
    this.ensureURL();
    return abort(new NavigationDuplicated(route))
}
```

两个`Route`的对比是通过[`isSameRoute()`](../工具方法/REAMDE.md#两个route是否完全相同issameroute)来实现的，具体请点击链接查看。

除此之外，还要保证在这前后，该`Route`下的`RouteRecord`未变更，如果变更了，就说明当前路由的组件等信息又更新了。

#### Route无变化

当上面的条件满足时，就表示完整的`URL`路径无变化，此时还会通过[`.ensureURL()`](../../history模式/实例方法/README.md#切换浏览器urlhistoryensureurl)方法进行二次`URL`路径确认，如果没有变更则不做任何处理；变更了则调用`h5 api`进行浏览器`URL`切换。

当然这里就不会做任何处理，最后调用`confirmTransition()`闭包内的`abort()`方法停止新`Route`的提交。

### 提取Route正式确认前的hooks并调度

首先，其对比出前后`Route`中匹配的`RouteRecord`的差值，对比出那些即将移除和新增的`RouteRecord`，计算出它们其中的组件，哪些需要新加载，哪些需要销毁，哪些需要更新：

```js
// 根据当前Route与之前的Route，计算出要销毁的组件与新创建的组件
const {
    updated,
    deactivated,
    activated
} = resolveQueue(
    this.current.matched,
    route.matched
);
```

其中`resolveQueue()`方法，就是不断的对比两者。由于我们知道`Route`中`RouteRecord`的顺序是从父到子的，那么从父组件开始对比，只要同一位置的两者有差异，则说明从当前位置开始的`RouteRecord`发生了变化。此时，取旧`Route`后的`RouteRecord`，它们需要销毁；新`Route`后的`RouteRecord`，它们需要新生实例；而之前的只需要更新即可：

>这里为什么从父组件开始等位对比就可以得出，原因是因为`RouteRecord`是一个树状结构(对于渲染`router-view`组件)，尽早的从对比树根就能知道下分支的变化。

```js
// 计算上一个Route与下一个Route产生的变化组件
function resolveQueue(
    current: Array < RouteRecord > ,
    next: Array < RouteRecord >
): {
    updated: Array < RouteRecord > ,
    activated: Array < RouteRecord > ,
    deactivated: Array < RouteRecord >
} {
    let i;

    // 取两者中组件数量最多的进行遍历
    const max = Math.max(current.length, next.length);

    // 从父级组件开始，依次对比，当发现第一个不同的组件时，
    // 则说明从当前组件开始，组件发生了更新
    for (i = 0; i < max; i++) {
        if (current[i] !== next[i]) {
            break
        }
    }
    return {

        // 未变动的组件，但是需要提醒更新的组件
        updated: next.slice(0, i),

        // 新激活的组件
        activated: next.slice(i),

        // 失活的组件
        deactivated: current.slice(i)
    }
}
```

之后就是提取这些`RouteRecords`的路由守卫：

```js
const queue: Array < ? NavigationGuard > = [].concat(

    // in-component leave guards
    // 获取要离开的路由组件的beforeRouteLeave函数（父->子顺序）
    extractLeaveGuards(deactivated),

    // global before hooks
    // 获取全局的beforeEach导航守卫
    this.router.beforeHooks,

    // in-component update hooks
    // 获取未变更组件的beforeRouteUpdate函数(子->父)
    extractUpdateHooks(updated),

    // in-config enter guards
    // 获取新增的RouteRecord中的beforeEnter函数
    activated.map(m => m.beforeEnter),

    // async components
    // 获取加载异步路由(或普通路由的函数)
    resolveAsyncComponents(activated)
);
```

当前提取的路由守卫只为路由确认前的，它们会在`Route`进行确认时，按序调用，具体每个函数的提取在这里[查看](../hooks的提取/README.md)。

#### Route确认前hooks的调用——阶段1

那么随机就是调用刚刚获取的全部`hooks`，通过`runQueue()`这个函数：

```js
// 将当前(将要跳转的)Route设置为等待处理
this.pending = route;

runQueue(queue, iterator, () => {

    // 后进回调函数，待路由提交，组件实例创建后调用
    const postEnterCbs = [];

    // 检测当前Route是否变更为即将跳转的路由
    const isValid = () => this.current === route

    // wait until async components are resolved before
    // extracting in-component enter guards
    // 等待异步组件加载完毕，再将beforeRouteEnter和beforeResolve
    // 作为hooks加入一个单独的执行队列中
    const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
    const queue = enterGuards.concat(this.router.resolveHooks);

    // Route正式确定要更新后的hooks触发
    runQueue(...)
})
```

该函数接受三个参数，**第一个为要调用的队列，第二个为每次调用时执行的函数，第三个为全部执行完毕后执行的成功回调**。该方法主要是确保异步执行的顺序：

```js
function runQueue(queue: Array < ? NavigationGuard > , fn : Function, cb: Function) {
    const step = index => {

        // 当下标超过或等于队列时，则说明更新完毕，调用回调函数
        if (index >= queue.length) {
            cb();

        // 未执行完毕时，则依次调用
        } else {
            if (queue[index]) {
                fn(queue[index], () => {
                    step(index + 1)
                });

            // 不存在时跳过
            } else {
                step(index + 1)
            }
        }
    }
    step(0)
}
```

对该函数解构，可以看出该函数的运行逻辑：

1. 定义一个`step()`函数，该函数会在`i`未超过队列长度时，反复执行。
2. 执行全局的迭代函数，传入当前下标`i`的队列中的`hooks`与`step()`函数，必须要迭代器在合适的时机调用`step()`函数菜会继续向下执行。
3. 重复`2`过程，知道`i`超过或等于队列长度，此时执行`4`。
4. 调用传入的完成回调`cb()`。

那么根据以上逻辑，就是一个反复执行`iterator()`函数的过程，该函数主要是重写了`hook`函数，来统一处理`hooks`们的行为，因为我们可以在这些路由守卫的执行过程中随时重定向，会终止路由的继续跳转等等：

```js
// 重写hook函数，允许用户中断路由变更
const iterator = (hook: NavigationGuard, next) => {

    // 如果又切换了路由则直接终止
    if (this.pending !== route) {
        return abort()
    }
    try {

        // 为每个hook分别传入to和from路由信息，以及一个next函数
        hook(route, current, (to: any) => {

            // 如果传入false则停止路由跳转，并跳转至上一个URL
            if (to === false || isError(to)) {

                // next(false) -> abort navigation, ensure current URL
                this.ensureURL(true);
                abort(to);

            // 重定向到其他URL
            } else if (
                typeof to === 'string' ||
                (typeof to === 'object' &&
                    (typeof to.path === 'string' || typeof to.name === 'string'))
            ) {
                // next('/') or next({ path: '/' }) -> redirect
                abort()
                if (typeof to === 'object' && to.replace) {
                    this.replace(to)
                } else {
                    this.push(to)
                }
            } else {

                // confirm transition and pass on the value
                // 无内鬼，继续执行下一个路由守卫
                next(to)
            }
        })
    } catch (e) {
        abort(e)
    }
}
```

该函数较为简单，就不细致讲解了，看注释就`OK`。具体就像`VueRouter`文档说的那样：

- 返回`false`或一个错误类型就终止跳转
- 返回`Raw Location`对象就重新进行`Route`切换
- 什么都没返回，那么默认是同意继续跳转

#### Route确认前，激活组件的hooks提取——阶段2

如果一阶段的`hooks`顺利提取与调用进行，那么我们就会顺利执行其成功的回调函数，此时我们准备执行新激活组件的`beforeRouteEnter()`函数和全局的`beforeResolve()`函数：

```js
() => {

    // 后进回调函数，待路由提交，组件实例创建后调用
    const postEnterCbs = [];

    // 检测当前Route是否变更为即将跳转的路由
    const isValid = () => this.current === route

    // wait until async components are resolved before
    // extracting in-component enter guards
    // 等异步组件加载完毕后，才能处理这些组件内的hook
    const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
    const queue = enterGuards.concat(this.router.resolveHooks);

    // 执行beforeRouteEnter和beforeResolve的hooks
    runQueue(queue, iterator, () => {

        // 如果目标路由发现变化，则终止
        if (this.pending !== route) {
            return abort()
        }

        // 加载完毕，清空加载中的路由·
        this.pending = null
        onComplete(route);

        // 在新的组件实例更新完毕后，调用beforeRouteEnter函数中传入next中的函数
        if (this.router.app) {
            this.router.app.$nextTick(() => {
                postEnterCbs.forEach(cb => {
                    cb()
                })
            })
        }
    })
}
```

具体两个`hooks`的提取流程，还是请[自行查看](../hooks的提取/README.md#route确认后的hooks)。

### Route正式确认，更新全局Route

那么就向之前的`hooks`调用一样，通过`runQueue()`来进行，这里就不用多说了。我们就直接来到执行最终的成功回调函数：

```js
() => {

    // 如果目标路由发现变化，则终止
    if (this.pending !== route) {
        return abort()
    }

    // 加载完毕，清空加载中的路由·
    this.pending = null
    onComplete(route);

    // 在新的组件实例更新完毕后，调用beforeRouteEnter函数中传入next中的函数
    if (this.router.app) {
        this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => {
                cb()
            })
        })
    }
}
```

其中`pending`中存储的是即将跳转的`Route`，那么一切完毕，就调用`history.confirmTransition()`的成功回调，则即`history.transitionTo()`中传入的函数：

```js
() => {

    // 更新当前的Route
    this.updateRoute(route);

    // 初始化时该函数为空
    onComplete && onComplete(route);

    // 进行URL的跳转
    this.ensureURL();

    // fire ready cbs once
    // 调用初始化onReady函数(仅调用一次)
    if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => {
            cb(route)
        })
    }
}
```

那么首先是调用[`history.updateRoute()`](#更新route调用aftereach-hookhistoryupdateroute)函数更新`router.current`上的`Route`为最新的，如何调用`afterEach()`函数。

之后是执行`onComplete && onComplete(route);`函数，在`h5`模式的初始化中，该函数为`undefined`。

此时调用[`this.ensureURL()`](../../history模式/实例方法/README.md#切换浏览器urlhistoryensureurl)，调用对应模式下的路由切换`api`，正式提交`URL`到浏览器。此时在调用一次性的`onReady`函数。

最后的最后，还记得我们之前的`postEnterCbs`数组吗，在挂在`router`的根`Vue`实例的加载完毕后，就逐一调用这些函数，此时你就理解为什么我们能访问到其上下文`Vue`实例了。

```js
// 在新的组件实例更新完毕后，调用beforeRouteEnter函数中传入next中的函数
if (this.router.app) {
    this.router.app.$nextTick(() => {
        postEnterCbs.forEach(cb => {
            cb()
        })
    })
}
```

现在让我们再次回调[`router.init()`的最后阶段](../../../初次页面加载/Router的实例化/Router实例方法/README.md#route确定完毕添加vue实例更新route函数)。

## 更新Route，调用afterEach hook——history.updateRoute

该函数的作用就和名字一样，更新`router`实例上的`Route`，更新全部`Vue`根实例上的`Route($route)`和调用`afterEach()`函数。

```js
history.updateRoute(route: Route) {

    // 暂存变更URL前Route
    const prev = this.current

    // 更新变更后Route
    this.current = route;

    // 执行History实例监听的函数，为每个挂在router的实例更新Route
    this.cb && this.cb(route);

    // 调用全局的afterEach函数
    this.router.afterHooks.forEach(hook => {

        // 传入新、旧Route作为参数
        hook && hook(route, prev)
    })
}
```

注意，这里的`this.cb && this.cb(route);`。在第一次调用时，是不存在`this.cb`的，那么`this.cb`从哪里来呢？还记得最开始的`router.init()`方法中的以下代码吗？

```js
history.listen(route => {

    // 为每个挂在router实例的根Vue实例更新当前的Route
    this.apps.forEach((app) => {
        app._route = route;
    });
});
```

该方法实际为[将传入的回调函数作为`this.cb`](#route确认成功时的回调函数historylisten)，但是该方法是在第一次`history.transitionTo()`结束后调用的，所以说，在初始化`START Route`时，是不会调用的，仅在之后调用。

该监听函数就是为每个`Vue`根实例上的`Route($route)`更新。

## Route确认成功时的回调函数——history.listen

```js
history.listen(cb: Function) {
    this.cb = cb
}
```