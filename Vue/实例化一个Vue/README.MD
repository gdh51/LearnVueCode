# 实例化一个Vue

从`Vue`的构造函数可以看出，它的实例化源于其自身的`_init()`方法，这个方法是在最初`initMixin()`时注入到`Vue`原型上的方法。

```js
function Vue(options) {
    //只能做构造函数使用
    if (!(this instanceof Vue)) {
        warn(
            'Vue is a constructor and should be called with the `new` keyword'
        );
    }

    //初始化
    this._init(options);
}
```

其具体的代码为：

```js
Vue.prototype._init = function (options ? : Object) {
        const vm: Component = this;

        // a uid 一个唯一标识符
        vm._uid = uid++;

        // 一个性能测试功能，可以无视
        let startTag, endTag;
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            startTag = `vue-perf-start:${vm._uid}`
            endTag = `vue-perf-end:${vm._uid}`
            mark(startTag)
        }

        // a flag to avoid this being observed
        vm._isVue = true;

        // 合并Options属性
        if (options && options._isComponent) {
            // optimize internal component instantiation
            // since dynamic options merging is pretty slow, and none of the
            // internal component options needs special treatment.
            // 暂存, 内部选项
            initInternalComponent(vm, options)
        } else {

            // 对实例构造函数上的默认配置和用户的配置进行合并
            vm.$options = mergeOptions(
                resolveConstructorOptions(vm.constructor),
                options || {},
                vm
            )
        }

        // 对实例自身进行代理
        if (process.env.NODE_ENV !== 'production') {
            initProxy(vm)
        } else {
            vm._renderProxy = vm
        }

        vm._self = vm;
        initLifecycle(vm);
        initEvents(vm);
        initRender(vm);
        callHook(vm, 'beforeCreate');

        initInjections(vm) // resolve injections before data/props
        initState(vm)
        initProvide(vm) // resolve provide after data/props
        callHook(vm, 'created')

        // 可以查看初始化该实例时的性能情况
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            vm._name = formatComponentName(vm, false)
            mark(endTag)
            measure(`vue ${vm._name} init`, startTag, endTag)
        }

        // 如果vm实例有el属性，则挂载
        if (vm.$options.el) {
            vm.$mount(vm.$options.el)
        }
    }
```

## beforeCreate

当我们实例化一个`Vue`时，首先其会合并一些用户设置的`Options`配置[详情](./合并Options/README.md)，之后便调用各种模块的初始化函数：

1. [initProxy——初始化Vue实例对自身的代理](./beforeCreate/初始化Proxy)
2. [initLifeCycle——初始化实例自身的一些属性](./beforeCreate/初始化生命周期)
3. [initEvents——初始化组件的自定义事件](./beforeCreate/初始化Events)
4. [initRender——初始化模版](./beforeCreate/初始化Render)

这时便开始调用第一个生命周期函数`beforeCreate`，我们可以知道，此时什么还未进行各种属性的初始化和`dom`的挂载

## create

之后便在这个阶段进行数据的初始化：

1. [initInject——初始化inject属性](./create/初始化Inject)
2. [initState——初始化各种属性(重要)](./create/初始化State)
3. [initProvide](./create/初始化Provide)

最后触发一下`create`钩子函数，在这个阶段，可以看出，所有的数据都已经准备就绪了。

## vm.$mount

如果实例配置有`el`属性，则需对