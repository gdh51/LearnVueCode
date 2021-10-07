# 知识点总结

优化：

- `Block` 管理，快速更新
  - 具有动态`key`的普通元素
  - `Root`
  - `Suspense/Teleport/KeepAlive(当有子节点时)`组件
  - `v-memo`的普通元素
  - `v-if/v-for`
  - 收集的子节点必须具有`patchFlag`或其为组件
- 依赖项
  - 基于`WeakMap`管理
  - 依赖项`Diff`
- `v-memo/v-once`节点缓存，基于`cache`
- 静态节点属性`hoist`，存储于闭包
- 节点计算`patchFlag`，使更新更细腻化
- 特殊节点`diff`更新

编译模版：

1. 解析为`ast`
2. 转化`ast`节点
   1. 打上`patchFlag`
   2. 生成`codegenNode`
   3. 提升静态 `VNode` 节点与属性
      - 取下限，即当前可提升节点下其余节点也为可提升的(属性同理)
      - 可提升的 `VNode` 至少要没有 `patchFlag`
3. 编译，根据`codegenNode`生成代码
