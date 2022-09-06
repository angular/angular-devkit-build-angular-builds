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
        wco.logger.warn('DEPRECATED: ES5 output is deprecated. Please update TypeScript `target` compiler option to ES2015 or later.');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDhDQUF3RDtBQUN4RCwyQ0FBMEM7QUFHMUMsU0FBZ0IsZUFBZSxDQUM3QixHQUF5QixFQUN6QixHQUFZLEVBQ1osUUFBZ0I7SUFFaEIsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUM3QixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUVuRCxNQUFNLGVBQWUsR0FBb0I7UUFDdkMsU0FBUyxFQUFFLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTztRQUN6QyxXQUFXLEVBQUUsS0FBSztRQUNsQixjQUFjLEVBQUUsS0FBSztLQUN0QixDQUFDO0lBRUYsSUFBSSxZQUFZLENBQUMsZ0JBQWdCLEtBQUssU0FBUyxFQUFFO1FBQy9DLGVBQWUsQ0FBQyxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsZ0JBQWdCLENBQUM7S0FDbEU7SUFFRCw0RkFBNEY7SUFDNUYsOEZBQThGO0lBQzlGLHdGQUF3RjtJQUN4RixJQUFJLEdBQUcsQ0FBQyxZQUFZLEdBQUcseUJBQVksQ0FBQyxNQUFNLEVBQUU7UUFDMUMsZUFBZSxDQUFDLE1BQU0sR0FBRyx5QkFBWSxDQUFDLE1BQU0sQ0FBQztRQUM3QyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDYiw2R0FBNkcsQ0FDOUcsQ0FBQztLQUNIO0lBRUQsTUFBTSxnQkFBZ0IsR0FBMkIsRUFBRSxDQUFDO0lBQ3BELElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1FBQ2pDLEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxDQUFDLGdCQUFnQixFQUFFO1lBQ3ZELGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDO1NBQzFEO0tBQ0Y7SUFFRCxJQUFJLHdCQUF3QixDQUFDO0lBQzdCLFFBQVEsWUFBWSxDQUFDLG1CQUFtQixFQUFFO1FBQ3hDLEtBQUssTUFBTTtZQUNULHdCQUF3QixHQUFHLE1BQU0sQ0FBQztZQUNsQyxNQUFNO1FBQ1IsS0FBSyxNQUFNO1lBQ1Qsd0JBQXdCLEdBQUcsTUFBTSxDQUFDO1lBQ2xDLE1BQU07UUFDUixLQUFLLE1BQU07WUFDVCx3QkFBd0IsR0FBRyxNQUFNLENBQUM7WUFDbEMsTUFBTTtRQUNSLEtBQUssS0FBSyxDQUFDO1FBQ1g7WUFDRSx3QkFBd0IsR0FBRyxLQUFLLENBQUM7WUFDakMsTUFBTTtLQUNUO0lBRUQsT0FBTyxJQUFJLDhCQUFvQixDQUFDO1FBQzlCLFFBQVE7UUFDUixlQUFlO1FBQ2YsZ0JBQWdCO1FBQ2hCLE9BQU8sRUFBRSxDQUFDLEdBQUc7UUFDYixpQkFBaUIsRUFBRSxDQUFDLFFBQVE7UUFDNUIsd0JBQXdCO0tBQ3pCLENBQUMsQ0FBQztBQUNMLENBQUM7QUE1REQsMENBNERDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29tcGlsZXJPcHRpb25zIH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrUGx1Z2luIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJdnlQbHVnaW4oXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGFvdDogYm9vbGVhbixcbiAgdHNjb25maWc6IHN0cmluZyxcbik6IEFuZ3VsYXJXZWJwYWNrUGx1Z2luIHtcbiAgY29uc3QgeyBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3Qgb3B0aW1pemUgPSBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnNjcmlwdHM7XG5cbiAgY29uc3QgY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMgPSB7XG4gICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLnNjcmlwdHMsXG4gICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgfTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbXBpbGVyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzID0gYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG4gIH1cblxuICAvLyBPdXRwdXR0aW5nIEVTMjAxNSBmcm9tIFR5cGVTY3JpcHQgaXMgdGhlIHJlcXVpcmVkIG1pbmltdW0gZm9yIHRoZSBidWlsZCBvcHRpbWl6ZXIgcGFzc2VzLlxuICAvLyBEb3dubGV2ZWxpbmcgdG8gRVM1IHdpbGwgb2NjdXIgYWZ0ZXIgdGhlIGJ1aWxkIG9wdGltaXplciBwYXNzZXMgdmlhIGJhYmVsIHdoaWNoIGlzIHRoZSBzYW1lXG4gIC8vIGFzIGZvciB0aGlyZC1wYXJ0eSBsaWJyYXJpZXMuIFRoaXMgZ3JlYXRseSByZWR1Y2VzIHRoZSBjb21wbGV4aXR5IG9mIHN0YXRpYyBhbmFseXNpcy5cbiAgaWYgKHdjby5zY3JpcHRUYXJnZXQgPCBTY3JpcHRUYXJnZXQuRVMyMDE1KSB7XG4gICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9IFNjcmlwdFRhcmdldC5FUzIwMTU7XG4gICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgJ0RFUFJFQ0FURUQ6IEVTNSBvdXRwdXQgaXMgZGVwcmVjYXRlZC4gUGxlYXNlIHVwZGF0ZSBUeXBlU2NyaXB0IGB0YXJnZXRgIGNvbXBpbGVyIG9wdGlvbiB0byBFUzIwMTUgb3IgbGF0ZXIuJyxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBpZiAoYnVpbGRPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIGJ1aWxkT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzW3JlcGxhY2VtZW50LnJlcGxhY2VdID0gcmVwbGFjZW1lbnQud2l0aDtcbiAgICB9XG4gIH1cblxuICBsZXQgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uO1xuICBzd2l0Y2ggKGJ1aWxkT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlKSB7XG4gICAgY2FzZSAnbGVzcyc6XG4gICAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24gPSAnbGVzcyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzYXNzJzpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdzYXNzJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Njc3MnOlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ3Njc3MnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnY3NzJzpcbiAgICBkZWZhdWx0OlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ2Nzcyc7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIHJldHVybiBuZXcgQW5ndWxhcldlYnBhY2tQbHVnaW4oe1xuICAgIHRzY29uZmlnLFxuICAgIGNvbXBpbGVyT3B0aW9ucyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGppdE1vZGU6ICFhb3QsXG4gICAgZW1pdE5nTW9kdWxlU2NvcGU6ICFvcHRpbWl6ZSxcbiAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24sXG4gIH0pO1xufVxuIl19