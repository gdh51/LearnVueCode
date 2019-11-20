/* @flow */

import {
    noop,
    extend
} from 'shared/util'
import {
    warn as baseWarn,
    tip
} from 'core/util/debug'
import {
    generateCodeFrame
} from './codeframe'

type CompiledFunctionResult = {
    render: Function;
    staticRenderFns: Array < Function > ;
};

function createFunction(code, errors) {
    try {
        return new Function(code)
    } catch (err) {
        errors.push({
            err,
            code
        })
        return noop
    }
}

export function createCompileToFunctionFn(compile: Function): Function {
    const cache = Object.create(null)

    return function compileToFunctions(
        template: string,
        options ? : CompilerOptions,
        vm ? : Component
    ): CompiledFunctionResult {
        options = extend({}, options);

        // 取出自定义报错或内置的报错函数
        const warn = options.warn || baseWarn;
        delete options.warn;

        if (process.env.NODE_ENV !== 'production') {

            // detect possible CSP restriction
            // 检查可能的CSP限制无法使用eval函数，因为其会限制所有内联脚本
            try {
                new Function('return 1')
            } catch (e) {
                if (e.toString().match(/unsafe-eval|CSP/)) {
                    warn(
                        'It seems you are using the standalone build of Vue.js in an ' +
                        'environment with Content Security Policy that prohibits unsafe-eval. ' +
                        'The template compiler cannot work in this environment. Consider ' +
                        'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
                        'templates into render functions.'
                    )
                }
            }
        }

        // check cache
        // 缓存插值括号和模版
        const key = options.delimiters ?
            String(options.delimiters) + template :
            template;

        // 获取已解析的渲染函数的缓存
        if (cache[key]) {
            return cache[key];
        }

        // compile编译
        const compiled = compile(template, options)

        // check compilation errors/tips
        // 检查编译阶段的错误和提示，然后报错
        if (process.env.NODE_ENV !== 'production') {
            if (compiled.errors && compiled.errors.length) {
                if (options.outputSourceRange) {
                    compiled.errors.forEach(e => {
                        warn(
                            `Error compiling template:\n\n${e.msg}\n\n` +
                            generateCodeFrame(template, e.start, e.end),
                            vm
                        )
                    })
                } else {
                    warn(
                        `Error compiling template:\n\n${template}\n\n` +
                        compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
                        vm
                    )
                }
            }
            if (compiled.tips && compiled.tips.length) {
                if (options.outputSourceRange) {
                    compiled.tips.forEach(e => tip(e.msg, vm))
                } else {
                    compiled.tips.forEach(msg => tip(msg, vm))
                }
            }
        }

        // turn code into functions
        // 将编译阶段的字符串片段转换为函数
        const res = {};
        const fnGenErrors = [];
        res.render = createFunction(compiled.render, fnGenErrors);
        res.staticRenderFns = compiled.staticRenderFns.map(code => {
            return createFunction(code, fnGenErrors)
        })

        // check function generation errors.
        // this should only happen if there is a bug in the compiler itself.
        // mostly for codegen development use
        // 检查生成函数时的错误，它只会发生在compiler函数自身就有错误(即不是用户的锅)
        if (process.env.NODE_ENV !== 'production') {
            if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
                warn(
                    `Failed to generate render function:\n\n` +
                    fnGenErrors.map(({
                        err,
                        code
                    }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
                    vm
                )
            }
        }

        // 缓存编译结果
        return (cache[key] = res);
    }
}