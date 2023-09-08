"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const babel_loader_1 = require("babel-loader");
const load_esm_1 = require("../../utils/load-esm");
const package_version_1 = require("../../utils/package-version");
const application_1 = require("./presets/application");
/**
 * Cached instance of the compiler-cli linker's Babel plugin factory function.
 */
let linkerPluginCreator;
/**
 * Cached instance of the localize Babel plugins factory functions.
 */
let i18nPluginCreators;
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
            if (await (0, application_1.requiresLinking)(this.resourcePath, source)) {
                // Load ESM `@angular/compiler-cli/linker/babel` using the TypeScript dynamic import workaround.
                // Once TypeScript provides support for keeping the dynamic import this workaround can be
                // changed to a direct dynamic import.
                linkerPluginCreator ??= (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin;
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
            shouldProcess ||=
                customOptions.forceAsyncTransformation ||
                    customOptions.supportedBrowsers !== undefined ||
                    false;
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
                const AngularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(this.resourcePath);
                const sideEffectFree = !!this._module?.factoryMeta?.sideEffectFree;
                customOptions.optimize = {
                    // Angular packages provide additional tested side effects guarantees and can use
                    // otherwise unsafe optimizations. (@angular/platform-server/init) however has side-effects.
                    pureTopLevel: AngularPackage && sideEffectFree,
                    // JavaScript modules that are marked as side effect free are considered to have
                    // no decorators that contain non-local effects.
                    wrapDecorators: sideEffectFree,
                };
                shouldProcess = true;
            }
            if (instrumentCode &&
                !instrumentCode.excludedPaths.has(this.resourcePath) &&
                !/\.(e2e|spec)\.tsx?$|[\\/]node_modules[\\/]/.test(this.resourcePath) &&
                this.resourcePath.startsWith(instrumentCode.includedBasePath)) {
                // `babel-plugin-istanbul` has it's own includes but we do the below so that we avoid running the loader.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILCtDQUFzQztBQUN0QyxtREFBcUQ7QUFDckQsaUVBQXNEO0FBQ3RELHVEQUkrQjtBQVkvQjs7R0FFRztBQUNILElBQUksbUJBRVMsQ0FBQztBQUVkOztHQUVHO0FBQ0gsSUFBSSxrQkFBa0QsQ0FBQztBQUV2RCxrREFBa0Q7QUFDbEQsa0JBQWUsSUFBQSxxQkFBTSxFQUEyQixHQUFHLEVBQUU7SUFDbkQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNoQyxPQUFPLEVBQUUsS0FBSztRQUNkLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLE9BQU8sRUFBRSxLQUFLO1FBQ2QsZ0JBQWdCLEVBQUUsS0FBSztRQUN2QixVQUFVLEVBQUUsYUFBYTtRQUN6QixjQUFjLEVBQUUsS0FBSztLQUN0QixDQUFDLENBQUM7SUFFSCxPQUFPO1FBQ0wsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFO1lBQzFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxVQUFVLEVBQUUsR0FDN0UsT0FBb0MsQ0FBQztZQUV2Qyx5Q0FBeUM7WUFDekMsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBRXZGLE1BQU0sYUFBYSxHQUE2QjtnQkFDOUMsd0JBQXdCLEVBQUUsS0FBSztnQkFD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T0FBTzt3QkFDeEM7NEJBQ0UsR0FBRyxhQUFhOzRCQUNoQixrQkFBa0IsRUFBRSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRTtnQ0FDcEMsUUFBUSxJQUFJLEVBQUU7b0NBQ1osS0FBSyxPQUFPO3dDQUNWLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7d0NBQ3hCLE1BQU07b0NBQ1IsS0FBSyxNQUFNLENBQUM7b0NBQ1osOERBQThEO29DQUM5RCxLQUFLLFNBQVM7d0NBQ1osSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3Q0FDMUIsTUFBTTtpQ0FDVDs0QkFDSCxDQUFDO3lCQUMwQjtxQkFDOUI7aUJBQ0Y7YUFDRixDQUFDO1FBQ0osQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjdXN0b20gfSBmcm9tICdiYWJlbC1sb2FkZXInO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLXZlcnNpb24nO1xuaW1wb3J0IHtcbiAgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zLFxuICBJMThuUGx1Z2luQ3JlYXRvcnMsXG4gIHJlcXVpcmVzTGlua2luZyxcbn0gZnJvbSAnLi9wcmVzZXRzL2FwcGxpY2F0aW9uJztcblxuaW50ZXJmYWNlIEFuZ3VsYXJDdXN0b21PcHRpb25zIGV4dGVuZHMgT21pdDxBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsICdpbnN0cnVtZW50Q29kZSc+IHtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgLyoqIG5vZGVfbW9kdWxlcyBhbmQgdGVzdCBmaWxlcyBhcmUgYWx3YXlzIGV4Y2x1ZGVkLiAqL1xuICAgIGV4Y2x1ZGVkUGF0aHM6IFNldDxzdHJpbmc+O1xuICAgIGluY2x1ZGVkQmFzZVBhdGg6IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IHR5cGUgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyA9IEFuZ3VsYXJDdXN0b21PcHRpb25zICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjb21waWxlci1jbGkgbGlua2VyJ3MgQmFiZWwgcGx1Z2luIGZhY3RvcnkgZnVuY3Rpb24uXG4gKi9cbmxldCBsaW5rZXJQbHVnaW5DcmVhdG9yOlxuICB8IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbiAgfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBsb2NhbGl6ZSBCYWJlbCBwbHVnaW5zIGZhY3RvcnkgZnVuY3Rpb25zLlxuICovXG5sZXQgaTE4blBsdWdpbkNyZWF0b3JzOiBJMThuUGx1Z2luQ3JlYXRvcnMgfCB1bmRlZmluZWQ7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZGVmYXVsdCBjdXN0b208QXBwbGljYXRpb25QcmVzZXRPcHRpb25zPigoKSA9PiB7XG4gIGNvbnN0IGJhc2VPcHRpb25zID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgY29tcGFjdDogZmFsc2UsXG4gICAgY2FjaGVDb21wcmVzc2lvbjogZmFsc2UsXG4gICAgc291cmNlVHlwZTogJ3VuYW1iaWd1b3VzJyxcbiAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UsXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgYXN5bmMgY3VzdG9tT3B0aW9ucyhvcHRpb25zLCB7IHNvdXJjZSwgbWFwIH0pIHtcbiAgICAgIGNvbnN0IHsgaTE4biwgYW90LCBvcHRpbWl6ZSwgaW5zdHJ1bWVudENvZGUsIHN1cHBvcnRlZEJyb3dzZXJzLCAuLi5yYXdPcHRpb25zIH0gPVxuICAgICAgICBvcHRpb25zIGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnM7XG5cbiAgICAgIC8vIE11c3QgcHJvY2VzcyBmaWxlIGlmIHBsdWdpbnMgYXJlIGFkZGVkXG4gICAgICBsZXQgc2hvdWxkUHJvY2VzcyA9IEFycmF5LmlzQXJyYXkocmF3T3B0aW9ucy5wbHVnaW5zKSAmJiByYXdPcHRpb25zLnBsdWdpbnMubGVuZ3RoID4gMDtcblxuICAgICAgY29uc3QgY3VzdG9tT3B0aW9uczogQXBwbGljYXRpb25QcmVzZXRPcHRpb25zID0ge1xuICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb246IGZhbHNlLFxuICAgICAgICBhbmd1bGFyTGlua2VyOiB1bmRlZmluZWQsXG4gICAgICAgIGkxOG46IHVuZGVmaW5lZCxcbiAgICAgICAgaW5zdHJ1bWVudENvZGU6IHVuZGVmaW5lZCxcbiAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICB9O1xuXG4gICAgICAvLyBBbmFseXplIGZpbGUgZm9yIGxpbmtpbmdcbiAgICAgIGlmIChhd2FpdCByZXF1aXJlc0xpbmtpbmcodGhpcy5yZXNvdXJjZVBhdGgsIHNvdXJjZSkpIHtcbiAgICAgICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWxgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IgPz89IChcbiAgICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgICAgKVxuICAgICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcblxuICAgICAgICBjdXN0b21PcHRpb25zLmFuZ3VsYXJMaW5rZXIgPSB7XG4gICAgICAgICAgc2hvdWxkTGluazogdHJ1ZSxcbiAgICAgICAgICBqaXRNb2RlOiBhb3QgIT09IHRydWUsXG4gICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgfTtcbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGxpY2F0aW9uIGNvZGUgKFRTIGZpbGVzKSB3aWxsIG9ubHkgY29udGFpbiBuYXRpdmUgYXN5bmMgaWYgdGFyZ2V0IGlzIEVTMjAxNysuXG4gICAgICAvLyBIb3dldmVyLCB0aGlyZC1wYXJ0eSBsaWJyYXJpZXMgY2FuIHJlZ2FyZGxlc3Mgb2YgdGhlIHRhcmdldCBvcHRpb24uXG4gICAgICAvLyBBUEYgcGFja2FnZXMgd2l0aCBjb2RlIGluIFtmXWVzbTIwMTUgZGlyZWN0b3JpZXMgaXMgZG93bmxldmVsbGVkIHRvIEVTMjAxNSBhbmRcbiAgICAgIC8vIHdpbGwgbm90IGhhdmUgbmF0aXZlIGFzeW5jLlxuICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgICAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJiBzb3VyY2UuaW5jbHVkZXMoJ2FzeW5jJyk7XG5cbiAgICAgIHNob3VsZFByb2Nlc3MgfHw9XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uIHx8XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBmYWxzZTtcblxuICAgICAgLy8gQW5hbHl6ZSBmb3IgaTE4biBpbmxpbmluZ1xuICAgICAgaWYgKFxuICAgICAgICBpMThuICYmXG4gICAgICAgICEvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXSg/OmNvbXBpbGVyfGxvY2FsaXplKS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgc291cmNlLmluY2x1ZGVzKCckbG9jYWxpemUnKVxuICAgICAgKSB7XG4gICAgICAgIC8vIExvYWQgdGhlIGkxOG4gcGx1Z2luIGNyZWF0b3JzIGZyb20gdGhlIG5ldyBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIGVudHJ5IHBvaW50LlxuICAgICAgICAvLyBUaGlzIG1heSBmYWlsIGR1cmluZyB0aGUgdHJhbnNpdGlvbiB0byBFU00gZHVlIHRvIHRoZSBlbnRyeSBwb2ludCBub3QgeWV0IGV4aXN0aW5nLlxuICAgICAgICAvLyBEdXJpbmcgdGhlIHRyYW5zaXRpb24sIHRoaXMgd2lsbCBhbHdheXMgYXR0ZW1wdCB0byBsb2FkIHRoZSBlbnRyeSBwb2ludCBmb3IgZWFjaCBmaWxlLlxuICAgICAgICAvLyBUaGlzIHdpbGwgb25seSBvY2N1ciBkdXJpbmcgcHJlcmVsZWFzZSBhbmQgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNvcnJlY3RlZCBvbmNlIHRoZSBuZXdcbiAgICAgICAgLy8gZW50cnkgcG9pbnQgZXhpc3RzLlxuICAgICAgICBpZiAoaTE4blBsdWdpbkNyZWF0b3JzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICAgIGkxOG5QbHVnaW5DcmVhdG9ycyA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8STE4blBsdWdpbkNyZWF0b3JzPignQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuaTE4biA9IHtcbiAgICAgICAgICAuLi4oaTE4biBhcyBOb25OdWxsYWJsZTxBcHBsaWNhdGlvblByZXNldE9wdGlvbnNbJ2kxOG4nXT4pLFxuICAgICAgICAgIHBsdWdpbkNyZWF0b3JzOiBpMThuUGx1Z2luQ3JlYXRvcnMsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIHRyYW5zbGF0aW9uIGZpbGVzIGFzIGRlcGVuZGVuY2llcyBvZiB0aGUgZmlsZSB0byBzdXBwb3J0IHJlYnVpbGRzXG4gICAgICAgIC8vIEV4Y2VwdCBmb3IgYEBhbmd1bGFyL2NvcmVgIHdoaWNoIG5lZWRzIGxvY2FsZSBpbmplY3Rpb24gYnV0IGhhcyBubyB0cmFuc2xhdGlvbnNcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGN1c3RvbU9wdGlvbnMuaTE4bi50cmFuc2xhdGlvbkZpbGVzICYmXG4gICAgICAgICAgIS9bXFxcXC9dQGFuZ3VsYXJbXFxcXC9dY29yZS8udGVzdCh0aGlzLnJlc291cmNlUGF0aClcbiAgICAgICAgKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGN1c3RvbU9wdGlvbnMuaTE4bi50cmFuc2xhdGlvbkZpbGVzKSB7XG4gICAgICAgICAgICB0aGlzLmFkZERlcGVuZGVuY3koZmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpbWl6ZSkge1xuICAgICAgICBjb25zdCBBbmd1bGFyUGFja2FnZSA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCk7XG4gICAgICAgIGNvbnN0IHNpZGVFZmZlY3RGcmVlID0gISF0aGlzLl9tb2R1bGU/LmZhY3RvcnlNZXRhPy5zaWRlRWZmZWN0RnJlZTtcbiAgICAgICAgY3VzdG9tT3B0aW9ucy5vcHRpbWl6ZSA9IHtcbiAgICAgICAgICAvLyBBbmd1bGFyIHBhY2thZ2VzIHByb3ZpZGUgYWRkaXRpb25hbCB0ZXN0ZWQgc2lkZSBlZmZlY3RzIGd1YXJhbnRlZXMgYW5kIGNhbiB1c2VcbiAgICAgICAgICAvLyBvdGhlcndpc2UgdW5zYWZlIG9wdGltaXphdGlvbnMuIChAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXIvaW5pdCkgaG93ZXZlciBoYXMgc2lkZS1lZmZlY3RzLlxuICAgICAgICAgIHB1cmVUb3BMZXZlbDogQW5ndWxhclBhY2thZ2UgJiYgc2lkZUVmZmVjdEZyZWUsXG4gICAgICAgICAgLy8gSmF2YVNjcmlwdCBtb2R1bGVzIHRoYXQgYXJlIG1hcmtlZCBhcyBzaWRlIGVmZmVjdCBmcmVlIGFyZSBjb25zaWRlcmVkIHRvIGhhdmVcbiAgICAgICAgICAvLyBubyBkZWNvcmF0b3JzIHRoYXQgY29udGFpbiBub24tbG9jYWwgZWZmZWN0cy5cbiAgICAgICAgICB3cmFwRGVjb3JhdG9yczogc2lkZUVmZmVjdEZyZWUsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgaW5zdHJ1bWVudENvZGUgJiZcbiAgICAgICAgIWluc3RydW1lbnRDb2RlLmV4Y2x1ZGVkUGF0aHMuaGFzKHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICAhL1xcLihlMmV8c3BlYylcXC50c3g/JHxbXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgdGhpcy5yZXNvdXJjZVBhdGguc3RhcnRzV2l0aChpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoKVxuICAgICAgKSB7XG4gICAgICAgIC8vIGBiYWJlbC1wbHVnaW4taXN0YW5idWxgIGhhcyBpdCdzIG93biBpbmNsdWRlcyBidXQgd2UgZG8gdGhlIGJlbG93IHNvIHRoYXQgd2UgYXZvaWQgcnVubmluZyB0aGUgbG9hZGVyLlxuICAgICAgICBjdXN0b21PcHRpb25zLmluc3RydW1lbnRDb2RlID0ge1xuICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IGluc3RydW1lbnRDb2RlLmluY2x1ZGVkQmFzZVBhdGgsXG4gICAgICAgICAgaW5wdXRTb3VyY2VNYXA6IG1hcCxcbiAgICAgICAgfTtcblxuICAgICAgICBzaG91bGRQcm9jZXNzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHByb3ZpZGVkIGxvYWRlciBvcHRpb25zIHRvIGRlZmF1bHQgYmFzZSBvcHRpb25zXG4gICAgICBjb25zdCBsb2FkZXJPcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgIC4uLnJhd09wdGlvbnMsXG4gICAgICAgIGNhY2hlSWRlbnRpZmllcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGJ1aWxkQW5ndWxhcjogVkVSU0lPTixcbiAgICAgICAgICBjdXN0b21PcHRpb25zLFxuICAgICAgICAgIGJhc2VPcHRpb25zLFxuICAgICAgICAgIHJhd09wdGlvbnMsXG4gICAgICAgIH0pLFxuICAgICAgfTtcblxuICAgICAgLy8gU2tpcCBiYWJlbCBwcm9jZXNzaW5nIGlmIG5vIGFjdGlvbnMgYXJlIG5lZWRlZFxuICAgICAgaWYgKCFzaG91bGRQcm9jZXNzKSB7XG4gICAgICAgIC8vIEZvcmNlIHRoZSBjdXJyZW50IGZpbGUgdG8gYmUgaWdub3JlZFxuICAgICAgICBsb2FkZXJPcHRpb25zLmlnbm9yZSA9IFsoKSA9PiB0cnVlXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHsgY3VzdG9tOiBjdXN0b21PcHRpb25zLCBsb2FkZXI6IGxvYWRlck9wdGlvbnMgfTtcbiAgICB9LFxuICAgIGNvbmZpZyhjb25maWd1cmF0aW9uLCB7IGN1c3RvbU9wdGlvbnMgfSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uY29uZmlndXJhdGlvbi5vcHRpb25zLFxuICAgICAgICAvLyBVc2luZyBgZmFsc2VgIGRpc2FibGVzIGJhYmVsIGZyb20gYXR0ZW1wdGluZyB0byBsb2NhdGUgc291cmNlbWFwcyBvciBwcm9jZXNzIGFueSBpbmxpbmUgbWFwcy5cbiAgICAgICAgLy8gVGhlIGJhYmVsIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgaW5wdXRTb3VyY2VNYXA6IGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5pbnB1dFNvdXJjZU1hcCA/PyAoZmFsc2UgYXMgYW55KSxcbiAgICAgICAgcHJlc2V0czogW1xuICAgICAgICAgIC4uLihjb25maWd1cmF0aW9uLm9wdGlvbnMucHJlc2V0cyB8fCBbXSksXG4gICAgICAgICAgW1xuICAgICAgICAgICAgcmVxdWlyZSgnLi9wcmVzZXRzL2FwcGxpY2F0aW9uJykuZGVmYXVsdCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgLi4uY3VzdG9tT3B0aW9ucyxcbiAgICAgICAgICAgICAgZGlhZ25vc3RpY1JlcG9ydGVyOiAodHlwZSwgbWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICBjYXNlICdpbmZvJzpcbiAgICAgICAgICAgICAgICAgIC8vIFdlYnBhY2sgZG9lcyBub3QgY3VycmVudGx5IGhhdmUgYW4gaW5mb3JtYXRpb25hbCBkaWFnbm9zdGljXG4gICAgICAgICAgICAgICAgICBjYXNlICd3YXJuaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0V2FybmluZyhtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSBhcyBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsXG4gICAgICAgICAgXSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfSxcbiAgfTtcbn0pO1xuIl19