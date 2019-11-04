# parse——解析模版字符串

从该函数开始，便正式对整个模版`template`进行字符串解析成`AST`语法树，这个过程很很很很很复杂，我们不具体看匹配的正则表达式，只知道它匹配什么就行了；下面简单的就直接用注释写在代码中了

```js
/**
 * Convert HTML string to AST.
 * 将HTML模版字符串转换为AST树
 */
export function parse(
    template: string,
    options: CompilerOptions
): ASTElement | void {

    // 告警提示方法，用于报错
    warn = options.warn || baseWarn;

    // 以下都为map对象，来效验是否为某个变量，返回布尔值

    // 是否为pre标签
    platformIsPreTag = options.isPreTag || no;

    // 是否为置换元素或部分表单元素，如input img等等
    platformMustUseProp = options.mustUseProp || no;

    // 是否为具有命名空间的标签，就两种svg和math
    platformGetTagNamespace = options.getTagNamespace || no;

    // 是否为保留标签，即所有的原生标签
    const isReservedTag = options.isReservedTag || no;

    // 是否为组件
    maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag);

    // 三个用来处理属性的函数数组集合
    transforms = pluckModuleFunction(options.modules, 'transformNode')
    preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
    postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

    delimiters = options.delimiters;

    // 一个表示当前处理元素所处于DOM中深度的栈
    const stack = [];

    // 是否保留空格，默认false(默认opitons中根本没有该属性)
    const preserveWhitespace = (options.preserveWhitespace !== false);
    const whitespaceOption = options.whitespace;
    let root;
    let currentParent;

    // 是否使用v-pre指令
    let inVPre = false;
    let inPre = false;
    let warned = false;

    // 解析模版生成ast对象，返回根节点的ast对象
    parseHTML(template, {
        warn,
        expectHTML: options.expectHTML,

        // 是否为自闭和标签
        isUnaryTag: options.isUnaryTag,

        // 是否能为可以自动闭合的标签
        canBeLeftOpenTag: options.canBeLeftOpenTag,

        // 针对IE和Chrome中的bug的解决方案
        shouldDecodeNewlines: options.shouldDecodeNewlines,
        shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,

        // 是否保留注释信息
        shouldKeepComment: options.comments,
        outputSourceRange: options.outputSourceRange,
        start () { /*一个方法*/},
        end () { /*一个方法*/ }
        chars () { /*一个方法*/ },
        comment () { /*一个方法*/ }
    });

    return root;
}
```

对于上述验证函数，还是贴一下代码，首先看一个通用的工具函数，用于返回一个检测函数：

```js
/**
 * 将传入的字符串表达式转换为一个hash表，可以设置是否大小写敏感
*/
function makeMap (
  str,
  expectsLowerCase
) {
  var map = Object.create(null);
  var list = str.split(',');

  // 将所有值存入map对象中
  for (var i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }

  // 检测某个属性，只要该map中存在该属性，就返回true
  return expectsLowerCase
    ? function (val) { return map[val.toLowerCase()]; }
    : function (val) { return map[val]; }
}
```

看完了上述的对象，下面的就很好理解了，这里就不具体注释了：

```js
const isPreTag = (tag: ? string): boolean => tag === 'pre';

const isReservedTag = (tag: string): ? boolean => {
    return isHTMLTag(tag) || isSVG(tag)
};

const isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
);

const canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
);

function getTagNamespace(tag: string): ? string {
    if (isSVG(tag)) {
        return 'svg'
    }
    // basic support for MathML
    // note it doesn't support other MathML elements being component roots
    if (tag === 'math') {
        return 'math'
    }
}

const acceptValue = makeMap('input,textarea,option,select,progress');

const mustUseProp = (tag: string, type: ?string, attr: string): boolean => {
  return (
    (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
};
```

上面还有一个`pluckModuleFunction()`函数，用来以数组形式返回某个确实存在的属性：

```js
function pluckModuleFunction < F: Function > (
    modules: ? Array < Object > ,
    key : string
): Array < F > {

    // 返回module中的key属性的值，并清空空的值
    return modules ? modules.map(m => m[key]).filter(_ => _) : [];
}
```

在这些准备工作做好之后，就调用`parseHTML()`函数来正式进行模版编译了，由于这个过程有点复杂，所以另起了一篇文章。[parseHTML超详细解析](./parseHTML/README.md)
