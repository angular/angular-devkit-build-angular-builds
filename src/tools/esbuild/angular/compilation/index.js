"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopCompilation = exports.createAngularCompilation = exports.AngularCompilation = void 0;
var angular_compilation_1 = require("./angular-compilation");
Object.defineProperty(exports, "AngularCompilation", { enumerable: true, get: function () { return angular_compilation_1.AngularCompilation; } });
var factory_1 = require("./factory");
Object.defineProperty(exports, "createAngularCompilation", { enumerable: true, get: function () { return factory_1.createAngularCompilation; } });
var noop_compilation_1 = require("./noop-compilation");
Object.defineProperty(exports, "NoopCompilation", { enumerable: true, get: function () { return noop_compilation_1.NoopCompilation; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FuZ3VsYXIvY29tcGlsYXRpb24vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsNkRBQTJEO0FBQWxELHlIQUFBLGtCQUFrQixPQUFBO0FBQzNCLHFDQUFxRDtBQUE1QyxtSEFBQSx3QkFBd0IsT0FBQTtBQUNqQyx1REFBcUQ7QUFBNUMsbUhBQUEsZUFBZSxPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5leHBvcnQgeyBjcmVhdGVBbmd1bGFyQ29tcGlsYXRpb24gfSBmcm9tICcuL2ZhY3RvcnknO1xuZXhwb3J0IHsgTm9vcENvbXBpbGF0aW9uIH0gZnJvbSAnLi9ub29wLWNvbXBpbGF0aW9uJztcbiJdfQ==