/* @flow */

import type Watcher from './watcher'
import {
    remove
} from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 一个观察者对象队列, 用于更新watcher
 */
export default class Dep {
    static target: ? Watcher;

    // 依赖项的uid
    id: number;

    // 观察此依赖项的Watcher们
    subs: Array < Watcher > ;

    constructor() {
        this.id = uid++
        this.subs = []
    }

    addSub(sub: Watcher) {

        // 将观察该依赖项的观察者添加至数组中
        this.subs.push(sub)
    }

    removeSub(sub: Watcher) {

        // 从数组中移除该观察者
        remove(this.subs, sub);
    }

    depend() {

        // 将该依赖项添加到观察者对象的依赖项数组中Watcher的API
        if (Dep.target) {
            Dep.target.addDep(this)
        }
    }

    notify() {

        // stabilize the subscriber list first
        // 浅复制观察者数组，防止影响原数组
        const subs = this.subs.slice()
        if (process.env.NODE_ENV !== 'production' && !config.async) {
            // subs aren't sorted in scheduler if not running async
            // we need to sort them now to make sure they fire in correct
            // order
            // 在异步时需要对sub进行排序, 因为它们会乱序，
            // 要保证它们的更新是从父到子(即Watcher的创建顺序)
            subs.sort((a, b) => a.id - b.id)
        }

        // 通知观察者们更新
        for (let i = 0, l = subs.length; i < l; i++) {
            subs[i].update();
        }
    }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 当前进行依赖收集的Watcher
Dep.target = null
const targetStack = []

// 将当前Watcher作为依赖项收集目标
export function pushTarget(target: ? Watcher) {
    targetStack.push(target)
    Dep.target = target
}

// 弹出栈中最上层的Watcher
export function popTarget() {
    targetStack.pop();
    Dep.target = targetStack[targetStack.length - 1]
}