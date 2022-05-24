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
            var _a, _b;
            const { i18n, scriptTarget, aot, optimize, instrumentCode, supportedBrowsers, ...rawOptions } = options;
            // Must process file if plugins are added
            let shouldProcess = Array.isArray(rawOptions.plugins) && rawOptions.plugins.length > 0;
            const customOptions = {
                forceAsyncTransformation: false,
                forcePresetEnv: false,
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
            const isJsFile = /\.[cm]?js$/.test(this.resourcePath);
            // The below should be dropped when we no longer support ES5 TypeScript output.
            if (esTarget === typescript_1.ScriptTarget.ES5) {
                // This is needed because when target is ES5 we change the TypeScript target to ES2015
                // because it simplifies build-optimization passes.
                // @see https://github.com/angular/angular-cli/blob/22af6520834171d01413d4c7e4a9f13fb752252e/packages/angular_devkit/build_angular/src/webpack/plugins/typescript.ts#L51-L56
                customOptions.forcePresetEnv = true;
                // Comparable behavior to tsconfig target of ES5
                customOptions.supportedBrowsers = ['IE 9'];
            }
            else if (isJsFile) {
                // Applications code ES version can be controlled using TypeScript's `target` option.
                // However, this doesn't effect libraries and hence we use preset-env to downlevel ES fetaures
                // based on the supported browsers in browserlist.
                customOptions.forcePresetEnv = true;
            }
            if ((esTarget !== undefined && esTarget >= typescript_1.ScriptTarget.ES2017) || isJsFile) {
                // Application code (TS files) will only contain native async if target is ES2017+.
                // However, third-party libraries can regardless of the target option.
                // APF packages with code in [f]esm2015 directories is downlevelled to ES2015 and
                // will not have native async.
                customOptions.forceAsyncTransformation =
                    !/[\\/][_f]?esm2015[\\/]/.test(this.resourcePath) && source.includes('async');
            }
            shouldProcess || (shouldProcess = customOptions.forceAsyncTransformation || customOptions.forcePresetEnv || false);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBc0M7QUFDdEMsMkNBQTBDO0FBQzFDLGdEQUFrRDtBQUNsRCw4REFBbUQ7QUFhbkQ7O0dBRUc7QUFDSCxJQUFJLFlBQW9GLENBQUM7QUFFekY7O0dBRUc7QUFDSCxJQUFJLG1CQUVTLENBQUM7QUFFZDs7R0FFRztBQUNILElBQUksa0JBQWtELENBQUM7QUFFaEQsS0FBSyxVQUFVLGVBQWUsQ0FBQyxJQUFZLEVBQUUsTUFBYztJQUNoRSxpRUFBaUU7SUFDakUsZ0RBQWdEO0lBQ2hELElBQUksNkNBQTZDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzVELE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ2pCLDBGQUEwRjtRQUMxRix5RkFBeUY7UUFDekYsc0NBQXNDO1FBQ3RDLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUN0Qyw4QkFBOEIsQ0FDL0IsQ0FBQztRQUNGLFlBQVksR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDO0tBQzFDO0lBRUQsT0FBTyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3BDLENBQUM7QUFsQkQsMENBa0JDO0FBRUQsa0RBQWtEO0FBQ2xELGtCQUFlLElBQUEscUJBQU0sRUFBMkIsR0FBRyxFQUFFO0lBQ25ELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDaEMsT0FBTyxFQUFFLEtBQUs7UUFDZCxVQUFVLEVBQUUsS0FBSztRQUNqQixPQUFPLEVBQUUsS0FBSztRQUNkLGdCQUFnQixFQUFFLEtB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YUFBYSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO29CQUN4Qzt3QkFDRSxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxPQUFPO3dCQUN4Qzs0QkFDRSxHQUFHLGFBQWE7NEJBQ2hCLGtCQUFrQixFQUFFLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFO2dDQUNwQyxRQUFRLElBQUksRUFBRTtvQ0FDWixLQUFLLE9BQU87d0NBQ1YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3Q0FDeEIsTUFBTTtvQ0FDUixLQUFLLE1BQU0sQ0FBQztvQ0FDWiw4REFBOEQ7b0NBQzlELEtBQUssU0FBUzt3Q0FDWixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dDQUMxQixNQUFNO2lDQUNUOzRCQUNILENBQUM7eUJBQzBCO3FCQUM5QjtpQkFDRjthQUNGLENBQUM7UUFDSixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGN1c3RvbSB9IGZyb20gJ2JhYmVsLWxvYWRlcic7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSAnLi4vdXRpbHMvcGFja2FnZS12ZXJzaW9uJztcbmltcG9ydCB7IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucywgSTE4blBsdWdpbkNyZWF0b3JzIH0gZnJvbSAnLi9wcmVzZXRzL2FwcGxpY2F0aW9uJztcblxuaW50ZXJmYWNlIEFuZ3VsYXJDdXN0b21PcHRpb25zIGV4dGVuZHMgT21pdDxBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsICdpbnN0cnVtZW50Q29kZSc+IHtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgLyoqIG5vZGVfbW9kdWxlcyBhbmQgdGVzdCBmaWxlcyBhcmUgYWx3YXlzIGV4Y2x1ZGVkLiAqL1xuICAgIGV4Y2x1ZGVkUGF0aHM6IFNldDxTdHJpbmc+O1xuICAgIGluY2x1ZGVkQmFzZVBhdGg6IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IHR5cGUgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyA9IEFuZ3VsYXJDdXN0b21PcHRpb25zICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjb21waWxlci1jbGkgbGlua2VyJ3MgbmVlZHNMaW5raW5nIGZ1bmN0aW9uLlxuICovXG5sZXQgbmVlZHNMaW5raW5nOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJykubmVlZHNMaW5raW5nIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgY29tcGlsZXItY2xpIGxpbmtlcidzIEJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uLlxuICovXG5sZXQgbGlua2VyUGx1Z2luQ3JlYXRvcjpcbiAgfCB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4gIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgbG9jYWxpemUgQmFiZWwgcGx1Z2lucyBmYWN0b3J5IGZ1bmN0aW9ucy5cbiAqL1xubGV0IGkxOG5QbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVxdWlyZXNMaW5raW5nKHBhdGg6IHN0cmluZywgc291cmNlOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgLy8gQGFuZ3VsYXIvY29yZSBhbmQgQGFuZ3VsYXIvY29tcGlsZXIgd2lsbCBjYXVzZSBmYWxzZSBwb3NpdGl2ZXNcbiAgLy8gQWxzbywgVHlwZVNjcmlwdCBmaWxlcyBkbyBub3QgcmVxdWlyZSBsaW5raW5nXG4gIGlmICgvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXSg/OmNvbXBpbGVyfGNvcmUpfFxcLnRzeD8kLy50ZXN0KHBhdGgpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCFuZWVkc0xpbmtpbmcpIHtcbiAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcmAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgY29uc3QgbGlua2VyTW9kdWxlID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJyk+KFxuICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXInLFxuICAgICk7XG4gICAgbmVlZHNMaW5raW5nID0gbGlua2VyTW9kdWxlLm5lZWRzTGlua2luZztcbiAgfVxuXG4gIHJldHVybiBuZWVkc0xpbmtpbmcocGF0aCwgc291cmNlKTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBkZWZhdWx0IGN1c3RvbTxBcHBsaWNhdGlvblByZXNldE9wdGlvbnM+KCgpID0+IHtcbiAgY29uc3QgYmFzZU9wdGlvbnMgPSBPYmplY3QuZnJlZXplKHtcbiAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBjb21wYWN0OiBmYWxzZSxcbiAgICBjYWNoZUNvbXByZXNzaW9uOiBmYWxzZSxcbiAgICBzb3VyY2VUeXBlOiAndW5hbWJpZ3VvdXMnLFxuICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhc3luYyBjdXN0b21PcHRpb25zKG9wdGlvbnMsIHsgc291cmNlLCBtYXAgfSkge1xuICAgICAgY29uc3Qge1xuICAgICAgICBpMThuLFxuICAgICAgICBzY3JpcHRUYXJnZXQsXG4gICAgICAgIGFvdCxcbiAgICAgICAgb3B0aW1pemUsXG4gICAgICAgIGluc3RydW1lbnRDb2RlLFxuICAgICAgICBzdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgLi4ucmF3T3B0aW9uc1xuICAgICAgfSA9IG9wdGlvbnMgYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucztcblxuICAgICAgLy8gTXVzdCBwcm9jZXNzIGZpbGUgaWYgcGx1Z2lucyBhcmUgYWRkZWRcbiAgICAgIGxldCBzaG91bGRQcm9jZXNzID0gQXJyYXkuaXNBcnJheShyYXdPcHRpb25zLnBsdWdpbnMpICYmIHJhd09wdGlvbnMucGx1Z2lucy5sZW5ndGggPiAwO1xuXG4gICAgICBjb25zdCBjdXN0b21PcHRpb25zOiBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMgPSB7XG4gICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbjogZmFsc2UsXG4gICAgICAgIGZvcmNlUHJlc2V0RW52OiBmYWxzZSxcbiAgICAgICAgYW5ndWxhckxpbmtlcjogdW5kZWZpbmVkLFxuICAgICAgICBpMThuOiB1bmRlZmluZWQsXG4gICAgICAgIGluc3RydW1lbnRDb2RlOiB1bmRlZmluZWQsXG4gICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgfTtcblxuICAgICAgLy8gQW5hbHl6ZSBmaWxlIGZvciBsaW5raW5nXG4gICAgICBpZiAoYXdhaXQgcmVxdWlyZXNMaW5raW5nKHRoaXMucmVzb3VyY2VQYXRoLCBzb3VyY2UpKSB7XG4gICAgICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yID8/PSAoXG4gICAgICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnLFxuICAgICAgICAgIClcbiAgICAgICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5hbmd1bGFyTGlua2VyID0ge1xuICAgICAgICAgIHNob3VsZExpbms6IHRydWUsXG4gICAgICAgICAgaml0TW9kZTogYW90ICE9PSB0cnVlLFxuICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgIH07XG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBbmFseXplIGZvciBFUyB0YXJnZXQgcHJvY2Vzc2luZ1xuICAgICAgY29uc3QgZXNUYXJnZXQgPSBzY3JpcHRUYXJnZXQgYXMgU2NyaXB0VGFyZ2V0IHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgaXNKc0ZpbGUgPSAvXFwuW2NtXT9qcyQvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpO1xuXG4gICAgICAvLyBUaGUgYmVsb3cgc2hvdWxkIGJlIGRyb3BwZWQgd2hlbiB3ZSBubyBsb25nZXIgc3VwcG9ydCBFUzUgVHlwZVNjcmlwdCBvdXRwdXQuXG4gICAgICBpZiAoZXNUYXJnZXQgPT09IFNjcmlwdFRhcmdldC5FUzUpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSB3aGVuIHRhcmdldCBpcyBFUzUgd2UgY2hhbmdlIHRoZSBUeXBlU2NyaXB0IHRhcmdldCB0byBFUzIwMTVcbiAgICAgICAgLy8gYmVjYXVzZSBpdCBzaW1wbGlmaWVzIGJ1aWxkLW9wdGltaXphdGlvbiBwYXNzZXMuXG4gICAgICAgIC8vIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvYmxvYi8yMmFmNjUyMDgzNDE3MWQwMTQxM2Q0YzdlNGE5ZjEzZmI3NTIyNTJlL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy90eXBlc2NyaXB0LnRzI0w1MS1MNTZcbiAgICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZVByZXNldEVudiA9IHRydWU7XG4gICAgICAgIC8vIENvbXBhcmFibGUgYmVoYXZpb3IgdG8gdHNjb25maWcgdGFyZ2V0IG9mIEVTNVxuICAgICAgICBjdXN0b21PcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzID0gWydJRSA5J107XG4gICAgICB9IGVsc2UgaWYgKGlzSnNGaWxlKSB7XG4gICAgICAgIC8vIEFwcGxpY2F0aW9ucyBjb2RlIEVTIHZlcnNpb24gY2FuIGJlIGNvbnRyb2xsZWQgdXNpbmcgVHlwZVNjcmlwdCdzIGB0YXJnZXRgIG9wdGlvbi5cbiAgICAgICAgLy8gSG93ZXZlciwgdGhpcyBkb2Vzbid0IGVmZmVjdCBsaWJyYXJpZXMgYW5kIGhlbmNlIHdlIHVzZSBwcmVzZXQtZW52IHRvIGRvd25sZXZlbCBFUyBmZXRhdXJlc1xuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgc3VwcG9ydGVkIGJyb3dzZXJzIGluIGJyb3dzZXJsaXN0LlxuICAgICAgICBjdXN0b21PcHRpb25zLmZvcmNlUHJlc2V0RW52ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKChlc1RhcmdldCAhPT0gdW5kZWZpbmVkICYmIGVzVGFyZ2V0ID49IFNjcmlwdFRhcmdldC5FUzIwMTcpIHx8IGlzSnNGaWxlKSB7XG4gICAgICAgIC8vIEFwcGxpY2F0aW9uIGNvZGUgKFRTIGZpbGVzKSB3aWxsIG9ubHkgY29udGFpbiBuYXRpdmUgYXN5bmMgaWYgdGFyZ2V0IGlzIEVTMjAxNysuXG4gICAgICAgIC8vIEhvd2V2ZXIsIHRoaXJkLXBhcnR5IGxpYnJhcmllcyBjYW4gcmVnYXJkbGVzcyBvZiB0aGUgdGFyZ2V0IG9wdGlvbi5cbiAgICAgICAgLy8gQVBGIHBhY2thZ2VzIHdpdGggY29kZSBpbiBbZl1lc20yMDE1IGRpcmVjdG9yaWVzIGlzIGRvd25sZXZlbGxlZCB0byBFUzIwMTUgYW5kXG4gICAgICAgIC8vIHdpbGwgbm90IGhhdmUgbmF0aXZlIGFzeW5jLlxuICAgICAgICBjdXN0b21PcHRpb25zLmZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiA9XG4gICAgICAgICAgIS9bXFxcXC9dW19mXT9lc20yMDE1W1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiYgc291cmNlLmluY2x1ZGVzKCdhc3luYycpO1xuICAgICAgfVxuXG4gICAgICBzaG91bGRQcm9jZXNzIHx8PVxuICAgICAgICBjdXN0b21PcHRpb25zLmZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiB8fCBjdXN0b21PcHRpb25zLmZvcmNlUHJlc2V0RW52IHx8IGZhbHNlO1xuXG4gICAgICAvLyBBbmFseXplIGZvciBpMThuIGlubGluaW5nXG4gICAgICBpZiAoXG4gICAgICAgIGkxOG4gJiZcbiAgICAgICAgIS9bXFxcXC9dQGFuZ3VsYXJbXFxcXC9dKD86Y29tcGlsZXJ8bG9jYWxpemUpLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICBzb3VyY2UuaW5jbHVkZXMoJyRsb2NhbGl6ZScpXG4gICAgICApIHtcbiAgICAgICAgLy8gTG9hZCB0aGUgaTE4biBwbHVnaW4gY3JlYXRvcnMgZnJvbSB0aGUgbmV3IGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgZW50cnkgcG9pbnQuXG4gICAgICAgIC8vIFRoaXMgbWF5IGZhaWwgZHVyaW5nIHRoZSB0cmFuc2l0aW9uIHRvIEVTTSBkdWUgdG8gdGhlIGVudHJ5IHBvaW50IG5vdCB5ZXQgZXhpc3RpbmcuXG4gICAgICAgIC8vIER1cmluZyB0aGUgdHJhbnNpdGlvbiwgdGhpcyB3aWxsIGFsd2F5cyBhdHRlbXB0IHRvIGxvYWQgdGhlIGVudHJ5IHBvaW50IGZvciBlYWNoIGZpbGUuXG4gICAgICAgIC8vIFRoaXMgd2lsbCBvbmx5IG9jY3VyIGR1cmluZyBwcmVyZWxlYXNlIGFuZCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgY29ycmVjdGVkIG9uY2UgdGhlIG5ld1xuICAgICAgICAvLyBlbnRyeSBwb2ludCBleGlzdHMuXG4gICAgICAgIGlmIChpMThuUGx1Z2luQ3JlYXRvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgICAgaTE4blBsdWdpbkNyZWF0b3JzID0gYXdhaXQgbG9hZEVzbU1vZHVsZTxJMThuUGx1Z2luQ3JlYXRvcnM+KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5pMThuID0ge1xuICAgICAgICAgIC4uLihpMThuIGFzIE5vbk51bGxhYmxlPEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9uc1snaTE4biddPiksXG4gICAgICAgICAgcGx1Z2luQ3JlYXRvcnM6IGkxOG5QbHVnaW5DcmVhdG9ycyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgdHJhbnNsYXRpb24gZmlsZXMgYXMgZGVwZW5kZW5jaWVzIG9mIHRoZSBmaWxlIHRvIHN1cHBvcnQgcmVidWlsZHNcbiAgICAgICAgLy8gRXhjZXB0IGZvciBgQGFuZ3VsYXIvY29yZWAgd2hpY2ggbmVlZHMgbG9jYWxlIGluamVjdGlvbiBidXQgaGFzIG5vIHRyYW5zbGF0aW9uc1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY3VzdG9tT3B0aW9ucy5pMThuLnRyYW5zbGF0aW9uRmlsZXMgJiZcbiAgICAgICAgICAhL1tcXFxcL11AYW5ndWxhcltcXFxcL11jb3JlLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKVxuICAgICAgICApIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgY3VzdG9tT3B0aW9ucy5pMThuLnRyYW5zbGF0aW9uRmlsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkRGVwZW5kZW5jeShmaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzaG91bGRQcm9jZXNzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGltaXplKSB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKTtcbiAgICAgICAgY3VzdG9tT3B0aW9ucy5vcHRpbWl6ZSA9IHtcbiAgICAgICAgICAvLyBBbmd1bGFyIHBhY2thZ2VzIHByb3ZpZGUgYWRkaXRpb25hbCB0ZXN0ZWQgc2lkZSBlZmZlY3RzIGd1YXJhbnRlZXMgYW5kIGNhbiB1c2VcbiAgICAgICAgICAvLyBvdGhlcndpc2UgdW5zYWZlIG9wdGltaXphdGlvbnMuXG4gICAgICAgICAgbG9vc2VFbnVtczogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgcHVyZVRvcExldmVsOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAvLyBKYXZhU2NyaXB0IG1vZHVsZXMgdGhhdCBhcmUgbWFya2VkIGFzIHNpZGUgZWZmZWN0IGZyZWUgYXJlIGNvbnNpZGVyZWQgdG8gaGF2ZVxuICAgICAgICAgIC8vIG5vIGRlY29yYXRvcnMgdGhhdCBjb250YWluIG5vbi1sb2NhbCBlZmZlY3RzLlxuICAgICAgICAgIHdyYXBEZWNvcmF0b3JzOiAhIXRoaXMuX21vZHVsZT8uZmFjdG9yeU1ldGE/LnNpZGVFZmZlY3RGcmVlLFxuICAgICAgICB9O1xuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIGluc3RydW1lbnRDb2RlICYmXG4gICAgICAgICFpbnN0cnVtZW50Q29kZS5leGNsdWRlZFBhdGhzLmhhcyh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgIS9cXC4oZTJlfHNwZWMpXFwudHN4PyR8W1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpICYmXG4gICAgICAgIHRoaXMucmVzb3VyY2VQYXRoLnN0YXJ0c1dpdGgoaW5zdHJ1bWVudENvZGUuaW5jbHVkZWRCYXNlUGF0aClcbiAgICAgICkge1xuICAgICAgICAvLyBgYmFiZWwtcGx1Z2luLWlzdGFuYnVsYCBoYXMgaXQncyBvd24gaW5jbHVkZXMgYnV0IHdlIGRvIHRoZSBiZWxvdyBzbyB0aGF0IHdlIGF2b2lkIHJ1bm5pbmcgdGhlIHRoZSBsb2FkZXIuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuaW5zdHJ1bWVudENvZGUgPSB7XG4gICAgICAgICAgaW5jbHVkZWRCYXNlUGF0aDogaW5zdHJ1bWVudENvZGUuaW5jbHVkZWRCYXNlUGF0aCxcbiAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogbWFwLFxuICAgICAgICB9O1xuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgcHJvdmlkZWQgbG9hZGVyIG9wdGlvbnMgdG8gZGVmYXVsdCBiYXNlIG9wdGlvbnNcbiAgICAgIGNvbnN0IGxvYWRlck9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAuLi5iYXNlT3B0aW9ucyxcbiAgICAgICAgLi4ucmF3T3B0aW9ucyxcbiAgICAgICAgY2FjaGVJZGVudGlmaWVyOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYnVpbGRBbmd1bGFyOiBWRVJTSU9OLFxuICAgICAgICAgIGN1c3RvbU9wdGlvbnMsXG4gICAgICAgICAgYmFzZU9wdGlvbnMsXG4gICAgICAgICAgcmF3T3B0aW9ucyxcbiAgICAgICAgfSksXG4gICAgICB9O1xuXG4gICAgICAvLyBTa2lwIGJhYmVsIHByb2Nlc3NpbmcgaWYgbm8gYWN0aW9ucyBhcmUgbmVlZGVkXG4gICAgICBpZiAoIXNob3VsZFByb2Nlc3MpIHtcbiAgICAgICAgLy8gRm9yY2UgdGhlIGN1cnJlbnQgZmlsZSB0byBiZSBpZ25vcmVkXG4gICAgICAgIGxvYWRlck9wdGlvbnMuaWdub3JlID0gWygpID0+IHRydWVdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBjdXN0b206IGN1c3RvbU9wdGlvbnMsIGxvYWRlcjogbG9hZGVyT3B0aW9ucyB9O1xuICAgIH0sXG4gICAgY29uZmlnKGNvbmZpZ3VyYXRpb24sIHsgY3VzdG9tT3B0aW9ucyB9KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5jb25maWd1cmF0aW9uLm9wdGlvbnMsXG4gICAgICAgIC8vIFVzaW5nIGBmYWxzZWAgZGlzYWJsZXMgYmFiZWwgZnJvbSBhdHRlbXB0aW5nIHRvIGxvY2F0ZSBzb3VyY2VtYXBzIG9yIHByb2Nlc3MgYW55IGlubGluZSBtYXBzLlxuICAgICAgICAvLyBUaGUgYmFiZWwgdHlwZXMgZG8gbm90IGluY2x1ZGUgdGhlIGZhbHNlIG9wdGlvbiBldmVuIHRob3VnaCBpdCBpcyB2YWxpZFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICBpbnB1dFNvdXJjZU1hcDogY29uZmlndXJhdGlvbi5vcHRpb25zLmlucHV0U291cmNlTWFwID8/IChmYWxzZSBhcyBhbnkpLFxuICAgICAgICBwcmVzZXRzOiBbXG4gICAgICAgICAgLi4uKGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5wcmVzZXRzIHx8IFtdKSxcbiAgICAgICAgICBbXG4gICAgICAgICAgICByZXF1aXJlKCcuL3ByZXNldHMvYXBwbGljYXRpb24nKS5kZWZhdWx0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAuLi5jdXN0b21PcHRpb25zLFxuICAgICAgICAgICAgICBkaWFnbm9zdGljUmVwb3J0ZXI6ICh0eXBlLCBtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2luZm8nOlxuICAgICAgICAgICAgICAgICAgLy8gV2VicGFjayBkb2VzIG5vdCBjdXJyZW50bHkgaGF2ZSBhbiBpbmZvcm1hdGlvbmFsIGRpYWdub3N0aWNcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ3dhcm5pbmcnOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRXYXJuaW5nKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9IGFzIEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucyxcbiAgICAgICAgICBdLFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9LFxuICB9O1xufSk7XG4iXX0=