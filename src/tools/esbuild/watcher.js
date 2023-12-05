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
const node_path_1 = require("node:path");
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
        followSymlinks: options?.followSymlinks,
        disableGlobbing: true,
        ignoreInitial: true,
    });
    const nextQueue = [];
    let currentChanges;
    let nextWaitTimeout;
    /**
     * We group the current events in a map as on Windows with certain IDE a file contents change can trigger multiple events.
     *
     * Example:
     * rename | 'C:/../src/app/app.component.css'
     * rename | 'C:/../src/app/app.component.css'
     * change | 'C:/../src/app/app.component.css'
     *
     */
    let currentEvents;
    /**
     * Using `watcher.on('all')` does not capture some of events fired when using Visual studio and this does not happen all the time,
     * but only after a file has been changed 3 or more times.
     *
     * Also, some IDEs such as Visual Studio (not VS Code) will fire a rename event instead of unlink when a file is renamed or changed.
     *
     * Example:
     * ```
     * watcher.on('raw')
     * Change 1
     * rename | 'C:/../src/app/app.component.css'
     * rename | 'C:/../src/app/app.component.css'
     * change | 'C:/../src/app/app.component.css'
     *
     * Change 2
     * rename | 'C:/../src/app/app.component.css'
     * rename | 'C:/../src/app/app.component.css'
     * change | 'C:/../src/app/app.component.css'
     *
     * Change 3
     * rename | 'C:/../src/app/app.component.css'
     * rename | 'C:/../src/app/app.component.css'
     * change | 'C:/../src/app/app.component.css'
     *
     * watcher.on('all')
     * Change 1
     * change | 'C:\\..\\src\\app\\app.component.css'
     *
     * Change 2
     * unlink | 'C:\\..\\src\\app\\app.component.css'
     *
     * Change 3
     * ... (Nothing)
     * ```
     */
    watcher
        .on('raw', (event, path, { watchedPath }) => {
        if (watchedPath && !(0, node_path_1.extname)(watchedPath)) {
            // Ignore directories, file changes in directories will be fired seperatly.
            return;
        }
        switch (event) {
            case 'rename':
            case 'change':
                // When polling is enabled `watchedPath` can be undefined.
                // `path` is always normalized unlike `watchedPath`.
                const changedPath = watchedPath ? (0, node_path_1.normalize)(watchedPath) : path;
                handleFileChange(event, changedPath);
                break;
        }
    })
        .on('all', handleFileChange);
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
    function handleFileChange(event, path) {
        switch (event) {
            case 'add':
            case 'change':
            // When using Visual Studio the rename event is fired before a change event when the contents of the file changed
            // or instead of `unlink` when the file has been renamed.
            case 'unlink':
            case 'rename':
                currentEvents ??= new Map();
                currentEvents.set(path, event);
                break;
            default:
                return;
        }
        // Wait 250ms from next change to better capture groups of file save operations.
        if (!nextWaitTimeout) {
            nextWaitTimeout = setTimeout(() => {
                nextWaitTimeout = undefined;
                const next = nextQueue.shift();
                if (next && currentEvents) {
                    const events = currentEvents;
                    currentEvents = undefined;
                    const currentChanges = new ChangedFiles();
                    for (const [path, event] of events) {
                        switch (event) {
                            case 'add':
                                currentChanges.added.add(path);
                                break;
                            case 'change':
                                currentChanges.modified.add(path);
                                break;
                            case 'unlink':
                            case 'rename':
                                currentChanges.removed.add(path);
                                break;
                        }
                    }
                    next(currentChanges);
                }
            }, 250);
            nextWaitTimeout?.unref();
        }
    }
}
exports.createWatcher = createWatcher;
