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
}
exports.logExperimentalWarnings = logExperimentalWarnings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwZXJpbWVudGFsLXdhcm5pbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2V4cGVyaW1lbnRhbC13YXJuaW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFNSCxNQUFNLG1CQUFtQixHQUF1QztJQUM5RCxTQUFTO0lBRVQsaUJBQWlCO0lBQ2pCLFVBQVU7SUFDVixnRUFBZ0U7SUFDaEUsOEJBQThCO0lBQzlCLDRCQUE0QjtJQUU1QixlQUFlO0lBQ2YsV0FBVztJQUVYLGdDQUFnQztJQUNoQyxpQkFBaUI7SUFFakIscUNBQXFDO0lBQ3JDLGFBQWE7SUFDYixhQUFhO0lBQ2IsbUJBQW1CO0NBQ3BCLENBQUM7QUFFRixTQUFnQix1QkFBdUIsQ0FBQyxPQUE4QixFQUFFLE9BQXVCO0lBQzdGLGlEQUFpRDtJQUNqRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsd0ZBQXdGLENBQ3pGLENBQUM7SUFFRiw2QkFBNkI7SUFDN0Isc0ZBQXNGO0lBQ3RGLEtBQUssTUFBTSxpQkFBaUIsSUFBSSxtQkFBbUIsRUFBRTtRQUNuRCxNQUFNLEtBQUssR0FBSSxPQUE0QyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFL0UsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDMUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzlDLFNBQVM7U0FDVjtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNoRSxTQUFTO1NBQ1Y7UUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsUUFBUSxpQkFBaUIscUZBQXFGLENBQy9HLENBQUM7S0FDSDtBQUNILENBQUM7QUF6QkQsMERBeUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnJvd3NlckVzYnVpbGRPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuY29uc3QgVU5TVVBQT1JURURfT1BUSU9OUzogQXJyYXk8a2V5b2YgQnJvd3NlckJ1aWxkZXJPcHRpb25zPiA9IFtcbiAgJ2J1ZGdldHMnLFxuXG4gIC8vICogaTE4biBzdXBwb3J0XG4gICdsb2NhbGl6ZScsXG4gIC8vIFRoZSBmb2xsb3dpbmcgdHdvIGhhdmUgbm8gZWZmZWN0IHdoZW4gbG9jYWxpemUgaXMgbm90IGVuYWJsZWRcbiAgLy8gJ2kxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbicsXG4gIC8vICdpMThuTWlzc2luZ1RyYW5zbGF0aW9uJyxcblxuICAvLyAqIERlcHJlY2F0ZWRcbiAgJ2RlcGxveVVybCcsXG5cbiAgLy8gKiBBbHdheXMgZW5hYmxlZCB3aXRoIGVzYnVpbGRcbiAgLy8gJ2NvbW1vbkNodW5rJyxcblxuICAvLyAqIEN1cnJlbnRseSB1bnN1cHBvcnRlZCBieSBlc2J1aWxkXG4gICduYW1lZENodW5rcycsXG4gICd2ZW5kb3JDaHVuaycsXG4gICd3ZWJXb3JrZXJUc0NvbmZpZycsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nRXhwZXJpbWVudGFsV2FybmluZ3Mob3B0aW9uczogQnJvd3NlckVzYnVpbGRPcHRpb25zLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkge1xuICAvLyBXYXJuIGFib3V0IGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgdGhpcyBidWlsZGVyXG4gIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgYFRoZSBlc2J1aWxkIGJyb3dzZXIgYXBwbGljYXRpb24gYnVpbGRlciAoJ2Jyb3dzZXItZXNidWlsZCcpIGlzIGN1cnJlbnRseSBleHBlcmltZW50YWwuYCxcbiAgKTtcblxuICAvLyBWYWxpZGF0ZSBzdXBwb3J0ZWQgb3B0aW9uc1xuICAvLyBDdXJyZW50bHkgb25seSBhIHN1YnNldCBvZiB0aGUgV2VicGFjay1iYXNlZCBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyBhcmUgc3VwcG9ydGVkLlxuICBmb3IgKGNvbnN0IHVuc3VwcG9ydGVkT3B0aW9uIG9mIFVOU1VQUE9SVEVEX09QVElPTlMpIHtcbiAgICBjb25zdCB2YWx1ZSA9IChvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKVt1bnN1cHBvcnRlZE9wdGlvbl07XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsdWUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgIGBUaGUgJyR7dW5zdXBwb3J0ZWRPcHRpb259JyBvcHRpb24gaXMgY3VycmVudGx5IHVuc3VwcG9ydGVkIGJ5IHRoaXMgZXhwZXJpbWVudGFsIGJ1aWxkZXIgYW5kIHdpbGwgYmUgaWdub3JlZC5gLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==