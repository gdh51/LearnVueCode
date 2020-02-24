/* @flow */

import {
    warn,
    remove,
    isObject,
    parsePath,
    _Set as Set,
    handleError,
    noop
} from '../util/index'

import {
    traverse
} from './traverse'
import {
    queueWatcher
} from './scheduler'
import Dep, {
    pushTarget,
    popTarget
} from './dep'

import type {
    SimpleSet
} from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * 一个观察者解析一个表达式，收集依赖项，并在表达式的返回值改变时触发回调函数
 */
export default class Watcher {
    vm: Component;

    // 当为computed属性时，该值为函数，表示computed的求值表达式
    // 当为watch属性时，该值表示watch的名称字符串
    expression: string;
    cb: Function;
    id: number;

    // watch的特有属性，用于是否深度监听
    deep: boolean;

    // watch的特有属性，用于执行回调函数
    user: boolean;

    // 计算属性特有属性，是否延迟Watcher的求值
    lazy: boolean;
    sync: boolean;

    // 是否允许允许Watcher进行表达式计算
    dirty: boolean;

    // 渲染Watcher的特有属性，表示当前组件是否活跃
    active: boolean;

    // 当前观察者对象依赖的依赖项
    deps: Array < Dep > ;
    newDeps: Array < Dep > ;
    depIds: SimpleSet;
    newDepIds: SimpleSet;

    // 渲染Watcher特有属性，当前Watcher在重新计算(更新)前调用的函数
    before: ? Function;
    getter: Function;
    value: any;

    constructor(
        vm: Component,
        expOrFn: string | Function,
        cb: Function,
        options ? : ? Object,
        isRenderWatcher ? : boolean
    ) {
        this.vm = vm

        // 是否为渲染watcher
        if (isRenderWatcher) {
            vm._watcher = this;
        }

        // 将Watcher加入vm上的_watchers数组
        vm._watchers.push(this);

        // options
        // 初始化配置
        if (options) {
            this.deep = !!options.deep;
            this.user = !!options.user;
            this.lazy = !!options.lazy;
            this.sync = !!options.sync;
            this.before = options.before;
        } else {

            // 未传入时默认为false
            this.deep = this.user = this.lazy = this.sync = false;
        }
        this.cb = cb;
        this.id = ++uid; // uid for batching
        this.active = true;
        this.dirty = this.lazy; // for lazy watchers
        this.deps = [];
        this.newDeps = [];
        this.depIds = new Set();
        this.newDepIds = new Set();
        this.expression = process.env.NODE_ENV !== 'production' ?
            expOrFn.toString() : '';

        // Watcher变动所涉及的函数
        // 这里即渲染Watcher的渲染函数或计算属性的计算函数
        if (typeof expOrFn === 'function') {
            this.getter = expOrFn;
        } else {

            // 当Watcher名为字符串时, 可以是.运算符指定对象的某个属性
            // getter为一个函数, 返回watch名所对应的属性(即监听函数)
            this.getter = parsePath(expOrFn);

            // 当存在不规范的定义时会报错
            if (!this.getter) {
                this.getter = noop
                process.env.NODE_ENV !== 'production' && warn(
                    `Failed watching path: "${expOrFn}" ` +
                    'Watcher only accepts simple dot-delimited paths. ' +
                    'For full control, use a function instead.',
                    vm
                )
            }
        }

        // 当前Watcher的值，当是computed时，延迟求值(即本次不求值)
        this.value = this.lazy ?
            undefined :
            this.get();
    }

    /**
     * Evaluate the getter, and re-collect dependencies.
     * 对getter进行一次求值，重新收集其依赖项
     */
    get() {

        // 将当前Watcher实例作为依赖的目标
        pushTarget(this);
        let value;
        const vm = this.vm;
        try {

            // 调用getter函数收集其中所需的依赖项
            value = this.getter.call(vm, vm);
        } catch (e) {
            if (this.user) {
                handleError(e, vm, `getter for watcher "${this.expression}"`);
            } else {
                throw e;
            }
        } finally {

            // "touch" every property so they are all tracked as
            // dependencies for deep watching
            // 在用户定义Watcher的deep属性时调用
            // 当为深度监听时, 遍历监听的属性, 添加其全部属性的depid
            if (this.deep) {
                traverse(value);
            }

            // 移除当前作为依赖的Watcher
            popTarget();

            // 清空旧的依赖项收集
            this.cleanupDeps();
        }
        return value;
    }

    /**
     * Add a dependency to this directive.
     */
    addDep(dep: Dep) {
        const id = dep.id
        if (!this.newDepIds.has(id)) {
            this.newDepIds.add(id)
            this.newDeps.push(dep)
            if (!this.depIds.has(id)) {
                dep.addSub(this)
            }
        }
    }

    /**
     * Clean up for dependency collection.
     */
    cleanupDeps() {
        let i = this.deps.length

        // 如果该旧的dep依赖项已不存在于新的deps队列，则要从旧的dep依赖项中移除该watcher
        while (i--) {

            // 取出旧的依赖项
            const dep = this.deps[i];

            // 当最新的依赖项队列已不存在该旧依赖项时，从该旧的依赖项移除该watcher
            if (!this.newDepIds.has(dep.id)) {
                dep.removeSub(this);
            }
        }

        // 替换新旧依赖项队列
        let tmp = this.depIds;
        this.depIds = this.newDepIds;

        // 这里是什么骚操作，没看懂
        this.newDepIds = tmp;
        this.newDepIds.clear();
        tmp = this.deps;

        // 这里又是什么骚操作，没看懂
        this.deps = this.newDeps;
        this.newDeps = tmp;
        this.newDeps.length = 0;
    }

    /**
     * Subscriber interface.
     * Will be called when a dependency changes.
     */
    update() {
        /* istanbul ignore else */
        if (this.lazy) {
            this.dirty = true
        } else if (this.sync) {
            this.run()
        } else {
            queueWatcher(this)
        }
    }

    /**
     * Scheduler job interface.
     * Will be called by the scheduler.
     */
    run() {
        if (this.active) {
            const value = this.get();
            if (
                value !== this.value ||
                // Deep watchers and watchers on Object/Arrays should fire even
                // when the value is the same, because the value may
                // have mutated.
                isObject(value) ||
                this.deep
            ) {
                // set new value
                const oldValue = this.value
                this.value = value
                if (this.user) {
                    try {
                        this.cb.call(this.vm, value, oldValue)
                    } catch (e) {
                        handleError(e, this.vm, `callback for watcher "${this.expression}"`)
                    }
                } else {
                    this.cb.call(this.vm, value, oldValue)
                }
            }
        }
    }

    /**
     * Evaluate the value of the watcher.
     * This only gets called for lazy watchers.
     * 计算Watcher的值，仅会被lazy Watcher调用
     */
    evaluate() {
        this.value = this.get();
        this.dirty = false;
    }

    /**
     * Depend on all deps collected by this watcher.
     */
    depend() {
        let i = this.deps.length
        while (i--) {
            this.deps[i].depend()
        }
    }

    /**
     * Remove self from all dependencies' subscriber list.
     */
    teardown() {
        if (this.active) {
            // remove self from vm's watcher list
            // this is a somewhat expensive operation so we skip it
            // if the vm is being destroyed.
            if (!this.vm._isBeingDestroyed) {
                remove(this.vm._watchers, this)
            }
            let i = this.deps.length
            while (i--) {
                this.deps[i].removeSub(this)
            }
            this.active = false
        }
    }
}