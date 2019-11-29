# patch过程中用到的函数

这里主要是存放的是内置在`createPatchFunction()`闭包中的函数，这些函数将在它的返回值函数`patch()`调用时使用到。

目录：

- [baseSetAttr()——设置元素attribute](#basesetattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0attribute)
- [checkDuplicateKeys()——检查是否存在重复key值](#checkduplicatekeys%e6%a3%80%e6%9f%a5%e6%98%af%e5%90%a6%e5%ad%98%e5%9c%a8%e9%87%8d%e5%a4%8dkey%e5%80%bc)
- [setScope()——设置CSS作用域属性](#setscope%e8%ae%be%e7%bd%aecss%e4%bd%9c%e7%94%a8%e5%9f%9f%e5%b1%9e%e6%80%a7)
- [setAttr()——设置元素的属性](#setattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0%e7%9a%84%e5%b1%9e%e6%80%a7)
- [baseSetAttr()——设置元素attribute](#basesetattr%e8%ae%be%e7%bd%ae%e5%85%83%e7%b4%a0attribute)

## createEle()

## createComponent()

## setScope()——设置CSS作用域属性

该函数用于检查节点是否需要设置`CSS`的作用域，如果需要则通过对每个元素添加和该`vm`实例唯一对应的`attribute`来进行设置

```js
// set scope id attribute for scoped CSS.
// this is implemented as a special case to avoid the overhead
// of going through the normal attribute patching process.
// 设置CSS属性的作用域
// 这是一个单独的实现，防止对元素的普通attribute进行patch时造成额外的开销
function setScope(vnode) {
    let i;

    // 该VNode节点是否存在属性作用域，有则设置
    if (isDef(i = vnode.fnScopeId)) {
        nodeOps.setStyleScope(vnode.elm, i);

    // 没有则
    } else {
        let ancestor = vnode

        // 遍历该vm实例中的祖先节点，继承它的作用域属性
        while (ancestor) {

            // 是否存在vm实例并且该实例上是否存在_scopeId
            if (isDef(i = ancestor.context) && isDef(i =i.$options._scopeId)) {

                // 有则设置同意的作用域属性
                nodeOps.setStyleScope(vnode.elm, i)
            }
            ancestor = ancestor.parent
        }
    }

    // for slot content they should also get the scopeId from the host instance.
    // 对于插槽中的内容，它们也需要添加当前vm实例的scoped属性
    // 当前更新中的vm实例
    if (isDef(i = activeInstance) &&

        // VNode节点所处的vm实例不与当前的更新的实例相同
        i !== vnode.context &&
        i !== vnode.fnContext &&
        isDef(i = i.$options._scopeId)
    ) {
        nodeOps.setStyleScope(vnode.elm, i)
    }
}
```

除了自身的那些`VNode`节点外，还要对当前插槽中的内容同样设置当前`vm`实例的`CSS`作用域。

## checkDuplicateKeys()——检查是否存在重复key值

该方法用于检查子节点数组中的`key`值是否存在重复的情况。

```js
// 检查子节点数组中是否存在重复的key
function checkDuplicateKeys(children) {

    // 一个key值的map对象
    const seenKeys = {};

    // 遍历子节点数组，检查它们的key值是否重复
    for (let i = 0; i < children.length; i++) {
        const vnode = children[i]
        const key = vnode.key;

        // 重复时报错
        if (isDef(key)) {
            if (seenKeys[key]) {
                warn(
                    `Duplicate keys detected: '${key}'. This may cause an update error.`,
                    vnode.context
                )
            } else {

                // 没重复时存入map对象中
                seenKeys[key] = true
            }
        }
    }
}
```

## setAttr()——设置元素的属性

该方法用于兼容性处理元素的各种属性的设置，它会根据其属性名和值来进行设置，大致分为5类：

- 自定义标签
- 布尔值的属性
- 枚举类型的属性
- 命名空间属性
- 其他情况

这里就说明下什么是枚举类型的属性，因为没常见过。所谓**枚举类型的属性就是该属性必须要一个值**，三选一`true/false/''`。不能写这种形式`<div contenteditable></div>`

```js
function setAttr(el: Element, key: string, value: any) {

    // 自定义元素标签，则直接设置属性
    if (el.tagName.indexOf('-') > -1) {
        baseSetAttr(el, key, value);

    // 是否值为布尔值的属性，真对该属性即使没值也要设置
    } else if (isBooleanAttr(key)) {

        // set attribute for blank value
        // e.g. <option disabled>Select one</option>

        // 是否为假值，假值直接移除
        if (isFalsyAttrValue(value)) {
            el.removeAttribute(key)
        } else {

            // technically allowfullscreen is a boolean attribute for <iframe>,
            // but Flash expects a value of "true" when used on <embed> tag
            // 处理flash的allowfullscreen属性的特殊情况
            // 除flash的特殊情况外，其余的布尔值属性真值的值为自己的名称
            value = key === 'allowfullscreen' && el.tagName === 'EMBED' ?
                'true' : key;
            el.setAttribute(key, value);
        }

    // 如果为枚举属性(枚举属性特点为必有值)
    } else if (isEnumeratedAttr(key)) {
        el.setAttribute(key, convertEnumeratedValue(key, value));

    // 如果为命名空间属性
    } else if (isXlink(key)) {

        // 假值则移除
        if (isFalsyAttrValue(value)) {
            el.removeAttributeNS(xlinkNS, getXlinkProp(key));

        // 真值则添加命名空间
        } else {
            el.setAttributeNS(xlinkNS, key, value);
        }

    // 其余情况直接设置
    } else {
        baseSetAttr(el, key, value);
    }
}
```

### 枚举属性的处理

对于处理枚举属性时，具体的枚举属性的检验函数为`isEnumeratedAttr()`：

```js
const isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck');
```

而对于其值的处理，允许用于传入任何值，`Vue`会在内部调用`convertEnumeratedValue()`进行处理，真值一律处理为`true`(除`contenteditable`属性的几个特定字符串值外)：

```js
// 可供contenteditable选择的属性
const isValidContentEditableValue = makeMap('events,caret,typing,plaintext-only');

const convertEnumeratedValue = (key: string, value: any) => {
    return isFalsyAttrValue(value) || value === 'false' ? 'false'
        // allow arbitrary string value for contenteditable
        // contenteditable运行几个可选字符串属性值
        : (key === 'contenteditable' && isValidContentEditableValue(value) ?
        value : 'true');
}

const isFalsyAttrValue = (val: any): boolean => {

    // 验证null与undefined   验证false
    return val == null || val === false
}
```

### 布尔值的处理

对于布尔值的处理，首先是调用`isBooleanAttr()`进行属性的检查：

```js
const isBooleanAttr = makeMap(
    'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
    'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
    'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
    'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
    'required,reversed,scoped,seamless,selected,sortable,translate,' +
    'truespeed,typemustmatch,visible'
);
```

同样此处对假值的处理是调用的`isFalsyAttrValue()`(注意价值里面不包括`''`)，对于假值，布尔值属性会直接移除该值；而对于真值，除`Flash`插件的特殊情况外，其余的值都为自己的属性名称。

### 命名空间属性的处理

对于命名空间属性的处理差不多和布尔值一样，如果是假值就移除；如果为真值，则直接添加，这里对于其验证的几个函数就不学习了，有兴趣自己去找。

### 其他情况与自定义标签

这两种情况的处理方法一样，就是调用下面的`baseSetAttr()`方法直接设置属性。

## baseSetAttr()——设置元素attribute

该方法会针对给定的值来设置元素的某个属性，如果是假值，那么会直接移除该属性；真值当然是直接设置对应属性。

```js
function baseSetAttr(el, key, value) {

    // 如果设置的属性值为假值，则移除该属性
    if (isFalsyAttrValue(value)) {
        el.removeAttribute(key);

    // 设置的值为真值的情况
    } else {
        // #7138: IE10 & 11 fires input event when setting placeholder on
        // <textarea>... block the first input event and remove the blocker
        // immediately.
        // 如果设置的为placeholder属性，则需要一些处理，当然这个处理只对初始渲染有用
        if (
            isIE && !isIE9 &&
            el.tagName === 'TEXTAREA' &&
            key === 'placeholder' && value !== '' && !el.__ieph
        ) {

            // 堵塞函数
            const blocker = e => {

                // 阻止冒泡和其他事件监听函数的执行
                e.stopImmediatePropagation();

                // 然后移除该阻塞函数
                el.removeEventListener('input', blocker)
            }

            // 移除该阻塞函数
            el.addEventListener('input', blocker);

            // IE placeholder补丁标记位
            el.__ieph = true /* IE placeholder patched */
        };

        // 设置placeholder属性
        el.setAttribute(key, value);
    }
}
```

这个过程中还有一个关于`IE10/11`的`BUG`：当设置`placeholder`时，会立即触发`textarea`元素的`input`事件。针对这个`BUG`，并不能彻底解决，只能在初次渲染的时候，进行一次修复；如果设置动态的`placeholder`则还会触发该`bug`