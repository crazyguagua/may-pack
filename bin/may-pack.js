#!  /usr/bin/env node

// node环境


let path = require('path')

// 拿到配置文件webpack.config.js
let config = require(path.resolve('webpack.config.js'));


let Compiler = require('../lib/Compiler.js');

let compiler = new Compiler(config);

// 调用
compiler.hooks.entryOption.call()
// 标识运行编译
compiler.run()
