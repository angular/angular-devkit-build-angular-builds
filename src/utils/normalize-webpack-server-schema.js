"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const normalize_file_replacements_1 = require("./normalize-file-replacements");
const normalize_optimization_1 = require("./normalize-optimization");
const normalize_source_maps_1 = require("./normalize-source-maps");
function normalizeWebpackServerSchema(host, root, projectRoot, sourceRoot, options) {
    const syncHost = new core_1.virtualFs.SyncDelegateHost(host);
    const normalizedSourceMapOptions = normalize_source_maps_1.normalizeSourceMaps(options.sourceMap || {});
    normalizedSourceMapOptions.vendor =
        normalizedSourceMapOptions.vendor || options.vendorSourceMap || false;
    const optimization = options.hasOwnProperty('optimization') && options.optimization || {};
    return {
        ...options,
        fileReplacements: normalize_file_replacements_1.normalizeFileReplacements(options.fileReplacements || [], syncHost, root),
        optimization: normalize_optimization_1.normalizeOptimization(optimization),
        sourceMap: normalizedSourceMapOptions,
    };
}
exports.normalizeWebpackServerSchema = normalizeWebpackServerSchema;
