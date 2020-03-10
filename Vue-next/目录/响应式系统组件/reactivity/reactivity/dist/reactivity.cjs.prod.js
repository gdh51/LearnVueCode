'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

//
// IMPORTANT: all calls of this function must be prefixed with /*#__PURE__*/
// So that rollup can tree-shake them if necessary.
// 所有函数的调用都要有/*#__PURE__*/纯函数前缀，以便rollup能对它们进行tree-shaking

// Make a map and return a function for checking if a key
// is in that map.
// 生成一个map，来检测传入的字符串是否在传入的字符串集合中
function makeMap(str, expectsLowerCase) {
    const map = Object.create(null);
    const list = str.split(',');
    for (let i = 0; i < list.length; i++) {
        map[list[i]] = true;
    }
    return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val];
}

// 空对象
const EMPTY_OBJ =  {};

// 空函数
const NOOP = () => {};
const hasOwnProperty = Object.prototype.hasOwnProperty;

// 检测是否为自有属性
const hasOwn = (val, key) => hasOwnProperty.call(val, key);
const isArray = Array.isArray;
const isFunction = (val) => typeof val === 'function';
const isSymbol = (val) => typeof val === 'symbol';
const isObject = (val) => val !== null && typeof val === 'object';
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);

// class检查函数
const toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
};

// compare whether a value has changed, accounting for NaN.
// 检查传入的值是否发生改变，对NaN也有效
const hasChanged = (value, oldValue) => value !== oldValue && (value === value || oldValue === oldValue);

// 存放所有被代理对象的WeakMap
const targetMap = new WeakMap();

// 依赖变更时会影响的观察者栈
const effectStack = [];

// 当前在处理的观察者对象
let activeEffect;
const ITERATE_KEY = Symbol('iterate');

// 是否会受响应式处理的影响
function isEffect(fn) {
    return fn != null && fn._isEffect === true;
}

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
function stop(effect) {
    if (effect.active) {
        cleanup(effect);
        if (effect.options.onStop) {
            effect.options.onStop();
        }
        effect.active = false;
    }
}
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
function cleanup(effect) {

    // 获取其依赖项
    const { deps } = effect;

    // 删除依赖项的观察者数组中的该effect函数
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
let shouldTrack = true;
const trackStack = [];

// 不允许收集依赖项
function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
}

// 允许收集依赖项
function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
}
function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
}
function track(target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
        return;
    }

    // 在全局依赖项map中是否有该对象？
    let depsMap = targetMap.get(target);

    // 如果不存在该对象，则将其作为一个依赖项Map进行存储
    if (depsMap === void 0) {
        targetMap.set(target, (depsMap = new Map()));
    }

    // 那么该键值的依赖项是否存在于这个对象之中？
    let dep = depsMap.get(key);

    // 如果没有则新增一个依赖项存入其中
    if (dep === void 0) {
        depsMap.set(key, (dep = new Set()));
    }

    // 如果该依赖项没有被当前的effect函数观察，则将其添加到其观察者对象中
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);

        // 同时将该依赖项添加到观察者的依赖项队列中
        activeEffect.deps.push(dep);
    }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {

    // 获取该对象的依赖项集合map
    const depsMap = targetMap.get(target);

    // 未进行依赖项收集时返回
    if (depsMap === void 0) {
        // never been tracked
        return;
    }
    const effects = new Set();
    const computedRunners = new Set();
    if (type === "clear" /* CLEAR */) {
        // collection being cleared
        // trigger all effects for target
        depsMap.forEach(dep => {
            addRunners(effects, computedRunners, dep);
        });
    }
    else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                addRunners(effects, computedRunners, dep);
            }
        });
    }
    else {

        // schedule runs for SET | ADD | DELETE
        // 为set/add/delete调度run方法
        if (key !== void 0) {
            addRunners(effects, computedRunners, depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        if (type === "add" /* ADD */ ||
            type === "delete" /* DELETE */ ||
            (type === "set" /* SET */ && target instanceof Map)) {
            const iterationKey = isArray(target) ? 'length' : ITERATE_KEY;
            addRunners(effects, computedRunners, depsMap.get(iterationKey));
        }
    }
    const run = (effect) => {
        scheduleRun(effect);
    };
    // Important: computed effects must be run first so that computed getters
    // can be invalidated before any normal effects that depend on them are run.
    computedRunners.forEach(run);
    effects.forEach(run);
}
function addRunners(effects, computedRunners, effectsToAdd) {
    if (effectsToAdd !== void 0) {
        effectsToAdd.forEach(effect => {
            if (effect !== activeEffect) {
                if (effect.options.computed) {
                    computedRunners.add(effect);
                }
                else {
                    effects.add(effect);
                }
            }
        });
    }
}
function scheduleRun(effect, target, type, key, extraInfo) {
    if (effect.options.scheduler !== void 0) {
        effect.options.scheduler(effect);
    }
    else {
        effect();
    }
}

// global immutability lock
let LOCKED = true;
function lock() {
    LOCKED = true;
}
function unlock() {
    LOCKED = false;
}

const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(isSymbol));

