"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAssetPatterns = exports.MissingAssetSourceRootException = void 0;
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
class MissingAssetSourceRootException extends core_1.BaseException {
    constructor(path) {
        super(`The ${path} asset path must start with the project source root.`);
    }
}
exports.MissingAssetSourceRootException = MissingAssetSourceRootException;
function normalizeAssetPatterns(assetPatterns, root, projectRoot, maybeSourceRoot) {
    // When sourceRoot is not available, we default to ${projectRoot}/src.
    const sourceRoot = maybeSourceRoot || (0, core_1.join)(projectRoot, 'src');
    const resolvedSourceRoot = (0, core_1.resolve)(root, sourceRoot);
    if (assetPatterns.length === 0) {
        return [];
    }
    return assetPatterns.map((assetPattern) => {
        // Normalize string asset patterns to objects.
        if (typeof assetPattern === 'string') {
            const assetPath = (0, core_1.normalize)(assetPattern);
            const resolvedAssetPath = (0, core_1.resolve)(root, assetPath);
            // Check if the string asset is within sourceRoot.
            if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
                throw new MissingAssetSourceRootException(assetPattern);
            }
            let glob, input;
            let isDirectory = false;
            try {
                isDirectory = (0, fs_1.statSync)((0, core_1.getSystemPath)(resolvedAssetPath)).isDirectory();
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
                glob = (0, core_1.basename)(assetPath);
                // Input directory is their original dirname.
                input = (0, core_1.dirname)(assetPath);
            }
            // Output directory for both is the relative path from source root to input.
            const output = (0, core_1.relative)(resolvedSourceRoot, (0, core_1.resolve)(root, input));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvbm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQVU4QjtBQUM5QiwyQkFBOEI7QUFHOUIsTUFBYSwrQkFBZ0MsU0FBUSxvQkFBYTtJQUNoRSxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLE9BQU8sSUFBSSxzREFBc0QsQ0FBQyxDQUFDO0lBQzNFLENBQUM7Q0FDRjtBQUpELDBFQUlDO0FBRUQsU0FBZ0Isc0JBQXNCLENBQ3BDLGFBQTZCLEVBQzdCLElBQVUsRUFDVixXQUFpQixFQUNqQixlQUFpQztJQUVqQyxzRUFBc0U7SUFDdEUsTUFBTSxVQUFVLEdBQUcsZUFBZSxJQUFJLElBQUEsV0FBSSxFQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvRCxNQUFNLGtCQUFrQixHQUFHLElBQUEsY0FBTyxFQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUVyRCxJQUFJLGFBQWEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzlCLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxPQUFPLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtRQUN4Qyw4Q0FBOEM7UUFDOUMsSUFBSSxPQUFPLFlBQVksS0FBSyxRQUFRLEVBQUU7WUFDcEMsTUFBTSxTQUFTLEdBQUcsSUFBQSxnQkFBUyxFQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzFDLE1BQU0saUJBQWlCLEdBQUcsSUFBQSxjQUFPLEVBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRW5ELGtEQUFrRDtZQUNsRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLEVBQUU7Z0JBQ3JELE1BQU0sSUFBSSwrQkFBK0IsQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUN6RDtZQUVELElBQUksSUFBWSxFQUFFLEtBQVcsQ0FBQztZQUM5QixJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUM7WUFFeEIsSUFBSTtnQkFDRixXQUFXLEdBQUcsSUFBQSxhQUFRLEVBQUMsSUFBQSxvQkFBYSxFQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzthQUN4RTtZQUFDLFdBQU07Z0JBQ04sV0FBVyxHQUFHLElBQUksQ0FBQzthQUNwQjtZQUVELElBQUksV0FBVyxFQUFFO2dCQUNmLHFDQUFxQztnQkFDckMsSUFBSSxHQUFHLE1BQU0sQ0FBQztnQkFDZCwwQ0FBMEM7Z0JBQzFDLEtBQUssR0FBRyxTQUFTLENBQUM7YUFDbkI7aUJBQU07Z0JBQ0wsNEJBQTRCO2dCQUM1QixJQUFJLEdBQUcsSUFBQSxlQUFRLEVBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNCLDZDQUE2QztnQkFDN0MsS0FBSyxHQUFHLElBQUEsY0FBTyxFQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzVCO1lBRUQsNEVBQTRFO1lBQzVFLE1BQU0sTUFBTSxHQUFHLElBQUEsZUFBUSxFQUFDLGtCQUFrQixFQUFFLElBQUEsY0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBRWxFLDZDQUE2QztZQUM3QyxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQztTQUNoQzthQUFNO1lBQ0wsMERBQTBEO1lBQzFELE9BQU8sWUFBWSxDQUFDO1NBQ3JCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBeERELHdEQXdEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCYXNlRXhjZXB0aW9uLFxuICBQYXRoLFxuICBiYXNlbmFtZSxcbiAgZGlybmFtZSxcbiAgZ2V0U3lzdGVtUGF0aCxcbiAgam9pbixcbiAgbm9ybWFsaXplLFxuICByZWxhdGl2ZSxcbiAgcmVzb2x2ZSxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgc3RhdFN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBBc3NldFBhdHRlcm4sIEFzc2V0UGF0dGVybkNsYXNzIH0gZnJvbSAnLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuXG5leHBvcnQgY2xhc3MgTWlzc2luZ0Fzc2V0U291cmNlUm9vdEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwYXRoOiBTdHJpbmcpIHtcbiAgICBzdXBlcihgVGhlICR7cGF0aH0gYXNzZXQgcGF0aCBtdXN0IHN0YXJ0IHdpdGggdGhlIHByb2plY3Qgc291cmNlIHJvb3QuYCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gIGFzc2V0UGF0dGVybnM6IEFzc2V0UGF0dGVybltdLFxuICByb290OiBQYXRoLFxuICBwcm9qZWN0Um9vdDogUGF0aCxcbiAgbWF5YmVTb3VyY2VSb290OiBQYXRoIHwgdW5kZWZpbmVkLFxuKTogQXNzZXRQYXR0ZXJuQ2xhc3NbXSB7XG4gIC8vIFdoZW4gc291cmNlUm9vdCBpcyBub3QgYXZhaWxhYmxlLCB3ZSBkZWZhdWx0IHRvICR7cHJvamVjdFJvb3R9L3NyYy5cbiAgY29uc3Qgc291cmNlUm9vdCA9IG1heWJlU291cmNlUm9vdCB8fCBqb2luKHByb2plY3RSb290LCAnc3JjJyk7XG4gIGNvbnN0IHJlc29sdmVkU291cmNlUm9vdCA9IHJlc29sdmUocm9vdCwgc291cmNlUm9vdCk7XG5cbiAgaWYgKGFzc2V0UGF0dGVybnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIGFzc2V0UGF0dGVybnMubWFwKChhc3NldFBhdHRlcm4pID0+IHtcbiAgICAvLyBOb3JtYWxpemUgc3RyaW5nIGFzc2V0IHBhdHRlcm5zIHRvIG9iamVjdHMuXG4gICAgaWYgKHR5cGVvZiBhc3NldFBhdHRlcm4gPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBhc3NldFBhdGggPSBub3JtYWxpemUoYXNzZXRQYXR0ZXJuKTtcbiAgICAgIGNvbnN0IHJlc29sdmVkQXNzZXRQYXRoID0gcmVzb2x2ZShyb290LCBhc3NldFBhdGgpO1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUgc3RyaW5nIGFzc2V0IGlzIHdpdGhpbiBzb3VyY2VSb290LlxuICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0UGF0aC5zdGFydHNXaXRoKHJlc29sdmVkU291cmNlUm9vdCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1pc3NpbmdBc3NldFNvdXJjZVJvb3RFeGNlcHRpb24oYXNzZXRQYXR0ZXJuKTtcbiAgICAgIH1cblxuICAgICAgbGV0IGdsb2I6IHN0cmluZywgaW5wdXQ6IFBhdGg7XG4gICAgICBsZXQgaXNEaXJlY3RvcnkgPSBmYWxzZTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgaXNEaXJlY3RvcnkgPSBzdGF0U3luYyhnZXRTeXN0ZW1QYXRoKHJlc29sdmVkQXNzZXRQYXRoKSkuaXNEaXJlY3RvcnkoKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBpc0RpcmVjdG9yeSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0RpcmVjdG9yeSkge1xuICAgICAgICAvLyBGb2xkZXJzIGdldCBhIHJlY3Vyc2l2ZSBzdGFyIGdsb2IuXG4gICAgICAgIGdsb2IgPSAnKiovKic7XG4gICAgICAgIC8vIElucHV0IGRpcmVjdG9yeSBpcyB0aGVpciBvcmlnaW5hbCBwYXRoLlxuICAgICAgICBpbnB1dCA9IGFzc2V0UGF0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZpbGVzIGFyZSB0aGVpciBvd24gZ2xvYi5cbiAgICAgICAgZ2xvYiA9IGJhc2VuYW1lKGFzc2V0UGF0aCk7XG4gICAgICAgIC8vIElucHV0IGRpcmVjdG9yeSBpcyB0aGVpciBvcmlnaW5hbCBkaXJuYW1lLlxuICAgICAgICBpbnB1dCA9IGRpcm5hbWUoYXNzZXRQYXRoKTtcbiAgICAgIH1cblxuICAgICAgLy8gT3V0cHV0IGRpcmVjdG9yeSBmb3IgYm90aCBpcyB0aGUgcmVsYXRpdmUgcGF0aCBmcm9tIHNvdXJjZSByb290IHRvIGlucHV0LlxuICAgICAgY29uc3Qgb3V0cHV0ID0gcmVsYXRpdmUocmVzb2x2ZWRTb3VyY2VSb290LCByZXNvbHZlKHJvb3QsIGlucHV0KSk7XG5cbiAgICAgIC8vIFJldHVybiB0aGUgYXNzZXQgcGF0dGVybiBpbiBvYmplY3QgZm9ybWF0LlxuICAgICAgcmV0dXJuIHsgZ2xvYiwgaW5wdXQsIG91dHB1dCB9O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJdCdzIGFscmVhZHkgYW4gQXNzZXRQYXR0ZXJuT2JqZWN0LCBubyBuZWVkIHRvIGNvbnZlcnQuXG4gICAgICByZXR1cm4gYXNzZXRQYXR0ZXJuO1xuICAgIH1cbiAgfSk7XG59XG4iXX0=