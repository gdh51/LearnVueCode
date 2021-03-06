/* @flow */

import Vue from 'core/index'
import config from 'core/config'
import {
    extend,
    noop
} from 'shared/util'
import {
    mountComponent
} from 'core/instance/lifecycle'
import {
    devtools,
    inBrowser
} from 'core/util/index'

import {
    query,
    mustUseProp,
    isReservedTag,
    isReservedAttr,
    getTagNamespace,
    isUnknownElement
} from 'web/util/index'

import {
    patch
} from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
// 安装浏览器平台特殊的工具方法
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
// 安装浏览器平台运行时的指令和内部组件(transition/transition-group)
extend(Vue.options.directives, platformDirectives);
extend(Vue.options.components, platformComponents);

// install platform patch function
// 初始化平台的补丁函数，用于更新dom
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function (
    el ? : string | Element,
    hydrating ? : boolean
): Component {

    // 获取挂载的DOM元素
    el = el && inBrowser ? query(el) : undefined;

    // 解析组件
    return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
    setTimeout(() => {
        if (config.devtools) {
            if (devtools) {
                devtools.emit('init', Vue)
            } else if (
                process.env.NODE_ENV !== 'production' &&
                process.env.NODE_ENV !== 'test'
            ) {
                console[console.info ? 'info' : 'log'](
                    'Download the Vue Devtools extension for a better development experience:\n' +
                    'https://github.com/vuejs/vue-devtools'
                )
            }
        }
        if (process.env.NODE_ENV !== 'production' &&
            process.env.NODE_ENV !== 'test' &&
            config.productionTip !== false &&
            typeof console !== 'undefined'
        ) {
            console[console.info ? 'info' : 'log'](
                `You are running Vue in development mode.\n` +
                `Make sure to turn on production mode when deploying for production.\n` +
                `See more tips at https://vuejs.org/guide/deployment.html`
            )
        }
    }, 0);
}

export default Vue