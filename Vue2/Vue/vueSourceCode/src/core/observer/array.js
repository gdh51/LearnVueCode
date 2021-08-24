/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {

  // cache original method
  // 缓存原生方法
  const original = arrayProto[method];

  // 重写当前的数组方法
  def(arrayMethods, method, function mutator (...args) {

    // 调用原生方法的处理
    const result = original.apply(this, args);

    // 获取当前改变数组的观察者对象
    const ob = this.__ob__;

    // 处理新增数组元素的情况，inserted为新增的元素
    let inserted;
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }

    // 手动为新增的元素变更为响应式
    if (inserted) ob.observeArray(inserted);

    // 更新依赖项
    ob.dep.notify()
    return result
  });
});
