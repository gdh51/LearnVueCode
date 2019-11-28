# initGlobalAPI()

在最初初始化`Vue`构造函数时，会调用该方法来对`Vue`构造函数添加一些属性、API

以下是它的具体代码：

```js
const ASSET_TYPES = [
  'component',
  'directive',
  'filter'
];

function initGlobalAPI(Vue: GlobalAPI) {

    // config Vue的全局配置，配置其的一些功能
    const configDef = {};
    configDef.get = () => config;
    if (process.env.NODE_ENV !== 'production') {
        configDef.set = () => {
            warn(
                'Do not replace the Vue.config object, set individual fields instead.'
            )
        }
    }
    Object.defineProperty(Vue, 'config', configDef)

    // exposed util methods.
    // NOTE: these are not considered part of the public API - avoid relying on
    // them unless you are aware of the risk.
    // 暴露一些工具方法(非公共API)
    Vue.util = {
        warn,
        extend,
        mergeOptions,
        defineReactive
    };
    Vue.set = set;
    Vue.delete = del;
    Vue.nextTick = nextTick;

    // 2.6 explicit observable API
    // 一个API用于使一个对象变为响应式的
    Vue.observable = obj => {
        observe(obj);
        return obj;
    }

    // 给4个基本组件属性配置一个空对象
    Vue.options = Object.create(null);
    ASSET_TYPES.forEach(type => {
        Vue.options[type + 's'] = Object.create(null)
    })

    // this is used to identify the "base" constructor to extend all plain-object
    // components with in Weex's multi-instance scenarios.
    Vue.options._base = Vue;

    // 将keep-alive组件挂载在组件的默认配置上
    extend(Vue.options.components, builtInComponents);

    // 又在Vue上挂载一些API，具体用到时在解释
    initUse(Vue);
    initMixin(Vue);
    initExtend(Vue);
    initAssetRegisters(Vue);
}
```

## extend()——将from对象的属性混入目标对象中

简单易懂，相当于我们的浅复制

```js
function extend(to: Object, _from: ? Object): Object {
    for (const key in _from) {
        to[key] = _from[key];
    }
    return to;
}
```

## initExtend(Vue)——拓展构造函数方法

为`Vue`的构造函数添加一个`.extend()`，用于混合生成组件的构造函数。
