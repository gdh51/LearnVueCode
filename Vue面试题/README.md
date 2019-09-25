# Vue 面试题

到处收集的面试题与 Vue 有关的, 只把回答了的挂上面

## Vue

1. **你知道 vue 的模版引擎用的是哪个 web 模版引擎的吗? 说说你对这模版引擎的理解**

   答：Mustache 模版引擎语法, 主要用于后端模版引擎生成 html 并填充数据, 其变量要用{{}}来引用与 vue 差不多一样, 一个简单的 demo

   ```js
   var view = {
     title: 'Joe',
     calc: function() {
       return 2 + 4;
     }
   };

   var output = Mustache.render('{{title}} spends {{calc}}', view);
   ```

2. **v-model 的原理知道吗? 说说看**

   答：`v-model `其实就是` input `元素上绑定`@input='\$event.target.value'`与 `v-bind:value='prop'`,将` input `元素的` value `绑定在某个变量上, 然后通过其` input `事件来同步更改该变量

3. **在使用计算属性时, 函数名和data数据源中的数据可以同名吗?**

   答: 不能, 因为在initComputed()函数中, 会遍历原始的options检查是否与data/props同名, 有时会报错(这里补充一个, 如果computed与methods同名时, methods会覆盖computed)

4. **vue中的data的属性可以和methods中的方法同名吗？**

   答：不能, 在initData()函数中, 会遍历原始options检查是否与其中methods同名,同名时会报错

5. **Vue 项目时为什么要在列表组件中写 key，其作用是什么？**

   答: 其作用是在模版中DOM发生变换时, 在diff算法中不满足前4种匹配模式时，会生成一张带key值与对应vnode的map对象，便于更快直接获取对应元素(相比于遍历, 在没有key的情况下会去遍历查找)。

6. **聊聊 Vue 的双向数据绑定，Model 如何改变 View，View 又是如何改变 Model 的**
   答: 在数据层的数据改变时, Modal通过定义数据中的setter调用更新回调来进行视图的重新渲染。而View则是通过Listener来对Modal层进行数据更新, 数据更新后触发setter再次进行视图的渲染

7. **Vue 的响应式原理中 Object.defineProperty 有什么缺陷？为什么在 Vue3.0 采用了 Proxy，抛弃了 Object.defineProperty？**
   答：
   1. `Object.defineProperty()`无法监听到数组下标的变化, 导致通过非变异的数组方法无法做到响应式更新。
   2. `Object.defineProperty()`只能劫持对象的属性, 从而需要对整个对象进行深度遍历。而`Proxy`可以劫持整个对象并返回一个新的对象。
   3. `Proxy`可以代理对象和数组, 以及动态添加的属性。

8. **在 Vue 中，子组件为何不可以修改父组件传递的 Prop**
   >如果修改了，Vue 是如何监控到属性的修改并给出警告的。

   答：
   1. 子组件为何不可以修改父组件传递的
      Prop单向数据流，易于监测数据的流动，出现了错误可以更加迅速的定位到错误发生的位置。
   2. 如果修改了，Vue 是如何监控到属性的修改并给出警告的。
      在初始化props时, 会在defineReactive时通过判断是否是开发环境, 当是开发环境时, 会判断触发的属性是否处于updatingChildren中被修改, 不是则会发出警告。
      >如果传入的props是基本数据类型，子组件修改父组件传的props会警告，并且修改不成功，如果传入的是引用数据类型，那么修改改引用数据类型的某个属性值时，对应的props也会修改，并且vue不会发出警告并会修改成功。

9. **Vue 的父组件和子组件生命周期钩子执行顺序是什么**
    答：
    1. 加载渲染过程
       父`beforeCreate`->父`created`->父`beforeMount`->子`beforeCreate`->子`created`->子`beforeMount`->子`mounted`->父`mounted`
    2. 子组件更新过程
       父`beforeUpdate`->子`beforeUpdate`->子`updated`->父`updated`
    3. 父组件更新过程
       父`beforeUpdate`->父`updated`
    4. 销毁过程
       父`beforeDestroy`->子`beforeDestroy`->子`destroyed`->父`destroyed`
    总结：从外到内，再从内到外

## Vuex
1. **你有用过vuex的module吗, 主要是在什么场景下使用?**

   答:用过, 主要是在项目存在复杂结构时, 通过一个module单独维护一个组件, 更利于封装和管理

2. **vuex中actions与mutations有什么区别?**

   答: mutations函数中的逻辑必须是同步执行的, 而actions可以是异步执行, 因为其内部通过一个Promise对象实现

3. **双向绑定和 vuex 是否冲突**
   答：在严格模式下直接修改state中值确实会报错, 但是我们可以用bind绑定一个值在用input方法来绑定一个方法, 在该方法中通过mutation来更改vuex中的值；对于计算属性我们则可以直接绑定computed, 在其setter中来更新vuex的状态。
   ```js
   computed: {
      message: {
        get () {
          return this.$store.state.obj.message
        },
        set (value) {
          this.$store.commit('updateMessage', value)
        }
      }
    }
   ```