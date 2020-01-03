# Vue的刷新队列

## queueWatch()

在依赖项变更后具体到`watcher`的**更新前**`Vue`通过该函数来将这些**将要更新的`watcher`放置到一个`queue`队列中**并按其`id`进行从小到大的排序按其生成顺序来进行更新。

>在该函数的一开始调用中，我们先不需要关注其`else`部分(`flushing = true`状态时)，等会会做解释。

在该函数的第一次执行时，会调用一次`nextTick(flushSchedulerQueue)`函数，之后该函数的任务便结束了。

```js
// 待更新的watcher队列
const queue = [];

// 同一时间中，已加入过但未刷新的watcher的id队列
let has = {};

// 一个状态：会在本次队列刷新完成后变为false
let waiting = false;

// 一个状态：表示是否正处于刷新队列进行时
let flushing = false;

// 当前队列中进行刷新的watcher的下标
let index = 0;

function queueWatcher(watcher: Watcher) {
    const id = watcher.id;

    // 一个watcher只推入队列一次，只更新其最后的结果
    if (has[id] == null) {
        has[id] = true;

        // 未对队列进行刷新时，直接将watcher加入队列中
        if (!flushing) {
            queue.push(watcher);
        } else {

            // if already flushing, splice the watcher based on its id
            // if already past its id, it will be run next immediately.
            // 当正在刷新队列时，又触发了新的watcher加入队列时，将它加入在对应顺序的watcher后面
            let i = queue.length - 1;
            while (i > index && queue[i].id > watcher.id) {
                i--;
            }
            queue.splice(i + 1, 0, watcher);
        }

        // queue the flush
        // 在下一次event loop时进行队列刷新
        if (!waiting) {
            waiting = true;

            if (process.env.NODE_ENV !== 'production' && !config.async) {
                flushSchedulerQueue();
                return;
            }

            // 调用该函数进行队列刷新
            nextTick(flushSchedulerQueue);
        }
    }
}
```

>上面的`nextTick()`之所以在一开始就调用，是因为其模拟了异步任务(微任务或宏任务)，所以其传入的回调函数在当前`eventloop`是不会调用的。

待第一轮的`watcher`全部添加后，就会通过`nextTick()`在下一轮微任务(或宏任务)时调用`flushSchedulerQueue()`函数，来更新队列中的`watcher`

先看一下`nextTick()`函数的代码：

## nextTick()

```js
const callbacks = [];
let pending = false;

function nextTick(cb?: Function, ctx?: Object) {
    let _resolve;

    // 将下一轮渲染要执行的回调函数加入队列。
    callbacks.push(() => {
        if (cb) {
            try {
                cb.call(ctx);
            } catch (e) {
                handleError(e, ctx, 'nextTick');
            }
        } else if (_resolve) {
            _resolve(ctx);
        }
    });

    // 启用一个event loop的任务来进行视图更新
    if (!pending) {
        pending = true;
        timerFunc();
    }

    // 未传入回调函数时，返回一个空promise，并会在微任务执行时进行resolve
    if (!cb && typeof Promise !== 'undefined') {
        return new Promise(resolve => {
            _resolve = resolve;
        });
    }
}
```

这里我们可以看出`nextTick()`函数干了两件事：

1. 依次存储本轮`eventLoop`中全部`nextTick()`传入的的回调函数
2. 调用一次`timerFunc()`来在下一次`eventloop`时依次执行这些回调
3. 未传入回调函数的时候，在下一轮`eventloop`时返回一个`fullfilled`状态的`Promise`对象

>在更新时，我们通过`timerFunc()`函数来模拟微任务(或宏任务), 然后在这一轮`eventLoop`的最后(或下一轮`eventLoop`)来调用`flushSchedulerQueue()`函数

[Vue异步更新的模拟——timerFunc()](./Vue异步更新的模拟)

在该函数中也即微任务阶段或下一个宏任务阶段便会执行`flushCallbacks()`, `flushCallbacks()`函数中便取出之前通过`nextTick()`函数存入的回调函数来依次执行：

```js

// 在微任务阶段或下一个宏任务阶段执行nextTick中所有的回调即我们刚刚存入callbacks队列中的函数
function flushCallbacks() {
    pending = false;
    const copies = callbacks.slice(0);
    callbacks.length = 0;
    for (let i = 0; i < copies.length; i++) {
        copies[i]();
    }
}
```

