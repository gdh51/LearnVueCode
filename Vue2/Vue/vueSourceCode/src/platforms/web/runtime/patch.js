/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
// 指令型的模块应该最后调用，待所有内置模块调用后
const modules = platformModules.concat(baseModules);

export const patch: Function = createPatchFunction({ nodeOps, modules })
