# 普通型拦截器

普通型的拦截器对象为：

```js
const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
};
```

## get取值器

首先，全部的取值器都是由`createGetter()`创建，在这些里面一共有：

```js
// 普通取值器
const get = /*#__PURE__*/ createGetter();

// 单层取值器
const shallowReactiveGet = /*#__PURE__*/ createGetter(false, true);

// 只读取值器
const readonlyGet = /*#__PURE__*/ createGetter(true);

// 单层只读取值器
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);
```

从上面创建我们大致能猜到对应参数的含义，下面我们来具体看看这个函数：

```js
/**
 * @param {Boolean} isReadonly 是否为只读
 * @param {Boolean} shallow 是否只代理对象的第一层
 */
function createGetter(isReadonly = false, shallow = false) {

    // 闭包存储配置
    return function get(target, key, receiver) {

        // 对于数组特殊方法形式的访问，不进行依赖项收集，直接返回答案
        if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver);
        }

        // 其他形式的访问，先求出具体的值
        const res = Reflect.get(target, key, receiver);

        // 对于symbol类型的原有属性的访问，也直接返回
        if (isSymbol(key) && builtInSymbols.has(key)) {
            return res;
        }

        // 是否只代理当前层
        if (shallow) {

            // 收集依赖项
            track(target, "get" /* GET */, key);

            // TODO strict mode that returns a shallow-readonly version of the value
            return res;
        }

        // ref unwrapping, only for Objects, not for Arrays.
        // 是否为定义了ref属性的对象
        if (isRef(res) && !isArray(target)) {
            return res.value;
        }

        // 收集当前层级中的依赖项
        track(target, "get" /* GET */, key);

        // 非对象值直接返回，对象值递归继续代理
        return isObject(res)
            ? isReadonly
                ? // need to lazy access readonly and reactive here to avoid
                    // circular dependency
                    // 对对象进行lazy式的响应式处理
                    readonly(res)
                : reactive(res)
            : res;
    };
}
```

从上面的`get`函数，我们可以看到，当前仅对

## set设置器

`set`取值器也是统一由`createSetter()`函数创建，具体有4种，对标`getter`：

```js
const set = /*#__PURE__*/ createSetter();
const shallowReactiveSet = /*#__PURE__*/ createSetter(false, true);
const readonlySet = /*#__PURE__*/ createSetter(true);
const shallowReadonlySet = /*#__PURE__*/ createSetter(true, true);
```

其函数具体为：

```js
function createSetter(isReadonly = false, shallow = false) {
    return function set(target, key, value, receiver) {

        // 如果为只读则直接返回
        if (isReadonly && LOCKED) {
            return true;
        }

        // 存储原值
        const oldValue = target[key];
        if (!shallow) {

            // 获取被代理的原值
            value = toRaw(value);

            // 如果当前值为具有ref属性的对象，而原值不是，则直接将该值赋予old
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
        }
        const hadKey = hasOwn(target, key);

        // 将该值设置在该对象上
        const result = Reflect.set(target, key, value, receiver);

        // don't trigger if target is something up in the prototype chain of original
        // 仅触发自有属性
        if (target === toRaw(receiver)) {

            // 处理新增键值
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key, value);
            }
            // 处理相同键值，在值未改变的情况下不做处理
            else if (hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key, value);
            }
        }
        return result;
    };
}
```