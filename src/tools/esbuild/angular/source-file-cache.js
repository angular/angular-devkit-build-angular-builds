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
        this.modifiedFiles.clear();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlLWZpbGUtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FuZ3VsYXIvc291cmNlLWZpbGUtY2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUV6Qyw0REFBNkQ7QUFFN0QsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQkFBUSxHQUFFLEtBQUssT0FBTyxDQUFDO0FBQzdDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWxFLE1BQWEsZUFBZ0IsU0FBUSxHQUEwQjtJQVF4QztJQVBaLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ2xDLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBc0IsQ0FBQztJQUMvQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztJQUM3RCxlQUFlLEdBQUcsSUFBSSx5Q0FBcUIsRUFBRSxDQUFDO0lBRXZELGVBQWUsQ0FBcUI7SUFFcEMsWUFBcUIsbUJBQTRCO1FBQy9DLEtBQUssRUFBRSxDQUFDO1FBRFcsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFTO0lBRWpELENBQUM7SUFFRCxVQUFVLENBQUMsS0FBdUI7UUFDaEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMzQixLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtZQUN0QixJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLElBQUEsd0JBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxRCxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUV0QywrREFBK0Q7WUFDL0QsSUFBSSxhQUFhLEVBQUU7Z0JBQ2pCLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDekQ7WUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xCLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzlCO0lBQ0gsQ0FBQztDQUNGO0FBNUJELDBDQTRCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IE1lbW9yeUxvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuY29uc3QgVVNJTkdfV0lORE9XUyA9IHBsYXRmb3JtKCkgPT09ICd3aW4zMic7XG5jb25zdCBXSU5ET1dTX1NFUF9SRUdFWFAgPSBuZXcgUmVnRXhwKGBcXFxcJHtwYXRoLndpbjMyLnNlcH1gLCAnZycpO1xuXG5leHBvcnQgY2xhc3MgU291cmNlRmlsZUNhY2hlIGV4dGVuZHMgTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT4ge1xuICByZWFkb25seSBtb2RpZmllZEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHJlYWRvbmx5IGJhYmVsRmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFVpbnQ4QXJyYXk+KCk7XG4gIHJlYWRvbmx5IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgbG9hZFJlc3VsdENhY2hlID0gbmV3IE1lbW9yeUxvYWRSZXN1bHRDYWNoZSgpO1xuXG4gIHJlZmVyZW5jZWRGaWxlcz86IHJlYWRvbmx5IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHBlcnNpc3RlbnRDYWNoZVBhdGg/OiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgaW52YWxpZGF0ZShmaWxlczogSXRlcmFibGU8c3RyaW5nPik6IHZvaWQge1xuICAgIHRoaXMubW9kaWZpZWRGaWxlcy5jbGVhcigpO1xuICAgIGZvciAobGV0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIHRoaXMuYmFiZWxGaWxlQ2FjaGUuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy50eXBlU2NyaXB0RmlsZUNhY2hlLmRlbGV0ZShwYXRoVG9GaWxlVVJMKGZpbGUpLmhyZWYpO1xuICAgICAgdGhpcy5sb2FkUmVzdWx0Q2FjaGUuaW52YWxpZGF0ZShmaWxlKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG4iXX0=