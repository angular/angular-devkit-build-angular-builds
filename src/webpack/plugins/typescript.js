"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIvyPlugin = void 0;
const webpack_1 = require("@ngtools/webpack");
const typescript_1 = require("typescript");
function ensureIvy(wco) {
    if (wco.tsConfig.options.enableIvy !== false) {
        return;
    }
    wco.logger.warn('Project is attempting to disable the Ivy compiler. ' +
        'Angular versions 12 and higher do not support the deprecated View Engine compiler for applications. ' +
        'The Ivy compiler will be used to build this project. ' +
        '\nFor additional information or if the build fails, please see https://angular.io/guide/ivy');
    wco.tsConfig.options.enableIvy = true;
}
function createIvyPlugin(wco, aot, tsconfig) {
    if (aot) {
        ensureIvy(wco);
    }
    const { buildOptions } = wco;
    const optimize = buildOptions.optimization.scripts;
    const compilerOptions = {
        sourceMap: buildOptions.sourceMap.scripts,
        declaration: false,
        declarationMap: false,
    };
    if (buildOptions.preserveSymlinks !== undefined) {
        compilerOptions.preserveSymlinks = buildOptions.preserveSymlinks;
    }
    // Outputting ES2015 from TypeScript is the required minimum for the build optimizer passes.
    // Downleveling to ES5 will occur after the build optimizer passes via babel which is the same
    // as for third-party libraries. This greatly reduces the complexity of static analysis.
    if (wco.scriptTarget < typescript_1.ScriptTarget.ES2015) {
        compilerOptions.target = typescript_1.ScriptTarget.ES2015;
    }
    const fileReplacements = {};
    if (buildOptions.fileReplacements) {
        for (const replacement of buildOptions.fileReplacements) {
            fileReplacements[replacement.replace] = replacement.with;
        }
    }
    let inlineStyleFileExtension;
    switch (buildOptions.inlineStyleLanguage) {
        case 'less':
            inlineStyleFileExtension = 'less';
            break;
        case 'sass':
            inlineStyleFileExtension = 'sass';
            break;
        case 'scss':
            inlineStyleFileExtension = 'scss';
            break;
        case 'css':
        default:
            inlineStyleFileExtension = 'css';
            break;
    }
    return new webpack_1.AngularWebpackPlugin({
        tsconfig,
        compilerOptions,
        fileReplacements,
        jitMode: !aot,
        emitNgModuleScope: !optimize,
        inlineStyleFileExtension,
    });
}
exports.createIvyPlugin = createIvyPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDhDQUF3RDtBQUN4RCwyQ0FBMEM7QUFHMUMsU0FBUyxTQUFTLENBQUMsR0FBeUI7SUFDMUMsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssS0FBSyxFQUFFO1FBQzVDLE9BQU87S0FDUjtJQUVELEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNiLHFEQUFxRDtRQUNuRCxzR0FBc0c7UUFDdEcsdURBQXVEO1FBQ3ZELDZGQUE2RixDQUNoRyxDQUFDO0lBRUYsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUN4QyxDQUFDO0FBRUQsU0FBZ0IsZUFBZSxDQUM3QixHQUF5QixFQUN6QixHQUFZLEVBQ1osUUFBZ0I7SUFFaEIsSUFBSSxHQUFHLEVBQUU7UUFDUCxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDaEI7SUFFRCxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQzdCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBRW5ELE1BQU0sZUFBZSxHQUFvQjtRQUN2QyxTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPO1FBQ3pDLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLGNBQWMsRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7UUFDL0MsZUFBZSxDQUFDLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQztLQUNsRTtJQUVELDRGQUE0RjtJQUM1Riw4RkFBOEY7SUFDOUYsd0ZBQXdGO0lBQ3hGLElBQUksR0FBRyxDQUFDLFlBQVksR0FBRyx5QkFBWSxDQUFDLE1BQU0sRUFBRTtRQUMxQyxlQUFlLENBQUMsTUFBTSxHQUFHLHlCQUFZLENBQUMsTUFBTSxDQUFDO0tBQzlDO0lBRUQsTUFBTSxnQkFBZ0IsR0FBMkIsRUFBRSxDQUFDO0lBQ3BELElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1FBQ2pDLEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1lBQ3ZELGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO1NBQzFEO0tBQ0Y7SUFFRCxJQUFJLHdCQUF3QixDQUFDO0lBQzdCLFFBQVEsWUFBWSxDQUFDLG1CQUFtQixFQUFFO1FBQ3hDLEtBQUssTUFBTTtZQUNULHdCQUF3QixHQUFHLE1BQU0sQ0FBQztZQUNsQyxNQUFNO1FBQ1IsS0FBSyxNQUFNO1lBQ1Qsd0JBQXdCLEdBQUcsTUFBTSxDQUFDO1lBQ2xDLE1BQU07UUFDUixLQUFLLE1BQU07WUFDVCx3QkFBd0IsR0FBRyxNQUFNLENBQUM7WUFDbEMsTUFBTTtRQUNSLEtBQUssS0FBSyxDQUFDO1FBQ1g7WUFDRSx3QkFBd0IsR0FBRyxLQUFLLENBQUM7WUFDakMsTUFBTTtLQUNUO0lBRUQsT0FBTyxJQUFJLDhCQUFvQixDQUFDO1FBQzlCLFFBQVE7UUFDUixlQUFlO1FBQ2YsZ0JBQWdCO1FBQ2hCLE9BQU8sRUFBRSxDQUFDLEdBQUc7UUFDYixpQkFBaUIsRUFBRSxDQUFDLFFBQVE7UUFDNUIsd0JBQXdCO0tBQ3pCLENBQUMsQ0FBQztBQUNMLENBQUM7QUE3REQsMENBNkRDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29tcGlsZXJPcHRpb25zIH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrUGx1Z2luIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5cbmZ1bmN0aW9uIGVuc3VyZUl2eSh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogdm9pZCB7XG4gIGlmICh3Y28udHNDb25maWcub3B0aW9ucy5lbmFibGVJdnkgIT09IGZhbHNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgd2NvLmxvZ2dlci53YXJuKFxuICAgICdQcm9qZWN0IGlzIGF0dGVtcHRpbmcgdG8gZGlzYWJsZSB0aGUgSXZ5IGNvbXBpbGVyLiAnICtcbiAgICAgICdBbmd1bGFyIHZlcnNpb25zIDEyIGFuZCBoaWdoZXIgZG8gbm90IHN1cHBvcnQgdGhlIGRlcHJlY2F0ZWQgVmlldyBFbmdpbmUgY29tcGlsZXIgZm9yIGFwcGxpY2F0aW9ucy4gJyArXG4gICAgICAnVGhlIEl2eSBjb21waWxlciB3aWxsIGJlIHVzZWQgdG8gYnVpbGQgdGhpcyBwcm9qZWN0LiAnICtcbiAgICAgICdcXG5Gb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBvciBpZiB0aGUgYnVpbGQgZmFpbHMsIHBsZWFzZSBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2l2eScsXG4gICk7XG5cbiAgd2NvLnRzQ29uZmlnLm9wdGlvbnMuZW5hYmxlSXZ5ID0gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUl2eVBsdWdpbihcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbiAgYW90OiBib29sZWFuLFxuICB0c2NvbmZpZzogc3RyaW5nLFxuKTogQW5ndWxhcldlYnBhY2tQbHVnaW4ge1xuICBpZiAoYW90KSB7XG4gICAgZW5zdXJlSXZ5KHdjbyk7XG4gIH1cblxuICBjb25zdCB7IGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBvcHRpbWl6ZSA9IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc2NyaXB0cztcblxuICBjb25zdCBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuc2NyaXB0cyxcbiAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICB9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29tcGlsZXJPcHRpb25zLnByZXNlcnZlU3ltbGlua3MgPSBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcztcbiAgfVxuXG4gIC8vIE91dHB1dHRpbmcgRVMyMDE1IGZyb20gVHlwZVNjcmlwdCBpcyB0aGUgcmVxdWlyZWQgbWluaW11bSBmb3IgdGhlIGJ1aWxkIG9wdGltaXplciBwYXNzZXMuXG4gIC8vIERvd25sZXZlbGluZyB0byBFUzUgd2lsbCBvY2N1ciBhZnRlciB0aGUgYnVpbGQgb3B0aW1pemVyIHBhc3NlcyB2aWEgYmFiZWwgd2hpY2ggaXMgdGhlIHNhbWVcbiAgLy8gYXMgZm9yIHRoaXJkLXBhcnR5IGxpYnJhcmllcy4gVGhpcyBncmVhdGx5IHJlZHVjZXMgdGhlIGNvbXBsZXhpdHkgb2Ygc3RhdGljIGFuYWx5c2lzLlxuICBpZiAod2NvLnNjcmlwdFRhcmdldCA8IFNjcmlwdFRhcmdldC5FUzIwMTUpIHtcbiAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gU2NyaXB0VGFyZ2V0LkVTMjAxNTtcbiAgfVxuXG4gIGNvbnN0IGZpbGVSZXBsYWNlbWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBidWlsZE9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1tyZXBsYWNlbWVudC5yZXBsYWNlXSA9IHJlcGxhY2VtZW50LndpdGg7XG4gICAgfVxuICB9XG5cbiAgbGV0IGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbjtcbiAgc3dpdGNoIChidWlsZE9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSkge1xuICAgIGNhc2UgJ2xlc3MnOlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ2xlc3MnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc2Fzcyc6XG4gICAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24gPSAnc2Fzcyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzY3NzJzpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdzY3NzJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Nzcyc6XG4gICAgZGVmYXVsdDpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdjc3MnO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICByZXR1cm4gbmV3IEFuZ3VsYXJXZWJwYWNrUGx1Z2luKHtcbiAgICB0c2NvbmZpZyxcbiAgICBjb21waWxlck9wdGlvbnMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBqaXRNb2RlOiAhYW90LFxuICAgIGVtaXROZ01vZHVsZVNjb3BlOiAhb3B0aW1pemUsXG4gICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uLFxuICB9KTtcbn1cbiJdfQ==