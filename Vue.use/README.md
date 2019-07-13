# Vue.use
Vue.use通常用来在初始化Vue实例前,安装各种插件,其本质就是将传入的第一个参数里面的install()方法进行执行, 下面为源码
```js
  /**
    * 安装插件,Vue.use本质执行了自己定义的install方法,参数为传入插件之后的其他参数
    * @param {Object|Function} plugin 一个插件对象或函数
    *
    */
    Vue.use = function (plugin) {
      //传入的plugin可以是对象也可以是function, 是对象时必须要有install()方法

      //初始化或获取插件列表
      var installedPlugins = (this._installedPlugins || (this._installedPlugins = []));
      if (installedPlugins.indexOf(plugin) > -1) {
        //已安装直接返回
        return this
      }

      //将传入的其他参数存入新数组, 并将Vue构造函数作为作为第一个参数加入数组
      var args = toArray(arguments, 1);
      args.unshift(this);

      //根据plugin类型执行install(args)参数为上面的args
      if (typeof plugin.install === 'function') {
        plugin.install.apply(plugin, args);
      } else if (typeof plugin === 'function') {
        plugin.apply(null, args);
      }
      installedPlugins.push(plugin);
      return this
    };
```

## toArray()
一个Vue中的工具方法, 它可以理解为Array.prototype.slice()方法,其源码为：
```js
/**
  * Convert an Array-like object to a real Array.
  * 将类数组对象转换为真实的数组
  * @param {Array|Object} list 类数组对象或数组
  * @param {Number} start 起始位置坐标
  *
  */
function toArray (list, start) {
    start = start || 0;

    //具体指定的长度
    var i = list.length - start;
    var ret = new Array(i);
    while (i--) {
      ret[i] = list[i + start];
    }
    return ret
  }
```