# 监听属性Watcher

作为第二个被初始`Watcher`，我们将其分为两个部分：

- [初始化并收集依赖项](#%e5%88%9d%e5%a7%8b%e5%8c%96%e5%b9%b6%e6%94%b6%e9%9b%86%e4%be%9d%e8%b5%96%e9%a1%b9)
- [监听函数的触发](#%e7%9b%91%e5%90%ac%e5%87%bd%e6%95%b0%e7%9a%84%e8%a7%a6%e5%8f%91)

## 初始化并收集依赖项

监听属性的`Watcher`初始化参数为：

```js
// 参数分别为 当前vm实例, watcher名, 回调函数, watcher配置
const watcher = new Watcher(vm, expOrFn, cb, options);
```

那么对对应`class Watcher`中初始化参数的处理，处理后具体的构造函数为：

```js
this.vm = vm

// 将Watcher加入vm上的_watchers数组
vm._watchers.push(this);

// options
// 初始化配置
// 以下两个属性为watch的特有属性
this.deep = !!options.deep;
this.user = true;

this.lazy = !!options.lazy;
this.sync = !!options.sync;
this.before = undefined;
this.cb = cb;
this.id = ++uid; // uid for batching
this.active = true;
this.dirty = false; // for lazy watchers
this.deps = [];
this.newDeps = [];
this.depIds = new Set();
this.newDepIds = new Set();
this.expression = expOrFn.toString();

// 当Watcher名为字符串时, 可以是.运算符指定对象的某个属性
// getter为一个函数, 返回watch名所对应的属性(即监听函数)
this.getter = parsePath(expOrFn);

// 当存在不规范的定义时会报错
if (!this.getter) {
    this.getter = noop
    process.env.NODE_ENV !== 'production' && warn(
            `Failed watching path: "${expOrFn}" ` +
            'Watcher only accepts simple dot-delimited paths. ' +
            'For full control, use a function instead.',
            vm
        )
    }
}

// 当前Watcher的值，当是computed时，延迟求值(即本次不求值)
this.value = this.get();
```

在该`watcher`实例中呢，`deep`与`user`是其特有的属性，前者表示是否深度监听属性内的属性，后者表示`watch`过程出错时是否为用户报错。

那么在初始化过程中，上面还有两个地方要注意：一个是[`parsePath()`](../工具方法/README.md#parsepathpath%e8%bf%94%e5%9b%9e%e5%af%b9%e8%b1%a1%e6%8c%87%e5%ae%9a-path-%e7%9a%84%e5%b1%9e%e6%80%a7)函数，它会对对象路径形式的字符串进行解析，返回一个直接访问对应路径的函数，比如：

```js
'a.b.c'

// 解析后返回的函数大约就为
function parsePath (obj) {
    return obj.a.b.c;
}
```

该函数等会会用于依赖项收集，另一个需要注意的就是该`watcher`在实例化最后是调用了[`watcher.get()`](../README.md#watcherprototypeget%e8%ae%a1%e7%ae%97watcher%e7%9a%84%e5%80%bc%e6%94%b6%e9%9b%86%e4%be%9d%e8%b5%96%e9%a1%b9)(点击查看具体过程)求值的。

(上面两个链接中涉及到该属性的一些问题)

## 监听函数的触发

那么监听函数何时触发呢？答案是依赖项更新时，在`parsePath()`方法中我们提到了，在监听诸如`a.b.c`这种深层的属性时，会对`a、b、c`三个属性的依赖项都进行收集，所以但凡有一个依赖项更新就会触发`Watcher`更新，此时会先调用[`watcher.update()`](../README.md#watcherptototypeupdate%e6%9b%b4%e6%96%b0-watcher)方法，之后加入刷新队列，通过刷新队列调用[`watcher.run()`](../README.md#watcherprototyperun%e9%87%8d%e6%96%b0%e6%94%b6%e9%9b%86%e4%be%9d%e8%b5%96%e9%a1%b9%e5%b9%b6%e8%a7%a6%e5%8f%91%e5%9b%9e%e8%b0%83)方法来进行更新，重新进行`Watcher`求值并收集依赖项，此时就会触发监听函数的回调函数。

(以上涉及刷新队列的知识，在介绍完三个`Watcher`后会讲解)
