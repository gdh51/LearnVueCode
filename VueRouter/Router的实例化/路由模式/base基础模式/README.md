# 基础路由模式

无论是哪一种路由模式，都是继承的该路由模式，该模式用于记录当前当前位置的路由信息与将要调用的一些路由变化的函数：

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
        +go: (n: number) => void +
        push: (loc: RawLocation) => void +
        replace: (loc: RawLocation) => void +
        ensureURL: (push ? : boolean) => void +
        getCurrentLocation: () => string

    constructor(router: Router, base: ? string) {

        // 路由实例对象
        this.router = router

        // 标准化baseURL
        this.base = normalizeBase(base);

        // start with a route object that stands for "nowhere"
        // 在初始化时，添加一个表示没有任何路径的，当前路由位置信息对象
        this.current = START
        this.pending = null;
        this.ready = false;
        this.readyCbs = [];
        this.readyErrorCbs = [];
        this.errorCbs = [];
    }
}
```

上述中的`START`对象，记录的就是最初初始化时的路由位置信息对象，[具体查看](../../路由路径对象/README.md)，具体关于[`normalizeBase()`](./工具方法/REAMDE.md#normalizebase%e6%a0%bc%e5%bc%8f%e5%8c%96%e5%9f%ba%e7%a1%80%e8%b7%af%e7%94%b1%e8%b7%af%e5%be%84)则是用来初始化与格式化基础的`URL`。

可以看到，这个抽象类用于控制路由信息和逻辑，不直接提供具体的接口。这里对它的了解就告一段落。
