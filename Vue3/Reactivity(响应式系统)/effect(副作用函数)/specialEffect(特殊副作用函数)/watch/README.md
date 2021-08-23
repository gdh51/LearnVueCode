# Watch

`watch`类`API`目前具有两个，一个是近乎于`Vue2`的`watch() API`；另一个则是新的`watchEffect() API`，从底层上来说，它们都来自于同一个函数，在在具体的表现上存在细节差异。

它与`computed()`函数不一样，它的更新部分要有`flush`队列参与，与`Vue`实例有关，这也是为什么它会被归于`runtime-core package`中。

## watch API/watchEffect API

由于两个函数都由同一个工厂函数生成，所以这里我们先浏览下它们各自的工厂函数。

```js
// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  // 要观察的响应式对象，可以是一个函数
  source: T | WatchSource<T>,
  // 依赖变更时触发的函数
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (__DEV__ && !isFunction(cb)) {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`
    )
  }

  // 三个参数
  return doWatch(source as any, cb, options)
}

// Simple effect.
export function watchEffect(
  // 要执行的effect函数
  effect: WatchEffect,
  // 控制effect行为的对象参数
  options?: WatchOptionsBase
): WatchStopHandle {
  // 无回调函数
  return doWatch(effect, null, options)
}
```

可以看出两个`API`的差别仅是第二个回调函数是否使用的差距，具体的差异结合其使用的具体表现进行理解，下面直接来看`doWatch()`函数。

## doWatch()

首先对该函数整体进行浏览一下，不用细致了解其构造。对于不了解的函数，我会直接概括函数的作用，不会深入去讲述。

```js
function doWatch(
  // 要观察的响应式对象，可以是一个函数
  source: WatchSource | WatchSource[] | WatchEffect | object,
  // 依赖变更时触发的函数
  cb: WatchCallback | null,
  { immediate, deep, flush, onTrack, onTrigger }: WatchOptions = EMPTY_OBJ
): WatchStopHandle {
  // 如果用户没有定义执行的回调(这里实际对应在watchEffect中使用该属性)
  if (__DEV__ && !cb) {
    // 使用immediate时，则报错
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }

    // 使用deep时则报错
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
  }

  // 观察非法类型的响应式对象时
  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`
    )
  }

  // 获取当前组件实例
  const instance = currentInstance
  let getter: () => any

  // watch api是否在依赖项变更时无条件触发回调函数
  let forceTrigger = false
  let isMultiSource = false

  // 当前数据源为引用对象
  if (isRef(source)) {
    // 则副作用函数的getter为访问其value
    getter = () => source.value

    // 当其为浅引用时强制触发更新(这样可以直接通过triggerRef触发更新)
    forceTrigger = !!source._shallow

    // 如果为响应化对象时，默认做深度追踪
  } else if (isReactive(source)) {
    // 返回原对象
    getter = () => source

    // 默认深度观察
    deep = true

    // 如果为数组时，遍历进行观察
  } else if (isArray(source)) {
    isMultiSource = true

    // 其中任意一个具有响应式时，强制更新
    // (因为即使响应式对象发生变更，其变更的是内部值，所以判定变化时不会发生变化)
    forceTrigger = source.some(isReactive)

    // 数组的getter为遍历，并根据元素具体值返回
    getter = () =>
      source.map(s => {
        // 对数组中的ref取其value
        if (isRef(s)) {
          return s.value

          // 对响应式对象，递归深度收集
        } else if (isReactive(s)) {
          return traverse(s)

          // 若为数组式函数，则进行调用
        } else if (isFunction(s)) {
          return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
    // 如果为函数，则返回一个getter函数
  } else if (isFunction(source)) {
    // 具有回调函数，说明为watch api
    if (cb) {
      // getter with cb
      getter = () =>
        callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)

      // 如果没有依赖项更改时触发的回调函数，则认为一个effect
      // (watchEffect就是这种，当然你可以通过watch来模拟watchEffect)
    } else {
      // no cb -> simple effect
      getter = () => {
        // 实例未渲染时退出不执行
        if (instance && instance.isUnmounted) {
          return
        }

        // 在effect更新前执行用户自定义的清理函数
        if (cleanup) {
          cleanup()
        }

        // 调用用户设置的函数，传入一个设置清理函数的函数作为参数
        return callWithAsyncErrorHandling(
          source,
          instance,
          ErrorCodes.WATCH_CALLBACK,
          [onInvalidate]
        )
      }
    }
  } else {
    // 其他类型均为非法，报错
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }

  // 2.x array mutation watch compat
  // 兼容Vue 2数组变更
  if (__COMPAT__ && cb && !deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (
        isArray(val) &&
        checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
      ) {
        traverse(val)
      }
      return val
    }
  }

  // 如果是深度收集依赖项，则递归遍历对象，深度收集依赖项
  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void

  let onInvalidate: InvalidateCbRegistrator = (fn: () => void) => {
    // 为effect重写一个onStop函数
    // 该函数会在effect销毁时调用
    cleanup = effect.onStop = () => {
      callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP)
    }
  }

  // in SSR there is no need to setup an actual effect, and it should be noop
  // unless it's eager
  // SSR，暂时不关注
  if (__NODE_JS__ && isInSSRComponentSetup) {
    // we will also not call the invalidate callback (+ runner is not set up)
    onInvalidate = NOOP
    if (!cb) {
      getter()
    } else if (immediate) {
      callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
        getter(),
        isMultiSource ? [] : undefined,
        onInvalidate
      ])
    }
    return NOOP
  }

  // 获取初始化旧值
  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE

  // 调度中执行的任务，主要是根据情况执行回调函数或原effect(watchEffect)
  const job: SchedulerJob = () => {
    // 当前watch已失活
    if (!effect.active) {
      return
    }

    // watch api， 执行cb
    if (cb) {
      // watch(source, cb)
      // 调度getter()进行新值求值(并收集依赖项)
      const newValue = effect.run()
      if (
        // 深度观察
        deep ||
        // 强制更新
        forceTrigger ||
        // 数组时，查看是否存在数组元素值发生变化
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue)) ||
        // 兼容V2
        (__COMPAT__ &&
          isArray(newValue) &&
          isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance))
      ) {
        // cleanup before running cb again
        // 执行用户的清除逻辑，在执行回调函数之前
        if (cleanup) {
          cleanup()
        }

        // 调用用户定义的watch回调，传入新旧值，并传入一个设置清理函数的函数(允许用户在下次函数调用时，提前执行清理逻辑)
        callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onInvalidate
        ])
        oldValue = newValue
      }

      // 执行watchEffect api的effect
    } else {
      // watchEffect
      effect.run()
    }
  }

  // important: mark the job as a watcher callback so that scheduler knows
  // it is allowed to self-trigger (#1727)
  // watch api允许当前effect递归调用自己(这里不是在effect中，而是在刷新队列中)
  job.allowRecurse = !!cb

  // 调度程序，该函数只会决定何时调用job
  let scheduler: EffectScheduler

  // 根据调度类型，进行调度划分

  // 同步调度，依赖项更新后立即调度
  if (flush === 'sync') {
    // 调度程序直接使用job
    scheduler = job as any // the scheduler function gets called directly

    // 后置调度，调度程序使用函数，将job至于后置队列中
  } else if (flush === 'post') {
    // 将当前job加入延迟执行队列
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)

    // 默认为提前调度
  } else {
    // default: 'pre'
    scheduler = () => {
      // 组件实例未生成或挂载之后的实例加入到预执行队列中执行
      if (!instance || instance.isMounted) {
        queuePreFlushCb(job)

        // 对于未挂载的组件实例，在组件挂载前直接同步执行
      } else {
        // with 'pre' option, the first call must happen before
        // the component is mounted so it is called synchronously.
        job()
      }
    }
  }

  // 创建该watch的副作用函数，自定义调度程序
  const effect = new ReactiveEffect(getter, scheduler)

  if (__DEV__) {
    effect.onTrack = onTrack
    effect.onTrigger = onTrigger
  }

  // initial run
  // 初始化调用，主要是进行依赖项收集

  // 使用watch api时
  if (cb) {
    // 如果immediate，则立即执行一次job
    if (immediate) {
      job()

      // 无立即执行时，仅调用getter()函数进行依赖收集
    } else {
      oldValue = effect.run()
    }

    // 后置执行时，默认执行一次依赖收集
  } else if (flush === 'post') {
    queuePostRenderEffect(
      effect.run.bind(effect),
      instance && instance.suspense
    )
  } else {
    effect.run()
  }

  // 返回一个注销该watch的函数
  return () => {
    effect.stop()
    if (instance && instance.scope) {
      remove(instance.scope.effects!, effect)
    }
  }
}
```

