## query()——查询dom中某个元素
```js
function query(el: string | Element): Element {

    // 用户定义为字符串形式，那么通过querySelector找到第一个符合选择器的
    if (typeof el === 'string') {
        const selected = document.querySelector(el);

        // 没找到，提示并创建一个空的div元素
        if (!selected) {
            process.env.NODE_ENV !== 'production' && warn(
                'Cannot find element: ' + el
            );

            return document.createElement('div');
        }
        return selected;

    // 用户挂载的真实DOM元素时，直接返回
    } else {
        return el;
    }
}
```