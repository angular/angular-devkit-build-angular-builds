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
exports.normalizeAssetPatterns = exports.MissingAssetSourceRootException = void 0;
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path = __importStar(require("path"));
class MissingAssetSourceRootException extends core_1.BaseException {
    constructor(path) {
        super(`The ${path} asset path must start with the project source root.`);
    }
}
exports.MissingAssetSourceRootException = MissingAssetSourceRootException;
function normalizeAssetPatterns(assetPatterns, workspaceRoot, projectRoot, projectSourceRoot) {
    if (assetPatterns.length === 0) {
        return [];
    }
    // When sourceRoot is not available, we default to ${projectRoot}/src.
    const sourceRoot = projectSourceRoot || path.join(projectRoot, 'src');
    const resolvedSourceRoot = path.resolve(workspaceRoot, sourceRoot);
    return assetPatterns.map((assetPattern) => {
        // Normalize string asset patterns to objects.
        if (typeof assetPattern === 'string') {
            const assetPath = path.normalize(assetPattern);
            const resolvedAssetPath = path.resolve(workspaceRoot, assetPath);
            // Check if the string asset is within sourceRoot.
            if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
                throw new MissingAssetSourceRootException(assetPattern);
            }
            let glob, input;
            let isDirectory = false;
            try {
                isDirectory = (0, fs_1.statSync)(resolvedAssetPath).isDirectory();
            }
            catch (_a) {
                isDirectory = true;
            }
            if (isDirectory) {
                // Folders get a recursive star glob.
                glob = '**/*';
                // Input directory is their original path.
                input = assetPath;
            }
            else {
                // Files are their own glob.
                glob = path.basename(assetPath);
                // Input directory is their original dirname.
                input = path.dirname(assetPath);
            }
            // Output directory for both is the relative path from source root to input.
            const output = path.relative(resolvedSourceRoot, path.resolve(workspaceRoot, input));
            // Return the asset pattern in object format.
            return { glob, input, output };
        }
        else {
            // It's already an AssetPatternObject, no need to convert.
            return assetPattern;
        }
    });
}
exports.normalizeAssetPatterns = normalizeAssetPatterns;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvbm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUE4QjtBQUM5QiwyQ0FBNkI7QUFHN0IsTUFBYSwrQkFBZ0MsU0FBUSxvQkFBYTtJQUNoRSxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLE9BQU8sSUFBSSxzREFBc0QsQ0FBQyxDQUFDO0lBQzNFLENBQUM7Q0FDRjtBQUpELDBFQUlDO0FBRUQsU0FBZ0Isc0JBQXNCLENBQ3BDLGFBQTZCLEVBQzdCLGFBQXFCLEVBQ3JCLFdBQW1CLEVBQ25CLGlCQUFxQztJQUVyQyxJQUFJLGFBQWEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzlCLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxzRUFBc0U7SUFDdEUsTUFBTSxVQUFVLEdBQUcsaUJBQWlCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDdEUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUVuRSxPQUFPLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtRQUN4Qyw4Q0FBOEM7UUFDOUMsSUFBSSxPQUFPLFlBQVksS0FBSyxRQUFRLEVBQUU7WUFDcEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMvQyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRWpFLGtEQUFrRDtZQUNsRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLEVBQUU7Z0JBQ3JELE1BQU0sSUFBSSwrQkFBK0IsQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUN6RDtZQUVELElBQUksSUFBWSxFQUFFLEtBQWEsQ0FBQztZQUNoQyxJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUM7WUFFeEIsSUFBSTtnQkFDRixXQUFXLEdBQUcsSUFBQSxhQUFRLEVBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzthQUN6RDtZQUFDLFdBQU07Z0JBQ04sV0FBVyxHQUFHLElBQUksQ0FBQzthQUNwQjtZQUVELElBQUksV0FBVyxFQUFFO2dCQUNmLHFDQUFxQztnQkFDckMsSUFBSSxHQUFHLE1BQU0sQ0FBQztnQkFDZCwwQ0FBMEM7Z0JBQzFDLEtBQUssR0FBRyxTQUFTLENBQUM7YUFDbkI7aUJBQU07Z0JBQ0wsNEJBQTRCO2dCQUM1QixJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDaEMsNkNBQTZDO2dCQUM3QyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNqQztZQUVELDRFQUE0RTtZQUM1RSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFFckYsNkNBQTZDO1lBQzdDLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDO1NBQ2hDO2FBQU07WUFDTCwwREFBMEQ7WUFDMUQsT0FBTyxZQUFZLENBQUM7U0FDckI7SUFDSCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUF4REQsd0RBd0RDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBzdGF0U3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBBc3NldFBhdHRlcm4sIEFzc2V0UGF0dGVybkNsYXNzIH0gZnJvbSAnLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuXG5leHBvcnQgY2xhc3MgTWlzc2luZ0Fzc2V0U291cmNlUm9vdEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwYXRoOiBTdHJpbmcpIHtcbiAgICBzdXBlcihgVGhlICR7cGF0aH0gYXNzZXQgcGF0aCBtdXN0IHN0YXJ0IHdpdGggdGhlIHByb2plY3Qgc291cmNlIHJvb3QuYCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gIGFzc2V0UGF0dGVybnM6IEFzc2V0UGF0dGVybltdLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RSb290OiBzdHJpbmcsXG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmcgfCB1bmRlZmluZWQsXG4pOiBBc3NldFBhdHRlcm5DbGFzc1tdIHtcbiAgaWYgKGFzc2V0UGF0dGVybnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgLy8gV2hlbiBzb3VyY2VSb290IGlzIG5vdCBhdmFpbGFibGUsIHdlIGRlZmF1bHQgdG8gJHtwcm9qZWN0Um9vdH0vc3JjLlxuICBjb25zdCBzb3VyY2VSb290ID0gcHJvamVjdFNvdXJjZVJvb3QgfHwgcGF0aC5qb2luKHByb2plY3RSb290LCAnc3JjJyk7XG4gIGNvbnN0IHJlc29sdmVkU291cmNlUm9vdCA9IHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCBzb3VyY2VSb290KTtcblxuICByZXR1cm4gYXNzZXRQYXR0ZXJucy5tYXAoKGFzc2V0UGF0dGVybikgPT4ge1xuICAgIC8vIE5vcm1hbGl6ZSBzdHJpbmcgYXNzZXQgcGF0dGVybnMgdG8gb2JqZWN0cy5cbiAgICBpZiAodHlwZW9mIGFzc2V0UGF0dGVybiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGFzc2V0UGF0aCA9IHBhdGgubm9ybWFsaXplKGFzc2V0UGF0dGVybik7XG4gICAgICBjb25zdCByZXNvbHZlZEFzc2V0UGF0aCA9IHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCBhc3NldFBhdGgpO1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUgc3RyaW5nIGFzc2V0IGlzIHdpdGhpbiBzb3VyY2VSb290LlxuICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0UGF0aC5zdGFydHNXaXRoKHJlc29sdmVkU291cmNlUm9vdCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1pc3NpbmdBc3NldFNvdXJjZVJvb3RFeGNlcHRpb24oYXNzZXRQYXR0ZXJuKTtcbiAgICAgIH1cblxuICAgICAgbGV0IGdsb2I6IHN0cmluZywgaW5wdXQ6IHN0cmluZztcbiAgICAgIGxldCBpc0RpcmVjdG9yeSA9IGZhbHNlO1xuXG4gICAgICB0cnkge1xuICAgICAgICBpc0RpcmVjdG9yeSA9IHN0YXRTeW5jKHJlc29sdmVkQXNzZXRQYXRoKS5pc0RpcmVjdG9yeSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIGlzRGlyZWN0b3J5ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzRGlyZWN0b3J5KSB7XG4gICAgICAgIC8vIEZvbGRlcnMgZ2V0IGEgcmVjdXJzaXZlIHN0YXIgZ2xvYi5cbiAgICAgICAgZ2xvYiA9ICcqKi8qJztcbiAgICAgICAgLy8gSW5wdXQgZGlyZWN0b3J5IGlzIHRoZWlyIG9yaWdpbmFsIHBhdGguXG4gICAgICAgIGlucHV0ID0gYXNzZXRQYXRoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRmlsZXMgYXJlIHRoZWlyIG93biBnbG9iLlxuICAgICAgICBnbG9iID0gcGF0aC5iYXNlbmFtZShhc3NldFBhdGgpO1xuICAgICAgICAvLyBJbnB1dCBkaXJlY3RvcnkgaXMgdGhlaXIgb3JpZ2luYWwgZGlybmFtZS5cbiAgICAgICAgaW5wdXQgPSBwYXRoLmRpcm5hbWUoYXNzZXRQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gT3V0cHV0IGRpcmVjdG9yeSBmb3IgYm90aCBpcyB0aGUgcmVsYXRpdmUgcGF0aCBmcm9tIHNvdXJjZSByb290IHRvIGlucHV0LlxuICAgICAgY29uc3Qgb3V0cHV0ID0gcGF0aC5yZWxhdGl2ZShyZXNvbHZlZFNvdXJjZVJvb3QsIHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCBpbnB1dCkpO1xuXG4gICAgICAvLyBSZXR1cm4gdGhlIGFzc2V0IHBhdHRlcm4gaW4gb2JqZWN0IGZvcm1hdC5cbiAgICAgIHJldHVybiB7IGdsb2IsIGlucHV0LCBvdXRwdXQgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSXQncyBhbHJlYWR5IGFuIEFzc2V0UGF0dGVybk9iamVjdCwgbm8gbmVlZCB0byBjb252ZXJ0LlxuICAgICAgcmV0dXJuIGFzc2V0UGF0dGVybjtcbiAgICB9XG4gIH0pO1xufVxuIl19