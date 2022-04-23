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
    'fileReplacements',
    'progress',
    'scripts',
    'statsJson',
    // * i18n support
    'localize',
    // The following two have no effect when localize is not enabled
    // 'i18nDuplicateTranslation',
    // 'i18nMissingTranslation',
    // * Serviceworker support
    'ngswConfigPath',
    'serviceWorker',
    // * Stylesheet preprocessor support
    'inlineStyleLanguage',
    // The following option has no effect until preprocessors are supported
    // 'stylePreprocessorOptions',
    // * Watch mode
    'watch',
    'poll',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwZXJpbWVudGFsLXdhcm5pbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2V4cGVyaW1lbnRhbC13YXJuaW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCxNQUFNLG1CQUFtQixHQUF1QztJQUM5RCw2QkFBNkI7SUFDN0IsU0FBUztJQUNULGlCQUFpQjtJQUNqQixrQkFBa0I7SUFDbEIsVUFBVTtJQUNWLFNBQVM7SUFDVCxXQUFXO0lBRVgsaUJBQWlCO0lBQ2pCLFVBQVU7SUFDVixnRUFBZ0U7SUFDaEUsOEJBQThCO0lBQzlCLDRCQUE0QjtJQUU1QiwwQkFBMEI7SUFDMUIsZ0JBQWdCO0lBQ2hCLGVBQWU7SUFFZixvQ0FBb0M7SUFDcEMscUJBQXFCO0lBQ3JCLHVFQUF1RTtJQUN2RSw4QkFBOEI7SUFFOUIsZUFBZTtJQUNmLE9BQU87SUFDUCxNQUFNO0lBRU4sZUFBZTtJQUNmLFdBQVc7SUFFWCxnQ0FBZ0M7SUFDaEMsaUJBQWlCO0lBRWpCLHFDQUFxQztJQUNyQyxhQUFhO0lBQ2IsYUFBYTtJQUNiLG1CQUFtQjtDQUNwQixDQUFDO0FBRUYsU0FBZ0IsdUJBQXVCLENBQUMsT0FBOEIsRUFBRSxPQUF1QjtJQUM3RixpREFBaUQ7SUFDakQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLHdGQUF3RixDQUN6RixDQUFDO0lBRUYsNkJBQTZCO0lBQzdCLHNGQUFzRjtJQUN0RixLQUFLLE1BQU0saUJBQWlCLElBQUksbUJBQW1CLEVBQUU7UUFDbkQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFekMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDMUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzlDLFNBQVM7U0FDVjtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNoRSxTQUFTO1NBQ1Y7UUFDRCxJQUFJLGlCQUFpQixLQUFLLHFCQUFxQixJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDbEUsU0FBUztTQUNWO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLFFBQVEsaUJBQWlCLHFGQUFxRixDQUMvRyxDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBNUJELDBEQTRCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcblxuY29uc3QgVU5TVVBQT1JURURfT1BUSU9OUzogQXJyYXk8a2V5b2YgQnJvd3NlckJ1aWxkZXJPcHRpb25zPiA9IFtcbiAgJ2FsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcycsXG4gICdidWRnZXRzJyxcbiAgJ2V4dHJhY3RMaWNlbnNlcycsXG4gICdmaWxlUmVwbGFjZW1lbnRzJyxcbiAgJ3Byb2dyZXNzJyxcbiAgJ3NjcmlwdHMnLFxuICAnc3RhdHNKc29uJyxcblxuICAvLyAqIGkxOG4gc3VwcG9ydFxuICAnbG9jYWxpemUnLFxuICAvLyBUaGUgZm9sbG93aW5nIHR3byBoYXZlIG5vIGVmZmVjdCB3aGVuIGxvY2FsaXplIGlzIG5vdCBlbmFibGVkXG4gIC8vICdpMThuRHVwbGljYXRlVHJhbnNsYXRpb24nLFxuICAvLyAnaTE4bk1pc3NpbmdUcmFuc2xhdGlvbicsXG5cbiAgLy8gKiBTZXJ2aWNld29ya2VyIHN1cHBvcnRcbiAgJ25nc3dDb25maWdQYXRoJyxcbiAgJ3NlcnZpY2VXb3JrZXInLFxuXG4gIC8vICogU3R5bGVzaGVldCBwcmVwcm9jZXNzb3Igc3VwcG9ydFxuICAnaW5saW5lU3R5bGVMYW5ndWFnZScsXG4gIC8vIFRoZSBmb2xsb3dpbmcgb3B0aW9uIGhhcyBubyBlZmZlY3QgdW50aWwgcHJlcHJvY2Vzc29ycyBhcmUgc3VwcG9ydGVkXG4gIC8vICdzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMnLFxuXG4gIC8vICogV2F0Y2ggbW9kZVxuICAnd2F0Y2gnLFxuICAncG9sbCcsXG5cbiAgLy8gKiBEZXByZWNhdGVkXG4gICdkZXBsb3lVcmwnLFxuXG4gIC8vICogQWx3YXlzIGVuYWJsZWQgd2l0aCBlc2J1aWxkXG4gIC8vICdjb21tb25DaHVuaycsXG5cbiAgLy8gKiBDdXJyZW50bHkgdW5zdXBwb3J0ZWQgYnkgZXNidWlsZFxuICAnbmFtZWRDaHVua3MnLFxuICAndmVuZG9yQ2h1bmsnLFxuICAnd2ViV29ya2VyVHNDb25maWcnLFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzKG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHtcbiAgLy8gV2FybiBhYm91dCBleHBlcmltZW50YWwgc3RhdHVzIG9mIHRoaXMgYnVpbGRlclxuICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgIGBUaGUgZXNidWlsZCBicm93c2VyIGFwcGxpY2F0aW9uIGJ1aWxkZXIgKCdicm93c2VyLWVzYnVpbGQnKSBpcyBjdXJyZW50bHkgZXhwZXJpbWVudGFsLmAsXG4gICk7XG5cbiAgLy8gVmFsaWRhdGUgc3VwcG9ydGVkIG9wdGlvbnNcbiAgLy8gQ3VycmVudGx5IG9ubHkgYSBzdWJzZXQgb2YgdGhlIFdlYnBhY2stYmFzZWQgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgYXJlIHN1cHBvcnRlZC5cbiAgZm9yIChjb25zdCB1bnN1cHBvcnRlZE9wdGlvbiBvZiBVTlNVUFBPUlRFRF9PUFRJT05TKSB7XG4gICAgY29uc3QgdmFsdWUgPSBvcHRpb25zW3Vuc3VwcG9ydGVkT3B0aW9uXTtcblxuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBmYWxzZSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyh2YWx1ZSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHVuc3VwcG9ydGVkT3B0aW9uID09PSAnaW5saW5lU3R5bGVMYW5ndWFnZScgJiYgdmFsdWUgPT09ICdjc3MnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgYFRoZSAnJHt1bnN1cHBvcnRlZE9wdGlvbn0nIG9wdGlvbiBpcyBjdXJyZW50bHkgdW5zdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlciBhbmQgd2lsbCBiZSBpZ25vcmVkLmAsXG4gICAgKTtcbiAgfVxufVxuIl19