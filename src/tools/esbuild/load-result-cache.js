"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryLoadResultCache = exports.createCachedLoad = void 0;
const node_path_1 = require("node:path");
function createCachedLoad(cache, callback) {
    if (cache === undefined) {
        return callback;
    }
    return async (args) => {
        const loadCacheKey = `${args.namespace}:${args.path}`;
        let result = cache.get(loadCacheKey);
        if (result === undefined) {
            result = await callback(args);
            // Do not cache null or undefined or results with errors
            if (result && result.errors === undefined) {
                await cache.put(loadCacheKey, result);
            }
        }
        return result;
    };
}
exports.createCachedLoad = createCachedLoad;
class MemoryLoadResultCache {
    #loadResults = new Map();
    #fileDependencies = new Map();
    get(path) {
        return this.#loadResults.get(path);
    }
    async put(path, result) {
        this.#loadResults.set(path, result);
        if (result.watchFiles) {
            for (const watchFile of result.watchFiles) {
                // Normalize the watch file path to ensure OS consistent paths
                const normalizedWatchFile = (0, node_path_1.normalize)(watchFile);
                let affected = this.#fileDependencies.get(normalizedWatchFile);
                if (affected === undefined) {
                    affected = new Set();
                    this.#fileDependencies.set(normalizedWatchFile, affected);
                }
                affected.add(path);
            }
        }
    }
    invalidate(path) {
        const affected = this.#fileDependencies.get(path);
        let found = false;
        if (affected) {
            affected.forEach((a) => (found ||= this.#loadResults.delete(a)));
            this.#fileDependencies.delete(path);
        }
        found ||= this.#loadResults.delete(path);
        return found;
    }
}
exports.MemoryLoadResultCache = MemoryLoadResultCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1yZXN1bHQtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2xvYWQtcmVzdWx0LWNhY2hlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHlDQUFzQztBQU90QyxTQUFnQixnQkFBZ0IsQ0FDOUIsS0FBa0MsRUFDbEMsUUFBOEM7SUFFOUMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1FBQ3ZCLE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBRUQsT0FBTyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDcEIsTUFBTSxZQUFZLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN0RCxJQUFJLE1BQU0sR0FBb0MsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV0RSxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7WUFDeEIsTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTlCLHdEQUF3RDtZQUN4RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtnQkFDekMsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQzthQUN2QztTQUNGO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQXZCRCw0Q0F1QkM7QUFFRCxNQUFhLHFCQUFxQjtJQUNoQyxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7SUFDL0MsaUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7SUFFbkQsR0FBRyxDQUFDLElBQVk7UUFDZCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBRyxDQUFDLElBQVksRUFBRSxNQUFvQjtRQUMxQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDcEMsSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFO1lBQ3JCLEtBQUssTUFBTSxTQUFTLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtnQkFDekMsOERBQThEO2dCQUM5RCxNQUFNLG1CQUFtQixHQUFHLElBQUEscUJBQVMsRUFBQyxTQUFTLENBQUMsQ0FBQztnQkFDakQsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUMvRCxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7b0JBQzFCLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNyQixJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUMzRDtnQkFDRCxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3BCO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsVUFBVSxDQUFDLElBQVk7UUFDckIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRCxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7UUFFbEIsSUFBSSxRQUFRLEVBQUU7WUFDWixRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNyQztRQUVELEtBQUssS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV6QyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7Q0FDRjtBQXJDRCxzREFxQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBub3JtYWxpemUgfSBmcm9tICdub2RlOnBhdGgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExvYWRSZXN1bHRDYWNoZSB7XG4gIGdldChwYXRoOiBzdHJpbmcpOiBPbkxvYWRSZXN1bHQgfCB1bmRlZmluZWQ7XG4gIHB1dChwYXRoOiBzdHJpbmcsIHJlc3VsdDogT25Mb2FkUmVzdWx0KTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNhY2hlZExvYWQoXG4gIGNhY2hlOiBMb2FkUmVzdWx0Q2FjaGUgfCB1bmRlZmluZWQsXG4gIGNhbGxiYWNrOiBQYXJhbWV0ZXJzPFBsdWdpbkJ1aWxkWydvbkxvYWQnXT5bMV0sXG4pOiBQYXJhbWV0ZXJzPFBsdWdpbkJ1aWxkWydvbkxvYWQnXT5bMV0ge1xuICBpZiAoY2FjaGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBjYWxsYmFjaztcbiAgfVxuXG4gIHJldHVybiBhc3luYyAoYXJncykgPT4ge1xuICAgIGNvbnN0IGxvYWRDYWNoZUtleSA9IGAke2FyZ3MubmFtZXNwYWNlfToke2FyZ3MucGF0aH1gO1xuICAgIGxldCByZXN1bHQ6IE9uTG9hZFJlc3VsdCB8IG51bGwgfCB1bmRlZmluZWQgPSBjYWNoZS5nZXQobG9hZENhY2hlS2V5KTtcblxuICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgY2FsbGJhY2soYXJncyk7XG5cbiAgICAgIC8vIERvIG5vdCBjYWNoZSBudWxsIG9yIHVuZGVmaW5lZCBvciByZXN1bHRzIHdpdGggZXJyb3JzXG4gICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5lcnJvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhd2FpdCBjYWNoZS5wdXQobG9hZENhY2hlS2V5LCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUgaW1wbGVtZW50cyBMb2FkUmVzdWx0Q2FjaGUge1xuICAjbG9hZFJlc3VsdHMgPSBuZXcgTWFwPHN0cmluZywgT25Mb2FkUmVzdWx0PigpO1xuICAjZmlsZURlcGVuZGVuY2llcyA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcblxuICBnZXQocGF0aDogc3RyaW5nKTogT25Mb2FkUmVzdWx0IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy4jbG9hZFJlc3VsdHMuZ2V0KHBhdGgpO1xuICB9XG5cbiAgYXN5bmMgcHV0KHBhdGg6IHN0cmluZywgcmVzdWx0OiBPbkxvYWRSZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLiNsb2FkUmVzdWx0cy5zZXQocGF0aCwgcmVzdWx0KTtcbiAgICBpZiAocmVzdWx0LndhdGNoRmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3Qgd2F0Y2hGaWxlIG9mIHJlc3VsdC53YXRjaEZpbGVzKSB7XG4gICAgICAgIC8vIE5vcm1hbGl6ZSB0aGUgd2F0Y2ggZmlsZSBwYXRoIHRvIGVuc3VyZSBPUyBjb25zaXN0ZW50IHBhdGhzXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRXYXRjaEZpbGUgPSBub3JtYWxpemUod2F0Y2hGaWxlKTtcbiAgICAgICAgbGV0IGFmZmVjdGVkID0gdGhpcy4jZmlsZURlcGVuZGVuY2llcy5nZXQobm9ybWFsaXplZFdhdGNoRmlsZSk7XG4gICAgICAgIGlmIChhZmZlY3RlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgYWZmZWN0ZWQgPSBuZXcgU2V0KCk7XG4gICAgICAgICAgdGhpcy4jZmlsZURlcGVuZGVuY2llcy5zZXQobm9ybWFsaXplZFdhdGNoRmlsZSwgYWZmZWN0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIGFmZmVjdGVkLmFkZChwYXRoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpbnZhbGlkYXRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGFmZmVjdGVkID0gdGhpcy4jZmlsZURlcGVuZGVuY2llcy5nZXQocGF0aCk7XG4gICAgbGV0IGZvdW5kID0gZmFsc2U7XG5cbiAgICBpZiAoYWZmZWN0ZWQpIHtcbiAgICAgIGFmZmVjdGVkLmZvckVhY2goKGEpID0+IChmb3VuZCB8fD0gdGhpcy4jbG9hZFJlc3VsdHMuZGVsZXRlKGEpKSk7XG4gICAgICB0aGlzLiNmaWxlRGVwZW5kZW5jaWVzLmRlbGV0ZShwYXRoKTtcbiAgICB9XG5cbiAgICBmb3VuZCB8fD0gdGhpcy4jbG9hZFJlc3VsdHMuZGVsZXRlKHBhdGgpO1xuXG4gICAgcmV0dXJuIGZvdW5kO1xuICB9XG59XG4iXX0=