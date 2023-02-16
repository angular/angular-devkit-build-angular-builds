"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresLinking = void 0;
const babel_loader_1 = require("babel-loader");
const load_esm_1 = require("../utils/load-esm");
const package_version_1 = require("../utils/package-version");
/**
 * Cached instance of the compiler-cli linker's needsLinking function.
 */
let needsLinking;
/**
 * Cached instance of the compiler-cli linker's Babel plugin factory function.
 */
let linkerPluginCreator;
/**
 * Cached instance of the localize Babel plugins factory functions.
 */
let i18nPluginCreators;
async function requiresLinking(path, source) {
    // @angular/core and @angular/compiler will cause false positives
    // Also, TypeScript files do not require linking
    if (/[\\/]@angular[\\/](?:compiler|core)|\.tsx?$/.test(path)) {
        return false;
    }
    if (!needsLinking) {
        // Load ESM `@angular/compiler-cli/linker` using the TypeScript dynamic import workaround.
        // Once TypeScript provides support for keeping the dynamic import this workaround can be
        // changed to a direct dynamic import.
        const linkerModule = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker');
        needsLinking = linkerModule.needsLinking;
    }
    return needsLinking(path, source);
}
exports.requiresLinking = requiresLinking;
// eslint-disable-next-line max-lines-per-function
exports.default = (0, babel_loader_1.custom)(() => {
    const baseOptions = Object.freeze({
        babelrc: false,
        configFile: false,
        compact: false,
        cacheCompression: false,
        sourceType: 'unambiguous',
        inputSourceMap: false,
    });
    return {
        async customOptions(options, { source, map }) {
            const { i18n, aot, optimize, instrumentCode, supportedBrowsers, ...rawOptions } = options;
            // Must process file if plugins are added
            let shouldProcess = Array.isArray(rawOptions.plugins) && rawOptions.plugins.length > 0;
            const customOptions = {
                forceAsyncTransformation: false,
                angularLinker: undefined,
                i18n: undefined,
                instrumentCode: undefined,
                supportedBrowsers,
            };
            // Analyze file for linking
            if (await requiresLinking(this.resourcePath, source)) {
                // Load ESM `@angular/compiler-cli/linker/babel` using the TypeScript dynamic import workaround.
                // Once TypeScript provides support for keeping the dynamic import this workaround can be
                // changed to a direct dynamic import.
                linkerPluginCreator ?? (linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin);
                customOptions.angularLinker = {
                    shouldLink: true,
                    jitMode: aot !== true,
                    linkerPluginCreator,
                };
                shouldProcess = true;
            }
            // Application code (TS files) will only contain native async if target is ES2017+.
            // However, third-party libraries can regardless of the target option.
            // APF packages with code in [f]esm2015 directories is downlevelled to ES2015 and
            // will not have native async.
            customOptions.forceAsyncTransformation =
                !/[\\/][_f]?esm2015[\\/]/.test(this.resourcePath) && source.includes('async');
            shouldProcess || (shouldProcess = customOptions.forceAsyncTransformation ||
                customOptions.supportedBrowsers !== undefined ||
                false);
            // Analyze for i18n inlining
            if (i18n &&
                !/[\\/]@angular[\\/](?:compiler|localize)/.test(this.resourcePath) &&
                source.includes('$localize')) {
                // Load the i18n plugin creators from the new `@angular/localize/tools` entry point.
                // This may fail during the transition to ESM due to the entry point not yet existing.
                // During the transition, this will always attempt to load the entry point for each file.
                // This will only occur during prerelease and will be automatically corrected once the new
                // entry point exists.
                if (i18nPluginCreators === undefined) {
                    // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    i18nPluginCreators = await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
                }
                customOptions.i18n = {
                    ...i18n,
                    pluginCreators: i18nPluginCreators,
                };
                // Add translation files as dependencies of the file to support rebuilds
                // Except for `@angular/core` which needs locale injection but has no translations
                if (customOptions.i18n.translationFiles &&
                    !/[\\/]@angular[\\/]core/.test(this.resourcePath)) {
                    for (const file of customOptions.i18n.translationFiles) {
                        this.addDependency(file);
                    }
                }
                shouldProcess = true;
            }
            if (optimize) {
                const angularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(this.resourcePath);
                customOptions.optimize = {
                    // Angular packages provide additional tested side effects guarantees and can use
                    // otherwise unsafe optimizations.
                    looseEnums: angularPackage,
                    pureTopLevel: angularPackage,
                    // JavaScript modules that are marked as side effect free are considered to have
                    // no decorators that contain non-local effects.
                    wrapDecorators: !!this._module?.factoryMeta?.sideEffectFree,
                };
                shouldProcess = true;
            }
            if (instrumentCode &&
                !instrumentCode.excludedPaths.has(this.resourcePath) &&
                !/\.(e2e|spec)\.tsx?$|[\\/]node_modules[\\/]/.test(this.resourcePath) &&
                this.resourcePath.startsWith(instrumentCode.includedBasePath)) {
                // `babel-plugin-istanbul` has it's own includes but we do the below so that we avoid running the the loader.
                customOptions.instrumentCode = {
                    includedBasePath: instrumentCode.includedBasePath,
                    inputSourceMap: map,
                };
                shouldProcess = true;
            }
            // Add provided loader options to default base options
            const loaderOptions = {
                ...baseOptions,
                ...rawOptions,
                cacheIdentifier: JSON.stringify({
                    buildAngular: package_version_1.VERSION,
                    customOptions,
                    baseOptions,
                    rawOptions,
                }),
            };
            // Skip babel processing if no actions are needed
            if (!shouldProcess) {
                // Force the current file to be ignored
                loaderOptions.ignore = [() => true];
            }
            return { custom: customOptions, loader: loaderOptions };
        },
        config(configuration, { customOptions }) {
            return {
                ...configuration.options,
                // Using `false` disables babel from attempting to locate sourcemaps or process any inline maps.
                // The babel types do not include the false option even though it is valid
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                inputSourceMap: configuration.options.inputSourceMap ?? false,
                presets: [
                    ...(configuration.options.presets || []),
                    [
                        require('./presets/application').default,
                        {
                            ...customOptions,
                            diagnosticReporter: (type, message) => {
                                switch (type) {
                                    case 'error':
                                        this.emitError(message);
                                        break;
                                    case 'info':
                                    // Webpack does not currently have an informational diagnostic
                                    case 'warning':
                                        this.emitWarning(message);
                                        break;
                                }
                            },
                        },
                    ],
                ],
            };
        },
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBc0M7QUFDdEMsZ0RBQWtEO0FBQ2xELDhEQUFtRDtBQWFuRDs7R0FFRztBQUNILElBQUksWUFBb0YsQ0FBQztBQUV6Rjs7R0FFRztBQUNILElBQUksbUJBRVMsQ0FBQztBQUVkOztHQUVHO0FBQ0gsSUFBSSxrQkFBa0QsQ0FBQztBQUVoRCxLQUFLLFVBQVUsZUFBZSxDQUFDLElBQVksRUFBRSxNQUFjO0lBQ2hFLGlFQUFpRTtJQUNqRSxnREFBZ0Q7SUFDaEQsSUFBSSw2Q0FBNkMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDNUQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDakIsMEZBQTBGO1FBQzFGLHlGQUF5RjtRQUN6RixzQ0FBc0M7UUFDdEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFBLHdCQUFhLEVBQ3RDLDhCQUE4QixDQUMvQixDQUFDO1FBQ0YsWUFBWSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUM7S0FDMUM7SUFFRCxPQUFPLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQWxCRCwwQ0FrQkM7QUFFRCxrREFBa0Q7QUFDbEQsa0JBQWUsSUFBQSxxQkFBTSxFQUEyQixHQUFHLEVBQUU7SUFDbkQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNoQyxPQUFPLEVBQUUsS0FBSztRQUNkLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLE9BQU8sRUFBRSxLQUFLO1FBQ2QsZ0JBQWdCLEVBQUUsS0FBSztRQUN2QixVQUFV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RSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3JDO1lBRUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxDQUFDO1FBQzFELENBQUM7UUFDRCxNQUFNLENBQUMsYUFBYSxFQUFFLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLE9BQU87Z0JBQ0wsR0FBRyxhQUFhLENBQUMsT0FBTztnQkFDeEIsZ0dBQWdHO2dCQUNoRywwRUFBMEU7Z0JBQzFFLDhEQUE4RDtnQkFDOUQsY0FBYyxFQUFFLGFBQWEsQ0FBQyxPQUFPLENBQUMsY0FBYyxJQUFLLEtBQWE7Z0JBQ3RFLE9BQU8sRUFBRTtvQkFDUCxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO29CQUN4Qzt3QkFDRSxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxPQUFPO3dCQUN4Qzs0QkFDRSxHQUFHLGFBQWE7NEJBQ2hCLGtCQUFrQixFQUFFLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFO2dDQUNwQyxRQUFRLElBQUksRUFBRTtvQ0FDWixLQUFLLE9BQU87d0NBQ1YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3Q0FDeEIsTUFBTTtvQ0FDUixLQUFLLE1BQU0sQ0FBQztvQ0FDWiw4REFBOEQ7b0NBQzlELEtBQUssU0FBUzt3Q0FDWixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dDQUMxQixNQUFNO2lDQUNUOzRCQUNILENBQUM7eUJBQzBCO3FCQUM5QjtpQkFDRjthQUNGLENBQUM7UUFDSixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGN1c3RvbSB9IGZyb20gJ2JhYmVsLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uL3V0aWxzL3BhY2thZ2UtdmVyc2lvbic7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsIEkxOG5QbHVnaW5DcmVhdG9ycyB9IGZyb20gJy4vcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5cbmludGVyZmFjZSBBbmd1bGFyQ3VzdG9tT3B0aW9ucyBleHRlbmRzIE9taXQ8QXBwbGljYXRpb25QcmVzZXRPcHRpb25zLCAnaW5zdHJ1bWVudENvZGUnPiB7XG4gIGluc3RydW1lbnRDb2RlPzoge1xuICAgIC8qKiBub2RlX21vZHVsZXMgYW5kIHRlc3QgZmlsZXMgYXJlIGFsd2F5cyBleGNsdWRlZC4gKi9cbiAgICBleGNsdWRlZFBhdGhzOiBTZXQ8U3RyaW5nPjtcbiAgICBpbmNsdWRlZEJhc2VQYXRoOiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCB0eXBlIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgPSBBbmd1bGFyQ3VzdG9tT3B0aW9ucyAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgY29tcGlsZXItY2xpIGxpbmtlcidzIG5lZWRzTGlua2luZyBmdW5jdGlvbi5cbiAqL1xubGV0IG5lZWRzTGlua2luZzogdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicpLm5lZWRzTGlua2luZyB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGNvbXBpbGVyLWNsaSBsaW5rZXIncyBCYWJlbCBwbHVnaW4gZmFjdG9yeSBmdW5jdGlvbi5cbiAqL1xubGV0IGxpbmtlclBsdWdpbkNyZWF0b3I6XG4gIHwgdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpblxuICB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGxvY2FsaXplIEJhYmVsIHBsdWdpbnMgZmFjdG9yeSBmdW5jdGlvbnMuXG4gKi9cbmxldCBpMThuUGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVpcmVzTGlua2luZyhwYXRoOiBzdHJpbmcsIHNvdXJjZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIC8vIEBhbmd1bGFyL2NvcmUgYW5kIEBhbmd1bGFyL2NvbXBpbGVyIHdpbGwgY2F1c2UgZmFsc2UgcG9zaXRpdmVzXG4gIC8vIEFsc28sIFR5cGVTY3JpcHQgZmlsZXMgZG8gbm90IHJlcXVpcmUgbGlua2luZ1xuICBpZiAoL1tcXFxcL11AYW5ndWxhcltcXFxcL10oPzpjb21waWxlcnxjb3JlKXxcXC50c3g/JC8udGVzdChwYXRoKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghbmVlZHNMaW5raW5nKSB7XG4gICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXJgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgIGNvbnN0IGxpbmtlck1vZHVsZSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicpPihcbiAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJyxcbiAgICApO1xuICAgIG5lZWRzTGlua2luZyA9IGxpbmtlck1vZHVsZS5uZWVkc0xpbmtpbmc7XG4gIH1cblxuICByZXR1cm4gbmVlZHNMaW5raW5nKHBhdGgsIHNvdXJjZSk7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZGVmYXVsdCBjdXN0b208QXBwbGljYXRpb25QcmVzZXRPcHRpb25zPigoKSA9PiB7XG4gIGNvbnN0IGJhc2VPcHRpb25zID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgY29tcGFjdDogZmFsc2UsXG4gICAgY2FjaGVDb21wcmVzc2lvbjogZmFsc2UsXG4gICAgc291cmNlVHlwZTogJ3VuYW1iaWd1b3VzJyxcbiAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UsXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgYXN5bmMgY3VzdG9tT3B0aW9ucyhvcHRpb25zLCB7IHNvdXJjZSwgbWFwIH0pIHtcbiAgICAgIGNvbnN0IHsgaTE4biwgYW90LCBvcHRpbWl6ZSwgaW5zdHJ1bWVudENvZGUsIHN1cHBvcnRlZEJyb3dzZXJzLCAuLi5yYXdPcHRpb25zIH0gPVxuICAgICAgICBvcHRpb25zIGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnM7XG5cbiAgICAgIC8vIE11c3QgcHJvY2VzcyBmaWxlIGlmIHBsdWdpbnMgYXJlIGFkZGVkXG4gICAgICBsZXQgc2hvdWxkUHJvY2VzcyA9IEFycmF5LmlzQXJyYXkocmF3T3B0aW9ucy5wbHVnaW5zKSAmJiByYXdPcHRpb25zLnBsdWdpbnMubGVuZ3RoID4gMDtcblxuICAgICAgY29uc3QgY3VzdG9tT3B0aW9uczogQXBwbGljYXRpb25QcmVzZXRPcHRpb25zID0ge1xuICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb246IGZhbHNlLFxuICAgICAgICBhbmd1bGFyTGlua2VyOiB1bmRlZmluZWQsXG4gICAgICAgIGkxOG46IHVuZGVmaW5lZCxcbiAgICAgICAgaW5zdHJ1bWVudENvZGU6IHVuZGVmaW5lZCxcbiAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICB9O1xuXG4gICAgICAvLyBBbmFseXplIGZpbGUgZm9yIGxpbmtpbmdcbiAgICAgIGlmIChhd2FpdCByZXF1aXJlc0xpbmtpbmcodGhpcy5yZXNvdXJjZVBhdGgsIHNvdXJjZSkpIHtcbiAgICAgICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWxgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IgPz89IChcbiAgICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgICAgKVxuICAgICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcblxuICAgICAgICBjdXN0b21PcHRpb25zLmFuZ3VsYXJMaW5rZXIgPSB7XG4gICAgICAgICAgc2hvdWxkTGluazogdHJ1ZSxcbiAgICAgICAgICBqaXRNb2RlOiBhb3QgIT09IHRydWUsXG4gICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgfTtcbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGxpY2F0aW9uIGNvZGUgKFRTIGZpbGVzKSB3aWxsIG9ubHkgY29udGFpbiBuYXRpdmUgYXN5bmMgaWYgdGFyZ2V0IGlzIEVTMjAxNysuXG4gICAgICAvLyBIb3dldmVyLCB0aGlyZC1wYXJ0eSBsaWJyYXJpZXMgY2FuIHJlZ2FyZGxlc3Mgb2YgdGhlIHRhcmdldCBvcHRpb24uXG4gICAgICAvLyBBUEYgcGFja2FnZXMgd2l0aCBjb2RlIGluIFtmXWVzbTIwMTUgZGlyZWN0b3JpZXMgaXMgZG93bmxldmVsbGVkIHRvIEVTMjAxNSBhbmRcbiAgICAgIC8vIHdpbGwgbm90IGhhdmUgbmF0aXZlIGFzeW5jLlxuICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgICAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJiBzb3VyY2UuaW5jbHVkZXMoJ2FzeW5jJyk7XG5cbiAgICAgIHNob3VsZFByb2Nlc3MgfHw9XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uIHx8XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBmYWxzZTtcblxuICAgICAgLy8gQW5hbHl6ZSBmb3IgaTE4biBpbmxpbmluZ1xuICAgICAgaWYgKFxuICAgICAgICBpMThuICYmXG4gICAgICAgICEvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXSg/OmNvbXBpbGVyfGxvY2FsaXplKS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgc291cmNlLmluY2x1ZGVzKCckbG9jYWxpemUnKVxuICAgICAgKSB7XG4gICAgICAgIC8vIExvYWQgdGhlIGkxOG4gcGx1Z2luIGNyZWF0b3JzIGZyb20gdGhlIG5ldyBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIGVudHJ5IHBvaW50LlxuICAgICAgICAvLyBUaGlzIG1heSBmYWlsIGR1cmluZyB0aGUgdHJhbnNpdGlvbiB0byBFU00gZHVlIHRvIHRoZSBlbnRyeSBwb2ludCBub3QgeWV0IGV4aXN0aW5nLlxuICAgICAgICAvLyBEdXJpbmcgdGhlIHRyYW5zaXRpb24sIHRoaXMgd2lsbCBhbHdheXMgYXR0ZW1wdCB0byBsb2FkIHRoZSBlbnRyeSBwb2ludCBmb3IgZWFjaCBmaWxlLlxuICAgICAgICAvLyBUaGlzIHdpbGwgb25seSBvY2N1ciBkdXJpbmcgcHJlcmVsZWFzZSBhbmQgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNvcnJlY3RlZCBvbmNlIHRoZSBuZXdcbiAgICAgICAgLy8gZW50cnkgcG9pbnQgZXhpc3RzLlxuICAgICAgICBpZiAoaTE4blBsdWdpbkNyZWF0b3JzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICAgIGkxOG5QbHVnaW5DcmVhdG9ycyA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8STE4blBsdWdpbkNyZWF0b3JzPignQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuaTE4biA9IHtcbiAgICAgICAgICAuLi4oaTE4biBhcyBOb25OdWxsYWJsZTxBcHBsaWNhdGlvblByZXNldE9wdGlvbnNbJ2kxOG4nXT4pLFxuICAgICAgICAgIHBsdWdpbkNyZWF0b3JzOiBpMThuUGx1Z2luQ3JlYXRvcnMsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIHRyYW5zbGF0aW9uIGZpbGVzIGFzIGRlcGVuZGVuY2llcyBvZiB0aGUgZmlsZSB0byBzdXBwb3J0IHJlYnVpbGRzXG4gICAgICAgIC8vIEV4Y2VwdCBmb3IgYEBhbmd1bGFyL2NvcmVgIHdoaWNoIG5lZWRzIGxvY2FsZSBpbmplY3Rpb24gYnV0IGhhcyBubyB0cmFuc2xhdGlvbnNcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGN1c3RvbU9wdGlvbnMuaTE4bi50cmFuc2xhdGlvbkZpbGVzICYmXG4gICAgICAgICAgIS9bXFxcXC9dQGFuZ3VsYXJbXFxcXC9dY29yZS8udGVzdCh0aGlzLnJlc291cmNlUGF0aClcbiAgICAgICAgKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGN1c3RvbU9wdGlvbnMuaTE4bi50cmFuc2xhdGlvbkZpbGVzKSB7XG4gICAgICAgICAgICB0aGlzLmFkZERlcGVuZGVuY3koZmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpbWl6ZSkge1xuICAgICAgICBjb25zdCBhbmd1bGFyUGFja2FnZSA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCk7XG4gICAgICAgIGN1c3RvbU9wdGlvbnMub3B0aW1pemUgPSB7XG4gICAgICAgICAgLy8gQW5ndWxhciBwYWNrYWdlcyBwcm92aWRlIGFkZGl0aW9uYWwgdGVzdGVkIHNpZGUgZWZmZWN0cyBndWFyYW50ZWVzIGFuZCBjYW4gdXNlXG4gICAgICAgICAgLy8gb3RoZXJ3aXNlIHVuc2FmZSBvcHRpbWl6YXRpb25zLlxuICAgICAgICAgIGxvb3NlRW51bXM6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIHB1cmVUb3BMZXZlbDogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgLy8gSmF2YVNjcmlwdCBtb2R1bGVzIHRoYXQgYXJlIG1hcmtlZCBhcyBzaWRlIGVmZmVjdCBmcmVlIGFyZSBjb25zaWRlcmVkIHRvIGhhdmVcbiAgICAgICAgICAvLyBubyBkZWNvcmF0b3JzIHRoYXQgY29udGFpbiBub24tbG9jYWwgZWZmZWN0cy5cbiAgICAgICAgICB3cmFwRGVjb3JhdG9yczogISF0aGlzLl9tb2R1bGU/LmZhY3RvcnlNZXRhPy5zaWRlRWZmZWN0RnJlZSxcbiAgICAgICAgfTtcblxuICAgICAgICBzaG91bGRQcm9jZXNzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBpbnN0cnVtZW50Q29kZSAmJlxuICAgICAgICAhaW5zdHJ1bWVudENvZGUuZXhjbHVkZWRQYXRocy5oYXModGhpcy5yZXNvdXJjZVBhdGgpICYmXG4gICAgICAgICEvXFwuKGUyZXxzcGVjKVxcLnRzeD8kfFtcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICB0aGlzLnJlc291cmNlUGF0aC5zdGFydHNXaXRoKGluc3RydW1lbnRDb2RlLmluY2x1ZGVkQmFzZVBhdGgpXG4gICAgICApIHtcbiAgICAgICAgLy8gYGJhYmVsLXBsdWdpbi1pc3RhbmJ1bGAgaGFzIGl0J3Mgb3duIGluY2x1ZGVzIGJ1dCB3ZSBkbyB0aGUgYmVsb3cgc28gdGhhdCB3ZSBhdm9pZCBydW5uaW5nIHRoZSB0aGUgbG9hZGVyLlxuICAgICAgICBjdXN0b21PcHRpb25zLmluc3RydW1lbnRDb2RlID0ge1xuICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IGluc3RydW1lbnRDb2RlLmluY2x1ZGVkQmFzZVBhdGgsXG4gICAgICAgICAgaW5wdXRTb3VyY2VNYXA6IG1hcCxcbiAgICAgICAgfTtcblxuICAgICAgICBzaG91bGRQcm9jZXNzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHByb3ZpZGVkIGxvYWRlciBvcHRpb25zIHRvIGRlZmF1bHQgYmFzZSBvcHRpb25zXG4gICAgICBjb25zdCBsb2FkZXJPcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgIC4uLnJhd09wdGlvbnMsXG4gICAgICAgIGNhY2hlSWRlbnRpZmllcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGJ1aWxkQW5ndWxhcjogVkVSU0lPTixcbiAgICAgICAgICBjdXN0b21PcHRpb25zLFxuICAgICAgICAgIGJhc2VPcHRpb25zLFxuICAgICAgICAgIHJhd09wdGlvbnMsXG4gICAgICAgIH0pLFxuICAgICAgfTtcblxuICAgICAgLy8gU2tpcCBiYWJlbCBwcm9jZXNzaW5nIGlmIG5vIGFjdGlvbnMgYXJlIG5lZWRlZFxuICAgICAgaWYgKCFzaG91bGRQcm9jZXNzKSB7XG4gICAgICAgIC8vIEZvcmNlIHRoZSBjdXJyZW50IGZpbGUgdG8gYmUgaWdub3JlZFxuICAgICAgICBsb2FkZXJPcHRpb25zLmlnbm9yZSA9IFsoKSA9PiB0cnVlXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHsgY3VzdG9tOiBjdXN0b21PcHRpb25zLCBsb2FkZXI6IGxvYWRlck9wdGlvbnMgfTtcbiAgICB9LFxuICAgIGNvbmZpZyhjb25maWd1cmF0aW9uLCB7IGN1c3RvbU9wdGlvbnMgfSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uY29uZmlndXJhdGlvbi5vcHRpb25zLFxuICAgICAgICAvLyBVc2luZyBgZmFsc2VgIGRpc2FibGVzIGJhYmVsIGZyb20gYXR0ZW1wdGluZyB0byBsb2NhdGUgc291cmNlbWFwcyBvciBwcm9jZXNzIGFueSBpbmxpbmUgbWFwcy5cbiAgICAgICAgLy8gVGhlIGJhYmVsIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgaW5wdXRTb3VyY2VNYXA6IGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5pbnB1dFNvdXJjZU1hcCA/PyAoZmFsc2UgYXMgYW55KSxcbiAgICAgICAgcHJlc2V0czogW1xuICAgICAgICAgIC4uLihjb25maWd1cmF0aW9uLm9wdGlvbnMucHJlc2V0cyB8fCBbXSksXG4gICAgICAgICAgW1xuICAgICAgICAgICAgcmVxdWlyZSgnLi9wcmVzZXRzL2FwcGxpY2F0aW9uJykuZGVmYXVsdCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgLi4uY3VzdG9tT3B0aW9ucyxcbiAgICAgICAgICAgICAgZGlhZ25vc3RpY1JlcG9ydGVyOiAodHlwZSwgbWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICBjYXNlICdpbmZvJzpcbiAgICAgICAgICAgICAgICAgIC8vIFdlYnBhY2sgZG9lcyBub3QgY3VycmVudGx5IGhhdmUgYW4gaW5mb3JtYXRpb25hbCBkaWFnbm9zdGljXG4gICAgICAgICAgICAgICAgICBjYXNlICd3YXJuaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0V2FybmluZyhtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSBhcyBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsXG4gICAgICAgICAgXSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfSxcbiAgfTtcbn0pO1xuIl19