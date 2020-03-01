# effect响应式函数(观察者对象)

在学习该`effect()`函数时，从字里行间看这个函数都透露出了两个字——就是！它就是之前`Watcher`，与之前不同的是，它现在不是为一个实例，而直接为一个求值函数。那么在介绍视频中我们知道了它的如下使用方法：

```js
// 将该函数转化为响应式，在count改变时触发该函数
effect(() => {
    this.count;
})
```

那么这是不是有点有`watch api`的那个味了。那么带着这个疑问我们去看函数

## 转化函数为观察者对象(Watcher)

在`Vue3.0`中，可以将任意函数转化为一个`Watcher`，转化后的函数被称为是具有`effect`(其他作用)的，也就是可以进行依赖收集。这个功能通过`effect()`函数来实现：

```js
// 空对象
const EMPTY_OBJ =  {};

// 将函数fn转化为受依赖项影响的函数，这里的effect对标以前的Watcher
function effect(fn, options = EMPTY_OBJ) {

    // 是否已为响应式的函数？
    if (isEffect(fn)) {

        // 取出原函数
        fn = fn.raw;
    }

    // 为函数创建响应式影响，在其依赖项更新时触发
    const effect = createReactiveEffect(fn, options);

    // 如果不为lazy，那么先调用一次
    if (!options.lazy) {
        effect();
    }

    return effect;
}
```

那么从上面的函数我们可以看到，作用函数的声明主要是通过内部的`createReactiveEffect()`来实现，并且在声明后会立即调用一次收集依赖项。从上面的代码我们也可以推断，原函数应该被存在在了`effect.raw`位置，那么继续带着疑问我们查看`createReactiveEffect()`函数：

```js
function createReactiveEffect(fn, options) {

    // 返回一个响应式函数
    const effect = function reactiveEffect(...args) {
        return run(effect, fn, args);
    };

    // 修改其响应式状态
    effect._isEffect = true;

    // 激活该观察者
    effect.active = true;

    // 存储原函数
    effect.raw = fn;

    // 收集依赖项
    effect.deps = [];
    effect.options = options;
    return effect;
}
```

这里我们就可以具体的看到虽然以前的`class Wathcer`被`effect()`函数替代，但大体的逻辑是一样的，具体被作用化的函数就是`reactiveEffect()`，它作为调用`run()`函数的封装，所以我们继续来查看`run()`函数，这里我们又开始进行猜测，应该是对原函数进行运行并求值：

```js
/**
 *
 * @param {Function} effect 响应式函数
 * @param {Function} fn 原注册响应式函数的函数
 * @param {any} args 每次激活响应式函数时传入的参数
 */
function run(effect, fn, args) {

    // 如果该观察者对象已经注销，那么直接调用原函数
    if (!effect.active) {
        return fn(...args);
    }

    // 如果当前的effect栈中不存在该effect函数
    if (!effectStack.includes(effect)) {

        // 清空当前effect函数与所有依赖项的关联
        cleanup(effect);
        try {

            // 首先允许收集依赖项
            enableTracking();

            // 将当前收集依赖项的目标设置为当前effect
            effectStack.push(effect);
            activeEffect = effect;

            // 调用该函数并收集依赖项
            return fn(...args);
        } finally {

            // 移除该依赖项，与允许收集依赖项的状态，还原栈的状态
            effectStack.pop();
            resetTracking();
            activeEffect = effectStack[effectStack.length - 1];
        }
    }
}
```