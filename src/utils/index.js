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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7O0FBRUgsd0NBQW1DO0FBQ25DLHFEQUFnRDtBQUNoRCxtREFBOEM7QUFDOUMsZ0RBQTJDO0FBQzNDLDZDQUF3QyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0ICogZnJvbSAnLi9kZWZhdWx0LXByb2dyZXNzJztcbmV4cG9ydCAqIGZyb20gJy4vcnVuLW1vZHVsZS1hcy1vYnNlcnZhYmxlLWZvcmsnO1xuZXhwb3J0ICogZnJvbSAnLi9ub3JtYWxpemUtZmlsZS1yZXBsYWNlbWVudHMnO1xuZXhwb3J0ICogZnJvbSAnLi9ub3JtYWxpemUtYXNzZXQtcGF0dGVybnMnO1xuZXhwb3J0ICogZnJvbSAnLi9ub3JtYWxpemUtc291cmNlLW1hcHMnO1xuIl19