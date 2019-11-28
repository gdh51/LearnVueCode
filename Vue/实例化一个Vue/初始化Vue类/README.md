# 初始化Vue类

在最初加载`Vue`类库时，会对`Vue`的构造函数进行一些初始化，向其填充一些方法与属性

## 初始化原型对象

在`Vue`构造函数最初初始化时，向其原型添加了以下函数：

- `__patch__`：给`dom`打补丁，用于更新`dom`
- `$mount`：生成`VNode`与`dom`元素

```js
// install platform patch function
// 初始化平台的补丁函数，用于更新dom
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function (
    el ? : string | Element,
    hydrating ? : boolean
): Component {

    // 获取挂载的DOM元素
    el = el && inBrowser ? query(el) : undefined;

    // 解析组件
    return mountComponent(this, el, hydrating)
}
```

## 初始化Global API

[初始化API](./初始化API/README.MD)
