/* @flow */

/**
 * Runtime helper for rendering static trees.
 */
export function renderStatic(

    // 静态render数组中的坐标
    index: number,
    isInFor: boolean
): VNode | Array < VNode > {

    // 缓存生成的静态根节点生成的Vnode片段的结构
    const cached = this._staticTrees || (this._staticTrees = []);

    // 有缓存则直接使用
    let tree = cached[index];

    // if has already-rendered static tree and not inside v-for,
    // we can reuse the same tree.
    // 有缓存，且不再v-for中，则复用之前的
    if (tree && !isInFor) {
        return tree
    }

    // otherwise, render a fresh tree.
    // 否则渲染一个新的Vnode片段
    // 取出对应的静态渲染函数进行渲染
    tree = cached[index] = this.$options.staticRenderFns[index].call(

        // vue实例的代理对象
        this._renderProxy,
        null,

        // 用于为functional组件模版生成渲染函数
        this // for render fns generated for functional component templates
    );

    // 为该Vnode片段的节点添加静态属性标记
    markStatic(tree, `__static__${index}`, false);
    return tree;
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 */
export function markOnce(
    tree: VNode | Array < VNode > ,
    index: number,
    key: string
) {
    markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
    return tree
}

function markStatic(
    tree: VNode | Array < VNode > ,
    key: string,
    isOnce: boolean
) {
    // 遍历该树片段，为所有元素节点添加静态节点标记
    if (Array.isArray(tree)) {
        for (let i = 0; i < tree.length; i++) {
            if (tree[i] && typeof tree[i] !== 'string') {
                markStaticNode(tree[i], `${key}_${i}`, isOnce)
            }
        }
    } else {
        markStaticNode(tree, key, isOnce)
    }
}

function markStaticNode(node, key, isOnce) {
    node.isStatic = true
    node.key = key
    node.isOnce = isOnce
}