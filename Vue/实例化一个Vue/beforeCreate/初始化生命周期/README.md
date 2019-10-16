# initLifeCycle
用于初始化一些配置Vue实例的配置属性，与定位其父组件与根组件：
```js
function initLifecycle(vm: Component) {
    const options = vm.$options;

    // locate first non-abstract parent
    // 定位第一个非抽象的父级组件(如keep-alive/transition为抽象组件)
    let parent = options.parent;
    if (parent && !options.abstract) {
        while (parent.$options.abstract && parent.$parent) {
            parent = parent.$parent;
        }

        // 将该组件加入其子组件队列
        parent.$children.push(vm);
    }

    vm.$parent = parent;
    vm.$root = parent ? parent.$root : vm;

    vm.$children = [];
    vm.$refs = {};

    vm._watcher = null
    vm._inactive = null
    vm._directInactive = false
    vm._isMounted = false
    vm._isDestroyed = false
    vm._isBeingDestroyed = false
}
```