整个`doWatch()`函数，从代码流程上来说，一共分为四部分：

1. 初始化`getter()`，即进行依赖项收集的函数
2. 初始化`job()`并确认其调度的时机
3. 初始化`effect()`并根据时机调用收集依赖项
4. 返回一个注销的函数

下面就根据其步骤来进行解析

### 初始化 getter()

`getter()`的作用是用于依赖项收集，通知`watch`类`API`进行更新。`Vue3`中的`watch API`不支持字符串形式的监听了，现在只允许三种形式监听：

- 响应式对象
- 单个引用
- 一个有返回值的函数
- 一个数组，包含有响应式对象或引用

而`watchEffect API`只是一个简单副作用函数，所以其`getter()`即其原本的函数即可。

下面就是对于上述描述对应的处理：

```js
let getter: () => any

// watch api是否在依赖项变更时无条件触发回调函数
let forceTrigger = false

// 是否具有多个数据源(数组时)
let isMultiSource = false
```

#### watch API 的 getter()

下面的描述都是针对于`watch API`的数据源的处理，首先是观察一个引用类型的数据时，`getter()`只需要简单的将引用对象的值返回即可。

```js
// 当前数据源为引用对象
if (isRef(source)) {
  // 则副作用函数的getter为访问其value
  getter = () => source.value

  // 当其为浅引用时强制触发更新(这样可以直接通过triggerRef触发更新)
  forceTrigger = !!source._shallow

  // 如果为响应化对象时，默认做深度追踪
}
```

