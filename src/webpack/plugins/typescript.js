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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDhDQUF3RDtBQUN4RCwyQ0FBMEM7QUFHMUMsU0FBUyxTQUFTLENBQUMsR0FBeUI7SUFDMUMsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssS0FBSyxFQUFFO1FBQzVDLE9BQU87S0FDUjtJQUVELEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNiLHFEQUFxRDtRQUNuRCxzR0FBc0c7UUFDdEcsdURBQXVEO1FBQ3ZELDZGQUE2RixDQUNoRyxDQUFDO0lBRUYsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUN4QyxDQUFDO0FBRUQsU0FBZ0IsZUFBZSxDQUM3QixHQUF5QixFQUN6QixHQUFZLEVBQ1osUUFBZ0I7SUFFaEIsSUFBSSxHQUFHLEVBQUU7UUFDUCxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDaEI7SUFFRCxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQzdCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBRW5ELE1BQU0sZUFBZSxHQUFvQjtRQUN2QyxTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPO1FBQ3pDLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLGNBQWMsRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7UUFDL0MsZUFBZSxDQUFDLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQztLQUNsRTtJQUVELDRGQUE0RjtJQUM1Riw4RkFBOEY7SUFDOUYsd0ZBQXdGO0lBQ3hGLElBQUksR0FBRyxDQUFDLFlBQVksR0FBRyx5QkFBWSxDQUFDLE1BQU0sRUFBRTtRQUMxQyxlQUFlLENBQUMsTUFBTSxHQUFHLHlCQUFZLENBQUMsTUFBTSxDQUFDO1FBQzdDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNiLDZHQUE2RyxDQUM5RyxDQUFDO0tBQ0g7SUFFRCxNQUFNLGdCQUFnQixHQUEyQixFQUFFLENBQUM7SUFDcEQsSUFBSSxZQUFZLENBQUMsZ0JBQWdCLEVBQUU7UUFDakMsS0FBSyxNQUFNLFdBQVcsSUFBSSxZQUFZLENBQUMsZ0JBQWdCLEVBQUU7WUFDdkQsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUM7U0FDMUQ7S0FDRjtJQUVELElBQUksd0JBQXdCLENBQUM7SUFDN0IsUUFBUSxZQUFZLENBQUMsbUJBQW1CLEVBQUU7UUFDeEMsS0FBSyxNQUFNO1lBQ1Qsd0JBQXdCLEdBQUcsTUFBTSxDQUFDO1lBQ2xDLE1BQU07UUFDUixLQUFLLE1BQU07WUFDVCx3QkFBd0IsR0FBRyxNQUFNLENBQUM7WUFDbEMsTUFBTTtRQUNSLEtBQUssTUFBTTtZQUNULHdCQUF3QixHQUFHLE1BQU0sQ0FBQztZQUNsQyxNQUFNO1FBQ1IsS0FBSyxLQUFLLENBQUM7UUFDWDtZQUNFLHdCQUF3QixHQUFHLEtBQUssQ0FBQztZQUNqQyxNQUFNO0tBQ1Q7SUFFRCxPQUFPLElBQUksOEJBQW9CLENBQUM7UUFDOUIsUUFBUTtRQUNSLGVBQWU7UUFDZixnQkFBZ0I7UUFDaEIsT0FBTyxFQUFFLENBQUMsR0FBRztRQUNiLGlCQUFpQixFQUFFLENBQUMsUUFBUTtRQUM1Qix3QkFBd0I7S0FDekIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQWhFRCwwQ0FnRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlck9wdGlvbnMgfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tQbHVnaW4gfSBmcm9tICdAbmd0b29scy93ZWJwYWNrJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcblxuZnVuY3Rpb24gZW5zdXJlSXZ5KHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiB2b2lkIHtcbiAgaWYgKHdjby50c0NvbmZpZy5vcHRpb25zLmVuYWJsZUl2eSAhPT0gZmFsc2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgJ1Byb2plY3QgaXMgYXR0ZW1wdGluZyB0byBkaXNhYmxlIHRoZSBJdnkgY29tcGlsZXIuICcgK1xuICAgICAgJ0FuZ3VsYXIgdmVyc2lvbnMgMTIgYW5kIGhpZ2hlciBkbyBub3Qgc3VwcG9ydCB0aGUgZGVwcmVjYXRlZCBWaWV3IEVuZ2luZSBjb21waWxlciBmb3IgYXBwbGljYXRpb25zLiAnICtcbiAgICAgICdUaGUgSXZ5IGNvbXBpbGVyIHdpbGwgYmUgdXNlZCB0byBidWlsZCB0aGlzIHByb2plY3QuICcgK1xuICAgICAgJ1xcbkZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIG9yIGlmIHRoZSBidWlsZCBmYWlscywgcGxlYXNlIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvaXZ5JyxcbiAgKTtcblxuICB3Y28udHNDb25maWcub3B0aW9ucy5lbmFibGVJdnkgPSB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSXZ5UGx1Z2luKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBhb3Q6IGJvb2xlYW4sXG4gIHRzY29uZmlnOiBzdHJpbmcsXG4pOiBBbmd1bGFyV2VicGFja1BsdWdpbiB7XG4gIGlmIChhb3QpIHtcbiAgICBlbnN1cmVJdnkod2NvKTtcbiAgfVxuXG4gIGNvbnN0IHsgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IG9wdGltaXplID0gYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zY3JpcHRzO1xuXG4gIGNvbnN0IGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zY3JpcHRzLFxuICAgIGRlY2xhcmF0aW9uOiBmYWxzZSxcbiAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gIH07XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb21waWxlck9wdGlvbnMucHJlc2VydmVTeW1saW5rcyA9IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzO1xuICB9XG5cbiAgLy8gT3V0cHV0dGluZyBFUzIwMTUgZnJvbSBUeXBlU2NyaXB0IGlzIHRoZSByZXF1aXJlZCBtaW5pbXVtIGZvciB0aGUgYnVpbGQgb3B0aW1pemVyIHBhc3Nlcy5cbiAgLy8gRG93bmxldmVsaW5nIHRvIEVTNSB3aWxsIG9jY3VyIGFmdGVyIHRoZSBidWlsZCBvcHRpbWl6ZXIgcGFzc2VzIHZpYSBiYWJlbCB3aGljaCBpcyB0aGUgc2FtZVxuICAvLyBhcyBmb3IgdGhpcmQtcGFydHkgbGlicmFyaWVzLiBUaGlzIGdyZWF0bHkgcmVkdWNlcyB0aGUgY29tcGxleGl0eSBvZiBzdGF0aWMgYW5hbHlzaXMuXG4gIGlmICh3Y28uc2NyaXB0VGFyZ2V0IDwgU2NyaXB0VGFyZ2V0LkVTMjAxNSkge1xuICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSBTY3JpcHRUYXJnZXQuRVMyMDE1O1xuICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICdERVBSRUNBVEVEOiBFUzUgb3V0cHV0IGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1cGRhdGUgVHlwZVNjcmlwdCBgdGFyZ2V0YCBjb21waWxlciBvcHRpb24gdG8gRVMyMDE1IG9yIGxhdGVyLicsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGZpbGVSZXBsYWNlbWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBidWlsZE9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1tyZXBsYWNlbWVudC5yZXBsYWNlXSA9IHJlcGxhY2VtZW50LndpdGg7XG4gICAgfVxuICB9XG5cbiAgbGV0IGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbjtcbiAgc3dpdGNoIChidWlsZE9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSkge1xuICAgIGNhc2UgJ2xlc3MnOlxuICAgICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uID0gJ2xlc3MnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc2Fzcyc6XG4gICAgICBpbmxpbmVTdHlsZUZpbGVFeHRlbnNpb24gPSAnc2Fzcyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzY3NzJzpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdzY3NzJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Nzcyc6XG4gICAgZGVmYXVsdDpcbiAgICAgIGlubGluZVN0eWxlRmlsZUV4dGVuc2lvbiA9ICdjc3MnO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICByZXR1cm4gbmV3IEFuZ3VsYXJXZWJwYWNrUGx1Z2luKHtcbiAgICB0c2NvbmZpZyxcbiAgICBjb21waWxlck9wdGlvbnMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBqaXRNb2RlOiAhYW90LFxuICAgIGVtaXROZ01vZHVsZVNjb3BlOiAhb3B0aW1pemUsXG4gICAgaW5saW5lU3R5bGVGaWxlRXh0ZW5zaW9uLFxuICB9KTtcbn1cbiJdfQ==