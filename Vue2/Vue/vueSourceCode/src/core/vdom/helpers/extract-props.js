/* @flow */

import {
    tip,
    hasOwn,
    isDef,
    isUndef,
    hyphenate,
    formatComponentName
} from 'core/util/index'

export function extractPropsFromVNodeData(
    data: VNodeData,
    Ctor: Class < Component > ,
    tag ? : string
): ? Object {
    // we are only extracting raw values here.
    // validation and default values are handled in the child
    // component itself.
    // 这里只提取原始值，效验器和默认值的处理会在initState处理

    // 取出组件中定义的prop
    const propOptions = Ctor.options.props;
    if (isUndef(propOptions)) {
        return;
    }
    const res = {};

    // 取出元素的attribute，这里的porps占时未知来自于哪里
    const {
        attrs,
        props
    } = data;
    if (isDef(attrs) || isDef(props)) {
        for (const key in propOptions) {

            // 连接符化prop的键名
            const altKey = hyphenate(key);

            // 开发模式下，如果prop中包含大写字母，则提示
            if (process.env.NODE_ENV !== 'production') {
                const keyInLowerCase = key.toLowerCase()
                if (
                    key !== keyInLowerCase &&
                    attrs && hasOwn(attrs, keyInLowerCase)
                ) {
                    tip(
                        `Prop "${keyInLowerCase}" is passed to component ` +
                        `${formatComponentName(tag || Ctor)}, but the declared prop name is` +
                        ` "${key}". ` +
                        `Note that HTML attributes are case-insensitive and camelCased ` +
                        `props need to use their kebab-case equivalents when using in-DOM ` +
                        `templates. You should probably use "${altKey}" instead of "${key}".`
                    )
                }
            }

            // 优先取处理props，没有则处理attrs
            checkProp(res, props, key, altKey, true) || checkProp(res, attrs, key, altKey, false)
        }
    }
    return res
}

function checkProp(

    // 结果
    res: Object,

    // 元素属性对象
    hash: ? Object,
    key : string,

    // key连接符化后的值
    altKey: string,

    // 是否保留该属性的由来
    preserve: boolean
) : boolean {

    // 存在property，优先按模版中定义的名称添加到最终结果
    if (isDef(hash)) {
        if (hasOwn(hash, key)) {
            res[key] = hash[key]
            if (!preserve) {
                delete hash[key]
            }
            return true;
        } else if (hasOwn(hash, altKey)) {
            res[key] = hash[altKey]
            if (!preserve) {
                delete hash[altKey]
            }
            return true;
        }
    }
    return false;
}