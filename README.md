# Vue 源码

记录下`Vue`的源码解读并整理成文档，该文档推荐在有一定使用`Vue`经验的情况下并想尝试学习源码的人阅读。

由于文章的时间跨度较长，前后的描述风格可能存在差异，并且可能有错误，欢迎大家提出`issue`。

## 目录

-   [Vue2 相关](./Vue2/Vue/README.md)
-   [Vuex](./Vue2/VueX/README.md)
-   [VueRouter](./Vue2/VueRouter/README.md)
-   [Vue3.x](./Vue3/README.md)
    -   [响应式系统](<./Vue3/Reactivity(响应式系统)/README.md>)
        -   [副作用函数](<./Vue3/Reactivity(响应式系统)/effect(副作用函数)/README.md>)
            -   [细分下的副作用函数](<./Vue3/Reactivity(响应式系统)/effect(副作用函数)/specialEffect(特殊副作用函数)/README.md>)
                -   [计算副作用函数 computed()](<./Vue3/Reactivity(响应式系统)/effect(副作用函数)/specialEffect(特殊副作用函数)/computed/README.md>)
                -   [监听副作用函数 watch()/watchEffect()](<./Vue3/Reactivity(响应式系统)/effect(副作用函数)/specialEffect(特殊副作用函数)/watch/README.md>)
        -   [依赖项](<./Vue3/Reactivity(响应式系统)/effect(副作用函数)/dep(依赖项)/README.md>)
    -   [刷新调度队列](<./Vue3/Reactivity(响应式系统)/flush-scheduler(刷新调度队列)/README.md>)
    -   [对象响应化](<./Vue3/Reactivity(响应式系统)/reactive(对象响应化)/README.md>)
    -   [生命周期](<./Vue3/LifeCycle(生命周期)/README.md>)
        -   [Diff 算法](<./Vue3/LifeCycle(生命周期)/Diff更新算法/README.md>)
        -   [Block 块管理](<./Vue3/LifeCycle(生命周期)/Block块管理/README.md>)
-   [Vite-构建工具](./Vite/README.md)
