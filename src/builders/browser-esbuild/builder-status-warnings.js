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
            unsupportedOption === 'deployUrl') {
            context.logger.warn(`The '${unsupportedOption}' option is not used by this builder and will be ignored.`);
            continue;
        }
        context.logger.warn(`The '${unsupportedOption}' option is not yet supported by this builder.`);
    }
}
exports.logBuilderStatusWarnings = logBuilderStatusWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci1zdGF0dXMtd2FybmluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYnVpbGRlci1zdGF0dXMtd2FybmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsTUFBTSxtQkFBbUIsR0FBdUM7SUFDOUQsU0FBUztJQUVULGlCQUFpQjtJQUNqQixVQUFVO0lBQ1YsZ0VBQWdFO0lBQ2hFLDhCQUE4QjtJQUM5Qiw0QkFBNEI7SUFFNUIsZUFBZTtJQUNmLFdBQVc7SUFFWCxnQ0FBZ0M7SUFDaEMsaUJBQWlCO0lBRWpCLDhEQUE4RDtJQUM5RCxhQUFhO0lBQ2IsYUFBYTtJQUViLHFDQUFxQztJQUNyQyxtQkFBbUI7Q0FDcEIsQ0FBQztBQUVGLFNBQWdCLHdCQUF3QixDQUFDLE9BQThCLEVBQUUsT0FBdUI7SUFDOUYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLHFHQUFxRztRQUNuRyxpREFBaUQ7UUFDakQsMEVBQTBFLENBQzdFLENBQUM7SUFFRiw2QkFBNkI7SUFDN0IsS0FBSyxNQUFNLGlCQUFpQixJQUFJLG1CQUFtQixFQUFFO1FBQ25ELE1BQU0sS0FBSyxHQUFJLE9BQTRDLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUUvRSxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtZQUMxQyxTQUFTO1NBQ1Y7UUFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDOUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2hFLFNBQVM7U0FDVjtRQUVELElBQ0UsaUJBQWlCLEtBQUssYUFBYTtZQUNuQyxpQkFBaUIsS0FBSyxhQUFhO1lBQ25DLGlCQUFpQixLQUFLLFdBQVcsRUFDakM7WUFDQSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsUUFBUSxpQkFBaUIsMkRBQTJELENBQ3JGLENBQUM7WUFDRixTQUFTO1NBQ1Y7UUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLGlCQUFpQixnREFBZ0QsQ0FBQyxDQUFDO0tBQ2hHO0FBQ0gsQ0FBQztBQWxDRCw0REFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5cbmNvbnN0IFVOU1VQUE9SVEVEX09QVElPTlM6IEFycmF5PGtleW9mIEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4gPSBbXG4gICdidWRnZXRzJyxcblxuICAvLyAqIGkxOG4gc3VwcG9ydFxuICAnbG9jYWxpemUnLFxuICAvLyBUaGUgZm9sbG93aW5nIHR3byBoYXZlIG5vIGVmZmVjdCB3aGVuIGxvY2FsaXplIGlzIG5vdCBlbmFibGVkXG4gIC8vICdpMThuRHVwbGljYXRlVHJhbnNsYXRpb24nLFxuICAvLyAnaTE4bk1pc3NpbmdUcmFuc2xhdGlvbicsXG5cbiAgLy8gKiBEZXByZWNhdGVkXG4gICdkZXBsb3lVcmwnLFxuXG4gIC8vICogQWx3YXlzIGVuYWJsZWQgd2l0aCBlc2J1aWxkXG4gIC8vICdjb21tb25DaHVuaycsXG5cbiAgLy8gKiBVbnVzZWQgYnkgYnVpbGRlciBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHJlbGVhc2VcbiAgJ25hbWVkQ2h1bmtzJyxcbiAgJ3ZlbmRvckNodW5rJyxcblxuICAvLyAqIEN1cnJlbnRseSB1bnN1cHBvcnRlZCBieSBlc2J1aWxkXG4gICd3ZWJXb3JrZXJUc0NvbmZpZycsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nQnVpbGRlclN0YXR1c1dhcm5pbmdzKG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHtcbiAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICBgVGhlIGVzYnVpbGQtYmFzZWQgYnJvd3NlciBhcHBsaWNhdGlvbiBidWlsZGVyICgnYnJvd3Nlci1lc2J1aWxkJykgaXMgY3VycmVudGx5IGluIGRldmVsb3BlciBwcmV2aWV3YCArXG4gICAgICAnIGFuZCBpcyBub3QgeWV0IHJlY29tbWVuZGVkIGZvciBwcm9kdWN0aW9uIHVzZS4nICtcbiAgICAgICcgRm9yIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24sIHBsZWFzZSBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2VzYnVpbGQnLFxuICApO1xuXG4gIC8vIFZhbGlkYXRlIHN1cHBvcnRlZCBvcHRpb25zXG4gIGZvciAoY29uc3QgdW5zdXBwb3J0ZWRPcHRpb24gb2YgVU5TVVBQT1JURURfT1BUSU9OUykge1xuICAgIGNvbnN0IHZhbHVlID0gKG9wdGlvbnMgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMpW3Vuc3VwcG9ydGVkT3B0aW9uXTtcblxuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBmYWxzZSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyh2YWx1ZSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ25hbWVkQ2h1bmtzJyB8fFxuICAgICAgdW5zdXBwb3J0ZWRPcHRpb24gPT09ICd2ZW5kb3JDaHVuaycgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAnZGVwbG95VXJsJ1xuICAgICkge1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRoZSAnJHt1bnN1cHBvcnRlZE9wdGlvbn0nIG9wdGlvbiBpcyBub3QgdXNlZCBieSB0aGlzIGJ1aWxkZXIgYW5kIHdpbGwgYmUgaWdub3JlZC5gLFxuICAgICAgKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oYFRoZSAnJHt1bnN1cHBvcnRlZE9wdGlvbn0nIG9wdGlvbiBpcyBub3QgeWV0IHN1cHBvcnRlZCBieSB0aGlzIGJ1aWxkZXIuYCk7XG4gIH1cbn1cbiJdfQ==