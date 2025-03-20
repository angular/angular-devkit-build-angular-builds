"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCacheOptions = normalizeCacheOptions;
const node_path_1 = require("node:path");
/** Version placeholder is replaced during the build process with actual package version */
const VERSION = '20.0.0-next.2+sha-d98aa28';
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
    const cacheBasePath = (0, node_path_1.resolve)(worspaceRoot, path);
    return {
        enabled: cacheEnabled,
        basePath: cacheBasePath,
        path: (0, node_path_1.join)(cacheBasePath, VERSION),
    };
}
