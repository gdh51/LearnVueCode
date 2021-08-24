/* @flow */

import type Watcher from './watcher'
import config from '../config'
import {
    callHook,
    activateChildComponent
} from '../instance/lifecycle'

import {
    warn,
    nextTick,
    devtools,
    inBrowser,
    isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array < Watcher > = []
const activatedChildren: Array < Component > = []
let has: {
    [key: number]: ? true
} = {}
let circular: {
    [key: number]: number
} = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState() {
    index = queue.length = activatedChildren.length = 0
    has = {}
    if (process.env.NODE_ENV !== 'production') {
        circular = {}
    }
    waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
// 异步边缘情况。需要保存一个timestamp当事件监听器被添加时。但是调用performance.now()会有
// 性能开销，尤其是当页面有很多事件监听器时。所以，我们在每一次更新队列时
// 取一个时间戳来代表那次刷新中的所有的事件监听器的添加
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now();

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// 决定浏览器使用哪种时间戳，比较麻烦的是，时间戳可以是高精度的，也可能是低精度的。
// 所以为便于比较，需要保持它们的精度一致
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
// IE浏览器全部使用低精度的事件时间戳，并且其时间的实现存在问题
if (inBrowser && !isIE) {
    const performance = window.performance
    if (
        performance &&
        typeof performance.now === 'function' &&
        getNow() > document.createEvent('Event').timeStamp
    ) {
        // if the event timestamp, although evaluated AFTER the Date.now(), is
        // smaller than it, it means the event is using a hi-res timestamp,
        // and we need to use the hi-res version for event listener timestamps as
        // well.
        // 如果事件时间戳(虽然在Date.now()后开始计算)比它小，那就意味着事件在使用高分辨率的
        // 时间戳，所以我们也必须要用高分辨率的时间戳。
        getNow = () => performance.now()
    }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue() {

    // 获取当前更新的时间(该时间用于处理BUG)
    currentFlushTimestamp = getNow();

    // 更新刷新队列的状态为正在更新
    flushing = true;
    let watcher, id

    // Sort queue before flush.
    // This ensures that:
    // 1. Components are updated from parent to child. (because parent is always
    //    created before the child)
    // 组件按父——>子的顺序更新
    // 2. A component's user watchers are run before its render watcher (because
    //    user watchers are created before the render watcher)
    // 用户自定义的watch会在渲染watcher调用
    // 3. If a component is destroyed during a parent component's watcher run,
    //    its watchers can be skipped.
    // 当一个组件在其父级watcher运行时销毁了，那么直接跳过
    queue.sort((a, b) => a.id - b.id)

    // do not cache length because more watchers might be pushed
    // as we run existing watchers
    // 动态计算队列长度，因为可能会有新的watcher在更新时加入
    for (index = 0; index < queue.length; index++) {
        watcher = queue[index];

        // 触发渲染函数的beforeUpdate回调函数
        if (watcher.before) {
            watcher.before()
        }
        id = watcher.id;

        // 清楚状态，允许当前Watcher再次加入更新队列
        has[id] = null;

        // 更新watcher
        watcher.run();

        // in dev build, check and stop circular updates.
        // 一个组件过量的更新，发出可能存在无尽循环的警告
        if (process.env.NODE_ENV !== 'production' && has[id] != null) {
            circular[id] = (circular[id] || 0) + 1
            if (circular[id] > MAX_UPDATE_COUNT) {
                warn(
                    'You may have an infinite update loop ' + (
                        watcher.user ?
                        `in watcher with expression "${watcher.expression}"` :
                        `in a component render function.`
                    ),
                    watcher.vm
                )
                break
            }
        }
    }

    // keep copies of post queues before resetting state
    const activatedQueue = activatedChildren.slice()
    const updatedQueue = queue.slice()

    // 重置更新队列状态
    resetSchedulerState()

    // call component updated and activated hooks
    // 调用组件的updated和activated钩子函数
    callActivatedHooks(activatedQueue)
    callUpdatedHooks(updatedQueue)

    // devtool hook
    // 触发devtool的更新
    if (devtools && config.devtools) {
        devtools.emit('flush')
    }
}

function callUpdatedHooks(queue) {
    let i = queue.length

    // 可以看到是按照子——>父的顺序触发的
    while (i--) {
        const watcher = queue[i]
        const vm = watcher.vm;
        if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
            callHook(vm, 'updated')
        }
    }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 * 将已激活的动态组件装入队列中，这个队列会在整个VNode树被处理完后进行处理
 */
export function queueActivatedComponent(vm: Component) {

    // setting _inactive to false here so that a render function can
    // rely on checking whether it's in an inactive tree (e.g. router-view)
    // 设置_inactive为false使渲染函数可以判断它是否为一个不活跃的VNode Tree
    vm._inactive = false;
    activatedChildren.push(vm)
}

function callActivatedHooks(queue) {
    for (let i = 0; i < queue.length; i++) {
        queue[i]._inactive = true
        activateChildComponent(queue[i], true /* true */ )
    }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 * 将一个watcher实例推入这个观察者队列中。
 * 重复的watcher会跳过除非该watcher已经进行了处理
 */
export function queueWatcher(watcher: Watcher) {
    const id = watcher.id;

    // 只存储一次，防止多次更新同一个依赖项而多次触发watcher更新
    if (has[id] == null) {
        has[id] = true;

        // 未对队列进行刷新时，直接将watcher加入队列中
        if (!flushing) {
            queue.push(watcher);
        } else {

            // if already flushing, splice the watcher based on its id
            // if already past its id, it will be run next immediately.
            // 如果已经处于更新时，有新的watcher加入，
            // 则将当前watcher加入到整个队列中，id按小到大排序的对应位置
            let i = queue.length - 1;
            while (i > index && queue[i].id > watcher.id) {
                i--;
            }
            queue.splice(i + 1, 0, watcher);
        }

        // queue the flush
        // 在下一次event loop时进行队列刷新
        if (!waiting) {
            waiting = true;

            if (process.env.NODE_ENV !== 'production' && !config.async) {
                flushSchedulerQueue()
                return
            }

            // 调用该函数进行队列刷新
            nextTick(flushSchedulerQueue)
        }
    }
}