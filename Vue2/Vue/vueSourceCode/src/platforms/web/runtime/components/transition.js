/* @flow */

// Provides transition support for a single element/component.
// supports transition mode (out-in / in-out)

import {
    warn
} from 'core/util/index'
import {
    camelize,
    extend,
    isPrimitive
} from 'shared/util'
import {
    mergeVNodeHook,
    isAsyncPlaceholder,
    getFirstComponentChild
} from 'core/vdom/helpers/index'

export const transitionProps = {
    name: String,
    appear: Boolean,
    css: Boolean,
    mode: String,
    type: String,
    enterClass: String,
    leaveClass: String,
    enterToClass: String,
    leaveToClass: String,
    enterActiveClass: String,
    leaveActiveClass: String,
    appearClass: String,
    appearActiveClass: String,
    appearToClass: String,
    duration: [Number, String, Object]
}

// in case the child is also an abstract component, e.g. <keep-alive>
// we want to recursively retrieve the real component to be rendered
// 为了防止子节点也是一个抽象组件，我们通过递归来找到一个真实的组件
function getRealChild(vnode: ? VNode): ? VNode {

    // 该Vnode组件是否具有组件配置属性
    const compOptions: ? VNodeComponentOptions = vnode && vnode.componentOptions;

    // 具有组件配置属性，且其为抽象组件，比如<keep-alive>组件
    if (compOptions && compOptions.Ctor.options.abstract) {

        // 递归调用该函数获取其<keep-alive>中组件中的非抽象根节点
        return getRealChild(getFirstComponentChild(compOptions.children))
    } else {

        // 没有则直接返回，说明其为个元素节点或真实组件
        return vnode
    }
}

export function extractTransitionData(comp: Component) : Object {
    const data = {};
    const options: ComponentOptions = comp.$options

    // props
    // 将transition组件上全部属性提取到data中
    for (const key in options.propsData) {
        data[key] = comp[key]
    }

    // events.
    // extract listeners and pass them directly to the transition methods
    // 将其上的事件监听器按驼峰式也添加进data中
    const listeners: ? Object = options._parentListeners
    for (const key in listeners) {
        data[camelize(key)] = listeners[key]
    }
    return data
}

function placeholder(h: Function, rawChild: VNode): ? VNode {

    // 如果当前根节点为keep-alive节点，那么创建一个keep-alive元素
    if (/\d-keep-alive$/.test(rawChild.tag)) {
        return h('keep-alive', {
            props: rawChild.componentOptions.propsData
        })
    }
}

function hasParentTransition(vnode: VNode) : ? boolean {

    // 取当前组件中模版根节点的组件VNode节点，
    // 这里即唯有组件的根节点才有parent属性，且该属性表示其组件的VNode
    while ((vnode = vnode.parent)) {

        // 该组件节点也处于<transition>节点中
        if (vnode.data.transition) {
            return true
        }
    }
}

function isSameChild(child: VNode, oldChild: VNode) : boolean {
    return oldChild.key === child.key && oldChild.tag === child.tag
}

// 不为文本节点
const isNotTextNode = (c: VNode) => c.tag || isAsyncPlaceholder(c)

const isVShowDirective = d => d.name === 'show'

