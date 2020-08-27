# 路由模式

按我们使用`Vue-router`的具体体验，我们能把路由模式分为两种：

- `hash`模式(默认)
- `h5 history`模式

两个模式的具体区别在于：

- 外观上的不同，`h5 history`模式下无`#`符号
- 直接重写`URL`时会`h5 history`模式下会重新发送请求
- `h5 history`模式需要后端进行额外的设置

>相对于`h5`模式，`hash`模式明显便利得多。

除此这两个，在非浏览器渲染时，`Vue`会使用一种`abstract`(抽象)模式。

- `abstract`模式

____
无一例外，它们都是继承于一个抽象类`History`(`base`)，该类只会操作路由跳转的共同行为，，具体到每种模式会进行区别于不同模式的相同操作。

- `base`基础路由
- `h5 history`模式
- `hash`模式

这里我们以最新的[`h5 history`模式](./history模式/REAMDE.md)来看整个流程，其余流程会在后续补充。

```js
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
            assert(false, `invalid mode: ${mode}`);
        }
}
```
