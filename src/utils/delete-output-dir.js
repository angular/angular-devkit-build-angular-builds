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
exports.deleteOutputDir = void 0;
const fs = __importStar(require("fs"));
const path_1 = require("path");
/**
 * Delete an output directory, but error out if it's the root of the project.
 */
function deleteOutputDir(root, outputPath) {
    const resolvedOutputPath = (0, path_1.resolve)(root, outputPath);
    if (resolvedOutputPath === root) {
        throw new Error('Output path MUST not be project root directory!');
    }
    // The below should be removed and replace with just `rmSync` when support for Node.Js 12 is removed.
    const { rmSync, rmdirSync } = fs;
    if (rmSync) {
        rmSync(resolvedOutputPath, { force: true, recursive: true, maxRetries: 3 });
    }
    else {
        rmdirSync(resolvedOutputPath, { recursive: true, maxRetries: 3 });
    }
}
exports.deleteOutputDir = deleteOutputDir;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVsZXRlLW91dHB1dC1kaXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9kZWxldGUtb3V0cHV0LWRpci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBQ3pCLCtCQUErQjtBQUUvQjs7R0FFRztBQUNILFNBQWdCLGVBQWUsQ0FBQyxJQUFZLEVBQUUsVUFBa0I7SUFDOUQsTUFBTSxrQkFBa0IsR0FBRyxJQUFBLGNBQU8sRUFBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDckQsSUFBSSxrQkFBa0IsS0FBSyxJQUFJLEVBQUU7UUFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO0tBQ3BFO0lBRUQscUdBQXFHO0lBQ3JHLE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFVN0IsQ0FBQztJQUVGLElBQUksTUFBTSxFQUFFO1FBQ1YsTUFBTSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQzdFO1NBQU07UUFDTCxTQUFTLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ25FO0FBQ0gsQ0FBQztBQXhCRCwwQ0F3QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIERlbGV0ZSBhbiBvdXRwdXQgZGlyZWN0b3J5LCBidXQgZXJyb3Igb3V0IGlmIGl0J3MgdGhlIHJvb3Qgb2YgdGhlIHByb2plY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWxldGVPdXRwdXREaXIocm9vdDogc3RyaW5nLCBvdXRwdXRQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgcmVzb2x2ZWRPdXRwdXRQYXRoID0gcmVzb2x2ZShyb290LCBvdXRwdXRQYXRoKTtcbiAgaWYgKHJlc29sdmVkT3V0cHV0UGF0aCA9PT0gcm9vdCkge1xuICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgcHJvamVjdCByb290IGRpcmVjdG9yeSEnKTtcbiAgfVxuXG4gIC8vIFRoZSBiZWxvdyBzaG91bGQgYmUgcmVtb3ZlZCBhbmQgcmVwbGFjZSB3aXRoIGp1c3QgYHJtU3luY2Agd2hlbiBzdXBwb3J0IGZvciBOb2RlLkpzIDEyIGlzIHJlbW92ZWQuXG4gIGNvbnN0IHsgcm1TeW5jLCBybWRpclN5bmMgfSA9IGZzIGFzIHR5cGVvZiBmcyAmIHtcbiAgICBybVN5bmM/OiAoXG4gICAgICBwYXRoOiBmcy5QYXRoTGlrZSxcbiAgICAgIG9wdGlvbnM/OiB7XG4gICAgICAgIGZvcmNlPzogYm9vbGVhbjtcbiAgICAgICAgbWF4UmV0cmllcz86IG51bWJlcjtcbiAgICAgICAgcmVjdXJzaXZlPzogYm9vbGVhbjtcbiAgICAgICAgcmV0cnlEZWxheT86IG51bWJlcjtcbiAgICAgIH0sXG4gICAgKSA9PiB2b2lkO1xuICB9O1xuXG4gIGlmIChybVN5bmMpIHtcbiAgICBybVN5bmMocmVzb2x2ZWRPdXRwdXRQYXRoLCB7IGZvcmNlOiB0cnVlLCByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG4gIH0gZWxzZSB7XG4gICAgcm1kaXJTeW5jKHJlc29sdmVkT3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG4gIH1cbn1cbiJdfQ==