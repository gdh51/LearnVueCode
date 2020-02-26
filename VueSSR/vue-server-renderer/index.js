try {
    var vueVersion = require('vue').version
} catch (e) {}

// 根据模式放出对应的版本
if (process.env.NODE_ENV === 'production') {
    module.exports = require('./build.prod.js')
} else {
    module.exports = require('./build.dev.js')
}