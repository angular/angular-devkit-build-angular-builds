"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@angular-devkit/core");
class MissingAssetSourceRootException extends core_1.BaseException {
    constructor(path) {
        super(`The ${path} asset path must start with the project source root.`);
    }
}
exports.MissingAssetSourceRootException = MissingAssetSourceRootException;
function normalizeAssetPatterns(assetPatterns, host, root, projectRoot, maybeSourceRoot) {
    // When sourceRoot is not available, we default to ${projectRoot}/src.
    const sourceRoot = maybeSourceRoot || core_1.join(projectRoot, 'src');
    const resolvedSourceRoot = core_1.resolve(root, sourceRoot);
    if (assetPatterns.length === 0) {
        return [];
    }
    return assetPatterns
        .map(assetPattern => {
        // Normalize string asset patterns to objects.
        if (typeof assetPattern === 'string') {
            const assetPath = core_1.normalize(assetPattern);
            const resolvedAssetPath = core_1.resolve(root, assetPath);
            // Check if the string asset is within sourceRoot.
            if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
                throw new MissingAssetSourceRootException(assetPattern);
            }
            let glob, input, output;
            let isDirectory = false;
            try {
                isDirectory = host.isDirectory(resolvedAssetPath);
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
                glob = core_1.basename(assetPath);
                // Input directory is their original dirname.
                input = core_1.dirname(assetPath);
            }
            // Output directory for both is the relative path from source root to input.
            output = core_1.relative(resolvedSourceRoot, core_1.resolve(root, input));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9ub3JtYWxpemUtYXNzZXQtcGF0dGVybnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCwrQ0FVOEI7QUFJOUIsTUFBYSwrQkFBZ0MsU0FBUSxvQkFBYTtJQUNoRSxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLE9BQU8sSUFBSSxzREFBc0QsQ0FBQyxDQUFDO0lBQzNFLENBQUM7Q0FDRjtBQUpELDBFQUlDO0FBRUQsU0FBZ0Isc0JBQXNCLENBQ3BDLGFBQTZCLEVBQzdCLElBQWdDLEVBQ2hDLElBQVUsRUFDVixXQUFpQixFQUNqQixlQUFpQztJQUVqQyxzRUFBc0U7SUFDdEUsTUFBTSxVQUFVLEdBQUcsZUFBZSxJQUFJLFdBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDL0QsTUFBTSxrQkFBa0IsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBRXJELElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDOUIsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELE9BQU8sYUFBYTtTQUNqQixHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDbEIsOENBQThDO1FBQzlDLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUSxFQUFFO1lBQ3BDLE1BQU0sU0FBUyxHQUFHLGdCQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDMUMsTUFBTSxpQkFBaUIsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRW5ELGtEQUFrRDtZQUNsRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLEVBQUU7Z0JBQ3JELE1BQU0sSUFBSSwrQkFBK0IsQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUN6RDtZQUVELElBQUksSUFBWSxFQUFFLEtBQVcsRUFBRSxNQUFZLENBQUM7WUFDNUMsSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO1lBRXhCLElBQUk7Z0JBQ0YsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQzthQUNuRDtZQUFDLFdBQU07Z0JBQ04sV0FBVyxHQUFHLElBQUksQ0FBQzthQUNwQjtZQUVELElBQUksV0FBVyxFQUFFO2dCQUNmLHFDQUFxQztnQkFDckMsSUFBSSxHQUFHLE1BQU0sQ0FBQztnQkFDZCwwQ0FBMEM7Z0JBQzFDLEtBQUssR0FBRyxTQUFTLENBQUM7YUFDbkI7aUJBQU07Z0JBQ0wsNEJBQTRCO2dCQUM1QixJQUFJLEdBQUcsZUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQiw2Q0FBNkM7Z0JBQzdDLEtBQUssR0FBRyxjQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDNUI7WUFFRCw0RUFBNEU7WUFDNUUsTUFBTSxHQUFHLGVBQVEsQ0FBQyxrQkFBa0IsRUFBRSxjQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFFNUQsNkNBQTZDO1lBQzdDLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDO1NBQ2hDO2FBQU07WUFDTCwwREFBMEQ7WUFDMUQsT0FBTyxZQUFZLENBQUM7U0FDckI7SUFDSCxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUM7QUExREQsd0RBMERDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgQmFzZUV4Y2VwdGlvbixcbiAgUGF0aCxcbiAgYmFzZW5hbWUsXG4gIGRpcm5hbWUsXG4gIGpvaW4sXG4gIG5vcm1hbGl6ZSxcbiAgcmVsYXRpdmUsXG4gIHJlc29sdmUsXG4gIHZpcnR1YWxGcyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuLCBBc3NldFBhdHRlcm5DbGFzcyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcblxuXG5leHBvcnQgY2xhc3MgTWlzc2luZ0Fzc2V0U291cmNlUm9vdEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwYXRoOiBTdHJpbmcpIHtcbiAgICBzdXBlcihgVGhlICR7cGF0aH0gYXNzZXQgcGF0aCBtdXN0IHN0YXJ0IHdpdGggdGhlIHByb2plY3Qgc291cmNlIHJvb3QuYCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gIGFzc2V0UGF0dGVybnM6IEFzc2V0UGF0dGVybltdLFxuICBob3N0OiB2aXJ0dWFsRnMuU3luY0RlbGVnYXRlSG9zdCxcbiAgcm9vdDogUGF0aCxcbiAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gIG1heWJlU291cmNlUm9vdDogUGF0aCB8IHVuZGVmaW5lZCxcbik6IEFzc2V0UGF0dGVybkNsYXNzW10ge1xuICAvLyBXaGVuIHNvdXJjZVJvb3QgaXMgbm90IGF2YWlsYWJsZSwgd2UgZGVmYXVsdCB0byAke3Byb2plY3RSb290fS9zcmMuXG4gIGNvbnN0IHNvdXJjZVJvb3QgPSBtYXliZVNvdXJjZVJvb3QgfHwgam9pbihwcm9qZWN0Um9vdCwgJ3NyYycpO1xuICBjb25zdCByZXNvbHZlZFNvdXJjZVJvb3QgPSByZXNvbHZlKHJvb3QsIHNvdXJjZVJvb3QpO1xuXG4gIGlmIChhc3NldFBhdHRlcm5zLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiBhc3NldFBhdHRlcm5zXG4gICAgLm1hcChhc3NldFBhdHRlcm4gPT4ge1xuICAgICAgLy8gTm9ybWFsaXplIHN0cmluZyBhc3NldCBwYXR0ZXJucyB0byBvYmplY3RzLlxuICAgICAgaWYgKHR5cGVvZiBhc3NldFBhdHRlcm4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0UGF0aCA9IG5vcm1hbGl6ZShhc3NldFBhdHRlcm4pO1xuICAgICAgICBjb25zdCByZXNvbHZlZEFzc2V0UGF0aCA9IHJlc29sdmUocm9vdCwgYXNzZXRQYXRoKTtcblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgc3RyaW5nIGFzc2V0IGlzIHdpdGhpbiBzb3VyY2VSb290LlxuICAgICAgICBpZiAoIXJlc29sdmVkQXNzZXRQYXRoLnN0YXJ0c1dpdGgocmVzb2x2ZWRTb3VyY2VSb290KSkge1xuICAgICAgICAgIHRocm93IG5ldyBNaXNzaW5nQXNzZXRTb3VyY2VSb290RXhjZXB0aW9uKGFzc2V0UGF0dGVybik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZ2xvYjogc3RyaW5nLCBpbnB1dDogUGF0aCwgb3V0cHV0OiBQYXRoO1xuICAgICAgICBsZXQgaXNEaXJlY3RvcnkgPSBmYWxzZTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGlzRGlyZWN0b3J5ID0gaG9zdC5pc0RpcmVjdG9yeShyZXNvbHZlZEFzc2V0UGF0aCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIGlzRGlyZWN0b3J5ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0RpcmVjdG9yeSkge1xuICAgICAgICAgIC8vIEZvbGRlcnMgZ2V0IGEgcmVjdXJzaXZlIHN0YXIgZ2xvYi5cbiAgICAgICAgICBnbG9iID0gJyoqLyonO1xuICAgICAgICAgIC8vIElucHV0IGRpcmVjdG9yeSBpcyB0aGVpciBvcmlnaW5hbCBwYXRoLlxuICAgICAgICAgIGlucHV0ID0gYXNzZXRQYXRoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpbGVzIGFyZSB0aGVpciBvd24gZ2xvYi5cbiAgICAgICAgICBnbG9iID0gYmFzZW5hbWUoYXNzZXRQYXRoKTtcbiAgICAgICAgICAvLyBJbnB1dCBkaXJlY3RvcnkgaXMgdGhlaXIgb3JpZ2luYWwgZGlybmFtZS5cbiAgICAgICAgICBpbnB1dCA9IGRpcm5hbWUoYXNzZXRQYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE91dHB1dCBkaXJlY3RvcnkgZm9yIGJvdGggaXMgdGhlIHJlbGF0aXZlIHBhdGggZnJvbSBzb3VyY2Ugcm9vdCB0byBpbnB1dC5cbiAgICAgICAgb3V0cHV0ID0gcmVsYXRpdmUocmVzb2x2ZWRTb3VyY2VSb290LCByZXNvbHZlKHJvb3QsIGlucHV0KSk7XG5cbiAgICAgICAgLy8gUmV0dXJuIHRoZSBhc3NldCBwYXR0ZXJuIGluIG9iamVjdCBmb3JtYXQuXG4gICAgICAgIHJldHVybiB7IGdsb2IsIGlucHV0LCBvdXRwdXQgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEl0J3MgYWxyZWFkeSBhbiBBc3NldFBhdHRlcm5PYmplY3QsIG5vIG5lZWQgdG8gY29udmVydC5cbiAgICAgICAgcmV0dXJuIGFzc2V0UGF0dGVybjtcbiAgICAgIH1cbiAgICB9KTtcbn1cbiJdfQ==