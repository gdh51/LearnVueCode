# Router的实例方法

本文主要是对每个实例方法进行解读，请根据链接及时的进行跳转。

- [初始化函数-init](#初始化函数-init)

## 初始化函数-init

初始化`router`的实例分为两个步骤：

1. 管理挂在路由的`Vue`实例
2. 第一个`Route`的加载

首先简单浏览下整体的代码：

```js
init(app: any /* Vue component instance */ ) {

    // app为router挂载的根实例
    process.env.NODE_ENV !== 'production' && assert(
        install.installed,
        `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
        `before creating root instance.`
    );

    // 将所有挂载了router的根vm实例，添加进apps中
    this.apps.push(app);

    // set up app destroyed handler
    // https://github.com/vuejs/vue-router/issues/2639
    app.$once('hook:destroyed', () => {

        // clean out app from this.apps array once destroyed
        // 当该根vm实例销毁时，从apps中移除
        const index = this.apps.indexOf(app);
        if (index > -1) this.apps.splice(index, 1);

        // ensure we still have a main app or null if no apps
        // we do not release the router so it can be reused
        // 确保仍有一个主要的根vm实例或没有vm实例
        // 我们不会移除router，以保证它可以在今后被复用
        // 更新当前的app变量指向
        if (this.app === app) this.app = this.apps[0] || null;
    })

    // main app previously initialized
    // return as we don't need to set up new history listener
    // 如果之前存在初始化过的实例，那么我们就不必去重新添加history的监听器了
    if (this.app) {
        return
    }

    // 将当前的根vm实例挂载在app上
    this.app = app;

    // 获取路由模式对象
    const history = this.history

    // 在各种模式下，加载路由，更新Route
    if (history instanceof HTML5History) {
        history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {
        const setupHashListener = () => {
            history.setupListeners()
        }
        history.transitionTo(

            // 获取当前完整的路径(包括查询字符串等等)
            history.getCurrentLocation(),
            setupHashListener,
            setupHashListener
        )
    }

    // 存储一个更新根Route的函数(该函数在路由变更成功后调用)
    // 这里在最后在调用，原因是我们还未在根实例响应式定义_route，
    // 而在history.transitionTo完成时，会调用history.listen监听的函数
    history.listen(route => {

        // 为每个挂在router实例的根Vue实例更新当前的Route
        this.apps.forEach((app) => {
            app._route = route;
        });
    });
}
```

整个代码除了靠后面的部分外，其他的还是比较好理解，那么按顺序我们了解下。

### 管理挂在路由的`Vue`实例——app管理

`app`管理，即管理挂在路由的`Vue`实例。由于在某些情况下，我们可能会实例化多个根`Vue`实例，那么要保证这些新的`Vue`实例也能访问`router`实例，我们就需要在它们上面挂载`router`。由于全部`Vue`实例其实都存在于同一网页之中，所以对于每一个`Vue`实例，我们都共享同一个`Route`信息，所以全部根`Vue`都被管理在`router.apps`中：

```js
// app为router挂载的根实例
process.env.NODE_ENV !== 'production' && assert(
    install.installed,
    `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
    `before creating root instance.`
);

// 将所有挂载了router的根vm实例，添加进apps中
this.apps.push(app);

// set up app destroyed handler
// https://github.com/vuejs/vue-router/issues/2639
app.$once('hook:destroyed', () => {

    // clean out app from this.apps array once destroyed
    // 当该根vm实例销毁时，从apps中移除
    const index = this.apps.indexOf(app);
    if (index > -1) this.apps.splice(index, 1);

    // ensure we still have a main app or null if no apps
    // we do not release the router so it can be reused
    // 确保仍有一个主要的根vm实例或没有vm实例
    // 我们不会移除router，以保证它可以在今后被复用
    // 更新当前的app变量指向
    if (this.app === app) this.app = this.apps[0] || null;
})

// main app previously initialized
// return as we don't need to set up new history listener
// 如果之前存在初始化过的实例，那么我们就不必去重新添加history的监听器了
if (this.app) {
    return
}

// 将当前的根vm实例挂载在app上
this.app = app;
```

上面的逻辑主要是对`apps`的一个管理，非常好理解，那么对于全部`app`的`Route`的更新，其实是上述代码的最后一段：

```js
history.listen(route => {

    // 为每个挂在router实例的根Vue实例更新当前的Route
    this.apps.forEach((app) => {
        app._route = route;
    });
});
```

这里先给大家看一下，该段代码会在`Route`更新完毕后调用，但是在第一次`Route`加载(初始化)不会调用，等会我们会看看该函数具体的作用，但是在此之前，先看看第一个`Route`的切换。

### 第一个Route的加载

首先，所有`Route`的更新和加载都是通过`history.transitionTo()`方法进行的，从该方法开始，具体的加载过程都具有普遍适用性，除非其为某个`Class`的独特的接口。

```js
// 获取路由模式对象
const history = this.history

// 在各种模式下，加载路由，更新Route
if (history instanceof HTML5History) {
    history.transitionTo(history.getCurrentLocation())
} else if (history instanceof HashHistory) {
    const setupHashListener = () => {
        history.setupListeners()
    }
    history.transitionTo(

        // 获取当前完整的路径(包括查询字符串等等)
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
    )
}
```

按代码执行顺序，我们优先学习[`history.getCurrentLocation()`](../../../路由模式/base基础模式/实例方法/README.md#获取完整路径信息historygetcurrentlocation)的具体含义。由于不同路由模式下，路由路径所处于的`URL`位置是不一样的，所以该方法是其子类的一个独立接口，这里我们只学习`h5 history`模式下的该接口。

在学习完毕后，那么其通过[`history.transitionTo()`](../../../路由模式/base基础模式/实例方法/README.md)来进行一个`Route`加载的启动过渡，该方法实际也为`base history`的一个实例方法。
