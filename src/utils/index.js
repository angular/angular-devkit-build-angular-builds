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
__export(require("./default-progress"));
__export(require("./run-module-as-observable-fork"));
__export(require("./normalize-file-replacements"));
__export(require("./normalize-asset-patterns"));
__export(require("./normalize-source-maps"));
__export(require("./normalize-optimization"));
__export(require("./normalize-builder-schema"));
__export(require("./normalize-karma-schema"));
__export(require("./normalize-webpack-server-schema"));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7O0FBRUgsd0NBQW1DO0FBQ25DLHFEQUFnRDtBQUNoRCxtREFBOEM7QUFDOUMsZ0RBQTJDO0FBQzNDLDZDQUF3QztBQUN4Qyw4Q0FBeUM7QUFDekMsZ0RBQTJDO0FBQzNDLDhDQUF5QztBQUN6Qyx1REFBa0QiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCAqIGZyb20gJy4vZGVmYXVsdC1wcm9ncmVzcyc7XG5leHBvcnQgKiBmcm9tICcuL3J1bi1tb2R1bGUtYXMtb2JzZXJ2YWJsZS1mb3JrJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLWZpbGUtcmVwbGFjZW1lbnRzJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLXNvdXJjZS1tYXBzJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLW9wdGltaXphdGlvbic7XG5leHBvcnQgKiBmcm9tICcuL25vcm1hbGl6ZS1idWlsZGVyLXNjaGVtYSc7XG5leHBvcnQgKiBmcm9tICcuL25vcm1hbGl6ZS1rYXJtYS1zY2hlbWEnO1xuZXhwb3J0ICogZnJvbSAnLi9ub3JtYWxpemUtd2VicGFjay1zZXJ2ZXItc2NoZW1hJztcbiJdfQ==