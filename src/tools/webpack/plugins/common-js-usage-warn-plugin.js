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
const webpack_diagnostics_1 = require("../../../utils/webpack-diagnostics");
// Webpack doesn't export these so the deep imports can potentially break.
const AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');
const CommonJsExportsDependency = require('webpack/lib/dependencies/CommonJsExportsDependency');
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');
const CommonJsSelfReferenceDependency = require('webpack/lib/dependencies/CommonJsSelfReferenceDependency');
class CommonJsUsageWarnPlugin {
    options;
    shownWarnings = new Set();
    allowedDependencies;
    constructor(options = {}) {
        this.options = options;
        this.allowedDependencies = new Set(this.options.allowedDependencies);
    }
    apply(compiler) {
        if (this.allowedDependencies.has('*')) {
            return;
        }
        compiler.hooks.compilation.tap('CommonJsUsageWarnPlugin', (compilation) => {
            compilation.hooks.finishModules.tap('CommonJsUsageWarnPlugin', (modules) => {
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
                        const parentDependencies = getIssuer(compilation, issuer)?.dependencies;
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
                            const warning = `${issuer?.userRequest} depends on '${rawRequest}'. ` +
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
            if (dep instanceof CommonJsRequireDependency ||
                dep instanceof CommonJsExportsDependency ||
                dep instanceof CommonJsSelfReferenceDependency ||
                dep instanceof AMDDefineDependency) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLWpzLXVzYWdlLXdhcm4tcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL2NvbW1vbi1qcy11c2FnZS13YXJuLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQkFBa0M7QUFFbEMsNEVBQWdFO0FBRWhFLDBFQUEwRTtBQUMxRSxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO0FBQ3BGLE1BQU0seUJBQXlCLEdBQUcsT0FBTyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7QUFDaEcsTUFBTSx5QkFBeUIsR0FBRyxPQUFPLENBQUMsb0RBQW9ELENBQUMsQ0FBQztBQUNoRyxNQUFNLCtCQUErQixHQUFHLE9BQU8sQ0FBQywwREFBMEQsQ0FBQyxDQUFDO0FBTzVHLE1BQWEsdUJBQXVCO0lBSWQ7SUFIWixhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUNsQyxtQkFBbUIsQ0FBYztJQUV6QyxZQUFvQixVQUEwQyxFQUFFO1FBQTVDLFlBQU8sR0FBUCxPQUFPLENBQXFDO1FBQzlELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDckMsT0FBTztTQUNSO1FBRUQsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLHlCQUF5QixFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDeEUsV0FBVyxDQUFDLEtBQUssQ0FB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QUFDLENBQUM7QUFDdkQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBpc0Fic29sdXRlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIERlcGVuZGVuY3ksIE1vZHVsZSwgTm9ybWFsTW9kdWxlIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBhZGRXYXJuaW5nIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5cbi8vIFdlYnBhY2sgZG9lc24ndCBleHBvcnQgdGhlc2Ugc28gdGhlIGRlZXAgaW1wb3J0cyBjYW4gcG90ZW50aWFsbHkgYnJlYWsuXG5jb25zdCBBTUREZWZpbmVEZXBlbmRlbmN5ID0gcmVxdWlyZSgnd2VicGFjay9saWIvZGVwZW5kZW5jaWVzL0FNRERlZmluZURlcGVuZGVuY3knKTtcbmNvbnN0IENvbW1vbkpzRXhwb3J0c0RlcGVuZGVuY3kgPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9kZXBlbmRlbmNpZXMvQ29tbW9uSnNFeHBvcnRzRGVwZW5kZW5jeScpO1xuY29uc3QgQ29tbW9uSnNSZXF1aXJlRGVwZW5kZW5jeSA9IHJlcXVpcmUoJ3dlYnBhY2svbGliL2RlcGVuZGVuY2llcy9Db21tb25Kc1JlcXVpcmVEZXBlbmRlbmN5Jyk7XG5jb25zdCBDb21tb25Kc1NlbGZSZWZlcmVuY2VEZXBlbmRlbmN5ID0gcmVxdWlyZSgnd2VicGFjay9saWIvZGVwZW5kZW5jaWVzL0NvbW1vbkpzU2VsZlJlZmVyZW5jZURlcGVuZGVuY3knKTtcblxuZXhwb3J0IGludGVyZmFjZSBDb21tb25Kc1VzYWdlV2FyblBsdWdpbk9wdGlvbnMge1xuICAvKiogQSBsaXN0IG9mIENvbW1vbkpTIG9yIEFNRCBwYWNrYWdlcyB0aGF0IGFyZSBhbGxvd2VkIHRvIGJlIHVzZWQgd2l0aG91dCBhIHdhcm5pbmcuIFVzZSBgJyonYCB0byBhbGxvdyBhbGwuICovXG4gIGFsbG93ZWREZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luIHtcbiAgcHJpdmF0ZSBzaG93bldhcm5pbmdzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByaXZhdGUgYWxsb3dlZERlcGVuZGVuY2llczogU2V0PHN0cmluZz47XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBDb21tb25Kc1VzYWdlV2FyblBsdWdpbk9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMuYWxsb3dlZERlcGVuZGVuY2llcyA9IG5ldyBTZXQodGhpcy5vcHRpb25zLmFsbG93ZWREZXBlbmRlbmNpZXMpO1xuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgaWYgKHRoaXMuYWxsb3dlZERlcGVuZGVuY2llcy5oYXMoJyonKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcCgnQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4nLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLmZpbmlzaE1vZHVsZXMudGFwKCdDb21tb25Kc1VzYWdlV2FyblBsdWdpbicsIChtb2R1bGVzKSA9PiB7XG4gICAgICAgIGNvbnN0IG1haW5FbnRyeSA9IGNvbXBpbGF0aW9uLmVudHJpZXMuZ2V0KCdtYWluJyk7XG4gICAgICAgIGlmICghbWFpbkVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1haW5Nb2R1bGVzID0gbmV3IFNldChcbiAgICAgICAgICBtYWluRW50cnkuZGVwZW5kZW5jaWVzLm1hcCgoZGVwKSA9PiBjb21waWxhdGlvbi5tb2R1bGVHcmFwaC5nZXRNb2R1bGUoZGVwKSksXG4gICAgICAgICk7XG5cbiAgICAgICAgZm9yIChjb25zdCBtb2R1bGUgb2YgbW9kdWxlcykge1xuICAgICAgICAgIGNvbnN0IHsgZGVwZW5kZW5jaWVzLCByYXdSZXF1ZXN0IH0gPSBtb2R1bGUgYXMgTm9ybWFsTW9kdWxlO1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICFyYXdSZXF1ZXN0IHx8XG4gICAgICAgICAgICByYXdSZXF1ZXN0LnN0YXJ0c1dpdGgoJy4nKSB8fFxuICAgICAgICAgICAgaXNBYnNvbHV0ZShyYXdSZXF1ZXN0KSB8fFxuICAgICAgICAgICAgdGhpcy5hbGxvd2VkRGVwZW5kZW5jaWVzLmhhcyhyYXdSZXF1ZXN0KSB8fFxuICAgICAgICAgICAgdGhpcy5hbGxvd2VkRGVwZW5kZW5jaWVzLmhhcyh0aGlzLnJhd1JlcXVlc3RUb1BhY2thZ2VOYW1lKHJhd1JlcXVlc3QpKSB8fFxuICAgICAgICAgICAgcmF3UmVxdWVzdC5zdGFydHNXaXRoKCdAYW5ndWxhci9jb21tb24vbG9jYWxlcy8nKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBTa2lwIHdoZW46XG4gICAgICAgICAgICAgKiAtIG1vZHVsZSBpcyBhYnNvbHV0ZSBvciByZWxhdGl2ZS5cbiAgICAgICAgICAgICAqIC0gbW9kdWxlIGlzIGFsbG93ZWQgZXZlbiBpZiBpdCdzIGEgQ29tbW9uSlMuXG4gICAgICAgICAgICAgKiAtIG1vZHVsZSBpcyBhIGxvY2FsZSBpbXBvcnRlZCBmcm9tICdAYW5ndWxhci9jb21tb24nLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy5oYXNDb21tb25Kc0RlcGVuZGVuY2llcyhjb21waWxhdGlvbiwgZGVwZW5kZW5jaWVzKSkge1xuICAgICAgICAgICAgLy8gRGVwZW5kZW5jeSBpcyBDb21tb25zSlMgb3IgQU1ELlxuICAgICAgICAgICAgY29uc3QgaXNzdWVyID0gZ2V0SXNzdWVyKGNvbXBpbGF0aW9uLCBtb2R1bGUpO1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgaXQncyBwYXJlbnQgaXNzdWVyIGlzIGFsc28gYSBDb21tb25KUyBkZXBlbmRlbmN5LlxuICAgICAgICAgICAgLy8gSW4gY2FzZSBpdCBpcyBza2lwIGFzIGFuIHdhcm5pbmcgd2lsbCBiZSBzaG93IGZvciB0aGUgcGFyZW50IENvbW1vbkpTIGRlcGVuZGVuY3kuXG4gICAgICAgICAgICBjb25zdCBwYXJlbnREZXBlbmRlbmNpZXMgPSBnZXRJc3N1ZXIoY29tcGlsYXRpb24sIGlzc3Vlcik/LmRlcGVuZGVuY2llcztcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgcGFyZW50RGVwZW5kZW5jaWVzICYmXG4gICAgICAgICAgICAgIHRoaXMuaGFzQ29tbW9uSnNEZXBlbmRlbmNpZXMoY29tcGlsYXRpb24sIHBhcmVudERlcGVuZGVuY2llcywgdHJ1ZSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRmluZCB0aGUgbWFpbiBpc3N1ZXIgKGVudHJ5LXBvaW50KS5cbiAgICAgICAgICAgIGxldCBtYWluSXNzdWVyID0gaXNzdWVyO1xuICAgICAgICAgICAgbGV0IG5leHRJc3N1ZXIgPSBnZXRJc3N1ZXIoY29tcGlsYXRpb24sIG1haW5Jc3N1ZXIpO1xuICAgICAgICAgICAgd2hpbGUgKG5leHRJc3N1ZXIpIHtcbiAgICAgICAgICAgICAgbWFpbklzc3VlciA9IG5leHRJc3N1ZXI7XG4gICAgICAgICAgICAgIG5leHRJc3N1ZXIgPSBnZXRJc3N1ZXIoY29tcGlsYXRpb24sIG1haW5Jc3N1ZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPbmx5IHNob3cgd2FybmluZ3MgZm9yIG1vZHVsZXMgZnJvbSBtYWluIGVudHJ5cG9pbnQuXG4gICAgICAgICAgICAvLyBBbmQgaWYgdGhlIGlzc3VlciByZXF1ZXN0IGlzIG5vdCBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInLCBhcyAnd2VicGFjay1kZXYtc2VydmVyJ1xuICAgICAgICAgICAgLy8gd2lsbCByZXF1aXJlIENvbW1vbkpTIGxpYnJhcmllcyBmb3IgbGl2ZSByZWxvYWRpbmcgc3VjaCBhcyAnc29ja2pzLW5vZGUnLlxuICAgICAgICAgICAgaWYgKG1haW5Jc3N1ZXIgJiYgbWFpbk1vZHVsZXMuaGFzKG1haW5Jc3N1ZXIpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHdhcm5pbmcgPVxuICAgICAgICAgICAgICAgIGAkeyhpc3N1ZXIgYXMgTm9ybWFsTW9kdWxlIHwgbnVsbCk/LnVzZXJSZXF1ZXN0fSBkZXBlbmRzIG9uICcke3Jhd1JlcXVlc3R9Jy4gYCArXG4gICAgICAgICAgICAgICAgJ0NvbW1vbkpTIG9yIEFNRCBkZXBlbmRlbmNpZXMgY2FuIGNhdXNlIG9wdGltaXphdGlvbiBiYWlsb3V0cy5cXG4nICtcbiAgICAgICAgICAgICAgICAnRm9yIG1vcmUgaW5mbyBzZWU6IGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1jb21tb25qcy1kZXBlbmRlbmNpZXMnO1xuXG4gICAgICAgICAgICAgIC8vIEF2b2lkIHNob3dpbmcgdGhlIHNhbWUgd2FybmluZyBtdWx0aXBsZSB0aW1lcyB3aGVuIGluICd3YXRjaCcgbW9kZS5cbiAgICAgICAgICAgICAgaWYgKCF0aGlzLnNob3duV2FybmluZ3MuaGFzKHdhcm5pbmcpKSB7XG4gICAgICAgICAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgd2FybmluZyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93bldhcm5pbmdzLmFkZCh3YXJuaW5nKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGhhc0NvbW1vbkpzRGVwZW5kZW5jaWVzKFxuICAgIGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbixcbiAgICBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lbXSxcbiAgICBjaGVja1BhcmVudE1vZHVsZXMgPSBmYWxzZSxcbiAgKTogYm9vbGVhbiB7XG4gICAgZm9yIChjb25zdCBkZXAgb2YgZGVwZW5kZW5jaWVzKSB7XG4gICAgICBpZiAoXG4gICAgICAgIGRlcCBpbnN0YW5jZW9mIENvbW1vbkpzUmVxdWlyZURlcGVuZGVuY3kgfHxcbiAgICAgICAgZGVwIGluc3RhbmNlb2YgQ29tbW9uSnNFeHBvcnRzRGVwZW5kZW5jeSB8fFxuICAgICAgICBkZXAgaW5zdGFuY2VvZiBDb21tb25Kc1NlbGZSZWZlcmVuY2VEZXBlbmRlbmN5IHx8XG4gICAgICAgIGRlcCBpbnN0YW5jZW9mIEFNRERlZmluZURlcGVuZGVuY3lcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNoZWNrUGFyZW50TW9kdWxlcykge1xuICAgICAgICBjb25zdCBtb2R1bGUgPSBnZXRXZWJwYWNrTW9kdWxlKGNvbXBpbGF0aW9uLCBkZXApO1xuICAgICAgICBpZiAobW9kdWxlICYmIHRoaXMuaGFzQ29tbW9uSnNEZXBlbmRlbmNpZXMoY29tcGlsYXRpb24sIG1vZHVsZS5kZXBlbmRlbmNpZXMpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIHJhd1JlcXVlc3RUb1BhY2thZ2VOYW1lKHJhd1JlcXVlc3Q6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHJhd1JlcXVlc3Quc3RhcnRzV2l0aCgnQCcpXG4gICAgICA/IC8vIFNjb3BlZCByZXF1ZXN0IGV4OiBAYW5ndWxhci9jb21tb24vbG9jYWxlL2VuIC0+IEBhbmd1bGFyL2NvbW1vblxuICAgICAgICByYXdSZXF1ZXN0LnNwbGl0KCcvJywgMikuam9pbignLycpXG4gICAgICA6IC8vIE5vbi1zY29wZWQgcmVxdWVzdCBleDogbG9kYXNoL2lzRW1wdHkgLT4gbG9kYXNoXG4gICAgICAgIHJhd1JlcXVlc3Quc3BsaXQoJy8nLCAxKVswXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRJc3N1ZXIoY29tcGlsYXRpb246IENvbXBpbGF0aW9uLCBtb2R1bGU6IE1vZHVsZSB8IG51bGwpOiBNb2R1bGUgfCBudWxsIHtcbiAgaWYgKCFtb2R1bGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBjb21waWxhdGlvbi5tb2R1bGVHcmFwaC5nZXRJc3N1ZXIobW9kdWxlKTtcbn1cblxuZnVuY3Rpb24gZ2V0V2VicGFja01vZHVsZShjb21waWxhdGlvbjogQ29tcGlsYXRpb24sIGRlcGVuZGVuY3k6IERlcGVuZGVuY3kgfCBudWxsKTogTW9kdWxlIHwgbnVsbCB7XG4gIGlmICghZGVwZW5kZW5jeSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGNvbXBpbGF0aW9uLm1vZHVsZUdyYXBoLmdldE1vZHVsZShkZXBlbmRlbmN5KTtcbn1cbiJdfQ==