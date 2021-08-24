# 工具方法

这里会记录在`history`模式中使用到的工具方法，以便快速查询：

**目录：**

- [supportsPushState——变量检查，是否支持history.pushState](#supportspushstate%e5%8f%98%e9%87%8f%e6%a3%80%e6%9f%a5%e6%98%af%e5%90%a6%e6%94%af%e6%8c%81historypushstate)
- [pushState()——封装history API并兼容性处理](#pushstate%e5%b0%81%e8%a3%85history-api%e5%b9%b6%e5%85%bc%e5%ae%b9%e6%80%a7%e5%a4%84%e7%90%86)
- [replaceState()——封装的history.replaceState接口](#replacestate%e5%b0%81%e8%a3%85%e7%9a%84historyreplacestate%e6%8e%a5%e5%8f%a3)

## supportsPushState——变量检查，是否支持history.pushState

该方法用于检查是否支持`history.pushState`接口，大多数浏览器都是支持该方法的：

```js
// 是否支持history API 的pushState()方法
export const supportsPushState =
    inBrowser &&
    (function () {
        const ua = window.navigator.userAgent

        if (
            (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
            ua.indexOf('Mobile Safari') !== -1 &&
            ua.indexOf('Chrome') === -1 &&
            ua.indexOf('Windows Phone') === -1
        ) {
            return false
        }

        return window.history && 'pushState' in window.history
    })();
```

## pushState()——封装history API并兼容性处理

该方法用于封装`history API`的两个更新`URL`的`API`，并对其中的存在的问题做兼容性处理，
并且在替换`URL`时，会存储当前页面滚动条的信息：

```js
function pushState(url ? : string, replace ? : boolean) {

    // 保持当前滚动条的位置
    saveScrollPosition();

    // try...catch the pushState call to get around Safari
    // DOM Exception 18 where it limits to 100 pushState calls
    // Safari浏览器限制只能使用100次pushState
    const history = window.history;
    try {

        // 如果是直接替换当前URL
        if (replace) {
            // preserve existing history state as it could be overriden by the user
            // 保留存在的历史记录状态，以便开发人员可以重写它
            const stateCopy = extend({}, history.state);

            // 获取当前的key值
            stateCopy.key = getStateKey();

            // 将当前URL地址替换进去
            history.replaceState(stateCopy, '', url);

        // 如果当前是更新模式，则创建一个新的key
        } else {
            history.pushState({
                key: setStateKey(genStateKey())
            }, '', url)
        }
    } catch (e) {

        // 降级方案，直接替换url
        window.location[replace ? 'replace' : 'assign'](url)
    }
}
```

从上面的代码信息中我们可以知道，在每次替换`URL`时，存入的`state`会保存一个`key`值用来标记当前唯一的`state`。但凡不是调用`history.replaceState API`就不会替换这个`key`值。关于这个`key`值及其`API`这里有个[简单的介绍](../存储的key值/REAMDE.md)；另外还有[`saveScrollPosition()`](../../../页面位置处理/REAMDE.md)对页面位置(即滚动条)的处理。

## replaceState()——封装的history.replaceState接口

该方法就是简单的封装的[`pushState`](#pushstate%e5%b0%81%e8%a3%85history-api%e5%b9%b6%e5%85%bc%e5%ae%b9%e6%80%a7%e5%a4%84%e7%90%86)以便提供一个唯一的接口。

```js
function replaceState(url ? : string) {

    // 调用pushState的replace模式的接口
    pushState(url, true);
}
```
