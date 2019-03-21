let path = require('path')
let fs = require('fs')
// babylon  主要把源码转成ast Babylon 是 Babel 中使用的 JavaScript 解析器。
// @babel/traverse 对ast解析遍历语法树 负责替换，删除和添加节点
// @babel/types 用于AST节点的Lodash-esque实用程序库
// @babel/generator 结果生成

let babylon = require('babylon')
let traverse = require('@babel/traverse').default;
let type = require('@babel/types');
let generator = require('@babel/generator').default;

let ejs = require('ejs')


class Compiler {
    constructor(config) {
        // entry  output
        this.config = config
        // 需要保存入口文件的路径
        this.entryId = '';   // './src/index.js'
        // 需要保存所有的模块依赖
        this.modules = {};
        this.entry = config.entry  // 入口文件
        // 工作目录
        this.root = process.cwd(); // 当前运行npx的路径


    }
    // 拿到模块内容
    getSource (modulePath) {
        // 匹配各种文件的规则
        let rules= this.config.module.rules;   // webpack.config.js 中rules的数组
        let content = fs.readFileSync(modulePath, 'utf8')

        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i]
            let {test, use} = rule
            let len = use.length - 1

            if (test.test(modulePath)) {
                // console.log(use[len]);
                function normalLoader () {
                    // console.log(use[len--]);
                    let loader = require(use[len--])
                    content = loader(content)
                    // 递归调用loader 实现转化
                    if (len >= 0) {
                        normalLoader()
                    }
                }
                normalLoader()
            }

        }
        return content
    }
    // 源码解析
    parse (source, parentPath) {
        // AST解析语法树
        let ast = babylon.parse(source)
        let dependencies = []; // 依赖的数组
        // https://astexplorer.net/
        traverse(ast, {
            // 调用表达式
            CallExpression(p) {
                let node = p.node; //对应的节点
                if(node.callee.name === 'require') {
                   node.callee.name = '__webpack_require__'
                    let moduledName = node.arguments[0].value   // 取到模块的引用名字
                    moduledName = moduledName + (path.extname(moduledName) ? '': '.js');  // ./a.js
                    moduledName = './' + path.join(parentPath, moduledName)  // './src/a.js'
                    dependencies.push(moduledName)
                    node.arguments = [type.stringLiteral(moduledName)] // 改掉源码
                }
            }
        })
        let sourceCode = generator(ast).code
        return { sourceCode, dependencies }
    }
    // 构建模块
    buildModule(modulePath, isEntry) {
        // 拿到模块内容
        let source = this.getSource(modulePath)  // 得到入口文件的内容
        // 模块id modulePath(需要相对路径) = modulePath(模块路径) - this.root(项目工作路径)   src/index.js
        let moduleName = './' + path.relative(this.root, modulePath)
        // console.log(source, moduleName);  // 拿到代码 和相对路径 ./src/index.js
        if (isEntry) {
            this.entryId = moduleName
        }
        // 解析把source源码进行改造， 返回一个依赖列表
        let {sourceCode, dependencies} = this.parse(source, path.dirname(moduleName))   // ./src
        // 把相对路径和模块中的内容对应起来
        this.modules[moduleName] = sourceCode
        dependencies.forEach(dep => {  // 附模块的加载 递归加载
            this.buildModule(path.join(this.root, dep), false)
        })
    }

    // 发射文件
    emitFile() {
        // 用数据 渲染想要的
        // 输出到那个目录下
        let main = path.join(this.config.output.path, this.config.output.filename)
        let templateStr = this.getSource(path.join(__dirname, 'main.ejs'))
        let code = ejs.render(templateStr, { entryId: this.entryId, modules: this.modules})
        this.assets = {}
        // 路径对应的代码
        this.assets[main] = code
        fs.writeFileSync(main, this.assets[main])
    }

    run() {
        // 执行 创建模块的依赖关系
        this.buildModule(path.resolve(this.root, this.entry), true)  // path.resolve(this.root, this.entry) 得到入口文件的绝对路径
        // console.log(this.modules, this.entryId);
        // 发射打包后的文件
        this.emitFile()
    }


}

module.exports = Compiler
