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
    // * Always enabled with esbuild
    // 'commonChunk',
    // * Unused by builder and will be removed in a future release
    'vendorChunk',
    'resourcesOutputPath',
    // * Currently unsupported by esbuild
    'webWorkerTsConfig',
];
function logBuilderStatusWarnings(options, { logger }) {
    logger.warn(`The 'browser-esbuild' builder is a compatibility builder which will be removed in a future major ` +
        `version in favor of the 'application' builder.`);
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
            logger.warn(`The '${unsupportedOption}' option is not used by this builder and will be ignored.`);
            continue;
        }
        logger.warn(`The '${unsupportedOption}' option is not yet supported by this builder.`);
    }
}
exports.logBuilderStatusWarnings = logBuilderStatusWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci1zdGF0dXMtd2FybmluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYnVpbGRlci1zdGF0dXMtd2FybmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsTUFBTSxtQkFBbUIsR0FBdUM7SUFDOUQsZ0NBQWdDO0lBQ2hDLGlCQUFpQjtJQUVqQiw4REFBOEQ7SUFDOUQsYUFBYTtJQUNiLHFCQUFxQjtJQUVyQixxQ0FBcUM7SUFDckMsbUJBQW1CO0NBQ3BCLENBQUM7QUFFRixTQUFnQix3QkFBd0IsQ0FDdEMsT0FBOEIsRUFDOUIsRUFBRSxNQUFNLEVBQWtCO0lBRTFCLE1BQU0sQ0FBQyxJQUFJLENBQ1QsbUdBQW1HO1FBQ2pHLGdEQUFnRCxDQUNuRCxDQUFDO0lBRUYsNkJBQTZCO0lBQzdCLEtBQUssTUFBTSxpQkFBaUIsSUFBSSxtQkFBbUIsRUFBRTtRQUNuRCxNQUFNLEtBQUssR0FBSSxPQUE0QyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFL0UsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDMUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzlDLFNBQVM7U0FDVjtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNoRSxTQUFTO1NBQ1Y7UUFFRCxJQUNFLGlCQUFpQixLQUFLLGFBQWE7WUFDbkMsaUJBQWlCLEtBQUsscUJBQXFCO1lBQzNDLGlCQUFpQixLQUFLLFdBQVcsRUFDakM7WUFDQSxNQUFNLENBQUMsSUFBSSxDQUNULFFBQVEsaUJBQWlCLDJEQUEyRCxDQUNyRixDQUFDO1lBQ0YsU0FBUztTQUNWO1FBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLGlCQUFpQixnREFBZ0QsQ0FBQyxDQUFDO0tBQ3hGO0FBQ0gsQ0FBQztBQXBDRCw0REFvQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmNvbnN0IFVOU1VQUE9SVEVEX09QVElPTlM6IEFycmF5PGtleW9mIEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4gPSBbXG4gIC8vICogQWx3YXlzIGVuYWJsZWQgd2l0aCBlc2J1aWxkXG4gIC8vICdjb21tb25DaHVuaycsXG5cbiAgLy8gKiBVbnVzZWQgYnkgYnVpbGRlciBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHJlbGVhc2VcbiAgJ3ZlbmRvckNodW5rJyxcbiAgJ3Jlc291cmNlc091dHB1dFBhdGgnLFxuXG4gIC8vICogQ3VycmVudGx5IHVuc3VwcG9ydGVkIGJ5IGVzYnVpbGRcbiAgJ3dlYldvcmtlclRzQ29uZmlnJyxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dCdWlsZGVyU3RhdHVzV2FybmluZ3MoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgeyBsb2dnZXIgfTogQnVpbGRlckNvbnRleHQsXG4pIHtcbiAgbG9nZ2VyLndhcm4oXG4gICAgYFRoZSAnYnJvd3Nlci1lc2J1aWxkJyBidWlsZGVyIGlzIGEgY29tcGF0aWJpbGl0eSBidWlsZGVyIHdoaWNoIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSBtYWpvciBgICtcbiAgICAgIGB2ZXJzaW9uIGluIGZhdm9yIG9mIHRoZSAnYXBwbGljYXRpb24nIGJ1aWxkZXIuYCxcbiAgKTtcblxuICAvLyBWYWxpZGF0ZSBzdXBwb3J0ZWQgb3B0aW9uc1xuICBmb3IgKGNvbnN0IHVuc3VwcG9ydGVkT3B0aW9uIG9mIFVOU1VQUE9SVEVEX09QVElPTlMpIHtcbiAgICBjb25zdCB2YWx1ZSA9IChvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKVt1bnN1cHBvcnRlZE9wdGlvbl07XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdW5zdXBwb3J0ZWRPcHRpb24gPT09ICd2ZW5kb3JDaHVuaycgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAncmVzb3VyY2VzT3V0cHV0UGF0aCcgfHxcbiAgICAgIHVuc3VwcG9ydGVkT3B0aW9uID09PSAnZGVwbG95VXJsJ1xuICAgICkge1xuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgIGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgbm90IHVzZWQgYnkgdGhpcyBidWlsZGVyIGFuZCB3aWxsIGJlIGlnbm9yZWQuYCxcbiAgICAgICk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsb2dnZXIud2FybihgVGhlICcke3Vuc3VwcG9ydGVkT3B0aW9ufScgb3B0aW9uIGlzIG5vdCB5ZXQgc3VwcG9ydGVkIGJ5IHRoaXMgYnVpbGRlci5gKTtcbiAgfVxufVxuIl19