在上述还有一个特殊的`forceTrigger`属性，该属性是用于`triggerRef()`方法强制通知当前`shallowRef()`化的引用对象追踪的`effect()`更新使用。

> `triggerRef()`方法**专用**于触发`shallowRef()`化的引用对象，使其通知依赖其的`effect()`函数强制更新。但这种更新不会引起其引用值的变动，按理来说值未变动是不会触发`watch API`更新的，所以这里通过这种方式强制使其更新了。

接下来是对于响应式对象的处理，没有什么特别的，但是如果用户传入一个响应式对象，那么它肯定是想进行深度观察，所以这里既是不特殊指明`deep: true`，`watch API`也在内部将`deep`模式开启:

```js
// 如果为响应化对象时，默认做深度追踪
if (isReactive(source)) {
  // 返回原对象
  getter = () => source

  // 默认深度观察
  deep = true
}
```

对于观察多个数据源(数组模式)，`getter()`必然是应该遍历所有的数组元素，然后重复的对每个数组元素做同样的处理：

```js
// 如果为数组时，遍历进行观察
if (isArray(source)) {
  isMultiSource = true

  // 其中任意一个具有响应式时，强制更新
  // (因为即使响应式对象发生变更，其变更的是内部值，所以判定变化时不会发生变化)
  forceTrigger = source.some(isReactive)

  // 数组的getter为遍历，并根据元素具体值返回
  getter = () =>
    source.map(s => {
      // 对数组中的ref取其value
      if (isRef(s)) {
        return s.value

        // 对响应式对象，递归深度收集
      } else if (isReactive(s)) {
        return traverse(s)

        // 若为数组式函数，则进行调用
      } else if (isFunction(s)) {
        return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
      } else {
        __DEV__ && warnInvalidSource(s)
      }
    })
  // 如果为函数，则返回一个getter函数
}
```

注意，上面也同样出现了`forceTrigger()`属性，原因是因为`watch API`在进行检查是否当前观察值发生变化时，**只会对比当前的数组元素**的前后变化，而数组形式的数据源，如果存在响应式对象是只会变动其内部的。

当使用函数作为数据源时，那么函数的返回值就会作为当前观察数据的值(当然依赖项收集包括函数内所有使用到的响应式对象)。

```js
// 如果为函数，则返回一个getter函数
if (isFunction(source)) {
  // 具有回调函数，说明为watch api
  if (cb) {
    // getter with cb
    getter = () =>
      callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)

    // 如果没有依赖项更改时触发的回调函数，则认为一个effect
    // (watchEffect就是这种，当然你可以通过watch来模拟watchEffect)
  }
}
```

最后`watch API`，如果应用了深度追踪，那么要再次递归深度遍历`getter()`返回的值

