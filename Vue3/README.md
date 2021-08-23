# Vue3

`Vue3`已经正式发布了，虽然兼容大部分`Vue2`语法，但是新增了`hook`语法。新语法相比于`React`，使用上的注意点较多，各自的更新方式和书写方式差异性还是挺大的，`Vue`注重`mutation`而`React`是非`mutation`的。除此之外还有一些需要注意的点，这需要我们使用一段时间来适应。

> Vue3 是通过 TypeScript 书写的，但是不影响

本文不是教你如果使用`Vue3`，而是对其源码进行解读，你可以通过它知道`Vue3`是如何通过新的方式进行响应式更新并熟悉新的`API`。

## 目录

在`Vue3`中，各个模块都被区分为单独的包，可以单独进行引用以便更好的`tree shaking`，由此我们也可以分别来看看各个模块，在整合在一起就能组成一个完整的`Vue3`。

- [响应式系统](<./Reactivity(响应式系统)/README.md>)
  - [副作用函数](<./Reactivity(响应式系统)/effect(副作用函数)/README.md>)
    - [细分下的副作用函数](<./Reactivity(响应式系统)/effect(副作用函数)/specialEffect(特殊副作用函数)/README.md>)
      - [计算副作用函数 computed()](<./Reactivity(响应式系统)/effect(副作用函数)/specialEffect(特殊副作用函数)/computed/README.md>)
      - [监听副作用函数 watch()/watchEffect()](<./Reactivity(响应式系统)/effect(副作用函数)/specialEffect(特殊副作用函数)/watch/README.md>)
    - [依赖项](<./Reactivity(响应式系统)/effect(副作用函数)/dep(依赖项)/README.md>)
  - [刷新调度队列](<./Reactivity(响应式系统)/flush-scheduler(刷新调度队列)/README.md>)
  - [对象响应化](<./Reactivity(响应式系统)/reactive(对象响应化)/README.md>)
