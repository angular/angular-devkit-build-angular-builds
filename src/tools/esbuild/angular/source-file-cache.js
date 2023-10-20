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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlLWZpbGUtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FuZ3VsYXIvc291cmNlLWZpbGUtY2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUV6Qyw0REFBNkQ7QUFFN0QsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQkFBUSxHQUFFLEtBQUssT0FBTyxDQUFDO0FBQzdDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWxFLE1BQWEsZUFBZ0IsU0FBUSxHQUEwQjtJQVF4QztJQVBaLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ2xDLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBc0IsQ0FBQztJQUMvQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM3RCxlQUFlLEdBQUcsSUFBSSx5Q0FBcUIsRUFBRSxDQUFDO0lBRXZELGVBQWUsQ0FBcUI7SUFFcEMsWUFBcUIsbUJBQTRCO1FBQy9DLEtBQUssRUFBRSxDQUFDO1FBRFcsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFTO0lBRWpELENBQUM7SUFFRCxVQUFVLENBQUMsS0FBdUI7UUFDaEMsSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLGFBQWEsRUFBRTtZQUNoQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO1NBQzVCO1FBQ0QsS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDdEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFBLHdCQUFhLEVBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDMUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFdEMsK0RBQStEO1lBQy9ELElBQUksYUFBYSxFQUFFO2dCQUNqQixJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ3pEO1lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQixJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM5QjtJQUNILENBQUM7Q0FDRjtBQTlCRCwwQ0E4QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICdub2RlOm9zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IE1lbW9yeUxvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuY29uc3QgVVNJTkdfV0lORE9XUyA9IHBsYXRmb3JtKCkgPT09ICd3aW4zMic7XG5jb25zdCBXSU5ET1dTX1NFUF9SRUdFWFAgPSBuZXcgUmVnRXhwKGBcXFxcJHtwYXRoLndpbjMyLnNlcH1gLCAnZycpO1xuXG5leHBvcnQgY2xhc3MgU291cmNlRmlsZUNhY2hlIGV4dGVuZHMgTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT4ge1xuICByZWFkb25seSBtb2RpZmllZEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHJlYWRvbmx5IGJhYmVsRmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFVpbnQ4QXJyYXk+KCk7XG4gIHJlYWRvbmx5IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgbG9hZFJlc3VsdENhY2hlID0gbmV3IE1lbW9yeUxvYWRSZXN1bHRDYWNoZSgpO1xuXG4gIHJlZmVyZW5jZWRGaWxlcz86IHJlYWRvbmx5IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHBlcnNpc3RlbnRDYWNoZVBhdGg/OiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgaW52YWxpZGF0ZShmaWxlczogSXRlcmFibGU8c3RyaW5nPik6IHZvaWQge1xuICAgIGlmIChmaWxlcyAhPT0gdGhpcy5tb2RpZmllZEZpbGVzKSB7XG4gICAgICB0aGlzLm1vZGlmaWVkRmlsZXMuY2xlYXIoKTtcbiAgICB9XG4gICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdGhpcy5iYWJlbEZpbGVDYWNoZS5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLnR5cGVTY3JpcHRGaWxlQ2FjaGUuZGVsZXRlKHBhdGhUb0ZpbGVVUkwoZmlsZSkuaHJlZik7XG4gICAgICB0aGlzLmxvYWRSZXN1bHRDYWNoZS5pbnZhbGlkYXRlKGZpbGUpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgc2VwYXJhdG9ycyB0byBhbGxvdyBtYXRjaGluZyBUeXBlU2NyaXB0IEhvc3QgcGF0aHNcbiAgICAgIGlmIChVU0lOR19XSU5ET1dTKSB7XG4gICAgICAgIGZpbGUgPSBmaWxlLnJlcGxhY2UoV0lORE9XU19TRVBfUkVHRVhQLCBwYXRoLnBvc2l4LnNlcCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy5tb2RpZmllZEZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==