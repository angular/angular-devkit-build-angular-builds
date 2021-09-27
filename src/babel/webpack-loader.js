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
/**
 * Cached instance of the compiler-cli linker's needsLinking function.
 */
let needsLinking;
/**
 * Cached instance of the compiler-cli linker's Babel plugin factory function.
 */
let linkerPluginCreator;
/**
 * Cached instance of the `@angular/localize/tool` exports we rely on.
 */
let localizeToolExports;
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
        const linkerModule = await load_esm_1.loadEsmModule('@angular/compiler-cli/linker');
        needsLinking = linkerModule.needsLinking;
    }
    return needsLinking(path, source);
}
exports.default = babel_loader_1.custom(() => {
    const baseOptions = Object.freeze({
        babelrc: false,
        configFile: false,
        compact: false,
        cacheCompression: false,
        sourceType: 'unambiguous',
        inputSourceMap: false,
    });
    return {
        async customOptions({ i18n, scriptTarget, aot, optimize, ...rawOptions }, { source }) {
            var _a, _b;
            // Must process file if plugins are added
            let shouldProcess = Array.isArray(rawOptions.plugins) && rawOptions.plugins.length > 0;
            const customOptions = {
                forceAsyncTransformation: false,
                forceES5: false,
                angularLinker: undefined,
                i18n: undefined,
            };
            // Analyze file for linking
            if (await requiresLinking(this.resourcePath, source)) {
                if (!linkerPluginCreator) {
                    // Load ESM `@angular/compiler-cli/linker/babel` using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    const linkerBabelModule = await load_esm_1.loadEsmModule('@angular/compiler-cli/linker/babel');
                    linkerPluginCreator = linkerBabelModule.createEs2015LinkerPlugin;
                }
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
                shouldProcess || (shouldProcess = customOptions.forceAsyncTransformation || customOptions.forceES5);
            }
            // Analyze for i18n inlining
            if (i18n &&
                !/[\\/]@angular[\\/](?:compiler|localize)/.test(this.resourcePath) &&
                source.includes('$localize')) {
                // Load the localize tool exports from the new `@angular/localize/tools` entry point.
                // This may fail during the transition to ESM due to the entry point not yet existing.
                // During the transition, this will always attempt to load the entry point for each file.
                // This will only occur during prerelease and will be automatically corrected once the new
                // entry point exists.
                // TODO_ESM: Make import failure an error once the `tools` entry point exists.
                if (localizeToolExports === undefined) {
                    // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    try {
                        localizeToolExports = await load_esm_1.loadEsmModule('@angular/localize/tools');
                    }
                    catch { }
                }
                customOptions.i18n = {
                    ...i18n,
                    localizeToolExports,
                };
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
            // Add provided loader options to default base options
            const loaderOptions = {
                ...baseOptions,
                ...rawOptions,
                cacheIdentifier: JSON.stringify({
                    buildAngular: require('../../package.json').version,
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
            const plugins = (_a = configuration.options.plugins) !== null && _a !== void 0 ? _a : [];
            if (customOptions.optimize) {
                if (customOptions.optimize.pureTopLevel) {
                    plugins.push(require('./plugins/pure-toplevel-functions').default);
                }
                plugins.push(require('./plugins/elide-angular-metadata').default, [
                    require('./plugins/adjust-typescript-enums').default,
                    { loose: customOptions.optimize.looseEnums },
                ], [
                    require('./plugins/adjust-static-class-members').default,
                    { wrapDecorators: customOptions.optimize.wrapDecorators },
                ]);
            }
            return {
                ...configuration.options,
                // Workaround for https://github.com/babel/babel-loader/pull/896 is available
                // Delete once the above PR is released
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                inputSourceMap: configuration.options.inputSourceMap || false,
                plugins,
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