```js
// 如果是深度收集依赖项，则递归遍历对象，深度收集依赖项
if (cb && deep) {
  const baseGetter = getter
  getter = () => traverse(baseGetter())
}
```

#### watchEffect API 的 getter

当然，当数据源为函数时，另一种可能就是在使用`watchEffect API`。该`API`仅会在`Vue`实例挂载时执行，并具有一个前置清除能力，所以其`getter()`为：

```js
if (isFunction(source)) {
  // 如果没有依赖项更改时触发的回调函数，则认为一个effect
  // (watchEffect就是这种，当然你可以通过watch来模拟watchEffect)
  if (!cb) {
    // no cb -> simple effect
    getter = () => {
      // 实例未渲染时退出不执行
      if (instance && instance.isUnmounted) {
        return
      }

      // 在effect更新前执行用户自定义的清理函数
      if (cleanup) {
        cleanup()
      }

      // 调用用户设置的函数，传入一个设置清理函数的函数作为参数
      return callWithAsyncErrorHandling(
        source,
        instance,
        ErrorCodes.WATCH_CALLBACK,
        [onInvalidate]
      )
    }
  }
}
```

注意在这个`API`中，在其副作用函数执行时，会传入一个`onInvalidate()`函数作为参数，我们可以通过使用这个函数并传入一个函数作为参数，在`watchEffect()`重新执行前，其会优先执行我们传入函数：

```js
let cleanup: () => void

let onInvalidate: InvalidateCbRegistrator = (fn: () => void) => {
  // 为effect重写一个onStop函数
  // 该函数会在effect销毁时调用
  cleanup = effect.onStop = () => {
    callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP)
  }
}
```

`onInvalidate()`函数具有后置性，即使用后，会在**下一次**重新运行`watchEffect()`函数**前**执行。

### 初始化调度时任务并确认其调度的时机

在确认了`getter()`函数，其要决定`effect()`函数的另一部分，调度函数。

> `effect()`函数在未指定调度函数时，会在更新时执行`getter()`，反之执行调度函数。但是我们可以通过`effect()`函数的`API`来单独调度其`getter()`，这样我们就可以做到使用`getter()`来进行依赖项收集，然后更新时执行调度程序。这也就是`watch/watchEffect API`的原理。

首先初始化一个调度任务`job()`，为这样的(现在我们不需要关注其在更新时干了什么):

```js
// 调度中执行的任务，主要是根据情况执行回调函数或原effect(watchEffect)
const job: SchedulerJob = () => {
  // ....
}

// important: mark the job as a watcher callback so that scheduler knows
// it is allowed to self-trigger (#1727)
// watch api允许当前effect递归调用自己(这里不是在effect中，而是在刷新队列中)
job.allowRecurse = !!cb
```

其次要根据用户传入的时机来决定这个`watch/watchEffect API`更新时，在哪个阶段执行。

首先是同步执行，这意味着在依赖项更新后，`watch API`的回调函数或`watchEffect API`的`getter()`会立即执行

```js
// 调度程序，该函数只会决定何时调用job
let scheduler: EffectScheduler

// 根据调度类型，进行调度划分

// 同步调度，依赖项更新后立即调度
if (flush === 'sync') {
  // 调度程序直接使用job
  scheduler = job // the scheduler function gets called directly
}
```

其次是后置执行，即其会被加入到一个刷新队列中，在下一个微任务阶段才进行更新调度。

```js
// 后置调度，调度程序使用函数，将job至于后置队列中
if (flush === 'post') {
  // 将当前job加入延迟执行队列
  scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)
}
```

最后是默认情况下，其会在前置执行，即在实例挂载前进行执行，但首次渲染时其会和同步模式一样立即执行。

```js
// 默认为提前调度
else {
  // default: 'pre'
  scheduler = () => {
    // 组件实例未生成或挂载之后的实例加入到预执行队列中执行
    if (!instance || instance.isMounted) {
      queuePreFlushCb(job)

      // 对于未挂载的组件实例，在组件挂载前直接同步执行
    } else {
      // with 'pre' option, the first call must happen before
      // the component is mounted so it is called synchronously.
      job()
    }
  }
}

// 创建该watch的副作用函数，自定义调度程序
const effect = new ReactiveEffect(getter, scheduler)
```

### 初始化调度 watch 类 API

创建好副作用函数后，现在其该于对于的观察数据源建立关系了，所以其要进行初始化调用进行依赖收集。

