# getAttr()——获取属性

Vue中有三个方法来获取ast元素对象中的属性

## getBindingAttr()——获取bind属性

刚方法用于获取动态或静态的`name`的值字符串表达式（即`:`或`v-bind`），同时会调用`getAndRemoveAttr()`方法删除该`name`值在`AST.attrsList`中的值，注意第三个参数，唯有指明传入`false`时，才不查找静态值。

```js
function getBindingAttr(
    el: ASTElement,
    name: string,

    // 未找到动态绑定值时，是否查找静态的该值（唯有传入false时，才不找）
    getStatic ? : boolean
): ? string {

    // 移除ast对象中attrslist中的对应属性，并返回对应动态绑定属性的值
    const dynamicValue =
        getAndRemoveAttr(el, ':' + name) ||
        getAndRemoveAttr(el, 'v-bind:' + name);

    if (dynamicValue != null) {

        // 获取该对象值的函数表达式字符串
        return parseFilters(dynamicValue);

    // 未找到该动态绑定的属性时，是否查找该值的静态属性(注意这里是个全等)
    } else if (getStatic !== false) {
        const staticValue = getAndRemoveAttr(el, name);

        // 找到时，返回该对象值的JSON字符串
        if (staticValue != null) {
            return JSON.stringify(staticValue);
        }
    }
}
```

## getAndRemoveAttr()——用于移除AST对象中attrsList和attrsMap对应属性

该方法用于移除`ast`对象中给定属性，指定`removeFromMap`属性时，还会移除`attrsMap`中的该属性。返回被移除的属性的值。

```js
function getAndRemoveAttr(
    el: ASTElement,
    name: string,
    removeFromMap ? : boolean
) : ? string {
    let val;

    // 确保map中存在该属性或有值(空字符串也行)
    if ((val = el.attrsMap[name]) != null) {
        const list = el.attrsList;

        // 移除attrsList中的该名称属性
        for (let i = 0, l = list.length; i < l; i++) {
            if (list[i].name === name) {
                list.splice(i, 1)
                break
            }
        }
    }

    // 是否移除map中的该属性
    if (removeFromMap) {
        delete el.attrsMap[name];
    }

    // 返回该属性的值
    return val;
}
```

## getRawBindingAttr()——获取未处理属性的对象信息

该函数用于从`rawAttrsMap`中获取指定`name`的未处理属性的对象信息

```js
function getRawBindingAttr(
    el: ASTElement,
    name: string
) {
    return el.rawAttrsMap[':' + name] ||
        el.rawAttrsMap['v-bind:' + name] ||
        el.rawAttrsMap[name]
}
```

## getAndRemoveAttrByRegex——通过正则表达式获取未处理属性

指定一个正则表达式，获取未处理属性数组中的与该正则表达式匹配的值

```js
function getAndRemoveAttrByRegex(
    el: ASTElement,
    name: RegExp
) {
    // 剩余未处理的属性数组
    const list = el.attrsList;
    for (let i = 0, l = list.length; i < l; i++) {
        const attr = list[i];

        // 找到匹配正则表达式的属性，返回关于该属性的对象
        if (name.test(attr.name)) {
            list.splice(i, 1);
            return attr;
        }
    }
}
```
