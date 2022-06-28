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
let es5TargetWarningsShown = false;
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
        if (!es5TargetWarningsShown) {
            wco.logger.warn('DEPRECATED: ES5 output is deprecated. Please update TypeScript `target` compiler option to ES2015 or later.');
            es5TargetWarningsShown = true;
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDhDQUF3RDtBQUN4RCwyQ0FBMEM7QUFHMUMsU0FBUyxTQUFTLENBQUMsR0FBeUI7SUFDMUMsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssS0FBSyxFQUFFO1FBQzVDLE9BQU87S0FDUjtJQUVELEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNiLHFEQUFxRDtRQUNuRCxzR0FBc0c7UUFDdEcsdURBQXVEO1FBQ3ZELDZGQUE2RixDQUNoRyxDQUFDO0lBRUYsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUN4QyxDQUFDO0FBRUQsSUFBSSxzQkFBc0IsR0FBRyxLQUFLLENBQUM7QUFDbkMsU0FBZ0IsZUFBZSxDQUM3QixHQUF5QixFQUN6QixHQUFZLEVBQ1osUUFBZ0I7SUFFaEIsSUFBSSxHQUFHLEVBQUU7UUFDUCxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDaEI7SUFFRCxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQzdCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBRW5ELE1BQU0sZUFBZSxHQUFvQjtRQUN2QyxTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPO1FBQ3pDLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLGNBQWMsRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7UUFDL0MsZUFBZSxDQUFDLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQztLQUNsRTtJQUVELDRGQUE0RjtJQUM1Riw4RkFBOEY7SUFDOUYsd0ZBQXdGO0lBQ3hGLElBQUksR0FBRyxDQUFDLFlBQVksR0FBRyx5QkFBWSxDQUFDLE1BQU0sRUFBRTtRQUMxQyxlQUFlLENBQUMsTUFBTSxHQUFHLHlCQUFZLENBQUMsTUFBTSxDQUFDO1FBQzdDLElBQUksQ0FBQyxzQkFBc0IsRUFBRTtZQUMzQixHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDYiw2R0FBNkcsQ0FDOUcsQ0FBQztZQUVGLHNCQUFzQixHQUFHLElBQUksQ0FBQztTQUMvQjtLQUNGO0lBRUQsTUFBTSxnQkFBZ0IsR0FBMkIsRUFBRSxDQUFDO0lBQ3BELElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1FBQ2pDLEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1lBQ3ZELGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO1NBQzFEO0tBQ0Y7SUFFRCxJQUFJLHdCQUF3QixDQUFDO0lBQzdCLFFBQVEsWUFBWSxDQUFDLG1CQUFtQixFQUFFO1FBQ3hDLEtBQUssTUFBTTtZQUNULHdCQUF3QixHQUFHLE1BQU0sQ0FBQztZQUNsQyxNQUFNO1FBQ1IsS0FBSyxNQUFNO1lBQ1Qsd0JBQXdCLEdBQUcsTUFBTSxDQUFDO1lBQ2xDLE1BQU07UUFDUixLQUFLLE1BQU07WUFDVCx3QkFBd0IsR0FBRyxNQUFNLENBQUM7WUFDbEMsTUFBTTtRQUNSLEtBQUssS0FBSyxDQUFDO1FBQ1g7WUFDRSx3QkFBd0IsR0FBRyxLQUFLLENBQUM7WUFDakMsTUFBTTtLQUNUO0lBRUQsT0FBTyxJQUFJLDhCQUFvQixDQUFDO1FBQzlCLFFBQVE7UUFDUixlQUFlO1FBQ2YsZ0JBQWdCO1FBQ2hCLE9BQU8sRUFBRSxDQUFDLEdBQUc7UUFDYixpQkFBaUIsRUFBRSxDQUFDLFFBQVE7UUFDNUIsd0JBQXdCO0tBQ3pCLENBQUMsQ0FBQztBQUNMLENBQUM7QUFwRUQsMENBb0VDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29tcGlsZXJPcHRpb25zIH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrUGx1Z2luIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5cbmZ1bmN0aW9uIGVuc3VyZUl2eSh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogdm9pZCB7XG4gIGlmICh3Y28udHNDb25maWcub3B0aW9ucy5lbmFibGVJdnkgIT09IGZhbHNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgd2NvLmxvZ2dlci53YXJuKFxuICAgICdQcm9qZWN0IGlzIGF0dGVtcHRpbmcgdG8gZGlzYWJsZSB0aGUgSXZ5IGNvbXBpbGVyLiAnICtcbiAgICAgICdBbmd1bGFyIHZlcnNpb25zIDEyIGFuZCBoaWdoZXIgZG8gbm90IHN1cHBvcnQgdGhlIGRlcHJlY2F0ZWQgVmlldyBFbmdpbmUgY29tcGlsZXIgZm9yIGFwcGxpY2F0aW9ucy4gJyArXG4gICAgICAnVGhlIEl2eSBjb21waWxlciB3aWxsIGJlIHVzZWQgdG8gYnVpbGQgdGhpcyBwcm9qZWN0LiAnICtcbiAgICAgICdcXG5Gb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBvciBpZiB0aGUgYnVpbGQgZmFpbHMsIHBsZWFzZSBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2l2eScsXG4gICk7XG5cbiAgd2NvLnRzQ29uZmlnLm9wdGlvbnMuZW5hYmxlSXZ5ID0gdHJ1ZTtcbn1cblxubGV0IGVzNVRhcmdldFdhcm5pbmdzU2hvd24gPSBmYWxzZTtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJdnlQbHVnaW4oXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGFvdDogYm9vbGVhbixcbiAgdHNjb25maWc6IHN0cmluZyxcbik6IEFuZ3VsYXJXZWJwYWNrUGx1Z2luIHtcbiAgaWYgKGFvdCkge1xuICAgIGVuc3VyZUl2eSh3Y28pO1xuICB9XG5cbiAgY29uc3QgeyBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3Qgb3B0aW1pemUgPSBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnNjcmlwdHM7XG5cbiAgY29uc3QgY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMgPSB7XG4gICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLnNjcmlwdHMsXG4gICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgfTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbXBpbGVyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzID0gYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG4gIH1cblxuICAvLyBPdXRwdXR0aW5nIEVTMjAxNSBmcm9tIFR5cGVTY3JpcHQgaXMgdGhlIHJlcXVpcmVkIG1pbmltdW0gZm9yIHRoZSBidWlsZCBvcHRpbWl6ZXIgcGFzc2VzLlxuICAvLyBEb3dubGV2ZWxpbmcgdG8gRVM1IHdpbGwgb2NjdXIgYWZ0ZXIgdGhlIGJ1aWxkIG9wdGltaXplciBwYXNzZXMgdmlhIGJhYmVsIHdoaWNoIGlzIHRoZSBzYW1lXG4gIC8vIGFzIGZvciB0aGlyZC1wYXJ0eSBsaWJyYXJpZXMuIFRoaXMgZ3JlYXRseSByZWR1Y2VzIHRoZSBjb21wbGV4aXR5IG9mIHN0YXRpYyBhbmFseXNpcy5cbiAgaWYgKHdjby5zY3JpcHRUYXJnZXQgPCBTY3JpcHRUYXJnZXQuRVMyMDE1KSB7XG4gICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9IFNjcmlwdFRhcmdldC5FUzIwMTU7XG4gICAgaWYgKCFlczVUYXJnZXRXYXJuaW5nc1Nob3duKSB7XG4gICAgICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgICAgICdERVBSRUNBVEVEOiBFUzUgb3V0cHV0IGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1cGRhdGUgVHlwZVNjcmlwdCBgdGFyZ2V0YCBjb21waWxlciBvcHRpb24gdG8gRVMyMDE1IG9yIGxhdGVyLicsXG4gICAgICApO1xuXG4gICAgICBlczVUYXJnZXRXYXJuaW5nc1Nob3duID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGlmIChidWlsZE9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2YgYnVpbGRPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcmVwbGFjZW1lbnQucmVwbGFjZV0gPSByZXBsYWNlbWVudC53aXRoO1xuICAgIH1cbiAgfVxuXG4gIGxldCBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb247XG4gIHN3aXRjaCAoYnVpbGRPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UpIHtcbiAgICBjYXNlICdsZXNzJzpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdsZXNzJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Nhc3MnOlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ3Nhc3MnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc2Nzcyc6XG4gICAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24gPSAnc2Nzcyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdjc3MnOlxuICAgIGRlZmF1bHQ6XG4gICAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24gPSAnY3NzJztcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBBbmd1bGFyV2VicGFja1BsdWdpbih7XG4gICAgdHNjb25maWcsXG4gICAgY29tcGlsZXJPcHRpb25zLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgaml0TW9kZTogIWFvdCxcbiAgICBlbWl0TmdNb2R1bGVTY29wZTogIW9wdGltaXplLFxuICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbixcbiAgfSk7XG59XG4iXX0=