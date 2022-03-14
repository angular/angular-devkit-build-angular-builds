"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const remapping_1 = __importDefault(require("@ampproject/remapping"));
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
            return {
                ...configuration.options,
                // Using `false` disables babel from attempting to locate sourcemaps or process any inline maps.
                // The babel types do not include the false option even though it is valid
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                inputSourceMap: false,
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
        result(result, { map: inputSourceMap }) {
            if (result.map && inputSourceMap) {
                // Merge the intermediate sourcemap generated by babel with the input source map.
                // The casting is required due to slight differences in the types for babel and
                // `@ampproject/remapping` source map objects but both are compatible with Webpack.
                // This method for merging is used because it provides more accurate output
                // and is faster while using less memory.
                result.map = {
                    // Convert the SourceMap back to simple plain object.
                    // This is needed because otherwise code-coverage will fail with `don't know how to turn this value into a node`
                    // Which is thrown by Babel if it is invoked again from `istanbul-lib-instrument`.
                    // https://github.com/babel/babel/blob/780aa48d2a34dc55f556843074b6aed45e7eabeb/packages/babel-types/src/converters/valueToNode.ts#L115-L130
                    ...(0, remapping_1.default)([result.map, inputSourceMap], () => null),
                };
            }
            return result;
        },
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7OztBQUVILHNFQUE4QztBQUM5QywrQ0FBc0M7QUFDdEMsMkNBQTBDO0FBQzFDLGdEQUFrRDtBQUNsRCw4REFBbUQ7QUFnQm5EOztHQUVHO0FBQ0gsSUFBSSxZQUFvRixDQUFDO0FBRXpGOztHQUVHO0FBQ0gsSUFBSSxtQkFFUyxDQUFDO0FBRWQ7O0dBRUc7QUFDSCxJQUFJLGtCQUFrRCxDQUFDO0FBRXZELEtBQUssVUFBVSxlQUFlLENBQUMsSUFBWSxFQUFFLE1BQWM7SUFDekQsaUVBQWlFO0lBQ2pFLGdEQUFnRDtJQUNoRCxJQUFJLDZDQUE2QyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUM1RCxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsSUFBSSxDQUFDLFlBQVksRUFBRTtRQUNqQiwwRkFBMEY7UUFDMUYseUZBQXlGO1FBQ3pGLHNDQUFzQztRQUN0QyxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUEsd0JBQWEsRUFDdEMsOEJBQThCLENBQy9CLENBQUM7UUFDRixZQUFZLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQztLQUMxQztJQUVELE9BQU8sWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBRUQsa0RBQWtEO0FBQ2xELGtCQUFlLElBQUEscUJBQU0sRUFBMkIsR0FBRyxFQUFFO0lBQ25ELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDaEMsT0FBTyxFQUFFLEtBQUs7UUFDZCxVQUFVLEVBQUUsS0FBSztRQUNqQixPQUFPLEVBQUUsS0FBSztRQUNkLGdCQUFnQixFQUFF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SUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3Q0FDMUIsTUFBTTtpQ0FDVDs0QkFDSCxDQUFDO3lCQUMwQjtxQkFDOUI7aUJBQ0Y7YUFDRixDQUFDO1FBQ0osQ0FBQztRQUNELE1BQU0sQ0FBQyxNQUFNLEVBQUUsRUFBRSxHQUFHLEVBQUUsY0FBYyxFQUFFO1lBQ3BDLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxjQUFjLEVBQUU7Z0JBQ2hDLGlGQUFpRjtnQkFDakYsK0VBQStFO2dCQUMvRSxtRkFBbUY7Z0JBQ25GLDJFQUEyRTtnQkFDM0UseUNBQXlDO2dCQUN6QyxNQUFNLENBQUMsR0FBRyxHQUFHO29CQUNYLHFEQUFxRDtvQkFDckQsZ0hBQWdIO29CQUNoSCxrRkFBa0Y7b0JBQ2xGLDRJQUE0STtvQkFDNUksR0FBSSxJQUFBLG1CQUFTLEVBQ1gsQ0FBQyxNQUFNLENBQUMsR0FBcUIsRUFBRSxjQUFnQyxDQUFDLEVBQ2hFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FDVztpQkFDeEIsQ0FBQzthQUNIO1lBRUQsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgcmVtYXBwaW5nIGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQgeyBjdXN0b20gfSBmcm9tICdiYWJlbC1sb2FkZXInO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uL3V0aWxzL3BhY2thZ2UtdmVyc2lvbic7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsIEkxOG5QbHVnaW5DcmVhdG9ycyB9IGZyb20gJy4vcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5cbmludGVyZmFjZSBBbmd1bGFyQ3VzdG9tT3B0aW9ucyBleHRlbmRzIE9taXQ8QXBwbGljYXRpb25QcmVzZXRPcHRpb25zLCAnaW5zdHJ1bWVudENvZGUnPiB7XG4gIGluc3RydW1lbnRDb2RlPzoge1xuICAgIC8qKiBub2RlX21vZHVsZXMgYW5kIHRlc3QgZmlsZXMgYXJlIGFsd2F5cyBleGNsdWRlZC4gKi9cbiAgICBleGNsdWRlZFBhdGhzOiBTZXQ8U3RyaW5nPjtcbiAgICBpbmNsdWRlZEJhc2VQYXRoOiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCB0eXBlIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgPSBBbmd1bGFyQ3VzdG9tT3B0aW9ucyAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG4vLyBFeHRyYWN0IFNvdXJjZW1hcCBpbnB1dCB0eXBlIGZyb20gdGhlIHJlbWFwcGluZyBmdW5jdGlvbiBzaW5jZSBpdCBpcyBub3QgY3VycmVudGx5IGV4cG9ydGVkXG50eXBlIFNvdXJjZU1hcElucHV0ID0gRXhjbHVkZTxQYXJhbWV0ZXJzPHR5cGVvZiByZW1hcHBpbmc+WzBdLCB1bmtub3duW10+O1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgY29tcGlsZXItY2xpIGxpbmtlcidzIG5lZWRzTGlua2luZyBmdW5jdGlvbi5cbiAqL1xubGV0IG5lZWRzTGlua2luZzogdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicpLm5lZWRzTGlua2luZyB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGNvbXBpbGVyLWNsaSBsaW5rZXIncyBCYWJlbCBwbHVnaW4gZmFjdG9yeSBmdW5jdGlvbi5cbiAqL1xubGV0IGxpbmtlclBsdWdpbkNyZWF0b3I6XG4gIHwgdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpblxuICB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGxvY2FsaXplIEJhYmVsIHBsdWdpbnMgZmFjdG9yeSBmdW5jdGlvbnMuXG4gKi9cbmxldCBpMThuUGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyB8IHVuZGVmaW5lZDtcblxuYXN5bmMgZnVuY3Rpb24gcmVxdWlyZXNMaW5raW5nKHBhdGg6IHN0cmluZywgc291cmNlOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgLy8gQGFuZ3VsYXIvY29yZSBhbmQgQGFuZ3VsYXIvY29tcGlsZXIgd2lsbCBjYXVzZSBmYWxzZSBwb3NpdGl2ZXNcbiAgLy8gQWxzbywgVHlwZVNjcmlwdCBmaWxlcyBkbyBub3QgcmVxdWlyZSBsaW5raW5nXG4gIGlmICgvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXSg/OmNvbXBpbGVyfGNvcmUpfFxcLnRzeD8kLy50ZXN0KHBhdGgpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCFuZWVkc0xpbmtpbmcpIHtcbiAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcmAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgY29uc3QgbGlua2VyTW9kdWxlID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJyk+KFxuICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXInLFxuICAgICk7XG4gICAgbmVlZHNMaW5raW5nID0gbGlua2VyTW9kdWxlLm5lZWRzTGlua2luZztcbiAgfVxuXG4gIHJldHVybiBuZWVkc0xpbmtpbmcocGF0aCwgc291cmNlKTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBkZWZhdWx0IGN1c3RvbTxBcHBsaWNhdGlvblByZXNldE9wdGlvbnM+KCgpID0+IHtcbiAgY29uc3QgYmFzZU9wdGlvbnMgPSBPYmplY3QuZnJlZXplKHtcbiAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBjb21wYWN0OiBmYWxzZSxcbiAgICBjYWNoZUNvbXByZXNzaW9uOiBmYWxzZSxcbiAgICBzb3VyY2VUeXBlOiAndW5hbWJpZ3VvdXMnLFxuICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhc3luYyBjdXN0b21PcHRpb25zKG9wdGlvbnMsIHsgc291cmNlLCBtYXAgfSkge1xuICAgICAgY29uc3QgeyBpMThuLCBzY3JpcHRUYXJnZXQsIGFvdCwgb3B0aW1pemUsIGluc3RydW1lbnRDb2RlLCAuLi5yYXdPcHRpb25zIH0gPVxuICAgICAgICBvcHRpb25zIGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnM7XG5cbiAgICAgIC8vIE11c3QgcHJvY2VzcyBmaWxlIGlmIHBsdWdpbnMgYXJlIGFkZGVkXG4gICAgICBsZXQgc2hvdWxkUHJvY2VzcyA9IEFycmF5LmlzQXJyYXkocmF3T3B0aW9ucy5wbHVnaW5zKSAmJiByYXdPcHRpb25zLnBsdWdpbnMubGVuZ3RoID4gMDtcblxuICAgICAgY29uc3QgY3VzdG9tT3B0aW9uczogQXBwbGljYXRpb25QcmVzZXRPcHRpb25zID0ge1xuICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb246IGZhbHNlLFxuICAgICAgICBmb3JjZUVTNTogZmFsc2UsXG4gICAgICAgIGFuZ3VsYXJMaW5rZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgaTE4bjogdW5kZWZpbmVkLFxuICAgICAgICBpbnN0cnVtZW50Q29kZTogdW5kZWZpbmVkLFxuICAgICAgfTtcblxuICAgICAgLy8gQW5hbHl6ZSBmaWxlIGZvciBsaW5raW5nXG4gICAgICBpZiAoYXdhaXQgcmVxdWlyZXNMaW5raW5nKHRoaXMucmVzb3VyY2VQYXRoLCBzb3VyY2UpKSB7XG4gICAgICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yID8/PSAoXG4gICAgICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnLFxuICAgICAgICAgIClcbiAgICAgICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5hbmd1bGFyTGlua2VyID0ge1xuICAgICAgICAgIHNob3VsZExpbms6IHRydWUsXG4gICAgICAgICAgaml0TW9kZTogYW90ICE9PSB0cnVlLFxuICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgIH07XG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBbmFseXplIGZvciBFUyB0YXJnZXQgcHJvY2Vzc2luZ1xuICAgICAgY29uc3QgZXNUYXJnZXQgPSBzY3JpcHRUYXJnZXQgYXMgU2NyaXB0VGFyZ2V0IHwgdW5kZWZpbmVkO1xuICAgICAgaWYgKGVzVGFyZ2V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGVzVGFyZ2V0IDwgU2NyaXB0VGFyZ2V0LkVTMjAxNSkge1xuICAgICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VFUzUgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGVzVGFyZ2V0ID49IFNjcmlwdFRhcmdldC5FUzIwMTcgfHwgL1xcLltjbV0/anMkLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSkge1xuICAgICAgICAgIC8vIEFwcGxpY2F0aW9uIGNvZGUgKFRTIGZpbGVzKSB3aWxsIG9ubHkgY29udGFpbiBuYXRpdmUgYXN5bmMgaWYgdGFyZ2V0IGlzIEVTMjAxNysuXG4gICAgICAgICAgLy8gSG93ZXZlciwgdGhpcmQtcGFydHkgbGlicmFyaWVzIGNhbiByZWdhcmRsZXNzIG9mIHRoZSB0YXJnZXQgb3B0aW9uLlxuICAgICAgICAgIC8vIEFQRiBwYWNrYWdlcyB3aXRoIGNvZGUgaW4gW2ZdZXNtMjAxNSBkaXJlY3RvcmllcyBpcyBkb3dubGV2ZWxsZWQgdG8gRVMyMDE1IGFuZFxuICAgICAgICAgIC8vIHdpbGwgbm90IGhhdmUgbmF0aXZlIGFzeW5jLlxuICAgICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID1cbiAgICAgICAgICAgICEvW1xcXFwvXVtfZl0/ZXNtMjAxNVtcXFxcL10vLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpICYmIHNvdXJjZS5pbmNsdWRlcygnYXN5bmMnKTtcbiAgICAgICAgfVxuICAgICAgICBzaG91bGRQcm9jZXNzIHx8PSBjdXN0b21PcHRpb25zLmZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiB8fCBjdXN0b21PcHRpb25zLmZvcmNlRVM1IHx8IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBBbmFseXplIGZvciBpMThuIGlubGluaW5nXG4gICAgICBpZiAoXG4gICAgICAgIGkxOG4gJiZcbiAgICAgICAgIS9bXFxcXC9dQGFuZ3VsYXJbXFxcXC9dKD86Y29tcGlsZXJ8bG9jYWxpemUpLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICBzb3VyY2UuaW5jbHVkZXMoJyRsb2NhbGl6ZScpXG4gICAgICApIHtcbiAgICAgICAgLy8gTG9hZCB0aGUgaTE4biBwbHVnaW4gY3JlYXRvcnMgZnJvbSB0aGUgbmV3IGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgZW50cnkgcG9pbnQuXG4gICAgICAgIC8vIFRoaXMgbWF5IGZhaWwgZHVyaW5nIHRoZSB0cmFuc2l0aW9uIHRvIEVTTSBkdWUgdG8gdGhlIGVudHJ5IHBvaW50IG5vdCB5ZXQgZXhpc3RpbmcuXG4gICAgICAgIC8vIER1cmluZyB0aGUgdHJhbnNpdGlvbiwgdGhpcyB3aWxsIGFsd2F5cyBhdHRlbXB0IHRvIGxvYWQgdGhlIGVudHJ5IHBvaW50IGZvciBlYWNoIGZpbGUuXG4gICAgICAgIC8vIFRoaXMgd2lsbCBvbmx5IG9jY3VyIGR1cmluZyBwcmVyZWxlYXNlIGFuZCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgY29ycmVjdGVkIG9uY2UgdGhlIG5ld1xuICAgICAgICAvLyBlbnRyeSBwb2ludCBleGlzdHMuXG4gICAgICAgIGlmIChpMThuUGx1Z2luQ3JlYXRvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgICAgaTE4blBsdWdpbkNyZWF0b3JzID0gYXdhaXQgbG9hZEVzbU1vZHVsZTxJMThuUGx1Z2luQ3JlYXRvcnM+KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5pMThuID0ge1xuICAgICAgICAgIC4uLihpMThuIGFzIE5vbk51bGxhYmxlPEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9uc1snaTE4biddPiksXG4gICAgICAgICAgcGx1Z2luQ3JlYXRvcnM6IGkxOG5QbHVnaW5DcmVhdG9ycyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgdHJhbnNsYXRpb24gZmlsZXMgYXMgZGVwZW5kZW5jaWVzIG9mIHRoZSBmaWxlIHRvIHN1cHBvcnQgcmVidWlsZHNcbiAgICAgICAgLy8gRXhjZXB0IGZvciBgQGFuZ3VsYXIvY29yZWAgd2hpY2ggbmVlZHMgbG9jYWxlIGluamVjdGlvbiBidXQgaGFzIG5vIHRyYW5zbGF0aW9uc1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY3VzdG9tT3B0aW9ucy5pMThuLnRyYW5zbGF0aW9uRmlsZXMgJiZcbiAgICAgICAgICAhL1tcXFxcL11AYW5ndWxhcltcXFxcL11jb3JlLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKVxuICAgICAgICApIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgY3VzdG9tT3B0aW9ucy5pMThuLnRyYW5zbGF0aW9uRmlsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkRGVwZW5kZW5jeShmaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzaG91bGRQcm9jZXNzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGltaXplKSB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKTtcbiAgICAgICAgY3VzdG9tT3B0aW9ucy5vcHRpbWl6ZSA9IHtcbiAgICAgICAgICAvLyBBbmd1bGFyIHBhY2thZ2VzIHByb3ZpZGUgYWRkaXRpb25hbCB0ZXN0ZWQgc2lkZSBlZmZlY3RzIGd1YXJhbnRlZXMgYW5kIGNhbiB1c2VcbiAgICAgICAgICAvLyBvdGhlcndpc2UgdW5zYWZlIG9wdGltaXphdGlvbnMuXG4gICAgICAgICAgbG9vc2VFbnVtczogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgcHVyZVRvcExldmVsOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAvLyBKYXZhU2NyaXB0IG1vZHVsZXMgdGhhdCBhcmUgbWFya2VkIGFzIHNpZGUgZWZmZWN0IGZyZWUgYXJlIGNvbnNpZGVyZWQgdG8gaGF2ZVxuICAgICAgICAgIC8vIG5vIGRlY29yYXRvcnMgdGhhdCBjb250YWluIG5vbi1sb2NhbCBlZmZlY3RzLlxuICAgICAgICAgIHdyYXBEZWNvcmF0b3JzOiAhIXRoaXMuX21vZHVsZT8uZmFjdG9yeU1ldGE/LnNpZGVFZmZlY3RGcmVlLFxuICAgICAgICB9O1xuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIGluc3RydW1lbnRDb2RlICYmXG4gICAgICAgICFpbnN0cnVtZW50Q29kZS5leGNsdWRlZFBhdGhzLmhhcyh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgIS9cXC4oZTJlfHNwZWMpXFwudHN4PyR8W1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpICYmXG4gICAgICAgIHRoaXMucmVzb3VyY2VQYXRoLnN0YXJ0c1dpdGgoaW5zdHJ1bWVudENvZGUuaW5jbHVkZWRCYXNlUGF0aClcbiAgICAgICkge1xuICAgICAgICAvLyBgYmFiZWwtcGx1Z2luLWlzdGFuYnVsYCBoYXMgaXQncyBvd24gaW5jbHVkZXMgYnV0IHdlIGRvIHRoZSBiZWxvdyBzbyB0aGF0IHdlIGF2b2lkIHJ1bm5pbmcgdGhlIHRoZSBsb2FkZXIuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuaW5zdHJ1bWVudENvZGUgPSB7XG4gICAgICAgICAgaW5jbHVkZWRCYXNlUGF0aDogaW5zdHJ1bWVudENvZGUuaW5jbHVkZWRCYXNlUGF0aCxcbiAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogbWFwLFxuICAgICAgICB9O1xuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgcHJvdmlkZWQgbG9hZGVyIG9wdGlvbnMgdG8gZGVmYXVsdCBiYXNlIG9wdGlvbnNcbiAgICAgIGNvbnN0IGxvYWRlck9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAuLi5iYXNlT3B0aW9ucyxcbiAgICAgICAgLi4ucmF3T3B0aW9ucyxcbiAgICAgICAgY2FjaGVJZGVudGlmaWVyOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYnVpbGRBbmd1bGFyOiBWRVJTSU9OLFxuICAgICAgICAgIGN1c3RvbU9wdGlvbnMsXG4gICAgICAgICAgYmFzZU9wdGlvbnMsXG4gICAgICAgICAgcmF3T3B0aW9ucyxcbiAgICAgICAgfSksXG4gICAgICB9O1xuXG4gICAgICAvLyBTa2lwIGJhYmVsIHByb2Nlc3NpbmcgaWYgbm8gYWN0aW9ucyBhcmUgbmVlZGVkXG4gICAgICBpZiAoIXNob3VsZFByb2Nlc3MpIHtcbiAgICAgICAgLy8gRm9yY2UgdGhlIGN1cnJlbnQgZmlsZSB0byBiZSBpZ25vcmVkXG4gICAgICAgIGxvYWRlck9wdGlvbnMuaWdub3JlID0gWygpID0+IHRydWVdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBjdXN0b206IGN1c3RvbU9wdGlvbnMsIGxvYWRlcjogbG9hZGVyT3B0aW9ucyB9O1xuICAgIH0sXG4gICAgY29uZmlnKGNvbmZpZ3VyYXRpb24sIHsgY3VzdG9tT3B0aW9ucyB9KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5jb25maWd1cmF0aW9uLm9wdGlvbnMsXG4gICAgICAgIC8vIFVzaW5nIGBmYWxzZWAgZGlzYWJsZXMgYmFiZWwgZnJvbSBhdHRlbXB0aW5nIHRvIGxvY2F0ZSBzb3VyY2VtYXBzIG9yIHByb2Nlc3MgYW55IGlubGluZSBtYXBzLlxuICAgICAgICAvLyBUaGUgYmFiZWwgdHlwZXMgZG8gbm90IGluY2x1ZGUgdGhlIGZhbHNlIG9wdGlvbiBldmVuIHRob3VnaCBpdCBpcyB2YWxpZFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgICAgICBwcmVzZXRzOiBbXG4gICAgICAgICAgLi4uKGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5wcmVzZXRzIHx8IFtdKSxcbiAgICAgICAgICBbXG4gICAgICAgICAgICByZXF1aXJlKCcuL3ByZXNldHMvYXBwbGljYXRpb24nKS5kZWZhdWx0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAuLi5jdXN0b21PcHRpb25zLFxuICAgICAgICAgICAgICBkaWFnbm9zdGljUmVwb3J0ZXI6ICh0eXBlLCBtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2luZm8nOlxuICAgICAgICAgICAgICAgICAgLy8gV2VicGFjayBkb2VzIG5vdCBjdXJyZW50bHkgaGF2ZSBhbiBpbmZvcm1hdGlvbmFsIGRpYWdub3N0aWNcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ3dhcm5pbmcnOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRXYXJuaW5nKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9IGFzIEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucyxcbiAgICAgICAgICBdLFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9LFxuICAgIHJlc3VsdChyZXN1bHQsIHsgbWFwOiBpbnB1dFNvdXJjZU1hcCB9KSB7XG4gICAgICBpZiAocmVzdWx0Lm1hcCAmJiBpbnB1dFNvdXJjZU1hcCkge1xuICAgICAgICAvLyBNZXJnZSB0aGUgaW50ZXJtZWRpYXRlIHNvdXJjZW1hcCBnZW5lcmF0ZWQgYnkgYmFiZWwgd2l0aCB0aGUgaW5wdXQgc291cmNlIG1hcC5cbiAgICAgICAgLy8gVGhlIGNhc3RpbmcgaXMgcmVxdWlyZWQgZHVlIHRvIHNsaWdodCBkaWZmZXJlbmNlcyBpbiB0aGUgdHlwZXMgZm9yIGJhYmVsIGFuZFxuICAgICAgICAvLyBgQGFtcHByb2plY3QvcmVtYXBwaW5nYCBzb3VyY2UgbWFwIG9iamVjdHMgYnV0IGJvdGggYXJlIGNvbXBhdGlibGUgd2l0aCBXZWJwYWNrLlxuICAgICAgICAvLyBUaGlzIG1ldGhvZCBmb3IgbWVyZ2luZyBpcyB1c2VkIGJlY2F1c2UgaXQgcHJvdmlkZXMgbW9yZSBhY2N1cmF0ZSBvdXRwdXRcbiAgICAgICAgLy8gYW5kIGlzIGZhc3RlciB3aGlsZSB1c2luZyBsZXNzIG1lbW9yeS5cbiAgICAgICAgcmVzdWx0Lm1hcCA9IHtcbiAgICAgICAgICAvLyBDb252ZXJ0IHRoZSBTb3VyY2VNYXAgYmFjayB0byBzaW1wbGUgcGxhaW4gb2JqZWN0LlxuICAgICAgICAgIC8vIFRoaXMgaXMgbmVlZGVkIGJlY2F1c2Ugb3RoZXJ3aXNlIGNvZGUtY292ZXJhZ2Ugd2lsbCBmYWlsIHdpdGggYGRvbid0IGtub3cgaG93IHRvIHR1cm4gdGhpcyB2YWx1ZSBpbnRvIGEgbm9kZWBcbiAgICAgICAgICAvLyBXaGljaCBpcyB0aHJvd24gYnkgQmFiZWwgaWYgaXQgaXMgaW52b2tlZCBhZ2FpbiBmcm9tIGBpc3RhbmJ1bC1saWItaW5zdHJ1bWVudGAuXG4gICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2Jsb2IvNzgwYWE0OGQyYTM0ZGM1NWY1NTY4NDMwNzRiNmFlZDQ1ZTdlYWJlYi9wYWNrYWdlcy9iYWJlbC10eXBlcy9zcmMvY29udmVydGVycy92YWx1ZVRvTm9kZS50cyNMMTE1LUwxMzBcbiAgICAgICAgICAuLi4ocmVtYXBwaW5nKFxuICAgICAgICAgICAgW3Jlc3VsdC5tYXAgYXMgU291cmNlTWFwSW5wdXQsIGlucHV0U291cmNlTWFwIGFzIFNvdXJjZU1hcElucHV0XSxcbiAgICAgICAgICAgICgpID0+IG51bGwsXG4gICAgICAgICAgKSBhcyB0eXBlb2YgcmVzdWx0Lm1hcCksXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgfTtcbn0pO1xuIl19