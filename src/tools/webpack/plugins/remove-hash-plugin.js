"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveHashPlugin = void 0;
class RemoveHashPlugin {
    options;
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('remove-hash-plugin', (compilation) => {
            const assetPath = (path, data) => {
                const chunkName = data.chunk?.name;
                const { chunkNames, hashFormat } = this.options;
                if (chunkName && chunkNames?.includes(chunkName)) {
                    // Replace hash formats with empty strings.
                    return path.replace(hashFormat.chunk, '').replace(hashFormat.extract, '');
                }
                return path;
            };
            compilation.hooks.assetPath.tap('remove-hash-plugin', assetPath);
        });
    }
}
exports.RemoveHashPlugin = RemoveHashPlugin;
