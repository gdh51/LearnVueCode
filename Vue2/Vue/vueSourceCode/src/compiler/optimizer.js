/* @flow */

import {
    makeMap,
    isBuiltInTag,
    cached,
    no
} from 'shared/util'

let isStaticKey
let isPlatformReservedTag

// 存储取值函数，注意这里缓存的是这个函数
const genStaticKeysCached = cached(genStaticKeys);

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
export function optimize(root: ? ASTElement, options : CompilerOptions) {
    if (!root) return;

    // 返回静态字段key的检查表
    isStaticKey = genStaticKeysCached(options.staticKeys || '');

    // 是否为原生标签
    isPlatformReservedTag = options.isReservedTag || no;

    // first pass: mark all non-static nodes.
    // 第一次遍历：标记所有的非静态节点
    markStatic(root);

    // second pass: mark static roots.
    // 第二次遍历：标记根静态节点
    markStaticRoots(root, false)
}

// 返回一个map表用于检查是否存在该字段，可以自定义一些字段
function genStaticKeys(keys: string): Function {
    return makeMap(
        'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
        (keys ? ',' + keys : '')
    )
}

function markStatic(node: ASTNode) {

    // 检查是否为静态节点
    node.static = isStatic(node);

    // 为元素节点时
    if (node.type === 1) {

        // do not make component slot content static. this avoids
        // 1. components not able to mutate slot nodes
        // 2. static slot content fails for hot-reloading
        // 不要把组件的插槽内容静态化
        if (
            // 非原生元素
            !isPlatformReservedTag(node.tag) &&

            // 非slot元素
            node.tag !== 'slot' &&

            // 非内联模版
            node.attrsMap['inline-template'] == null
        ) {
            return;
        }

        for (let i = 0, l = node.children.length; i < l; i++) {
            const child = node.children[i]
            markStatic(child)

            // 子节点为非静态节点时，父节点也不能是
            if (!child.static) {
                node.static = false;
            }
        }

        // 同样对显示条件块中的元素进行检查
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                const block = node.ifConditions[i].block
                markStatic(block);
                if (!block.static) {
                    node.static = false
                }
            }
        }
    }
}

function markStaticRoots(node: ASTNode, isInFor: boolean) {
    if (node.type === 1) {

        // 静态节点或具有v-once
        if (node.static || node.once) {

            // 该节点是否在v-for中
            node.staticInFor = isInFor;
        }

        // For a node to qualify as a static root, it should have children that
        // are not just static text. Otherwise the cost of hoisting out will
        // outweigh the benefits and it's better off to just always render it fresh.
        // 如果一个节点为静态节点，那么其子节点不能仅仅是个静态文本节点，不然用于存储的损耗就大于它带来的收益
        // 节点为静态节点，并有多个子节点
        if (node.static && node.children.length && !(
                node.children.length === 1 &&
                node.children[0].type === 3
            )) {
            node.staticRoot = true
            return;

        // 仅一个子节点且为文本
        } else {
            node.staticRoot = false
        }

        // 遍历子节点查询是否为根静态节点
        if (node.children) {
            for (let i = 0, l = node.children.length; i < l; i++) {
                markStaticRoots(node.children[i], isInFor || !!node.for)
            }
        }

        // 同样的遍历if条件块
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                markStaticRoots(node.ifConditions[i].block, isInFor)
            }
        }
    }
}

// 是pre元素，或其他符合规定的元素
function isStatic(node: ASTNode): boolean {

    // 属性节点，在这里即我们的插值绑定时
    if (node.type === 2) { // expression
        return false
    }

    // 文本节点，为静态节点
    if (node.type === 3) { // text
        return true
    }

    //
    return !!(node.pre || (

        // 无动态绑定属性
        !node.hasBindings && // no dynamic bindings

        // 无v-if和v-for
        !node.if && !node.for && // not v-if or v-for or v-else

        // 非slot或component标签
        !isBuiltInTag(node.tag) && // not a built-in

        // 原生标签
        isPlatformReservedTag(node.tag) && // not a component

        // 是否为v-for模版元素的直接子元素(即中间可以存在其他子元素，但也要为模版)
        !isDirectChildOfTemplateFor(node) &&

        // 节点中每个属性都为静态键，即没有其他多余的指令
        Object.keys(node).every(isStaticKey)
    ))
}

function isDirectChildOfTemplateFor(node: ASTElement): boolean {


    while (node.parent) {
        node = node.parent;

        // 标签不是模版直接返回false
        if (node.tag !== 'template') {
            return false;
        }

        // 模版具有for时才返回true
        if (node.for) {
            return true;
        }
    }
    return false;
}