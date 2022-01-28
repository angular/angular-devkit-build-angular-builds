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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.readTsconfig = void 0;
const path = __importStar(require("path"));
const load_esm_1 = require("./load-esm");
/**
 * Reads and parses a given TsConfig file.
 *
 * @param tsconfigPath - An absolute or relative path from 'workspaceRoot' of the tsconfig file.
 * @param workspaceRoot - workspaceRoot root location when provided
 * it will resolve 'tsconfigPath' from this path.
 */
async function readTsconfig(tsconfigPath, workspaceRoot) {
    const tsConfigFullPath = workspaceRoot ? path.resolve(workspaceRoot, tsconfigPath) : tsconfigPath;
    // Load ESM `@angular/compiler-cli` using the TypeScript dynamic import workaround.
    // Once TypeScript provides support for keeping the dynamic import this workaround can be
    // changed to a direct dynamic import.
    const { formatDiagnostics, readConfiguration } = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
    const configResult = readConfiguration(tsConfigFullPath);
    if (configResult.errors && configResult.errors.length) {
        throw new Error(formatDiagnostics(configResult.errors));
    }
    return configResult;
}
exports.readTsconfig = readTsconfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZC10c2NvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3JlYWQtdHNjb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDJDQUE2QjtBQUM3Qix5Q0FBMkM7QUFFM0M7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLFlBQVksQ0FDaEMsWUFBb0IsRUFDcEIsYUFBc0I7SUFFdEIsTUFBTSxnQkFBZ0IsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7SUFFbEcsbUZBQW1GO0lBQ25GLHlGQUF5RjtJQUN6RixzQ0FBc0M7SUFDdEMsTUFBTSxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLEdBQUcsTUFBTSxJQUFBLHdCQUFhLEVBRWxFLHVCQUF1QixDQUFDLENBQUM7SUFFM0IsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUN6RCxJQUFJLFlBQVksQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUN6RDtJQUVELE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUFuQkQsb0NBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgUGFyc2VkQ29uZmlndXJhdGlvbiB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG4vKipcbiAqIFJlYWRzIGFuZCBwYXJzZXMgYSBnaXZlbiBUc0NvbmZpZyBmaWxlLlxuICpcbiAqIEBwYXJhbSB0c2NvbmZpZ1BhdGggLSBBbiBhYnNvbHV0ZSBvciByZWxhdGl2ZSBwYXRoIGZyb20gJ3dvcmtzcGFjZVJvb3QnIG9mIHRoZSB0c2NvbmZpZyBmaWxlLlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgLSB3b3Jrc3BhY2VSb290IHJvb3QgbG9jYXRpb24gd2hlbiBwcm92aWRlZFxuICogaXQgd2lsbCByZXNvbHZlICd0c2NvbmZpZ1BhdGgnIGZyb20gdGhpcyBwYXRoLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZFRzY29uZmlnKFxuICB0c2NvbmZpZ1BhdGg6IHN0cmluZyxcbiAgd29ya3NwYWNlUm9vdD86IHN0cmluZyxcbik6IFByb21pc2U8UGFyc2VkQ29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB0c0NvbmZpZ0Z1bGxQYXRoID0gd29ya3NwYWNlUm9vdCA/IHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCB0c2NvbmZpZ1BhdGgpIDogdHNjb25maWdQYXRoO1xuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IHsgZm9ybWF0RGlhZ25vc3RpY3MsIHJlYWRDb25maWd1cmF0aW9uIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPFxuICAgIHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpXG4gID4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuXG4gIGNvbnN0IGNvbmZpZ1Jlc3VsdCA9IHJlYWRDb25maWd1cmF0aW9uKHRzQ29uZmlnRnVsbFBhdGgpO1xuICBpZiAoY29uZmlnUmVzdWx0LmVycm9ycyAmJiBjb25maWdSZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXREaWFnbm9zdGljcyhjb25maWdSZXN1bHQuZXJyb3JzKSk7XG4gIH1cblxuICByZXR1cm4gY29uZmlnUmVzdWx0O1xufVxuIl19