# 响应式系统组件

在Vue3.0的响应式系统中呢，还是由2个组件来组成响应式系统，并且它们变为了函数，它们就是`convert()`与`effect()`，它们分别代表的是之前的`class Observer`与`class Watcher`，那么在之前的依赖项得利于`Map`现在变为了`Set`，它已经没有之前的职能，它的任务已经交给了`convert()`函数来接管。

那么我推荐的阅读顺序是：

- [effect响应式函数(观察者对象)](./effect响应式函数(观察者对象)/README.md)
- [dep依赖项](./dep依赖项/README.md)
- [convert数据响应化(Observer)](./convert数据响应化(Observer)/README.md)
