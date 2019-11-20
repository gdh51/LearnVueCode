/* @flow */

import config from 'core/config'
import {
    warn,
    cached
} from 'core/util/index'
import {
    mark,
    measure
} from 'core/util/perf'

import Vue from './runtime/index'
import {
    query
} from './util/index'
import {
    compileToFunctions
} from './compiler/index'
import {
    shouldDecodeNewlines,
    shouldDecodeNewlinesForHref
} from './util/compat'

const idToTemplate = cached(id => {
    const el = query(id)
    return el && el.innerHTML
})

// 这是之前的mount方法
const mount = Vue.prototype.$mount

// 重写mount方法
Vue.prototype.$mount = function (
    el ? : string | Element,
    hydrating ? : boolean
): Component {

    // 获取真实的dom元素
    el = el && query(el);

    if (el === document.body || el === document.documentElement) {
        process.env.NODE_ENV !== 'production' && warn(
            `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
        )
        return this;
    }

    const options = this.$options;

    // resolve template/el and convert to render function
    // 将模版转换为render函数
    if (!options.render) {

        // 获取模版
        let template = options.template;

        // 各种方式获取字符串模版(下面的if/else语句都是)
        if (template) {
            if (typeof template === 'string') {
                if (template.charAt(0) === '#') {
                    template = idToTemplate(template);

                    if (process.env.NODE_ENV !== 'production' && !template) {
                        warn(
                            `Template element not found or is empty: ${options.template}`,
                            this
                        )
                    }
                }

            // 当模版为真实元素时，获取其内容的字符串
            } else if (template.nodeType) {
                template = template.innerHTML;

            // 报错否则
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    warn('invalid template option:' + template, this)
                }
                return this;
            }

        // 如果是直接写在DOM中的，那么获取书写的dom的字符串表达式
        } else if (el) {
            template = getOuterHTML(el);
        }

        if (template) {

            // 给编译过程过一个时间标记
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile')
            }

            // 将模版编译为render函数
            const {
                render,
                staticRenderFns
            } = compileToFunctions(template, {
                outputSourceRange: process.env.NODE_ENV !== 'production',
                shouldDecodeNewlines,
                shouldDecodeNewlinesForHref,
                delimiters: options.delimiters,
                comments: options.comments
            }, this);
            options.render = render
            options.staticRenderFns = staticRenderFns

            // 记录编译的性能情况
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile end')
                measure(`vue ${this._name} compile`, 'compile', 'compile end')
            }
        }
    }

    return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {

    // 支持outerHTML属性时，直接调用
    if (el.outerHTML) {
        return el.outerHTML

    // 不支持时，包装下，通过innerHTML获取
    } else {
        const container = document.createElement('div');
        container.appendChild(el.cloneNode(true));
        return container.innerHTML
    }
}

Vue.compile = compileToFunctions

export default Vue