# Vue-Router源码学习

众所周知，`Vue-Router`库有两种模式，并基于两个组件（`router-link`/`router-view`）组成的，那么话不多说，先走起，那么首先和`Vuex`一样，`VueRouter`是根据`install`函数进行安装的。如果我们直接引入那么其会直接帮我们进行安装(通过模块引入则需要手动安装)。

`Vue-Router`的整体由两部分控制，它会有一个随时记录当前路由情况的`current`对象，这里我们暂时称它为当前路由记录。

现在我们首先从它的实例化代码开始：

```js
class VueRouter {
    constructor(options: RouterOptions = {}) {

        // 当前挂载的根Vue实例
        this.app = null;

        // 路由作为挂载的根Vue实例数量
        this.apps = [];

        // 原始的路由配置
        this.options = options;

        // 全局路由前置守卫
        this.beforeHooks = [];

        // 全局解析守卫
        this.resolveHooks = [];

        // 全局后置守卫
        this.afterHooks = [];

        // 根据路由配置创建3个不同类型的路由表
        this.matcher = createMatcher(options.routes || [], this)

        // 默认为hash模式
        let mode = options.mode || 'hash';

        // 是否在不兼容时自动降级
        // 判断变量为如果history模式，但不支持该API则且不主动关闭fallback模式
        this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
        if (this.fallback) {

            // 兼容模式下使用hash路由
            mode = 'hash'
        }

        // 非浏览器中时，取抽象模式
        if (!inBrowser) {
            mode = 'abstract'
        }

        this.mode = mode;

        // 根据模式初始化对应的路由模式
        switch (mode) {
            case 'history':
                this.history = new HTML5History(this, options.base)
                break
            case 'hash':
                this.history = new HashHistory(this, options.base, this.fallback)
                break
            case 'abstract':
                this.history = new AbstractHistory(this, options.base)
                break
            default:
                if (process.env.NODE_ENV !== 'production') {
                    assert(false, `invalid mode: ${mode}`)
                }
        }
    }
}
```

初始化`VueRouter`的逻辑比较简单，可以简单概括为两个主要部分：

1. [初始化路由表](./路由表/README.md)(即我们定义的`routes`)
2. [初始化路由模式](./路由模式/README.md)(两种模式`history`与`hash`)

我们将在详细的章节中进行详细的学习。
