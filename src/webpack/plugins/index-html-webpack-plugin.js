"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexHtmlWebpackPlugin = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const path = require("path");
const webpack_sources_1 = require("webpack-sources");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
class IndexHtmlWebpackPlugin extends index_html_generator_1.IndexHtmlGenerator {
    constructor(options) {
        super(options);
        this.options = options;
    }
    get compilation() {
        if (this._compilation) {
            return this._compilation;
        }
        throw new Error('compilation is undefined.');
    }
    apply(compiler) {
        compiler.hooks.emit.tapPromise('index-html-webpack-plugin', async (compilation) => {
            var _a;
            this._compilation = compilation;
            // Get all files for selected entrypoints
            const files = [];
            const noModuleFiles = [];
            const moduleFiles = [];
            for (const [entryName, entrypoint] of compilation.entrypoints) {
                const entryFiles = (_a = entrypoint === null || entrypoint === void 0 ? void 0 : entrypoint.getFiles()) === null || _a === void 0 ? void 0 : _a.map((f) => ({
                    name: entryName,
                    file: f,
                    extension: path.extname(f),
                }));
                if (!entryFiles) {
                    continue;
                }
                if (this.options.noModuleEntrypoints.includes(entryName)) {
                    noModuleFiles.push(...entryFiles);
                }
                else if (this.options.moduleEntrypoints.includes(entryName)) {
                    moduleFiles.push(...entryFiles);
                }
                else {
                    files.push(...entryFiles);
                }
            }
            const content = await this.process({
                files,
                noModuleFiles,
                moduleFiles,
                outputPath: this.options.outputPath,
                baseHref: this.options.baseHref,
                lang: this.options.lang,
            });
            compilation.assets[this.options.outputPath] = new webpack_sources_1.RawSource(content);
        });
    }
    async readAsset(path) {
        const data = this.compilation.assets[path].source();
        return typeof data === 'string' ? data : data.toString();
    }
    async readIndex(path) {
        return new Promise((resolve, reject) => {
            this.compilation.inputFileSystem.readFile(path, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.compilation.fileDependencies.add(path);
                resolve(data.toString());
            });
        });
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
