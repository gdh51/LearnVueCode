# 路由切换滚动条行为的处理

如果你使用过滚动条`scrollBehavior`这个属性，那么你应该知道，滚动条可以来做什么(保存跳转前的页面高度)，现在让我们来康康其原理。

## 位置信息的存放位置

首先页面高度位置信息存放在一个私有变量`positionStore`中：

```js
const positionStore = Object.create(null);
```

这里简单说下，以防在下面的内容中不知道它是一个什么。

## 滚动条行为安装

滚动条行为是否安装还是要看我们是否定义，最开始它会随着安装路由事件监听器时，一同确认安装:

```js
// 自定义的scrollBehavior函数
const expectScroll = router.options.scrollBehavior;

// 是否支持滚动条行为
const supportsScroll = supportsPushState && expectScroll;

// 支持时，安装滚动条行为监听函数
if (supportsScroll) {
    // 返回一个注销滚动条行为的函数
    this.listeners.push(setupScroll());
}
```

通过之前的学习，我们自带`this.listeners`中存放的是一个移除事件的回调函数，那么这里我们可以推测`setupScroll()`是返回的一个移除滚动条事件的函数。

那么该函数具体为：

```js
function setupScroll() {
    // Prevent browser scroll behavior on History popstate
    // 不实用浏览器自带的滚动条行为
    if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
    }
    // Fix for #1585 for Firefox
    // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
    // Fix for #2774 Support for apps loaded from Windows file shares not mapped to network drives: replaced location.origin with
    // window.location.protocol + '//' + window.location.host
    // location.host contains the port and location.hostname doesn't
    // 修bug，支持文件协议下的滚动条行为
    const protocolAndPath =
        window.location.protocol + "//" + window.location.host;
    const absolutePath = window.location.href.replace(protocolAndPath, "");

    // preserve existing history state as it could be overriden by the user
    // 保留当前已存在的state，确保其可以为用户修改
    const stateCopy = extend({}, window.history.state);

    // 生成本次跳转滚动条的唯一key值
    stateCopy.key = getStateKey();

    // 重写当前路径的state
    window.history.replaceState(stateCopy, "", absolutePath);

    // 安装保存滚动条高度的函数
    window.addEventListener("popstate", handlePopState);

    // 返回一个注销函数
    return () => {
        window.removeEventListener("popstate", handlePopState);
    };
}
```

首先从上面的代码中确定几个变量的含义：首先是每次保存的`state`对象中，每次`Vue-Router`只会向其写入一个`key`字段，该字段表示的是对上一次跳转前页面位置的信息对象的映射。`Vue-Router`在内部可以通过它来查到那一次跳转前页面所处于的高度。

**每次该`key`值会在跳转后生成准备好，并在页面跳转时将页面高度信息存入该`key`值，并生成新的`key`值预备下一次跳转，如此往复。**

在第一次初始化时，我们可以明显的看见这样的操作：

```js
const stateCopy = extend({}, window.history.state);

// 生成本次跳转滚动条的唯一key值
stateCopy.key = getStateKey();

// 重写当前路径的state
window.history.replaceState(stateCopy, "", absolutePath);
```

在之前，我们来康康这个`key`的[整体结构](./页面高度映射key/README.md)。

之后便监听`popstate`事件在路由变更时做出页面高度的处理：

```js
window.addEventListener("popstate", handlePopState);
```

## 路由变更的处理

首先，我们要知道路由变更有两种方式：

-   调用函数`api`
-   浏览器控件

所以对于路由变更的处理也要分为两种，首先是我们最常用的函数跳转：

### 函数 api 跳转

通过函数`api`进行跳转，对于页面高度的处理需要封装在具体的函数中，因为它不会触发`popstate`事件。在`html5`中，其逻辑被封装在`pushState()`中，会在调用`window.history.pushState()`前，先进行位置信息存储：

```js
function pushState(url?: string, replace?: boolean) {
    // 保持当前滚动条的位置
    saveScrollPosition();

    // ....其他逻辑，先不关注
}
```

那么`saveScrollPosition()`就是将当前的(跳转前)页面高度位置信息对象，存入到对于的`key`值中：

```js
function saveScrollPosition() {
    // 为当前的跳转路径生成唯一key值
    const key = getStateKey();

    // 记录当前页面滚动条唯一
    if (key) {
        positionStore[key] = {
            x: window.pageXOffset,
            y: window.pageYOffset,
        };
    }
}
```

在存储完上述信息之后，该生成新的`key`了，此时对`key`值的生成又分两种情况，其实对应`replace`和`push`的语义，先看一看：

```js
// 如果是直接替换当前URL
if (replace) {
    // preserve existing history state as it could be overriden by the user
    // 保留存在的历史记录状态，以便开发人员可以重写它
    const stateCopy = extend({}, history.state);

    // 获取当前的key值
    // 这里因为是replace，所以不会生成新的key，因为我们认为你只想重写当前url的信息
    stateCopy.key = getStateKey();

    // 将当前URL地址替换进去
    history.replaceState(stateCopy, "", url);

    // 如果当前是更新模式，则创建一个新的key
} else {
    history.pushState(
        {
            key: setStateKey(genStateKey()),
        },
        "",
        url
    );
}
```

可以从上面看到，对于`replace`其会复用之前的`key`，因为`replace`在某种意义上表示重写当前的`url`信息；而`push`则会新生成一个`key`值，这个`key`会作为下一次跳转前存储位置信息使用。

### 浏览器控件跳转

浏览器控件跳转就是通过`popstate`事件来完成，具体就是我们绑定的事件回调函数`handlePopState()`：

```js
// 每次出发pushState的时候，存储跳转前的滚动条位置
function handlePopState(e) {
    saveScrollPosition();
    if (e.state && e.state.key) {
        setStateKey(e.state.key);
    }
}
```

非常简单，先调用`saveScrollPosition()`存储之前位置信息，如何在设置新的`key`值，**注意**，这个`key`值来自于之前跳转过的`state`，对于某一次跳转时已生成的`key`值，这个应该可以理解，因为通过浏览器控件进行跳转的是我们**已经经过**的`url`。

## 还原某次页面高度

上面基本的信息已经提到了，但是唯独没可以跳转后的页面高度还原。其实这部分逻辑存在于具体
