# 其他属性处理方法

这里是一些不具有大同性的属性处理方法

## genAssignmentCode()——将变量与$event绑定

该函数用于解析一个变量，将该变量与`$event`值进行绑定，绑定的方式有两种：

1. 无深度变量直接绑定
2. 具有深度的变量，只绑定其最后键的值

具体[`parseModel()`](../解析属性/README.md#parsemodel%e8%a7%a3%e6%9e%90%e5%af%b9%e8%b1%a1)的解析过程请跳转查看

```js
function genAssignmentCode(
    value: string,
    assignment: string
) : string {

    // 将value解析为路径+最后一个键名的形式
    const res = parseModel(value);

    // 不以[]结尾或没有.操作符时，即没有任何操作符时
    if (res.key === null) {

        // 绑定该表达式值为$event
        return `${value}=${assignment}`
    } else {

        // 创建一个新值或更改该属性的值绑定为$event
        // 注意这个地方，即使你绑定一个不存在的对象的值也行
        return `$set(${res.exp}, ${res.key}, ${assignment})`
    }
}
```