"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logBuilderStatusWarnings = void 0;
const UNSUPPORTED_OPTIONS = [
    'budgets',
    // * Deprecated
    'deployUrl',
    // * Always enabled with esbuild
    // 'commonChunk',
    // * Unused by builder and will be removed in a future release
    'namedChunks',
    'vendorChunk',
    'resourcesOutputPath',
    // * Currently unsupported by esbuild
    'webWorkerTsConfig',
];
function logBuilderStatusWarnings(options, context) {
    // Validate supported options
    for (const unsupportedOption of UNSUPPORTED_OPTIONS) {
        const value = options[unsupportedOption];
        if (value === undefined || value === false) {
            continue;
        }
        if (Array.isArray(value) && value.length === 0) {
            continue;
        }
        if (typeof value === 'object' && Object.keys(value).length === 0) {
            continue;
        }
        if (unsupportedOption === 'namedChunks' ||
            unsupportedOption === 'vendorChunk' ||
            unsupportedOption === 'resourcesOutputPath' ||
            unsupportedOption === 'deployUrl') {
            context.logger.warn(`The '${unsupportedOption}' option is not used by this builder and will be ignored.`);
            continue;
        }
        context.logger.warn(`The '${unsupportedOption}' option is not yet supported by this builder.`);
    }
}
exports.logBuilderStatusWarnings = logBuilderStatusWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci1zdGF0dXMtd2FybmluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYnVpbGRlci1zdGF0dXMtd2FybmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsTUFBTSxtQkFBbUIsR0FBdUM7SUFDOUQsU0FBUztJQUVULGVBQWU7SUFDZixXQUFXO0lBRVgsZ0NBQWdDO0lBQ2hDLGlCQUFpQjtJQUVqQiw4REFBOEQ7SUFDOUQsYUFBYTtJQUNiLGFBQWE7SUFDYixxQkFBcUI7SUFFckIscUNBQXFDO0lBQ3JDLG1CQUFtQjtDQUNwQixDQUFDO0FBRUYsU0FBZ0Isd0JBQXdCLENBQUMsT0FBOEIsRUFBRSxPQUF1QjtJQUM5Riw2QkFBNkI7SUFDN0IsS0FBSyxNQUFNLGlCQUFpQixJQUFJLG1CQUFtQixFQUFFO1FBQ25ELE1BQU0sS0FBSyxHQUFJLE9BQTRDLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUUvRSxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtZQUMxQyxTQUFTO1NBQ1Y7UUFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDOUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2hFLFNBQVM7U0FDVjtRQUVELElBQ0UsaUJBQWlCLEtBQUssYUFBYTtZQUNuQyxpQkFBaUIsS0FBSyxhQUFhO1lBQ25DLGlCQUFpQixLQUFLLHFCQUFxQjtZQUMzQyxpQkFBaUIsS0FBSyxXQUFXLEVBQ2pDO1lBQ0EsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLFFBQVEsaUJBQWlCLDJEQUEyRCxDQUNyRixDQUFDO1lBQ0YsU0FBUztTQUNWO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxpQkFBaUIsZ0RBQWdELENBQUMsQ0FBQztLQUNoRztBQUNILENBQUM7QUE3QkQsNERBNkJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5jb25zdCBVTlNVUFBPUlRFRF9PUFRJT05TOiBBcnJheTxrZXlvZiBCcm93c2VyQnVpbGRlck9wdGlvbnM+ID0gW1xuICAnYnVkZ2V0cycsXG5cbiAgLy8gKiBEZXByZWNhdGVkXG4gICdkZXBsb3lVcmwnLFxuXG4gIC8vICogQWx3YXlzIGVuYWJsZWQgd2l0aCBlc2J1aWxkXG4gIC8vICdjb21tb25DaHVuaycsXG5cbiAgLy8gKiBVbnVzZWQgYnkgYnVpbGRlciBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHJlbGVhc2VcbiAgJ25hbWVkQ2h1bmtzJyxcbiAgJ3ZlbmRvckNodW5rJyxcbiAgJ3Jlc291cmNlc091dHB1dFBhdGgnLFxuXG4gIC8vICogQ3VycmVudGx5IHVuc3VwcG9ydGVkIGJ5IGVzYnVpbGRcbiAgJ3dlYldvcmtlclRzQ29uZmlnJyxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dCdWlsZGVyU3RhdHVzV2FybmluZ3Mob3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkge1xuICAvLyBWYWxpZGF0ZSBzdXBwb3J0ZWQgb3B0aW9uc1xuICBmb3IgKGNvbnN0IHVuc3VwcG9ydGVkT3B0aW9uIG9mIFVOU1VQUE9SVEVEX09QVElPTlMpIHtcbiAgICBjb25zdCB2YWx1ZSA9IChvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKVt1bnN1cHBvcnRlZE9wdGlvbl07XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdW5zdXBwb3J0ZWRPcHRpb24gPT09ICduYW1lZENodW5rcycgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAndmVuZG9yQ2h1bmsnIHx8XG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ3Jlc291cmNlc091dHB1dFBhdGgnIHx8XG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ2RlcGxveVVybCdcbiAgICApIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHVzZWQgYnkgdGhpcyBidWlsZGVyIGFuZCB3aWxsIGJlIGlnbm9yZWQuYCxcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHlldCBzdXBwb3J0ZWQgYnkgdGhpcyBidWlsZGVyLmApO1xuICB9XG59XG4iXX0=