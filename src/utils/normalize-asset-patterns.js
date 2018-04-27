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
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
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
    const assetPatternObjectObservables = assetPatterns
        .map(assetPattern => {
        // Normalize string asset patterns to objects.
        if (typeof assetPattern === 'string') {
            const assetPath = core_1.normalize(assetPattern);
            const resolvedAssetPath = core_1.resolve(root, assetPath);
            // Check if the string asset is within sourceRoot.
            if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
                throw new MissingAssetSourceRootException(assetPattern);
            }
            return host.isDirectory(resolvedAssetPath).pipe(
            // If the path doesn't exist at all, pretend it is a directory.
            operators_1.catchError(() => rxjs_1.of(true)), operators_1.map(isDirectory => {
                let glob, input, output;
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
            }));
        }
        else {
            // It's already an AssetPatternObject, no need to convert.
            return rxjs_1.of(assetPattern);
        }
    });
    // Wait for all the asset patterns and return them as an array.
    return rxjs_1.forkJoin(assetPatternObjectObservables);
}
exports.normalizeAssetPatterns = normalizeAssetPatterns;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXplLWFzc2V0LXBhdHRlcm5zLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9ub3JtYWxpemUtYXNzZXQtcGF0dGVybnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCwrQ0FVOEI7QUFDOUIsK0JBQWdEO0FBQ2hELDhDQUFpRDtBQUlqRCxxQ0FBNkMsU0FBUSxvQkFBYTtJQUNoRSxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLE9BQU8sSUFBSSxzREFBc0QsQ0FBQyxDQUFDO0lBQzNFLENBQUM7Q0FDRjtBQUpELDBFQUlDO0FBRUQsZ0NBQ0UsYUFBNkIsRUFDN0IsSUFBb0IsRUFDcEIsSUFBVSxFQUNWLFdBQWlCLEVBQ2pCLGVBQWlDO0lBRWpDLHNFQUFzRTtJQUN0RSxNQUFNLFVBQVUsR0FBRyxlQUFlLElBQUksV0FBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvRCxNQUFNLGtCQUFrQixHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFFckQsTUFBTSw2QkFBNkIsR0FBcUMsYUFBYTtTQUNsRixHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDbEIsOENBQThDO1FBQzlDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sWUFBWSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxTQUFTLEdBQUcsZ0JBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMxQyxNQUFNLGlCQUFpQixHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFFbkQsa0RBQWtEO1lBQ2xELEVBQUUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxNQUFNLElBQUksK0JBQStCLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDMUQsQ0FBQztZQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUMsSUFBSTtZQUM3QywrREFBK0Q7WUFDL0Qsc0JBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsRUFDMUIsZUFBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUNoQixJQUFJLElBQVksRUFBRSxLQUFXLEVBQUUsTUFBWSxDQUFDO2dCQUM1QyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO29CQUNoQixxQ0FBcUM7b0JBQ3JDLElBQUksR0FBRyxNQUFNLENBQUM7b0JBQ2QsMENBQTBDO29CQUMxQyxLQUFLLEdBQUcsU0FBUyxDQUFDO2dCQUNwQixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLDRCQUE0QjtvQkFDNUIsSUFBSSxHQUFHLGVBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDM0IsNkNBQTZDO29CQUM3QyxLQUFLLEdBQUcsY0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM3QixDQUFDO2dCQUVELDRFQUE0RTtnQkFDNUUsTUFBTSxHQUFHLGVBQVEsQ0FBQyxrQkFBa0IsRUFBRSxjQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBRTVELDZDQUE2QztnQkFDN0MsTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQztZQUNqQyxDQUFDLENBQUMsQ0FDSCxDQUFDO1FBQ0osQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sMERBQTBEO1lBQzFELE1BQU0sQ0FBQyxTQUFFLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDMUIsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUwsK0RBQStEO0lBQy9ELE1BQU0sQ0FBQyxlQUFRLENBQUMsNkJBQTZCLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBdkRELHdEQXVEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIEJhc2VFeGNlcHRpb24sXG4gIFBhdGgsXG4gIGJhc2VuYW1lLFxuICBkaXJuYW1lLFxuICBqb2luLFxuICBub3JtYWxpemUsXG4gIHJlbGF0aXZlLFxuICByZXNvbHZlLFxuICB2aXJ0dWFsRnMsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZvcmtKb2luLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY2F0Y2hFcnJvciwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuLCBBc3NldFBhdHRlcm5PYmplY3QgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5cblxuZXhwb3J0IGNsYXNzIE1pc3NpbmdBc3NldFNvdXJjZVJvb3RFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IocGF0aDogU3RyaW5nKSB7XG4gICAgc3VwZXIoYFRoZSAke3BhdGh9IGFzc2V0IHBhdGggbXVzdCBzdGFydCB3aXRoIHRoZSBwcm9qZWN0IHNvdXJjZSByb290LmApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICBhc3NldFBhdHRlcm5zOiBBc3NldFBhdHRlcm5bXSxcbiAgaG9zdDogdmlydHVhbEZzLkhvc3QsXG4gIHJvb3Q6IFBhdGgsXG4gIHByb2plY3RSb290OiBQYXRoLFxuICBtYXliZVNvdXJjZVJvb3Q6IFBhdGggfCB1bmRlZmluZWQsXG4pOiBPYnNlcnZhYmxlPEFzc2V0UGF0dGVybk9iamVjdFtdPiB7XG4gIC8vIFdoZW4gc291cmNlUm9vdCBpcyBub3QgYXZhaWxhYmxlLCB3ZSBkZWZhdWx0IHRvICR7cHJvamVjdFJvb3R9L3NyYy5cbiAgY29uc3Qgc291cmNlUm9vdCA9IG1heWJlU291cmNlUm9vdCB8fCBqb2luKHByb2plY3RSb290LCAnc3JjJyk7XG4gIGNvbnN0IHJlc29sdmVkU291cmNlUm9vdCA9IHJlc29sdmUocm9vdCwgc291cmNlUm9vdCk7XG5cbiAgY29uc3QgYXNzZXRQYXR0ZXJuT2JqZWN0T2JzZXJ2YWJsZXM6IE9ic2VydmFibGU8QXNzZXRQYXR0ZXJuT2JqZWN0PltdID0gYXNzZXRQYXR0ZXJuc1xuICAgIC5tYXAoYXNzZXRQYXR0ZXJuID0+IHtcbiAgICAgIC8vIE5vcm1hbGl6ZSBzdHJpbmcgYXNzZXQgcGF0dGVybnMgdG8gb2JqZWN0cy5cbiAgICAgIGlmICh0eXBlb2YgYXNzZXRQYXR0ZXJuID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBhc3NldFBhdGggPSBub3JtYWxpemUoYXNzZXRQYXR0ZXJuKTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRBc3NldFBhdGggPSByZXNvbHZlKHJvb3QsIGFzc2V0UGF0aCk7XG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIHN0cmluZyBhc3NldCBpcyB3aXRoaW4gc291cmNlUm9vdC5cbiAgICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0UGF0aC5zdGFydHNXaXRoKHJlc29sdmVkU291cmNlUm9vdCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgTWlzc2luZ0Fzc2V0U291cmNlUm9vdEV4Y2VwdGlvbihhc3NldFBhdHRlcm4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhvc3QuaXNEaXJlY3RvcnkocmVzb2x2ZWRBc3NldFBhdGgpLnBpcGUoXG4gICAgICAgICAgLy8gSWYgdGhlIHBhdGggZG9lc24ndCBleGlzdCBhdCBhbGwsIHByZXRlbmQgaXQgaXMgYSBkaXJlY3RvcnkuXG4gICAgICAgICAgY2F0Y2hFcnJvcigoKSA9PiBvZih0cnVlKSksXG4gICAgICAgICAgbWFwKGlzRGlyZWN0b3J5ID0+IHtcbiAgICAgICAgICAgIGxldCBnbG9iOiBzdHJpbmcsIGlucHV0OiBQYXRoLCBvdXRwdXQ6IFBhdGg7XG4gICAgICAgICAgICBpZiAoaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICAgICAgLy8gRm9sZGVycyBnZXQgYSByZWN1cnNpdmUgc3RhciBnbG9iLlxuICAgICAgICAgICAgICBnbG9iID0gJyoqLyonO1xuICAgICAgICAgICAgICAvLyBJbnB1dCBkaXJlY3RvcnkgaXMgdGhlaXIgb3JpZ2luYWwgcGF0aC5cbiAgICAgICAgICAgICAgaW5wdXQgPSBhc3NldFBhdGg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBGaWxlcyBhcmUgdGhlaXIgb3duIGdsb2IuXG4gICAgICAgICAgICAgIGdsb2IgPSBiYXNlbmFtZShhc3NldFBhdGgpO1xuICAgICAgICAgICAgICAvLyBJbnB1dCBkaXJlY3RvcnkgaXMgdGhlaXIgb3JpZ2luYWwgZGlybmFtZS5cbiAgICAgICAgICAgICAgaW5wdXQgPSBkaXJuYW1lKGFzc2V0UGF0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE91dHB1dCBkaXJlY3RvcnkgZm9yIGJvdGggaXMgdGhlIHJlbGF0aXZlIHBhdGggZnJvbSBzb3VyY2Ugcm9vdCB0byBpbnB1dC5cbiAgICAgICAgICAgIG91dHB1dCA9IHJlbGF0aXZlKHJlc29sdmVkU291cmNlUm9vdCwgcmVzb2x2ZShyb290LCBpbnB1dCkpO1xuXG4gICAgICAgICAgICAvLyBSZXR1cm4gdGhlIGFzc2V0IHBhdHRlcm4gaW4gb2JqZWN0IGZvcm1hdC5cbiAgICAgICAgICAgIHJldHVybiB7IGdsb2IsIGlucHV0LCBvdXRwdXQgfTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEl0J3MgYWxyZWFkeSBhbiBBc3NldFBhdHRlcm5PYmplY3QsIG5vIG5lZWQgdG8gY29udmVydC5cbiAgICAgICAgcmV0dXJuIG9mKGFzc2V0UGF0dGVybik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgLy8gV2FpdCBmb3IgYWxsIHRoZSBhc3NldCBwYXR0ZXJucyBhbmQgcmV0dXJuIHRoZW0gYXMgYW4gYXJyYXkuXG4gIHJldHVybiBmb3JrSm9pbihhc3NldFBhdHRlcm5PYmplY3RPYnNlcnZhYmxlcyk7XG59XG4iXX0=