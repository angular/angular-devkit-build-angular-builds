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
            var _a, _b, _c;
            const { i18n, aot, optimize, instrumentCode, supportedBrowsers, ...rawOptions } = options;
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
            if ((_a = customOptions.supportedBrowsers) === null || _a === void 0 ? void 0 : _a.length) {
                // Applications code ES version can be controlled using TypeScript's `target` option.
                // However, this doesn't effect libraries and hence we use preset-env to downlevel ES fetaures
                // based on the supported browsers in browserlist.
                customOptions.forcePresetEnv = true;
            }
            // Application code (TS files) will only contain native async if target is ES2017+.
            // However, third-party libraries can regardless of the target option.
            // APF packages with code in [f]esm2015 directories is downlevelled to ES2015 and
            // will not have native async.
            customOptions.forceAsyncTransformation =
                !/[\\/][_f]?esm2015[\\/]/.test(this.resourcePath) && source.includes('async');
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
                    wrapDecorators: !!((_c = (_b = this._module) === null || _b === void 0 ? void 0 : _b.factoryMeta) === null || _c === void 0 ? void 0 : _c.sideEffectFree),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBc0M7QUFDdEMsZ0RBQWtEO0FBQ2xELDhEQUFtRDtBQWFuRDs7R0FFRztBQUNILElBQUksWUFBb0YsQ0FBQztBQUV6Rjs7R0FFRztBQUNILElBQUksbUJBRVMsQ0FBQztBQUVkOztHQUVHO0FBQ0gsSUFBSSxrQkFBa0QsQ0FBQztBQUVoRCxLQUFLLFVBQVUsZUFBZSxDQUFDLElBQVksRUFBRSxNQUFjO0lBQ2hFLGlFQUFpRTtJQUNqRSxnREFBZ0Q7SUFDaEQsSUFBSSw2Q0FBNkMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDNUQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDakIsMEZBQTBGO1FBQzFGLHlGQUF5RjtRQUN6RixzQ0FBc0M7UUFDdEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFBLHdCQUFhLEVBQ3RDLDhCQUE4QixDQUMvQixDQUFDO1FBQ0YsWUFBWSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUM7S0FDMUM7SUFFRCxPQUFPLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQWxCRCwwQ0FrQkM7QUFFRCxrREFBa0Q7QUFDbEQsa0JBQWUsSUFBQSxxQkFBTSxFQUEyQixHQUFHLEVBQUU7SUFDbkQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNoQyxPQUFPLEVBQUUsS0FBSztRQUNkLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLE9BQU8sRUFBRSxLQUFLO1FBQ2QsZ0JBQWdCLEVBQUUsS0FBSztRQUN2QixVQUFV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O2FBQ0YsQ0FBQztRQUNKLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgY3VzdG9tIH0gZnJvbSAnYmFiZWwtbG9hZGVyJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSAnLi4vdXRpbHMvcGFja2FnZS12ZXJzaW9uJztcbmltcG9ydCB7IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucywgSTE4blBsdWdpbkNyZWF0b3JzIH0gZnJvbSAnLi9wcmVzZXRzL2FwcGxpY2F0aW9uJztcblxuaW50ZXJmYWNlIEFuZ3VsYXJDdXN0b21PcHRpb25zIGV4dGVuZHMgT21pdDxBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsICdpbnN0cnVtZW50Q29kZSc+IHtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgLyoqIG5vZGVfbW9kdWxlcyBhbmQgdGVzdCBmaWxlcyBhcmUgYWx3YXlzIGV4Y2x1ZGVkLiAqL1xuICAgIGV4Y2x1ZGVkUGF0aHM6IFNldDxTdHJpbmc+O1xuICAgIGluY2x1ZGVkQmFzZVBhdGg6IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IHR5cGUgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyA9IEFuZ3VsYXJDdXN0b21PcHRpb25zICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjb21waWxlci1jbGkgbGlua2VyJ3MgbmVlZHNMaW5raW5nIGZ1bmN0aW9uLlxuICovXG5sZXQgbmVlZHNMaW5raW5nOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJykubmVlZHNMaW5raW5nIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgY29tcGlsZXItY2xpIGxpbmtlcidzIEJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uLlxuICovXG5sZXQgbGlua2VyUGx1Z2luQ3JlYXRvcjpcbiAgfCB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4gIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgbG9jYWxpemUgQmFiZWwgcGx1Z2lucyBmYWN0b3J5IGZ1bmN0aW9ucy5cbiAqL1xubGV0IGkxOG5QbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVxdWlyZXNMaW5raW5nKHBhdGg6IHN0cmluZywgc291cmNlOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgLy8gQGFuZ3VsYXIvY29yZSBhbmQgQGFuZ3VsYXIvY29tcGlsZXIgd2lsbCBjYXVzZSBmYWxzZSBwb3NpdGl2ZXNcbiAgLy8gQWxzbywgVHlwZVNjcmlwdCBmaWxlcyBkbyBub3QgcmVxdWlyZSBsaW5raW5nXG4gIGlmICgvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXSg/OmNvbXBpbGVyfGNvcmUpfFxcLnRzeD8kLy50ZXN0KHBhdGgpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCFuZWVkc0xpbmtpbmcpIHtcbiAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcmAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgY29uc3QgbGlua2VyTW9kdWxlID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJyk+KFxuICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXInLFxuICAgICk7XG4gICAgbmVlZHNMaW5raW5nID0gbGlua2VyTW9kdWxlLm5lZWRzTGlua2luZztcbiAgfVxuXG4gIHJldHVybiBuZWVkc0xpbmtpbmcocGF0aCwgc291cmNlKTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBkZWZhdWx0IGN1c3RvbTxBcHBsaWNhdGlvblByZXNldE9wdGlvbnM+KCgpID0+IHtcbiAgY29uc3QgYmFzZU9wdGlvbnMgPSBPYmplY3QuZnJlZXplKHtcbiAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBjb21wYWN0OiBmYWxzZSxcbiAgICBjYWNoZUNvbXByZXNzaW9uOiBmYWxzZSxcbiAgICBzb3VyY2VUeXBlOiAndW5hbWJpZ3VvdXMnLFxuICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhc3luYyBjdXN0b21PcHRpb25zKG9wdGlvbnMsIHsgc291cmNlLCBtYXAgfSkge1xuICAgICAgY29uc3QgeyBpMThuLCBhb3QsIG9wdGltaXplLCBpbnN0cnVtZW50Q29kZSwgc3VwcG9ydGVkQnJvd3NlcnMsIC4uLnJhd09wdGlvbnMgfSA9XG4gICAgICAgIG9wdGlvbnMgYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucztcblxuICAgICAgLy8gTXVzdCBwcm9jZXNzIGZpbGUgaWYgcGx1Z2lucyBhcmUgYWRkZWRcbiAgICAgIGxldCBzaG91bGRQcm9jZXNzID0gQXJyYXkuaXNBcnJheShyYXdPcHRpb25zLnBsdWdpbnMpICYmIHJhd09wdGlvbnMucGx1Z2lucy5sZW5ndGggPiAwO1xuXG4gICAgICBjb25zdCBjdXN0b21PcHRpb25zOiBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMgPSB7XG4gICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbjogZmFsc2UsXG4gICAgICAgIGZvcmNlUHJlc2V0RW52OiBmYWxzZSxcbiAgICAgICAgYW5ndWxhckxpbmtlcjogdW5kZWZpbmVkLFxuICAgICAgICBpMThuOiB1bmRlZmluZWQsXG4gICAgICAgIGluc3RydW1lbnRDb2RlOiB1bmRlZmluZWQsXG4gICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgfTtcblxuICAgICAgLy8gQW5hbHl6ZSBmaWxlIGZvciBsaW5raW5nXG4gICAgICBpZiAoYXdhaXQgcmVxdWlyZXNMaW5raW5nKHRoaXMucmVzb3VyY2VQYXRoLCBzb3VyY2UpKSB7XG4gICAgICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yID8/PSAoXG4gICAgICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnLFxuICAgICAgICAgIClcbiAgICAgICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5hbmd1bGFyTGlua2VyID0ge1xuICAgICAgICAgIHNob3VsZExpbms6IHRydWUsXG4gICAgICAgICAgaml0TW9kZTogYW90ICE9PSB0cnVlLFxuICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgIH07XG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBbmFseXplIGZvciBFUyB0YXJnZXQgcHJvY2Vzc2luZ1xuICAgICAgaWYgKGN1c3RvbU9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnM/Lmxlbmd0aCkge1xuICAgICAgICAvLyBBcHBsaWNhdGlvbnMgY29kZSBFUyB2ZXJzaW9uIGNhbiBiZSBjb250cm9sbGVkIHVzaW5nIFR5cGVTY3JpcHQncyBgdGFyZ2V0YCBvcHRpb24uXG4gICAgICAgIC8vIEhvd2V2ZXIsIHRoaXMgZG9lc24ndCBlZmZlY3QgbGlicmFyaWVzIGFuZCBoZW5jZSB3ZSB1c2UgcHJlc2V0LWVudiB0byBkb3dubGV2ZWwgRVMgZmV0YXVyZXNcbiAgICAgICAgLy8gYmFzZWQgb24gdGhlIHN1cHBvcnRlZCBicm93c2VycyBpbiBicm93c2VybGlzdC5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZVByZXNldEVudiA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGxpY2F0aW9uIGNvZGUgKFRTIGZpbGVzKSB3aWxsIG9ubHkgY29udGFpbiBuYXRpdmUgYXN5bmMgaWYgdGFyZ2V0IGlzIEVTMjAxNysuXG4gICAgICAvLyBIb3dldmVyLCB0aGlyZC1wYXJ0eSBsaWJyYXJpZXMgY2FuIHJlZ2FyZGxlc3Mgb2YgdGhlIHRhcmdldCBvcHRpb24uXG4gICAgICAvLyBBUEYgcGFja2FnZXMgd2l0aCBjb2RlIGluIFtmXWVzbTIwMTUgZGlyZWN0b3JpZXMgaXMgZG93bmxldmVsbGVkIHRvIEVTMjAxNSBhbmRcbiAgICAgIC8vIHdpbGwgbm90IGhhdmUgbmF0aXZlIGFzeW5jLlxuICAgICAgY3VzdG9tT3B0aW9ucy5mb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgICAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJiBzb3VyY2UuaW5jbHVkZXMoJ2FzeW5jJyk7XG5cbiAgICAgIHNob3VsZFByb2Nlc3MgfHw9XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uIHx8IGN1c3RvbU9wdGlvbnMuZm9yY2VQcmVzZXRFbnYgfHwgZmFsc2U7XG5cbiAgICAgIC8vIEFuYWx5emUgZm9yIGkxOG4gaW5saW5pbmdcbiAgICAgIGlmIChcbiAgICAgICAgaTE4biAmJlxuICAgICAgICAhL1tcXFxcL11AYW5ndWxhcltcXFxcL10oPzpjb21waWxlcnxsb2NhbGl6ZSkvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpICYmXG4gICAgICAgIHNvdXJjZS5pbmNsdWRlcygnJGxvY2FsaXplJylcbiAgICAgICkge1xuICAgICAgICAvLyBMb2FkIHRoZSBpMThuIHBsdWdpbiBjcmVhdG9ycyBmcm9tIHRoZSBuZXcgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBlbnRyeSBwb2ludC5cbiAgICAgICAgLy8gVGhpcyBtYXkgZmFpbCBkdXJpbmcgdGhlIHRyYW5zaXRpb24gdG8gRVNNIGR1ZSB0byB0aGUgZW50cnkgcG9pbnQgbm90IHlldCBleGlzdGluZy5cbiAgICAgICAgLy8gRHVyaW5nIHRoZSB0cmFuc2l0aW9uLCB0aGlzIHdpbGwgYWx3YXlzIGF0dGVtcHQgdG8gbG9hZCB0aGUgZW50cnkgcG9pbnQgZm9yIGVhY2ggZmlsZS5cbiAgICAgICAgLy8gVGhpcyB3aWxsIG9ubHkgb2NjdXIgZHVyaW5nIHByZXJlbGVhc2UgYW5kIHdpbGwgYmUgYXV0b21hdGljYWxseSBjb3JyZWN0ZWQgb25jZSB0aGUgbmV3XG4gICAgICAgIC8vIGVudHJ5IHBvaW50IGV4aXN0cy5cbiAgICAgICAgaWYgKGkxOG5QbHVnaW5DcmVhdG9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICBpMThuUGx1Z2luQ3JlYXRvcnMgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPEkxOG5QbHVnaW5DcmVhdG9ycz4oJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjdXN0b21PcHRpb25zLmkxOG4gPSB7XG4gICAgICAgICAgLi4uKGkxOG4gYXMgTm9uTnVsbGFibGU8QXBwbGljYXRpb25QcmVzZXRPcHRpb25zWydpMThuJ10+KSxcbiAgICAgICAgICBwbHVnaW5DcmVhdG9yczogaTE4blBsdWdpbkNyZWF0b3JzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCB0cmFuc2xhdGlvbiBmaWxlcyBhcyBkZXBlbmRlbmNpZXMgb2YgdGhlIGZpbGUgdG8gc3VwcG9ydCByZWJ1aWxkc1xuICAgICAgICAvLyBFeGNlcHQgZm9yIGBAYW5ndWxhci9jb3JlYCB3aGljaCBuZWVkcyBsb2NhbGUgaW5qZWN0aW9uIGJ1dCBoYXMgbm8gdHJhbnNsYXRpb25zXG4gICAgICAgIGlmIChcbiAgICAgICAgICBjdXN0b21PcHRpb25zLmkxOG4udHJhbnNsYXRpb25GaWxlcyAmJlxuICAgICAgICAgICEvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWNvcmUvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpXG4gICAgICAgICkge1xuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBjdXN0b21PcHRpb25zLmkxOG4udHJhbnNsYXRpb25GaWxlcykge1xuICAgICAgICAgICAgdGhpcy5hZGREZXBlbmRlbmN5KGZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW1pemUpIHtcbiAgICAgICAgY29uc3QgYW5ndWxhclBhY2thZ2UgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL10vLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpO1xuICAgICAgICBjdXN0b21PcHRpb25zLm9wdGltaXplID0ge1xuICAgICAgICAgIC8vIEFuZ3VsYXIgcGFja2FnZXMgcHJvdmlkZSBhZGRpdGlvbmFsIHRlc3RlZCBzaWRlIGVmZmVjdHMgZ3VhcmFudGVlcyBhbmQgY2FuIHVzZVxuICAgICAgICAgIC8vIG90aGVyd2lzZSB1bnNhZmUgb3B0aW1pemF0aW9ucy5cbiAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIC8vIEphdmFTY3JpcHQgbW9kdWxlcyB0aGF0IGFyZSBtYXJrZWQgYXMgc2lkZSBlZmZlY3QgZnJlZSBhcmUgY29uc2lkZXJlZCB0byBoYXZlXG4gICAgICAgICAgLy8gbm8gZGVjb3JhdG9ycyB0aGF0IGNvbnRhaW4gbm9uLWxvY2FsIGVmZmVjdHMuXG4gICAgICAgICAgd3JhcERlY29yYXRvcnM6ICEhdGhpcy5fbW9kdWxlPy5mYWN0b3J5TWV0YT8uc2lkZUVmZmVjdEZyZWUsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgaW5zdHJ1bWVudENvZGUgJiZcbiAgICAgICAgIWluc3RydW1lbnRDb2RlLmV4Y2x1ZGVkUGF0aHMuaGFzKHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICAhL1xcLihlMmV8c3BlYylcXC50c3g/JHxbXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgdGhpcy5yZXNvdXJjZVBhdGguc3RhcnRzV2l0aChpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoKVxuICAgICAgKSB7XG4gICAgICAgIC8vIGBiYWJlbC1wbHVnaW4taXN0YW5idWxgIGhhcyBpdCdzIG93biBpbmNsdWRlcyBidXQgd2UgZG8gdGhlIGJlbG93IHNvIHRoYXQgd2UgYXZvaWQgcnVubmluZyB0aGUgdGhlIGxvYWRlci5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5pbnN0cnVtZW50Q29kZSA9IHtcbiAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoLFxuICAgICAgICAgIGlucHV0U291cmNlTWFwOiBtYXAsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBwcm92aWRlZCBsb2FkZXIgb3B0aW9ucyB0byBkZWZhdWx0IGJhc2Ugb3B0aW9uc1xuICAgICAgY29uc3QgbG9hZGVyT3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgIC4uLmJhc2VPcHRpb25zLFxuICAgICAgICAuLi5yYXdPcHRpb25zLFxuICAgICAgICBjYWNoZUlkZW50aWZpZXI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBidWlsZEFuZ3VsYXI6IFZFUlNJT04sXG4gICAgICAgICAgY3VzdG9tT3B0aW9ucyxcbiAgICAgICAgICBiYXNlT3B0aW9ucyxcbiAgICAgICAgICByYXdPcHRpb25zLFxuICAgICAgICB9KSxcbiAgICAgIH07XG5cbiAgICAgIC8vIFNraXAgYmFiZWwgcHJvY2Vzc2luZyBpZiBubyBhY3Rpb25zIGFyZSBuZWVkZWRcbiAgICAgIGlmICghc2hvdWxkUHJvY2Vzcykge1xuICAgICAgICAvLyBGb3JjZSB0aGUgY3VycmVudCBmaWxlIHRvIGJlIGlnbm9yZWRcbiAgICAgICAgbG9hZGVyT3B0aW9ucy5pZ25vcmUgPSBbKCkgPT4gdHJ1ZV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IGN1c3RvbTogY3VzdG9tT3B0aW9ucywgbG9hZGVyOiBsb2FkZXJPcHRpb25zIH07XG4gICAgfSxcbiAgICBjb25maWcoY29uZmlndXJhdGlvbiwgeyBjdXN0b21PcHRpb25zIH0pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmNvbmZpZ3VyYXRpb24ub3B0aW9ucyxcbiAgICAgICAgLy8gVXNpbmcgYGZhbHNlYCBkaXNhYmxlcyBiYWJlbCBmcm9tIGF0dGVtcHRpbmcgdG8gbG9jYXRlIHNvdXJjZW1hcHMgb3IgcHJvY2VzcyBhbnkgaW5saW5lIG1hcHMuXG4gICAgICAgIC8vIFRoZSBiYWJlbCB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIGlucHV0U291cmNlTWFwOiBjb25maWd1cmF0aW9uLm9wdGlvbnMuaW5wdXRTb3VyY2VNYXAgPz8gKGZhbHNlIGFzIGFueSksXG4gICAgICAgIHByZXNldHM6IFtcbiAgICAgICAgICAuLi4oY29uZmlndXJhdGlvbi5vcHRpb25zLnByZXNldHMgfHwgW10pLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIHJlcXVpcmUoJy4vcHJlc2V0cy9hcHBsaWNhdGlvbicpLmRlZmF1bHQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIC4uLmN1c3RvbU9wdGlvbnMsXG4gICAgICAgICAgICAgIGRpYWdub3N0aWNSZXBvcnRlcjogKHR5cGUsIG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0RXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnaW5mbyc6XG4gICAgICAgICAgICAgICAgICAvLyBXZWJwYWNrIGRvZXMgbm90IGN1cnJlbnRseSBoYXZlIGFuIGluZm9ybWF0aW9uYWwgZGlhZ25vc3RpY1xuICAgICAgICAgICAgICAgICAgY2FzZSAnd2FybmluZyc6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFdhcm5pbmcobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0gYXMgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zLFxuICAgICAgICAgIF0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH0sXG4gIH07XG59KTtcbiJdfQ==