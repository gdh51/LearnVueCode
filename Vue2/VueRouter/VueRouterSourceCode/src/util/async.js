/* @flow */

export function runQueue(queue: Array < ? NavigationGuard > , fn : Function, cb: Function) {
    const step = index => {

        // 当下标超过或等于队列时，则说明更新完毕，调用回调函数
        if (index >= queue.length) {
            cb();

        // 未执行完毕时，则依次调用
        } else {
            if (queue[index]) {
                fn(queue[index], () => {
                    step(index + 1)
                });

            // 不存在时跳过
            } else {
                step(index + 1)
            }
        }
    }
    step(0)
}