对于`watch API`，其应该调用`getter()`来进行一次依赖项收集，并根据是否设置`immediate`属性来决定是否立即执行一次回调函数:

```js
// 使用watch api时
if (cb) {
  // 如果immediate，则立即执行一次job
  if (immediate) {
    job()

    // 无立即执行时，仅调用getter()函数进行依赖收集
  } else {
    oldValue = effect.run()
  }

  // 后置执行时，默认执行一次依赖收集
}
```

对于`watchEffect API`，其也应该调用`getter()`来进行一次依赖项收集，但由于用户可以设置调用时机，所以这里有两种情况：

```js
// 后置执行时，默认执行一次依赖收集
if (flush === 'post') {
  queuePostRenderEffect(effect.run.bind(effect), instance && instance.suspense)

  // 默认情况立即进行依赖收集
} else {
  effect.run()
}
```

### 返回注销函数

最后初始化完毕后，会返回一个注销函数，用于注销这个`API`

```js
// 返回一个注销该watch的函数
return () => {

    // 失活副作用函数
    effect.stop()
    if (instance && instance.scope) {

        // 从当前实例的作用域中移除当前API的副作用函数
        remove(instance.scope.effects!, effect)
    }
}
```

## 生命周期

通过上面的学习，我们除了其在更新时具体怎么做之外，应该对其他时候在做什么很了解了。所以这里只补充一下其在更新时的操作。

上面提到在更新时，即调用调度任务`job()`函数，下面根据各自的`API`来细分说明，首先是`watch API`，其相对于`watchEffect API`来说较为复杂一点。

首先其要先重新调用`getter()`函数得出数据源最新的值，并与其进行比对，如果更新了则触发回调函数；反之不触发。

```js
const job: SchedulerJob = () => {
    // 当前watch已失活
    if (!effect.active) {
        return
    }

    // watch api， 执行cb
    if (cb) {
        // watch(source, cb)
        // 调度getter()进行新值求值(并收集依赖项)
        const newValue = effect.run()
        if (
            // 深度观察
            deep ||
            // 强制更新
            forceTrigger ||
            // 数组时，查看是否存在数组元素值发生变化
            (isMultiSource
            ? (newValue as any[]).some((v, i) =>
                hasChanged(v, (oldValue as any[])[i])
            )
            : hasChanged(newValue, oldValue))
        ) {
            // cleanup before running cb again
            // 执行用户的清除逻辑，在执行回调函数之前
            if (cleanup) {
            cleanup()
            }

            // 调用用户定义的watch回调，传入新旧值，并传入一个设置清理函数的函数(允许用户在下次函数调用时，提前执行清理逻辑)
            callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
                newValue,
                // pass undefined as the old value when it's changed for the first time
                oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
                onInvalidate
            ])
            oldValue = newValue
        }
    }
}
```

从上面的代码可以看到`watch API`的回调触发条件一共有`4`个:

```js
if (
    // 深度观察
    deep ||
    // 强制更新
    forceTrigger ||
    // 数组时，查看是否存在数组元素值发生变化
    (isMultiSource
        ? (newValue as any[]).some((v, i) =>
            hasChanged(v, (oldValue as any[])[i])
        )
        : hasChanged(newValue, oldValue))
)
```

首先我们要明确一点，**但凡触发了`job()`的更新，那么一定是其依赖项发生了变动**。那么这里为什么会出现前 2 个条件呢？

在深度观察模式下，数据源内部发生变化后，返回的新值仍是当前对象；此外，[之前](#初始化-getter)我们提到一些特殊情况下，不能直接通过对比值来判定当前数据源是否发生变化，所以这里需要借助其他哨兵变量来实现回调函数的触发。

相比之下`watchEffect API`就相当来说比较简单了，只需要重新执行`getter()`即可。

```js
const job: SchedulerJob = () => {
  // 当前watch已失活
  if (!effect.active) {
    return
  }

  if (!cb) {
    // watchEffect
    effect.run()
  }
}
```

![watchEffect LifeCycle](./imgs/watchEffect%20lifecycle.png)
![watch LifeCycle](./imgs/watch%20lifecycle.png)

## 补充知识

- [effect API](../../README.md)
- [computed API](../computed/README.md)
- [scheduler 刷新队列](<../../../flush-scheduler(刷新调度队列)/README.md>)
