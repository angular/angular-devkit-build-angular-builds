"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logExperimentalWarnings = void 0;
const UNSUPPORTED_OPTIONS = [
    'allowedCommonJsDependencies',
    'budgets',
    'extractLicenses',
    'progress',
    'scripts',
    // * i18n support
    'localize',
    // The following two have no effect when localize is not enabled
    // 'i18nDuplicateTranslation',
    // 'i18nMissingTranslation',
    // * Deprecated
    'deployUrl',
    // * Always enabled with esbuild
    // 'commonChunk',
    // * Currently unsupported by esbuild
    'namedChunks',
    'vendorChunk',
    'webWorkerTsConfig',
];
function logExperimentalWarnings(options, context) {
    // Warn about experimental status of this builder
    context.logger.warn(`The esbuild browser application builder ('browser-esbuild') is currently experimental.`);
    // Validate supported options
    // Currently only a subset of the Webpack-based browser builder options are supported.
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
        context.logger.warn(`The '${unsupportedOption}' option is currently unsupported by this experimental builder and will be ignored.`);
    }
    if (options.inlineStyleLanguage === 'less') {
        context.logger.warn('The less stylesheet preprocessor is not currently supported.');
    }
}
exports.logExperimentalWarnings = logExperimentalWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwZXJpbWVudGFsLXdhcm5pbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2V4cGVyaW1lbnRhbC13YXJuaW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCxNQUFNLG1CQUFtQixHQUF1QztJQUM5RCw2QkFBNkI7SUFDN0IsU0FBUztJQUNULGlCQUFpQjtJQUNqQixVQUFVO0lBQ1YsU0FBUztJQUVULGlCQUFpQjtJQUNqQixVQUFVO0lBQ1YsZ0VBQWdFO0lBQ2hFLDhCQUE4QjtJQUM5Qiw0QkFBNEI7SUFFNUIsZUFBZTtJQUNmLFdBQVc7SUFFWCxnQ0FBZ0M7SUFDaEMsaUJBQWlCO0lBRWpCLHFDQUFxQztJQUNyQyxhQUFhO0lBQ2IsYUFBYTtJQUNiLG1CQUFtQjtDQUNwQixDQUFDO0FBRUYsU0FBZ0IsdUJBQXVCLENBQUMsT0FBOEIsRUFBRSxPQUF1QjtJQUM3RixpREFBaUQ7SUFDakQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLHdGQUF3RixDQUN6RixDQUFDO0lBRUYsNkJBQTZCO0lBQzdCLHNGQUFzRjtJQUN0RixLQUFLLE1BQU0saUJBQWlCLElBQUksbUJBQW1CLEVBQUU7UUFDbkQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFekMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDMUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzlDLFNBQVM7U0FDVjtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNoRSxTQUFTO1NBQ1Y7UUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsUUFBUSxpQkFBaUIscUZBQXFGLENBQy9HLENBQUM7S0FDSDtJQUVELElBQUksT0FBTyxDQUFDLG1CQUFtQixLQUFLLE1BQU0sRUFBRTtRQUMxQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyw4REFBOEQsQ0FBQyxDQUFDO0tBQ3JGO0FBQ0gsQ0FBQztBQTdCRCwwREE2QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5cbmNvbnN0IFVOU1VQUE9SVEVEX09QVElPTlM6IEFycmF5PGtleW9mIEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4gPSBbXG4gICdhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMnLFxuICAnYnVkZ2V0cycsXG4gICdleHRyYWN0TGljZW5zZXMnLFxuICAncHJvZ3Jlc3MnLFxuICAnc2NyaXB0cycsXG5cbiAgLy8gKiBpMThuIHN1cHBvcnRcbiAgJ2xvY2FsaXplJyxcbiAgLy8gVGhlIGZvbGxvd2luZyB0d28gaGF2ZSBubyBlZmZlY3Qgd2hlbiBsb2NhbGl6ZSBpcyBub3QgZW5hYmxlZFxuICAvLyAnaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uJyxcbiAgLy8gJ2kxOG5NaXNzaW5nVHJhbnNsYXRpb24nLFxuXG4gIC8vICogRGVwcmVjYXRlZFxuICAnZGVwbG95VXJsJyxcblxuICAvLyAqIEFsd2F5cyBlbmFibGVkIHdpdGggZXNidWlsZFxuICAvLyAnY29tbW9uQ2h1bmsnLFxuXG4gIC8vICogQ3VycmVudGx5IHVuc3VwcG9ydGVkIGJ5IGVzYnVpbGRcbiAgJ25hbWVkQ2h1bmtzJyxcbiAgJ3ZlbmRvckNodW5rJyxcbiAgJ3dlYldvcmtlclRzQ29uZmlnJyxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyhvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7XG4gIC8vIFdhcm4gYWJvdXQgZXhwZXJpbWVudGFsIHN0YXR1cyBvZiB0aGlzIGJ1aWxkZXJcbiAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICBgVGhlIGVzYnVpbGQgYnJvd3NlciBhcHBsaWNhdGlvbiBidWlsZGVyICgnYnJvd3Nlci1lc2J1aWxkJykgaXMgY3VycmVudGx5IGV4cGVyaW1lbnRhbC5gLFxuICApO1xuXG4gIC8vIFZhbGlkYXRlIHN1cHBvcnRlZCBvcHRpb25zXG4gIC8vIEN1cnJlbnRseSBvbmx5IGEgc3Vic2V0IG9mIHRoZSBXZWJwYWNrLWJhc2VkIGJyb3dzZXIgYnVpbGRlciBvcHRpb25zIGFyZSBzdXBwb3J0ZWQuXG4gIGZvciAoY29uc3QgdW5zdXBwb3J0ZWRPcHRpb24gb2YgVU5TVVBQT1JURURfT1BUSU9OUykge1xuICAgIGNvbnN0IHZhbHVlID0gb3B0aW9uc1t1bnN1cHBvcnRlZE9wdGlvbl07XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgIGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgY3VycmVudGx5IHVuc3VwcG9ydGVkIGJ5IHRoaXMgZXhwZXJpbWVudGFsIGJ1aWxkZXIgYW5kIHdpbGwgYmUgaWdub3JlZC5gLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlID09PSAnbGVzcycpIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKCdUaGUgbGVzcyBzdHlsZXNoZWV0IHByZXByb2Nlc3NvciBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZC4nKTtcbiAgfVxufVxuIl19