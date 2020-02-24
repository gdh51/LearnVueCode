# class Watcher中的工具方法

这里存放出现在Watcher类中的工具方法。

**目录：**

- [parsePath(path)——返回对象指定 path 的属性](#parsepathpath%e8%bf%94%e5%9b%9e%e5%af%b9%e8%b1%a1%e6%8c%87%e5%ae%9a-path-%e7%9a%84%e5%b1%9e%e6%80%a7)

## parsePath(path)——返回对象指定 path 的属性

该方法用于返回一个访问对象指定路径下属性的函数。

这里的路径指访问对象属性的路径，可以使用对象`.`运算符的形式指定对象的内部属性，如`a.b.c`，那么具体含义就为监听对象`a`中的对象`b`中的`c`属性的值

```js
/**
 * Parse simple path.
 * 解析简单的路径
 */
var bailRE = new RegExp(("[^" + (unicodeRegExp.source) + ".$_\\d]"));

function parsePath(path: string): any {

    // 是否为对象路径
    if (bailRE.test(path)) {
        return;
    }

    const segments = path.split('.');

    // 返回指定path的属性
    return function(obj) {
        for (let i = 0; i < segments.length; i++) {
            if (!obj) return;
            obj = obj[segments[i]];
        }
        return obj;
    };
}
```

>这里我们需要注意的是，此处返回的是一个函数而并非用于直接访问对象属性的字符串表达式。这个求值过程是迭代完成的，所以在求值时，如果存在`a.b.c`这种类型的字符串，则进行依赖项收集时，会同时收集`a、b、c`三个属性的依赖项

所以我们会出现以下这种情况, 假如我们注册了三个监听函数如下：

```js
const vm = {
    data () {
        return {
            a1: {
                a2: {
                    a3: 6
                }
            }
        }
    },
    watch: {
        // 该watcher1收集a1,a2,a3三个依赖项
        'a1.a2.a3' () {
            console.log('a3');
        },

        // 该watcher2收集a1,a2三个依赖项
        'a1.a2' () {
            console.log('a2');
        },

        // 该watcher3收集a1三个依赖项
        'a1' () {
            console.log('a1');
        }
    }
}
```

所以当我们去改变`a1`时，会打印出以下结果：

```js
'a3'
'a2'
'a1'
```
