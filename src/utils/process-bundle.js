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
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
            const msg = index !== -1 ? error.message.slice(0, index + 1) : error.message;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNFQUE4QztBQUM5QyxzQ0FRcUI7QUFDckIsK0RBQThDO0FBQzlDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsbURBQTRDO0FBQzVDLCtEQUFvRTtBQUVwRSx5Q0FBMkM7QUFLM0MscUNBQXFDO0FBQ3JDLDJEQUEyRDtBQUMzRCxJQUFJLGNBQTRELENBQUM7QUFFakUsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsMkJBQVUsSUFBSSxFQUFFLENBQTJCLENBQUM7QUFFOUQ7Ozs7R0FJRztBQUNILE1BQU0sb0JBQW9CLEdBQUcsS0FBSyxDQUFDO0FBSW5DOzs7R0FHRztBQUNILElBQUksbUJBQXNELENBQUM7QUFFM0Q7Ozs7R0FJRztBQUNILEtBQUssVUFBVSxpQkFBaUI7SUFDOUIsSUFBSSxtQkFBbUIsS0FBSyxTQUFTLEVBQUU7UUFDckMsT0FBTyxtQkFBbUIsQ0FBQztLQUM1QjtJQUVELHFGQUFxRjtJQUNyRix5RkFBeUY7SUFDekYsc0NBQXNDO0lBQ3RDLE9BQU8sSUFBQSx3QkFBYSxFQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDbEQsQ0FBQztBQUVNLEtBQUssVUFBVSxpQkFBaUIsQ0FDckMsTUFBYyxFQUNkLFdBQWdDLEVBQ2hDLGtCQUFrRCxFQUNsRCxZQUFxQixFQUNyQixpQkFBMEI7SUFFMUIsTUFBTSxFQUFFLFdBQVcsRUFBRSx5QkFBeUIsRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBRSxHQUN4RixNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFFNUIsTUFBTSxPQUFP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UUFBUTtRQUNwQyxRQUFRLEVBQUUsQ0FBQyxRQUFRO0tBQ3BCLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELElBQUksSUFBSSxDQUFDLENBQUM7S0FDNUU7SUFFRCxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUM7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgcmVtYXBwaW5nIGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQge1xuICBOb2RlUGF0aCxcbiAgUGFyc2VSZXN1bHQsXG4gIHBhcnNlU3luYyxcbiAgdHJhbnNmb3JtQXN5bmMsXG4gIHRyYW5zZm9ybUZyb21Bc3RTeW5jLFxuICB0cmF2ZXJzZSxcbiAgdHlwZXMsXG59IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCB0ZW1wbGF0ZUJ1aWxkZXIgZnJvbSAnQGJhYmVsL3RlbXBsYXRlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB3b3JrZXJEYXRhIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHsgYWxsb3dNaW5pZnksIHNob3VsZEJlYXV0aWZ5IH0gZnJvbSAnLi9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG4vLyBFeHRyYWN0IFNvdXJjZW1hcCBpbnB1dCB0eXBlIGZyb20gdGhlIHJlbWFwcGluZyBmdW5jdGlvbiBzaW5jZSBpdCBpcyBub3QgY3VycmVudGx5IGV4cG9ydGVkXG50eXBlIFNvdXJjZU1hcElucHV0ID0gRXhjbHVkZTxQYXJhbWV0ZXJzPHR5cGVvZiByZW1hcHBpbmc+WzBdLCB1bmtub3duW10+O1xuXG4vLyBMYXp5IGxvYWRlZCB3ZWJwYWNrLXNvdXJjZXMgb2JqZWN0XG4vLyBXZWJwYWNrIGlzIG9ubHkgaW1wb3J0ZWQgaWYgbmVlZGVkIGR1cmluZyB0aGUgcHJvY2Vzc2luZ1xubGV0IHdlYnBhY2tTb3VyY2VzOiB0eXBlb2YgaW1wb3J0KCd3ZWJwYWNrJykuc291cmNlcyB8IHVuZGVmaW5lZDtcblxuY29uc3QgeyBpMThuIH0gPSAod29ya2VyRGF0YSB8fCB7fSkgYXMgeyBpMThuPzogSTE4bk9wdGlvbnMgfTtcblxuLyoqXG4gKiBJbnRlcm5hbCBmbGFnIHRvIGVuYWJsZSB0aGUgZGlyZWN0IHVzYWdlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHRyYW5zbGF0aW9uIHBsdWdpbnMuXG4gKiBUaGVpciB1c2FnZSBpcyBjdXJyZW50bHkgc2V2ZXJhbCB0aW1lcyBzbG93ZXIgdGhhbiB0aGUgc3RyaW5nIG1hbmlwdWxhdGlvbiBtZXRob2QuXG4gKiBGdXR1cmUgd29yayB0byBvcHRpbWl6ZSB0aGUgcGx1Z2lucyBzaG91bGQgZW5hYmxlIHBsdWdpbiB1c2FnZSBhcyB0aGUgZGVmYXVsdC5cbiAqL1xuY29uc3QgVVNFX0xPQ0FMSVpFX1BMVUdJTlMgPSBmYWxzZTtcblxudHlwZSBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUgPSB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBtb2R1bGUuXG4gKiBUaGlzIGlzIHVzZWQgdG8gcmVtb3ZlIHRoZSBuZWVkIHRvIHJlcGVhdGVkbHkgaW1wb3J0IHRoZSBtb2R1bGUgcGVyIGZpbGUgdHJhbnNsYXRpb24uXG4gKi9cbmxldCBsb2NhbGl6ZVRvb2xzTW9kdWxlOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUgfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQXR0ZW1wdHMgdG8gbG9hZCB0aGUgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBtb2R1bGUgY29udGFpbmluZyB0aGUgZnVuY3Rpb25hbGl0eSB0b1xuICogcGVyZm9ybSB0aGUgZmlsZSB0cmFuc2xhdGlvbnMuXG4gKiBUaGlzIG1vZHVsZSBtdXN0IGJlIGR5bmFtaWNhbGx5IGxvYWRlZCBhcyBpdCBpcyBhbiBFU00gbW9kdWxlIGFuZCB0aGlzIGZpbGUgaXMgQ29tbW9uSlMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbGl6ZVRvb2xzKCk6IFByb21pc2U8TG9jYWxpemVVdGlsaXR5TW9kdWxlPiB7XG4gIGlmIChsb2NhbGl6ZVRvb2xzTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbG9jYWxpemVUb29sc01vZHVsZTtcbiAgfVxuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgcmV0dXJuIGxvYWRFc21Nb2R1bGUoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVJMThuUGx1Z2lucyhcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHRyYW5zbGF0aW9uOiB1bmtub3duIHwgdW5kZWZpbmVkLFxuICBtaXNzaW5nVHJhbnNsYXRpb246ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJyxcbiAgc2hvdWxkSW5saW5lOiBib29sZWFuLFxuICBsb2NhbGVEYXRhQ29udGVudD86IHN0cmluZyxcbikge1xuICBjb25zdCB7IERpYWdub3N0aWNzLCBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLCBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luLCBtYWtlTG9jYWxlUGx1Z2luIH0gPVxuICAgIGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG5cbiAgY29uc3QgcGx1Z2lucyA9IFtdO1xuICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBEaWFnbm9zdGljcygpO1xuXG4gIGlmIChzaG91bGRJbmxpbmUpIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgKHRyYW5zbGF0aW9uIHx8IHt9KSBhcyBhbnksIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiB0cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkID8gJ2lnbm9yZScgOiBtaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIG1ha2VFczVUcmFuc2xhdGVQbHVnaW4oZGlhZ25vc3RpY3MsICh0cmFuc2xhdGlvbiB8fCB7fSkgYXMgYW55LCB7XG4gICAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogdHJhbnNsYXRpb24gPT09IHVuZGVmaW5lZCA/ICdpZ25vcmUnIDogbWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHBsdWdpbnMucHVzaChtYWtlTG9jYWxlUGx1Z2luKGxvY2FsZSkpO1xuXG4gIGlmIChsb2NhbGVEYXRhQ29udGVudCkge1xuICAgIHBsdWdpbnMucHVzaCh7XG4gICAgICB2aXNpdG9yOiB7XG4gICAgICAgIFByb2dyYW0ocGF0aDogTm9kZVBhdGg8dHlwZXMuUHJvZ3JhbT4pIHtcbiAgICAgICAgICBwYXRoLnVuc2hpZnRDb250YWluZXIoJ2JvZHknLCB0ZW1wbGF0ZUJ1aWxkZXIuYXN0KGxvY2FsZURhdGFDb250ZW50KSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgZGlhZ25vc3RpY3MsIHBsdWdpbnMgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVPcHRpb25zIHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgY29kZTogc3RyaW5nO1xuICBtYXA/OiBzdHJpbmc7XG4gIGVzNTogYm9vbGVhbjtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBtaXNzaW5nVHJhbnNsYXRpb24/OiAnd2FybmluZycgfCAnZXJyb3InIHwgJ2lnbm9yZSc7XG4gIHNldExvY2FsZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBMb2NhbGl6ZVBvc2l0aW9uIHtcbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIG1lc3NhZ2VQYXJ0czogVGVtcGxhdGVTdHJpbmdzQXJyYXk7XG4gIGV4cHJlc3Npb25zOiB0eXBlcy5FeHByZXNzaW9uW107XG59XG5cbmNvbnN0IGxvY2FsaXplTmFtZSA9ICckbG9jYWxpemUnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlcyhvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuICBpZiAoaTE4bi5mbGF0T3V0cHV0ICYmIGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignRmxhdCBvdXRwdXQgaXMgb25seSBzdXBwb3J0ZWQgd2hlbiBpbmxpbmluZyBvbmUgbG9jYWxlLicpO1xuICB9XG5cbiAgY29uc3QgaGFzTG9jYWxpemVOYW1lID0gb3B0aW9ucy5jb2RlLmluY2x1ZGVzKGxvY2FsaXplTmFtZSk7XG4gIGlmICghaGFzTG9jYWxpemVOYW1lICYmICFvcHRpb25zLnNldExvY2FsZSkge1xuICAgIHJldHVybiBpbmxpbmVDb3B5T25seShvcHRpb25zKTtcbiAgfVxuXG4gIGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG5cbiAgbGV0IGFzdDogUGFyc2VSZXN1bHQgfCB1bmRlZmluZWQgfCBudWxsO1xuICB0cnkge1xuICAgIGFzdCA9IHBhcnNlU3luYyhvcHRpb25zLmNvZGUsIHtcbiAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICBzb3VyY2VUeXBlOiAnc2NyaXB0JyxcbiAgICAgIGZpbGVuYW1lOiBvcHRpb25zLmZpbGVuYW1lLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5tZXNzYWdlKSB7XG4gICAgICAvLyBNYWtlIHRoZSBlcnJvciBtb3JlIHJlYWRhYmxlLlxuICAgICAgLy8gU2FtZSBlcnJvcnMgd2lsbCBjb250YWluIHRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgYXMgdGhlIGVycm9yIG1lc3NhZ2VcbiAgICAgIC8vIFdoaWNoIG1ha2VzIGl0IGhhcmQgdG8gZmluZCB0aGUgYWN0dWFsIGVycm9yIG1lc3NhZ2UuXG4gICAgICBjb25zdCBpbmRleCA9IGVycm9yLm1lc3NhZ2UuaW5kZXhPZignKVxcbicpO1xuICAgICAgY29uc3QgbXNnID0gaW5kZXggIT09IC0xID8gZXJyb3IubWVzc2FnZS5zbGljZSgwLCBpbmRleCArIDEpIDogZXJyb3IubWVzc2FnZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgJHttc2d9XFxuQW4gZXJyb3Igb2NjdXJyZWQgaW5saW5pbmcgZmlsZSBcIiR7b3B0aW9ucy5maWxlbmFtZX1cImApO1xuICAgIH1cbiAgfVxuXG4gIGlmICghYXN0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVycm9yIG9jY3VycmVkIGlubGluaW5nIGZpbGUgXCIke29wdGlvbnMuZmlsZW5hbWV9XCJgKTtcbiAgfVxuXG4gIGlmICghVVNFX0xPQ0FMSVpFX1BMVUdJTlMpIHtcbiAgICByZXR1cm4gaW5saW5lTG9jYWxlc0RpcmVjdChhc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgY29uc3QgZGlhZ25vc3RpY3MgPSBbXTtcbiAgZm9yIChjb25zdCBsb2NhbGUgb2YgaTE4bi5pbmxpbmVMb2NhbGVzKSB7XG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgbGV0IGxvY2FsZURhdGFDb250ZW50O1xuICAgIGlmIChvcHRpb25zLnNldExvY2FsZSkge1xuICAgICAgLy8gSWYgbG9jYWxlIGRhdGEgaXMgcHJvdmlkZWQsIGxvYWQgaXQgYW5kIHByZXBlbmQgdG8gZmlsZVxuICAgICAgY29uc3QgbG9jYWxlRGF0YVBhdGggPSBpMThuLmxvY2FsZXNbbG9jYWxlXT8uZGF0YVBhdGg7XG4gICAgICBpZiAobG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgICAgbG9jYWxlRGF0YUNvbnRlbnQgPSBhd2FpdCBsb2FkTG9jYWxlRGF0YShsb2NhbGVEYXRhUGF0aCwgdHJ1ZSwgb3B0aW9ucy5lczUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHsgZGlhZ25vc3RpY3M6IGxvY2FsZURpYWdub3N0aWNzLCBwbHVnaW5zIH0gPSBhd2FpdCBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9ucyxcbiAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICB0cnVlLFxuICAgICAgbG9jYWxlRGF0YUNvbnRlbnQsXG4gICAgKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Gcm9tQXN0U3luYyhhc3QsIG9wdGlvbnMuY29kZSwge1xuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgICAvLyB1c2luZyBmYWxzZSBlbnN1cmVzIHRoYXQgYmFiZWwgd2lsbCBOT1Qgc2VhcmNoIGFuZCBwcm9jZXNzIHNvdXJjZW1hcCBjb21tZW50cyAobGFyZ2UgbWVtb3J5IHVzYWdlKVxuICAgICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHBsdWdpbnMsXG4gICAgICBjb21wYWN0OiAhc2hvdWxkQmVhdXRpZnksXG4gICAgICBzb3VyY2VNYXBzOiAhIW9wdGlvbnMubWFwLFxuICAgIH0pO1xuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5sb2NhbGVEaWFnbm9zdGljcy5tZXNzYWdlcyk7XG5cbiAgICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke29wdGlvbnMuZmlsZW5hbWV9XCIuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihcbiAgICAgIG9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIGkxOG4uZmxhdE91dHB1dCA/ICcnIDogbG9jYWxlLFxuICAgICAgb3B0aW9ucy5maWxlbmFtZSxcbiAgICApO1xuICAgIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCwgdHJhbnNmb3JtUmVzdWx0LmNvZGUpO1xuXG4gICAgaWYgKG9wdGlvbnMubWFwICYmIHRyYW5zZm9ybVJlc3VsdC5tYXApIHtcbiAgICAgIGNvbnN0IG91dHB1dE1hcCA9IHJlbWFwcGluZyhbdHJhbnNmb3JtUmVzdWx0Lm1hcCBhcyBTb3VyY2VNYXBJbnB1dCwgb3B0aW9ucy5tYXBdLCAoKSA9PiBudWxsKTtcblxuICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoICsgJy5tYXAnLCBKU09OLnN0cmluZ2lmeShvdXRwdXRNYXApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljcyB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzRGlyZWN0KGFzdDogUGFyc2VSZXN1bHQsIG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG5cbiAgY29uc3QgeyBkZWZhdWx0OiBnZW5lcmF0ZSB9ID0gYXdhaXQgaW1wb3J0KCdAYmFiZWwvZ2VuZXJhdG9yJyk7XG4gIGNvbnN0IGxvY2FsaXplRGlhZyA9IGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IGxvY2FsaXplRGlhZy5EaWFnbm9zdGljcygpO1xuXG4gIGNvbnN0IHBvc2l0aW9ucyA9IGZpbmRMb2NhbGl6ZVBvc2l0aW9ucyhhc3QsIG9wdGlvbnMsIGxvY2FsaXplRGlhZyk7XG4gIGlmIChwb3NpdGlvbnMubGVuZ3RoID09PSAwICYmICFvcHRpb25zLnNldExvY2FsZSkge1xuICAgIHJldHVybiBpbmxpbmVDb3B5T25seShvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGlucHV0TWFwID0gISFvcHRpb25zLm1hcCAmJiAoSlNPTi5wYXJzZShvcHRpb25zLm1hcCkgYXMgeyBzb3VyY2VSb290Pzogc3RyaW5nIH0pO1xuICAvLyBDbGVhbnVwIHNvdXJjZSByb290IG90aGVyd2lzZSBpdCB3aWxsIGJlIGFkZGVkIHRvIGVhY2ggc291cmNlIGVudHJ5XG4gIGNvbnN0IG1hcFNvdXJjZVJvb3QgPSBpbnB1dE1hcCAmJiBpbnB1dE1hcC5zb3VyY2VSb290O1xuICBpZiAoaW5wdXRNYXApIHtcbiAgICBkZWxldGUgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgfVxuXG4gIC8vIExvYWQgV2VicGFjayBvbmx5IHdoZW4gbmVlZGVkXG4gIGlmICh3ZWJwYWNrU291cmNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgd2VicGFja1NvdXJjZXMgPSAoYXdhaXQgaW1wb3J0KCd3ZWJwYWNrJykpLnNvdXJjZXM7XG4gIH1cbiAgY29uc3QgeyBDb25jYXRTb3VyY2UsIE9yaWdpbmFsU291cmNlLCBSZXBsYWNlU291cmNlLCBTb3VyY2VNYXBTb3VyY2UgfSA9IHdlYnBhY2tTb3VyY2VzO1xuXG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBuZXcgUmVwbGFjZVNvdXJjZShcbiAgICAgIGlucHV0TWFwXG4gICAgICAgID8gbmV3IFNvdXJjZU1hcFNvdXJjZShvcHRpb25zLmNvZGUsIG9wdGlvbnMuZmlsZW5hbWUsIGlucHV0TWFwKVxuICAgICAgICA6IG5ldyBPcmlnaW5hbFNvdXJjZShvcHRpb25zLmNvZGUsIG9wdGlvbnMuZmlsZW5hbWUpLFxuICAgICk7XG5cbiAgICBjb25zdCBpc1NvdXJjZUxvY2FsZSA9IGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGU7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCB0cmFuc2xhdGlvbnM6IGFueSA9IGlzU291cmNlTG9jYWxlID8ge30gOiBpMThuLmxvY2FsZXNbbG9jYWxlXS50cmFuc2xhdGlvbiB8fCB7fTtcbiAgICBmb3IgKGNvbnN0IHBvc2l0aW9uIG9mIHBvc2l0aW9ucykge1xuICAgICAgY29uc3QgdHJhbnNsYXRlZCA9IGxvY2FsaXplRGlhZy50cmFuc2xhdGUoXG4gICAgICAgIGRpYWdub3N0aWNzLFxuICAgICAgICB0cmFuc2xhdGlvbnMsXG4gICAgICAgIHBvc2l0aW9uLm1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgcG9zaXRpb24uZXhwcmVzc2lvbnMsXG4gICAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICApO1xuXG4gICAgICBjb25zdCBleHByZXNzaW9uID0gbG9jYWxpemVEaWFnLmJ1aWxkTG9jYWxpemVSZXBsYWNlbWVudCh0cmFuc2xhdGVkWzBdLCB0cmFuc2xhdGVkWzFdKTtcbiAgICAgIGNvbnN0IHsgY29kZSB9ID0gZ2VuZXJhdGUoZXhwcmVzc2lvbik7XG5cbiAgICAgIGNvbnRlbnQucmVwbGFjZShwb3NpdGlvbi5zdGFydCwgcG9zaXRpb24uZW5kIC0gMSwgY29kZSk7XG4gICAgfVxuXG4gICAgbGV0IG91dHB1dFNvdXJjZTogaW1wb3J0KCd3ZWJwYWNrJykuc291cmNlcy5Tb3VyY2UgPSBjb250ZW50O1xuICAgIGlmIChvcHRpb25zLnNldExvY2FsZSkge1xuICAgICAgY29uc3Qgc2V0TG9jYWxlVGV4dCA9IGB2YXIgJGxvY2FsaXplPU9iamVjdC5hc3NpZ24odm9pZCAwPT09JGxvY2FsaXplP3t9OiRsb2NhbGl6ZSx7bG9jYWxlOlwiJHtsb2NhbGV9XCJ9KTtcXG5gO1xuXG4gICAgICAvLyBJZiBsb2NhbGUgZGF0YSBpcyBwcm92aWRlZCwgbG9hZCBpdCBhbmQgcHJlcGVuZCB0byBmaWxlXG4gICAgICBsZXQgbG9jYWxlRGF0YVNvdXJjZTtcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0uZGF0YVBhdGg7XG4gICAgICBpZiAobG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgICAgY29uc3QgbG9jYWxlRGF0YUNvbnRlbnQgPSBhd2FpdCBsb2FkTG9jYWxlRGF0YShsb2NhbGVEYXRhUGF0aCwgdHJ1ZSwgb3B0aW9ucy5lczUpO1xuICAgICAgICBsb2NhbGVEYXRhU291cmNlID0gbmV3IE9yaWdpbmFsU291cmNlKGxvY2FsZURhdGFDb250ZW50LCBwYXRoLmJhc2VuYW1lKGxvY2FsZURhdGFQYXRoKSk7XG4gICAgICB9XG5cbiAgICAgIG91dHB1dFNvdXJjZSA9IGxvY2FsZURhdGFTb3VyY2VcbiAgICAgICAgPyAvLyBUaGUgc2VtaWNvbG9uIGVuc3VyZXMgdGhhdCB0aGVyZSBpcyBubyBzeW50YXggZXJyb3IgYmV0d2VlbiBzdGF0ZW1lbnRzXG4gICAgICAgICAgbmV3IENvbmNhdFNvdXJjZShzZXRMb2NhbGVUZXh0LCBsb2NhbGVEYXRhU291cmNlLCAnO1xcbicsIGNvbnRlbnQpXG4gICAgICAgIDogbmV3IENvbmNhdFNvdXJjZShzZXRMb2NhbGVUZXh0LCBjb250ZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHNvdXJjZTogb3V0cHV0Q29kZSwgbWFwOiBvdXRwdXRNYXAgfSA9IG91dHB1dFNvdXJjZS5zb3VyY2VBbmRNYXAoKSBhcyB7XG4gICAgICBzb3VyY2U6IHN0cmluZztcbiAgICAgIG1hcDogeyBmaWxlOiBzdHJpbmc7IHNvdXJjZVJvb3Q/OiBzdHJpbmcgfTtcbiAgICB9O1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIG91dHB1dENvZGUpO1xuXG4gICAgaWYgKGlucHV0TWFwICYmIG91dHB1dE1hcCkge1xuICAgICAgb3V0cHV0TWFwLmZpbGUgPSBvcHRpb25zLmZpbGVuYW1lO1xuICAgICAgaWYgKG1hcFNvdXJjZVJvb3QpIHtcbiAgICAgICAgb3V0cHV0TWFwLnNvdXJjZVJvb3QgPSBtYXBTb3VyY2VSb290O1xuICAgICAgfVxuICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoICsgJy5tYXAnLCBKU09OLnN0cmluZ2lmeShvdXRwdXRNYXApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljczogZGlhZ25vc3RpY3MubWVzc2FnZXMsIGNvdW50OiBwb3NpdGlvbnMubGVuZ3RoIH07XG59XG5cbmZ1bmN0aW9uIGlubGluZUNvcHlPbmx5KG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpMThuIG9wdGlvbnMgYXJlIG1pc3NpbmcnKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIG9wdGlvbnMuY29kZSk7XG4gICAgaWYgKG9wdGlvbnMubWFwKSB7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGggKyAnLm1hcCcsIG9wdGlvbnMubWFwKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljczogW10sIGNvdW50OiAwIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRMb2NhbGl6ZVBvc2l0aW9ucyhcbiAgYXN0OiBQYXJzZVJlc3VsdCxcbiAgb3B0aW9uczogSW5saW5lT3B0aW9ucyxcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IExvY2FsaXplUG9zaXRpb25bXSB7XG4gIGNvbnN0IHBvc2l0aW9uczogTG9jYWxpemVQb3NpdGlvbltdID0gW107XG5cbiAgLy8gV29ya2Fyb3VuZCB0byBlbnN1cmUgYSBwYXRoIGh1YiBpcyBwcmVzZW50IGZvciB0cmF2ZXJzYWxcbiAgY29uc3QgeyBGaWxlIH0gPSByZXF1aXJlKCdAYmFiZWwvY29yZScpO1xuICBjb25zdCBmaWxlID0gbmV3IEZpbGUoe30sIHsgY29kZTogb3B0aW9ucy5jb2RlLCBhc3QgfSk7XG5cbiAgaWYgKG9wdGlvbnMuZXM1KSB7XG4gICAgdHJhdmVyc2UoZmlsZS5hc3QsIHtcbiAgICAgIENhbGxFeHByZXNzaW9uKHBhdGgpIHtcbiAgICAgICAgY29uc3QgY2FsbGVlID0gcGF0aC5nZXQoJ2NhbGxlZScpO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY2FsbGVlLmlzSWRlbnRpZmllcigpICYmXG4gICAgICAgICAgY2FsbGVlLm5vZGUubmFtZSA9PT0gbG9jYWxpemVOYW1lICYmXG4gICAgICAgICAgdXRpbHMuaXNHbG9iYWxJZGVudGlmaWVyKGNhbGxlZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdID0gdW53cmFwTG9jYWxpemVDYWxsKHBhdGgsIHV0aWxzKTtcbiAgICAgICAgICBwb3NpdGlvbnMucHVzaCh7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgc3RhcnQ6IHBhdGgubm9kZS5zdGFydCEsXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgZW5kOiBwYXRoLm5vZGUuZW5kISxcbiAgICAgICAgICAgIG1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgICAgIGV4cHJlc3Npb25zLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHRyYXZlcnNlKGZpbGUuYXN0LCB7XG4gICAgICBUYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24ocGF0aCkge1xuICAgICAgICBpZiAodHlwZXMuaXNJZGVudGlmaWVyKHBhdGgubm9kZS50YWcpICYmIHBhdGgubm9kZS50YWcubmFtZSA9PT0gbG9jYWxpemVOYW1lKSB7XG4gICAgICAgICAgY29uc3QgW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdID0gdW53cmFwVGVtcGxhdGVMaXRlcmFsKHBhdGgsIHV0aWxzKTtcbiAgICAgICAgICBwb3NpdGlvbnMucHVzaCh7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgc3RhcnQ6IHBhdGgubm9kZS5zdGFydCEsXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgZW5kOiBwYXRoLm5vZGUuZW5kISxcbiAgICAgICAgICAgIG1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgICAgIGV4cHJlc3Npb25zLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHBvc2l0aW9ucztcbn1cblxuZnVuY3Rpb24gdW53cmFwVGVtcGxhdGVMaXRlcmFsKFxuICBwYXRoOiBOb2RlUGF0aDx0eXBlcy5UYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24+LFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogW1RlbXBsYXRlU3RyaW5nc0FycmF5LCB0eXBlcy5FeHByZXNzaW9uW11dIHtcbiAgY29uc3QgW21lc3NhZ2VQYXJ0c10gPSB1dGlscy51bndyYXBNZXNzYWdlUGFydHNGcm9tVGVtcGxhdGVMaXRlcmFsKFxuICAgIHBhdGguZ2V0KCdxdWFzaScpLmdldCgncXVhc2lzJyksXG4gICk7XG4gIGNvbnN0IFtleHByZXNzaW9uc10gPSB1dGlscy51bndyYXBFeHByZXNzaW9uc0Zyb21UZW1wbGF0ZUxpdGVyYWwocGF0aC5nZXQoJ3F1YXNpJykpO1xuXG4gIHJldHVybiBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc107XG59XG5cbmZ1bmN0aW9uIHVud3JhcExvY2FsaXplQ2FsbChcbiAgcGF0aDogTm9kZVBhdGg8dHlwZXMuQ2FsbEV4cHJlc3Npb24+LFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogW1RlbXBsYXRlU3RyaW5nc0FycmF5LCB0eXBlcy5FeHByZXNzaW9uW11dIHtcbiAgY29uc3QgW21lc3NhZ2VQYXJ0c10gPSB1dGlscy51bndyYXBNZXNzYWdlUGFydHNGcm9tTG9jYWxpemVDYWxsKHBhdGgpO1xuICBjb25zdCBbZXhwcmVzc2lvbnNdID0gdXRpbHMudW53cmFwU3Vic3RpdHV0aW9uc0Zyb21Mb2NhbGl6ZUNhbGwocGF0aCk7XG5cbiAgcmV0dXJuIFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZExvY2FsZURhdGEocGF0aDogc3RyaW5nLCBvcHRpbWl6ZTogYm9vbGVhbiwgZXM1OiBib29sZWFuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgLy8gVGhlIHBhdGggaXMgdmFsaWRhdGVkIGR1cmluZyBvcHRpb24gcHJvY2Vzc2luZyBiZWZvcmUgdGhlIGJ1aWxkIHN0YXJ0c1xuICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4Jyk7XG5cbiAgLy8gRG93bmxldmVsIGFuZCBvcHRpbWl6ZSB0aGUgZGF0YVxuICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhjb250ZW50LCB7XG4gICAgZmlsZW5hbWU6IHBhdGgsXG4gICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSBhcyBhbnksXG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgcHJlc2V0czogW1xuICAgICAgW1xuICAgICAgICByZXF1aXJlLnJlc29sdmUoJ0BiYWJlbC9wcmVzZXQtZW52JyksXG4gICAgICAgIHtcbiAgICAgICAgICBidWdmaXhlczogdHJ1ZSxcbiAgICAgICAgICAvLyBJRSAxMSBpcyB0aGUgb2xkZXN0IHN1cHBvcnRlZCBicm93c2VyXG4gICAgICAgICAgdGFyZ2V0czogZXM1ID8geyBpZTogJzExJyB9IDogeyBlc21vZHVsZXM6IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgXSxcbiAgICBtaW5pZmllZDogYWxsb3dNaW5pZnkgJiYgb3B0aW1pemUsXG4gICAgY29tcGFjdDogIXNob3VsZEJlYXV0aWZ5ICYmIG9wdGltaXplLFxuICAgIGNvbW1lbnRzOiAhb3B0aW1pemUsXG4gIH0pO1xuXG4gIGlmICghdHJhbnNmb3JtUmVzdWx0IHx8ICF0cmFuc2Zvcm1SZXN1bHQuY29kZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke3BhdGh9XCIuYCk7XG4gIH1cblxuICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0LmNvZGU7XG59XG4iXX0=