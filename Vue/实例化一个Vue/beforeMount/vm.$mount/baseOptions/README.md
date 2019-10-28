# baseOptions 基础配置

在了解如何编译前，先看一下这个模版的基础配置属性。这里我直接将` baseOptions `从几个文件里面汇总成一个代码段，具体注释标记在代码中：

```js
const baseOptions: CompilerOptions = {
    expectHTML: true,
    modules: [
        klass: {
            staticKeys: ['staticClass'],

            // 下面为两个方法
            transformNode,
            genData
        }
        style: {
            staticKeys: ['staticStyle'],

            // 下面为两个方法
            transformNode,
            genData
        }
        model: {

            // 一个方法
            preTransformNode
        }
    ],

    directives: {

        // 三个方法
        model,
        text,
        html
    }

    // 检查是否为pre标签
    isPreTag: (tag: ?string): boolean => tag === 'pre',

    // 是否为自闭和标签，一个map表
    isUnaryTag,

    // 是否为置换元素或部分表单元素
    mustUseProp,

    // 是否为可以不闭合的标签
    canBeLeftOpenTag,

    // 是否为保留标签(包括原生和SVG标签)
    isReservedTag,

    // 检查标签的命名空间(仅支持svg与math标签)
    getTagNamespace,

    // 将modules中的staticKeys串联为字符串的结果，结果为'staticClass, staticSytle'
    staticKeys: genStaticKeys(modules)
}
```

上面没有说具体函数的作用是什么，简单说明了一下是个什么东西，具体作用在用到时说明
