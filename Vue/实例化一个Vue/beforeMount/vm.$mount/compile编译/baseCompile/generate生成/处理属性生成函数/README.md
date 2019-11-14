
# 处理属性生成函数

大致浏览一下源码，不难发现，`Vue`反复调用`genElement()`这个函数来处理元素的属性来生成渲染函数；为了防止重复处理某个属性，再该属性处理时，会在该元素上添加一个`[key]Processed`类似的标记位来证明它已经处理了。

## genElement()——处理元素渲染相关属性，生成渲染函数

该函数按 `static` -> `once` -> `for` -> `if` -> `children` -> `slot` -> `component` -> `data` 这样的顺序来处理属性，为什么只处理这些属性也很好理解，因为它们会影响`dom`的渲染；它们处理的顺序也好理解，为什么`v-for`与`v-if`优先处理，因为其会影响这个`dom`是否渲染，形成前置条件。

```js

```

## genChildren()——处理子元素

用该方法来处理`el`元素的所有子节点，会根据是否指定`altGenNode()`函数来决定采取何种函数来处理渲染函数。

```js
function genChildren(
    el: ASTElement,
    state: CodegenState,
    checkSkip ? : boolean,
    altGenElement ? : Function,
    altGenNode ? : Function
): string | void {
    const children = el.children;

    // 前提存在子节点
    if (children.length) {
        const el: any = children[0];

        // optimize single v-for
        // 优化单独的v-for节点
        if (children.length === 1 &&
            el.for &&
            el.tag !== 'template' &&
            el.tag !== 'slot'
        ) {

            // 确定标准化的类型，默认情况不指定类型；
            const normalizationType = checkSkip ?
                (state.maybeComponent(el) ? `,1` : `,0`) : ``;

            // 调用altGemElement或genElement继续对其他属性进行优化
            return `${(altGenElement || genElement)(el, state)}${normalizationType}`
        }

        // 具有多个子节点时的标准化类型
        const normalizationType = checkSkip ?
            getNormalizationType(children, state.maybeComponent) : 0;

        // 未指定时，使用默认的生成函数
        const gen = altGenNode || genNode;

        // 分别对每个子节点调用生成函数，组成render函数
        return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''}`
    }
}
```

最终结果为`[子元素返回的函数], 标准化类型`或`[子元素返回的函数]`

## genDirectives()——生成指令对象

该函数用于处理指令语法来生成一个数组字符串的指令对象的副本，过程比较简单，中间涉及了几个之前的原生指令函数。

```js
function genDirectives(el: ASTElement, state: CodegenState): string | void {
    const dirs = el.directives;
    if (!dirs) return;
    let res = 'directives:['
    let hasRuntime = false;
    let i, l, dir, needRuntime;
    for (i = 0, l = dirs.length; i < l; i++) {
        dir = dirs[i];
        needRuntime = true;

        // 匹配原生指令
        const gen: DirectiveFunction = state.directives[dir.name];
        if (gen) {
            // compile-time directive that manipulates AST.
            // returns true if it also needs a runtime counterpart.
            // 操作AST的编译时的指令，返回true表示仍需要运行时的副本
            needRuntime = !!gen(el, dir, state.warn);
        }


        if (needRuntime) {
            hasRuntime = true;

            // 每次循环的res的结果为 {...指令属性},  分隔
            res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
                dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
            }${
                dir.arg ? `,arg:${dir.isDynamicArg ? dir.arg : `"${dir.arg}"`}` : ''
                    }${
                dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
            }},`;
        }
    }
    if (hasRuntime) {

        // 返回全部指令对象组成的数组字符串
        return res.slice(0, -1) + ']';
    }
}
```