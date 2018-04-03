"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: remove this commented AJV require.
// We don't actually require AJV, but there is a bug with NPM and peer dependencies that is
// whose workaround is to depend on AJV.
// See https://github.com/angular/angular-cli/issues/9691#issuecomment-367322703 for details.
// We need to add a require here to satisfy the dependency checker.
// require('ajv');
__export(require("./app-shell"));
__export(require("./browser"));
__export(require("./dev-server"));
__export(require("./extract-i18n"));
__export(require("./karma"));
__export(require("./protractor"));
__export(require("./server"));
__export(require("./tslint"));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7O0FBRUgsMkNBQTJDO0FBQzNDLDJGQUEyRjtBQUMzRix3Q0FBd0M7QUFDeEMsNkZBQTZGO0FBQzdGLG1FQUFtRTtBQUNuRSxrQkFBa0I7QUFFbEIsaUNBQTRCO0FBQzVCLCtCQUEwQjtBQUMxQixrQ0FBNkI7QUFDN0Isb0NBQStCO0FBQy9CLDZCQUF3QjtBQUN4QixrQ0FBNkI7QUFDN0IsOEJBQXlCO0FBQ3pCLDhCQUF5QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8gVE9ETzogcmVtb3ZlIHRoaXMgY29tbWVudGVkIEFKViByZXF1aXJlLlxuLy8gV2UgZG9uJ3QgYWN0dWFsbHkgcmVxdWlyZSBBSlYsIGJ1dCB0aGVyZSBpcyBhIGJ1ZyB3aXRoIE5QTSBhbmQgcGVlciBkZXBlbmRlbmNpZXMgdGhhdCBpc1xuLy8gd2hvc2Ugd29ya2Fyb3VuZCBpcyB0byBkZXBlbmQgb24gQUpWLlxuLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy85NjkxI2lzc3VlY29tbWVudC0zNjczMjI3MDMgZm9yIGRldGFpbHMuXG4vLyBXZSBuZWVkIHRvIGFkZCBhIHJlcXVpcmUgaGVyZSB0byBzYXRpc2Z5IHRoZSBkZXBlbmRlbmN5IGNoZWNrZXIuXG4vLyByZXF1aXJlKCdhanYnKTtcblxuZXhwb3J0ICogZnJvbSAnLi9hcHAtc2hlbGwnO1xuZXhwb3J0ICogZnJvbSAnLi9icm93c2VyJztcbmV4cG9ydCAqIGZyb20gJy4vZGV2LXNlcnZlcic7XG5leHBvcnQgKiBmcm9tICcuL2V4dHJhY3QtaTE4bic7XG5leHBvcnQgKiBmcm9tICcuL2thcm1hJztcbmV4cG9ydCAqIGZyb20gJy4vcHJvdHJhY3Rvcic7XG5leHBvcnQgKiBmcm9tICcuL3NlcnZlcic7XG5leHBvcnQgKiBmcm9tICcuL3RzbGludCc7XG4iXX0=