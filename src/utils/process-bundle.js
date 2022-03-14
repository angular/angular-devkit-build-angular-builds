"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inlineLocales = exports.createI18nPlugins = void 0;
const remapping_1 = __importDefault(require("@ampproject/remapping"));
const core_1 = require("@babel/core");
const template_1 = __importDefault(require("@babel/template"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const worker_threads_1 = require("worker_threads");
const environment_options_1 = require("./environment-options");
const load_esm_1 = require("./load-esm");
// Lazy loaded webpack-sources object
// Webpack is only imported if needed during the processing
let webpackSources;
const { i18n } = (worker_threads_1.workerData || {});
/**
 * Internal flag to enable the direct usage of the `@angular/localize` translation plugins.
 * Their usage is currently several times slower than the string manipulation method.
 * Future work to optimize the plugins should enable plugin usage as the default.
 */
const USE_LOCALIZE_PLUGINS = false;
/**
 * Cached instance of the `@angular/localize/tools` module.
 * This is used to remove the need to repeatedly import the module per file translation.
 */
let localizeToolsModule;
/**
 * Attempts to load the `@angular/localize/tools` module containing the functionality to
 * perform the file translations.
 * This module must be dynamically loaded as it is an ESM module and this file is CommonJS.
 */
async function loadLocalizeTools() {
    if (localizeToolsModule !== undefined) {
        return localizeToolsModule;
    }
    // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
    // Once TypeScript provides support for keeping the dynamic import this workaround can be
    // changed to a direct dynamic import.
    return (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
}
async function createI18nPlugins(locale, translation, missingTranslation, shouldInline, localeDataContent) {
    const { Diagnostics, makeEs2015TranslatePlugin, makeEs5TranslatePlugin, makeLocalePlugin } = await loadLocalizeTools();
    const plugins = [];
    const diagnostics = new Diagnostics();
    if (shouldInline) {
        plugins.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeEs2015TranslatePlugin(diagnostics, (translation || {}), {
            missingTranslation: translation === undefined ? 'ignore' : missingTranslation,
        }));
        plugins.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeEs5TranslatePlugin(diagnostics, (translation || {}), {
            missingTranslation: translation === undefined ? 'ignore' : missingTranslation,
        }));
    }
    plugins.push(makeLocalePlugin(locale));
    if (localeDataContent) {
        plugins.push({
            visitor: {
                Program(path) {
                    path.unshiftContainer('body', template_1.default.ast(localeDataContent));
                },
            },
        });
    }
    return { diagnostics, plugins };
}
exports.createI18nPlugins = createI18nPlugins;
const localizeName = '$localize';
async function inlineLocales(options) {
    var _a;
    if (!i18n || i18n.inlineLocales.size === 0) {
        return { file: options.filename, diagnostics: [], count: 0 };
    }
    if (i18n.flatOutput && i18n.inlineLocales.size > 1) {
        throw new Error('Flat output is only supported when inlining one locale.');
    }
    const hasLocalizeName = options.code.includes(localizeName);
    if (!hasLocalizeName && !options.setLocale) {
        return inlineCopyOnly(options);
    }
    await loadLocalizeTools();
    let ast;
    try {
        ast = (0, core_1.parseSync)(options.code, {
            babelrc: false,
            configFile: false,
            sourceType: 'script',
            filename: options.filename,
        });
    }
    catch (error) {
        if (error.message) {
            // Make the error more readable.
            // Same errors will contain the full content of the file as the error message
            // Which makes it hard to find the actual error message.
            const index = error.message.indexOf(')\n');
            const msg = index !== -1 ? error.message.substr(0, index + 1) : error.message;
            throw new Error(`${msg}\nAn error occurred inlining file "${options.filename}"`);
        }
    }
    if (!ast) {
        throw new Error(`Unknown error occurred inlining file "${options.filename}"`);
    }
    if (!USE_LOCALIZE_PLUGINS) {
        return inlineLocalesDirect(ast, options);
    }
    const diagnostics = [];
    for (const locale of i18n.inlineLocales) {
        const isSourceLocale = locale === i18n.sourceLocale;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const translations = isSourceLocale ? {} : i18n.locales[locale].translation || {};
        let localeDataContent;
        if (options.setLocale) {
            // If locale data is provided, load it and prepend to file
            const localeDataPath = (_a = i18n.locales[locale]) === null || _a === void 0 ? void 0 : _a.dataPath;
            if (localeDataPath) {
                localeDataContent = await loadLocaleData(localeDataPath, true, options.es5);
            }
        }
        const { diagnostics: localeDiagnostics, plugins } = await createI18nPlugins(locale, translations, isSourceLocale ? 'ignore' : options.missingTranslation || 'warning', true, localeDataContent);
        const transformResult = await (0, core_1.transformFromAstSync)(ast, options.code, {
            filename: options.filename,
            // using false ensures that babel will NOT search and process sourcemap comments (large memory usage)
            // The types do not include the false option even though it is valid
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            inputSourceMap: false,
            babelrc: false,
            configFile: false,
            plugins,
            compact: !environment_options_1.shouldBeautify,
            sourceMaps: !!options.map,
        });
        diagnostics.push(...localeDiagnostics.messages);
        if (!transformResult || !transformResult.code) {
            throw new Error(`Unknown error occurred processing bundle for "${options.filename}".`);
        }
        const outputPath = path.join(options.outputPath, i18n.flatOutput ? '' : locale, options.filename);
        fs.writeFileSync(outputPath, transformResult.code);
        if (options.map && transformResult.map) {
            const outputMap = (0, remapping_1.default)([transformResult.map, options.map], () => null);
            fs.writeFileSync(outputPath + '.map', JSON.stringify(outputMap));
        }
    }
    return { file: options.filename, diagnostics };
}
exports.inlineLocales = inlineLocales;
async function inlineLocalesDirect(ast, options) {
    if (!i18n || i18n.inlineLocales.size === 0) {
        return { file: options.filename, diagnostics: [], count: 0 };
    }
    const { default: generate } = await Promise.resolve().then(() => __importStar(require('@babel/generator')));
    const localizeDiag = await loadLocalizeTools();
    const diagnostics = new localizeDiag.Diagnostics();
    const positions = findLocalizePositions(ast, options, localizeDiag);
    if (positions.length === 0 && !options.setLocale) {
        return inlineCopyOnly(options);
    }
    const inputMap = !!options.map && JSON.parse(options.map);
    // Cleanup source root otherwise it will be added to each source entry
    const mapSourceRoot = inputMap && inputMap.sourceRoot;
    if (inputMap) {
        delete inputMap.sourceRoot;
    }
    // Load Webpack only when needed
    if (webpackSources === undefined) {
        webpackSources = (await Promise.resolve().then(() => __importStar(require('webpack')))).sources;
    }
    const { ConcatSource, OriginalSource, ReplaceSource, SourceMapSource } = webpackSources;
    for (const locale of i18n.inlineLocales) {
        const content = new ReplaceSource(inputMap
            ? new SourceMapSource(options.code, options.filename, inputMap)
            : new OriginalSource(options.code, options.filename));
        const isSourceLocale = locale === i18n.sourceLocale;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const translations = isSourceLocale ? {} : i18n.locales[locale].translation || {};
        for (const position of positions) {
            const translated = localizeDiag.translate(diagnostics, translations, position.messageParts, position.expressions, isSourceLocale ? 'ignore' : options.missingTranslation || 'warning');
            const expression = localizeDiag.buildLocalizeReplacement(translated[0], translated[1]);
            const { code } = generate(expression);
            content.replace(position.start, position.end - 1, code);
        }
        let outputSource = content;
        if (options.setLocale) {
            const setLocaleText = `var $localize=Object.assign(void 0===$localize?{}:$localize,{locale:"${locale}"});\n`;
            // If locale data is provided, load it and prepend to file
            let localeDataSource;
            const localeDataPath = i18n.locales[locale] && i18n.locales[locale].dataPath;
            if (localeDataPath) {
                const localeDataContent = await loadLocaleData(localeDataPath, true, options.es5);
                localeDataSource = new OriginalSource(localeDataContent, path.basename(localeDataPath));
            }
            outputSource = localeDataSource
                ? // The semicolon ensures that there is no syntax error between statements
                    new ConcatSource(setLocaleText, localeDataSource, ';\n', content)
                : new ConcatSource(setLocaleText, content);
        }
        const { source: outputCode, map: outputMap } = outputSource.sourceAndMap();
        const outputPath = path.join(options.outputPath, i18n.flatOutput ? '' : locale, options.filename);
        fs.writeFileSync(outputPath, outputCode);
        if (inputMap && outputMap) {
            outputMap.file = options.filename;
            if (mapSourceRoot) {
                outputMap.sourceRoot = mapSourceRoot;
            }
            fs.writeFileSync(outputPath + '.map', JSON.stringify(outputMap));
        }
    }
    return { file: options.filename, diagnostics: diagnostics.messages, count: positions.length };
}
function inlineCopyOnly(options) {
    if (!i18n) {
        throw new Error('i18n options are missing');
    }
    for (const locale of i18n.inlineLocales) {
        const outputPath = path.join(options.outputPath, i18n.flatOutput ? '' : locale, options.filename);
        fs.writeFileSync(outputPath, options.code);
        if (options.map) {
            fs.writeFileSync(outputPath + '.map', options.map);
        }
    }
    return { file: options.filename, diagnostics: [], count: 0 };
}
function findLocalizePositions(ast, options, utils) {
    const positions = [];
    // Workaround to ensure a path hub is present for traversal
    const { File } = require('@babel/core');
    const file = new File({}, { code: options.code, ast });
    if (options.es5) {
        (0, core_1.traverse)(file.ast, {
            CallExpression(path) {
                const callee = path.get('callee');
                if (callee.isIdentifier() &&
                    callee.node.name === localizeName &&
                    utils.isGlobalIdentifier(callee)) {
                    const [messageParts, expressions] = unwrapLocalizeCall(path, utils);
                    positions.push({
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        start: path.node.start,
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        end: path.node.end,
                        messageParts,
                        expressions,
                    });
                }
            },
        });
    }
    else {
        (0, core_1.traverse)(file.ast, {
            TaggedTemplateExpression(path) {
                if (core_1.types.isIdentifier(path.node.tag) && path.node.tag.name === localizeName) {
                    const [messageParts, expressions] = unwrapTemplateLiteral(path, utils);
                    positions.push({
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        start: path.node.start,
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        end: path.node.end,
                        messageParts,
                        expressions,
                    });
                }
            },
        });
    }
    return positions;
}
function unwrapTemplateLiteral(path, utils) {
    const [messageParts] = utils.unwrapMessagePartsFromTemplateLiteral(path.get('quasi').get('quasis'));
    const [expressions] = utils.unwrapExpressionsFromTemplateLiteral(path.get('quasi'));
    return [messageParts, expressions];
}
function unwrapLocalizeCall(path, utils) {
    const [messageParts] = utils.unwrapMessagePartsFromLocalizeCall(path);
    const [expressions] = utils.unwrapSubstitutionsFromLocalizeCall(path);
    return [messageParts, expressions];
}
async function loadLocaleData(path, optimize, es5) {
    // The path is validated during option processing before the build starts
    const content = fs.readFileSync(path, 'utf8');
    // Downlevel and optimize the data
    const transformResult = await (0, core_1.transformAsync)(content, {
        filename: path,
        // The types do not include the false option even though it is valid
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSourceMap: false,
        babelrc: false,
        configFile: false,
        presets: [
            [
                require.resolve('@babel/preset-env'),
                {
                    bugfixes: true,
                    // IE 11 is the oldest supported browser
                    targets: es5 ? { ie: '11' } : { esmodules: true },
                },
            ],
        ],
        minified: environment_options_1.allowMinify && optimize,
        compact: !environment_options_1.shouldBeautify && optimize,
        comments: !optimize,
    });
    if (!transformResult || !transformResult.code) {
        throw new Error(`Unknown error occurred processing bundle for "${path}".`);
    }
    return transformResult.code;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsc0VBQThDO0FBQzlDLHNDQVFxQjtBQUNyQiwrREFBOEM7QUFDOUMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QixtREFBNEM7QUFDNUMsK0RBQW9FO0FBRXBFLHlDQUEyQztBQUszQyxxQ0FBcUM7QUFDckMsMkRBQTJEO0FBQzNELElBQUksY0FBNEQsQ0FBQztBQUVqRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQywyQkFBVSxJQUFJLEVBQUUsQ0FBMkIsQ0FBQztBQUU5RDs7OztHQUlHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxLQUFLLENBQUM7QUFJbkM7OztHQUdHO0FBQ0gsSUFBSSxtQkFBc0QsQ0FBQztBQUUzRDs7OztHQUlHO0FBQ0gsS0FBSyxVQUFVLGlCQUFpQjtJQUM5QixJQUFJLG1CQUFtQixLQUFLLFNBQVMsRUFBRTtRQUNyQyxPQUFPLG1CQUFtQixDQUFDO0tBQzVCO0lBRUQscUZBQXFGO0lBQ3JGLHlGQUF5RjtJQUN6RixzQ0FBc0M7SUFDdEMsT0FBTyxJQUFBLHdCQUFhLEVBQUMseUJBQXlCLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBRU0sS0FBSyxVQUFVLGlCQUFpQixDQUNyQyxNQUFjLEVBQ2QsV0FBZ0MsRUFDaEMsa0JBQWtELEVBQ2xELFlBQXFCLEVBQ3JCLGlCQUEwQjtJQUUxQixNQUFNLEVBQUUsV0FBVyxFQUFFLHlCQUF5QixFQUFFLHNCQUFzQixFQUFFLGdCQUFnQixFQUFFLEdBQ3hGLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUU1QixNQUFNLE9BQU8sR0FB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O1FBQ3BDLFFBQVEsRUFBRSxDQUFDLFFBQVE7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUU7UUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUM1RTtJQUVELE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCByZW1hcHBpbmcgZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCB7XG4gIE5vZGVQYXRoLFxuICBQYXJzZVJlc3VsdCxcbiAgcGFyc2VTeW5jLFxuICB0cmFuc2Zvcm1Bc3luYyxcbiAgdHJhbnNmb3JtRnJvbUFzdFN5bmMsXG4gIHRyYXZlcnNlLFxuICB0eXBlcyxcbn0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IHRlbXBsYXRlQnVpbGRlciBmcm9tICdAYmFiZWwvdGVtcGxhdGUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgeyBhbGxvd01pbmlmeSwgc2hvdWxkQmVhdXRpZnkgfSBmcm9tICcuL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi9sb2FkLWVzbSc7XG5cbi8vIEV4dHJhY3QgU291cmNlbWFwIGlucHV0IHR5cGUgZnJvbSB0aGUgcmVtYXBwaW5nIGZ1bmN0aW9uIHNpbmNlIGl0IGlzIG5vdCBjdXJyZW50bHkgZXhwb3J0ZWRcbnR5cGUgU291cmNlTWFwSW5wdXQgPSBFeGNsdWRlPFBhcmFtZXRlcnM8dHlwZW9mIHJlbWFwcGluZz5bMF0sIHVua25vd25bXT47XG5cbi8vIExhenkgbG9hZGVkIHdlYnBhY2stc291cmNlcyBvYmplY3Rcbi8vIFdlYnBhY2sgaXMgb25seSBpbXBvcnRlZCBpZiBuZWVkZWQgZHVyaW5nIHRoZSBwcm9jZXNzaW5nXG5sZXQgd2VicGFja1NvdXJjZXM6IHR5cGVvZiBpbXBvcnQoJ3dlYnBhY2snKS5zb3VyY2VzIHwgdW5kZWZpbmVkO1xuXG5jb25zdCB7IGkxOG4gfSA9ICh3b3JrZXJEYXRhIHx8IHt9KSBhcyB7IGkxOG4/OiBJMThuT3B0aW9ucyB9O1xuXG4vKipcbiAqIEludGVybmFsIGZsYWcgdG8gZW5hYmxlIHRoZSBkaXJlY3QgdXNhZ2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgdHJhbnNsYXRpb24gcGx1Z2lucy5cbiAqIFRoZWlyIHVzYWdlIGlzIGN1cnJlbnRseSBzZXZlcmFsIHRpbWVzIHNsb3dlciB0aGFuIHRoZSBzdHJpbmcgbWFuaXB1bGF0aW9uIG1ldGhvZC5cbiAqIEZ1dHVyZSB3b3JrIHRvIG9wdGltaXplIHRoZSBwbHVnaW5zIHNob3VsZCBlbmFibGUgcGx1Z2luIHVzYWdlIGFzIHRoZSBkZWZhdWx0LlxuICovXG5jb25zdCBVU0VfTE9DQUxJWkVfUExVR0lOUyA9IGZhbHNlO1xuXG50eXBlIExvY2FsaXplVXRpbGl0eU1vZHVsZSA9IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIG1vZHVsZS5cbiAqIFRoaXMgaXMgdXNlZCB0byByZW1vdmUgdGhlIG5lZWQgdG8gcmVwZWF0ZWRseSBpbXBvcnQgdGhlIG1vZHVsZSBwZXIgZmlsZSB0cmFuc2xhdGlvbi5cbiAqL1xubGV0IGxvY2FsaXplVG9vbHNNb2R1bGU6IExvY2FsaXplVXRpbGl0eU1vZHVsZSB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBdHRlbXB0cyB0byBsb2FkIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIG1vZHVsZSBjb250YWluaW5nIHRoZSBmdW5jdGlvbmFsaXR5IHRvXG4gKiBwZXJmb3JtIHRoZSBmaWxlIHRyYW5zbGF0aW9ucy5cbiAqIFRoaXMgbW9kdWxlIG11c3QgYmUgZHluYW1pY2FsbHkgbG9hZGVkIGFzIGl0IGlzIGFuIEVTTSBtb2R1bGUgYW5kIHRoaXMgZmlsZSBpcyBDb21tb25KUy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gbG9hZExvY2FsaXplVG9vbHMoKTogUHJvbWlzZTxMb2NhbGl6ZVV0aWxpdHlNb2R1bGU+IHtcbiAgaWYgKGxvY2FsaXplVG9vbHNNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuICB9XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICByZXR1cm4gbG9hZEVzbU1vZHVsZSgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUkxOG5QbHVnaW5zKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgdHJhbnNsYXRpb246IHVua25vd24gfCB1bmRlZmluZWQsXG4gIG1pc3NpbmdUcmFuc2xhdGlvbjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnLFxuICBzaG91bGRJbmxpbmU6IGJvb2xlYW4sXG4gIGxvY2FsZURhdGFDb250ZW50Pzogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IHsgRGlhZ25vc3RpY3MsIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sIG1ha2VFczVUcmFuc2xhdGVQbHVnaW4sIG1ha2VMb2NhbGVQbHVnaW4gfSA9XG4gICAgYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IERpYWdub3N0aWNzKCk7XG5cbiAgaWYgKHNob3VsZElubGluZSkge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCAodHJhbnNsYXRpb24gfHwge30pIGFzIGFueSwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IHRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQgPyAnaWdub3JlJyA6IG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgKHRyYW5zbGF0aW9uIHx8IHt9KSBhcyBhbnksIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiB0cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkID8gJ2lnbm9yZScgOiBtaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcGx1Z2lucy5wdXNoKG1ha2VMb2NhbGVQbHVnaW4obG9jYWxlKSk7XG5cbiAgaWYgKGxvY2FsZURhdGFDb250ZW50KSB7XG4gICAgcGx1Z2lucy5wdXNoKHtcbiAgICAgIHZpc2l0b3I6IHtcbiAgICAgICAgUHJvZ3JhbShwYXRoOiBOb2RlUGF0aDx0eXBlcy5Qcm9ncmFtPikge1xuICAgICAgICAgIHBhdGgudW5zaGlmdENvbnRhaW5lcignYm9keScsIHRlbXBsYXRlQnVpbGRlci5hc3QobG9jYWxlRGF0YUNvbnRlbnQpKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4geyBkaWFnbm9zdGljcywgcGx1Z2lucyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZU9wdGlvbnMge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBjb2RlOiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZXM1OiBib29sZWFuO1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIG1pc3NpbmdUcmFuc2xhdGlvbj86ICd3YXJuaW5nJyB8ICdlcnJvcicgfCAnaWdub3JlJztcbiAgc2V0TG9jYWxlPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvY2FsaXplUG9zaXRpb24ge1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbiAgbWVzc2FnZVBhcnRzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheTtcbiAgZXhwcmVzc2lvbnM6IHR5cGVzLkV4cHJlc3Npb25bXTtcbn1cblxuY29uc3QgbG9jYWxpemVOYW1lID0gJyRsb2NhbGl6ZSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzKG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG4gIGlmIChpMThuLmZsYXRPdXRwdXQgJiYgaTE4bi5pbmxpbmVMb2NhbGVzLnNpemUgPiAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGbGF0IG91dHB1dCBpcyBvbmx5IHN1cHBvcnRlZCB3aGVuIGlubGluaW5nIG9uZSBsb2NhbGUuJyk7XG4gIH1cblxuICBjb25zdCBoYXNMb2NhbGl6ZU5hbWUgPSBvcHRpb25zLmNvZGUuaW5jbHVkZXMobG9jYWxpemVOYW1lKTtcbiAgaWYgKCFoYXNMb2NhbGl6ZU5hbWUgJiYgIW9wdGlvbnMuc2V0TG9jYWxlKSB7XG4gICAgcmV0dXJuIGlubGluZUNvcHlPbmx5KG9wdGlvbnMpO1xuICB9XG5cbiAgYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBsZXQgYXN0OiBQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZCB8IG51bGw7XG4gIHRyeSB7XG4gICAgYXN0ID0gcGFyc2VTeW5jKG9wdGlvbnMuY29kZSwge1xuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHNvdXJjZVR5cGU6ICdzY3JpcHQnLFxuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLm1lc3NhZ2UpIHtcbiAgICAgIC8vIE1ha2UgdGhlIGVycm9yIG1vcmUgcmVhZGFibGUuXG4gICAgICAvLyBTYW1lIGVycm9ycyB3aWxsIGNvbnRhaW4gdGhlIGZ1bGwgY29udGVudCBvZiB0aGUgZmlsZSBhcyB0aGUgZXJyb3IgbWVzc2FnZVxuICAgICAgLy8gV2hpY2ggbWFrZXMgaXQgaGFyZCB0byBmaW5kIHRoZSBhY3R1YWwgZXJyb3IgbWVzc2FnZS5cbiAgICAgIGNvbnN0IGluZGV4ID0gZXJyb3IubWVzc2FnZS5pbmRleE9mKCcpXFxuJyk7XG4gICAgICBjb25zdCBtc2cgPSBpbmRleCAhPT0gLTEgPyBlcnJvci5tZXNzYWdlLnN1YnN0cigwLCBpbmRleCArIDEpIDogZXJyb3IubWVzc2FnZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgJHttc2d9XFxuQW4gZXJyb3Igb2NjdXJyZWQgaW5saW5pbmcgZmlsZSBcIiR7b3B0aW9ucy5maWxlbmFtZX1cImApO1xuICAgIH1cbiAgfVxuXG4gIGlmICghYXN0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVycm9yIG9jY3VycmVkIGlubGluaW5nIGZpbGUgXCIke29wdGlvbnMuZmlsZW5hbWV9XCJgKTtcbiAgfVxuXG4gIGlmICghVVNFX0xPQ0FMSVpFX1BMVUdJTlMpIHtcbiAgICByZXR1cm4gaW5saW5lTG9jYWxlc0RpcmVjdChhc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgY29uc3QgZGlhZ25vc3RpY3MgPSBbXTtcbiAgZm9yIChjb25zdCBsb2NhbGUgb2YgaTE4bi5pbmxpbmVMb2NhbGVzKSB7XG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgbGV0IGxvY2FsZURhdGFDb250ZW50O1xuICAgIGlmIChvcHRpb25zLnNldExvY2FsZSkge1xuICAgICAgLy8gSWYgbG9jYWxlIGRhdGEgaXMgcHJvdmlkZWQsIGxvYWQgaXQgYW5kIHByZXBlbmQgdG8gZmlsZVxuICAgICAgY29uc3QgbG9jYWxlRGF0YVBhdGggPSBpMThuLmxvY2FsZXNbbG9jYWxlXT8uZGF0YVBhdGg7XG4gICAgICBpZiAobG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgICAgbG9jYWxlRGF0YUNvbnRlbnQgPSBhd2FpdCBsb2FkTG9jYWxlRGF0YShsb2NhbGVEYXRhUGF0aCwgdHJ1ZSwgb3B0aW9ucy5lczUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHsgZGlhZ25vc3RpY3M6IGxvY2FsZURpYWdub3N0aWNzLCBwbHVnaW5zIH0gPSBhd2FpdCBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9ucyxcbiAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICB0cnVlLFxuICAgICAgbG9jYWxlRGF0YUNvbnRlbnQsXG4gICAgKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Gcm9tQXN0U3luYyhhc3QsIG9wdGlvbnMuY29kZSwge1xuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgICAvLyB1c2luZyBmYWxzZSBlbnN1cmVzIHRoYXQgYmFiZWwgd2lsbCBOT1Qgc2VhcmNoIGFuZCBwcm9jZXNzIHNvdXJjZW1hcCBjb21tZW50cyAobGFyZ2UgbWVtb3J5IHVzYWdlKVxuICAgICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHBsdWdpbnMsXG4gICAgICBjb21wYWN0OiAhc2hvdWxkQmVhdXRpZnksXG4gICAgICBzb3VyY2VNYXBzOiAhIW9wdGlvbnMubWFwLFxuICAgIH0pO1xuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5sb2NhbGVEaWFnbm9zdGljcy5tZXNzYWdlcyk7XG5cbiAgICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke29wdGlvbnMuZmlsZW5hbWV9XCIuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihcbiAgICAgIG9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIGkxOG4uZmxhdE91dHB1dCA/ICcnIDogbG9jYWxlLFxuICAgICAgb3B0aW9ucy5maWxlbmFtZSxcbiAgICApO1xuICAgIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCwgdHJhbnNmb3JtUmVzdWx0LmNvZGUpO1xuXG4gICAgaWYgKG9wdGlvbnMubWFwICYmIHRyYW5zZm9ybVJlc3VsdC5tYXApIHtcbiAgICAgIGNvbnN0IG91dHB1dE1hcCA9IHJlbWFwcGluZyhbdHJhbnNmb3JtUmVzdWx0Lm1hcCBhcyBTb3VyY2VNYXBJbnB1dCwgb3B0aW9ucy5tYXBdLCAoKSA9PiBudWxsKTtcblxuICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoICsgJy5tYXAnLCBKU09OLnN0cmluZ2lmeShvdXRwdXRNYXApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljcyB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzRGlyZWN0KGFzdDogUGFyc2VSZXN1bHQsIG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG5cbiAgY29uc3QgeyBkZWZhdWx0OiBnZW5lcmF0ZSB9ID0gYXdhaXQgaW1wb3J0KCdAYmFiZWwvZ2VuZXJhdG9yJyk7XG4gIGNvbnN0IGxvY2FsaXplRGlhZyA9IGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IGxvY2FsaXplRGlhZy5EaWFnbm9zdGljcygpO1xuXG4gIGNvbnN0IHBvc2l0aW9ucyA9IGZpbmRMb2NhbGl6ZVBvc2l0aW9ucyhhc3QsIG9wdGlvbnMsIGxvY2FsaXplRGlhZyk7XG4gIGlmIChwb3NpdGlvbnMubGVuZ3RoID09PSAwICYmICFvcHRpb25zLnNldExvY2FsZSkge1xuICAgIHJldHVybiBpbmxpbmVDb3B5T25seShvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGlucHV0TWFwID0gISFvcHRpb25zLm1hcCAmJiAoSlNPTi5wYXJzZShvcHRpb25zLm1hcCkgYXMgeyBzb3VyY2VSb290Pzogc3RyaW5nIH0pO1xuICAvLyBDbGVhbnVwIHNvdXJjZSByb290IG90aGVyd2lzZSBpdCB3aWxsIGJlIGFkZGVkIHRvIGVhY2ggc291cmNlIGVudHJ5XG4gIGNvbnN0IG1hcFNvdXJjZVJvb3QgPSBpbnB1dE1hcCAmJiBpbnB1dE1hcC5zb3VyY2VSb290O1xuICBpZiAoaW5wdXRNYXApIHtcbiAgICBkZWxldGUgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgfVxuXG4gIC8vIExvYWQgV2VicGFjayBvbmx5IHdoZW4gbmVlZGVkXG4gIGlmICh3ZWJwYWNrU291cmNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgd2VicGFja1NvdXJjZXMgPSAoYXdhaXQgaW1wb3J0KCd3ZWJwYWNrJykpLnNvdXJjZXM7XG4gIH1cbiAgY29uc3QgeyBDb25jYXRTb3VyY2UsIE9yaWdpbmFsU291cmNlLCBSZXBsYWNlU291cmNlLCBTb3VyY2VNYXBTb3VyY2UgfSA9IHdlYnBhY2tTb3VyY2VzO1xuXG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBuZXcgUmVwbGFjZVNvdXJjZShcbiAgICAgIGlucHV0TWFwXG4gICAgICAgID8gbmV3IFNvdXJjZU1hcFNvdXJjZShvcHRpb25zLmNvZGUsIG9wdGlvbnMuZmlsZW5hbWUsIGlucHV0TWFwKVxuICAgICAgICA6IG5ldyBPcmlnaW5hbFNvdXJjZShvcHRpb25zLmNvZGUsIG9wdGlvbnMuZmlsZW5hbWUpLFxuICAgICk7XG5cbiAgICBjb25zdCBpc1NvdXJjZUxvY2FsZSA9IGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGU7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCB0cmFuc2xhdGlvbnM6IGFueSA9IGlzU291cmNlTG9jYWxlID8ge30gOiBpMThuLmxvY2FsZXNbbG9jYWxlXS50cmFuc2xhdGlvbiB8fCB7fTtcbiAgICBmb3IgKGNvbnN0IHBvc2l0aW9uIG9mIHBvc2l0aW9ucykge1xuICAgICAgY29uc3QgdHJhbnNsYXRlZCA9IGxvY2FsaXplRGlhZy50cmFuc2xhdGUoXG4gICAgICAgIGRpYWdub3N0aWNzLFxuICAgICAgICB0cmFuc2xhdGlvbnMsXG4gICAgICAgIHBvc2l0aW9uLm1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgcG9zaXRpb24uZXhwcmVzc2lvbnMsXG4gICAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICApO1xuXG4gICAgICBjb25zdCBleHByZXNzaW9uID0gbG9jYWxpemVEaWFnLmJ1aWxkTG9jYWxpemVSZXBsYWNlbWVudCh0cmFuc2xhdGVkWzBdLCB0cmFuc2xhdGVkWzFdKTtcbiAgICAgIGNvbnN0IHsgY29kZSB9ID0gZ2VuZXJhdGUoZXhwcmVzc2lvbik7XG5cbiAgICAgIGNvbnRlbnQucmVwbGFjZShwb3NpdGlvbi5zdGFydCwgcG9zaXRpb24uZW5kIC0gMSwgY29kZSk7XG4gICAgfVxuXG4gICAgbGV0IG91dHB1dFNvdXJjZTogaW1wb3J0KCd3ZWJwYWNrJykuc291cmNlcy5Tb3VyY2UgPSBjb250ZW50O1xuICAgIGlmIChvcHRpb25zLnNldExvY2FsZSkge1xuICAgICAgY29uc3Qgc2V0TG9jYWxlVGV4dCA9IGB2YXIgJGxvY2FsaXplPU9iamVjdC5hc3NpZ24odm9pZCAwPT09JGxvY2FsaXplP3t9OiRsb2NhbGl6ZSx7bG9jYWxlOlwiJHtsb2NhbGV9XCJ9KTtcXG5gO1xuXG4gICAgICAvLyBJZiBsb2NhbGUgZGF0YSBpcyBwcm92aWRlZCwgbG9hZCBpdCBhbmQgcHJlcGVuZCB0byBmaWxlXG4gICAgICBsZXQgbG9jYWxlRGF0YVNvdXJjZTtcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0uZGF0YVBhdGg7XG4gICAgICBpZiAobG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgICAgY29uc3QgbG9jYWxlRGF0YUNvbnRlbnQgPSBhd2FpdCBsb2FkTG9jYWxlRGF0YShsb2NhbGVEYXRhUGF0aCwgdHJ1ZSwgb3B0aW9ucy5lczUpO1xuICAgICAgICBsb2NhbGVEYXRhU291cmNlID0gbmV3IE9yaWdpbmFsU291cmNlKGxvY2FsZURhdGFDb250ZW50LCBwYXRoLmJhc2VuYW1lKGxvY2FsZURhdGFQYXRoKSk7XG4gICAgICB9XG5cbiAgICAgIG91dHB1dFNvdXJjZSA9IGxvY2FsZURhdGFTb3VyY2VcbiAgICAgICAgPyAvLyBUaGUgc2VtaWNvbG9uIGVuc3VyZXMgdGhhdCB0aGVyZSBpcyBubyBzeW50YXggZXJyb3IgYmV0d2VlbiBzdGF0ZW1lbnRzXG4gICAgICAgICAgbmV3IENvbmNhdFNvdXJjZShzZXRMb2NhbGVUZXh0LCBsb2NhbGVEYXRhU291cmNlLCAnO1xcbicsIGNvbnRlbnQpXG4gICAgICAgIDogbmV3IENvbmNhdFNvdXJjZShzZXRMb2NhbGVUZXh0LCBjb250ZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHNvdXJjZTogb3V0cHV0Q29kZSwgbWFwOiBvdXRwdXRNYXAgfSA9IG91dHB1dFNvdXJjZS5zb3VyY2VBbmRNYXAoKSBhcyB7XG4gICAgICBzb3VyY2U6IHN0cmluZztcbiAgICAgIG1hcDogeyBmaWxlOiBzdHJpbmc7IHNvdXJjZVJvb3Q/OiBzdHJpbmcgfTtcbiAgICB9O1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIG91dHB1dENvZGUpO1xuXG4gICAgaWYgKGlucHV0TWFwICYmIG91dHB1dE1hcCkge1xuICAgICAgb3V0cHV0TWFwLmZpbGUgPSBvcHRpb25zLmZpbGVuYW1lO1xuICAgICAgaWYgKG1hcFNvdXJjZVJvb3QpIHtcbiAgICAgICAgb3V0cHV0TWFwLnNvdXJjZVJvb3QgPSBtYXBTb3VyY2VSb290O1xuICAgICAgfVxuICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoICsgJy5tYXAnLCBKU09OLnN0cmluZ2lmeShvdXRwdXRNYXApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljczogZGlhZ25vc3RpY3MubWVzc2FnZXMsIGNvdW50OiBwb3NpdGlvbnMubGVuZ3RoIH07XG59XG5cbmZ1bmN0aW9uIGlubGluZUNvcHlPbmx5KG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpMThuIG9wdGlvbnMgYXJlIG1pc3NpbmcnKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIG9wdGlvbnMuY29kZSk7XG4gICAgaWYgKG9wdGlvbnMubWFwKSB7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGggKyAnLm1hcCcsIG9wdGlvbnMubWFwKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljczogW10sIGNvdW50OiAwIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRMb2NhbGl6ZVBvc2l0aW9ucyhcbiAgYXN0OiBQYXJzZVJlc3VsdCxcbiAgb3B0aW9uczogSW5saW5lT3B0aW9ucyxcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IExvY2FsaXplUG9zaXRpb25bXSB7XG4gIGNvbnN0IHBvc2l0aW9uczogTG9jYWxpemVQb3NpdGlvbltdID0gW107XG5cbiAgLy8gV29ya2Fyb3VuZCB0byBlbnN1cmUgYSBwYXRoIGh1YiBpcyBwcmVzZW50IGZvciB0cmF2ZXJzYWxcbiAgY29uc3QgeyBGaWxlIH0gPSByZXF1aXJlKCdAYmFiZWwvY29yZScpO1xuICBjb25zdCBmaWxlID0gbmV3IEZpbGUoe30sIHsgY29kZTogb3B0aW9ucy5jb2RlLCBhc3QgfSk7XG5cbiAgaWYgKG9wdGlvbnMuZXM1KSB7XG4gICAgdHJhdmVyc2UoZmlsZS5hc3QsIHtcbiAgICAgIENhbGxFeHByZXNzaW9uKHBhdGgpIHtcbiAgICAgICAgY29uc3QgY2FsbGVlID0gcGF0aC5nZXQoJ2NhbGxlZScpO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY2FsbGVlLmlzSWRlbnRpZmllcigpICYmXG4gICAgICAgICAgY2FsbGVlLm5vZGUubmFtZSA9PT0gbG9jYWxpemVOYW1lICYmXG4gICAgICAgICAgdXRpbHMuaXNHbG9iYWxJZGVudGlmaWVyKGNhbGxlZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdID0gdW53cmFwTG9jYWxpemVDYWxsKHBhdGgsIHV0aWxzKTtcbiAgICAgICAgICBwb3NpdGlvbnMucHVzaCh7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgc3RhcnQ6IHBhdGgubm9kZS5zdGFydCEsXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgZW5kOiBwYXRoLm5vZGUuZW5kISxcbiAgICAgICAgICAgIG1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgICAgIGV4cHJlc3Npb25zLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHRyYXZlcnNlKGZpbGUuYXN0LCB7XG4gICAgICBUYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24ocGF0aCkge1xuICAgICAgICBpZiAodHlwZXMuaXNJZGVudGlmaWVyKHBhdGgubm9kZS50YWcpICYmIHBhdGgubm9kZS50YWcubmFtZSA9PT0gbG9jYWxpemVOYW1lKSB7XG4gICAgICAgICAgY29uc3QgW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdID0gdW53cmFwVGVtcGxhdGVMaXRlcmFsKHBhdGgsIHV0aWxzKTtcbiAgICAgICAgICBwb3NpdGlvbnMucHVzaCh7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgc3RhcnQ6IHBhdGgubm9kZS5zdGFydCEsXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgZW5kOiBwYXRoLm5vZGUuZW5kISxcbiAgICAgICAgICAgIG1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgICAgIGV4cHJlc3Npb25zLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHBvc2l0aW9ucztcbn1cblxuZnVuY3Rpb24gdW53cmFwVGVtcGxhdGVMaXRlcmFsKFxuICBwYXRoOiBOb2RlUGF0aDx0eXBlcy5UYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24+LFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogW1RlbXBsYXRlU3RyaW5nc0FycmF5LCB0eXBlcy5FeHByZXNzaW9uW11dIHtcbiAgY29uc3QgW21lc3NhZ2VQYXJ0c10gPSB1dGlscy51bndyYXBNZXNzYWdlUGFydHNGcm9tVGVtcGxhdGVMaXRlcmFsKFxuICAgIHBhdGguZ2V0KCdxdWFzaScpLmdldCgncXVhc2lzJyksXG4gICk7XG4gIGNvbnN0IFtleHByZXNzaW9uc10gPSB1dGlscy51bndyYXBFeHByZXNzaW9uc0Zyb21UZW1wbGF0ZUxpdGVyYWwocGF0aC5nZXQoJ3F1YXNpJykpO1xuXG4gIHJldHVybiBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc107XG59XG5cbmZ1bmN0aW9uIHVud3JhcExvY2FsaXplQ2FsbChcbiAgcGF0aDogTm9kZVBhdGg8dHlwZXMuQ2FsbEV4cHJlc3Npb24+LFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogW1RlbXBsYXRlU3RyaW5nc0FycmF5LCB0eXBlcy5FeHByZXNzaW9uW11dIHtcbiAgY29uc3QgW21lc3NhZ2VQYXJ0c10gPSB1dGlscy51bndyYXBNZXNzYWdlUGFydHNGcm9tTG9jYWxpemVDYWxsKHBhdGgpO1xuICBjb25zdCBbZXhwcmVzc2lvbnNdID0gdXRpbHMudW53cmFwU3Vic3RpdHV0aW9uc0Zyb21Mb2NhbGl6ZUNhbGwocGF0aCk7XG5cbiAgcmV0dXJuIFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZExvY2FsZURhdGEocGF0aDogc3RyaW5nLCBvcHRpbWl6ZTogYm9vbGVhbiwgZXM1OiBib29sZWFuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgLy8gVGhlIHBhdGggaXMgdmFsaWRhdGVkIGR1cmluZyBvcHRpb24gcHJvY2Vzc2luZyBiZWZvcmUgdGhlIGJ1aWxkIHN0YXJ0c1xuICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4Jyk7XG5cbiAgLy8gRG93bmxldmVsIGFuZCBvcHRpbWl6ZSB0aGUgZGF0YVxuICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhjb250ZW50LCB7XG4gICAgZmlsZW5hbWU6IHBhdGgsXG4gICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSBhcyBhbnksXG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgcHJlc2V0czogW1xuICAgICAgW1xuICAgICAgICByZXF1aXJlLnJlc29sdmUoJ0BiYWJlbC9wcmVzZXQtZW52JyksXG4gICAgICAgIHtcbiAgICAgICAgICBidWdmaXhlczogdHJ1ZSxcbiAgICAgICAgICAvLyBJRSAxMSBpcyB0aGUgb2xkZXN0IHN1cHBvcnRlZCBicm93c2VyXG4gICAgICAgICAgdGFyZ2V0czogZXM1ID8geyBpZTogJzExJyB9IDogeyBlc21vZHVsZXM6IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgXSxcbiAgICBtaW5pZmllZDogYWxsb3dNaW5pZnkgJiYgb3B0aW1pemUsXG4gICAgY29tcGFjdDogIXNob3VsZEJlYXV0aWZ5ICYmIG9wdGltaXplLFxuICAgIGNvbW1lbnRzOiAhb3B0aW1pemUsXG4gIH0pO1xuXG4gIGlmICghdHJhbnNmb3JtUmVzdWx0IHx8ICF0cmFuc2Zvcm1SZXN1bHQuY29kZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke3BhdGh9XCIuYCk7XG4gIH1cblxuICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0LmNvZGU7XG59XG4iXX0=