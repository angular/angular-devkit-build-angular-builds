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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./default-progress"), exports);
__exportStar(require("./delete-output-dir"), exports);
__exportStar(require("./run-module-as-observable-fork"), exports);
__exportStar(require("./normalize-file-replacements"), exports);
__exportStar(require("./normalize-asset-patterns"), exports);
__exportStar(require("./normalize-source-maps"), exports);
__exportStar(require("./normalize-optimization"), exports);
__exportStar(require("./normalize-builder-schema"), exports);
__exportStar(require("./url"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7QUFFSCxxREFBbUM7QUFDbkMsc0RBQW9DO0FBQ3BDLGtFQUFnRDtBQUNoRCxnRUFBOEM7QUFDOUMsNkRBQTJDO0FBQzNDLDBEQUF3QztBQUN4QywyREFBeUM7QUFDekMsNkRBQTJDO0FBQzNDLHdDQUFzQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgKiBmcm9tICcuL2RlZmF1bHQtcHJvZ3Jlc3MnO1xuZXhwb3J0ICogZnJvbSAnLi9kZWxldGUtb3V0cHV0LWRpcic7XG5leHBvcnQgKiBmcm9tICcuL3J1bi1tb2R1bGUtYXMtb2JzZXJ2YWJsZS1mb3JrJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLWZpbGUtcmVwbGFjZW1lbnRzJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLXNvdXJjZS1tYXBzJztcbmV4cG9ydCAqIGZyb20gJy4vbm9ybWFsaXplLW9wdGltaXphdGlvbic7XG5leHBvcnQgKiBmcm9tICcuL25vcm1hbGl6ZS1idWlsZGVyLXNjaGVtYSc7XG5leHBvcnQgKiBmcm9tICcuL3VybCc7XG4iXX0=