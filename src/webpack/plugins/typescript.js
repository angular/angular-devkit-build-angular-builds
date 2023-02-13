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
function createIvyPlugin(wco, aot, tsconfig) {
    var _a, _b;
    var _c;
    const { buildOptions, tsConfig } = wco;
    const optimize = buildOptions.optimization.scripts;
    const compilerOptions = {
        sourceMap: buildOptions.sourceMap.scripts,
        declaration: false,
        declarationMap: false,
    };
    if (tsConfig.options.target === undefined || tsConfig.options.target < typescript_1.ScriptTarget.ES2022) {
        tsConfig.options.target = typescript_1.ScriptTarget.ES2022;
        // If 'useDefineForClassFields' is already defined in the users project leave the value as is.
        // Otherwise fallback to false due to https://github.com/microsoft/TypeScript/issues/45995
        // which breaks the deprecated `@Effects` NGRX decorator and potentially other existing code as well.
        (_a = (_c = tsConfig.options).useDefineForClassFields) !== null && _a !== void 0 ? _a : (_c.useDefineForClassFields = false);
        wco.logger.warn('TypeScript compiler options "target" and "useDefineForClassFields" are set to "ES2022" and ' +
            '"false" respectively by the Angular CLI. To control ECMA version and features use the Browerslist configuration. ' +
            'For more information, see https://angular.io/guide/build#configuring-browser-compatibility');
    }
    if (buildOptions.preserveSymlinks !== undefined) {
        compilerOptions.preserveSymlinks = buildOptions.preserveSymlinks;
    }
    const fileReplacements = {};
    if (buildOptions.fileReplacements) {
        for (const replacement of buildOptions.fileReplacements) {
            fileReplacements[replacement.replace] = replacement.with;
        }
    }
    return new webpack_1.AngularWebpackPlugin({
        tsconfig,
        compilerOptions,
        fileReplacements,
        jitMode: !aot,
        emitNgModuleScope: !optimize,
        inlineStyleFileExtension: (_b = buildOptions.inlineStyleLanguage) !== null && _b !== void 0 ? _b : 'css',
    });
}
exports.createIvyPlugin = createIvyPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDhDQUF3RDtBQUN4RCwyQ0FBMEM7QUFHMUMsU0FBZ0IsZUFBZSxDQUM3QixHQUF5QixFQUN6QixHQUFZLEVBQ1osUUFBZ0I7OztJQUVoQixNQUFNLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUN2QyxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUVuRCxNQUFNLGVBQWUsR0FBb0I7UUFDdkMsU0FBUyxFQUFFLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTztRQUN6QyxXQUFXLEVBQUUsS0FBSztRQUNsQixjQUFjLEVBQUUsS0FBSztLQUN0QixDQUFDO0lBRUYsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcseUJBQVksQ0FBQyxNQUFNLEVBQUU7UUFDMUYsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcseUJBQVksQ0FBQyxNQUFNLENBQUM7UUFDOUMsOEZBQThGO1FBQzlGLDBGQUEwRjtRQUMxRixxR0FBcUc7UUFDckcsWUFBQSxRQUFRLENBQUMsT0FBTyxFQUFDLHVCQUF1Qix1Q0FBdkIsdUJBQXVCLEdBQUssS0FBSyxFQUFDO1FBRW5ELEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNiLDZGQUE2RjtZQUMzRixtSEFBbUg7WUFDbkgsNEZBQTRGLENBQy9GLENBQUM7S0FDSDtJQUVELElBQUksWUFBWSxDQUFDLGdCQUFnQixLQUFLLFNBQVMsRUFBRTtRQUMvQyxlQUFlLENBQUMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLGdCQUFnQixDQUFDO0tBQ2xFO0lBRUQsTUFBTSxnQkFBZ0IsR0FBMkIsRUFBRSxDQUFDO0lBQ3BELElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1FBQ2pDLEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1lBQ3ZELGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO1NBQzFEO0tBQ0Y7SUFFRCxPQUFPLElBQUksOEJBQW9CLENBQUM7UUFDOUIsUUFBUTtRQUNSLGVBQWU7UUFDZixnQkFBZ0I7UUFDaEIsT0FBTyxFQUFFLENBQUMsR0FBRztRQUNiLGlCQUFpQixFQUFFLENBQUMsUUFBUTtRQUM1Qix3QkFBd0IsRUFBRSxNQUFBLFlBQVksQ0FBQyxtQkFBbUIsbUNBQUksS0FBSztLQUNwRSxDQUFDLENBQUM7QUFDTCxDQUFDO0FBL0NELDBDQStDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbXBpbGVyT3B0aW9ucyB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgeyBBbmd1bGFyV2VicGFja1BsdWdpbiB9IGZyb20gJ0BuZ3Rvb2xzL3dlYnBhY2snO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSXZ5UGx1Z2luKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBhb3Q6IGJvb2xlYW4sXG4gIHRzY29uZmlnOiBzdHJpbmcsXG4pOiBBbmd1bGFyV2VicGFja1BsdWdpbiB7XG4gIGNvbnN0IHsgYnVpbGRPcHRpb25zLCB0c0NvbmZpZyB9ID0gd2NvO1xuICBjb25zdCBvcHRpbWl6ZSA9IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc2NyaXB0cztcblxuICBjb25zdCBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuc2NyaXB0cyxcbiAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICB9O1xuXG4gIGlmICh0c0NvbmZpZy5vcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0IDwgU2NyaXB0VGFyZ2V0LkVTMjAyMikge1xuICAgIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ID0gU2NyaXB0VGFyZ2V0LkVTMjAyMjtcbiAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgLy8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGZhbHNlIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzQ1OTk1XG4gICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICB0c0NvbmZpZy5vcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICdcImZhbHNlXCIgcmVzcGVjdGl2ZWx5IGJ5IHRoZSBBbmd1bGFyIENMSS4gVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbXBpbGVyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzID0gYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG4gIH1cblxuICBjb25zdCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGlmIChidWlsZE9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2YgYnVpbGRPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcmVwbGFjZW1lbnQucmVwbGFjZV0gPSByZXBsYWNlbWVudC53aXRoO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgQW5ndWxhcldlYnBhY2tQbHVnaW4oe1xuICAgIHRzY29uZmlnLFxuICAgIGNvbXBpbGVyT3B0aW9ucyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGppdE1vZGU6ICFhb3QsXG4gICAgZW1pdE5nTW9kdWxlU2NvcGU6ICFvcHRpbWl6ZSxcbiAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb246IGJ1aWxkT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlID8/ICdjc3MnLFxuICB9KTtcbn1cbiJdfQ==