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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwZXJpbWVudGFsLXdhcm5pbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2V4cGVyaW1lbnRhbC13YXJuaW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCxNQUFNLG1CQUFtQixHQUF1QztJQUM5RCw2QkFBNkI7SUFDN0IsU0FBUztJQUNULFVBQVU7SUFDVixTQUFTO0lBRVQsaUJBQWlCO0lBQ2pCLFVBQVU7SUFDVixnRUFBZ0U7SUFDaEUsOEJBQThCO0lBQzlCLDRCQUE0QjtJQUU1QixlQUFlO0lBQ2YsV0FBVztJQUVYLGdDQUFnQztJQUNoQyxpQkFBaUI7SUFFakIscUNBQXFDO0lBQ3JDLGFBQWE7SUFDYixhQUFhO0lBQ2IsbUJBQW1CO0NBQ3BCLENBQUM7QUFFRixTQUFnQix1QkFBdUIsQ0FBQyxPQUE4QixFQUFFLE9BQXVCO0lBQzdGLGlEQUFpRDtJQUNqRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsd0ZBQXdGLENBQ3pGLENBQUM7SUFFRiw2QkFBNkI7SUFDN0Isc0ZBQXNGO0lBQ3RGLEtBQUssTUFBTSxpQkFBaUIsSUFBSSxtQkFBbUIsRUFBRTtRQUNuRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUV6QyxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtZQUMxQyxTQUFTO1NBQ1Y7UUFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDOUMsU0FBUztTQUNWO1FBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2hFLFNBQVM7U0FDVjtRQUVELE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQixRQUFRLGlCQUFpQixxRkFBcUYsQ0FDL0csQ0FBQztLQUNIO0lBRUQsSUFBSSxPQUFPLENBQUMsbUJBQW1CLEtBQUssTUFBTSxFQUFFO1FBQzFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLDhEQUE4RCxDQUFDLENBQUM7S0FDckY7QUFDSCxDQUFDO0FBN0JELDBEQTZCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcblxuY29uc3QgVU5TVVBQT1JURURfT1BUSU9OUzogQXJyYXk8a2V5b2YgQnJvd3NlckJ1aWxkZXJPcHRpb25zPiA9IFtcbiAgJ2FsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcycsXG4gICdidWRnZXRzJyxcbiAgJ3Byb2dyZXNzJyxcbiAgJ3NjcmlwdHMnLFxuXG4gIC8vICogaTE4biBzdXBwb3J0XG4gICdsb2NhbGl6ZScsXG4gIC8vIFRoZSBmb2xsb3dpbmcgdHdvIGhhdmUgbm8gZWZmZWN0IHdoZW4gbG9jYWxpemUgaXMgbm90IGVuYWJsZWRcbiAgLy8gJ2kxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbicsXG4gIC8vICdpMThuTWlzc2luZ1RyYW5zbGF0aW9uJyxcblxuICAvLyAqIERlcHJlY2F0ZWRcbiAgJ2RlcGxveVVybCcsXG5cbiAgLy8gKiBBbHdheXMgZW5hYmxlZCB3aXRoIGVzYnVpbGRcbiAgLy8gJ2NvbW1vbkNodW5rJyxcblxuICAvLyAqIEN1cnJlbnRseSB1bnN1cHBvcnRlZCBieSBlc2J1aWxkXG4gICduYW1lZENodW5rcycsXG4gICd2ZW5kb3JDaHVuaycsXG4gICd3ZWJXb3JrZXJUc0NvbmZpZycsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nRXhwZXJpbWVudGFsV2FybmluZ3Mob3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkge1xuICAvLyBXYXJuIGFib3V0IGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgdGhpcyBidWlsZGVyXG4gIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgYFRoZSBlc2J1aWxkIGJyb3dzZXIgYXBwbGljYXRpb24gYnVpbGRlciAoJ2Jyb3dzZXItZXNidWlsZCcpIGlzIGN1cnJlbnRseSBleHBlcmltZW50YWwuYCxcbiAgKTtcblxuICAvLyBWYWxpZGF0ZSBzdXBwb3J0ZWQgb3B0aW9uc1xuICAvLyBDdXJyZW50bHkgb25seSBhIHN1YnNldCBvZiB0aGUgV2VicGFjay1iYXNlZCBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyBhcmUgc3VwcG9ydGVkLlxuICBmb3IgKGNvbnN0IHVuc3VwcG9ydGVkT3B0aW9uIG9mIFVOU1VQUE9SVEVEX09QVElPTlMpIHtcbiAgICBjb25zdCB2YWx1ZSA9IG9wdGlvbnNbdW5zdXBwb3J0ZWRPcHRpb25dO1xuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IGZhbHNlKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIE9iamVjdC5rZXlzKHZhbHVlKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICBgVGhlICcke3Vuc3VwcG9ydGVkT3B0aW9ufScgb3B0aW9uIGlzIGN1cnJlbnRseSB1bnN1cHBvcnRlZCBieSB0aGlzIGV4cGVyaW1lbnRhbCBidWlsZGVyIGFuZCB3aWxsIGJlIGlnbm9yZWQuYCxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSA9PT0gJ2xlc3MnKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybignVGhlIGxlc3Mgc3R5bGVzaGVldCBwcmVwcm9jZXNzb3IgaXMgbm90IGN1cnJlbnRseSBzdXBwb3J0ZWQuJyk7XG4gIH1cbn1cbiJdfQ==