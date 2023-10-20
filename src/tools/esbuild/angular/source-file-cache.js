"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceFileCache = void 0;
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const load_result_cache_1 = require("../load-result-cache");
const USING_WINDOWS = (0, node_os_1.platform)() === 'win32';
const WINDOWS_SEP_REGEXP = new RegExp(`\\${path.win32.sep}`, 'g');
class SourceFileCache extends Map {
    persistentCachePath;
    modifiedFiles = new Set();
    babelFileCache = new Map();
    typeScriptFileCache = new Map();
    loadResultCache = new load_result_cache_1.MemoryLoadResultCache();
    referencedFiles;
    constructor(persistentCachePath) {
        super();
        this.persistentCachePath = persistentCachePath;
    }
    invalidate(files) {
        if (files !== this.modifiedFiles) {
            this.modifiedFiles.clear();
        }
        for (let file of files) {
            this.babelFileCache.delete(file);
            this.typeScriptFileCache.delete((0, node_url_1.pathToFileURL)(file).href);
            this.loadResultCache.invalidate(file);
            // Normalize separators to allow matching TypeScript Host paths
            if (USING_WINDOWS) {
                file = file.replace(WINDOWS_SEP_REGEXP, path.posix.sep);
            }
            this.delete(file);
            this.modifiedFiles.add(file);
        }
    }
}
exports.SourceFileCache = SourceFileCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlLWZpbGUtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FuZ3VsYXIvc291cmNlLWZpbGUtY2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUV6Qyw0REFBNkQ7QUFFN0QsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQkFBUSxHQUFFLEtBQUssT0FBTyxDQUFDO0FBQzdDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWxFLE1BQWEsZUFBZ0IsU0FBUSxHQUEwQjtJQVF4QztJQVBaLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ2xDLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBc0IsQ0FBQztJQUMvQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM3RCxlQUFlLEdBQUcsSUFBSSx5Q0FBcUIsRUFBRSxDQUFDO0lBRXZELGVBQWUsQ0FBcUI7SUFFcEMsWUFBcUIsbUJBQTRCO1FBQy9DLEtBQUssRUFBRSxDQUFDO1FBRFcsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFTO0lBRWpELENBQUM7SUFFRCxVQUFVLENBQUMsS0FBdUI7UUFDaEMsSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLGFBQWEsRUFBRTtZQUNoQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO1NBQzVCO1FBQ0QsS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDdEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFBLHdCQUFhLEVBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDMUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFdEMsK0RBQStEO1lBQy9ELElBQUksYUFBYSxFQUFFO2dCQUNqQixJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ3pEO1lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQixJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM5QjtJQUNILENBQUM7Q0FDRjtBQTlCRCwwQ0E4QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICdub2RlOm9zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5cbmNvbnN0IFVTSU5HX1dJTkRPV1MgPSBwbGF0Zm9ybSgpID09PSAnd2luMzInO1xuY29uc3QgV0lORE9XU19TRVBfUkVHRVhQID0gbmV3IFJlZ0V4cChgXFxcXCR7cGF0aC53aW4zMi5zZXB9YCwgJ2cnKTtcblxuZXhwb3J0IGNsYXNzIFNvdXJjZUZpbGVDYWNoZSBleHRlbmRzIE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+IHtcbiAgcmVhZG9ubHkgbW9kaWZpZWRGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICByZWFkb25seSBiYWJlbEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuICByZWFkb25seSB0eXBlU2NyaXB0RmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZyB8IFVpbnQ4QXJyYXk+KCk7XG4gIHJlYWRvbmx5IGxvYWRSZXN1bHRDYWNoZSA9IG5ldyBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUoKTtcblxuICByZWZlcmVuY2VkRmlsZXM/OiByZWFkb25seSBzdHJpbmdbXTtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSBwZXJzaXN0ZW50Q2FjaGVQYXRoPzogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICBpZiAoZmlsZXMgIT09IHRoaXMubW9kaWZpZWRGaWxlcykge1xuICAgICAgdGhpcy5tb2RpZmllZEZpbGVzLmNsZWFyKCk7XG4gICAgfVxuICAgIGZvciAobGV0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIHRoaXMuYmFiZWxGaWxlQ2FjaGUuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy50eXBlU2NyaXB0RmlsZUNhY2hlLmRlbGV0ZShwYXRoVG9GaWxlVVJMKGZpbGUpLmhyZWYpO1xuICAgICAgdGhpcy5sb2FkUmVzdWx0Q2FjaGUuaW52YWxpZGF0ZShmaWxlKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG4iXX0=