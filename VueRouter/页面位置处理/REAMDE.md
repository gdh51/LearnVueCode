# 页面位置(滚动条)的处理

对于页面位置(滚动条)的处理，`Vue-Router`并没有置之不理。它专门创建了一个对象用来存储当前`URL`下位置信息：

```js
const positionStore = Object.create(null);
```

该对象配合[`state-key`](../路由模式/history模式/存储的key值/REAMDE.md)(历史状态)来存储对应的`URL`下页面的位置信息。

对外，它提供了以下`API`：

## 对外模块接口

### saveScrollPosition()——保持当前页面的位置信息

只要我们在变更路由之前，调用该方法，就能保存上一个路由地址下页面的位置信息。

```js
function saveScrollPosition() {

    // 获取一个key值
    const key = getStateKey();

    // 将当前key值的位置的页面信息存入store中
    if (key) {
        positionStore[key] = {
            x: window.pageXOffset,
            y: window.pageYOffset
        }
    }
}
```
