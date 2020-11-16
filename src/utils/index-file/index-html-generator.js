"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexHtmlGenerator = void 0;
const path_1 = require("path");
const fs_1 = require("../fs");
const strip_bom_1 = require("../strip-bom");
const augment_index_html_1 = require("./augment-index-html");
const inline_fonts_1 = require("./inline-fonts");
class IndexHtmlGenerator {
    constructor(options) {
        var _a;
        this.options = options;
        const extraPlugins = [];
        if ((_a = this.options.optimization) === null || _a === void 0 ? void 0 : _a.fonts.inline) {
            extraPlugins.push(inlineFontsPlugin(this));
        }
        this.plugins = [
            augmentIndexHtmlPlugin(this),
            ...extraPlugins,
            postTransformPlugin(this),
        ];
    }
    async process(options) {
        let html = strip_bom_1.stripBom(await this.readIndex(this.options.indexPath));
        for (const plugin of this.plugins) {
            html = await plugin(html, options);
        }
        return html;
    }
    async readAsset(path) {
        return fs_1.readFile(path, 'utf-8');
    }
    async readIndex(path) {
        return fs_1.readFile(path, 'utf-8');
    }
}
exports.IndexHtmlGenerator = IndexHtmlGenerator;
function augmentIndexHtmlPlugin(generator) {
    const { deployUrl, crossOrigin, sri = false, entrypoints, } = generator.options;
    return async (html, options) => {
        const { lang, baseHref, outputPath = '', noModuleFiles, files, moduleFiles, } = options;
        return augment_index_html_1.augmentIndexHtml({
            html,
            baseHref,
            deployUrl,
            crossOrigin,
            sri,
            lang,
            entrypoints,
            loadOutputFile: filePath => generator.readAsset(path_1.join(outputPath, filePath)),
            noModuleFiles,
            moduleFiles,
            files,
        });
    };
}
function inlineFontsPlugin({ options }) {
    var _a;
    const inlineFontsProcessor = new inline_fonts_1.InlineFontsProcessor({
        minifyInlinedCSS: !!((_a = options.optimization) === null || _a === void 0 ? void 0 : _a.styles),
        WOFFSupportNeeded: options.WOFFSupportNeeded,
    });
    return async (html) => inlineFontsProcessor.process(html);
}
function postTransformPlugin({ options }) {
    return async (html) => options.postTransform ? options.postTransform(html) : html;
}
