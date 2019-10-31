# addAttr()——添加属性

Vue中有两个方法用于添加属性，一种是添加的未处理的原始属性，另一种是添加的已处理的。

## addRawAttr()——添加原始属性

该函数用于向一个`AST`元素对象添加一个未经处理的新属性，其属性会添加到`attrsList`与`attrsMap`上，还可以设置范围：

```js
// add a raw attr (use this in preTransforms)
// 添加一个未处理的属性(仅在preTransforms)中使用
function addRawAttr(el: ASTElement, name: string, value: any, range ? : Range) {
    el.attrsMap[name] = value;

    // 设置属性的范围(在这个地方未指定range时就没有)
    el.attrsList.push(rangeSetItem({
        name,
        value
    }, range))
}

function rangeSetItem(
    item: any,
    range ? : {
        start ? : number,
        end ? : number
    }
) {
    // 设置range属性，未指定时取用item中的该值
    if (range) {
        if (range.start != null) {
            item.start = range.start
        }
        if (range.end != null) {
            item.end = range.end
        }
    }
    return item;
}
```

## addAttr()——添加已处理属性

该函数也用于为ast元素对象添加一个元素，不同于addRawAttr的地方是，它添加的属性是经过处理的，且它添加属性的位置是新建的。

```js
function addAttr(el: ASTElement, name: string, value: any, range ? : Range, dynamic ? : boolean) {

    // 是否添加至动态数组(添加的属性的位置都是新增的)
    const attrs = dynamic ?
        (el.dynamicAttrs || (el.dynamicAttrs = [])) :
        (el.attrs || (el.attrs = []));
    attrs.push(rangeSetItem({
        name,
        value,
        dynamic
    }, range));

    // 更改元素扁平化属性
    el.plain = false
}
```

## addProp()——向元素添加个prop属性

向`ast`元素添加个`props`数组，该`prop`非`attr`

```js
function addProp(el: ASTElement, name: string, value: string, range ? : Range, dynamic ? : boolean) {
    (el.props || (el.props = [])).push(rangeSetItem({
        name,
        value,
        dynamic
    }, range))
    el.plain = false
}
```