export default {
    name: 'transition',
    props: transitionProps,
    abstract: true,

    render(h: Function) {

        // 提出插入<transition>组件中的子节点们
        let children: any = this.$slots.default;

        // 没有则直接返回
        if (!children) {
            return
        }

        // filter out text nodes (possible whitespaces)
        // 过滤掉文本节点
        children = children.filter(isNotTextNode)

        // 如果没有则也直接退出
        if (!children.length) {
            return
        }

        // warn multiple elements
        // 禁止有多个根节点，多个根节点请用<transition-group>
        if (process.env.NODE_ENV !== 'production' && children.length > 1) {
            warn(
                '<transition> can only be used on a single element. Use ' +
                '<transition-group> for lists.',
                this.$parent
            )
        }

        // 提取过渡模式
        const mode: string = this.mode

        // warn invalid mode
        // 提示无效的mode值
        if (process.env.NODE_ENV !== 'production' &&
            mode && mode !== 'in-out' && mode !== 'out-in'
        ) {
            warn(
                'invalid <transition> mode: ' + mode,
                this.$parent
            )
        }

        // 取出未处理的根节点VNode
        const rawChild: VNode = children[0]

        // if this is a component root node and the component's
        // parent container node also has transition, skip.
        // 如果该<transition>处于被另一个<transition>包含的组件中，
        // 则不处理当前的这个<transition>组件，直接返回其子节点
        if (hasParentTransition(this.$vnode)) {
            return rawChild
        }

        // apply transition data to child
        // 将transition的数据添加到其根节点上(忽略中间忽略组件)
        // use getRealChild() to ignore abstract components e.g. keep-alive
        // 调用getRealChild()来忽略keep-alive组件，取其子组件VNode
        const child: ? VNode = getRealChild(rawChild)

        // 如果没有，则直接keep-alive节点
        if (!child) {
            return rawChild
        }

        // 如果当前组件正在执行离开过渡，
        if (this._leaving) {

            // 如果过渡组件的根元素为keep-alive，那么创建一个节点代替
            return placeholder(h, rawChild)
        }

        // ensure a key that is unique to the vnode type and to this transition
        // component instance. This key will be used to remove pending leaving nodes
        // during entering.
        // 确保有一个基于节点类型和过渡组件实例的唯一key值。
        // 它会被用来再次执行进入动画时移除之前等待离开动画的节点
        const id: string = `__transition-${this._uid}-`;

        // key值是否存在
        child.key = child.key == null ?

            // 不存在key值时，按是否为注释节点取key值
            (child.isComment ? id + 'comment' : id + child.tag ):

            // 存在key值时，先查看key值是否为原始值
            (isPrimitive(child.key) ?

            // 为原始值时，查看其是否具有id，没有则添加上，有则取原值
            (String(child.key).indexOf(id) === 0 ? child.key : id + child.key) :

            // 不为原始值时直接使用
            child.key);

        // 将transition上的属性(包括事件监听器)提取到其根节点上
        const data: Object = (child.data || (child.data = {})).transition = extractTransitionData(this)

        // 该过渡组件上一个根节点VNode
        const oldRawChild: VNode = this._vnode;

        // 提取之前的真实根节点
        const oldChild: VNode = getRealChild(oldRawChild)

        // mark v-show
        // so that the transition module can hand over the control to the directive
        // 标记v-show，这样过渡组件就可以将过渡的控制权转交给v-show指令了
        if (child.data.directives && child.data.directives.some(isVShowDirective)) {
            child.data.show = true
        }

        // 如果存在旧节点
        if (
            oldChild &&
            oldChild.data &&

            // 且它们不为同一节点
            !isSameChild(child, oldChild) &&
            !isAsyncPlaceholder(oldChild) &&

            // #6687 component root is a comment node
            // 且旧的根节点不能为根节点为注释节点的组件节点
            !(oldChild.componentInstance && oldChild.componentInstance._vnode.isComment)
        ) {
            // replace old child transition data with fresh one
            // important for dynamic transitions!
            // 更新旧节点的data(对于动态过渡很重要)
            const oldData: Object = oldChild.data.transition = extend({}, data);

            // handle transition mode
            // 处理进出模式
            if (mode === 'out-in') {
                // return placeholder node and queue update when leave finishes
                this._leaving = true;
                mergeVNodeHook(oldData, 'afterLeave', () => {
                    this._leaving = false
                    this.$forceUpdate();
                });

                // 创建一个keep-alive节点代替它
                return placeholder(h, rawChild)
            } else if (mode === 'in-out') {
                if (isAsyncPlaceholder(child)) {
                    return oldRawChild
                }
                let delayedLeave
                const performLeave = () => {
                    delayedLeave()
                }
                mergeVNodeHook(data, 'afterEnter', performLeave)
                mergeVNodeHook(data, 'enterCancelled', performLeave)
                mergeVNodeHook(oldData, 'delayLeave', leave => {
                    delayedLeave = leave
                })
            }
        }

        // 返回根节点
        return rawChild;
    }
}