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
    constructor() {
        this.added = new Set();
        this.modified = new Set();
        this.removed = new Set();
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
        ...options,
        disableGlobbing: true,
        ignoreInitial: true,
    });
    const nextQueue = [];
    let currentChanges;
    watcher.on('all', (event, path) => {
        switch (event) {
            case 'add':
                currentChanges !== null && currentChanges !== void 0 ? currentChanges : (currentChanges = new ChangedFiles());
                currentChanges.added.add(path);
                break;
            case 'change':
                currentChanges !== null && currentChanges !== void 0 ? currentChanges : (currentChanges = new ChangedFiles());
                currentChanges.modified.add(path);
                break;
            case 'unlink':
                currentChanges !== null && currentChanges !== void 0 ? currentChanges : (currentChanges = new ChangedFiles());
                currentChanges.removed.add(path);
                break;
            default:
                return;
        }
        const next = nextQueue.shift();
        if (next) {
            const value = currentChanges;
            currentChanges = undefined;
            next(value);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILHVDQUFxQztBQUVyQyxNQUFhLFlBQVk7SUFBekI7UUFDVyxVQUFLLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUMxQixhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUM3QixZQUFPLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQVd2QyxDQUFDO0lBVEMsYUFBYTtRQUNYLE1BQU0sT0FBTyxHQUFHO1lBQ2QsS0FBSyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUM3QixRQUFRLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ25DLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7U0FDbEMsQ0FBQztRQUVGLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzFDLENBQUM7Q0FDRjtBQWRELG9DQWNDO0FBUUQsU0FBZ0IsYUFBYSxDQUFDLE9BSTdCO0lBQ0MsTUFBTSxPQUFPLEdBQUcsSUFBSSxvQkFBUyxDQUFDO1FBQzVCLEdBQUcsT0FBTztRQUNWLGVBQWUsRUFBRSxJQUFJO1FBQ3JCLGFBQWEsRUFBRSxJQUFJO0tBQ3BCLENBQUMsQ0FBQztJQUVILE1BQU0sU0FBUyxHQUF1QyxFQUFFLENBQUM7SUFDekQsSUFBSSxjQUF3QyxDQUFDO0lBRTdDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO1FBQ2hDLFFBQVEsS0FBSyxFQUFFO1lBQ2IsS0FBSyxLQUFLO2dCQUNSLGNBQWMsYUFBZCxjQUFjLGNBQWQsY0FBYyxJQUFkLGNBQWMsR0FBSyxJQUFJLFlBQVksRUFBRSxFQUFDO2dCQUN0QyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDL0IsTUFBTTtZQUNSLEtBQUssUUFBUTtnQkFDWCxjQUFjLGFBQWQsY0FBYyxjQUFkLGNBQWMsSUFBZCxjQUFjLEdBQUssSUFBSSxZQUFZLEVBQUUsRUFBQztnQkFDdEMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xDLE1BQU07WUFDUixLQUFLLFFBQVE7Z0JBQ1gsY0FBYyxhQUFkLGNBQWMsY0FBZCxjQUFjLElBQWQsY0FBYyxHQUFLLElBQUksWUFBWSxFQUFFLEVBQUM7Z0JBQ3RDLGNBQWMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNO1lBQ1I7Z0JBQ0UsT0FBTztTQUNWO1FBRUQsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLElBQUksSUFBSSxFQUFFO1lBQ1IsTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDO1lBQzdCLGNBQWMsR0FBRyxTQUFTLENBQUM7WUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2I7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU87UUFDTCxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUM7WUFDcEIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsS0FBSyxDQUFDLElBQUk7WUFDUixJQUFJLGNBQWMsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDNUMsTUFBTSxNQUFNLEdBQUcsRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFLENBQUM7Z0JBQ3pDLGNBQWMsR0FBRyxTQUFTLENBQUM7Z0JBRTNCLE9BQU8sTUFBTSxDQUFDO2FBQ2Y7WUFFRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQzdCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEYsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsR0FBRyxDQUFDLEtBQUs7WUFDUCxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxNQUFNLENBQUMsS0FBSztZQUNWLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekIsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFLO1lBQ1QsSUFBSTtnQkFDRixNQUFNLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQzthQUN2QjtvQkFBUztnQkFDUixJQUFJLElBQUksQ0FBQztnQkFDVCxPQUFPLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLFNBQVMsRUFBRTtvQkFDL0MsSUFBSSxFQUFFLENBQUM7aUJBQ1I7YUFDRjtRQUNILENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTdFRCxzQ0E2RUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgRlNXYXRjaGVyIH0gZnJvbSAnY2hva2lkYXInO1xuXG5leHBvcnQgY2xhc3MgQ2hhbmdlZEZpbGVzIHtcbiAgcmVhZG9ubHkgYWRkZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgbW9kaWZpZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgcmVtb3ZlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIHRvRGVidWdTdHJpbmcoKTogc3RyaW5nIHtcbiAgICBjb25zdCBjb250ZW50ID0ge1xuICAgICAgYWRkZWQ6IEFycmF5LmZyb20odGhpcy5hZGRlZCksXG4gICAgICBtb2RpZmllZDogQXJyYXkuZnJvbSh0aGlzLm1vZGlmaWVkKSxcbiAgICAgIHJlbW92ZWQ6IEFycmF5LmZyb20odGhpcy5yZW1vdmVkKSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNvbnRlbnQsIG51bGwsIDIpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRXYXRjaGVyIGV4dGVuZHMgQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPENoYW5nZWRGaWxlcz4ge1xuICBhZGQocGF0aHM6IHN0cmluZyB8IHN0cmluZ1tdKTogdm9pZDtcbiAgcmVtb3ZlKHBhdGhzOiBzdHJpbmcgfCBzdHJpbmdbXSk6IHZvaWQ7XG4gIGNsb3NlKCk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXYXRjaGVyKG9wdGlvbnM/OiB7XG4gIHBvbGxpbmc/OiBib29sZWFuO1xuICBpbnRlcnZhbD86IG51bWJlcjtcbiAgaWdub3JlZD86IHN0cmluZ1tdO1xufSk6IEJ1aWxkV2F0Y2hlciB7XG4gIGNvbnN0IHdhdGNoZXIgPSBuZXcgRlNXYXRjaGVyKHtcbiAgICAuLi5vcHRpb25zLFxuICAgIGRpc2FibGVHbG9iYmluZzogdHJ1ZSxcbiAgICBpZ25vcmVJbml0aWFsOiB0cnVlLFxuICB9KTtcblxuICBjb25zdCBuZXh0UXVldWU6ICgodmFsdWU/OiBDaGFuZ2VkRmlsZXMpID0+IHZvaWQpW10gPSBbXTtcbiAgbGV0IGN1cnJlbnRDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMgfCB1bmRlZmluZWQ7XG5cbiAgd2F0Y2hlci5vbignYWxsJywgKGV2ZW50LCBwYXRoKSA9PiB7XG4gICAgc3dpdGNoIChldmVudCkge1xuICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY3VycmVudENoYW5nZXMgPz89IG5ldyBDaGFuZ2VkRmlsZXMoKTtcbiAgICAgICAgY3VycmVudENoYW5nZXMuYWRkZWQuYWRkKHBhdGgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2NoYW5nZSc6XG4gICAgICAgIGN1cnJlbnRDaGFuZ2VzID8/PSBuZXcgQ2hhbmdlZEZpbGVzKCk7XG4gICAgICAgIGN1cnJlbnRDaGFuZ2VzLm1vZGlmaWVkLmFkZChwYXRoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd1bmxpbmsnOlxuICAgICAgICBjdXJyZW50Q2hhbmdlcyA/Pz0gbmV3IENoYW5nZWRGaWxlcygpO1xuICAgICAgICBjdXJyZW50Q2hhbmdlcy5yZW1vdmVkLmFkZChwYXRoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dCA9IG5leHRRdWV1ZS5zaGlmdCgpO1xuICAgIGlmIChuZXh0KSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGN1cnJlbnRDaGFuZ2VzO1xuICAgICAgY3VycmVudENoYW5nZXMgPSB1bmRlZmluZWQ7XG4gICAgICBuZXh0KHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBhc3luYyBuZXh0KCkge1xuICAgICAgaWYgKGN1cnJlbnRDaGFuZ2VzICYmIG5leHRRdWV1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0geyB2YWx1ZTogY3VycmVudENoYW5nZXMgfTtcbiAgICAgICAgY3VycmVudENoYW5nZXMgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIG5leHRRdWV1ZS5wdXNoKCh2YWx1ZSkgPT4gcmVzb2x2ZSh2YWx1ZSA/IHsgdmFsdWUgfSA6IHsgZG9uZTogdHJ1ZSwgdmFsdWUgfSkpO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIGFkZChwYXRocykge1xuICAgICAgd2F0Y2hlci5hZGQocGF0aHMpO1xuICAgIH0sXG5cbiAgICByZW1vdmUocGF0aHMpIHtcbiAgICAgIHdhdGNoZXIudW53YXRjaChwYXRocyk7XG4gICAgfSxcblxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd2F0Y2hlci5jbG9zZSgpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgbGV0IG5leHQ7XG4gICAgICAgIHdoaWxlICgobmV4dCA9IG5leHRRdWV1ZS5zaGlmdCgpKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==