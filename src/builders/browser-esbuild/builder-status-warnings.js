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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci1zdGF0dXMtd2FybmluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYnVpbGRlci1zdGF0dXMtd2FybmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsTUFBTSxtQkFBbUIsR0FBdUM7SUFDOUQsZUFBZTtJQUNmLFdBQVc7SUFFWCxnQ0FBZ0M7SUFDaEMsaUJBQWlCO0lBRWpCLDhEQUE4RDtJQUM5RCxhQUFhO0lBQ2IscUJBQXFCO0lBRXJCLHFDQUFxQztJQUNyQyxtQkFBbUI7Q0FDcEIsQ0FBQztBQUVGLFNBQWdCLHdCQUF3QixDQUFDLE9BQThCLEVBQUUsT0FBdUI7SUFDOUYsNkJBQTZCO0lBQzdCLEtBQUssTUFBTSxpQkFBaUIsSUFBSSxtQkFBbUIsRUFBRTtRQUNuRCxNQUFNLEtBQUssR0FBSSxPQUE0QyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFL0UsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDMUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzlDLFNBQVM7U0FDVjtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNoRSxTQUFTO1NBQ1Y7UUFFRCxJQUNFLGlCQUFpQixLQUFLLGFBQWE7WUFDbkMsaUJBQWlCLEtBQUsscUJBQXFCO1lBQzNDLGlCQUFpQixLQUFLLFdBQVcsRUFDakM7WUFDQSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsUUFBUSxpQkFBaUIsMkRBQTJELENBQ3JGLENBQUM7WUFDRixTQUFTO1NBQ1Y7UUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLGlCQUFpQixnREFBZ0QsQ0FBQyxDQUFDO0tBQ2hHO0FBQ0gsQ0FBQztBQTVCRCw0REE0QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmNvbnN0IFVOU1VQUE9SVEVEX09QVElPTlM6IEFycmF5PGtleW9mIEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4gPSBbXG4gIC8vICogRGVwcmVjYXRlZFxuICAnZGVwbG95VXJsJyxcblxuICAvLyAqIEFsd2F5cyBlbmFibGVkIHdpdGggZXNidWlsZFxuICAvLyAnY29tbW9uQ2h1bmsnLFxuXG4gIC8vICogVW51c2VkIGJ5IGJ1aWxkZXIgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSByZWxlYXNlXG4gICd2ZW5kb3JDaHVuaycsXG4gICdyZXNvdXJjZXNPdXRwdXRQYXRoJyxcblxuICAvLyAqIEN1cnJlbnRseSB1bnN1cHBvcnRlZCBieSBlc2J1aWxkXG4gICd3ZWJXb3JrZXJUc0NvbmZpZycsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nQnVpbGRlclN0YXR1c1dhcm5pbmdzKG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHtcbiAgLy8gVmFsaWRhdGUgc3VwcG9ydGVkIG9wdGlvbnNcbiAgZm9yIChjb25zdCB1bnN1cHBvcnRlZE9wdGlvbiBvZiBVTlNVUFBPUlRFRF9PUFRJT05TKSB7XG4gICAgY29uc3QgdmFsdWUgPSAob3B0aW9ucyBhcyB1bmtub3duIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucylbdW5zdXBwb3J0ZWRPcHRpb25dO1xuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IGZhbHNlKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAndmVuZG9yQ2h1bmsnIHx8XG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ3Jlc291cmNlc091dHB1dFBhdGgnIHx8XG4gICAgICB1bnN1cHBvcnRlZE9wdGlvbiA9PT0gJ2RlcGxveVVybCdcbiAgICApIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHVzZWQgYnkgdGhpcyBidWlsZGVyIGFuZCB3aWxsIGJlIGlnbm9yZWQuYCxcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHlldCBzdXBwb3J0ZWQgYnkgdGhpcyBidWlsZGVyLmApO1xuICB9XG59XG4iXX0=