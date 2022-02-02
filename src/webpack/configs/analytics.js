"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsConfig = void 0;
const analytics_1 = require("../plugins/analytics");
function getAnalyticsConfig(wco, context) {
    var _a;
    if (!context.analytics) {
        return {};
    }
    // If there's analytics, add our plugin. Otherwise no need to slow down the build.
    let category = 'build';
    if (context.builder) {
        // We already vetted that this is a "safe" package, otherwise the analytics would be noop.
        category = context.builder.builderName.split(':')[1] || context.builder.builderName || 'build';
    }
    // The category is the builder name if it's an angular builder.
    return {
        plugins: [
            new analytics_1.NgBuildAnalyticsPlugin(wco.projectRoot, context.analytics, category, (_a = wco.buildOptions.aot) !== null && _a !== void 0 ? _a : false),
        ],
    };
}
exports.getAnalyticsConfig = getAnalyticsConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2FuYWx5dGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCxvREFBOEQ7QUFFOUQsU0FBZ0Isa0JBQWtCLENBQ2hDLEdBQXlCLEVBQ3pCLE9BQXVCOztJQUV2QixJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRTtRQUN0QixPQUFPLEVBQUUsQ0FBQztLQUNYO0lBRUQsa0ZBQWtGO0lBQ2xGLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQztJQUN2QixJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUU7UUFDbkIsMEZBQTBGO1FBQzFGLFFBQVEsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxXQUFXLElBQUksT0FBTyxDQUFDO0tBQ2hHO0lBRUQsK0RBQStEO0lBQy9ELE9BQU87UUFDTCxPQUFPLEVBQUU7WUFDUCxJQUFJLGtDQUFzQixDQUN4QixHQUFHLENBQUMsV0FBVyxFQUNmLE9BQU8sQ0FBQyxTQUFTLEVBQ2pCLFFBQVEsRUFDUixNQUFBLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxtQ0FBSSxLQUFLLENBQzlCO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTFCRCxnREEwQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9hbmFseXRpY3MnO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QW5hbHl0aWNzQ29uZmlnKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IENvbmZpZ3VyYXRpb24ge1xuICBpZiAoIWNvbnRleHQuYW5hbHl0aWNzKSB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgLy8gSWYgdGhlcmUncyBhbmFseXRpY3MsIGFkZCBvdXIgcGx1Z2luLiBPdGhlcndpc2Ugbm8gbmVlZCB0byBzbG93IGRvd24gdGhlIGJ1aWxkLlxuICBsZXQgY2F0ZWdvcnkgPSAnYnVpbGQnO1xuICBpZiAoY29udGV4dC5idWlsZGVyKSB7XG4gICAgLy8gV2UgYWxyZWFkeSB2ZXR0ZWQgdGhhdCB0aGlzIGlzIGEgXCJzYWZlXCIgcGFja2FnZSwgb3RoZXJ3aXNlIHRoZSBhbmFseXRpY3Mgd291bGQgYmUgbm9vcC5cbiAgICBjYXRlZ29yeSA9IGNvbnRleHQuYnVpbGRlci5idWlsZGVyTmFtZS5zcGxpdCgnOicpWzFdIHx8IGNvbnRleHQuYnVpbGRlci5idWlsZGVyTmFtZSB8fCAnYnVpbGQnO1xuICB9XG5cbiAgLy8gVGhlIGNhdGVnb3J5IGlzIHRoZSBidWlsZGVyIG5hbWUgaWYgaXQncyBhbiBhbmd1bGFyIGJ1aWxkZXIuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgbmV3IE5nQnVpbGRBbmFseXRpY3NQbHVnaW4oXG4gICAgICAgIHdjby5wcm9qZWN0Um9vdCxcbiAgICAgICAgY29udGV4dC5hbmFseXRpY3MsXG4gICAgICAgIGNhdGVnb3J5LFxuICAgICAgICB3Y28uYnVpbGRPcHRpb25zLmFvdCA/PyBmYWxzZSxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcbn1cbiJdfQ==