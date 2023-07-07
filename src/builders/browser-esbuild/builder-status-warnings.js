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
    // * i18n support
    'localize',
    // The following two have no effect when localize is not enabled
    // 'i18nDuplicateTranslation',
    // 'i18nMissingTranslation',
    // * Deprecated
    'deployUrl',
    // * Always enabled with esbuild
    // 'commonChunk',
    // * Unused by builder and will be removed in a future release
    'namedChunks',
    'vendorChunk',
    // * Currently unsupported by esbuild
    'webWorkerTsConfig',
];
function logBuilderStatusWarnings(options, context) {
    context.logger.warn(`The esbuild-based browser application builder ('browser-esbuild') is currently in developer preview` +
        ' and is not yet recommended for production use.' +
        ' For additional information, please see https://angular.io/guide/esbuild');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci1zdGF0dXMtd2FybmluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYnVpbGRlci1zdGF0dXMtd2FybmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsTUFBTSxtQkFBbUIsR0FBdUM7SUFDOUQsU0FBUztJQUVULGlCQUFpQjtJQUNqQixVQUFVO0lBQ1YsZ0VBQWdFO0lBQ2hFLDhCQUE4QjtJQUM5Qiw0QkFBNEI7SUFFNUIsZUFBZTtJQUNmLFdBQVc7SUFFWCxnQ0FBZ0M7SUFDaEMsaUJBQWlCO0lBRWpCLDhEQUE4RDtJQUM5RCxhQUFhO0lBQ2IsYUFBYTtJQUViLHFDQUFxQztJQUNyQyxtQkFBbUI7Q0FDcEIsQ0FBQztBQUVGLFNBQWdCLHdCQUF3QixDQUFDLE9BQThCLEVBQUUsT0FBdUI7SUFDOUYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLHFHQUFxRztRQUNuRyxpREFBaUQ7UUFDakQsMEVBQTBFLENBQzdFLENBQUM7SUFFRiw2QkFBNkI7SUFDN0IsS0FBSyxNQUFNLGlCQUFpQixJQUFJLG1CQUFtQixFQUFFO1FBQ25ELE1BQU0sS0FBSyxHQUFJLE9BQTRDLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUUvRSxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtZQUMxQyxTQUFTO1NBQ1Y7UUFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDOUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2hFLFNBQVM7U0FDVjtRQUVELElBQ0UsaUJBQWlCLEtBQUssYUFBYTtZQUNuQyxpQkFBaUIsS0FBSyxhQUFhO1lBQ25DLGlCQUFpQixLQUFLLHFCQUFxQjtZQUMzQyxpQkFBaUIsS0FBSyxXQUFXLEVBQ2pDO1lBQ0EsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLFFBQVEsaUJBQWlCLDJEQUEyRCxDQUNyRixDQUFDO1lBQ0YsU0FBUztTQUNWO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxpQkFBaUIsZ0RBQWdELENBQUMsQ0FBQztLQUNoRztBQUNILENBQUM7QUFuQ0QsNERBbUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5jb25zdCBVTlNVUFBPUlRFRF9PUFRJT05TOiBBcnJheTxrZXlvZiBCcm93c2VyQnVpbGRlck9wdGlvbnM+ID0gW1xuICAnYnVkZ2V0cycsXG5cbiAgLy8gKiBpMThuIHN1cHBvcnRcbiAgJ2xvY2FsaXplJyxcbiAgLy8gVGhlIGZvbGxvd2luZyB0d28gaGF2ZSBubyBlZmZlY3Qgd2hlbiBsb2NhbGl6ZSBpcyBub3QgZW5hYmxlZFxuICAvLyAnaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uJyxcbiAgLy8gJ2kxOG5NaXNzaW5nVHJhbnNsYXRpb24nLFxuXG4gIC8vICogRGVwcmVjYXRlZFxuICAnZGVwbG95VXJsJyxcblxuICAvLyAqIEFsd2F5cyBlbmFibGVkIHdpdGggZXNidWlsZFxuICAvLyAnY29tbW9uQ2h1bmsnLFxuXG4gIC8vICogVW51c2VkIGJ5IGJ1aWxkZXIgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSByZWxlYXNlXG4gICduYW1lZENodW5rcycsXG4gICd2ZW5kb3JDaHVuaycsXG5cbiAgLy8gKiBDdXJyZW50bHkgdW5zdXBwb3J0ZWQgYnkgZXNidWlsZFxuICAnd2ViV29ya2VyVHNDb25maWcnLFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ0J1aWxkZXJTdGF0dXNXYXJuaW5ncyhvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7XG4gIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgYFRoZSBlc2J1aWxkLWJhc2VkIGJyb3dzZXIgYXBwbGljYXRpb24gYnVpbGRlciAoJ2Jyb3dzZXItZXNidWlsZCcpIGlzIGN1cnJlbnRseSBpbiBkZXZlbG9wZXIgcHJldmlld2AgK1xuICAgICAgJyBhbmQgaXMgbm90IHlldCByZWNvbW1lbmRlZCBmb3IgcHJvZHVjdGlvbiB1c2UuJyArXG4gICAgICAnIEZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uLCBwbGVhc2Ugc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9lc2J1aWxkJyxcbiAgKTtcblxuICAvLyBWYWxpZGF0ZSBzdXBwb3J0ZWQgb3B0aW9uc1xuICBmb3IgKGNvbnN0IHVuc3VwcG9ydGVkT3B0aW9uIG9mIFVOU1VQUE9SVEVEX09QVElPTlMpIHtcbiAgICBjb25zdCB2YWx1ZSA9IChvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKVt1bnN1cHBvcnRlZE9wdGlvbl07XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdW5zdXBwb3J0ZWRPcHRpb24gPT09ICduYW1lZENodW5rcycgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAndmVuZG9yQ2h1bmsnIHx8XG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ3Jlc291cmNlc091dHB1dFBhdGgnIHx8XG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ2RlcGxveVVybCdcbiAgICApIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHVzZWQgYnkgdGhpcyBidWlsZGVyIGFuZCB3aWxsIGJlIGlnbm9yZWQuYCxcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHlldCBzdXBwb3J0ZWQgYnkgdGhpcyBidWlsZGVyLmApO1xuICB9XG59XG4iXX0=