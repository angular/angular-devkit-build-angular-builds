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
const core_1 = require("@angular-devkit/core");
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
            fileReplacements[(0, core_1.getSystemPath)(replacement.replace)] = (0, core_1.getSystemPath)(replacement.with);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUFxRDtBQUVyRCw4Q0FBd0Q7QUFDeEQsMkNBQTBDO0FBRzFDLFNBQVMsU0FBUyxDQUFDLEdBQXlCO0lBQzFDLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLEtBQUssRUFBRTtRQUM1QyxPQUFPO0tBQ1I7SUFFRCxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDYixxREFBcUQ7UUFDbkQsc0dBQXNHO1FBQ3RHLHVEQUF1RDtRQUN2RCw2RkFBNkYsQ0FDaEcsQ0FBQztJQUVGLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFDeEMsQ0FBQztBQUVELFNBQWdCLGVBQWUsQ0FDN0IsR0FBeUIsRUFDekIsR0FBWSxFQUNaLFFBQWdCO0lBRWhCLElBQUksR0FBRyxFQUFFO1FBQ1AsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQ2hCO0lBRUQsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUM3QixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUVuRCxNQUFNLGVBQWUsR0FBb0I7UUFDdkMsU0FBUyxFQUFFLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTztRQUN6QyxXQUFXLEVBQUUsS0FBSztRQUNsQixjQUFjLEVBQUUsS0FBSztLQUN0QixDQUFDO0lBRUYsSUFBSSxZQUFZLENBQUMsZ0JBQWdCLEtBQUssU0FBUyxFQUFFO1FBQy9DLGVBQWUsQ0FBQyxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsZ0JBQWdCLENBQUM7S0FDbEU7SUFFRCw0RkFBNEY7SUFDNUYsOEZBQThGO0lBQzlGLHdGQUF3RjtJQUN4RixJQUFJLEdBQUcsQ0FBQyxZQUFZLEdBQUcseUJBQVksQ0FBQyxNQUFNLEVBQUU7UUFDMUMsZUFBZSxDQUFDLE1BQU0sR0FBRyx5QkFBWSxDQUFDLE1BQU0sQ0FBQztLQUM5QztJQUVELE1BQU0sZ0JBQWdCLEdBQTJCLEVBQUUsQ0FBQztJQUNwRCxJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRTtRQUNqQyxLQUFLLE1BQU0sV0FBVyxJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRTtZQUN2RCxnQkFBZ0IsQ0FBQyxJQUFBLG9CQUFhLEVBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsSUFBQSxvQkFBYSxFQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN4RjtLQUNGO0lBRUQsSUFBSSx3QkFBd0IsQ0FBQztJQUM3QixRQUFRLFlBQVksQ0FBQyxtQkFBbUIsRUFBRTtRQUN4QyxLQUFLLE1BQU07WUFDVCx3QkFBd0IsR0FBRyxNQUFNLENBQUM7WUFDbEMsTUFBTTtRQUNSLEtBQUssTUFBTTtZQUNULHdCQUF3QixHQUFHLE1BQU0sQ0FBQztZQUNsQyxNQUFNO1FBQ1IsS0FBSyxNQUFNO1lBQ1Qsd0JBQXdCLEdBQUcsTUFBTSxDQUFDO1lBQ2xDLE1BQU07UUFDUixLQUFLLEtBQUssQ0FBQztRQUNYO1lBQ0Usd0JBQXdCLEdBQUcsS0FBSyxDQUFDO1lBQ2pDLE1BQU07S0FDVDtJQUVELE9BQU8sSUFBSSw4QkFBb0IsQ0FBQztRQUM5QixRQUFRO1FBQ1IsZUFBZTtRQUNmLGdCQUFnQjtRQUNoQixPQUFPLEVBQUUsQ0FBQyxHQUFHO1FBQ2IsaUJBQWlCLEVBQUUsQ0FBQyxRQUFRO1FBQzVCLHdCQUF3QjtLQUN6QixDQUFDLENBQUM7QUFDTCxDQUFDO0FBN0RELDBDQTZEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBnZXRTeXN0ZW1QYXRoIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlck9wdGlvbnMgfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tQbHVnaW4gfSBmcm9tICdAbmd0b29scy93ZWJwYWNrJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcblxuZnVuY3Rpb24gZW5zdXJlSXZ5KHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiB2b2lkIHtcbiAgaWYgKHdjby50c0NvbmZpZy5vcHRpb25zLmVuYWJsZUl2eSAhPT0gZmFsc2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgJ1Byb2plY3QgaXMgYXR0ZW1wdGluZyB0byBkaXNhYmxlIHRoZSBJdnkgY29tcGlsZXIuICcgK1xuICAgICAgJ0FuZ3VsYXIgdmVyc2lvbnMgMTIgYW5kIGhpZ2hlciBkbyBub3Qgc3VwcG9ydCB0aGUgZGVwcmVjYXRlZCBWaWV3IEVuZ2luZSBjb21waWxlciBmb3IgYXBwbGljYXRpb25zLiAnICtcbiAgICAgICdUaGUgSXZ5IGNvbXBpbGVyIHdpbGwgYmUgdXNlZCB0byBidWlsZCB0aGlzIHByb2plY3QuICcgK1xuICAgICAgJ1xcbkZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIG9yIGlmIHRoZSBidWlsZCBmYWlscywgcGxlYXNlIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvaXZ5JyxcbiAgKTtcblxuICB3Y28udHNDb25maWcub3B0aW9ucy5lbmFibGVJdnkgPSB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSXZ5UGx1Z2luKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBhb3Q6IGJvb2xlYW4sXG4gIHRzY29uZmlnOiBzdHJpbmcsXG4pOiBBbmd1bGFyV2VicGFja1BsdWdpbiB7XG4gIGlmIChhb3QpIHtcbiAgICBlbnN1cmVJdnkod2NvKTtcbiAgfVxuXG4gIGNvbnN0IHsgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IG9wdGltaXplID0gYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zY3JpcHRzO1xuXG4gIGNvbnN0IGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zY3JpcHRzLFxuICAgIGRlY2xhcmF0aW9uOiBmYWxzZSxcbiAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gIH07XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb21waWxlck9wdGlvbnMucHJlc2VydmVTeW1saW5rcyA9IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzO1xuICB9XG5cbiAgLy8gT3V0cHV0dGluZyBFUzIwMTUgZnJvbSBUeXBlU2NyaXB0IGlzIHRoZSByZXF1aXJlZCBtaW5pbXVtIGZvciB0aGUgYnVpbGQgb3B0aW1pemVyIHBhc3Nlcy5cbiAgLy8gRG93bmxldmVsaW5nIHRvIEVTNSB3aWxsIG9jY3VyIGFmdGVyIHRoZSBidWlsZCBvcHRpbWl6ZXIgcGFzc2VzIHZpYSBiYWJlbCB3aGljaCBpcyB0aGUgc2FtZVxuICAvLyBhcyBmb3IgdGhpcmQtcGFydHkgbGlicmFyaWVzLiBUaGlzIGdyZWF0bHkgcmVkdWNlcyB0aGUgY29tcGxleGl0eSBvZiBzdGF0aWMgYW5hbHlzaXMuXG4gIGlmICh3Y28uc2NyaXB0VGFyZ2V0IDwgU2NyaXB0VGFyZ2V0LkVTMjAxNSkge1xuICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSBTY3JpcHRUYXJnZXQuRVMyMDE1O1xuICB9XG5cbiAgY29uc3QgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBpZiAoYnVpbGRPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIGJ1aWxkT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzW2dldFN5c3RlbVBhdGgocmVwbGFjZW1lbnQucmVwbGFjZSldID0gZ2V0U3lzdGVtUGF0aChyZXBsYWNlbWVudC53aXRoKTtcbiAgICB9XG4gIH1cblxuICBsZXQgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uO1xuICBzd2l0Y2ggKGJ1aWxkT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlKSB7XG4gICAgY2FzZSAnbGVzcyc6XG4gICAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24gPSAnbGVzcyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzYXNzJzpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdzYXNzJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Njc3MnOlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ3Njc3MnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnY3NzJzpcbiAgICBkZWZhdWx0OlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ2Nzcyc7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIHJldHVybiBuZXcgQW5ndWxhcldlYnBhY2tQbHVnaW4oe1xuICAgIHRzY29uZmlnLFxuICAgIGNvbXBpbGVyT3B0aW9ucyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGppdE1vZGU6ICFhb3QsXG4gICAgZW1pdE5nTW9kdWxlU2NvcGU6ICFvcHRpbWl6ZSxcbiAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24sXG4gIH0pO1xufVxuIl19