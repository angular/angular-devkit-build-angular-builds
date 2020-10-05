"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentIndexHtml = void 0;
const crypto_1 = require("crypto");
const webpack_sources_1 = require("webpack-sources");
const parse5 = require('parse5');
const treeAdapter = require('parse5-htmlparser2-tree-adapter');
/*
 * Helper function used by the IndexHtmlWebpackPlugin.
 * Can also be directly used by builder, e. g. in order to generate an index.html
 * after processing several configurations in order to build different sets of
 * bundles for differential serving.
 */
// tslint:disable-next-line: no-big-function
async function augmentIndexHtml(params) {
    var _a, _b, _c, _d;
    const { loadOutputFile, files, noModuleFiles = [], moduleFiles = [], entrypoints } = params;
    let { crossOrigin = 'none' } = params;
    if (params.sri && crossOrigin === 'none') {
        crossOrigin = 'anonymous';
    }
    const stylesheets = new Set();
    const scripts = new Set();
    // Sort files in the order we want to insert them by entrypoint and dedupes duplicates
    const mergedFiles = [...moduleFiles, ...noModuleFiles, ...files];
    for (const entrypoint of entrypoints) {
        for (const { extension, file, name } of mergedFiles) {
            if (name !== entrypoint) {
                continue;
            }
            switch (extension) {
                case '.js':
                    scripts.add(file);
                    break;
                case '.css':
                    stylesheets.add(file);
                    break;
            }
        }
    }
    // Find the head and body elements
    const document = parse5.parse(params.inputContent, {
        treeAdapter,
        sourceCodeLocationInfo: true,
    });
    // tslint:disable: no-any
    const htmlElement = document.children.find((c) => c.name === 'html');
    const headElement = htmlElement.children.find((c) => c.name === 'head');
    const bodyElement = htmlElement.children.find((c) => c.name === 'body');
    // tslint:enable: no-any
    if (!headElement || !bodyElement) {
        throw new Error('Missing head and/or body elements');
    }
    // Inject into the html
    const indexSource = new webpack_sources_1.ReplaceSource(new webpack_sources_1.RawSource(params.inputContent), params.input);
    const scriptsElements = treeAdapter.createDocumentFragment();
    for (const script of scripts) {
        const attrs = [
            { name: 'src', value: (params.deployUrl || '') + script },
        ];
        if (crossOrigin !== 'none') {
            attrs.push({ name: 'crossorigin', value: crossOrigin });
        }
        // We want to include nomodule or module when a file is not common amongs all
        // such as runtime.js
        const scriptPredictor = ({ file }) => file === script;
        if (!files.some(scriptPredictor)) {
            // in some cases for differential loading file with the same name is available in both
            // nomodule and module such as scripts.js
            // we shall not add these attributes if that's the case
            const isNoModuleType = noModuleFiles.some(scriptPredictor);
            const isModuleType = moduleFiles.some(scriptPredictor);
            if (isNoModuleType && !isModuleType) {
                attrs.push({ name: 'nomodule', value: '' }, { name: 'defer', value: '' });
            }
            else if (isModuleType && !isNoModuleType) {
                attrs.push({ name: 'type', value: 'module' });
            }
            else {
                attrs.push({ name: 'defer', value: '' });
            }
        }
        else {
            attrs.push({ name: 'defer', value: '' });
        }
        if (params.sri) {
            const content = await loadOutputFile(script);
            attrs.push(_generateSriAttributes(content));
        }
        const baseElement = treeAdapter.createElement('script', undefined, attrs);
        treeAdapter.setTemplateContent(scriptsElements, baseElement);
    }
    indexSource.insert(
    // parse5 does not provide locations if malformed html is present
    ((_b = (_a = bodyElement.sourceCodeLocation) === null || _a === void 0 ? void 0 : _a.endTag) === null || _b === void 0 ? void 0 : _b.startOffset) || params.inputContent.indexOf('</body>'), parse5.serialize(scriptsElements, { treeAdapter }).replace(/\=""/g, ''));
    // Adjust base href if specified
    if (typeof params.baseHref == 'string') {
        // tslint:disable-next-line: no-any
        let baseElement = headElement.children.find((t) => t.name === 'base');
        const baseFragment = treeAdapter.createDocumentFragment();
        if (!baseElement) {
            baseElement = treeAdapter.createElement('base', undefined, [
                { name: 'href', value: params.baseHref },
            ]);
            treeAdapter.setTemplateContent(baseFragment, baseElement);
            indexSource.insert(headElement.sourceCodeLocation.startTag.endOffset, parse5.serialize(baseFragment, { treeAdapter }));
        }
        else {
            baseElement.attribs['href'] = params.baseHref;
            treeAdapter.setTemplateContent(baseFragment, baseElement);
            indexSource.replace(baseElement.sourceCodeLocation.startOffset, baseElement.sourceCodeLocation.endOffset - 1, parse5.serialize(baseFragment, { treeAdapter }));
        }
    }
    const styleElements = treeAdapter.createDocumentFragment();
    for (const stylesheet of stylesheets) {
        const attrs = [
            { name: 'rel', value: 'stylesheet' },
            { name: 'href', value: (params.deployUrl || '') + stylesheet },
        ];
        if (crossOrigin !== 'none') {
            attrs.push({ name: 'crossorigin', value: crossOrigin });
        }
        if (params.sri) {
            const content = await loadOutputFile(stylesheet);
            attrs.push(_generateSriAttributes(content));
        }
        const element = treeAdapter.createElement('link', undefined, attrs);
        treeAdapter.setTemplateContent(styleElements, element);
    }
    indexSource.insert(
    // parse5 does not provide locations if malformed html is present
    ((_d = (_c = headElement.sourceCodeLocation) === null || _c === void 0 ? void 0 : _c.endTag) === null || _d === void 0 ? void 0 : _d.startOffset) || params.inputContent.indexOf('</head>'), parse5.serialize(styleElements, { treeAdapter }));
    // Adjust document locale if specified
    if (typeof params.lang == 'string') {
        const htmlFragment = treeAdapter.createDocumentFragment();
        htmlElement.attribs['lang'] = params.lang;
        // we want only openning tag
        htmlElement.children = [];
        treeAdapter.setTemplateContent(htmlFragment, htmlElement);
        indexSource.replace(htmlElement.sourceCodeLocation.startTag.startOffset, htmlElement.sourceCodeLocation.startTag.endOffset - 1, parse5.serialize(htmlFragment, { treeAdapter }).replace('</html>', ''));
    }
    return indexSource.source();
}
exports.augmentIndexHtml = augmentIndexHtml;
function _generateSriAttributes(content) {
    const algo = 'sha384';
    const hash = crypto_1.createHash(algo)
        .update(content, 'utf8')
        .digest('base64');
    return { name: 'integrity', value: `${algo}-${hash}` };
}
