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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1yZXN1bHQtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2xvYWQtcmVzdWx0LWNhY2hlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7OztBQVNILFNBQWdCLGdCQUFnQixDQUM5QixLQUFrQyxFQUNsQyxRQUE4QztJQUU5QyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7UUFDdkIsT0FBTyxRQUFRLENBQUM7S0FDakI7SUFFRCxPQUFPLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUNwQixNQUFNLFlBQVksR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3RELElBQUksTUFBTSxHQUFvQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXRFLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtZQUN4QixNQUFNLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFOUIsd0RBQXdEO1lBQ3hELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFO2dCQUN6QyxNQUFNLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZDO1NBQ0Y7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDLENBQUM7QUFDSixDQUFDO0FBdkJELDRDQXVCQztBQUVELE1BQWEscUJBQXFCO0lBQWxDO1FBQ0UsNkNBQWUsSUFBSSxHQUFHLEVBQXdCLEVBQUM7UUFDL0Msa0RBQW9CLElBQUksR0FBRyxFQUF1QixFQUFDO0lBaUNyRCxDQUFDO0lBL0JDLEdBQUcsQ0FBQyxJQUFZO1FBQ2QsT0FBTyx1QkFBQSxJQUFJLDBDQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBRyxDQUFDLElBQVksRUFBRSxNQUFvQjtRQUMxQyx1QkFBQSxJQUFJLDBDQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNwQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7WUFDckIsS0FBSyxNQUFNLFNBQVMsSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFO2dCQUN6QyxJQUFJLFFBQVEsR0FBRyx1QkFBQSxJQUFJLCtDQUFrQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDckQsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO29CQUMxQixRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztvQkFDckIsdUJBQUEsSUFBSSwrQ0FBa0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUNqRDtnQkFDRCxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3BCO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsVUFBVSxDQUFDLElBQVk7UUFDckIsTUFBTSxRQUFRLEdBQUcsdUJBQUEsSUFBSSwrQ0FBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEQsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBRWxCLElBQUksUUFBUSxFQUFFO1lBQ1osUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLEtBQUwsS0FBSyxHQUFLLHVCQUFBLElBQUksMENBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO1lBQ2pFLHVCQUFBLElBQUksK0NBQWtCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3JDO1FBRUQsS0FBSyxLQUFMLEtBQUssR0FBSyx1QkFBQSxJQUFJLDBDQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFDO1FBRXpDLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBbkNELHNEQW1DQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcblxuZXhwb3J0IGludGVyZmFjZSBMb2FkUmVzdWx0Q2FjaGUge1xuICBnZXQocGF0aDogc3RyaW5nKTogT25Mb2FkUmVzdWx0IHwgdW5kZWZpbmVkO1xuICBwdXQocGF0aDogc3RyaW5nLCByZXN1bHQ6IE9uTG9hZFJlc3VsdCk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYWNoZWRMb2FkKFxuICBjYWNoZTogTG9hZFJlc3VsdENhY2hlIHwgdW5kZWZpbmVkLFxuICBjYWxsYmFjazogUGFyYW1ldGVyczxQbHVnaW5CdWlsZFsnb25Mb2FkJ10+WzFdLFxuKTogUGFyYW1ldGVyczxQbHVnaW5CdWlsZFsnb25Mb2FkJ10+WzFdIHtcbiAgaWYgKGNhY2hlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gY2FsbGJhY2s7XG4gIH1cblxuICByZXR1cm4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICBjb25zdCBsb2FkQ2FjaGVLZXkgPSBgJHthcmdzLm5hbWVzcGFjZX06JHthcmdzLnBhdGh9YDtcbiAgICBsZXQgcmVzdWx0OiBPbkxvYWRSZXN1bHQgfCBudWxsIHwgdW5kZWZpbmVkID0gY2FjaGUuZ2V0KGxvYWRDYWNoZUtleSk7XG5cbiAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGNhbGxiYWNrKGFyZ3MpO1xuXG4gICAgICAvLyBEbyBub3QgY2FjaGUgbnVsbCBvciB1bmRlZmluZWQgb3IgcmVzdWx0cyB3aXRoIGVycm9yc1xuICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuZXJyb3JzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXdhaXQgY2FjaGUucHV0KGxvYWRDYWNoZUtleSwgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgTWVtb3J5TG9hZFJlc3VsdENhY2hlIGltcGxlbWVudHMgTG9hZFJlc3VsdENhY2hlIHtcbiAgI2xvYWRSZXN1bHRzID0gbmV3IE1hcDxzdHJpbmcsIE9uTG9hZFJlc3VsdD4oKTtcbiAgI2ZpbGVEZXBlbmRlbmNpZXMgPSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG5cbiAgZ2V0KHBhdGg6IHN0cmluZyk6IE9uTG9hZFJlc3VsdCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuI2xvYWRSZXN1bHRzLmdldChwYXRoKTtcbiAgfVxuXG4gIGFzeW5jIHB1dChwYXRoOiBzdHJpbmcsIHJlc3VsdDogT25Mb2FkUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy4jbG9hZFJlc3VsdHMuc2V0KHBhdGgsIHJlc3VsdCk7XG4gICAgaWYgKHJlc3VsdC53YXRjaEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IHdhdGNoRmlsZSBvZiByZXN1bHQud2F0Y2hGaWxlcykge1xuICAgICAgICBsZXQgYWZmZWN0ZWQgPSB0aGlzLiNmaWxlRGVwZW5kZW5jaWVzLmdldCh3YXRjaEZpbGUpO1xuICAgICAgICBpZiAoYWZmZWN0ZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGFmZmVjdGVkID0gbmV3IFNldCgpO1xuICAgICAgICAgIHRoaXMuI2ZpbGVEZXBlbmRlbmNpZXMuc2V0KHdhdGNoRmlsZSwgYWZmZWN0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIGFmZmVjdGVkLmFkZChwYXRoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpbnZhbGlkYXRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGFmZmVjdGVkID0gdGhpcy4jZmlsZURlcGVuZGVuY2llcy5nZXQocGF0aCk7XG4gICAgbGV0IGZvdW5kID0gZmFsc2U7XG5cbiAgICBpZiAoYWZmZWN0ZWQpIHtcbiAgICAgIGFmZmVjdGVkLmZvckVhY2goKGEpID0+IChmb3VuZCB8fD0gdGhpcy4jbG9hZFJlc3VsdHMuZGVsZXRlKGEpKSk7XG4gICAgICB0aGlzLiNmaWxlRGVwZW5kZW5jaWVzLmRlbGV0ZShwYXRoKTtcbiAgICB9XG5cbiAgICBmb3VuZCB8fD0gdGhpcy4jbG9hZFJlc3VsdHMuZGVsZXRlKHBhdGgpO1xuXG4gICAgcmV0dXJuIGZvdW5kO1xuICB9XG59XG4iXX0=