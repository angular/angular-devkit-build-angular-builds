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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNFQUE4QztBQUM5QyxzQ0FRcUI7QUFDckIsK0RBQThDO0FBQzlDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsbURBQTRDO0FBQzVDLCtEQUFvRTtBQUVwRSx5Q0FBMkM7QUFLM0MscUNBQXFDO0FBQ3JDLDJEQUEyRDtBQUMzRCxJQUFJLGNBQTRELENBQUM7QUFFakUsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsMkJBQVUsSUFBSSxFQUFFLENBQTJCLENBQUM7QUFFOUQ7Ozs7R0FJRztBQUNILE1BQU0sb0JBQW9CLEdBQUcsS0FBSyxDQUFDO0FBSW5DOzs7R0FHRztBQUNILElBQUksbUJBQXNELENBQUM7QUFFM0Q7Ozs7R0FJRztBQUNILEtBQUssVUFBVSxpQkFBaUI7SUFDOUIsSUFBSSxtQkFBbUIsS0FBSyxTQUFTLEVBQUU7UUFDckMsT0FBTyxtQkFBbUIsQ0FBQztLQUM1QjtJQUVELHFGQUFxRjtJQUNyRix5RkFBeUY7SUFDekYsc0NBQXNDO0lBQ3RDLE9BQU8sSUFBQSx3QkFBYSxFQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDbEQsQ0FBQztBQUVNLEtBQUssVUFBVSxpQkFBaUIsQ0FDckMsTUFBYyxFQUNkLFdBQWdDLEVBQ2hDLGtCQUFrRCxFQUNsRCxZQUFxQixFQUNyQixpQkFBMEI7SUFFMUIsTUFBTSxFQUFFLFdBQVcsRUFBRSx5QkFBeUIsRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBRSxHQUN4RixNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFFNUIsTUFBTSxPQUFP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UUFBUTtRQUNwQyxRQUFRLEVBQUUsQ0FBQyxRQUFRO0tBQ3BCLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELElBQUksSUFBSSxDQUFDLENBQUM7S0FDNUU7SUFFRCxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUM7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgcmVtYXBwaW5nIGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQge1xuICBOb2RlUGF0aCxcbiAgUGFyc2VSZXN1bHQsXG4gIHBhcnNlU3luYyxcbiAgdHJhbnNmb3JtQXN5bmMsXG4gIHRyYW5zZm9ybUZyb21Bc3RTeW5jLFxuICB0cmF2ZXJzZSxcbiAgdHlwZXMsXG59IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCB0ZW1wbGF0ZUJ1aWxkZXIgZnJvbSAnQGJhYmVsL3RlbXBsYXRlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB3b3JrZXJEYXRhIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHsgYWxsb3dNaW5pZnksIHNob3VsZEJlYXV0aWZ5IH0gZnJvbSAnLi9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG4vLyBFeHRyYWN0IFNvdXJjZW1hcCBpbnB1dCB0eXBlIGZyb20gdGhlIHJlbWFwcGluZyBmdW5jdGlvbiBzaW5jZSBpdCBpcyBub3QgY3VycmVudGx5IGV4cG9ydGVkXG50eXBlIFNvdXJjZU1hcElucHV0ID0gRXhjbHVkZTxQYXJhbWV0ZXJzPHR5cGVvZiByZW1hcHBpbmc+WzBdLCB1bmtub3duW10+O1xuXG4vLyBMYXp5IGxvYWRlZCB3ZWJwYWNrLXNvdXJjZXMgb2JqZWN0XG4vLyBXZWJwYWNrIGlzIG9ubHkgaW1wb3J0ZWQgaWYgbmVlZGVkIGR1cmluZyB0aGUgcHJvY2Vzc2luZ1xubGV0IHdlYnBhY2tTb3VyY2VzOiB0eXBlb2YgaW1wb3J0KCd3ZWJwYWNrJykuc291cmNlcyB8IHVuZGVmaW5lZDtcblxuY29uc3QgeyBpMThuIH0gPSAod29ya2VyRGF0YSB8fCB7fSkgYXMgeyBpMThuPzogSTE4bk9wdGlvbnMgfTtcblxuLyoqXG4gKiBJbnRlcm5hbCBmbGFnIHRvIGVuYWJsZSB0aGUgZGlyZWN0IHVzYWdlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHRyYW5zbGF0aW9uIHBsdWdpbnMuXG4gKiBUaGVpciB1c2FnZSBpcyBjdXJyZW50bHkgc2V2ZXJhbCB0aW1lcyBzbG93ZXIgdGhhbiB0aGUgc3RyaW5nIG1hbmlwdWxhdGlvbiBtZXRob2QuXG4gKiBGdXR1cmUgd29yayB0byBvcHRpbWl6ZSB0aGUgcGx1Z2lucyBzaG91bGQgZW5hYmxlIHBsdWdpbiB1c2FnZSBhcyB0aGUgZGVmYXVsdC5cbiAqL1xuY29uc3QgVVNFX0xPQ0FMSVpFX1BMVUdJTlMgPSBmYWxzZTtcblxudHlwZSBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUgPSB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xuXG4vKipcbiAqIENhY2hlZCBpbnN0YW5jZSBvZiB0aGUgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBtb2R1bGUuXG4gKiBUaGlzIGlzIHVzZWQgdG8gcmVtb3ZlIHRoZSBuZWVkIHRvIHJlcGVhdGVkbHkgaW1wb3J0IHRoZSBtb2R1bGUgcGVyIGZpbGUgdHJhbnNsYXRpb24uXG4gKi9cbmxldCBsb2NhbGl6ZVRvb2xzTW9kdWxlOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUgfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQXR0ZW1wdHMgdG8gbG9hZCB0aGUgYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCBtb2R1bGUgY29udGFpbmluZyB0aGUgZnVuY3Rpb25hbGl0eSB0b1xuICogcGVyZm9ybSB0aGUgZmlsZSB0cmFuc2xhdGlvbnMuXG4gKiBUaGlzIG1vZHVsZSBtdXN0IGJlIGR5bmFtaWNhbGx5IGxvYWRlZCBhcyBpdCBpcyBhbiBFU00gbW9kdWxlIGFuZCB0aGlzIGZpbGUgaXMgQ29tbW9uSlMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbGl6ZVRvb2xzKCk6IFByb21pc2U8TG9jYWxpemVVdGlsaXR5TW9kdWxlPiB7XG4gIGlmIChsb2NhbGl6ZVRvb2xzTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbG9jYWxpemVUb29sc01vZHVsZTtcbiAgfVxuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgcmV0dXJuIGxvYWRFc21Nb2R1bGUoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVJMThuUGx1Z2lucyhcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHRyYW5zbGF0aW9uOiB1bmtub3duIHwgdW5kZWZpbmVkLFxuICBtaXNzaW5nVHJhbnNsYXRpb246ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJyxcbiAgc2hvdWxkSW5saW5lOiBib29sZWFuLFxuICBsb2NhbGVEYXRhQ29udGVudD86IHN0cmluZyxcbikge1xuICBjb25zdCB7IERpYWdub3N0aWNzLCBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLCBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luLCBtYWtlTG9jYWxlUGx1Z2luIH0gPVxuICAgIGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG5cbiAgY29uc3QgcGx1Z2lucyA9IFtdO1xuICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBEaWFnbm9zdGljcygpO1xuXG4gIGlmIChzaG91bGRJbmxpbmUpIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgKHRyYW5zbGF0aW9uIHx8IHt9KSBhcyBhbnksIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiB0cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkID8gJ2lnbm9yZScgOiBtaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIG1ha2VFczVUcmFuc2xhdGVQbHVnaW4oZGlhZ25vc3RpY3MsICh0cmFuc2xhdGlvbiB8fCB7fSkgYXMgYW55LCB7XG4gICAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogdHJhbnNsYXRpb24gPT09IHVuZGVmaW5lZCA/ICdpZ25vcmUnIDogbWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHBsdWdpbnMucHVzaChtYWtlTG9jYWxlUGx1Z2luKGxvY2FsZSkpO1xuXG4gIGlmIChsb2NhbGVEYXRhQ29udGVudCkge1xuICAgIHBsdWdpbnMucHVzaCh7XG4gICAgICB2aXNpdG9yOiB7XG4gICAgICAgIFByb2dyYW0ocGF0aDogTm9kZVBhdGg8dHlwZXMuUHJvZ3JhbT4pIHtcbiAgICAgICAgICBwYXRoLnVuc2hpZnRDb250YWluZXIoJ2JvZHknLCB0ZW1wbGF0ZUJ1aWxkZXIuYXN0KGxvY2FsZURhdGFDb250ZW50KSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgZGlhZ25vc3RpY3MsIHBsdWdpbnMgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVPcHRpb25zIHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgY29kZTogc3RyaW5nO1xuICBtYXA/OiBzdHJpbmc7XG4gIGVzNTogYm9vbGVhbjtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBtaXNzaW5nVHJhbnNsYXRpb24/OiAnd2FybmluZycgfCAnZXJyb3InIHwgJ2lnbm9yZSc7XG4gIHNldExvY2FsZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBMb2NhbGl6ZVBvc2l0aW9uIHtcbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIG1lc3NhZ2VQYXJ0czogVGVtcGxhdGVTdHJpbmdzQXJyYXk7XG4gIGV4cHJlc3Npb25zOiB0eXBlcy5FeHByZXNzaW9uW107XG59XG5cbmNvbnN0IGxvY2FsaXplTmFtZSA9ICckbG9jYWxpemUnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlcyhvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuICBpZiAoaTE4bi5mbGF0T3V0cHV0ICYmIGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignRmxhdCBvdXRwdXQgaXMgb25seSBzdXBwb3J0ZWQgd2hlbiBpbmxpbmluZyBvbmUgbG9jYWxlLicpO1xuICB9XG5cbiAgY29uc3QgaGFzTG9jYWxpemVOYW1lID0gb3B0aW9ucy5jb2RlLmluY2x1ZGVzKGxvY2FsaXplTmFtZSk7XG4gIGlmICghaGFzTG9jYWxpemVOYW1lICYmICFvcHRpb25zLnNldExvY2FsZSkge1xuICAgIHJldHVybiBpbmxpbmVDb3B5T25seShvcHRpb25zKTtcbiAgfVxuXG4gIGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG5cbiAgbGV0IGFzdDogUGFyc2VSZXN1bHQgfCB1bmRlZmluZWQgfCBudWxsO1xuICB0cnkge1xuICAgIGFzdCA9IHBhcnNlU3luYyhvcHRpb25zLmNvZGUsIHtcbiAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICBzb3VyY2VUeXBlOiAnc2NyaXB0JyxcbiAgICAgIGZpbGVuYW1lOiBvcHRpb25zLmZpbGVuYW1lLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5tZXNzYWdlKSB7XG4gICAgICAvLyBNYWtlIHRoZSBlcnJvciBtb3JlIHJlYWRhYmxlLlxuICAgICAgLy8gU2FtZSBlcnJvcnMgd2lsbCBjb250YWluIHRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgYXMgdGhlIGVycm9yIG1lc3NhZ2VcbiAgICAgIC8vIFdoaWNoIG1ha2VzIGl0IGhhcmQgdG8gZmluZCB0aGUgYWN0dWFsIGVycm9yIG1lc3NhZ2UuXG4gICAgICBjb25zdCBpbmRleCA9IGVycm9yLm1lc3NhZ2UuaW5kZXhPZignKVxcbicpO1xuICAgICAgY29uc3QgbXNnID0gaW5kZXggIT09IC0xID8gZXJyb3IubWVzc2FnZS5zdWJzdHIoMCwgaW5kZXggKyAxKSA6IGVycm9yLm1lc3NhZ2U7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7bXNnfVxcbkFuIGVycm9yIG9jY3VycmVkIGlubGluaW5nIGZpbGUgXCIke29wdGlvbnMuZmlsZW5hbWV9XCJgKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWFzdCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIVVTRV9MT0NBTElaRV9QTFVHSU5TKSB7XG4gICAgcmV0dXJuIGlubGluZUxvY2FsZXNEaXJlY3QoYXN0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGRpYWdub3N0aWNzID0gW107XG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGlzU291cmNlTG9jYWxlID0gbG9jYWxlID09PSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IHRyYW5zbGF0aW9uczogYW55ID0gaXNTb3VyY2VMb2NhbGUgPyB7fSA6IGkxOG4ubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uIHx8IHt9O1xuICAgIGxldCBsb2NhbGVEYXRhQ29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIC8vIElmIGxvY2FsZSBkYXRhIGlzIHByb3ZpZGVkLCBsb2FkIGl0IGFuZCBwcmVwZW5kIHRvIGZpbGVcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUsIG9wdGlvbnMuZXM1KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB7IGRpYWdub3N0aWNzOiBsb2NhbGVEaWFnbm9zdGljcywgcGx1Z2lucyB9ID0gYXdhaXQgY3JlYXRlSTE4blBsdWdpbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICB0cmFuc2xhdGlvbnMsXG4gICAgICBpc1NvdXJjZUxvY2FsZSA/ICdpZ25vcmUnIDogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24gfHwgJ3dhcm5pbmcnLFxuICAgICAgdHJ1ZSxcbiAgICAgIGxvY2FsZURhdGFDb250ZW50LFxuICAgICk7XG4gICAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtRnJvbUFzdFN5bmMoYXN0LCBvcHRpb25zLmNvZGUsIHtcbiAgICAgIGZpbGVuYW1lOiBvcHRpb25zLmZpbGVuYW1lLFxuICAgICAgLy8gdXNpbmcgZmFsc2UgZW5zdXJlcyB0aGF0IGJhYmVsIHdpbGwgTk9UIHNlYXJjaCBhbmQgcHJvY2VzcyBzb3VyY2VtYXAgY29tbWVudHMgKGxhcmdlIG1lbW9yeSB1c2FnZSlcbiAgICAgIC8vIFRoZSB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgaW5wdXRTb3VyY2VNYXA6IGZhbHNlIGFzIGFueSxcbiAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICBwbHVnaW5zLFxuICAgICAgY29tcGFjdDogIXNob3VsZEJlYXV0aWZ5LFxuICAgICAgc291cmNlTWFwczogISFvcHRpb25zLm1hcCxcbiAgICB9KTtcblxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubG9jYWxlRGlhZ25vc3RpY3MubWVzc2FnZXMpO1xuXG4gICAgaWYgKCF0cmFuc2Zvcm1SZXN1bHQgfHwgIXRyYW5zZm9ybVJlc3VsdC5jb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZXJyb3Igb2NjdXJyZWQgcHJvY2Vzc2luZyBidW5kbGUgZm9yIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiLmApO1xuICAgIH1cblxuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIHRyYW5zZm9ybVJlc3VsdC5jb2RlKTtcblxuICAgIGlmIChvcHRpb25zLm1hcCAmJiB0cmFuc2Zvcm1SZXN1bHQubWFwKSB7XG4gICAgICBjb25zdCBvdXRwdXRNYXAgPSByZW1hcHBpbmcoW3RyYW5zZm9ybVJlc3VsdC5tYXAgYXMgU291cmNlTWFwSW5wdXQsIG9wdGlvbnMubWFwXSwgKCkgPT4gbnVsbCk7XG5cbiAgICAgIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3MgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlc0RpcmVjdChhc3Q6IFBhcnNlUmVzdWx0LCBvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuXG4gIGNvbnN0IHsgZGVmYXVsdDogZ2VuZXJhdGUgfSA9IGF3YWl0IGltcG9ydCgnQGJhYmVsL2dlbmVyYXRvcicpO1xuICBjb25zdCBsb2NhbGl6ZURpYWcgPSBhd2FpdCBsb2FkTG9jYWxpemVUb29scygpO1xuICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBsb2NhbGl6ZURpYWcuRGlhZ25vc3RpY3MoKTtcblxuICBjb25zdCBwb3NpdGlvbnMgPSBmaW5kTG9jYWxpemVQb3NpdGlvbnMoYXN0LCBvcHRpb25zLCBsb2NhbGl6ZURpYWcpO1xuICBpZiAocG9zaXRpb25zLmxlbmd0aCA9PT0gMCAmJiAhb3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICByZXR1cm4gaW5saW5lQ29weU9ubHkob3B0aW9ucyk7XG4gIH1cblxuICBjb25zdCBpbnB1dE1hcCA9ICEhb3B0aW9ucy5tYXAgJiYgKEpTT04ucGFyc2Uob3B0aW9ucy5tYXApIGFzIHsgc291cmNlUm9vdD86IHN0cmluZyB9KTtcbiAgLy8gQ2xlYW51cCBzb3VyY2Ugcm9vdCBvdGhlcndpc2UgaXQgd2lsbCBiZSBhZGRlZCB0byBlYWNoIHNvdXJjZSBlbnRyeVxuICBjb25zdCBtYXBTb3VyY2VSb290ID0gaW5wdXRNYXAgJiYgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgaWYgKGlucHV0TWFwKSB7XG4gICAgZGVsZXRlIGlucHV0TWFwLnNvdXJjZVJvb3Q7XG4gIH1cblxuICAvLyBMb2FkIFdlYnBhY2sgb25seSB3aGVuIG5lZWRlZFxuICBpZiAod2VicGFja1NvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgIHdlYnBhY2tTb3VyY2VzID0gKGF3YWl0IGltcG9ydCgnd2VicGFjaycpKS5zb3VyY2VzO1xuICB9XG4gIGNvbnN0IHsgQ29uY2F0U291cmNlLCBPcmlnaW5hbFNvdXJjZSwgUmVwbGFjZVNvdXJjZSwgU291cmNlTWFwU291cmNlIH0gPSB3ZWJwYWNrU291cmNlcztcblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBjb250ZW50ID0gbmV3IFJlcGxhY2VTb3VyY2UoXG4gICAgICBpbnB1dE1hcFxuICAgICAgICA/IG5ldyBTb3VyY2VNYXBTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lLCBpbnB1dE1hcClcbiAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lKSxcbiAgICApO1xuXG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgZm9yIChjb25zdCBwb3NpdGlvbiBvZiBwb3NpdGlvbnMpIHtcbiAgICAgIGNvbnN0IHRyYW5zbGF0ZWQgPSBsb2NhbGl6ZURpYWcudHJhbnNsYXRlKFxuICAgICAgICBkaWFnbm9zdGljcyxcbiAgICAgICAgdHJhbnNsYXRpb25zLFxuICAgICAgICBwb3NpdGlvbi5tZXNzYWdlUGFydHMsXG4gICAgICAgIHBvc2l0aW9uLmV4cHJlc3Npb25zLFxuICAgICAgICBpc1NvdXJjZUxvY2FsZSA/ICdpZ25vcmUnIDogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24gfHwgJ3dhcm5pbmcnLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGxvY2FsaXplRGlhZy5idWlsZExvY2FsaXplUmVwbGFjZW1lbnQodHJhbnNsYXRlZFswXSwgdHJhbnNsYXRlZFsxXSk7XG4gICAgICBjb25zdCB7IGNvZGUgfSA9IGdlbmVyYXRlKGV4cHJlc3Npb24pO1xuXG4gICAgICBjb250ZW50LnJlcGxhY2UocG9zaXRpb24uc3RhcnQsIHBvc2l0aW9uLmVuZCAtIDEsIGNvZGUpO1xuICAgIH1cblxuICAgIGxldCBvdXRwdXRTb3VyY2U6IGltcG9ydCgnd2VicGFjaycpLnNvdXJjZXMuU291cmNlID0gY29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIGNvbnN0IHNldExvY2FsZVRleHQgPSBgdmFyICRsb2NhbGl6ZT1PYmplY3QuYXNzaWduKHZvaWQgMD09PSRsb2NhbGl6ZT97fTokbG9jYWxpemUse2xvY2FsZTpcIiR7bG9jYWxlfVwifSk7XFxuYDtcblxuICAgICAgLy8gSWYgbG9jYWxlIGRhdGEgaXMgcHJvdmlkZWQsIGxvYWQgaXQgYW5kIHByZXBlbmQgdG8gZmlsZVxuICAgICAgbGV0IGxvY2FsZURhdGFTb3VyY2U7XG4gICAgICBjb25zdCBsb2NhbGVEYXRhUGF0aCA9IGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGNvbnN0IGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUsIG9wdGlvbnMuZXM1KTtcbiAgICAgICAgbG9jYWxlRGF0YVNvdXJjZSA9IG5ldyBPcmlnaW5hbFNvdXJjZShsb2NhbGVEYXRhQ29udGVudCwgcGF0aC5iYXNlbmFtZShsb2NhbGVEYXRhUGF0aCkpO1xuICAgICAgfVxuXG4gICAgICBvdXRwdXRTb3VyY2UgPSBsb2NhbGVEYXRhU291cmNlXG4gICAgICAgID8gLy8gVGhlIHNlbWljb2xvbiBlbnN1cmVzIHRoYXQgdGhlcmUgaXMgbm8gc3ludGF4IGVycm9yIGJldHdlZW4gc3RhdGVtZW50c1xuICAgICAgICAgIG5ldyBDb25jYXRTb3VyY2Uoc2V0TG9jYWxlVGV4dCwgbG9jYWxlRGF0YVNvdXJjZSwgJztcXG4nLCBjb250ZW50KVxuICAgICAgICA6IG5ldyBDb25jYXRTb3VyY2Uoc2V0TG9jYWxlVGV4dCwgY29udGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBzb3VyY2U6IG91dHB1dENvZGUsIG1hcDogb3V0cHV0TWFwIH0gPSBvdXRwdXRTb3VyY2Uuc291cmNlQW5kTWFwKCkgYXMge1xuICAgICAgc291cmNlOiBzdHJpbmc7XG4gICAgICBtYXA6IHsgZmlsZTogc3RyaW5nOyBzb3VyY2VSb290Pzogc3RyaW5nIH07XG4gICAgfTtcbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoLCBvdXRwdXRDb2RlKTtcblxuICAgIGlmIChpbnB1dE1hcCAmJiBvdXRwdXRNYXApIHtcbiAgICAgIG91dHB1dE1hcC5maWxlID0gb3B0aW9ucy5maWxlbmFtZTtcbiAgICAgIGlmIChtYXBTb3VyY2VSb290KSB7XG4gICAgICAgIG91dHB1dE1hcC5zb3VyY2VSb290ID0gbWFwU291cmNlUm9vdDtcbiAgICAgIH1cbiAgICAgIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IGRpYWdub3N0aWNzLm1lc3NhZ2VzLCBjb3VudDogcG9zaXRpb25zLmxlbmd0aCB9O1xufVxuXG5mdW5jdGlvbiBpbmxpbmVDb3B5T25seShvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4bikge1xuICAgIHRocm93IG5ldyBFcnJvcignaTE4biBvcHRpb25zIGFyZSBtaXNzaW5nJyk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoLCBvcHRpb25zLmNvZGUpO1xuICAgIGlmIChvcHRpb25zLm1hcCkge1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoICsgJy5tYXAnLCBvcHRpb25zLm1hcCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTG9jYWxpemVQb3NpdGlvbnMoXG4gIGFzdDogUGFyc2VSZXN1bHQsXG4gIG9wdGlvbnM6IElubGluZU9wdGlvbnMsXG4gIHV0aWxzOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUsXG4pOiBMb2NhbGl6ZVBvc2l0aW9uW10ge1xuICBjb25zdCBwb3NpdGlvbnM6IExvY2FsaXplUG9zaXRpb25bXSA9IFtdO1xuXG4gIC8vIFdvcmthcm91bmQgdG8gZW5zdXJlIGEgcGF0aCBodWIgaXMgcHJlc2VudCBmb3IgdHJhdmVyc2FsXG4gIGNvbnN0IHsgRmlsZSB9ID0gcmVxdWlyZSgnQGJhYmVsL2NvcmUnKTtcbiAgY29uc3QgZmlsZSA9IG5ldyBGaWxlKHt9LCB7IGNvZGU6IG9wdGlvbnMuY29kZSwgYXN0IH0pO1xuXG4gIGlmIChvcHRpb25zLmVzNSkge1xuICAgIHRyYXZlcnNlKGZpbGUuYXN0LCB7XG4gICAgICBDYWxsRXhwcmVzc2lvbihwYXRoKSB7XG4gICAgICAgIGNvbnN0IGNhbGxlZSA9IHBhdGguZ2V0KCdjYWxsZWUnKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGNhbGxlZS5pc0lkZW50aWZpZXIoKSAmJlxuICAgICAgICAgIGNhbGxlZS5ub2RlLm5hbWUgPT09IGxvY2FsaXplTmFtZSAmJlxuICAgICAgICAgIHV0aWxzLmlzR2xvYmFsSWRlbnRpZmllcihjYWxsZWUpXG4gICAgICAgICkge1xuICAgICAgICAgIGNvbnN0IFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXSA9IHVud3JhcExvY2FsaXplQ2FsbChwYXRoLCB1dGlscyk7XG4gICAgICAgICAgcG9zaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIHN0YXJ0OiBwYXRoLm5vZGUuc3RhcnQhLFxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIGVuZDogcGF0aC5ub2RlLmVuZCEsXG4gICAgICAgICAgICBtZXNzYWdlUGFydHMsXG4gICAgICAgICAgICBleHByZXNzaW9ucyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICB0cmF2ZXJzZShmaWxlLmFzdCwge1xuICAgICAgVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uKHBhdGgpIHtcbiAgICAgICAgaWYgKHR5cGVzLmlzSWRlbnRpZmllcihwYXRoLm5vZGUudGFnKSAmJiBwYXRoLm5vZGUudGFnLm5hbWUgPT09IGxvY2FsaXplTmFtZSkge1xuICAgICAgICAgIGNvbnN0IFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXSA9IHVud3JhcFRlbXBsYXRlTGl0ZXJhbChwYXRoLCB1dGlscyk7XG4gICAgICAgICAgcG9zaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIHN0YXJ0OiBwYXRoLm5vZGUuc3RhcnQhLFxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIGVuZDogcGF0aC5ub2RlLmVuZCEsXG4gICAgICAgICAgICBtZXNzYWdlUGFydHMsXG4gICAgICAgICAgICBleHByZXNzaW9ucyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBwb3NpdGlvbnM7XG59XG5cbmZ1bmN0aW9uIHVud3JhcFRlbXBsYXRlTGl0ZXJhbChcbiAgcGF0aDogTm9kZVBhdGg8dHlwZXMuVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uPixcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IFtUZW1wbGF0ZVN0cmluZ3NBcnJheSwgdHlwZXMuRXhwcmVzc2lvbltdXSB7XG4gIGNvbnN0IFttZXNzYWdlUGFydHNdID0gdXRpbHMudW53cmFwTWVzc2FnZVBhcnRzRnJvbVRlbXBsYXRlTGl0ZXJhbChcbiAgICBwYXRoLmdldCgncXVhc2knKS5nZXQoJ3F1YXNpcycpLFxuICApO1xuICBjb25zdCBbZXhwcmVzc2lvbnNdID0gdXRpbHMudW53cmFwRXhwcmVzc2lvbnNGcm9tVGVtcGxhdGVMaXRlcmFsKHBhdGguZ2V0KCdxdWFzaScpKTtcblxuICByZXR1cm4gW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdO1xufVxuXG5mdW5jdGlvbiB1bndyYXBMb2NhbGl6ZUNhbGwoXG4gIHBhdGg6IE5vZGVQYXRoPHR5cGVzLkNhbGxFeHByZXNzaW9uPixcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IFtUZW1wbGF0ZVN0cmluZ3NBcnJheSwgdHlwZXMuRXhwcmVzc2lvbltdXSB7XG4gIGNvbnN0IFttZXNzYWdlUGFydHNdID0gdXRpbHMudW53cmFwTWVzc2FnZVBhcnRzRnJvbUxvY2FsaXplQ2FsbChwYXRoKTtcbiAgY29uc3QgW2V4cHJlc3Npb25zXSA9IHV0aWxzLnVud3JhcFN1YnN0aXR1dGlvbnNGcm9tTG9jYWxpemVDYWxsKHBhdGgpO1xuXG4gIHJldHVybiBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbGVEYXRhKHBhdGg6IHN0cmluZywgb3B0aW1pemU6IGJvb2xlYW4sIGVzNTogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIC8vIFRoZSBwYXRoIGlzIHZhbGlkYXRlZCBkdXJpbmcgb3B0aW9uIHByb2Nlc3NpbmcgYmVmb3JlIHRoZSBidWlsZCBzdGFydHNcbiAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpO1xuXG4gIC8vIERvd25sZXZlbCBhbmQgb3B0aW1pemUgdGhlIGRhdGFcbiAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoY29udGVudCwge1xuICAgIGZpbGVuYW1lOiBwYXRoLFxuICAgIC8vIFRoZSB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgcmVxdWlyZS5yZXNvbHZlKCdAYmFiZWwvcHJlc2V0LWVudicpLFxuICAgICAgICB7XG4gICAgICAgICAgYnVnZml4ZXM6IHRydWUsXG4gICAgICAgICAgLy8gSUUgMTEgaXMgdGhlIG9sZGVzdCBzdXBwb3J0ZWQgYnJvd3NlclxuICAgICAgICAgIHRhcmdldHM6IGVzNSA/IHsgaWU6ICcxMScgfSA6IHsgZXNtb2R1bGVzOiB0cnVlIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gICAgbWluaWZpZWQ6IGFsbG93TWluaWZ5ICYmIG9wdGltaXplLFxuICAgIGNvbXBhY3Q6ICFzaG91bGRCZWF1dGlmeSAmJiBvcHRpbWl6ZSxcbiAgICBjb21tZW50czogIW9wdGltaXplLFxuICB9KTtcblxuICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZXJyb3Igb2NjdXJyZWQgcHJvY2Vzc2luZyBidW5kbGUgZm9yIFwiJHtwYXRofVwiLmApO1xuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybVJlc3VsdC5jb2RlO1xufVxuIl19