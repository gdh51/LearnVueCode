# Router的实例化

在我们具体在`Vue`中使用`router`之前，我们需要对其实例化：

```js
const router = new VueRouter({

    // RouteRecord
    routes: [
        {
            path: '/',
            component: {}
        }
    ],

    // 一些其他的配置
    ...otherOptions
});
```

在这个实例化的过程中，其会做两件事：

1. 生成`RouteRecord`表
2. 决定和使用某个路由模式(`mode`)
   1. `Html5`模式
   2. `Hash`模式
   3. 抽象模式

那么我们先根据注释整体了解下`VueRouter`的构造函数：

```js
class VueRouter {
    static install: () => void;
    static version: string;

    app: any;
    apps: Array < any > ;
    ready: boolean;
    readyCbs: Array < Function > ;
    options: RouterOptions;

    // 路由模式
    mode: string;
    history: HashHistory | HTML5History | AbstractHistory;
    matcher: Matcher;
    fallback: boolean;
    beforeHooks: Array < ? NavigationGuard > ;
    resolveHooks: Array < ? NavigationGuard > ;
    afterHooks: Array < ? AfterNavigationHook > ;

    constructor(options: RouterOptions = {}) {

        // 当前挂载的根Vue实例
        this.app = null;

        // 路由作为挂载的根Vue实例数量
        this.apps = [];

        // 原始的路由配置
        this.options = options;

        // 全局路由前置守卫beforeEach
        this.beforeHooks = [];

        // 全局解析守卫beforeResolve
        this.resolveHooks = [];

        // 全局后置守卫afterEach
        this.afterHooks = [];

        // 根据路由配置创建3个不同类型的RouteRecordd
        this.matcher = createMatcher(options.routes || [], this);

        // 默认为hash模式
        let mode = options.mode || 'hash';

        // 是否在不兼容时自动降级
        // 判断变量为如果history模式，但不支持该API则且不主动关闭fallback模式
        this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false;
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
                this.history = new HTML5History(this, options.base);
                break
            case 'hash':
                this.history = new HashHistory(this, options.base, this.fallback);
                break
            case 'abstract':
                this.history = new AbstractHistory(this, options.base);
                break
            default:
                if (process.env.NODE_ENV !== 'production') {
                    assert(false, `invalid mode: ${mode}`)
                }
        }
    }
}
```

上述代码中，需要关注的有其中的`fallback`变量，该变量主要为了防止用户定义的路由`mode`在实际环境中无法使用，而是否进行降级兼容；当然，当用户制定不能降级时，也是不会降级的(头铁)。

```js
// 是否支持history API 的pushState()方法
const supportsPushState = inBrowser &&
    (function () {
        const ua = window.navigator.userAgent

        // 浏览器版本判断
        if (
            (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
            ua.indexOf('Mobile Safari') !== -1 &&
            ua.indexOf('Chrome') === -1 &&
            ua.indexOf('Windows Phone') === -1
        ) {
            return false;
        }

        // api支持程度判断
        return window.history && 'pushState' in window.history
    })();

this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false;

if (this.fallback) {

    // 兼容模式下使用hash路由
    mode = 'hash'
}
```

其次还需要关注的是：

```js
this.matcher = createMatcher(options.routes || [], this);
this.history = new HTML5History(this, options.base);
```

- [生成`RouteRecord`表](../../RouteRecord/README.md)
- [决定和使用某个路由模式](../../路由模式/README.md)(`mode`)
