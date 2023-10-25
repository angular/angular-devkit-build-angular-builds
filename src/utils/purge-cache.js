"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeStaleBuildCache = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const normalize_cache_1 = require("./normalize-cache");
/** Delete stale cache directories used by previous versions of build-angular. */
async function purgeStaleBuildCache(context) {
    const projectName = context.target?.project;
    if (!projectName) {
        return;
    }
    const metadata = await context.getProjectMetadata(projectName);
    const { basePath, path, enabled } = (0, normalize_cache_1.normalizeCacheOptions)(metadata, context.workspaceRoot);
    if (!enabled || !(0, fs_1.existsSync)(basePath)) {
        return;
    }
    const entriesToDelete = (await fs_1.promises.readdir(basePath, { withFileTypes: true }))
        .filter((d) => (0, path_1.join)(basePath, d.name) !== path && d.isDirectory())
        .map((d) => {
        const subPath = (0, path_1.join)(basePath, d.name);
        return fs_1.promises
            .rm(subPath, { force: true, recursive: true, maxRetries: 3 })
            .catch(() => void 0);
    });
    await Promise.all(entriesToDelete);
}
exports.purgeStaleBuildCache = purgeStaleBuildCache;
