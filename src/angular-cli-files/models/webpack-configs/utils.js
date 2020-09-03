"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPolyfillsEntry = exports.getEsVersionForFileName = exports.getSourceMapDevTool = exports.normalizeExtraEntryPoints = exports.getOutputHashFormat = void 0;
const core_1 = require("@angular-devkit/core");
const webpack_1 = require("webpack");
const typescript_1 = require("typescript");
function getOutputHashFormat(option, length = 20) {
    const hashFormats = {
        none: { chunk: '', extract: '', file: '', script: '' },
        media: { chunk: '', extract: '', file: `.[hash:${length}]`, script: '' },
        bundles: {
            chunk: `.[chunkhash:${length}]`,
            extract: `.[contenthash:${length}]`,
            file: '',
            script: `.[hash:${length}]`,
        },
        all: {
            chunk: `.[chunkhash:${length}]`,
            extract: `.[contenthash:${length}]`,
            file: `.[hash:${length}]`,
            script: `.[hash:${length}]`,
        },
    };
    return hashFormats[option] || hashFormats['none'];
}
exports.getOutputHashFormat = getOutputHashFormat;
function normalizeExtraEntryPoints(extraEntryPoints, defaultBundleName) {
    return extraEntryPoints.map(entry => {
        if (typeof entry === 'string') {
            return { input: entry, inject: true, bundleName: defaultBundleName };
        }
        const { inject = true, ...newEntry } = entry;
        let bundleName;
        if (entry.bundleName) {
            bundleName = entry.bundleName;
        }
        else if (!inject) {
            // Lazy entry points use the file name as bundle name.
            bundleName = core_1.basename(core_1.normalize(entry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')));
        }
        else {
            bundleName = defaultBundleName;
        }
        return { ...newEntry, inject, bundleName };
    });
}
exports.normalizeExtraEntryPoints = normalizeExtraEntryPoints;
function getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, hiddenSourceMap = false, inlineSourceMap = false, vendorSourceMap = false) {
    const include = [];
    if (scriptsSourceMap) {
        include.push(/js$/);
    }
    if (stylesSourceMap) {
        include.push(/css$/);
    }
    return new webpack_1.SourceMapDevToolPlugin({
        filename: inlineSourceMap ? undefined : '[file].map',
        include,
        // We want to set sourceRoot to  `webpack:///` for non
        // inline sourcemaps as otherwise paths to sourcemaps will be broken in browser
        // `webpack:///` is needed for Visual Studio breakpoints to work properly as currently
        // there is no way to set the 'webRoot'
        sourceRoot: 'webpack:///',
        moduleFilenameTemplate: '[resource-path]',
        append: hiddenSourceMap ? false : undefined,
        exclude: vendorSourceMap ? undefined : /vendor.*\.js/,
    });
}
exports.getSourceMapDevTool = getSourceMapDevTool;
/**
 * Returns an ES version file suffix to differentiate between various builds.
 */
function getEsVersionForFileName(scriptTargetOverride, esVersionInFileName = false) {
    if (!esVersionInFileName || scriptTargetOverride === undefined) {
        return '';
    }
    if (scriptTargetOverride === typescript_1.ScriptTarget.ESNext) {
        return '-esnext';
    }
    return '-' + typescript_1.ScriptTarget[scriptTargetOverride].toLowerCase();
}
exports.getEsVersionForFileName = getEsVersionForFileName;
function isPolyfillsEntry(name) {
    return name === 'polyfills' || name === 'polyfills-es5';
}
exports.isPolyfillsEntry = isPolyfillsEntry;