// 普通取值器
const get = /*#__PURE__*/ createGetter();

// 单层取值器
const shallowReactiveGet = /*#__PURE__*/ createGetter(false, true);

// 只读取值器
const readonlyGet = /*#__PURE__*/ createGetter(true);

// 单层只读取值器
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);
const arrayInstrumentations = {};
['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
    arrayInstrumentations[key] = function (...args) {
        const arr = toRaw(this);
        for (let i = 0, l = this.length; i < l; i++) {
            track(arr, "get" /* GET */, i + '');
        }
        return arr[key](...args.map(toRaw));
    };
});

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
const set = /*#__PURE__*/ createSetter();
const shallowReactiveSet = /*#__PURE__*/ createSetter(false, true);
const readonlySet = /*#__PURE__*/ createSetter(true);
const shallowReadonlySet = /*#__PURE__*/ createSetter(true, true);
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
function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
        trigger(target, "delete" /* DELETE */, key, undefined);
    }
    return result;
}
function has(target, key) {
    const result = Reflect.has(target, key);
    track(target, "has" /* HAS */, key);
    return result;
}
function ownKeys(target) {
    track(target, "iterate" /* ITERATE */, ITERATE_KEY);
    return Reflect.ownKeys(target);
}
const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
};
const readonlyHandlers = {
    get: readonlyGet,
    set: readonlySet,
    has,
    ownKeys,
    deleteProperty(target, key) {
        if (LOCKED) {
            return true;
        }
        else {
            return deleteProperty(target, key);
        }
    }
};
const shallowReactiveHandlers = {
    ...mutableHandlers,
    get: shallowReactiveGet,
    set: shallowReactiveSet
};
// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
const shallowReadonlyHandlers = {
    ...readonlyHandlers,
    get: shallowReadonlyGet,
    set: shallowReadonlySet
};

