/* @flow */

import {
    emptyNode
} from 'core/vdom/patch'
import {
    resolveAsset,
    handleError
} from 'core/util/index'
import {
    mergeVNodeHook
} from 'core/vdom/helpers/index'

export default {
    create: updateDirectives,
    update: updateDirectives,
    destroy: function unbindDirectives(vnode: VNodeWithData) {
        updateDirectives(vnode, emptyNode)
    }
}

function updateDirectives(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.directives || vnode.data.directives) {
        _update(oldVnode, vnode)
    }
}

function _update(oldVnode, vnode) {

    // 是否为初次创建指令
    const isCreate = oldVnode === emptyNode;

    // 是否为销毁Vnode上的指令
    const isDestroy = vnode === emptyNode;

    // 获取options中定义的指令对象
    const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
    const newDirs = normalizeDirectives(vnode.data.directives, vnode.context);

    // 延迟调用insert函数
    const dirsWithInsert = [];

    // 延迟调用的patch函数
    const dirsWithPostpatch = [];

    let key, oldDir, dir;
    for (key in newDirs) {
        oldDir = oldDirs[key];
        dir = newDirs[key];

        // 如果为新的指令，则执行其中定义的bind回调函数
        if (!oldDir) {

            // new directive, bind
            // 调用其bind函数
            callHook(dir, 'bind', vnode, oldVnode);

            // 是否有inserted函数,如果则占时推入数组
            if (dir.def && dir.def.inserted) {
                dirsWithInsert.push(dir)
            }
        } else {

            // existing directive, update
            // 如果是之前存在的指令，则更新
            dir.oldValue = oldDir.value;
            dir.oldArg = oldDir.arg;

            // 调用update的钩子函数
            callHook(dir, 'update', vnode, oldVnode)

            // 是否定义componentUpdated函数，有则推入postpatch数组
            if (dir.def && dir.def.componentUpdated) {
                dirsWithPostpatch.push(dir)
            }
        }
    }

    if (dirsWithInsert.length) {
        const callInsert = () => {
            for (let i = 0; i < dirsWithInsert.length; i++) {
                callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
            }
        };

        // 初次渲染时
        if (isCreate) {

            // 将所有的insert函数，混入VNode生命周期钩子的insert中，待插入节点时调用。
            mergeVNodeHook(vnode, 'insert', callInsert);

        // 如果不是初次渲染则直接调用这些insert钩子函数
        } else {
            callInsert();
        }
    }

    if (dirsWithPostpatch.length) {

        // 将这些组件更新钩子函数，混入组件声明周期的postpatch中
        mergeVNodeHook(vnode, 'postpatch', () => {
            for (let i = 0; i < dirsWithPostpatch.length; i++) {
                callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
            }
        })
    }

    // 当该指令已经不存在于最新的节点时，调用unbind钩子函数
    if (!isCreate) {
        for (key in oldDirs) {
            if (!newDirs[key]) {

                // no longer present, unbind
                callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
            }
        }
    }
}

const emptyModifiers = Object.create(null);

function normalizeDirectives(
    dirs: ? Array < VNodeDirective > ,
    vm : Component
): {
    [key: string]: VNodeDirective
} {
    const res = Object.create(null)
    if (!dirs) {
        return res
    }

    let i, dir;

    // 对所有的指令查询其options中定义的对象
    for (i = 0; i < dirs.length; i++) {
        dir = dirs[i];

        // 是否有修饰符，没有则挂载一个空的修饰符对象
        if (!dir.modifiers) {

            dir.modifiers = emptyModifiers
        }

        // 获取指令未处理前名称
        res[getRawDirName(dir)] = dir;

        // 获取该vm组件中的指令对象(即我们自己定义的那一坨)
        dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
    }

    // 返回处理后的指令对象map
    return res;
}

function getRawDirName(dir: VNodeDirective): string {

    // 获取用户定义在模版中的指令的原名称(有修饰符时还要将修饰符添加进去)
    return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`;
}

function callHook(dir, hook, vnode, oldVnode, isDestroy) {

    // 获取对应hook的函数
    const fn = dir.def && dir.def[hook];

    // 如果存在，则调用，传入5个参数
    if (fn) {
        try {
            fn(vnode.elm, dir, vnode, oldVnode, isDestroy);
        } catch (e) {

            // 发生错误处理报错
            handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
        }
    }
}