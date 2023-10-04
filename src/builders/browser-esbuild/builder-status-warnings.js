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
        if (unsupportedOption === 'vendorChunk' ||
            unsupportedOption === 'resourcesOutputPath' ||
            unsupportedOption === 'deployUrl') {
            context.logger.warn(`The '${unsupportedOption}' option is not used by this builder and will be ignored.`);
            continue;
        }
        context.logger.warn(`The '${unsupportedOption}' option is not yet supported by this builder.`);
    }
}
exports.logBuilderStatusWarnings = logBuilderStatusWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci1zdGF0dXMtd2FybmluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYnVpbGRlci1zdGF0dXMtd2FybmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsTUFBTSxtQkFBbUIsR0FBdUM7SUFDOUQsU0FBUztJQUVULGVBQWU7SUFDZixXQUFXO0lBRVgsZ0NBQWdDO0lBQ2hDLGlCQUFpQjtJQUVqQiw4REFBOEQ7SUFDOUQsYUFBYTtJQUNiLHFCQUFxQjtJQUVyQixxQ0FBcUM7SUFDckMsbUJBQW1CO0NBQ3BCLENBQUM7QUFFRixTQUFnQix3QkFBd0IsQ0FBQyxPQUE4QixFQUFFLE9BQXVCO0lBQzlGLDZCQUE2QjtJQUM3QixLQUFLLE1BQU0saUJBQWlCLElBQUksbUJBQW1CLEVBQUU7UUFDbkQsTUFBTSxLQUFLLEdBQUksT0FBNEMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRS9FLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssS0FBSyxFQUFFO1lBQzFDLFNBQVM7U0FDVjtRQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUM5QyxTQUFTO1NBQ1Y7UUFDRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDaEUsU0FBUztTQUNWO1FBRUQsSUFDRSxpQkFBaUIsS0FBSyxhQUFhO1lBQ25DLGlCQUFpQixLQUFLLHFCQUFxQjtZQUMzQyxpQkFBaUIsS0FBSyxXQUFXLEVBQ2pDO1lBQ0EsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLFFBQVEsaUJBQWlCLDJEQUEyRCxDQUNyRixDQUFDO1lBQ0YsU0FBUztTQUNWO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxpQkFBaUIsZ0RBQWdELENBQUMsQ0FBQztLQUNoRztBQUNILENBQUM7QUE1QkQsNERBNEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5jb25zdCBVTlNVUFBPUlRFRF9PUFRJT05TOiBBcnJheTxrZXlvZiBCcm93c2VyQnVpbGRlck9wdGlvbnM+ID0gW1xuICAnYnVkZ2V0cycsXG5cbiAgLy8gKiBEZXByZWNhdGVkXG4gICdkZXBsb3lVcmwnLFxuXG4gIC8vICogQWx3YXlzIGVuYWJsZWQgd2l0aCBlc2J1aWxkXG4gIC8vICdjb21tb25DaHVuaycsXG5cbiAgLy8gKiBVbnVzZWQgYnkgYnVpbGRlciBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHJlbGVhc2VcbiAgJ3ZlbmRvckNodW5rJyxcbiAgJ3Jlc291cmNlc091dHB1dFBhdGgnLFxuXG4gIC8vICogQ3VycmVudGx5IHVuc3VwcG9ydGVkIGJ5IGVzYnVpbGRcbiAgJ3dlYldvcmtlclRzQ29uZmlnJyxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dCdWlsZGVyU3RhdHVzV2FybmluZ3Mob3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkge1xuICAvLyBWYWxpZGF0ZSBzdXBwb3J0ZWQgb3B0aW9uc1xuICBmb3IgKGNvbnN0IHVuc3VwcG9ydGVkT3B0aW9uIG9mIFVOU1VQUE9SVEVEX09QVElPTlMpIHtcbiAgICBjb25zdCB2YWx1ZSA9IChvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKVt1bnN1cHBvcnRlZE9wdGlvbl07XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdW5zdXBwb3J0ZWRPcHRpb24gPT09ICd2ZW5kb3JDaHVuaycgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAncmVzb3VyY2VzT3V0cHV0UGF0aCcgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAnZGVwbG95VXJsJ1xuICAgICkge1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRoZSAnJHt1bnN1cHBvcnRlZE9wdGlvbn0nIG9wdGlvbiBpcyBub3QgdXNlZCBieSB0aGlzIGJ1aWxkZXIgYW5kIHdpbGwgYmUgaWdub3JlZC5gLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oYFRoZSAnJHt1bnN1cHBvcnRlZE9wdGlvbn0nIG9wdGlvbiBpcyBub3QgeWV0IHN1cHBvcnRlZCBieSB0aGlzIGJ1aWxkZXIuYCk7XG4gIH1cbn1cbiJdfQ==