# observe()——创建或返回一个已有的观察者对象, 响应式的起源
在Vue中, 一个对象要变更为响应式都是通过这个函数来启动的,之后便会以该对象为基础递归来添加观察者对象与将对象中属性变更为响应式。

每个对象的观察者对象都会挂载到该对象的`__ob__`属性上。

这个过程大致如图：
![observe流程](./img/observe(value).png)

如我们在定义以下属性：
```js
let data = { a: 1, b: {
  c: 2
}};

// 则运用该函数后, 该对象会成为：
data = {
  a: 1,
  b: {
    c: 2,
    __ob__: {
      // b的Observer对象
    }
  }
  __ob__: {
    // data的Observer对象
  }
}
```

源码如下, 通过注释解释
```js
function observe (value: any, asRootData: ?boolean): Observer | void {

  // 不是对象或是Vnode实例时, 退出
  if (!isObject(value) || value instanceof VNode) {
    return
  }

  let ob: Observer | void

  // 已存在时, 直接返回
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (

    // 非服务器渲染时, 为该属性添加观察者对象
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {

    // 为该对象添加观察者对象并变更其中所有属性为响应式
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}
```

[查看源码中Observer对象](./Observer观察者对象)