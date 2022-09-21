"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedBrowsers = void 0;
const browserslist_1 = __importDefault(require("browserslist"));
function getSupportedBrowsers(projectRoot, logger) {
    browserslist_1.default.defaults = [
        'last 1 Chrome version',
        'last 1 Firefox version',
        'last 2 Edge major versions',
        'last 2 Safari major versions',
        'last 2 iOS major versions',
        'Firefox ESR',
    ];
    // Get browsers from config or default.
    const browsersFromConfigOrDefault = new Set((0, browserslist_1.default)(undefined, { path: projectRoot }));
    // Get browsers that support ES6 modules.
    const browsersThatSupportEs6 = new Set((0, browserslist_1.default)('supports es6-module'));
    const unsupportedBrowsers = [];
    for (const browser of browsersFromConfigOrDefault) {
        if (!browsersThatSupportEs6.has(browser)) {
            browsersFromConfigOrDefault.delete(browser);
            unsupportedBrowsers.push(browser);
        }
    }
    if (unsupportedBrowsers.length) {
        logger.warn(`One or more browsers which are configured in the project's Browserslist configuration ` +
            'will be ignored as ES5 output is not supported by the Angular CLI.\n' +
            `Ignored browsers: ${unsupportedBrowsers.join(', ')}`);
    }
    return Array.from(browsersFromConfigOrDefault);
}
exports.getSupportedBrowsers = getSupportedBrowsers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VwcG9ydGVkLWJyb3dzZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF3QztBQUV4QyxTQUFnQixvQkFBb0IsQ0FBQyxXQUFtQixFQUFFLE1BQXlCO0lBQ2pGLHNCQUFZLENBQUMsUUFBUSxHQUFHO1FBQ3RCLHVCQUF1QjtRQUN2Qix3QkFBd0I7UUFDeEIsNEJBQTRCO1FBQzVCLDhCQUE4QjtRQUM5QiwyQkFBMkI7UUFDM0IsYUFBYTtLQUNkLENBQUM7SUFFRix1Q0FBdUM7SUFDdkMsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFBLHNCQUFZLEVBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUU1Rix5Q0FBeUM7SUFDekMsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFBLHNCQUFZLEVBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0lBRTVFLE1BQU0sbUJBQW1CLEdBQWEsRUFBRSxDQUFDO0lBQ3pDLEtBQUssTUFBTSxPQUFPLElBQUksMkJBQTJCLEVBQUU7UUFDakQsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUN4QywyQkFBMkIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDNUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ25DO0tBQ0Y7SUFFRCxJQUFJLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtRQUM5QixNQUFNLENBQUMsSUFBSSxDQUNULHdGQUF3RjtZQUN0RixzRUFBc0U7WUFDdEUscUJBQXFCLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUN4RCxDQUFDO0tBQ0g7SUFFRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBakNELG9EQWlDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IGJyb3dzZXJzbGlzdCBmcm9tICdicm93c2Vyc2xpc3QnO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3Q6IHN0cmluZywgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSk6IHN0cmluZ1tdIHtcbiAgYnJvd3NlcnNsaXN0LmRlZmF1bHRzID0gW1xuICAgICdsYXN0IDEgQ2hyb21lIHZlcnNpb24nLFxuICAgICdsYXN0IDEgRmlyZWZveCB2ZXJzaW9uJyxcbiAgICAnbGFzdCAyIEVkZ2UgbWFqb3IgdmVyc2lvbnMnLFxuICAgICdsYXN0IDIgU2FmYXJpIG1ham9yIHZlcnNpb25zJyxcbiAgICAnbGFzdCAyIGlPUyBtYWpvciB2ZXJzaW9ucycsXG4gICAgJ0ZpcmVmb3ggRVNSJyxcbiAgXTtcblxuICAvLyBHZXQgYnJvd3NlcnMgZnJvbSBjb25maWcgb3IgZGVmYXVsdC5cbiAgY29uc3QgYnJvd3NlcnNGcm9tQ29uZmlnT3JEZWZhdWx0ID0gbmV3IFNldChicm93c2Vyc2xpc3QodW5kZWZpbmVkLCB7IHBhdGg6IHByb2plY3RSb290IH0pKTtcblxuICAvLyBHZXQgYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEVTNiBtb2R1bGVzLlxuICBjb25zdCBicm93c2Vyc1RoYXRTdXBwb3J0RXM2ID0gbmV3IFNldChicm93c2Vyc2xpc3QoJ3N1cHBvcnRzIGVzNi1tb2R1bGUnKSk7XG5cbiAgY29uc3QgdW5zdXBwb3J0ZWRCcm93c2Vyczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIGJyb3dzZXJzRnJvbUNvbmZpZ09yRGVmYXVsdCkge1xuICAgIGlmICghYnJvd3NlcnNUaGF0U3VwcG9ydEVzNi5oYXMoYnJvd3NlcikpIHtcbiAgICAgIGJyb3dzZXJzRnJvbUNvbmZpZ09yRGVmYXVsdC5kZWxldGUoYnJvd3Nlcik7XG4gICAgICB1bnN1cHBvcnRlZEJyb3dzZXJzLnB1c2goYnJvd3Nlcik7XG4gICAgfVxuICB9XG5cbiAgaWYgKHVuc3VwcG9ydGVkQnJvd3NlcnMubGVuZ3RoKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgT25lIG9yIG1vcmUgYnJvd3NlcnMgd2hpY2ggYXJlIGNvbmZpZ3VyZWQgaW4gdGhlIHByb2plY3QncyBCcm93c2Vyc2xpc3QgY29uZmlndXJhdGlvbiBgICtcbiAgICAgICAgJ3dpbGwgYmUgaWdub3JlZCBhcyBFUzUgb3V0cHV0IGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhlIEFuZ3VsYXIgQ0xJLlxcbicgK1xuICAgICAgICBgSWdub3JlZCBicm93c2VyczogJHt1bnN1cHBvcnRlZEJyb3dzZXJzLmpvaW4oJywgJyl9YCxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIEFycmF5LmZyb20oYnJvd3NlcnNGcm9tQ29uZmlnT3JEZWZhdWx0KTtcbn1cbiJdfQ==