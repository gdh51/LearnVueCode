# base基础路由模式

无论是哪一种路由模式，都是继承的该路由模式，该模式用于记录`Route`与一些用于监听`Route`变化的`hooks`，这些`hooks`主要是用于监听初始化`Route`和捕获错误。

现在让我们来看看这个构造函数：

```js
class History {
    router: Router
    base: string
    current: Route
    pending: ? Route
    cb: (r: Route) => void
    ready: boolean
    readyCbs: Array < Function >
        readyErrorCbs: Array < Function >
        errorCbs: Array < Function >

        // implemented by sub-classes
        // 子类接口
        +go: (n: number) => void +
        push: (loc: RawLocation) => void +
        replace: (loc: RawLocation) => void +
        ensureURL: (push ? : boolean) => void +
        getCurrentLocation: () => string

    constructor(router: Router, base: ? string) {

        // 路由实例对象
        this.router = router

        // 标准化基准path
        this.base = normalizeBase(base);

        // start with a route object that stands for "nowhere"
        // 在初始化时，添加一个表示没有任何路径的，当前路由路径记录对象
        this.current = START;

        // 更新Route时，等待更新Route存放的地方
        this.pending = null;

        // Route是否更新完毕
        this.ready = false;

        // onReady函数的success处理函数，在初始化时成功时调用
        this.readyCbs = [];

        // onReady函数的error处理函数，在初始化时出错时调用
        this.readyErrorCbs = [];

        // onError函数，在除第一次加载外触发错误时调用
        this.errorCbs = [];
    }
}
```

##　base路径——根路径

在我们整个路由中，可以定义一个根`path`，其他路径会基于该`path`来进行变化，这个比较好理解，比如我们某个网站的主站地址并不在`/`路径，而是在`/path`路径下，那么我们就必须要定义一个该变量。

在此处初始化`base`路径通过`normalizeBase(base)`，通过该方法我们不必将`base`直接定义在`router.options`上，也可以通过`html <base />`元素上，具体关于该方法请查看[`normalizeBase(base)`详解](./工具方法/REAMDE.md#normalizebase%e6%a0%bc%e5%bc%8f%e5%8c%96%e5%9f%ba%e7%a1%80%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%8)。

## this.current——当前Route

上述的代码中，我们还需要重点关注下`this.current`这个字段，其表示当前`URL`路径下对于的`Route`，它包含了当前路径下所有的信息，包括渲染的组件等等。

在本次初始化时，它会使用一个`START Route`作为初始化`Route`：

```js
this.current = START;
```
