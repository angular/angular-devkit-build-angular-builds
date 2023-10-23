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
    get watchFiles() {
        return [...this.#loadResults.keys(), ...this.#fileDependencies.keys()];
    }
}
exports.MemoryLoadResultCache = MemoryLoadResultCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1yZXN1bHQtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2xvYWQtcmVzdWx0LWNhY2hlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHlDQUFzQztBQVF0QyxTQUFnQixnQkFBZ0IsQ0FDOUIsS0FBa0MsRUFDbEMsUUFBOEM7SUFFOUMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1FBQ3ZCLE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBRUQsT0FBTyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDcEIsTUFBTSxZQUFZLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN0RCxJQUFJLE1BQU0sR0FBb0MsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV0RSxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7WUFDeEIsTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTlCLHdEQUF3RDtZQUN4RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtnQkFDekMsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQzthQUN2QztTQUNGO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQXZCRCw0Q0F1QkM7QUFFRCxNQUFhLHFCQUFxQjtJQUNoQyxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXdCLENBQUM7SUFDL0MsaUJBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7SUFFbkQsR0FBRyxDQUFDLElBQVk7UUFDZCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBRyxDQUFDLElBQVksRUFBRSxNQUFvQjtRQUMxQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDcEMsSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFO1lBQ3JCLEtBQUssTUFBTSxTQUFTLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtnQkFDekMsOERBQThEO2dCQUM5RCxNQUFNLG1CQUFtQixHQUFHLElBQUEscUJBQVMsRUFBQyxTQUFTLENBQUMsQ0FBQztnQkFDakQsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUMvRCxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7b0JBQzFCLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNyQixJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUMzRDtnQkFDRCxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3BCO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsVUFBVSxDQUFDLElBQVk7UUFDckIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRCxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7UUFFbEIsSUFBSSxRQUFRLEVBQUU7WUFDWixRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNyQztRQUVELEtBQUssS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV6QyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxJQUFJLFVBQVU7UUFDWixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDekUsQ0FBQztDQUNGO0FBekNELHNEQXlDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IG5vcm1hbGl6ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9hZFJlc3VsdENhY2hlIHtcbiAgZ2V0KHBhdGg6IHN0cmluZyk6IE9uTG9hZFJlc3VsdCB8IHVuZGVmaW5lZDtcbiAgcHV0KHBhdGg6IHN0cmluZywgcmVzdWx0OiBPbkxvYWRSZXN1bHQpOiBQcm9taXNlPHZvaWQ+O1xuICByZWFkb25seSB3YXRjaEZpbGVzOiBSZWFkb25seUFycmF5PHN0cmluZz47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYWNoZWRMb2FkKFxuICBjYWNoZTogTG9hZFJlc3VsdENhY2hlIHwgdW5kZWZpbmVkLFxuICBjYWxsYmFjazogUGFyYW1ldGVyczxQbHVnaW5CdWlsZFsnb25Mb2FkJ10+WzFdLFxuKTogUGFyYW1ldGVyczxQbHVnaW5CdWlsZFsnb25Mb2FkJ10+WzFdIHtcbiAgaWYgKGNhY2hlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gY2FsbGJhY2s7XG4gIH1cblxuICByZXR1cm4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICBjb25zdCBsb2FkQ2FjaGVLZXkgPSBgJHthcmdzLm5hbWVzcGFjZX06JHthcmdzLnBhdGh9YDtcbiAgICBsZXQgcmVzdWx0OiBPbkxvYWRSZXN1bHQgfCBudWxsIHwgdW5kZWZpbmVkID0gY2FjaGUuZ2V0KGxvYWRDYWNoZUtleSk7XG5cbiAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGNhbGxiYWNrKGFyZ3MpO1xuXG4gICAgICAvLyBEbyBub3QgY2FjaGUgbnVsbCBvciB1bmRlZmluZWQgb3IgcmVzdWx0cyB3aXRoIGVycm9yc1xuICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuZXJyb3JzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXdhaXQgY2FjaGUucHV0KGxvYWRDYWNoZUtleSwgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgTWVtb3J5TG9hZFJlc3VsdENhY2hlIGltcGxlbWVudHMgTG9hZFJlc3VsdENhY2hlIHtcbiAgI2xvYWRSZXN1bHRzID0gbmV3IE1hcDxzdHJpbmcsIE9uTG9hZFJlc3VsdD4oKTtcbiAgI2ZpbGVEZXBlbmRlbmNpZXMgPSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG5cbiAgZ2V0KHBhdGg6IHN0cmluZyk6IE9uTG9hZFJlc3VsdCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuI2xvYWRSZXN1bHRzLmdldChwYXRoKTtcbiAgfVxuXG4gIGFzeW5jIHB1dChwYXRoOiBzdHJpbmcsIHJlc3VsdDogT25Mb2FkUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy4jbG9hZFJlc3VsdHMuc2V0KHBhdGgsIHJlc3VsdCk7XG4gICAgaWYgKHJlc3VsdC53YXRjaEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IHdhdGNoRmlsZSBvZiByZXN1bHQud2F0Y2hGaWxlcykge1xuICAgICAgICAvLyBOb3JtYWxpemUgdGhlIHdhdGNoIGZpbGUgcGF0aCB0byBlbnN1cmUgT1MgY29uc2lzdGVudCBwYXRoc1xuICAgICAgICBjb25zdCBub3JtYWxpemVkV2F0Y2hGaWxlID0gbm9ybWFsaXplKHdhdGNoRmlsZSk7XG4gICAgICAgIGxldCBhZmZlY3RlZCA9IHRoaXMuI2ZpbGVEZXBlbmRlbmNpZXMuZ2V0KG5vcm1hbGl6ZWRXYXRjaEZpbGUpO1xuICAgICAgICBpZiAoYWZmZWN0ZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGFmZmVjdGVkID0gbmV3IFNldCgpO1xuICAgICAgICAgIHRoaXMuI2ZpbGVEZXBlbmRlbmNpZXMuc2V0KG5vcm1hbGl6ZWRXYXRjaEZpbGUsIGFmZmVjdGVkKTtcbiAgICAgICAgfVxuICAgICAgICBhZmZlY3RlZC5hZGQocGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaW52YWxpZGF0ZShwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBhZmZlY3RlZCA9IHRoaXMuI2ZpbGVEZXBlbmRlbmNpZXMuZ2V0KHBhdGgpO1xuICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuXG4gICAgaWYgKGFmZmVjdGVkKSB7XG4gICAgICBhZmZlY3RlZC5mb3JFYWNoKChhKSA9PiAoZm91bmQgfHw9IHRoaXMuI2xvYWRSZXN1bHRzLmRlbGV0ZShhKSkpO1xuICAgICAgdGhpcy4jZmlsZURlcGVuZGVuY2llcy5kZWxldGUocGF0aCk7XG4gICAgfVxuXG4gICAgZm91bmQgfHw9IHRoaXMuI2xvYWRSZXN1bHRzLmRlbGV0ZShwYXRoKTtcblxuICAgIHJldHVybiBmb3VuZDtcbiAgfVxuXG4gIGdldCB3YXRjaEZpbGVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuI2xvYWRSZXN1bHRzLmtleXMoKSwgLi4udGhpcy4jZmlsZURlcGVuZGVuY2llcy5rZXlzKCldO1xuICB9XG59XG4iXX0=