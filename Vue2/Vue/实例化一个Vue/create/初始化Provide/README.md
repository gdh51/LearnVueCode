# 初始化Provide属性
没什么好说的一看就会，但是要注意一点，`provide`提供的函数是以**返回值的形式**提供的，而非函数本身
```js
function initProvide(vm: Component) {
    const provide = vm.$options.provide;
    if (provide) {
        vm._provided = (typeof provide === 'function')
            ? provide.call(vm) : provide;
    }
}
```