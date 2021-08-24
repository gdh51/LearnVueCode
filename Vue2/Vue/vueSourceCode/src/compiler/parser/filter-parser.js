/* @flow */

const validDivisionCharRE = /[\w).+\-_$\]]/

export function parseFilters(exp: string): string {

    // 是否在单引号中
    let inSingle = false;

    // 是否在双引号中
    let inDouble = false;

    // 模版字符串
    let inTemplateString = false;

    // 正则表达式
    let inRegex = false;

    // 特殊括号的栈
    let curly = 0;
    let square = 0;
    let paren = 0;

    // 上一个管道符的后一个字符的位置
    let lastFilterIndex = 0;
    let c, prev, i, expression, filters;

    for (i = 0; i < exp.length; i++) {

        // 上一个字符的ascii🐎
        prev = c;

        // 当前字符的ascii🐎
        c = exp.charCodeAt(i);

        // 留个问题，这里为什么要用十六进制
        // 为什么有些JS和CSS里面的中文字符要转成十六进制的？

        if (inSingle) {

            // c为 , prev 不为 \
            if (c === 0x27 && prev !== 0x5C) inSingle = false;
        } else if (inDouble) {

            // c 为 " ,prev 不为 \
            if (c === 0x22 && prev !== 0x5C) inDouble = false;
        } else if (inTemplateString) {

            // c 为 `,prev不为\
            if (c === 0x60 && prev !== 0x5C) inTemplateString = false;
        } else if (inRegex) {

            // c 为 / ,prev不为\
            if (c === 0x2f && prev !== 0x5C) inRegex = false;
        } else if (

            // c为 |(管道符), 而c前后的字符不为管道符，且无任何括号符号时
            c === 0x7C && // pipe
            exp.charCodeAt(i + 1) !== 0x7C &&
            exp.charCodeAt(i - 1) !== 0x7C &&
            !curly && !square && !paren
        ) {
            // 第一次遇到|时，创建新的管道符表达式
            if (expression === undefined) {

                // first filter, end of expression
                // 最后一个管道符号的位置的后一个符号
                lastFilterIndex = i + 1;

                // 截取管道符左侧的表达式
                expression = exp.slice(0, i).trim()
            } else {

                // 已存在时, 更新lastFilterIndex，然后将新的表达式加入队列中
                pushFilter()
            }
        } else {

            // 处理其他情况
            switch (c) {
                case 0x22:
                    inDouble = true;
                    break // "
                case 0x27:
                    inSingle = true;
                    break // '
                case 0x60:
                    inTemplateString = true;
                    break // `
                case 0x28:
                    paren++;
                    break // (
                case 0x29:
                    paren--;
                    break // )
                case 0x5B:
                    square++;
                    break // [
                case 0x5D:
                    square--;
                    break // ]
                case 0x7B:
                    curly++;
                    break // {
                case 0x7D:
                    curly--;
                    break // }
            }

            if (c === 0x2f) { // /
                let j = i - 1;
                let p;

                // find first non-whitespace prev char
                // 找到前面第一个非空格字符
                for (; j >= 0; j--) {
                    p = exp.charAt(j);
                    if (p !== ' ') break
                }

                // 未找到p或不匹配任何字符符号时
                if (!p || !validDivisionCharRE.test(p)) {

                    // 正则表达式
                    inRegex = true;
                }
            }
        }
    }

    // 未有表达式时，则整个字符串就是表达式
    if (expression === undefined) {
        expression = exp.slice(0, i).trim();

    // 之前有表达式，所以最后还要截取下最后的表达式
    } else if (lastFilterIndex !== 0) {
        pushFilter()
    }

    function pushFilter() {

        // 取当上一个管道符到现在管道符直接的表达式
        (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim());
        lastFilterIndex = i + 1;
    }

    // 多个表达式时，逐个包装表达式
    if (filters) {
        for (i = 0; i < filters.length; i++) {
            expression = wrapFilter(expression, filters[i])
        }
    }

    // 最后结果为 _fn("fnName")(arguments)
    return expression;
}

function wrapFilter(exp: string, filter: string): string {
    const i = filter.indexOf('(');

    // 存入表达式不存在()时，直接包装返回
    if (i < 0) {
        // _f: resolveFilter
        return `_f("${filter}")(${exp})`

    // 存入表达式存在()，即也是个函数调用时
    } else {

        // 函数名
        const name = filter.slice(0, i);

        // 函数有参数时，为 arg) 没有时就为 )
        const args = filter.slice(i + 1);

        // 将exp作为参数拼接在后面(如果传入的)
        return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
    }
}