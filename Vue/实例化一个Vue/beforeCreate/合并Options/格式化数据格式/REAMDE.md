# 格式化options中的部分属性的数据类型

由于我们传入`Vue`构造函数的`options`部分字段的数据类型可以是多样的，但`Vue`内部只会对对象形式的数据进行处理，所以在这之前，要预先对这一部分数据进行格式化。

具体的字段为`props`、`inject`、`directives`，会将其全部统一为对象格式，具体如下：

- [props的转换](#props%e7%9a%84%e8%bd%ac%e6%8d%a2)
- [inject的转换](#inject%e7%9a%84%e8%bd%ac%e6%8d%a2)
- [directives的转换](#directives%e7%9a%84%e8%bd%ac%e6%8d%a2)

## props的转换

`props`属性只支持数组和对象两种形式，其余形式报错：

```js
function normalizeProps(options: Object, vm: ? Component) {
    const props = options.props;
    if (!props) return;
    const res = {};
    let i, val, name;

    // 用户数组形式定义时，每个参数必须为字符串，将其转换为对象
    if (Array.isArray(props)) {
        i = props.length;
        while (i--) {
            val = props[i];
            if (typeof val === 'string') {

                // 驼峰化props字段名称
                name = camelize(val);
                res[name] = {
                    type: null
                }
            } else if (process.env.NODE_ENV !== 'production') {
                warn('props must be strings when using array syntax.')
            }
        }

    // 对象形式时，根据其属性的值，进行格式化
    } else if (isPlainObject(props)) {
        for (const key in props) {
            val = props[key]
            name = camelize(key);
            res[name] = isPlainObject(val) ?
                val : {
                    type: val
                }
        }

    // 两种数据类型都不是时，对不起，报错
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "props": expected an Array or an Object, ` +
            `but got ${toRawType(props)}.`,
            vm
        );
    }
    options.props = res;
}
```

最终转换为的值为：

```js
options.props = {
    value1: {
        type: Object
    }

    ...
}
```

## inject的转换

`inject`属性只支持数组和对象两种形式，其余形式报错：

```js
function normalizeInject(options: Object, vm: ? Component) {
    const inject = options.inject;
    if (!inject) return;
    const normalized = options.inject = {};

    // 数组形式时，值必须为字符串(虽然其他类型值没有报错)
    if (Array.isArray(inject)) {
        for (let i = 0; i < inject.length; i++) {
            normalized[inject[i]] = {
                from: inject[i]
            }
        }

    // 对象形式时
    } else if (isPlainObject(inject)) {
        for (const key in inject) {
            const val = inject[key]
            normalized[key] = isPlainObject(val) ?
                extend({
                    from: key
                }, val) : {
                    from: val
                }
        }
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `Invalid value for option "inject": expected an Array or an Object, ` +
            `but got ${toRawType(inject)}.`,
            vm
        )
    }
}
```

最终效果为：

```js
options.inject = {
    key1: {
        from: val1
    }
    ...
}
```

## directives的转换

```js
function normalizeDirectives(options: Object) {
    const dirs = options.directives;

    // 只定义一个函数时，默认绑定bind与update
    if (dirs) {
        for (const key in dirs) {
            const def = dirs[key];
            if (typeof def === 'function') {
                dirs[key] = {
                    bind: def,
                    update: def
                }
            }
        }
    }
}
```
