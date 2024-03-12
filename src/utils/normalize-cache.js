"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCacheOptions = void 0;
const path_1 = require("path");
const package_version_1 = require("./package-version");
function hasCacheMetadata(value) {
    return (!!value &&
        typeof value === 'object' &&
        'cli' in value &&
        !!value['cli'] &&
        typeof value['cli'] === 'object' &&
        'cache' in value['cli']);
}
function normalizeCacheOptions(projectMetadata, worspaceRoot) {
    const cacheMetadata = hasCacheMetadata(projectMetadata) ? projectMetadata.cli.cache : {};
    const { enabled = true, environment = 'local', path = '.angular/cache' } = cacheMetadata;
    const isCI = process.env['CI'] === '1' || process.env['CI']?.toLowerCase() === 'true';
    let cacheEnabled = enabled;
    if (cacheEnabled) {
        switch (environment) {
            case 'ci':
                cacheEnabled = isCI;
                break;
            case 'local':
                cacheEnabled = !isCI;
                break;
        }
    }
    const cacheBasePath = (0, path_1.resolve)(worspaceRoot, path);
    return {
        enabled: cacheEnabled,
        basePath: cacheBasePath,
        path: (0, path_1.join)(cacheBasePath, package_version_1.VERSION),
    };
}
exports.normalizeCacheOptions = normalizeCacheOptions;
