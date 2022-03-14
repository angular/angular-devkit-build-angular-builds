"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonJsUsageWarnPlugin = void 0;
const path_1 = require("path");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
// Webpack doesn't export these so the deep imports can potentially break.
const AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');
class CommonJsUsageWarnPlugin {
    constructor(options = {}) {
        this.options = options;
        this.shownWarnings = new Set();
        this.allowedDependencies = new Set(this.options.allowedDependencies);
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('CommonJsUsageWarnPlugin', (compilation) => {
            compilation.hooks.finishModules.tap('CommonJsUsageWarnPlugin', (modules) => {
                var _a;
                const mainEntry = compilation.entries.get('main');
                if (!mainEntry) {
                    return;
                }
                const mainModules = new Set(mainEntry.dependencies.map((dep) => compilation.moduleGraph.getModule(dep)));
                for (const module of modules) {
                    const { dependencies, rawRequest } = module;
                    if (!rawRequest ||
                        rawRequest.startsWith('.') ||
                        (0, path_1.isAbsolute)(rawRequest) ||
                        this.allowedDependencies.has(rawRequest) ||
                        this.allowedDependencies.has(this.rawRequestToPackageName(rawRequest)) ||
                        rawRequest.startsWith('@angular/common/locales/')) {
                        /**
                         * Skip when:
                         * - module is absolute or relative.
                         * - module is allowed even if it's a CommonJS.
                         * - module is a locale imported from '@angular/common'.
                         */
                        continue;
                    }
                    if (this.hasCommonJsDependencies(compilation, dependencies)) {
                        // Dependency is CommonsJS or AMD.
                        const issuer = getIssuer(compilation, module);
                        // Check if it's parent issuer is also a CommonJS dependency.
                        // In case it is skip as an warning will be show for the parent CommonJS dependency.
                        const parentDependencies = (_a = getIssuer(compilation, issuer)) === null || _a === void 0 ? void 0 : _a.dependencies;
                        if (parentDependencies &&
                            this.hasCommonJsDependencies(compilation, parentDependencies, true)) {
                            continue;
                        }
                        // Find the main issuer (entry-point).
                        let mainIssuer = issuer;
                        let nextIssuer = getIssuer(compilation, mainIssuer);
                        while (nextIssuer) {
                            mainIssuer = nextIssuer;
                            nextIssuer = getIssuer(compilation, mainIssuer);
                        }
                        // Only show warnings for modules from main entrypoint.
                        // And if the issuer request is not from 'webpack-dev-server', as 'webpack-dev-server'
                        // will require CommonJS libraries for live reloading such as 'sockjs-node'.
                        if (mainIssuer && mainModules.has(mainIssuer)) {
                            const warning = `${issuer === null || issuer === void 0 ? void 0 : issuer.userRequest} depends on '${rawRequest}'. ` +
                                'CommonJS or AMD dependencies can cause optimization bailouts.\n' +
                                'For more info see: https://angular.io/guide/build#configuring-commonjs-dependencies';
                            // Avoid showing the same warning multiple times when in 'watch' mode.
                            if (!this.shownWarnings.has(warning)) {
                                (0, webpack_diagnostics_1.addWarning)(compilation, warning);
                                this.shownWarnings.add(warning);
                            }
                        }
                    }
                }
            });
        });
    }
    hasCommonJsDependencies(compilation, dependencies, checkParentModules = false) {
        for (const dep of dependencies) {
            if (dep instanceof CommonJsRequireDependency || dep instanceof AMDDefineDependency) {
                return true;
            }
            if (checkParentModules) {
                const module = getWebpackModule(compilation, dep);
                if (module && this.hasCommonJsDependencies(compilation, module.dependencies)) {
                    return true;
                }
            }
        }
        return false;
    }
    rawRequestToPackageName(rawRequest) {
        return rawRequest.startsWith('@')
            ? // Scoped request ex: @angular/common/locale/en -> @angular/common
                rawRequest.split('/', 2).join('/')
            : // Non-scoped request ex: lodash/isEmpty -> lodash
                rawRequest.split('/', 1)[0];
    }
}
exports.CommonJsUsageWarnPlugin = CommonJsUsageWarnPlugin;
function getIssuer(compilation, module) {
    if (!module) {
        return null;
    }
    return compilation.moduleGraph.getIssuer(module);
}
function getWebpackModule(compilation, dependency) {
    if (!dependency) {
        return null;
    }
    return compilation.moduleGraph.getModule(dependency);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLWpzLXVzYWdlLXdhcm4tcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2NvbW1vbi1qcy11c2FnZS13YXJuLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQkFBa0M7QUFFbEMseUVBQTZEO0FBRTdELDBFQUEwRTtBQUMxRSxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO0FBQ3BGLE1BQU0seUJBQXlCLEdBQUcsT0FBTyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7QUFPaEcsTUFBYSx1QkFBdUI7SUFJbEMsWUFBb0IsVUFBMEMsRUFBRTtRQUE1QyxZQUFPLEdBQVAsT0FBTyxDQUFxQztRQUh4RCxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFJeEMsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQ3hFLFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFOztnQkFDekUsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2xELElBQUksQ0FBQyxTQUFTLEVBQUU7b0JBQ2QsT0FBTztpQkFDUjtnQkFDRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FDekIsU0FBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQzVFLENBQUM7Z0JBRUYsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUU7b0JBQzVCLE1BQU0sRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLEdBQUcsTUFBc0IsQ0FBQztvQkFDNUQsSUFDRSxDQUFDLFVBQVU7d0JBQ1gsVUFBVSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7d0JBQzFCLElBQUEsaUJBQVUsRUFBQyxVQUFVLENBQUM7d0JBQ3RCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDO3dCQUN4QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsQ0FBQzt3QkFDdEUsVUFBVSxDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxFQUNqRDt3QkFDQTs7Ozs7MkJBS0c7d0JBQ0gsU0FBUztxQkFDVjtvQkFFRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLEVBQUU7d0JBQzNELGtDQUFrQzt3QkFDbEMsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQzt3QkFDOUMsNkRBQTZEO3dCQUM3RCxvRkFBb0Y7d0JBQ3BGLE1BQU0sa0JBQWtCLEdBQUcsTUFBQSxTQUFTLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQywwQ0FBRSxZQUFZLENBQUM7d0JBQ3hFLElBQ0Usa0JBQWtCOzRCQUNsQixJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxFQUFFLGtCQUFrQixFQUFFLElBQUksQ0FBQyxFQUNuRTs0QkFDQSxTQUFTO3lCQUNWO3dCQUVELHNDQUFzQzt3QkFDdEMsSUFBSSxVQUFVLEdBQUcsTUFBTSxDQUFDO3dCQUN4QixJQUFJLFVBQVUsR0FBRyxTQUFTLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO3dCQUNwRCxPQUFPLFVBQVUsRUFBRTs0QkFDakIsVUFBVSxHQUFHLFVBQVUsQ0FBQzs0QkFDeEIsVUFBVSxHQUFHLFNBQVMsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7eUJBQ2pEO3dCQUVELHVEQUF1RDt3QkFDdkQsc0ZBQXNGO3dCQUN0Riw0RUFBNEU7d0JBQzVFLElBQUksVUFBVSxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUU7NEJBQzdDLE1BQU0sT0FBTyxHQUNYLEdBQUksTUFBOEIsYUFBOUIsTUFBTSx1QkFBTixNQUFNLENBQTBCLFdBQVcsZ0JBQWdCLFVBQVUsS0FBSztnQ0FDOUUsaUVBQWlFO2dDQUNqRSxxRkFBcUYsQ0FBQzs0QkFFeEYsc0VBQXNFOzRCQUN0RSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0NBQ3BDLElBQUEsZ0NBQVUsRUFBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0NBQ2pDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDOzZCQUNqQzt5QkFDRjtxQkFDRjtpQkFDRjtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sdUJBQXVCLENBQzdCLFdBQXdCLEVBQ3hCLFlBQTBCLEVBQzFCLGtCQUFrQixHQUFHLEtBQUs7UUFFMUIsS0FBSyxNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUU7WUFDOUIsSUFBSSxHQUFHLFlBQVkseUJBQXlCLElBQUksR0FBRyxZQUFZLG1CQUFtQixFQUFFO2dCQUNsRixPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsSUFBSSxrQkFBa0IsRUFBRTtnQkFDdEIsTUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLE1BQU0sSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDNUUsT0FBTyxJQUFJLENBQUM7aUJBQ2I7YUFDRjtTQUNGO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sdUJBQXVCLENBQUMsVUFBa0I7UUFDaEQsT0FBTyxVQUFVLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUMvQixDQUFDLENBQUMsa0VBQWtFO2dCQUNsRSxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ3BDLENBQUMsQ0FBQyxrREFBa0Q7Z0JBQ2xELFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQTVHRCwwREE0R0M7QUFFRCxTQUFTLFNBQVMsQ0FBQyxXQUF3QixFQUFFLE1BQXFCO0lBQ2hFLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDWCxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxXQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxXQUF3QixFQUFFLFVBQTZCO0lBQy9FLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxXQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUN2RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGlzQWJzb2x1dGUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IENvbXBpbGF0aW9uLCBDb21waWxlciwgRGVwZW5kZW5jeSwgTW9kdWxlLCBOb3JtYWxNb2R1bGUgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcblxuLy8gV2VicGFjayBkb2Vzbid0IGV4cG9ydCB0aGVzZSBzbyB0aGUgZGVlcCBpbXBvcnRzIGNhbiBwb3RlbnRpYWxseSBicmVhay5cbmNvbnN0IEFNRERlZmluZURlcGVuZGVuY3kgPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9kZXBlbmRlbmNpZXMvQU1ERGVmaW5lRGVwZW5kZW5jeScpO1xuY29uc3QgQ29tbW9uSnNSZXF1aXJlRGVwZW5kZW5jeSA9IHJlcXVpcmUoJ3dlYnBhY2svbGliL2RlcGVuZGVuY2llcy9Db21tb25Kc1JlcXVpcmVEZXBlbmRlbmN5Jyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW5PcHRpb25zIHtcbiAgLyoqIEEgbGlzdCBvZiBDb21tb25KUyBwYWNrYWdlcyB0aGF0IGFyZSBhbGxvd2VkIHRvIGJlIHVzZWQgd2l0aG91dCBhIHdhcm5pbmcuICovXG4gIGFsbG93ZWREZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luIHtcbiAgcHJpdmF0ZSBzaG93bldhcm5pbmdzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByaXZhdGUgYWxsb3dlZERlcGVuZGVuY2llczogU2V0PHN0cmluZz47XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBDb21tb25Kc1VzYWdlV2FyblBsdWdpbk9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMuYWxsb3dlZERlcGVuZGVuY2llcyA9IG5ldyBTZXQodGhpcy5vcHRpb25zLmFsbG93ZWREZXBlbmRlbmNpZXMpO1xuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKCdDb21tb25Kc1VzYWdlV2FyblBsdWdpbicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29tcGlsYXRpb24uaG9va3MuZmluaXNoTW9kdWxlcy50YXAoJ0NvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luJywgKG1vZHVsZXMpID0+IHtcbiAgICAgICAgY29uc3QgbWFpbkVudHJ5ID0gY29tcGlsYXRpb24uZW50cmllcy5nZXQoJ21haW4nKTtcbiAgICAgICAgaWYgKCFtYWluRW50cnkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbWFpbk1vZHVsZXMgPSBuZXcgU2V0KFxuICAgICAgICAgIG1haW5FbnRyeS5kZXBlbmRlbmNpZXMubWFwKChkZXApID0+IGNvbXBpbGF0aW9uLm1vZHVsZUdyYXBoLmdldE1vZHVsZShkZXApKSxcbiAgICAgICAgKTtcblxuICAgICAgICBmb3IgKGNvbnN0IG1vZHVsZSBvZiBtb2R1bGVzKSB7XG4gICAgICAgICAgY29uc3QgeyBkZXBlbmRlbmNpZXMsIHJhd1JlcXVlc3QgfSA9IG1vZHVsZSBhcyBOb3JtYWxNb2R1bGU7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXJhd1JlcXVlc3QgfHxcbiAgICAgICAgICAgIHJhd1JlcXVlc3Quc3RhcnRzV2l0aCgnLicpIHx8XG4gICAgICAgICAgICBpc0Fic29sdXRlKHJhd1JlcXVlc3QpIHx8XG4gICAgICAgICAgICB0aGlzLmFsbG93ZWREZXBlbmRlbmNpZXMuaGFzKHJhd1JlcXVlc3QpIHx8XG4gICAgICAgICAgICB0aGlzLmFsbG93ZWREZXBlbmRlbmNpZXMuaGFzKHRoaXMucmF3UmVxdWVzdFRvUGFja2FnZU5hbWUocmF3UmVxdWVzdCkpIHx8XG4gICAgICAgICAgICByYXdSZXF1ZXN0LnN0YXJ0c1dpdGgoJ0Bhbmd1bGFyL2NvbW1vbi9sb2NhbGVzLycpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFNraXAgd2hlbjpcbiAgICAgICAgICAgICAqIC0gbW9kdWxlIGlzIGFic29sdXRlIG9yIHJlbGF0aXZlLlxuICAgICAgICAgICAgICogLSBtb2R1bGUgaXMgYWxsb3dlZCBldmVuIGlmIGl0J3MgYSBDb21tb25KUy5cbiAgICAgICAgICAgICAqIC0gbW9kdWxlIGlzIGEgbG9jYWxlIGltcG9ydGVkIGZyb20gJ0Bhbmd1bGFyL2NvbW1vbicuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLmhhc0NvbW1vbkpzRGVwZW5kZW5jaWVzKGNvbXBpbGF0aW9uLCBkZXBlbmRlbmNpZXMpKSB7XG4gICAgICAgICAgICAvLyBEZXBlbmRlbmN5IGlzIENvbW1vbnNKUyBvciBBTUQuXG4gICAgICAgICAgICBjb25zdCBpc3N1ZXIgPSBnZXRJc3N1ZXIoY29tcGlsYXRpb24sIG1vZHVsZSk7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBpdCdzIHBhcmVudCBpc3N1ZXIgaXMgYWxzbyBhIENvbW1vbkpTIGRlcGVuZGVuY3kuXG4gICAgICAgICAgICAvLyBJbiBjYXNlIGl0IGlzIHNraXAgYXMgYW4gd2FybmluZyB3aWxsIGJlIHNob3cgZm9yIHRoZSBwYXJlbnQgQ29tbW9uSlMgZGVwZW5kZW5jeS5cbiAgICAgICAgICAgIGNvbnN0IHBhcmVudERlcGVuZGVuY2llcyA9IGdldElzc3Vlcihjb21waWxhdGlvbiwgaXNzdWVyKT8uZGVwZW5kZW5jaWVzO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBwYXJlbnREZXBlbmRlbmNpZXMgJiZcbiAgICAgICAgICAgICAgdGhpcy5oYXNDb21tb25Kc0RlcGVuZGVuY2llcyhjb21waWxhdGlvbiwgcGFyZW50RGVwZW5kZW5jaWVzLCB0cnVlKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaW5kIHRoZSBtYWluIGlzc3VlciAoZW50cnktcG9pbnQpLlxuICAgICAgICAgICAgbGV0IG1haW5Jc3N1ZXIgPSBpc3N1ZXI7XG4gICAgICAgICAgICBsZXQgbmV4dElzc3VlciA9IGdldElzc3Vlcihjb21waWxhdGlvbiwgbWFpbklzc3Vlcik7XG4gICAgICAgICAgICB3aGlsZSAobmV4dElzc3Vlcikge1xuICAgICAgICAgICAgICBtYWluSXNzdWVyID0gbmV4dElzc3VlcjtcbiAgICAgICAgICAgICAgbmV4dElzc3VlciA9IGdldElzc3Vlcihjb21waWxhdGlvbiwgbWFpbklzc3Vlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9ubHkgc2hvdyB3YXJuaW5ncyBmb3IgbW9kdWxlcyBmcm9tIG1haW4gZW50cnlwb2ludC5cbiAgICAgICAgICAgIC8vIEFuZCBpZiB0aGUgaXNzdWVyIHJlcXVlc3QgaXMgbm90IGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcicsIGFzICd3ZWJwYWNrLWRldi1zZXJ2ZXInXG4gICAgICAgICAgICAvLyB3aWxsIHJlcXVpcmUgQ29tbW9uSlMgbGlicmFyaWVzIGZvciBsaXZlIHJlbG9hZGluZyBzdWNoIGFzICdzb2NranMtbm9kZScuXG4gICAgICAgICAgICBpZiAobWFpbklzc3VlciAmJiBtYWluTW9kdWxlcy5oYXMobWFpbklzc3VlcikpIHtcbiAgICAgICAgICAgICAgY29uc3Qgd2FybmluZyA9XG4gICAgICAgICAgICAgICAgYCR7KGlzc3VlciBhcyBOb3JtYWxNb2R1bGUgfCBudWxsKT8udXNlclJlcXVlc3R9IGRlcGVuZHMgb24gJyR7cmF3UmVxdWVzdH0nLiBgICtcbiAgICAgICAgICAgICAgICAnQ29tbW9uSlMgb3IgQU1EIGRlcGVuZGVuY2llcyBjYW4gY2F1c2Ugb3B0aW1pemF0aW9uIGJhaWxvdXRzLlxcbicgK1xuICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvIHNlZTogaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWNvbW1vbmpzLWRlcGVuZGVuY2llcyc7XG5cbiAgICAgICAgICAgICAgLy8gQXZvaWQgc2hvd2luZyB0aGUgc2FtZSB3YXJuaW5nIG11bHRpcGxlIHRpbWVzIHdoZW4gaW4gJ3dhdGNoJyBtb2RlLlxuICAgICAgICAgICAgICBpZiAoIXRoaXMuc2hvd25XYXJuaW5ncy5oYXMod2FybmluZykpIHtcbiAgICAgICAgICAgICAgICBhZGRXYXJuaW5nKGNvbXBpbGF0aW9uLCB3YXJuaW5nKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3duV2FybmluZ3MuYWRkKHdhcm5pbmcpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaGFzQ29tbW9uSnNEZXBlbmRlbmNpZXMoXG4gICAgY29tcGlsYXRpb246IENvbXBpbGF0aW9uLFxuICAgIGRlcGVuZGVuY2llczogRGVwZW5kZW5jeVtdLFxuICAgIGNoZWNrUGFyZW50TW9kdWxlcyA9IGZhbHNlLFxuICApOiBib29sZWFuIHtcbiAgICBmb3IgKGNvbnN0IGRlcCBvZiBkZXBlbmRlbmNpZXMpIHtcbiAgICAgIGlmIChkZXAgaW5zdGFuY2VvZiBDb21tb25Kc1JlcXVpcmVEZXBlbmRlbmN5IHx8IGRlcCBpbnN0YW5jZW9mIEFNRERlZmluZURlcGVuZGVuY3kpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGVja1BhcmVudE1vZHVsZXMpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlID0gZ2V0V2VicGFja01vZHVsZShjb21waWxhdGlvbiwgZGVwKTtcbiAgICAgICAgaWYgKG1vZHVsZSAmJiB0aGlzLmhhc0NvbW1vbkpzRGVwZW5kZW5jaWVzKGNvbXBpbGF0aW9uLCBtb2R1bGUuZGVwZW5kZW5jaWVzKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSByYXdSZXF1ZXN0VG9QYWNrYWdlTmFtZShyYXdSZXF1ZXN0OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiByYXdSZXF1ZXN0LnN0YXJ0c1dpdGgoJ0AnKVxuICAgICAgPyAvLyBTY29wZWQgcmVxdWVzdCBleDogQGFuZ3VsYXIvY29tbW9uL2xvY2FsZS9lbiAtPiBAYW5ndWxhci9jb21tb25cbiAgICAgICAgcmF3UmVxdWVzdC5zcGxpdCgnLycsIDIpLmpvaW4oJy8nKVxuICAgICAgOiAvLyBOb24tc2NvcGVkIHJlcXVlc3QgZXg6IGxvZGFzaC9pc0VtcHR5IC0+IGxvZGFzaFxuICAgICAgICByYXdSZXF1ZXN0LnNwbGl0KCcvJywgMSlbMF07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0SXNzdWVyKGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiwgbW9kdWxlOiBNb2R1bGUgfCBudWxsKTogTW9kdWxlIHwgbnVsbCB7XG4gIGlmICghbW9kdWxlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gY29tcGlsYXRpb24ubW9kdWxlR3JhcGguZ2V0SXNzdWVyKG1vZHVsZSk7XG59XG5cbmZ1bmN0aW9uIGdldFdlYnBhY2tNb2R1bGUoY29tcGlsYXRpb246IENvbXBpbGF0aW9uLCBkZXBlbmRlbmN5OiBEZXBlbmRlbmN5IHwgbnVsbCk6IE1vZHVsZSB8IG51bGwge1xuICBpZiAoIWRlcGVuZGVuY3kpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBjb21waWxhdGlvbi5tb2R1bGVHcmFwaC5nZXRNb2R1bGUoZGVwZW5kZW5jeSk7XG59XG4iXX0=