"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generate_index_html_1 = require("./generate-index-html");
function readFile(filename, compilation) {
    return new Promise((resolve, reject) => {
        compilation.inputFileSystem.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            let content;
            if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                // Strip UTF-8 BOM
                content = data.toString('utf8', 3);
            }
            else if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
                // Strip UTF-16 LE BOM
                content = data.toString('utf16le', 2);
            }
            else {
                content = data.toString();
            }
            resolve(content);
        });
    });
}
class IndexHtmlWebpackPlugin {
    constructor(options) {
        this._options = Object.assign({ input: 'index.html', output: 'index.html', entrypoints: ['polyfills', 'main'], noModuleEntrypoints: [], sri: false }, options);
    }
    apply(compiler) {
        compiler.hooks.emit.tapPromise('index-html-webpack-plugin', async (compilation) => {
            // Get input html file
            const inputContent = await readFile(this._options.input, compilation);
            compilation
                .fileDependencies.add(this._options.input);
            const loadOutputFile = (name) => compilation.assets[name].source();
            // Get all files for selected entrypoints
            const unfilteredSortedFiles = [];
            const noModuleFiles = new Set();
            const otherFiles = new Set();
            for (const entryName of this._options.entrypoints) {
                const entrypoint = compilation.entrypoints.get(entryName);
                if (entrypoint && entrypoint.getFiles) {
                    const files = entrypoint.getFiles() || [];
                    unfilteredSortedFiles.push(...files);
                    if (this._options.noModuleEntrypoints.includes(entryName)) {
                        files.forEach(file => noModuleFiles.add(file));
                    }
                    else {
                        files.forEach(file => otherFiles.add(file));
                    }
                }
            }
            // Clean out files that are used in all types of entrypoints
            otherFiles.forEach(file => noModuleFiles.delete(file));
            // If this plugin calls generateIndexHtml it always uses type: 'none' to align with
            // its original behavior.
            const compiledFiles = unfilteredSortedFiles.map(f => ({
                file: f,
                type: 'none',
            }));
            const indexSource = generate_index_html_1.generateIndexHtml({
                input: this._options.input,
                inputContent,
                baseHref: this._options.baseHref,
                deployUrl: this._options.deployUrl,
                sri: this._options.sri,
                unfilteredSortedFiles: compiledFiles,
                noModuleFiles,
                loadOutputFile,
            });
            // Add to compilation assets
            compilation.assets[this._options.output] = indexSource;
        });
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
