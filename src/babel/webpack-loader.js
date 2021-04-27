"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const babel_loader_1 = require("babel-loader");
const typescript_1 = require("typescript");
/**
 * Cached linker check utility function
 *
 * If undefined, not yet been imported
 * If null, attempted import failed and no linker support
 * If function, import succeeded and linker supported
 */
let needsLinking;
async function checkLinking(path, source) {
    // @angular/core and @angular/compiler will cause false positives
    // Also, TypeScript files do not require linking
    if (/[\\\/]@angular[\\\/](?:compiler|core)|\.tsx?$/.test(path)) {
        return { requiresLinking: false };
    }
    if (needsLinking !== null) {
        try {
            if (needsLinking === undefined) {
                needsLinking = (await Promise.resolve().then(() => require('@angular/compiler-cli/linker'))).needsLinking;
            }
            // If the linker entry point is present then there is linker support
            return { hasLinkerSupport: true, requiresLinking: needsLinking(path, source) };
        }
        catch (_a) {
            needsLinking = null;
        }
    }
    // Fallback for Angular versions less than 11.1.0 with no linker support.
    // This information is used to issue errors if a partially compiled library is used when unsupported.
    return {
        hasLinkerSupport: false,
        requiresLinking: source.includes('ɵɵngDeclareDirective') || source.includes('ɵɵngDeclareComponent'),
    };
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
        async customOptions({ i18n, scriptTarget, ...rawOptions }, { source }) {
            // Must process file if plugins are added
            let shouldProcess = Array.isArray(rawOptions.plugins) && rawOptions.plugins.length > 0;
            const customOptions = {
                forceAsyncTransformation: false,
                forceES5: false,
                shouldLink: false,
                i18n: undefined,
            };
            // Analyze file for linking
            const { hasLinkerSupport, requiresLinking } = await checkLinking(this.resourcePath, source);
            if (requiresLinking && !hasLinkerSupport) {
                // Cannot link if there is no linker support
                this.emitError('File requires the Angular linker. "@angular/compiler-cli" version 11.1.0 or greater is needed.');
            }
            else {
                customOptions.shouldLink = requiresLinking;
            }
            shouldProcess || (shouldProcess = customOptions.shouldLink);
            // Analyze for ES target processing
            const esTarget = scriptTarget;
            if (esTarget !== undefined) {
                if (esTarget < typescript_1.ScriptTarget.ES2015) {
                    // TypeScript files will have already been downlevelled
                    customOptions.forceES5 = !/\.tsx?$/.test(this.resourcePath);
                }
                else if (esTarget >= typescript_1.ScriptTarget.ES2017) {
                    customOptions.forceAsyncTransformation = !/[\\\/]fesm2015[\\\/]/.test(this.resourcePath) && source.includes('async');
                }
                shouldProcess || (shouldProcess = customOptions.forceAsyncTransformation || customOptions.forceES5);
            }
            // Analyze for i18n inlining
            if (i18n &&
                !/[\\\/]@angular[\\\/](?:compiler|localize)/.test(this.resourcePath) &&
                source.includes('$localize')) {
                customOptions.i18n = i18n;
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
            return {
                ...configuration.options,
                // Workaround for https://github.com/babel/babel-loader/pull/896 is available
                // Delete once the above PR is released
                inputSourceMap: (configuration.options.inputSourceMap || false),
                presets: [
                    ...(configuration.options.presets || []),
                    [
                        require('./presets/application').default,
                        {
                            angularLinker: customOptions.shouldLink,
                            forceES5: customOptions.forceES5,
                            forceAsyncTransformation: customOptions.forceAsyncTransformation,
                            i18n: customOptions.i18n,
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
