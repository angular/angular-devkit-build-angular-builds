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
    'statsJson',
    // * i18n support
    'localize',
    // The following two have no effect when localize is not enabled
    // 'i18nDuplicateTranslation',
    // 'i18nMissingTranslation',
    // * Stylesheet preprocessor support
    'inlineStyleLanguage',
    // The following option has no effect until preprocessors are supported
    // 'stylePreprocessorOptions',
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
        if (unsupportedOption === 'inlineStyleLanguage' && value === 'css') {
            continue;
        }
        context.logger.warn(`The '${unsupportedOption}' option is currently unsupported by this experimental builder and will be ignored.`);
    }
}
exports.logExperimentalWarnings = logExperimentalWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwZXJpbWVudGFsLXdhcm5pbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2V4cGVyaW1lbnRhbC13YXJuaW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCxNQUFNLG1CQUFtQixHQUF1QztJQUM5RCw2QkFBNkI7SUFDN0IsU0FBUztJQUNULGlCQUFpQjtJQUNqQixVQUFVO0lBQ1YsU0FBUztJQUNULFdBQVc7SUFFWCxpQkFBaUI7SUFDakIsVUFBVTtJQUNWLGdFQUFnRTtJQUNoRSw4QkFBOEI7SUFDOUIsNEJBQTRCO0lBRTVCLG9DQUFvQztJQUNwQyxxQkFBcUI7SUFDckIsdUVBQXVFO0lBQ3ZFLDhCQUE4QjtJQUU5QixlQUFlO0lBQ2YsV0FBVztJQUVYLGdDQUFnQztJQUNoQyxpQkFBaUI7SUFFakIscUNBQXFDO0lBQ3JDLGFBQWE7SUFDYixhQUFhO0lBQ2IsbUJBQW1CO0NBQ3BCLENBQUM7QUFFRixTQUFnQix1QkFBdUIsQ0FBQyxPQUE4QixFQUFFLE9BQXVCO0lBQzdGLGlEQUFpRDtJQUNqRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsd0ZBQXdGLENBQ3pGLENBQUM7SUFFRiw2QkFBNkI7SUFDN0Isc0ZBQXNGO0lBQ3RGLEtBQUssTUFBTSxpQkFBaUIsSUFBSSxtQkFBbUIsRUFBRTtRQUNuRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUV6QyxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtZQUMxQyxTQUFTO1NBQ1Y7UUFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDOUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2hFLFNBQVM7U0FDVjtRQUNELElBQUksaUJBQWlCLEtBQUsscUJBQXFCLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtZQUNsRSxTQUFTO1NBQ1Y7UUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsUUFBUSxpQkFBaUIscUZBQXFGLENBQy9HLENBQUM7S0FDSDtBQUNILENBQUM7QUE1QkQsMERBNEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuXG5jb25zdCBVTlNVUFBPUlRFRF9PUFRJT05TOiBBcnJheTxrZXlvZiBCcm93c2VyQnVpbGRlck9wdGlvbnM+ID0gW1xuICAnYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzJyxcbiAgJ2J1ZGdldHMnLFxuICAnZXh0cmFjdExpY2Vuc2VzJyxcbiAgJ3Byb2dyZXNzJyxcbiAgJ3NjcmlwdHMnLFxuICAnc3RhdHNKc29uJyxcblxuICAvLyAqIGkxOG4gc3VwcG9ydFxuICAnbG9jYWxpemUnLFxuICAvLyBUaGUgZm9sbG93aW5nIHR3byBoYXZlIG5vIGVmZmVjdCB3aGVuIGxvY2FsaXplIGlzIG5vdCBlbmFibGVkXG4gIC8vICdpMThuRHVwbGljYXRlVHJhbnNsYXRpb24nLFxuICAvLyAnaTE4bk1pc3NpbmdUcmFuc2xhdGlvbicsXG5cbiAgLy8gKiBTdHlsZXNoZWV0IHByZXByb2Nlc3NvciBzdXBwb3J0XG4gICdpbmxpbmVTdHlsZUxhbmd1YWdlJyxcbiAgLy8gVGhlIGZvbGxvd2luZyBvcHRpb24gaGFzIG5vIGVmZmVjdCB1bnRpbCBwcmVwcm9jZXNzb3JzIGFyZSBzdXBwb3J0ZWRcbiAgLy8gJ3N0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucycsXG5cbiAgLy8gKiBEZXByZWNhdGVkXG4gICdkZXBsb3lVcmwnLFxuXG4gIC8vICogQWx3YXlzIGVuYWJsZWQgd2l0aCBlc2J1aWxkXG4gIC8vICdjb21tb25DaHVuaycsXG5cbiAgLy8gKiBDdXJyZW50bHkgdW5zdXBwb3J0ZWQgYnkgZXNidWlsZFxuICAnbmFtZWRDaHVua3MnLFxuICAndmVuZG9yQ2h1bmsnLFxuICAnd2ViV29ya2VyVHNDb25maWcnLFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzKG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHtcbiAgLy8gV2FybiBhYm91dCBleHBlcmltZW50YWwgc3RhdHVzIG9mIHRoaXMgYnVpbGRlclxuICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgIGBUaGUgZXNidWlsZCBicm93c2VyIGFwcGxpY2F0aW9uIGJ1aWxkZXIgKCdicm93c2VyLWVzYnVpbGQnKSBpcyBjdXJyZW50bHkgZXhwZXJpbWVudGFsLmAsXG4gICk7XG5cbiAgLy8gVmFsaWRhdGUgc3VwcG9ydGVkIG9wdGlvbnNcbiAgLy8gQ3VycmVudGx5IG9ubHkgYSBzdWJzZXQgb2YgdGhlIFdlYnBhY2stYmFzZWQgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgYXJlIHN1cHBvcnRlZC5cbiAgZm9yIChjb25zdCB1bnN1cHBvcnRlZE9wdGlvbiBvZiBVTlNVUFBPUlRFRF9PUFRJT05TKSB7XG4gICAgY29uc3QgdmFsdWUgPSBvcHRpb25zW3Vuc3VwcG9ydGVkT3B0aW9uXTtcblxuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBmYWxzZSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyh2YWx1ZSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHVuc3VwcG9ydGVkT3B0aW9uID09PSAnaW5saW5lU3R5bGVMYW5ndWFnZScgJiYgdmFsdWUgPT09ICdjc3MnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgYFRoZSAnJHt1bnN1cHBvcnRlZE9wdGlvbn0nIG9wdGlvbiBpcyBjdXJyZW50bHkgdW5zdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlciBhbmQgd2lsbCBiZSBpZ25vcmVkLmAsXG4gICAgKTtcbiAgfVxufVxuIl19