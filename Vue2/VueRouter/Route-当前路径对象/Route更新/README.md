# Route更新

在初始化加载了`Route`后，之后的`Route`更新就有只有四个途径：

- `router-link`组件跳转
- 函数`api`跳转
- 浏览器控件跳转
- 手动输入路径跳转(实则和控件跳转一样)

这里我们只会说明第二、第三种跳转方式，第一种会在组件中说明。

## router-link

[查看详情](../../路由组件/link/README.md)

## 函数api跳转

函数`api`跳转靠的是以下方法：

- `router.push()`
- `router.replace()`
- `router.go()`
  - `router.back()`
  - `router.forward()`

[具体详情](./函数跳转/README.md)

## 浏览器跳转

浏览器跳转主要描述的是通过浏览器控件进行跳转，比如前进、后退按钮(可能也有输入地址栏这种方式)，具体请[查看](./浏览器跳转/README.mdv)
