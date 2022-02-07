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
const typescript_1 = require("typescript");
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
            var _a, _b;
            const { i18n, scriptTarget, aot, optimize, instrumentCode, ...rawOptions } = options;
            // Must process file if plugins are added
            let shouldProcess = Array.isArray(rawOptions.plugins) && rawOptions.plugins.length > 0;
            const customOptions = {
                forceAsyncTransformation: false,
                forceES5: false,
                angularLinker: undefined,
                i18n: undefined,
                instrumentCode: undefined,
            };
            // Analyze file for linking
            if (await requiresLinking(this.resourcePath, source)) {
                // Load ESM `@angular/compiler-cli/linker/babel` using the TypeScript dynamic import workaround.
                // Once TypeScript provides support for keeping the dynamic import this workaround can be
                // changed to a direct dynamic import.
                linkerPluginCreator !== null && linkerPluginCreator !== void 0 ? linkerPluginCreator : (linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin);
                customOptions.angularLinker = {
                    shouldLink: true,
                    jitMode: aot !== true,
                    linkerPluginCreator,
                };
                shouldProcess = true;
            }
            // Analyze for ES target processing
            const esTarget = scriptTarget;
            if (esTarget !== undefined) {
                if (esTarget < typescript_1.ScriptTarget.ES2015) {
                    customOptions.forceES5 = true;
                }
                else if (esTarget >= typescript_1.ScriptTarget.ES2017 || /\.[cm]?js$/.test(this.resourcePath)) {
                    // Application code (TS files) will only contain native async if target is ES2017+.
                    // However, third-party libraries can regardless of the target option.
                    // APF packages with code in [f]esm2015 directories is downlevelled to ES2015 and
                    // will not have native async.
                    customOptions.forceAsyncTransformation =
                        !/[\\/][_f]?esm2015[\\/]/.test(this.resourcePath) && source.includes('async');
                }
                shouldProcess || (shouldProcess = customOptions.forceAsyncTransformation || customOptions.forceES5 || false);
            }
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
                    wrapDecorators: !!((_b = (_a = this._module) === null || _a === void 0 ? void 0 : _a.factoryMeta) === null || _b === void 0 ? void 0 : _b.sideEffectFree),
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
            var _a;
            return {
                ...configuration.options,
                // Using `false` disables babel from attempting to locate sourcemaps or process any inline maps.
                // The babel types do not include the false option even though it is valid
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                inputSourceMap: (_a = configuration.options.inputSourceMap) !== null && _a !== void 0 ? _a : false,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILCtDQUFzQztBQUN0QywyQ0FBMEM7QUFDMUMsZ0RBQWtEO0FBQ2xELDhEQUFtRDtBQWFuRDs7R0FFRztBQUNILElBQUksWUFBb0YsQ0FBQztBQUV6Rjs7R0FFRztBQUNILElBQUksbUJBRVMsQ0FBQztBQUVkOztHQUVHO0FBQ0gsSUFBSSxrQkFBa0QsQ0FBQztBQUV2RCxLQUFLLFVBQVUsZUFBZSxDQUFDLElBQVksRUFBRSxNQUFjO0lBQ3pELGlFQUFpRTtJQUNqRSxnREFBZ0Q7SUFDaEQsSUFBSSw2Q0FBNkMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDNUQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDakIsMEZBQTBGO1FBQzFGLHlGQUF5RjtRQUN6RixzQ0FBc0M7UUFDdEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFBLHdCQUFhLEVBQ3RDLDhCQUE4QixDQUMvQixDQUFDO1FBQ0YsWUFBWSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUM7S0FDMUM7SUFFRCxPQUFPLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELGtEQUFrRDtBQUNsRCxrQkFBZSxJQUFBLHFCQUFNLEVBQTJCLEdBQUcsRUFBRTtJQUNuRCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ2hDLE9BQU8sRUFBRSxLQUFLO1FBQ2QsVUFBVSxFQUFFLEtBQUs7UUFDakIsT0FBTyxFQUFFLEtBQUs7UUFDZCxnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLFVBQVUs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QzlELEtBQUssU0FBUzt3Q0FDWixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dDQUMxQixNQUFNO2lDQUNUOzRCQUNILENBQUM7eUJBQzBCO3FCQUM5QjtpQkFDRjthQUNGLENBQUM7UUFDSixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGN1c3RvbSB9IGZyb20gJ2JhYmVsLWxvYWRlcic7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSAnLi4vdXRpbHMvcGFja2FnZS12ZXJzaW9uJztcbmltcG9ydCB7IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucywgSTE4blBsdWdpbkNyZWF0b3JzIH0gZnJvbSAnLi9wcmVzZXRzL2FwcGxpY2F0aW9uJztcblxuaW50ZXJmYWNlIEFuZ3VsYXJDdXN0b21PcHRpb25zIGV4dGVuZHMgT21pdDxBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsICdpbnN0cnVtZW50Q29kZSc+IHtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgLyoqIG5vZGVfbW9kdWxlcyBhbmQgdGVzdCBmaWxlcyBhcmUgYWx3YXlzIGV4Y2x1ZGVkLiAqL1xuICAgIGV4Y2x1ZGVkUGF0aHM6IFNldDxTdHJpbmc+O1xuICAgIGluY2x1ZGVkQmFzZVBhdGg6IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IHR5cGUgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyA9IEFuZ3VsYXJDdXN0b21PcHRpb25zICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjb21waWxlci1jbGkgbGlua2VyJ3MgbmVlZHNMaW5raW5nIGZ1bmN0aW9uLlxuICovXG5sZXQgbmVlZHNMaW5raW5nOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJykubmVlZHNMaW5raW5nIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgY29tcGlsZXItY2xpIGxpbmtlcidzIEJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uLlxuICovXG5sZXQgbGlua2VyUGx1Z2luQ3JlYXRvcjpcbiAgfCB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4gIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgbG9jYWxpemUgQmFiZWwgcGx1Z2lucyBmYWN0b3J5IGZ1bmN0aW9ucy5cbiAqL1xubGV0IGkxOG5QbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzIHwgdW5kZWZpbmVkO1xuXG5hc3luYyBmdW5jdGlvbiByZXF1aXJlc0xpbmtpbmcocGF0aDogc3RyaW5nLCBzb3VyY2U6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAvLyBAYW5ndWxhci9jb3JlIGFuZCBAYW5ndWxhci9jb21waWxlciB3aWxsIGNhdXNlIGZhbHNlIHBvc2l0aXZlc1xuICAvLyBBbHNvLCBUeXBlU2NyaXB0IGZpbGVzIGRvIG5vdCByZXF1aXJlIGxpbmtpbmdcbiAgaWYgKC9bXFxcXC9dQGFuZ3VsYXJbXFxcXC9dKD86Y29tcGlsZXJ8Y29yZSl8XFwudHN4PyQvLnRlc3QocGF0aCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoIW5lZWRzTGlua2luZykge1xuICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICBjb25zdCBsaW5rZXJNb2R1bGUgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXInKT4oXG4gICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicsXG4gICAgKTtcbiAgICBuZWVkc0xpbmtpbmcgPSBsaW5rZXJNb2R1bGUubmVlZHNMaW5raW5nO1xuICB9XG5cbiAgcmV0dXJuIG5lZWRzTGlua2luZyhwYXRoLCBzb3VyY2UpO1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGRlZmF1bHQgY3VzdG9tPEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucz4oKCkgPT4ge1xuICBjb25zdCBiYXNlT3B0aW9ucyA9IE9iamVjdC5mcmVlemUoe1xuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgIGNhY2hlQ29tcHJlc3Npb246IGZhbHNlLFxuICAgIHNvdXJjZVR5cGU6ICd1bmFtYmlndW91cycsXG4gICAgaW5wdXRTb3VyY2VNYXA6IGZhbHNlLFxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGFzeW5jIGN1c3RvbU9wdGlvbnMob3B0aW9ucywgeyBzb3VyY2UsIG1hcCB9KSB7XG4gICAgICBjb25zdCB7IGkxOG4sIHNjcmlwdFRhcmdldCwgYW90LCBvcHRpbWl6ZSwgaW5zdHJ1bWVudENvZGUsIC4uLnJhd09wdGlvbnMgfSA9XG4gICAgICAgIG9wdGlvbnMgYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucztcblxuICAgICAgLy8gTXVzdCBwcm9jZXNzIGZpbGUgaWYgcGx1Z2lucyBhcmUgYWRkZWRcbiAgICAgIGxldCBzaG91bGRQcm9jZXNzID0gQXJyYXkuaXNBcnJheShyYXdPcHRpb25zLnBsdWdpbnMpICYmIHJhd09wdGlvbnMucGx1Z2lucy5sZW5ndGggPiAwO1xuXG4gICAgICBjb25zdCBjdXN0b21PcHRpb25zOiBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMgPSB7XG4gICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbjogZmFsc2UsXG4gICAgICAgIGZvcmNlRVM1OiBmYWxzZSxcbiAgICAgICAgYW5ndWxhckxpbmtlcjogdW5kZWZpbmVkLFxuICAgICAgICBpMThuOiB1bmRlZmluZWQsXG4gICAgICAgIGluc3RydW1lbnRDb2RlOiB1bmRlZmluZWQsXG4gICAgICB9O1xuXG4gICAgICAvLyBBbmFseXplIGZpbGUgZm9yIGxpbmtpbmdcbiAgICAgIGlmIChhd2FpdCByZXF1aXJlc0xpbmtpbmcodGhpcy5yZXNvdXJjZVBhdGgsIHNvdXJjZSkpIHtcbiAgICAgICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWxgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IgPz89IChcbiAgICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgICAgKVxuICAgICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcblxuICAgICAgICBjdXN0b21PcHRpb25zLmFuZ3VsYXJMaW5rZXIgPSB7XG4gICAgICAgICAgc2hvdWxkTGluazogdHJ1ZSxcbiAgICAgICAgICBqaXRNb2RlOiBhb3QgIT09IHRydWUsXG4gICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgfTtcbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFuYWx5emUgZm9yIEVTIHRhcmdldCBwcm9jZXNzaW5nXG4gICAgICBjb25zdCBlc1RhcmdldCA9IHNjcmlwdFRhcmdldCBhcyBTY3JpcHRUYXJnZXQgfCB1bmRlZmluZWQ7XG4gICAgICBpZiAoZXNUYXJnZXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoZXNUYXJnZXQgPCBTY3JpcHRUYXJnZXQuRVMyMDE1KSB7XG4gICAgICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZUVTNSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoZXNUYXJnZXQgPj0gU2NyaXB0VGFyZ2V0LkVTMjAxNyB8fCAvXFwuW2NtXT9qcyQvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpKSB7XG4gICAgICAgICAgLy8gQXBwbGljYXRpb24gY29kZSAoVFMgZmlsZXMpIHdpbGwgb25seSBjb250YWluIG5hdGl2ZSBhc3luYyBpZiB0YXJnZXQgaXMgRVMyMDE3Ky5cbiAgICAgICAgICAvLyBIb3dldmVyLCB0aGlyZC1wYXJ0eSBsaWJyYXJpZXMgY2FuIHJlZ2FyZGxlc3Mgb2YgdGhlIHRhcmdldCBvcHRpb24uXG4gICAgICAgICAgLy8gQVBGIHBhY2thZ2VzIHdpdGggY29kZSBpbiBbZl1lc20yMDE1IGRpcmVjdG9yaWVzIGlzIGRvd25sZXZlbGxlZCB0byBFUzIwMTUgYW5kXG4gICAgICAgICAgLy8gd2lsbCBub3QgaGF2ZSBuYXRpdmUgYXN5bmMuXG4gICAgICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgICAgICAgICAgIS9bXFxcXC9dW19mXT9lc20yMDE1W1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiYgc291cmNlLmluY2x1ZGVzKCdhc3luYycpO1xuICAgICAgICB9XG4gICAgICAgIHNob3VsZFByb2Nlc3MgfHw9IGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uIHx8IGN1c3RvbU9wdGlvbnMuZm9yY2VFUzUgfHwgZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIEFuYWx5emUgZm9yIGkxOG4gaW5saW5pbmdcbiAgICAgIGlmIChcbiAgICAgICAgaTE4biAmJlxuICAgICAgICAhL1tcXFxcL11AYW5ndWxhcltcXFxcL10oPzpjb21waWxlcnxsb2NhbGl6ZSkvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpICYmXG4gICAgICAgIHNvdXJjZS5pbmNsdWRlcygnJGxvY2FsaXplJylcbiAgICAgICkge1xuICAgICAgICAvLyBMb2FkIHRoZSBpMThuIHBsdWdpbiBjcmVhdG9ycyBmcm9tIHRoZSBuZXcgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBlbnRyeSBwb2ludC5cbiAgICAgICAgLy8gVGhpcyBtYXkgZmFpbCBkdXJpbmcgdGhlIHRyYW5zaXRpb24gdG8gRVNNIGR1ZSB0byB0aGUgZW50cnkgcG9pbnQgbm90IHlldCBleGlzdGluZy5cbiAgICAgICAgLy8gRHVyaW5nIHRoZSB0cmFuc2l0aW9uLCB0aGlzIHdpbGwgYWx3YXlzIGF0dGVtcHQgdG8gbG9hZCB0aGUgZW50cnkgcG9pbnQgZm9yIGVhY2ggZmlsZS5cbiAgICAgICAgLy8gVGhpcyB3aWxsIG9ubHkgb2NjdXIgZHVyaW5nIHByZXJlbGVhc2UgYW5kIHdpbGwgYmUgYXV0b21hdGljYWxseSBjb3JyZWN0ZWQgb25jZSB0aGUgbmV3XG4gICAgICAgIC8vIGVudHJ5IHBvaW50IGV4aXN0cy5cbiAgICAgICAgaWYgKGkxOG5QbHVnaW5DcmVhdG9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICBpMThuUGx1Z2luQ3JlYXRvcnMgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPEkxOG5QbHVnaW5DcmVhdG9ycz4oJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjdXN0b21PcHRpb25zLmkxOG4gPSB7XG4gICAgICAgICAgLi4uKGkxOG4gYXMgTm9uTnVsbGFibGU8QXBwbGljYXRpb25QcmVzZXRPcHRpb25zWydpMThuJ10+KSxcbiAgICAgICAgICBwbHVnaW5DcmVhdG9yczogaTE4blBsdWdpbkNyZWF0b3JzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCB0cmFuc2xhdGlvbiBmaWxlcyBhcyBkZXBlbmRlbmNpZXMgb2YgdGhlIGZpbGUgdG8gc3VwcG9ydCByZWJ1aWxkc1xuICAgICAgICAvLyBFeGNlcHQgZm9yIGBAYW5ndWxhci9jb3JlYCB3aGljaCBuZWVkcyBsb2NhbGUgaW5qZWN0aW9uIGJ1dCBoYXMgbm8gdHJhbnNsYXRpb25zXG4gICAgICAgIGlmIChcbiAgICAgICAgICBjdXN0b21PcHRpb25zLmkxOG4udHJhbnNsYXRpb25GaWxlcyAmJlxuICAgICAgICAgICEvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWNvcmUvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpXG4gICAgICAgICkge1xuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBjdXN0b21PcHRpb25zLmkxOG4udHJhbnNsYXRpb25GaWxlcykge1xuICAgICAgICAgICAgdGhpcy5hZGREZXBlbmRlbmN5KGZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW1pemUpIHtcbiAgICAgICAgY29uc3QgYW5ndWxhclBhY2thZ2UgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL10vLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpO1xuICAgICAgICBjdXN0b21PcHRpb25zLm9wdGltaXplID0ge1xuICAgICAgICAgIC8vIEFuZ3VsYXIgcGFja2FnZXMgcHJvdmlkZSBhZGRpdGlvbmFsIHRlc3RlZCBzaWRlIGVmZmVjdHMgZ3VhcmFudGVlcyBhbmQgY2FuIHVzZVxuICAgICAgICAgIC8vIG90aGVyd2lzZSB1bnNhZmUgb3B0aW1pemF0aW9ucy5cbiAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIC8vIEphdmFTY3JpcHQgbW9kdWxlcyB0aGF0IGFyZSBtYXJrZWQgYXMgc2lkZSBlZmZlY3QgZnJlZSBhcmUgY29uc2lkZXJlZCB0byBoYXZlXG4gICAgICAgICAgLy8gbm8gZGVjb3JhdG9ycyB0aGF0IGNvbnRhaW4gbm9uLWxvY2FsIGVmZmVjdHMuXG4gICAgICAgICAgd3JhcERlY29yYXRvcnM6ICEhdGhpcy5fbW9kdWxlPy5mYWN0b3J5TWV0YT8uc2lkZUVmZmVjdEZyZWUsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgaW5zdHJ1bWVudENvZGUgJiZcbiAgICAgICAgIWluc3RydW1lbnRDb2RlLmV4Y2x1ZGVkUGF0aHMuaGFzKHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICAhL1xcLihlMmV8c3BlYylcXC50c3g/JHxbXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgdGhpcy5yZXNvdXJjZVBhdGguc3RhcnRzV2l0aChpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoKVxuICAgICAgKSB7XG4gICAgICAgIC8vIGBiYWJlbC1wbHVnaW4taXN0YW5idWxgIGhhcyBpdCdzIG93biBpbmNsdWRlcyBidXQgd2UgZG8gdGhlIGJlbG93IHNvIHRoYXQgd2UgYXZvaWQgcnVubmluZyB0aGUgdGhlIGxvYWRlci5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5pbnN0cnVtZW50Q29kZSA9IHtcbiAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoLFxuICAgICAgICAgIGlucHV0U291cmNlTWFwOiBtYXAsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBwcm92aWRlZCBsb2FkZXIgb3B0aW9ucyB0byBkZWZhdWx0IGJhc2Ugb3B0aW9uc1xuICAgICAgY29uc3QgbG9hZGVyT3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgIC4uLmJhc2VPcHRpb25zLFxuICAgICAgICAuLi5yYXdPcHRpb25zLFxuICAgICAgICBjYWNoZUlkZW50aWZpZXI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBidWlsZEFuZ3VsYXI6IFZFUlNJT04sXG4gICAgICAgICAgY3VzdG9tT3B0aW9ucyxcbiAgICAgICAgICBiYXNlT3B0aW9ucyxcbiAgICAgICAgICByYXdPcHRpb25zLFxuICAgICAgICB9KSxcbiAgICAgIH07XG5cbiAgICAgIC8vIFNraXAgYmFiZWwgcHJvY2Vzc2luZyBpZiBubyBhY3Rpb25zIGFyZSBuZWVkZWRcbiAgICAgIGlmICghc2hvdWxkUHJvY2Vzcykge1xuICAgICAgICAvLyBGb3JjZSB0aGUgY3VycmVudCBmaWxlIHRvIGJlIGlnbm9yZWRcbiAgICAgICAgbG9hZGVyT3B0aW9ucy5pZ25vcmUgPSBbKCkgPT4gdHJ1ZV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IGN1c3RvbTogY3VzdG9tT3B0aW9ucywgbG9hZGVyOiBsb2FkZXJPcHRpb25zIH07XG4gICAgfSxcbiAgICBjb25maWcoY29uZmlndXJhdGlvbiwgeyBjdXN0b21PcHRpb25zIH0pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmNvbmZpZ3VyYXRpb24ub3B0aW9ucyxcbiAgICAgICAgLy8gVXNpbmcgYGZhbHNlYCBkaXNhYmxlcyBiYWJlbCBmcm9tIGF0dGVtcHRpbmcgdG8gbG9jYXRlIHNvdXJjZW1hcHMgb3IgcHJvY2VzcyBhbnkgaW5saW5lIG1hcHMuXG4gICAgICAgIC8vIFRoZSBiYWJlbCB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIGlucHV0U291cmNlTWFwOiBjb25maWd1cmF0aW9uLm9wdGlvbnMuaW5wdXRTb3VyY2VNYXAgPz8gKGZhbHNlIGFzIGFueSksXG4gICAgICAgIHByZXNldHM6IFtcbiAgICAgICAgICAuLi4oY29uZmlndXJhdGlvbi5vcHRpb25zLnByZXNldHMgfHwgW10pLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIHJlcXVpcmUoJy4vcHJlc2V0cy9hcHBsaWNhdGlvbicpLmRlZmF1bHQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIC4uLmN1c3RvbU9wdGlvbnMsXG4gICAgICAgICAgICAgIGRpYWdub3N0aWNSZXBvcnRlcjogKHR5cGUsIG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0RXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnaW5mbyc6XG4gICAgICAgICAgICAgICAgICAvLyBXZWJwYWNrIGRvZXMgbm90IGN1cnJlbnRseSBoYXZlIGFuIGluZm9ybWF0aW9uYWwgZGlhZ25vc3RpY1xuICAgICAgICAgICAgICAgICAgY2FzZSAnd2FybmluZyc6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFdhcm5pbmcobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0gYXMgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zLFxuICAgICAgICAgIF0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH0sXG4gIH07XG59KTtcbiJdfQ==