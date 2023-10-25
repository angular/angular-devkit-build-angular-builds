"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileReferenceTracker = void 0;
class FileReferenceTracker {
    #referencingFiles = new Map();
    get referencedFiles() {
        return this.#referencingFiles.keys();
    }
    add(containingFile, referencedFiles) {
        for (const file of referencedFiles) {
            if (file === containingFile) {
                // Containing file is already known to the AOT compiler
                continue;
            }
            const referencing = this.#referencingFiles.get(file);
            if (referencing === undefined) {
                this.#referencingFiles.set(file, new Set([containingFile]));
            }
            else {
                referencing.add(containingFile);
            }
        }
    }
    /**
     *
     * @param changed The set of changed files.
     */
    update(changed) {
        // Lazily initialized to avoid unneeded copying if there are no additions to return
        let allChangedFiles;
        // Add referencing files to fully notify the AOT compiler of required component updates
        for (const modifiedFile of changed) {
            const referencing = this.#referencingFiles.get(modifiedFile);
            if (referencing) {
                allChangedFiles ??= new Set(changed);
                for (const referencingFile of referencing) {
                    allChangedFiles.add(referencingFile);
                }
                // Cleanup the stale record which will be updated by new resource transforms
                this.#referencingFiles.delete(modifiedFile);
            }
        }
        return allChangedFiles ?? changed;
    }
}
exports.FileReferenceTracker = FileReferenceTracker;