const toReactive = (value) => isObject(value) ? reactive(value) : value;
const toReadonly = (value) => isObject(value) ? readonly(value) : value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get$1(target, key, wrap) {
    target = toRaw(target);
    key = toRaw(key);
    track(target, "get" /* GET */, key);
    return wrap(getProto(target).get.call(target, key));
}
function has$1(key) {
    const target = toRaw(this);
    key = toRaw(key);
    track(target, "has" /* HAS */, key);
    return getProto(target).has.call(target, key);
}
function size(target) {
    target = toRaw(target);
    track(target, "iterate" /* ITERATE */, ITERATE_KEY);
    return Reflect.get(getProto(target), 'size', target);
}
function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, value);
    const result = proto.add.call(target, value);
    if (!hadKey) {
        trigger(target, "add" /* ADD */, value, value);
    }
    return result;
}
function set$1(key, value) {
    value = toRaw(value);
    key = toRaw(key);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, key);
    const oldValue = proto.get.call(target, key);
    const result = proto.set.call(target, key, value);
    if (!hadKey) {
        trigger(target, "add" /* ADD */, key, value);
    }
    else if (hasChanged(value, oldValue)) {
        trigger(target, "set" /* SET */, key, value);
    }
    return result;
}
function deleteEntry(key) {
    key = toRaw(key);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, key);
    const oldValue = proto.get ? proto.get.call(target, key) : undefined;
    // forward the operation before queueing reactions
    const result = proto.delete.call(target, key);
    if (hadKey) {
        trigger(target, "delete" /* DELETE */, key, undefined);
    }
    return result;
}
function clear() {
    const target = toRaw(this);
    const hadItems = target.size !== 0;
    // forward the operation before queueing reactions
    const result = getProto(target).clear.call(target);
    if (hadItems) {
        trigger(target, "clear" /* CLEAR */, undefined, undefined);
    }
    return result;
}
function createForEach(isReadonly) {
    return function forEach(callback, thisArg) {
        const observed = this;
        const target = toRaw(observed);
        const wrap = isReadonly ? toReadonly : toReactive;
        track(target, "iterate" /* ITERATE */, ITERATE_KEY);
        // important: create sure the callback is
        // 1. invoked with the reactive map as `this` and 3rd arg
        // 2. the value received should be a corresponding reactive/readonly.
        function wrappedCallback(value, key) {
            return callback.call(observed, wrap(value), wrap(key), observed);
        }
        return getProto(target).forEach.call(target, wrappedCallback, thisArg);
    };
}
function createIterableMethod(method, isReadonly) {
    return function (...args) {
        const target = toRaw(this);
        const isPair = method === 'entries' ||
            (method === Symbol.iterator && target instanceof Map);
        const innerIterator = getProto(target)[method].apply(target, args);
        const wrap = isReadonly ? toReadonly : toReactive;
        track(target, "iterate" /* ITERATE */, ITERATE_KEY);
        // return a wrapped iterator which returns observed versions of the
        // values emitted from the real iterator
        return {
            // iterator protocol
            next() {
                const { value, done } = innerIterator.next();
                return done
                    ? { value, done }
                    : {
                        value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                        done
                    };
            },
            // iterable protocol
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function createReadonlyMethod(method, type) {
    return function (...args) {
        if (LOCKED) {
            return type === "delete" /* DELETE */ ? false : this;
        }
        else {
            return method.apply(this, args);
        }
    };
}
const mutableInstrumentations = {
    get(key) {
        return get$1(this, key, toReactive);
    },
    get size() {
        return size(this);
    },
    has: has$1,
    add,
    set: set$1,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false)
};
const readonlyInstrumentations = {
    get(key) {
        return get$1(this, key, toReadonly);
    },
    get size() {
        return size(this);
    },
    has: has$1,
    add: createReadonlyMethod(add, "add" /* ADD */),
    set: createReadonlyMethod(set$1, "set" /* SET */),
    delete: createReadonlyMethod(deleteEntry, "delete" /* DELETE */),
    clear: createReadonlyMethod(clear, "clear" /* CLEAR */),
    forEach: createForEach(true)
};
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
iteratorMethods.forEach(method => {
    mutableInstrumentations[method] = createIterableMethod(method, false);
    readonlyInstrumentations[method] = createIterableMethod(method, true);
});
function createInstrumentationGetter(instrumentations) {
    return (target, key, receiver) => Reflect.get(hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target, key, receiver);
}
const mutableCollectionHandlers = {
    get: createInstrumentationGetter(mutableInstrumentations)
};
const readonlyCollectionHandlers = {
    get: createInstrumentationGetter(readonlyInstrumentations)
};

// WeakMaps that store {raw <-> observed} pairs.
// WeakMaps用于存储原生对象到观察者对象的映射
const rawToReactive = new WeakMap();
const reactiveToRaw = new WeakMap();
const rawToReadonly = new WeakMap();
const readonlyToRaw = new WeakMap();

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
// WeakSets用于存储被标记为只读或在响应式创建期间未进行响应式收集的对象
const readonlyValues = new WeakSet();
const nonReactiveValues = new WeakSet();
const collectionTypes = new Set([Set, Map, WeakMap, WeakSet]);
const isObservableType = /*#__PURE__*/ makeMap('Object,Array,Map,Set,WeakMap,WeakSet');
const canObserve = (value) => {
    return (!value._isVue &&
        !value._isVNode &&
        isObservableType(toRawType(value)) &&
        !nonReactiveValues.has(value));
};

// 将对象变为响应式的API
function reactive(target) {

    // if trying to observe a readonly proxy, return the readonly version.
    // 是否已存在该对象的只读版本的代理，有则直接返回
    if (readonlyToRaw.has(target)) {
        return target;
    }

    // target is explicitly marked as readonly by user
    // 如果该值被用户标记为只读，那么进行只读的响应式处理
    if (readonlyValues.has(target)) {
        return readonly(target);
    }

    if (isRef(target)) {
        return target;
    }

    // 返回创建的响应式对象
    return createReactiveObject(target, rawToReactive, reactiveToRaw, mutableHandlers, mutableCollectionHandlers);
}
function readonly(target) {
    // value is a mutable observable, retrieve its original and return
    // a readonly version.
    if (reactiveToRaw.has(target)) {
        target = reactiveToRaw.get(target);
    }
    return createReactiveObject(target, rawToReadonly, readonlyToRaw, readonlyHandlers, readonlyCollectionHandlers);
}
// Return a reactive-copy of the original object, where only the root level
// properties are readonly, and does NOT unwrap refs nor recursively convert
// returned properties.
// This is used for creating the props proxy object for stateful components.
function shallowReadonly(target) {
    return createReactiveObject(target, rawToReadonly, readonlyToRaw, shallowReadonlyHandlers, readonlyCollectionHandlers);
}
// Return a reactive-copy of the original object, where only the root level
// properties are reactive, and does NOT unwrap refs nor recursively convert
// returned properties.
function shallowReactive(target) {
    return createReactiveObject(target, rawToReactive, reactiveToRaw, shallowReactiveHandlers, mutableCollectionHandlers);
}

function createReactiveObject(target, toProxy, toRaw, baseHandlers, collectionHandlers) {

    // 如果不是对象，则直接返回该值
    if (!isObject(target)) {
        return target;
    }

    // target already has corresponding Proxy
    // 如果该对象已经有相应的代理，则直接返回
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }

    // target is already a Proxy
    // 该对象已被其他方法代理，返回原对象
    if (toRaw.has(target)) {
        return target;
    }

    // only a whitelist of value types can be observed.
    // 仅有白名单的数据类型能被代理，其他类型直接返回
    if (!canObserve(target)) {
        return target;
    }

    // 单独类型
    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers;

    // 代理数据
    observed = new Proxy(target, handlers);

    // 创建影射表
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    return observed;
}
function isReactive(value) {
    return reactiveToRaw.has(value) || readonlyToRaw.has(value);
}
function isReadonly(value) {
    return readonlyToRaw.has(value);
}

// 返回已代理对象的原对象
function toRaw(observed) {
    return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed;
}
function markReadonly(value) {
    readonlyValues.add(value);
    return value;
}
function markNonReactive(value) {
    nonReactiveValues.add(value);
    return value;
}

const convert = (val) => isObject(val) ? reactive(val) : val;
function isRef(r) {
    return r ? r._isRef === true : false;
}
function ref(value) {
    return createRef(value);
}
function shallowRef(value) {
    return createRef(value, true);
}
function createRef(value, shallow = false) {
    if (isRef(value)) {
        return value;
    }
    if (!shallow) {
        value = convert(value);
    }
    const r = {
        _isRef: true,
        get value() {
            track(r, "get" /* GET */, 'value');
            return value;
        },
        set value(newVal) {
            value = shallow ? newVal : convert(newVal);
            trigger(r, "set" /* SET */, 'value',  void 0);
        }
    };
    return r;
}
function unref(ref) {
    return isRef(ref) ? ref.value : ref;
}
function toRefs(object) {
    const ret = {};
    for (const key in object) {
        ret[key] = toProxyRef(object, key);
    }
    return ret;
}
function toProxyRef(object, key) {
    return {
        _isRef: true,
        get value() {
            return object[key];
        },
        set value(newVal) {
            object[key] = newVal;
        }
    };
}

function computed(getterOrOptions) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter =  NOOP;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    let dirty = true;
    let value;
    let computed;
    const runner = effect(getter, {
        lazy: true,
        // mark effect as computed so that it gets priority during trigger
        computed: true,
        scheduler: () => {
            if (!dirty) {
                dirty = true;
                trigger(computed, "set" /* SET */, 'value');
            }
        }
    });
    computed = {
        _isRef: true,
        // expose effect so computed can be stopped
        effect: runner,
        get value() {
            if (dirty) {
                value = runner();
                dirty = false;
            }
            track(computed, "get" /* GET */, 'value');
            return value;
        },
        set value(newValue) {
            setter(newValue);
        }
    };
    return computed;
}

exports.ITERATE_KEY = ITERATE_KEY;
exports.computed = computed;
exports.effect = effect;
exports.enableTracking = enableTracking;
exports.isReactive = isReactive;
exports.isReadonly = isReadonly;
exports.isRef = isRef;
exports.lock = lock;
exports.markNonReactive = markNonReactive;
exports.markReadonly = markReadonly;
exports.pauseTracking = pauseTracking;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.resetTracking = resetTracking;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.shallowRef = shallowRef;
exports.stop = stop;
exports.toRaw = toRaw;
exports.toRefs = toRefs;
exports.track = track;
exports.trigger = trigger;
exports.unlock = unlock;
exports.unref = unref;
