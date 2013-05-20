var esprima = require('esprima');
var escodegen = require('escodegen');

var traverse = function (node, cb) {
    if (Array.isArray(node)) {
        node.forEach(function (x) {
            x.parent = node;
            traverse(x, cb);
        });
    }
    else if (node && typeof node === 'object') {
        cb(node);
        
        Object.keys(node).forEach(function (key) {
            if (key === 'parent' || !node[key]) return;
            node[key].parent = node;
            traverse(node[key], cb);
        });
    }
};

var walk = function (src, cb) {
    var ast = esprima.parse(src, { range: true });
    traverse(ast, cb);
};

var exports = module.exports = function (src, opts) {
    return exports.find(src, opts).strings;
};

exports.find = function (src, opts) {
    if (!opts) opts = {};
    var rangeOffset = 0;
    var word = opts.word === undefined ? 'require' : opts.word;
    if (typeof src !== 'string') src = String(src);

    // Remove any hashbang content, modifying subsequent ranges to match
    rangeOffset += src.length;
    src = src.replace(/^#![^\n]*\n/, '');
    rangeOffset -= src.length;

    // Wrap the provided source within its own scope, modifying subsequent ranges to match
    var presrc = '(function(){';
    var postsrc = '\n})()';
    src = presrc + src + postsrc;
    rangeOffset -= presrc.length;

    function isRequire (node) {
        var c = node.callee;
        return c
            && node.type === 'CallExpression'
            && c.type === 'Identifier'
            && c.name === word
        ;
    }
    
    var modules = { strings : [], expressions : [] };
    if (opts.nodes) modules.nodes = [];
    if (opts.ranges) modules.stringRanges = [];
    
    if (src.indexOf(word) == -1) return modules;
    
    walk(src, function (node) {
        if (!isRequire(node)) return;
        if (node.arguments.length
        && node.arguments[0].type === 'Literal') {
            modules.strings.push(node.arguments[0].value);
            if (opts.ranges) {
                modules.stringRanges.push([node.arguments[0].range[0] + rangeOffset, node.arguments[0].range[1] + rangeOffset]);
            }
        }
        else {
            modules.expressions.push(escodegen.generate(node.arguments[0]));
        }
        if (opts.nodes) modules.nodes.push(node);
    });
    
    return modules;
};
