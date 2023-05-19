"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _MemoryLoadResultCache_loadResults, _MemoryLoadResultCache_fileDependencies;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryLoadResultCache = exports.createCachedLoad = void 0;
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
    constructor() {
        _MemoryLoadResultCache_loadResults.set(this, new Map());
        _MemoryLoadResultCache_fileDependencies.set(this, new Map());
    }
    get(path) {
        return __classPrivateFieldGet(this, _MemoryLoadResultCache_loadResults, "f").get(path);
    }
    async put(path, result) {
        __classPrivateFieldGet(this, _MemoryLoadResultCache_loadResults, "f").set(path, result);
        if (result.watchFiles) {
            for (const watchFile of result.watchFiles) {
                let affected = __classPrivateFieldGet(this, _MemoryLoadResultCache_fileDependencies, "f").get(watchFile);
                if (affected === undefined) {
                    affected = new Set();
                    __classPrivateFieldGet(this, _MemoryLoadResultCache_fileDependencies, "f").set(watchFile, affected);
                }
                affected.add(path);
            }
        }
    }
    invalidate(path) {
        const affected = __classPrivateFieldGet(this, _MemoryLoadResultCache_fileDependencies, "f").get(path);
        let found = false;
        if (affected) {
            affected.forEach((a) => (found || (found = __classPrivateFieldGet(this, _MemoryLoadResultCache_loadResults, "f").delete(a))));
            __classPrivateFieldGet(this, _MemoryLoadResultCache_fileDependencies, "f").delete(path);
        }
        found || (found = __classPrivateFieldGet(this, _MemoryLoadResultCache_loadResults, "f").delete(path));
        return found;
    }
}
exports.MemoryLoadResultCache = MemoryLoadResultCache;
_MemoryLoadResultCache_loadResults = new WeakMap(), _MemoryLoadResultCache_fileDependencies = new WeakMap();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1yZXN1bHQtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvbG9hZC1yZXN1bHQtY2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7O0FBU0gsU0FBZ0IsZ0JBQWdCLENBQzlCLEtBQWtDLEVBQ2xDLFFBQThDO0lBRTlDLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtRQUN2QixPQUFPLFFBQVEsQ0FBQztLQUNqQjtJQUVELE9BQU8sS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO1FBQ3BCLE1BQU0sWUFBWSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdEQsSUFBSSxNQUFNLEdBQW9DLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdEUsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO1lBQ3hCLE1BQU0sR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU5Qix3REFBd0Q7WUFDeEQsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUU7Z0JBQ3pDLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7YUFDdkM7U0FDRjtRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUMsQ0FBQztBQUNKLENBQUM7QUF2QkQsNENBdUJDO0FBRUQsTUFBYSxxQkFBcUI7SUFBbEM7UUFDRSw2Q0FBZSxJQUFJLEdBQUcsRUFBd0IsRUFBQztRQUMvQyxrREFBb0IsSUFBSSxHQUFHLEVBQXVCLEVBQUM7SUFpQ3JELENBQUM7SUEvQkMsR0FBRyxDQUFDLElBQVk7UUFDZCxPQUFPLHVCQUFBLElBQUksMENBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBWSxFQUFFLE1BQW9CO1FBQzFDLHVCQUFBLElBQUksMENBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUNyQixLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7Z0JBQ3pDLElBQUksUUFBUSxHQUFHLHVCQUFBLElBQUksK0NBQWtCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNyRCxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7b0JBQzFCLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNyQix1QkFBQSxJQUFJLCtDQUFrQixDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7aUJBQ2pEO2dCQUNELFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDcEI7U0FDRjtJQUNILENBQUM7SUFFRCxVQUFVLENBQUMsSUFBWTtRQUNyQixNQUFNLFFBQVEsR0FBRyx1QkFBQSxJQUFJLCtDQUFrQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRCxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7UUFFbEIsSUFBSSxRQUFRLEVBQUU7WUFDWixRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBTCxLQUFLLEdBQUssdUJBQUEsSUFBSSwwQ0FBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7WUFDakUsdUJBQUEsSUFBSSwrQ0FBa0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDckM7UUFFRCxLQUFLLEtBQUwsS0FBSyxHQUFLLHVCQUFBLElBQUksMENBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUM7UUFFekMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUFuQ0Qsc0RBbUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT25Mb2FkUmVzdWx0LCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExvYWRSZXN1bHRDYWNoZSB7XG4gIGdldChwYXRoOiBzdHJpbmcpOiBPbkxvYWRSZXN1bHQgfCB1bmRlZmluZWQ7XG4gIHB1dChwYXRoOiBzdHJpbmcsIHJlc3VsdDogT25Mb2FkUmVzdWx0KTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNhY2hlZExvYWQoXG4gIGNhY2hlOiBMb2FkUmVzdWx0Q2FjaGUgfCB1bmRlZmluZWQsXG4gIGNhbGxiYWNrOiBQYXJhbWV0ZXJzPFBsdWdpbkJ1aWxkWydvbkxvYWQnXT5bMV0sXG4pOiBQYXJhbWV0ZXJzPFBsdWdpbkJ1aWxkWydvbkxvYWQnXT5bMV0ge1xuICBpZiAoY2FjaGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBjYWxsYmFjaztcbiAgfVxuXG4gIHJldHVybiBhc3luYyAoYXJncykgPT4ge1xuICAgIGNvbnN0IGxvYWRDYWNoZUtleSA9IGAke2FyZ3MubmFtZXNwYWNlfToke2FyZ3MucGF0aH1gO1xuICAgIGxldCByZXN1bHQ6IE9uTG9hZFJlc3VsdCB8IG51bGwgfCB1bmRlZmluZWQgPSBjYWNoZS5nZXQobG9hZENhY2hlS2V5KTtcblxuICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgY2FsbGJhY2soYXJncyk7XG5cbiAgICAgIC8vIERvIG5vdCBjYWNoZSBudWxsIG9yIHVuZGVmaW5lZCBvciByZXN1bHRzIHdpdGggZXJyb3JzXG4gICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5lcnJvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhd2FpdCBjYWNoZS5wdXQobG9hZENhY2hlS2V5LCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUgaW1wbGVtZW50cyBMb2FkUmVzdWx0Q2FjaGUge1xuICAjbG9hZFJlc3VsdHMgPSBuZXcgTWFwPHN0cmluZywgT25Mb2FkUmVzdWx0PigpO1xuICAjZmlsZURlcGVuZGVuY2llcyA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcblxuICBnZXQocGF0aDogc3RyaW5nKTogT25Mb2FkUmVzdWx0IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy4jbG9hZFJlc3VsdHMuZ2V0KHBhdGgpO1xuICB9XG5cbiAgYXN5bmMgcHV0KHBhdGg6IHN0cmluZywgcmVzdWx0OiBPbkxvYWRSZXN1bHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLiNsb2FkUmVzdWx0cy5zZXQocGF0aCwgcmVzdWx0KTtcbiAgICBpZiAocmVzdWx0LndhdGNoRmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3Qgd2F0Y2hGaWxlIG9mIHJlc3VsdC53YXRjaEZpbGVzKSB7XG4gICAgICAgIGxldCBhZmZlY3RlZCA9IHRoaXMuI2ZpbGVEZXBlbmRlbmNpZXMuZ2V0KHdhdGNoRmlsZSk7XG4gICAgICAgIGlmIChhZmZlY3RlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgYWZmZWN0ZWQgPSBuZXcgU2V0KCk7XG4gICAgICAgICAgdGhpcy4jZmlsZURlcGVuZGVuY2llcy5zZXQod2F0Y2hGaWxlLCBhZmZlY3RlZCk7XG4gICAgICAgIH1cbiAgICAgICAgYWZmZWN0ZWQuYWRkKHBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGludmFsaWRhdGUocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgYWZmZWN0ZWQgPSB0aGlzLiNmaWxlRGVwZW5kZW5jaWVzLmdldChwYXRoKTtcbiAgICBsZXQgZm91bmQgPSBmYWxzZTtcblxuICAgIGlmIChhZmZlY3RlZCkge1xuICAgICAgYWZmZWN0ZWQuZm9yRWFjaCgoYSkgPT4gKGZvdW5kIHx8PSB0aGlzLiNsb2FkUmVzdWx0cy5kZWxldGUoYSkpKTtcbiAgICAgIHRoaXMuI2ZpbGVEZXBlbmRlbmNpZXMuZGVsZXRlKHBhdGgpO1xuICAgIH1cblxuICAgIGZvdW5kIHx8PSB0aGlzLiNsb2FkUmVzdWx0cy5kZWxldGUocGF0aCk7XG5cbiAgICByZXR1cm4gZm91bmQ7XG4gIH1cbn1cbiJdfQ==