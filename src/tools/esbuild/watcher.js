"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWatcher = exports.ChangedFiles = void 0;
const chokidar_1 = require("chokidar");
class ChangedFiles {
    added = new Set();
    modified = new Set();
    removed = new Set();
    get all() {
        return [...this.added, ...this.modified, ...this.removed];
    }
    toDebugString() {
        const content = {
            added: Array.from(this.added),
            modified: Array.from(this.modified),
            removed: Array.from(this.removed),
        };
        return JSON.stringify(content, null, 2);
    }
}
exports.ChangedFiles = ChangedFiles;
function createWatcher(options) {
    const watcher = new chokidar_1.FSWatcher({
        usePolling: options?.polling,
        interval: options?.interval,
        ignored: options?.ignored,
        disableGlobbing: true,
        ignoreInitial: true,
    });
    const nextQueue = [];
    let currentChanges;
    let nextWaitTimeout;
    watcher.on('all', (event, path) => {
        switch (event) {
            case 'add':
                currentChanges ??= new ChangedFiles();
                currentChanges.added.add(path);
                break;
            case 'change':
                currentChanges ??= new ChangedFiles();
                currentChanges.modified.add(path);
                break;
            case 'unlink':
                currentChanges ??= new ChangedFiles();
                currentChanges.removed.add(path);
                break;
            default:
                return;
        }
        // Wait 250ms from next change to better capture groups of file save operations.
        if (!nextWaitTimeout) {
            nextWaitTimeout = setTimeout(() => {
                nextWaitTimeout = undefined;
                const next = nextQueue.shift();
                if (next) {
                    const value = currentChanges;
                    currentChanges = undefined;
                    next(value);
                }
            }, 250);
            nextWaitTimeout?.unref();
        }
    });
    return {
        [Symbol.asyncIterator]() {
            return this;
        },
        async next() {
            if (currentChanges && nextQueue.length === 0) {
                const result = { value: currentChanges };
                currentChanges = undefined;
                return result;
            }
            return new Promise((resolve) => {
                nextQueue.push((value) => resolve(value ? { value } : { done: true, value }));
            });
        },
        add(paths) {
            watcher.add(paths);
        },
        remove(paths) {
            watcher.unwatch(paths);
        },
        async close() {
            try {
                await watcher.close();
                if (nextWaitTimeout) {
                    clearTimeout(nextWaitTimeout);
                }
            }
            finally {
                let next;
                while ((next = nextQueue.shift()) !== undefined) {
                    next();
                }
            }
        },
    };
}
exports.createWatcher = createWatcher;
