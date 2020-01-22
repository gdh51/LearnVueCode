# initLifeCycle

该函数用于初始化一些配置`Vue`实例的属性，具体的属性函数，这里我会提前标注，来助于之后的理解：

```js
function initLifecycle(vm: Component) {
    const options = vm.$options;

    // locate first non-abstract parent
    // 定位第一个非抽象的父级组件vm实例(如keep-alive/transition为抽象组件)
    let parent = options.parent;
    if (parent && !options.abstract) {
        while (parent.$options.abstract && parent.$parent) {
            parent = parent.$parent;
        }

        // 将该组件加入其子组件队列
        parent.$children.push(vm);
    }

    // 定义根vm实例和父级vm实例
    vm.$parent = parent;
    vm.$root = parent ? parent.$root : vm;

    // 存放该vm实例中的组件vm实例
    vm.$children = [];
    vm.$refs = {};

    // 存储该vm实例上全部的Watcher实例
    vm._watcher = null

    // keep-alive组件未激活状态
    vm._inactive = null

    // keep-alive组件是否直接失活状态
    vm._directInactive = false

    // DOM结构是否已挂载至浏览器页面
    vm._isMounted = false

    // 该vm实例是否已销毁
    vm._isDestroyed = false
    vm._isBeingDestroyed = false
}
```
