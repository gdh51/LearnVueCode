# 其他的检测函数

这里存放的是其他用于在生成渲染函数过程中的检测函数

## getNormalizationType()——确认标准化程度

该元素针对子节点数组的部分子节点类型来确定标准化程度，一共存在三个级别：

- 0，不进行标准化：没有以下情况则为该情况。
- 1，简单标准化：子节点数组中存在自定义组件。(包含同级`if`条件块中)
- 2，深度标准化：子节点数组中存在`template`、`slot`元素或具有`v-for`属性。(包含同级`if`条件块中)

```js
// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
function getNormalizationType(
    children: Array < ASTNode > ,
    maybeComponent: (el: ASTElement) => boolean
): number {

    // 默认为不需要标准化
    let res = 0;
    for (let i = 0; i < children.length; i++) {
        const el: ASTNode = children[i];

        // 跳过元素节点
        if (el.type !== 1) {
            continue;
        }

        // 若该元素或同级if条件块元素中存在v-for属性或为template、slot元素则需要深度标准化
        if (needsNormalization(el) || (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
            res = 2;
            break;
        }

        // 若该元素或同级if条件块元素中的元素为组件，则进行简单的标准化
        if (maybeComponent(el) || (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
            res = 1;
        }
    }
    return res;
}
```

两个标准化程度的检测方式分别是[`needsNormalization()`](#needsnormalization%e7%a1%ae%e8%ae%a4%e6%98%af%e5%90%a6%e9%9c%80%e8%a6%81%e6%a0%87%e5%87%86%e5%8c%96)和[`maybeComponent()`](#maybecomponent%e6%98%af%e5%90%a6%e4%b8%ba%e7%bb%84%e4%bb%b6)，函数结果为返回针对该子节点数组的标准化程度值。

## needsNormalization()——确认是否需要标准化

该函数用于确认当前元素是否需要标准化，只要满足以下三个条件之一即可：

- 具有`v-for`属性
- `template`元素
- `slot`元素

```js
// 用于确认是否需要标准化
function needsNormalization(el: ASTElement): boolean {

    // 具有v-for或template、slot元素都需要进行标准化
    return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}
```

## maybeComponent()——是否为组件

该函数用于确认当前元素是否为组件，其中`isReservedTag()`函数用于检测是否为原生标签

```js
maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag);
```