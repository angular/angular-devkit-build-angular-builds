"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEntryPoints = void 0;
const helpers_1 = require("../webpack/utils/helpers");
function generateEntryPoints(appConfig) {
    // Add all styles/scripts, except lazy-loaded ones.
    const extraEntryPoints = (extraEntryPoints, defaultBundleName) => {
        const entryPoints = helpers_1.normalizeExtraEntryPoints(extraEntryPoints, defaultBundleName)
            .filter((entry) => entry.inject)
            .map((entry) => entry.bundleName);
        // remove duplicates
        return [...new Set(entryPoints)];
    };
    const entryPoints = [
        'runtime',
        'polyfills',
        'sw-register',
        ...extraEntryPoints(appConfig.styles, 'styles'),
        ...extraEntryPoints(appConfig.scripts, 'scripts'),
        'vendor',
        'main',
    ];
    const duplicates = [
        ...new Set(entryPoints.filter((x) => entryPoints.indexOf(x) !== entryPoints.lastIndexOf(x))),
    ];
    if (duplicates.length > 0) {
        throw new Error(`Multiple bundles have been named the same: '${duplicates.join(`', '`)}'.`);
    }
    return entryPoints;
}
exports.generateEntryPoints = generateEntryPoints;