最后来看一下，`Vue`是如何更新`watcher`队列的，当依赖项更新调用`nextTick()`函数时，第一个存入的回调函数的是`flushSchedulerQueue()`, 所以此时微任务阶段第一调用的必然是它，那么总结下它干了什么：

1. 排序`queue`中的`watcher`按`id`，保证组件更新按父——>子的顺序

2. 更新`queue`队列中的`watcher`，直到队列中最后一个：
   1. 渲染`watcher`时，先触发其`beforeUpdate`函数
   2. 调用`watcher.run()`对`watcher`重新求值与依赖项收集
      + 如果这个过程中又有新的依赖项变动，则重复依赖项更新流程，不同的是`queueWatcher()`中分支进入的选择不同[等会具体说明下](#%e5%9c%a8watcher%e6%9b%b4%e6%96%b0%e6%97%b6%e5%8f%88%e6%9c%89%e4%be%9d%e8%b5%96%e9%a1%b9%e5%8f%91%e7%94%9f%e5%8f%98%e6%8d%a2%e7%9a%84%e5%a4%84%e7%90%86)
   3. 如果同一个`watcher`在一次`eventloop`中更新次数过多，则在报错

3. 重置从`queueWatcher()`开始用到的一些状态变量。

## flushSchedulerQueue()——更新watcher

```js
// 检测同一个watcher在本轮中已更新多少次的hash表
let circular = [];

const activatedChildren = [];
function flushSchedulerQueue() {

    // 记录当前刷新队列的初始事件(用于记录事件处理器合适添加)
    currentFlushTimestamp = getNow();

    // 变更队列刷新的状态为刷新中
    flushing = true;
    let watcher, id;

    // Sort queue before flush.
    // 更新前刷新队列
    // This ensures that:
    // 1. Components are updated from parent to child. (because parent is always
    //    created before the child)
    // 组件按父——>子的顺序更新（因为父组件优先于子组件创建）
    // 2. A component's user watchers are run before its render watcher (because
    //    user watchers are created before the render watcher)
    // 用户自定义的watcher会优先于渲染watcher更新，因为初始化vue实例时的创建顺序也如此
    // 3. If a component is destroyed during a parent component's watcher run,
    //    its watchers can be skipped.
    // 当一个组件在其父级watcher运行时销毁了，那么直接跳过

    // 给刷新队列排序，原因为上面的 1.
    queue.sort((a, b) => a.id - b.id);

    // do not cache length because more watchers might be pushed
    // as we run existing watchers
    // 没有环境队列长度是因为当更新当前已存在的watcher时，可能会有更多的watcher会加入队列
    for (index = 0; index < queue.length; index++) {
        watcher = queue[index];

        // 触发渲染watcher的before函数，实际就是触发该组件的beforeupdate钩子函数
        if (watcher.before) {
            watcher.before();
        }

        // 清空has队列的当前已刷新的watcher
        id = watcher.id;
        has[id] = null;

        // 正式更新watcher, 对其表达式求值并重新收集依赖项，watch的watcher还要触发其回调函数
        watcher.run();

        // 开发模式下，循环更新过长时报错
        // in dev build, check and stop circular updates.
        if (process.env.NODE_ENV !== 'production' && has[id] != null) {
            // 更新次数计算，同一个watcher在一次更新中被触发了100次可能存在无限的循环
            circular[id] = (circular[id] || 0) + 1;
            if (circular[id] > MAX_UPDATE_COUNT) {
                warn(
                    'You may have an infinite update loop ' +
                        (watcher.user
                            ? `in watcher with expression "${watcher.expression}"`
                            : `in a component render function.`),
                    watcher.vm
                );
                break;
            }
        }
    }

    // keep copies of post queues before resetting state
    // 重置状态前，存储一份刷新队列的复制数据
    const activatedQueue = activatedChildren.slice();
    const updatedQueue = queue.slice();


    resetSchedulerState();

    // call component updated and activated hooks
    // 触发涉及这些变动的组件的生命周期函数
    callActivatedHooks(activatedQueue);
    callUpdatedHooks(updatedQueue);

    // devtool hook
    if (devtools && config.devtools) {
        devtools.emit('flush');
    }
}
```

首先呢，对`queue`排序，然后依次更新`watcher`：

在更新`watcher`前，如果是渲染`watcher`则会触发其`beforeUpdate`钩子函数：
![渲染watcher的before函数](./imgs/渲染watcher的before().png)

之后通过`watcher.run()`来对各个各种`watcher`进行更新处理，对其进行以下操作：

1. 进行求值和依赖项重新收集
2. 如果是`hwatch`属性的`watcher`则触发其回调

```js
Watcher.prototype.run() {

    // 首先确保它不是在被销毁的组件
    if (this.active) {

        // 重新求值并获取依赖项
        // 如果这里是渲染watcher那么会对computed属性重新进行求值
        const value = this.get();

        // 深度监听或监听一个对象类型的属性时，即使它们求值结果与旧值相同，也有可能发生了变换，所以要进行值的更替处理
        if (
            value !== this.value ||
            // Deep watchers and watchers on Object/Arrays should fire even
            // when the value is the same, because the value may
            // have mutated.
            isObject(value) ||
            this.deep
        )   {
            // set new value
            const oldValue = this.value;
            this.value = value;

            // 触发用户定义的watch函数的回调
            if (this.user) {
                try {
                    this.cb.call(this.vm, value, oldValue);
                    } catch (e) {
                        handleError(e, this.vm, `callback for watcher "${this.expression}"`);
                    }
                } else {
                    this.cb.call(this.vm, value, oldValue);
                }
            }
    }
}
```

最后通过`resetSchedulerState()`来重置更新调度程序队列的状态, 具体状态的含义在上面有描述，这里就不标记注释了。

```js
function resetSchedulerState() {
    index = queue.length = activatedChildren.length = 0;
    has = {};
    if (process.env.NODE_ENV !== 'production') {
        circular = {};
    }
    waiting = flushing = false;
}
```

然后触发涉及数据更新的`watcher`所在的`Vue`实例的`update`钩子函数:

```js
function callUpdatedHooks(queue) {
    let i = queue.length
    while (i--) {
        const watcher = queue[i]
        const vm = watcher.vm
        if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
            callHook(vm, 'updated')
        }
    }
}
```

### 在watcher更新时，又有依赖项发生变换的处理

在上述更新过程中`watcher.run()`运行时，可能会出现以下这种情况, 我们在监听一个变量的时候，改变了自己或其他变量：

```js
watch: {
    a () {
        this.a = 5;
    }
}
```

但此时事件循环并未结束，所以按之前的流程：依赖项变动... ——> 触发`queueWatcher()`，向`queue`队列中加入新的`watcher`, 此时的`queueWatcher()`的流程就发生了变化：由于此时处于刷新队列中的状态，所以此时`flushing = true`、`waiting = false`，那么它只能进入以下逻辑部分：

```js
// 截取部分queueWatcher()代码
let i = queue.length - 1;
while (i > index && queue[i].id > watcher.id) {
    i--;
}
queue.splice(i + 1, 0, watcher);
```

从上面的代码段可以看出，如果有新的`watcher`加入，那么它会被添加到**还未更新的`watcher`中的对应的有序位置**，如我们此时有这样一个`watcher`队列(id表示):

```js
// 总队列为
const queue = [1, 3, 5, 6, 8, 9];

// 已更新的队列为
[1, 3];

// 剩余的队列为
[5, 6, 7, 8, 9];

// 此时
index = 2;
```

那么如果在更新5时，添加了一个`id`为2的`watcher`进来，那么此时：

```js
// 已更新的队列为
[1, 3];

// 剩余的队列为
[5, 2, 6, 7, 8, 9];

// 此时5未更新完，所以
index = 2;
```

在`flushSchedulerQueue()`函数中，我们可以看见在调用`queue`队列的`watcher`时，是以这种形式：

```js
for (index = 0; index < queue.length; index++)
```

所以在新加入`watcher`时，循环的次数也会增加，就保证了全部`watcher`的更新。

### beforeUpdate与update构造函数调用的顺序

由上面的代码我们可以总结出：

+ `beforeUpdate`函数在组件中的调用顺序是由**父->子** 并是在渲染`watcher`更新前调用。
+ `update`函数在组件中的调用顺序是由**子->父**的顺序调用，并是在所有的`watcher`更新完后调用。

```js
// 原因
let i = queue.length;
while (i--) {
    callHook('update');
}

for (index = 0; index < queue.length; index++) {
    callHook('beforeUpdate');
}
```
