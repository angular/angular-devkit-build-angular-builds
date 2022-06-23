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
            var _a, _b, _c;
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
            else if (isJsFile && ((_a = customOptions.supportedBrowsers) === null || _a === void 0 ? void 0 : _a.length)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC93ZWJwYWNrLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBc0M7QUFDdEMsMkNBQTBDO0FBQzFDLGdEQUFrRDtBQUNsRCw4REFBbUQ7QUFhbkQ7O0dBRUc7QUFDSCxJQUFJLFlBQW9GLENBQUM7QUFFekY7O0dBRUc7QUFDSCxJQUFJLG1CQUVTLENBQUM7QUFFZDs7R0FFRztBQUNILElBQUksa0JBQWtELENBQUM7QUFFaEQsS0FBSyxVQUFVLGVBQWUsQ0FBQyxJQUFZLEVBQUUsTUFBYztJQUNoRSxpRUFBaUU7SUFDakUsZ0RBQWdEO0lBQ2hELElBQUksNkNBQTZDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzVELE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ2pCLDBGQUEwRjtRQUMxRix5RkFBeUY7UUFDekYsc0NBQXNDO1FBQ3RDLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUN0Qyw4QkFBOEIsQ0FDL0IsQ0FBQztRQUNGLFlBQVksR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDO0tBQzFDO0lBRUQsT0FBTyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3BDLENBQUM7QUFsQkQsMENBa0JDO0FBRUQsa0RBQWtEO0FBQ2xELGtCQUFlLElBQUEscUJBQU0sRUFBMkIsR0FBRyxFQUFFO0lBQ25ELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDaEMsT0FBTyxFQUFFLEtBQUs7UUFDZCxVQUFVLEVBQUUsS0FBSztRQUNqQixPQUFPLEVBQUUsS0FBSztRQUNkLGdCQUFnQixFQUFFLEtB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Q0FBSyxLQUFhO2dCQUN0RSxPQUFPLEVBQUU7b0JBQ1AsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQztvQkFDeEM7d0JBQ0UsT0FBTyxDQUFDLHVCQUF1QixDQUFDLENBQUMsT0FBTzt3QkFDeEM7NEJBQ0UsR0FBRyxhQUFhOzRCQUNoQixrQkFBa0IsRUFBRSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRTtnQ0FDcEMsUUFBUSxJQUFJLEVBQUU7b0NBQ1osS0FBSyxPQUFPO3dDQUNWLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7d0NBQ3hCLE1BQU07b0NBQ1IsS0FBSyxNQUFNLENBQUM7b0NBQ1osOERBQThEO29DQUM5RCxLQUFLLFNBQVM7d0NBQ1osSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3Q0FDMUIsTUFBTTtpQ0FDVDs0QkFDSCxDQUFDO3lCQUMwQjtxQkFDOUI7aUJBQ0Y7YUFDRixDQUFDO1FBQ0osQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjdXN0b20gfSBmcm9tICdiYWJlbC1sb2FkZXInO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uL3V0aWxzL3BhY2thZ2UtdmVyc2lvbic7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMsIEkxOG5QbHVnaW5DcmVhdG9ycyB9IGZyb20gJy4vcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5cbmludGVyZmFjZSBBbmd1bGFyQ3VzdG9tT3B0aW9ucyBleHRlbmRzIE9taXQ8QXBwbGljYXRpb25QcmVzZXRPcHRpb25zLCAnaW5zdHJ1bWVudENvZGUnPiB7XG4gIGluc3RydW1lbnRDb2RlPzoge1xuICAgIC8qKiBub2RlX21vZHVsZXMgYW5kIHRlc3QgZmlsZXMgYXJlIGFsd2F5cyBleGNsdWRlZC4gKi9cbiAgICBleGNsdWRlZFBhdGhzOiBTZXQ8U3RyaW5nPjtcbiAgICBpbmNsdWRlZEJhc2VQYXRoOiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCB0eXBlIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgPSBBbmd1bGFyQ3VzdG9tT3B0aW9ucyAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgY29tcGlsZXItY2xpIGxpbmtlcidzIG5lZWRzTGlua2luZyBmdW5jdGlvbi5cbiAqL1xubGV0IG5lZWRzTGlua2luZzogdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicpLm5lZWRzTGlua2luZyB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGNvbXBpbGVyLWNsaSBsaW5rZXIncyBCYWJlbCBwbHVnaW4gZmFjdG9yeSBmdW5jdGlvbi5cbiAqL1xubGV0IGxpbmtlclBsdWdpbkNyZWF0b3I6XG4gIHwgdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpblxuICB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGxvY2FsaXplIEJhYmVsIHBsdWdpbnMgZmFjdG9yeSBmdW5jdGlvbnMuXG4gKi9cbmxldCBpMThuUGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVpcmVzTGlua2luZyhwYXRoOiBzdHJpbmcsIHNvdXJjZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIC8vIEBhbmd1bGFyL2NvcmUgYW5kIEBhbmd1bGFyL2NvbXBpbGVyIHdpbGwgY2F1c2UgZmFsc2UgcG9zaXRpdmVzXG4gIC8vIEFsc28sIFR5cGVTY3JpcHQgZmlsZXMgZG8gbm90IHJlcXVpcmUgbGlua2luZ1xuICBpZiAoL1tcXFxcL11AYW5ndWxhcltcXFxcL10oPzpjb21waWxlcnxjb3JlKXxcXC50c3g/JC8udGVzdChwYXRoKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghbmVlZHNMaW5raW5nKSB7XG4gICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXJgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgIGNvbnN0IGxpbmtlck1vZHVsZSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicpPihcbiAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJyxcbiAgICApO1xuICAgIG5lZWRzTGlua2luZyA9IGxpbmtlck1vZHVsZS5uZWVkc0xpbmtpbmc7XG4gIH1cblxuICByZXR1cm4gbmVlZHNMaW5raW5nKHBhdGgsIHNvdXJjZSk7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZGVmYXVsdCBjdXN0b208QXBwbGljYXRpb25QcmVzZXRPcHRpb25zPigoKSA9PiB7XG4gIGNvbnN0IGJhc2VPcHRpb25zID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgY29tcGFjdDogZmFsc2UsXG4gICAgY2FjaGVDb21wcmVzc2lvbjogZmFsc2UsXG4gICAgc291cmNlVHlwZTogJ3VuYW1iaWd1b3VzJyxcbiAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UsXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgYXN5bmMgY3VzdG9tT3B0aW9ucyhvcHRpb25zLCB7IHNvdXJjZSwgbWFwIH0pIHtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgaTE4bixcbiAgICAgICAgc2NyaXB0VGFyZ2V0LFxuICAgICAgICBhb3QsXG4gICAgICAgIG9wdGltaXplLFxuICAgICAgICBpbnN0cnVtZW50Q29kZSxcbiAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIC4uLnJhd09wdGlvbnNcbiAgICAgIH0gPSBvcHRpb25zIGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnM7XG5cbiAgICAgIC8vIE11c3QgcHJvY2VzcyBmaWxlIGlmIHBsdWdpbnMgYXJlIGFkZGVkXG4gICAgICBsZXQgc2hvdWxkUHJvY2VzcyA9IEFycmF5LmlzQXJyYXkocmF3T3B0aW9ucy5wbHVnaW5zKSAmJiByYXdPcHRpb25zLnBsdWdpbnMubGVuZ3RoID4gMDtcblxuICAgICAgY29uc3QgY3VzdG9tT3B0aW9uczogQXBwbGljYXRpb25QcmVzZXRPcHRpb25zID0ge1xuICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb246IGZhbHNlLFxuICAgICAgICBmb3JjZVByZXNldEVudjogZmFsc2UsXG4gICAgICAgIGFuZ3VsYXJMaW5rZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgaTE4bjogdW5kZWZpbmVkLFxuICAgICAgICBpbnN0cnVtZW50Q29kZTogdW5kZWZpbmVkLFxuICAgICAgICBzdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgIH07XG5cbiAgICAgIC8vIEFuYWx5emUgZmlsZSBmb3IgbGlua2luZ1xuICAgICAgaWYgKGF3YWl0IHJlcXVpcmVzTGlua2luZyh0aGlzLnJlc291cmNlUGF0aCwgc291cmNlKSkge1xuICAgICAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbGAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvciA/Pz0gKFxuICAgICAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpPihcbiAgICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgICAgICApXG4gICAgICAgICkuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luO1xuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuYW5ndWxhckxpbmtlciA9IHtcbiAgICAgICAgICBzaG91bGRMaW5rOiB0cnVlLFxuICAgICAgICAgIGppdE1vZGU6IGFvdCAhPT0gdHJ1ZSxcbiAgICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yLFxuICAgICAgICB9O1xuICAgICAgICBzaG91bGRQcm9jZXNzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQW5hbHl6ZSBmb3IgRVMgdGFyZ2V0IHByb2Nlc3NpbmdcbiAgICAgIGNvbnN0IGVzVGFyZ2V0ID0gc2NyaXB0VGFyZ2V0IGFzIFNjcmlwdFRhcmdldCB8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGlzSnNGaWxlID0gL1xcLltjbV0/anMkLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKTtcblxuICAgICAgLy8gVGhlIGJlbG93IHNob3VsZCBiZSBkcm9wcGVkIHdoZW4gd2Ugbm8gbG9uZ2VyIHN1cHBvcnQgRVM1IFR5cGVTY3JpcHQgb3V0cHV0LlxuICAgICAgaWYgKGVzVGFyZ2V0ID09PSBTY3JpcHRUYXJnZXQuRVM1KSB7XG4gICAgICAgIC8vIFRoaXMgaXMgbmVlZGVkIGJlY2F1c2Ugd2hlbiB0YXJnZXQgaXMgRVM1IHdlIGNoYW5nZSB0aGUgVHlwZVNjcmlwdCB0YXJnZXQgdG8gRVMyMDE1XG4gICAgICAgIC8vIGJlY2F1c2UgaXQgc2ltcGxpZmllcyBidWlsZC1vcHRpbWl6YXRpb24gcGFzc2VzLlxuICAgICAgICAvLyBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2Jsb2IvMjJhZjY1MjA4MzQxNzFkMDE0MTNkNGM3ZTRhOWYxM2ZiNzUyMjUyZS9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvdHlwZXNjcmlwdC50cyNMNTEtTDU2XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VQcmVzZXRFbnYgPSB0cnVlO1xuICAgICAgICAvLyBDb21wYXJhYmxlIGJlaGF2aW9yIHRvIHRzY29uZmlnIHRhcmdldCBvZiBFUzVcbiAgICAgICAgY3VzdG9tT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyA9IFsnSUUgOSddO1xuICAgICAgfSBlbHNlIGlmIChpc0pzRmlsZSAmJiBjdXN0b21PcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzPy5sZW5ndGgpIHtcbiAgICAgICAgLy8gQXBwbGljYXRpb25zIGNvZGUgRVMgdmVyc2lvbiBjYW4gYmUgY29udHJvbGxlZCB1c2luZyBUeXBlU2NyaXB0J3MgYHRhcmdldGAgb3B0aW9uLlxuICAgICAgICAvLyBIb3dldmVyLCB0aGlzIGRvZXNuJ3QgZWZmZWN0IGxpYnJhcmllcyBhbmQgaGVuY2Ugd2UgdXNlIHByZXNldC1lbnYgdG8gZG93bmxldmVsIEVTIGZldGF1cmVzXG4gICAgICAgIC8vIGJhc2VkIG9uIHRoZSBzdXBwb3J0ZWQgYnJvd3NlcnMgaW4gYnJvd3Nlcmxpc3QuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VQcmVzZXRFbnYgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoKGVzVGFyZ2V0ICE9PSB1bmRlZmluZWQgJiYgZXNUYXJnZXQgPj0gU2NyaXB0VGFyZ2V0LkVTMjAxNykgfHwgaXNKc0ZpbGUpIHtcbiAgICAgICAgLy8gQXBwbGljYXRpb24gY29kZSAoVFMgZmlsZXMpIHdpbGwgb25seSBjb250YWluIG5hdGl2ZSBhc3luYyBpZiB0YXJnZXQgaXMgRVMyMDE3Ky5cbiAgICAgICAgLy8gSG93ZXZlciwgdGhpcmQtcGFydHkgbGlicmFyaWVzIGNhbiByZWdhcmRsZXNzIG9mIHRoZSB0YXJnZXQgb3B0aW9uLlxuICAgICAgICAvLyBBUEYgcGFja2FnZXMgd2l0aCBjb2RlIGluIFtmXWVzbTIwMTUgZGlyZWN0b3JpZXMgaXMgZG93bmxldmVsbGVkIHRvIEVTMjAxNSBhbmRcbiAgICAgICAgLy8gd2lsbCBub3QgaGF2ZSBuYXRpdmUgYXN5bmMuXG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID1cbiAgICAgICAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KHRoaXMucmVzb3VyY2VQYXRoKSAmJiBzb3VyY2UuaW5jbHVkZXMoJ2FzeW5jJyk7XG4gICAgICB9XG5cbiAgICAgIHNob3VsZFByb2Nlc3MgfHw9XG4gICAgICAgIGN1c3RvbU9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uIHx8IGN1c3RvbU9wdGlvbnMuZm9yY2VQcmVzZXRFbnYgfHwgZmFsc2U7XG5cbiAgICAgIC8vIEFuYWx5emUgZm9yIGkxOG4gaW5saW5pbmdcbiAgICAgIGlmIChcbiAgICAgICAgaTE4biAmJlxuICAgICAgICAhL1tcXFxcL11AYW5ndWxhcltcXFxcL10oPzpjb21waWxlcnxsb2NhbGl6ZSkvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpICYmXG4gICAgICAgIHNvdXJjZS5pbmNsdWRlcygnJGxvY2FsaXplJylcbiAgICAgICkge1xuICAgICAgICAvLyBMb2FkIHRoZSBpMThuIHBsdWdpbiBjcmVhdG9ycyBmcm9tIHRoZSBuZXcgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBlbnRyeSBwb2ludC5cbiAgICAgICAgLy8gVGhpcyBtYXkgZmFpbCBkdXJpbmcgdGhlIHRyYW5zaXRpb24gdG8gRVNNIGR1ZSB0byB0aGUgZW50cnkgcG9pbnQgbm90IHlldCBleGlzdGluZy5cbiAgICAgICAgLy8gRHVyaW5nIHRoZSB0cmFuc2l0aW9uLCB0aGlzIHdpbGwgYWx3YXlzIGF0dGVtcHQgdG8gbG9hZCB0aGUgZW50cnkgcG9pbnQgZm9yIGVhY2ggZmlsZS5cbiAgICAgICAgLy8gVGhpcyB3aWxsIG9ubHkgb2NjdXIgZHVyaW5nIHByZXJlbGVhc2UgYW5kIHdpbGwgYmUgYXV0b21hdGljYWxseSBjb3JyZWN0ZWQgb25jZSB0aGUgbmV3XG4gICAgICAgIC8vIGVudHJ5IHBvaW50IGV4aXN0cy5cbiAgICAgICAgaWYgKGkxOG5QbHVnaW5DcmVhdG9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICBpMThuUGx1Z2luQ3JlYXRvcnMgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPEkxOG5QbHVnaW5DcmVhdG9ycz4oJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjdXN0b21PcHRpb25zLmkxOG4gPSB7XG4gICAgICAgICAgLi4uKGkxOG4gYXMgTm9uTnVsbGFibGU8QXBwbGljYXRpb25QcmVzZXRPcHRpb25zWydpMThuJ10+KSxcbiAgICAgICAgICBwbHVnaW5DcmVhdG9yczogaTE4blBsdWdpbkNyZWF0b3JzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCB0cmFuc2xhdGlvbiBmaWxlcyBhcyBkZXBlbmRlbmNpZXMgb2YgdGhlIGZpbGUgdG8gc3VwcG9ydCByZWJ1aWxkc1xuICAgICAgICAvLyBFeGNlcHQgZm9yIGBAYW5ndWxhci9jb3JlYCB3aGljaCBuZWVkcyBsb2NhbGUgaW5qZWN0aW9uIGJ1dCBoYXMgbm8gdHJhbnNsYXRpb25zXG4gICAgICAgIGlmIChcbiAgICAgICAgICBjdXN0b21PcHRpb25zLmkxOG4udHJhbnNsYXRpb25GaWxlcyAmJlxuICAgICAgICAgICEvW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWNvcmUvLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpXG4gICAgICAgICkge1xuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBjdXN0b21PcHRpb25zLmkxOG4udHJhbnNsYXRpb25GaWxlcykge1xuICAgICAgICAgICAgdGhpcy5hZGREZXBlbmRlbmN5KGZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNob3VsZFByb2Nlc3MgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW1pemUpIHtcbiAgICAgICAgY29uc3QgYW5ndWxhclBhY2thZ2UgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL10vLnRlc3QodGhpcy5yZXNvdXJjZVBhdGgpO1xuICAgICAgICBjdXN0b21PcHRpb25zLm9wdGltaXplID0ge1xuICAgICAgICAgIC8vIEFuZ3VsYXIgcGFja2FnZXMgcHJvdmlkZSBhZGRpdGlvbmFsIHRlc3RlZCBzaWRlIGVmZmVjdHMgZ3VhcmFudGVlcyBhbmQgY2FuIHVzZVxuICAgICAgICAgIC8vIG90aGVyd2lzZSB1bnNhZmUgb3B0aW1pemF0aW9ucy5cbiAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIC8vIEphdmFTY3JpcHQgbW9kdWxlcyB0aGF0IGFyZSBtYXJrZWQgYXMgc2lkZSBlZmZlY3QgZnJlZSBhcmUgY29uc2lkZXJlZCB0byBoYXZlXG4gICAgICAgICAgLy8gbm8gZGVjb3JhdG9ycyB0aGF0IGNvbnRhaW4gbm9uLWxvY2FsIGVmZmVjdHMuXG4gICAgICAgICAgd3JhcERlY29yYXRvcnM6ICEhdGhpcy5fbW9kdWxlPy5mYWN0b3J5TWV0YT8uc2lkZUVmZmVjdEZyZWUsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgaW5zdHJ1bWVudENvZGUgJiZcbiAgICAgICAgIWluc3RydW1lbnRDb2RlLmV4Y2x1ZGVkUGF0aHMuaGFzKHRoaXMucmVzb3VyY2VQYXRoKSAmJlxuICAgICAgICAhL1xcLihlMmV8c3BlYylcXC50c3g/JHxbXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdCh0aGlzLnJlc291cmNlUGF0aCkgJiZcbiAgICAgICAgdGhpcy5yZXNvdXJjZVBhdGguc3RhcnRzV2l0aChpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoKVxuICAgICAgKSB7XG4gICAgICAgIC8vIGBiYWJlbC1wbHVnaW4taXN0YW5idWxgIGhhcyBpdCdzIG93biBpbmNsdWRlcyBidXQgd2UgZG8gdGhlIGJlbG93IHNvIHRoYXQgd2UgYXZvaWQgcnVubmluZyB0aGUgdGhlIGxvYWRlci5cbiAgICAgICAgY3VzdG9tT3B0aW9ucy5pbnN0cnVtZW50Q29kZSA9IHtcbiAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBpbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoLFxuICAgICAgICAgIGlucHV0U291cmNlTWFwOiBtYXAsXG4gICAgICAgIH07XG5cbiAgICAgICAgc2hvdWxkUHJvY2VzcyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBwcm92aWRlZCBsb2FkZXIgb3B0aW9ucyB0byBkZWZhdWx0IGJhc2Ugb3B0aW9uc1xuICAgICAgY29uc3QgbG9hZGVyT3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgIC4uLmJhc2VPcHRpb25zLFxuICAgICAgICAuLi5yYXdPcHRpb25zLFxuICAgICAgICBjYWNoZUlkZW50aWZpZXI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBidWlsZEFuZ3VsYXI6IFZFUlNJT04sXG4gICAgICAgICAgY3VzdG9tT3B0aW9ucyxcbiAgICAgICAgICBiYXNlT3B0aW9ucyxcbiAgICAgICAgICByYXdPcHRpb25zLFxuICAgICAgICB9KSxcbiAgICAgIH07XG5cbiAgICAgIC8vIFNraXAgYmFiZWwgcHJvY2Vzc2luZyBpZiBubyBhY3Rpb25zIGFyZSBuZWVkZWRcbiAgICAgIGlmICghc2hvdWxkUHJvY2Vzcykge1xuICAgICAgICAvLyBGb3JjZSB0aGUgY3VycmVudCBmaWxlIHRvIGJlIGlnbm9yZWRcbiAgICAgICAgbG9hZGVyT3B0aW9ucy5pZ25vcmUgPSBbKCkgPT4gdHJ1ZV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IGN1c3RvbTogY3VzdG9tT3B0aW9ucywgbG9hZGVyOiBsb2FkZXJPcHRpb25zIH07XG4gICAgfSxcbiAgICBjb25maWcoY29uZmlndXJhdGlvbiwgeyBjdXN0b21PcHRpb25zIH0pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmNvbmZpZ3VyYXRpb24ub3B0aW9ucyxcbiAgICAgICAgLy8gVXNpbmcgYGZhbHNlYCBkaXNhYmxlcyBiYWJlbCBmcm9tIGF0dGVtcHRpbmcgdG8gbG9jYXRlIHNvdXJjZW1hcHMgb3IgcHJvY2VzcyBhbnkgaW5saW5lIG1hcHMuXG4gICAgICAgIC8vIFRoZSBiYWJlbCB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIGlucHV0U291cmNlTWFwOiBjb25maWd1cmF0aW9uLm9wdGlvbnMuaW5wdXRTb3VyY2VNYXAgPz8gKGZhbHNlIGFzIGFueSksXG4gICAgICAgIHByZXNldHM6IFtcbiAgICAgICAgICAuLi4oY29uZmlndXJhdGlvbi5vcHRpb25zLnByZXNldHMgfHwgW10pLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIHJlcXVpcmUoJy4vcHJlc2V0cy9hcHBsaWNhdGlvbicpLmRlZmF1bHQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIC4uLmN1c3RvbU9wdGlvbnMsXG4gICAgICAgICAgICAgIGRpYWdub3N0aWNSZXBvcnRlcjogKHR5cGUsIG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0RXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgY2FzZSAnaW5mbyc6XG4gICAgICAgICAgICAgICAgICAvLyBXZWJwYWNrIGRvZXMgbm90IGN1cnJlbnRseSBoYXZlIGFuIGluZm9ybWF0aW9uYWwgZGlhZ25vc3RpY1xuICAgICAgICAgICAgICAgICAgY2FzZSAnd2FybmluZyc6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFdhcm5pbmcobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0gYXMgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zLFxuICAgICAgICAgIF0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH0sXG4gIH07XG59KTtcbiJdfQ==