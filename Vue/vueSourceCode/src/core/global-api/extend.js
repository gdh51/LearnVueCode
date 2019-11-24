/* @flow */

import {
    ASSET_TYPES
} from 'shared/constants'
import {
    defineComputed,
    proxy
} from '../instance/state'
import {
    extend,
    mergeOptions,
    validateComponentName
} from '../util/index'

export function initExtend(Vue: GlobalAPI) {
    /**
     * Each instance constructor, including Vue, has a unique
     * cid. This enables us to create wrapped "child
     * constructors" for prototypal inheritance and cache them.
     */
    Vue.cid = 0
    let cid = 1

    /**
     * Class inheritance
     */
    Vue.extend = function (extendOptions: Object): Function {

        // 接收组件的配置对象
        extendOptions = extendOptions || {};

        // 父级构造函数
        const Super = this;

        // 父级的uuid
        const SuperId = Super.cid;

        // 查看当前组件配置是否已经生成过构造函数(这些构造函数对应对应的父级上下文对象)
        const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {});

        // 如果存在，那么直接取出
        if (cachedCtors[SuperId]) {
            return cachedCtors[SuperId]
        }

        // 获取组件名称，没有则沿用父级组件的名称
        const name = extendOptions.name || Super.options.name;
        if (process.env.NODE_ENV !== 'production' && name) {
            validateComponentName(name)
        }

        // 生成子组件的构造函数
        const Sub = function VueComponent(options) {
            this._init(options)
        };

        // 使子组件的构造函数继承父组件构造函数的方法
        Sub.prototype = Object.create(Super.prototype);
        Sub.prototype.constructor = Sub;
        Sub.cid = cid++;

        // 手动混合配置对象
        Sub.options = mergeOptions(
            Super.options,
            extendOptions
        );
        Sub['super'] = Super

        // For props and computed properties, we define the proxy getters on
        // the Vue instances at extension time, on the extended prototype. This
        // avoids Object.defineProperty calls for each instance created.
        // 对于props和computed属性，我们在其扩展期间就定义访问其值的getter，
        // 它避免了在实例被创建时`Object.defineProperty`被调用
        // 在sub.prototype上定义props与computed中的key值访问器
        if (Sub.options.props) {
            initProps(Sub)
        }
        if (Sub.options.computed) {
            initComputed(Sub)
        }

        // allow further extension/mixin/plugin usage
        // 添加允许进一步的扩展mixin和组件添加的方法
        Sub.extend = Super.extend
        Sub.mixin = Super.mixin
        Sub.use = Super.use

        // create asset registers, so extended classes
        // can have their private assets too.
        // 为每个构造函数创建私有的属性注册器
        ASSET_TYPES.forEach(function (type) {
            Sub[type] = Super[type]
        })

        // enable recursive self-lookup
        // 允许递归查询自己
        if (name) {
            Sub.options.components[name] = Sub
        }

        // keep a reference to the super options at extension time.
        // later at instantiation we can check if Super's options have
        // been updated.
        // 在扩展时间内，保存一个到父级option的引用，之后在实例化时，我们可以由此来确认
        // 父级的options是否更新

        // 父级options
        Sub.superOptions = Super.options;

        // 用户自定义部分的options
        Sub.extendOptions = extendOptions;

        // 混合后的子组件的options
        Sub.sealedOptions = extend({}, Sub.options);

        // cache constructor
        // 在当前组件构造函数中缓存当前vm实例上下文的构造函数
        cachedCtors[SuperId] = Sub;
        return Sub;
    }
}

// 拦截构造函数的prototype属性的这些key值，使其访问时直接访问其._props属性的该key值
function initProps(Comp) {
    const props = Comp.options.props
    for (const key in props) {
        proxy(Comp.prototype, `_props`, key);
    }
}

// 在构造函数上定义computed的getter与setter
function initComputed(Comp) {
    const computed = Comp.options.computed;
    for (const key in computed) {
        defineComputed(Comp.prototype, key, computed[key])
    }
}