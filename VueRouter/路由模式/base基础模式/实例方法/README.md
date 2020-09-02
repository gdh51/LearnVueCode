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

两个`Route`的对比是通过`isSameRoute()`来实现的
