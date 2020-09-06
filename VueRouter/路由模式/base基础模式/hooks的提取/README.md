# hooks的提取

关于`hooks`(路由守卫)的提取，一共分为两个阶段，它们的划分是按`Route`的提交时间确定的。

- [Route确认前的hooks](#route确认前的hooks)
- [Route确认后的hooks](#route确认后的hooks)

## Route确认前的hooks

确认前的`hooks`的提取主要是通过这三个函数：

- extractLeaveGuards()
- extractUpdateHooks()
- resolveAsyncComponents()

我们可以明显看出，第三个有明显却别于其他的两个。确实，它提取的不是`hooks`而是异步加载的组件，这个我们等会会提到，先浏览整个`hooks`队列。

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

### 提取组件内beforeRouteLeave函数

首先是对组件内`hook:beforeRouteLeave`的提取，调用的是`extractLeaveGuards`方法，目标对象是由于路由变更而不再使用的组件：

```js
extractLeaveGuards(deactivated)

// 提取beforeRouteLeave的函数，实际为对extractGuards接口的封装调用
function extractLeaveGuards(deactivated: Array < RouteRecord > ): Array < ? Function > {
    return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}
```

主要的绑定还是通过`extractGuards()`发生的：

```js
function extractGuards(

    // 路由记录对象的数组
    records: Array < RouteRecord > ,

    // 路由导航守卫名称
    name: string,

    // 为hooks绑定上下文
    bind: Function,

    // 是否反顺序出发hook函数，这里要对于组件的创建销毁顺序
    reverse ? : boolean
): Array < ? Function > {

    /**
     * @description 获取当前RouteRecord中名为name的导航守卫(从components中取)(不会递归子路由)
     * @param {Object} def 对应的组件配置对象
     * @param {Object} instance 对应组件的实例对象
     * @param {Object} matchc 此组件的RouteRecord
     * @param {String} key 命名视图下的对应组件名称(无命名视图时为default)
     */
    const guards = flatMapComponents(records, (def, instance, match, key) => {

        // 获取该组件中名为name的导航守卫
        const guard = extractGuard(def, name);

        // 如果存在，则依次返回这些导航守卫函数
        if (guard) {
            // 可以用数组命名多个导航守卫
            return Array.isArray(guard) ?

                // 将导航守卫的this绑定至组件，并传入当前RouteReord与组件视图名称key
                guard.map(guard => bind(guard, instance, match, key)) :
                bind(guard, instance, match, key)
        }
    });

    // 最后将守卫hook扁平化为扁平数组
    // (在leave类型的守卫触发时，要倒叙返回返回值， 即从父->子)
    return flatten(reverse ? guards.reverse() : guards)
}

```

从内部可以看到对于内部的路由守卫是通过`flatMapComponents()`提取的，该函数的含义其实就是对每个`RouteRecord`中的每一个组件调用传入的回调函数，注意传入回调函数的参数分别为`组件配置对象，或异步加载函数`、路由已生成的实例、组件所处于的`RouteRecord`、组件在`RouteRecord`中的命名：

```js

// 承接上面的函数中的flatMapComponents
function flatMapComponents(
    matched: Array < RouteRecord > ,
    fn: Function
): Array < ? Function > {

    // 对每个路由记录调用类似数组的forEach方法，分别传入组件配置、具体实例
    return flatten(matched.map(m => {

        // 遍历命名视图路由，对对应组件和实例调用fn回调,
        // 此处的fn实际为返回这些组件中名为key的导航守卫
        return Object.keys(m.components).map(key => fn(
            m.components[key],
            m.instances[key],
            m,
            key
        ))
    }))
}

// 扁平化一层arr数组
function flatten(arr: Array < any > ): Array < any > {
    return Array.prototype.concat.apply([], arr)
}
```

在该回调函数中，首先是对路由守卫的提取。提取的方式首先是创建构造函数，然后从其原始配置上提取：

```js
function extractGuard(
    def: Object | Function,
    key: string
): NavigationGuard | Array < NavigationGuard > {

    // 将组件配置对象注册为Vue实例构造函数
    if (typeof def !== 'function') {
        // extend now so that global mixins are applied.
        def = _Vue.extend(def)
    }

    // 取其原始配置中名为key的路由守卫
    return def.options[key];
}
```

拿到对于的路由守卫后，为其绑定当前的实例上下文：

```js
// 获取该组件中名为name的导航守卫
const guard = extractGuard(def, name);

// 如果存在，则依次返回这些导航守卫函数
if (guard) {

    // 可以用数组命名多个导航守卫
    return Array.isArray(guard) ?

        // 将导航守卫的this绑定至组件，并传入当前RouteReord与组件视图名称key
        guard.map(guard => bind(guard, instance, match, key)) :
        bind(guard, instance, match, key)
}

// 上面的bind就是下面的bindGuard
// 将路由守卫的this绑定至当前Vue实例(不存在时则直接不绑定)
function bindGuard(guard: NavigationGuard, instance: ? _Vue): ? NavigationGuard {
    if (instance) {
        return function boundRouteGuard() {
            return guard.apply(instance, arguments)
        }
    }
}
```

当然这些函数的调用是只开放给已经激活实例的组件的，从`bindGuard()`函数给出的限制也可以看出。

函数`beforeRouteLeave()`的最后返回时，是置换了顺序返回的，原本的顺序是`父->子`顺序，由于组件销毁时是子组件先于父组件销毁的，这里遵循`Vue`的生命周期，所以可以理解为什么要反序：

```js
return flatten(reverse ? guards.reverse() : guards)
```

### 全局的beforeEach

这个没什么好说的，直接拿来用就行了：

```js
this.router.beforeHooks
```

### 提取组件内beforeRouteUpdate函数

这个的提取流程和[提取beforeRouteLeave](#提取组件内beforerouteleave函数)一样，除了最后的返回的顺序不变为逆序外。

```js
extractUpdateHooks(updated);

function extractUpdateHooks(updated: Array < RouteRecord > ): Array < ? Function > {
    return extractGuards(updated, 'beforeRouteUpdate', bindGuard);
}
```

### 提取RouteRecord上的beforeEnter函数

>是不是有点整懵了，到处都有路由导航，哈哈。
`beforeEnter`当然是从即将要激活的组件上取：

```js
// 获取新增的RouteRecord中的beforeEnter函数
activated.map(m => m.beforeEnter)
```

`beforeEnter`为什么不直接放组件配置对象上，相信大家也能想明白了，因为异步加载的情况下，这玩意儿拿不到。

### 解析新进的异步组件

那么处理完所有的`Route`提交前路由守卫，那么就该加载我们的新组件了，下面的函数仅是帮助加载异步的组件，之外不做任何处理。

```js
resolveAsyncComponents(activated);

// 加载异步组件，从该函数我们可以看到异步组件是一个并行加载的流程
function resolveAsyncComponents(matched: Array < RouteRecord > ): Function {
    return (to, from, next) => {

        // 是否为异步组件(默认不是)
        let hasAsync = false;

        // 加载状态，0为完成，大于1表示在进行异步加载
        let pending = 0;
        let error = null;

        flatMapComponents(matched, (def, _, match, key) => {

            // if it's a function and doesn't have cid attached,
            // assume it's an async component resolve function.
            // 如果其为一个没有cid的函数(即未注册的组件)，则假设其为一个异步解析组件函数
            // we are not using Vue's default async resolving mechanism because
            // we want to halt the navigation until the incoming component has been
            // resolved.
            // 我们不使用Vue默认的异步解析机制，因为我们要在加载这个组件时中断路由的导航，
            // 待组件加载完毕后在继续路由导航的跳转
            if (typeof def === 'function' && def.cid === undefined) {
                hasAsync = true
                pending++

                const resolve = once(resolvedDef => {
                    if (isESModule(resolvedDef)) {
                        resolvedDef = resolvedDef.default
                    }

                    // save resolved on async factory in case it's used elsewhere
                    // 创建组件构造函数
                    def.resolved = typeof resolvedDef === 'function' ?
                        resolvedDef :
                        _Vue.extend(resolvedDef);

                    // 配置命名视图组件构造函数
                    match.components[key] = resolvedDef
                    pending--;

                    // 全部异步组件加载完毕时，进行下一个hook的调用
                    if (pending <= 0) {
                        next()
                    }
                })

                const reject = once(reason => {
                    const msg = `Failed to resolve async component ${key}: ${reason}`
                    process.env.NODE_ENV !== 'production' && warn(false, msg)
                    if (!error) {
                        error = isError(reason) ?
                            reason :
                            new Error(msg)
                        next(error)
                    }
                })

                let res
                try {

                    // 这里说明不仅仅可以通过import来导入组件，
                    // 我们也可以自定义导入行为，手动年来resolve组件的载入
                    res = def(resolve, reject)
                } catch (e) {
                    reject(e)
                }

                // 是否返回一个值，异步组件必须返回一个值这个值必须为Promise对象，
                // 或含有Promise对象
                if (res) {

                    // 当返回一个promise对象时，链式调用上面定义的resolve函数
                    if (typeof res.then === 'function') {
                        res.then(resolve, reject)
                    } else {
                        // new syntax in Vue 2.3
                        const comp = res.component
                        if (comp && typeof comp.then === 'function') {
                            comp.then(resolve, reject)
                        }
                    }
                }
            }
        })

        // 如果不存在仍和异步组件，则直接进行下一个hook
        if (!hasAsync) next()
    }
}
```

从上述代码可见这个函数的结果是返回一个函数，在返回的函数中，使用`flatMapComponents()`对当前的即将要新增的`RouteRecord`们进行一个回调函数的使用，这里的参数就不再解释了，上面有。回调函数如下：

```js
function once(fn) {
    let called = false
    return function (...args) {
        if (called) return
        called = true
        return fn.apply(this, args)
    }
}
let pending = 0;

(def, _, match, key) => {

    // if it's a function and doesn't have cid attached,
    // assume it's an async component resolve function.
    // 如果其为一个没有cid的函数(即未注册的组件)，则假设其为一个异步解析组件函数
    // we are not using Vue's default async resolving mechanism because
    // we want to halt the navigation until the incoming component has been
    // resolved.
    // 我们不使用Vue默认的异步解析机制，因为我们要在加载这个组件时中断路由的导航，
    // 待组件加载完毕后在继续路由导航的跳转
    if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        pending++

        const resolve = once(resolvedDef => {

            // import引入
            if (isESModule(resolvedDef)) {
                resolvedDef = resolvedDef.default
            }

            // save resolved on async factory in case it's used elsewhere
            // 创建组件构造函数
            def.resolved = typeof resolvedDef === 'function' ?
                resolvedDef :
                _Vue.extend(resolvedDef);

            // 配置命名视图组件构造函数
            match.components[key] = resolvedDef
            pending--;

            // 全部异步组件加载完毕时，进行下一个hook的调用
            if (pending <= 0) {
                next()
            }
        })

        const reject = once(reason => {
            const msg = `Failed to resolve async component ${key}: ${reason}`
            process.env.NODE_ENV !== 'production' && warn(false, msg)
            if (!error) {
                error = isError(reason) ?
                    reason :
                    new Error(msg)
                next(error)
            }
        })

        let res
        try {

            // 这里说明不仅仅可以通过import来导入组件，
            // 我们也可以自定义导入行为，手动年来resolve组件的载入
            res = def(resolve, reject)
        } catch (e) {
            reject(e)
        }

        // 是否返回一个值，异步组件必须返回一个值这个值必须为Promise对象，
        // 或含有Promise对象
        if (res) {

            // 当返回一个promise对象时，链式调用上面定义的resolve函数
            if (typeof res.then === 'function') {
                res.then(resolve, reject)
            } else {
                // new syntax in Vue 2.3
                const comp = res.component
                if (comp && typeof comp.then === 'function') {
                    comp.then(resolve, reject)
                }
            }
        }
    }
}
```

首先，我们可以从该回调函数外部，看到一个`pending`，该变量就记载着当前异步加载组件配置的**数量**。如果你直接非异步引入，那么当前组件直接跳过；但如果你是异步加载组件配置，那么在开始加载时，会使这个哨兵变量`pending += 1`，每当一个组件调用了传入的`resolve()`函数，那么就意味着一个异步组件配置已经加载完毕，那么会`pending -= 1`并，检查：

```js
// 全部异步组件加载完毕时，进行下一个hook的调用
if (pending <= 0) {
    next()
}
```

满足这个条件(全部组件配置对象加载完毕)，那么就会调用下一个`hooks`。反之，一旦有一个加载失败，那么就会结束异步组件的加载并报错。

#### 自主控制异步加载

除了官网提供给我们的加载方式之外，我们还可以自主来控制异步组件的加载，只要确保函数返回的为一个被`resolved`的`Promise`对象即可，且要`resolve`的参数要为组件的配置对象；当然你不想函数返回对象也行，但是你要调用函数传入的第一个参数，它相对于`resolve`函数，同时你还是需要传入组件配置对象作为这个函数的实参。

____
那么到目前为止，我们就拿到了全部`Route`确认前要调用的`hooks`了。让我们回到[调用它的阶段前](../实例方法/README.md#route确认前hooks的调用)。

## Route确认后的hooks
