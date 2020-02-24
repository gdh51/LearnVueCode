# 数组的处理

介于数组的特殊性，`Vue`对于数组响应式的处理比较特殊，因为我们常常将数组用作栈、队列特殊的数据结构来使用，经常涉及到遍历，如果对每一个数组项都按下标与值进行响应式处理，那么每次遍历时就会出现大量`getter`访问(我的理解)，开销就较大。

同样对于数组的增删，通常是使用的方法，而非直接用数组下标和长度来进行更新。基于这些情况，`Vue`对于数组的更新便选择了**重写这些数组的原生方法**。

```js
// 根据不同类型的对象类型值，分别调用不同方法对其字段进行响应式处理
if (Array.isArray(value)) {

    // 是否可以只用__proto__属性来访问原型对象
    if (hasProto) {
        // 当浏览器可以使用__proto__属性时, 将value原型指向arrayMethods
        protoAugment(value, arrayMethods)
    } else {

        // 没有该属性时, 直接在value上挂载所有数组方法
        copyAugment(value, arrayMethods, arrayKeys)
    }
    this.observeArray(value)
}
```

## 重写数组原生方法

从上面我们看到了，如果对于一个值为数组看，那么其就会重写该值的数组的原生方法，当然这不会影响数组原型对象上的原生方法，上述中的`arrayMethods`对象即为重写后的数组方法的对象，它的处理比较好理解，即**封装原生方法，然后在当前数组和数组的原型对象之间新增一个原型对象(这是其中一种，另一种是直接重写原型对象)，来隔断对象原型链上数组方法的访问**，具体操作如下：

```js
const arrayProto = Array.prototype;
const arrayMethods = Object.create(arrayProto);

const methodsToPatch = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse'
];

methodsToPatch.forEach(function(method) {
    // cache original method
    // 缓存原生方法
    const original = arrayProto[method];

    // 重写当前的数组方法
    def(arrayMethods, method, function mutator(...args) {
        // 调用原生方法的处理
        const result = original.apply(this, args);

        // 获取当前改变数组的观察者对象
        const ob = this.__ob__;

        // 处理新增数组元素的情况，inserted为新增的元素
        let inserted;
        switch (method) {
            case 'push':
            case 'unshift':
                inserted = args;
                break;
            case 'splice':
                inserted = args.slice(2);
                break;
        }

        // 手动为新增的元素变更为响应式
        if (inserted) ob.observeArray(inserted);

        // 更新依赖项
        ob.dep.notify();
        return result;
    });
});
```

从上面的重写方法中我们可以看到，其实际为手动为数据将新增的元素进行响应式处理。
____

那么具体重写数组原型对象的操作还是要根据系统是否直接提供`__proto__`属性分为两种：

首先是提供`__proto__`属性时，那么就调用`protoAugment()`方法来进行修改

```js
function protoAugment(target, src: Object) {
    target.__proto__ = src
}
```

另一种就是`copyAugment()`，这种方法就是将其作为属性直接添加在数组上，隔断原型对象的访问。

```js
// 不支持__proto__的浏览器，降级处理直接在对象上定义该方法覆盖原型链上方法
function copyAugment(target: Object, src: Object, keys: Array<string>) {
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        def(target, key, src[key]);
    }
}
```

那么处理完数组的方法后，就是对数组的响应式处理。

## 数组元素的响应式处理

我们也看到了，数组进行响应式处理使用的是`Observer.prototype.observeArray()`方法，那么该方法区别于对象的点是什么呢：

```js
/**
 * Observe a list of Array items.
 */
observeArray(items: Array < any > ) {

    // 对数组中每个元素调用观察方法
    for (let i = 0, l = items.length; i < l; i++) {
        observe(items[i]);
    }
}
```

~~没错就是补丁~~，这里我们可以看到，对于数组的元素，它并进行响应式处理，而是对于元素自身进行了响应式处理，这么做的原因刚才也已经说了，所以我们在做如下操作时是不会触发视图更新的：

```js
// vm实例中
vm = {
    $data: {
        a: [0]
    }
};

vm.$data.a[0] = 1;
```

如果想取得更新就要重新渲染视图调用`Vue.prototype.$forceUpdate()`，但是推荐的方法是调用刚刚我们重写的那些数组方法。
