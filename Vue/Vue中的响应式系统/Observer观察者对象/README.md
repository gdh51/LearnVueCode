# Observer 观察者对象

Observer 对象主要用来为对象或数组中的属性变更为响应式, 如果对象或数组中的属性也是对象或数组, 则会递归调用[observer()](../)方法来, 为其添加响应式属性

下面看下其构造函数

```js
class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value

    // #dep1 为观察者对象单独定义个依赖项用于对象新增属性或删除属性或数组变换时
    this.dep = new Dep();
    this.vmCount = 0

    // 在value上定义_ob_属性并绑定该观察者对象
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      if (hasProto) {

        // 当浏览器支持__proto__属性时, 将value原型指向arrayMethods
        protoAugment(value, arrayMethods)
      } else {

        // 没有该属性时, 直接在value上挂载所有数组方法
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {

      // 遍历value中属性, 使其称为响应式
      this.walk(value)
    }
  }
```

看完后，你可能是蒙逼的也可能是懵懂的，在继续接下来的内容之前我们先介绍一下 vue 中一个将属性转变为响应式属性的方法——`defineReactive()`

## defineReactive()

> 该方法用来给用户(即我们)定义的属性变更为响应式的, 该方法会贯穿 vue 全文。

该方法将我们要定义的属性(原始值)通过`defineProperty()`将其变更为响应式，若该属性为对象或数组则递归来将其变更为响应式。每个属性都会定义一个依赖项, 会在获取该值时添加到对应的依赖中去。

```js
function defineReactive(
    obj: Object,
    key: string, // obj对象中某个属性的键名
    val: any,
    customSetter?: ?Function,
    shallow?: boolean
) {
    // #dep2 为该属性都定义一个依赖项用于该属性变换更新时
    const dep = new Dep();

    // 获取将要定义属性的属性描述符, 当该属性不可配置时直接返回
    const property = Object.getOwnPropertyDescriptor(obj, key);
    if (property && property.configurable === false) {
        return;
    }

    // cater for pre-defined getter/setters
    // 获取用户定义的getter/setter
    const getter = property && property.get;
    const setter = property && property.set;

    // 在用户只定义了setter时, 用setter获取该值
    if ((!getter || setter) && arguments.length === 2) {
        val = obj[key];
    }

    // 子属性为对象或数组时, 继续递归为该属性添加观察者对象(变更为响应式)
    let childOb = !shallow && observe(val);

    // 为该属性重新定义getter与setter
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter() {
            // 保留用户预定义的getter
            const value = getter ? getter.call(obj) : val;

            if (Dep.target) {
                // 将当前属性添加到对应Dep对象的依赖中去
                dep.depend();

                // 如果当前属性是对象时，还要将该对象的gc
                if (childOb) {
                    childOb.dep.depend();

                    // 当为数组时, 遍历数组来将数组元素添加到依赖中去
                    if (Array.isArray(value)) {
                        dependArray(value);
                    }
                }
            }
            return value;
        },
        set: function reactiveSetter(newVal) {
            const value = getter ? getter.call(obj) : val;

            if (newVal === value || (newVal !== newVal && value !== value)) {
                return;
            }

            // 自定义的setter, 不用管，主要用来不允许用户修改属性值, 修改时报错(如prop中属性)
            if (process.env.NODE_ENV !== 'production' && customSetter) {
                customSetter();
            }
            // #7981: for accessor properties without setter
            if (getter && !setter) return;
            if (setter) {
                setter.call(obj, newVal);
            } else {
                val = newVal;
            }

            // 如果更新的属性的值为对象或数组时, 继续递归为该属性添加观察者对象(变更为响应式)
            childOb = !shallow && observe(newVal);

            // 更新观察该依赖项的所有watcher
            dep.notify();
        }
    });
}
```

顺便一笔带过一个` def `方法, 它相当于`Object.defineProperty()`,看下知道了就行，没什么好说的

```js
function def(obj: Object, key: string, val: any, enumerable?: boolean) {
    Object.defineProperty(obj, key, {
        value: val,
        enumerable: !!enumerable,
        writable: true,
        configurable: true
    });
}
```

### 两个 dep 的区别

在这里我们可以看见一个情况，那就是上述过程中出现了两个 dep 依赖项对象，一个`#dep1`在`Observer`构造函数创建时，而另一个`#dep2`则存在与某个属性中。

其实它们的功能是不同的：

- `#dep1`用于对象的属性的增加或删除或数组的变换
- `#dep2`用于对象某个属性的变换

> 这么做的原因很简单，因为我们无法得知一个对象或属性在新增或删除某个属性时的变换，就无法进行响应式的更新。

## Observer.prototype.walk——遍历对象将其属性变更响应式

该函数的作用就是遍历对象来将其所有属性变更为响应式

```js
walk (obj: Object) {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    defineReactive(obj, keys[i]);
  }
}
```

简单易懂, [defineReactive()](<./#defineReactive()>)就在上方

## Observer.prototype.observeArray——为数组元素变更为响应式

Vue 中对数组和对象变更为响应式的处理不一样, 因为数组相对于对象, 在添加元素时存在更多的方式，所以需要对这些方法做特殊的处理, 防止在使用这些方法时, 数组新添加的元素没有响应式特性。**所以区别于对象的处理，就是新增了对数组方法的处理**。

> 截取 observer 函数中对数组的处理

```js
if (Array.isArray(value)) {
    if (hasProto) {
        // 当浏览器支持__proto__属性时, 将value原型指向arrayMethods
        protoAugment(value, arrayMethods);
    } else {
        // 没有该属性时, 直接在value上挂载所有数组方法
        copyAugment(value, arrayMethods, arrayKeys);
    }
    this.observeArray(value);
}
```

接下来让我们具体来看下对它们的处理

### 对数组方法来添加元素或删除元素的特殊处理

Vue 通过重写了数组的变异方法(调用后会修改原数组的方法)来实现调用后对依赖项的更新, 具体通过以下手段：

#### arrayMethods——改写原数组变异方法

通过我们熟悉的原型式继承, 然后在当前继承对象中定义数组方法来屏蔽原型对象上的方法。

具体在每个方法中, 会在调用后对依赖项进行更新, 在有新增元素的情况下会对新增的元素添加观察者对象并更新为响应式。

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

#### protoAugment()与 copyAugment()

最后用这两个方法来对当前数组进行处理，这两个方法的处理主要在于一个是对浏览器的降级方案：

```js
function protoAugment(target, src: Object) {
    target.__proto__ = src;
}

// 不支持__proto__的浏览器，降级处理直接在对象上定义该方法覆盖原型链上方法
function copyAugment(target: Object, src: Object, keys: Array<string>) {
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        def(target, key, src[key]);
    }
}
```

最后与处理对象的形式一样, 为每个元素添加观察者对象

```js
observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
```
