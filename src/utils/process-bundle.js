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
const error_1 = require("./error");
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
        (0, error_1.assertIsError)(error);
        // Make the error more readable.
        // Same errors will contain the full content of the file as the error message
        // Which makes it hard to find the actual error message.
        const index = error.message.indexOf(')\n');
        const msg = index !== -1 ? error.message.slice(0, index + 1) : error.message;
        throw new Error(`${msg}\nAn error occurred inlining file "${options.filename}"`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNFQUE4QztBQUM5QyxzQ0FRcUI7QUFDckIsK0RBQThDO0FBQzlDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsbURBQTRDO0FBQzVDLCtEQUFvRTtBQUNwRSxtQ0FBd0M7QUFFeEMseUNBQTJDO0FBSzNDLHFDQUFxQztBQUNyQywyREFBMkQ7QUFDM0QsSUFBSSxjQUE0RCxDQUFDO0FBRWpFLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLDJCQUFVLElBQUksRUFBRSxDQUEyQixDQUFDO0FBRTlEOzs7O0dBSUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLEtBQUssQ0FBQztBQUluQzs7O0dBR0c7QUFDSCxJQUFJLG1CQUFzRCxDQUFDO0FBRTNEOzs7O0dBSUc7QUFDSCxLQUFLLFVBQVUsaUJBQWlCO0lBQzlCLElBQUksbUJBQW1CLEtBQUssU0FBUyxFQUFFO1FBQ3JDLE9BQU8sbUJBQW1CLENBQUM7S0FDNUI7SUFFRCxxRkFBcUY7SUFDckYseUZBQXlGO0lBQ3pGLHNDQUFzQztJQUN0QyxPQUFPLElBQUEsd0JBQWEsRUFBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFTSxLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLE1BQWMsRUFDZCxXQUFnQyxFQUNoQyxrQkFBa0QsRUFDbEQsWUFBcUIsRUFDckIsaUJBQTBCO0lBRTFCLE1BQU0sRUFBRSxXQUFXLEVBQUUseUJBQXlCLEVBQUUsc0JBQXNCLEVBQUUsZ0JBQWdCLEVBQUUsR0FDeEYsTUFBTSxpQkFBaUIsRUFBRSxDQUFDO0lBRTVCLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNuQixNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO0lBRXRDLElBQUksWUFBWSxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxJQUFJO1FBQ1YsOERBQThEO1FBQzlELHlCQUF5QixDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQVEsRUFBRTtZQUNqRSxrQkFBa0IsRUFBRSxXQUFXLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLGtCQUFrQjtTQUM5RSxDQUFDLENBQ0gsQ0FBQztRQUVGLE9BQU8sQ0FBQyxJQUFJO1FBQ1YsOERBQThEO1FBQzlELHNCQUFzQixDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQVEsRUFBRTtZQUM5RCxrQkFBa0IsRUFBRSxXQUFXLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLGtCQUFrQjtTQUM5RSxDQUFDLENBQ0gsQ0FBQztLQUNIO0lBRUQsT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRXZDLElBQUksaUJBQWlCLEVBQUU7UUFDckIsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNYLE9BQU8sRUFBRTtnQkFDUCxPQUFPLENBQUMsSUFBNkI7b0JBQ25DLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsa0JBQWUsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO2dCQUN4RSxDQUFDO2FBQ0Y7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDbEMsQ0FBQztBQTFDRCw4Q0EwQ0M7QUFtQkQsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFDO0FBRTFCLEtBQUssVUFBVSxhQUFhLENBQUMsT0FBc0I7O0lBQ3hELElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO1FBQzFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQztLQUM5RDtJQUNELElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUU7UUFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5REFBeUQsQ0FBQyxDQUFDO0tBQzVFO0lBRUQsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDNUQsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUU7UUFDMUMsT0FBTyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7S0FDaEM7SUFFRCxNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFFMUIsSUFBSSxHQUFtQyxDQUFDO0lBQ3hDLElBQUk7UUFDRixHQUFHLEdBQUcsSUFBQSxnQkFBUyxFQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDNUIsT0FBTyxFQUFFLEtBQUs7WUFDZCxVQUFVLEVBQUUsS0FBSztZQUNqQixVQUFVLEVBQUUsUUFBUTtZQUNwQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7U0FDM0IsQ0FBQyxDQUFDO0tBQ0o7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLElBQUEscUJBQWEsRUFBQyxLQUFLLENBQUMsQ0FBQztRQUVyQixnQ0FBZ0M7UUFDaEMsNkVBQTZFO1FBQzdFLHdEQUF3RDtRQUN4RCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQyxNQUFNLEdBQUcsR0FBRyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDN0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLEdBQUcsc0NBQXNDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0tBQ2xGO0lBRUQsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUNSLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0tBQy9FO0lBRUQsSUFBSSxDQUFDLG9CQUFvQixFQUFFO1FBQ3pCLE9BQU8sbUJBQW1CLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQzFDO0lBRUQsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRTtRQUN2QyxNQUFNLGNBQWMsR0FBRyxNQUFNLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQztRQUNwRCw4REFBOEQ7UUFDOUQsTUFBTSxZQUFZLEdBQVEsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQztRQUN2RixJQUFJLGlCQUFpQixDQUFDO1FBQ3RCLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRTtZQUNyQiwwREFBMEQ7WUFDMUQsTUFBTSxjQUFjLEdBQUcsTUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQywwQ0FBRSxRQUFRLENBQUM7WUFDdEQsSUFBSSxjQUFjLEVBQUU7Z0JBQ2xCLGlCQUFpQixHQUFHLE1BQU0sY0FBYyxDQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQzdFO1NBQ0Y7UUFFRCxNQUFNLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLE9BQU8sRUFBRSxHQUFHLE1BQU0saUJBQWlCLENBQ3pFLE1BQU0sRUFDTixZQUFZLEVBQ1osY0FBYyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsSUFBSSxTQUFTLEVBQ25FLElBQUksRUFDSixpQkFBaUIsQ0FDbEIsQ0FBQztRQUNGLE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBQSwyQkFBb0IsRUFBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRTtZQUNwRSxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIscUdBQXFHO1lBQ3JHLG9FQUFvRTtZQUNwRSw4REFBOEQ7WUFDOUQsY0FBYyxFQUFFLEtBQVk7WUFDNUIsT0FBTyxFQUFFLEtBQUs7WUFDZCxVQUFVLEVBQUUsS0FBSztZQUNqQixPQUFPO1lBQ1AsT0FBTyxFQUFFLENBQUMsb0NBQWM7WUFDeEIsVUFBVSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRztTQUMxQixDQUFDLENBQUM7UUFFSCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUU7WUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsT0FBTyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUM7U0FDeEY7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUMxQixPQUFPLENBQUMsVUFBVSxFQUNsQixJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFDN0IsT0FBTyxDQUFDLFFBQVEsQ0FDakIsQ0FBQztRQUNGLEVBQUUsQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVuRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLElBQUksZUFBZSxDQUFDLEdBQUcsRUFBRTtZQUN0QyxNQUFNLFNBQVMsR0FBRyxJQUFBLG1CQUFTLEVBQUMsQ0FBQyxlQUFlLENBQUMsR0FBcUIsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFOUYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztTQUNsRTtLQUNGO0lBRUQsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxDQUFDO0FBQ2pELENBQUM7QUFqR0Qsc0NBaUdDO0FBRUQsS0FBSyxVQUFVLG1CQUFtQixDQUFDLEdBQWdCLEVBQUUsT0FBc0I7SUFDekUsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUU7UUFDMUMsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO0tBQzlEO0lBRUQsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyx3REFBYSxrQkFBa0IsR0FBQyxDQUFDO0lBQy9ELE1BQU0sWUFBWSxHQUFHLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUMvQyxNQUFNLFdBQVcsR0FBRyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUVuRCxNQUFNLFNBQVMsR0FBRyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3BFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFO1FBQ2hELE9BQU8sY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ2hDO0lBRUQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUE2QixDQUFDO0lBQ3ZGLHNFQUFzRTtJQUN0RSxNQUFNLGFBQWEsR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQztJQUN0RCxJQUFJLFFBQVEsRUFBRTtRQUNaLE9BQU8sUUFBUSxDQUFDLFVBQVUsQ0FBQztLQUM1QjtJQUVELGdDQUFnQztJQUNoQyxJQUFJLGNBQWMsS0FBSyxTQUFTLEVBQUU7UUFDaEMsY0FBYyxHQUFHLENBQUMsd0RBQWEsU0FBUyxHQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7S0FDcEQ7SUFDRCxNQUFNLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLEdBQUcsY0FBYyxDQUFDO0lBRXhGLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRTtRQUN2QyxNQUFNLE9BQU8sR0FBRyxJQUFJLGFBQWEsQ0FDL0IsUUFBUTtZQUNOLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO1lBQy9ELENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FDdkQsQ0FBQztRQUVGLE1BQU0sY0FBYyxHQUFHLE1BQU0sS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQ3BELDhEQUE4RDtRQUM5RCxNQUFNLFlBQVksR0FBUSxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDO1FBQ3ZGLEtBQUssTUFBTSxRQUFRLElBQUksU0FBUyxFQUFFO1lBQ2hDLE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQ3ZDLFdBQVcsRUFDWCxZQUFZLEVBQ1osUUFBUSxDQUFDLFlBQVksRUFDckIsUUFBUSxDQUFDLFdBQVcsRUFDcEIsY0FBYyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsSUFBSSxTQUFTLENBQ3BFLENBQUM7WUFFRixNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsd0JBQXdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZGLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFdEMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3pEO1FBRUQsSUFBSSxZQUFZLEdBQXFDLE9BQU8sQ0FBQztRQUM3RCxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUU7WUFDckIsTUFBTSxhQUFhLEdBQUcsd0VBQXdFLE1BQU0sUUFBUSxDQUFDO1lBRTdHLDBEQUEwRDtZQUMxRCxJQUFJLGdCQUFnQixDQUFDO1lBQ3JCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDN0UsSUFBSSxjQUFjLEVBQUU7Z0JBQ2xCLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxjQUFjLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2xGLGdCQUFnQixHQUFHLElBQUksY0FBYyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQzthQUN6RjtZQUVELFlBQVksR0FBRyxnQkFBZ0I7Z0JBQzdCLENBQUMsQ0FBQyx5RUFBeUU7b0JBQ3pFLElBQUksWUFBWSxDQUFDLGFBQWEsRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDO2dCQUNuRSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQzlDO1FBRUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxHQUFHLFlBQVksQ0FBQyxZQUFZLEVBR3ZFLENBQUM7UUFDRixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUMxQixPQUFPLENBQUMsVUFBVSxFQUNsQixJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFDN0IsT0FBTyxDQUFDLFFBQVEsQ0FDakIsQ0FBQztRQUNGLEVBQUUsQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRXpDLElBQUksUUFBUSxJQUFJLFNBQVMsRUFBRTtZQUN6QixTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7WUFDbEMsSUFBSSxhQUFhLEVBQUU7Z0JBQ2pCLFNBQVMsQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDO2FBQ3RDO1lBQ0QsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztTQUNsRTtLQUNGO0lBRUQsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxXQUFXLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDaEcsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLE9BQXNCO0lBQzVDLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDVCxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7S0FDN0M7SUFFRCxLQUFLLE1BQU0sTUFBTSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDdkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FDMUIsT0FBTyxDQUFDLFVBQVUsRUFDbEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQzdCLE9BQU8sQ0FBQyxRQUFRLENBQ2pCLENBQUM7UUFDRixFQUFFLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0MsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ2YsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEdBQUcsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNwRDtLQUNGO0lBRUQsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO0FBQy9ELENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUM1QixHQUFnQixFQUNoQixPQUFzQixFQUN0QixLQUE0QjtJQUU1QixNQUFNLFNBQVMsR0FBdUIsRUFBRSxDQUFDO0lBRXpDLDJEQUEyRDtJQUMzRCxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3hDLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFFdkQsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQ2YsSUFBQSxlQUFRLEVBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUNqQixjQUFjLENBQUMsSUFBSTtnQkFDakIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEMsSUFDRSxNQUFNLENBQUMsWUFBWSxFQUFFO29CQUNyQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxZQUFZO29CQUNqQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQ2hDO29CQUNBLE1BQU0sQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUNwRSxTQUFTLENBQUMsSUFBSSxDQUFDO3dCQUNiLG9FQUFvRTt3QkFDcEUsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBTTt3QkFDdkIsb0VBQW9FO3dCQUNwRSxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFJO3dCQUNuQixZQUFZO3dCQUNaLFdBQVc7cUJBQ1osQ0FBQyxDQUFDO2lCQUNKO1lBQ0gsQ0FBQztTQUNGLENBQUMsQ0FBQztLQUNKO1NBQU07UUFDTCxJQUFBLGVBQVEsRUFBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ2pCLHdCQUF3QixDQUFDLElBQUk7Z0JBQzNCLElBQUksWUFBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUU7b0JBQzVFLE1BQU0sQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLEdBQUcscUJBQXFCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUN2RSxTQUFTLENBQUMsSUFBSSxDQUFDO3dCQUNiLG9FQUFvRTt3QkFDcEUsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBTTt3QkFDdkIsb0VBQW9FO3dCQUNwRSxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFJO3dCQUNuQixZQUFZO3dCQUNaLFdBQVc7cUJBQ1osQ0FBQyxDQUFDO2lCQUNKO1lBQ0gsQ0FBQztTQUNGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQzVCLElBQThDLEVBQzlDLEtBQTRCO0lBRTVCLE1BQU0sQ0FBQyxZQUFZLENBQUMsR0FBRyxLQUFLLENBQUMscUNBQXFDLENBQ2hFLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUNoQyxDQUFDO0lBQ0YsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFcEYsT0FBTyxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FDekIsSUFBb0MsRUFDcEMsS0FBNEI7SUFFNUIsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0RSxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXRFLE9BQU8sQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVELEtBQUssVUFBVSxjQUFjLENBQUMsSUFBWSxFQUFFLFFBQWlCLEVBQUUsR0FBWTtJQUN6RSx5RUFBeUU7SUFDekUsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFOUMsa0NBQWtDO0lBQ2xDLE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBQSxxQkFBYyxFQUFDLE9BQU8sRUFBRTtRQUNwRCxRQUFRLEVBQUUsSUFBSTtRQUNkLG9FQUFvRTtRQUNwRSw4REFBOEQ7UUFDOUQsY0FBYyxFQUFFLEtBQVk7UUFDNUIsT0FBTyxFQUFFLEtBQUs7UUFDZCxVQUFVLEVBQUUsS0FBSztRQUNqQixPQUFPLEVBQUU7WUFDUDtnQkFDRSxPQUFPLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDO2dCQUNwQztvQkFDRSxRQUFRLEVBQUUsSUFBSTtvQkFDZCx3Q0FBd0M7b0JBQ3hDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUU7aUJBQ2xEO2FBQ0Y7U0FDRjtRQUNELFFBQVEsRUFBRSxpQ0FBVyxJQUFJLFFBQVE7UUFDakMsT0FBTyxFQUFFLENBQUMsb0NBQWMsSUFBSSxRQUFRO1FBQ3BDLFFBQVEsRUFBRSxDQUFDLFFBQVE7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUU7UUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUM1RTtJQUVELE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCByZW1hcHBpbmcgZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCB7XG4gIE5vZGVQYXRoLFxuICBQYXJzZVJlc3VsdCxcbiAgcGFyc2VTeW5jLFxuICB0cmFuc2Zvcm1Bc3luYyxcbiAgdHJhbnNmb3JtRnJvbUFzdFN5bmMsXG4gIHRyYXZlcnNlLFxuICB0eXBlcyxcbn0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IHRlbXBsYXRlQnVpbGRlciBmcm9tICdAYmFiZWwvdGVtcGxhdGUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgeyBhbGxvd01pbmlmeSwgc2hvdWxkQmVhdXRpZnkgfSBmcm9tICcuL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi9sb2FkLWVzbSc7XG5cbi8vIEV4dHJhY3QgU291cmNlbWFwIGlucHV0IHR5cGUgZnJvbSB0aGUgcmVtYXBwaW5nIGZ1bmN0aW9uIHNpbmNlIGl0IGlzIG5vdCBjdXJyZW50bHkgZXhwb3J0ZWRcbnR5cGUgU291cmNlTWFwSW5wdXQgPSBFeGNsdWRlPFBhcmFtZXRlcnM8dHlwZW9mIHJlbWFwcGluZz5bMF0sIHVua25vd25bXT47XG5cbi8vIExhenkgbG9hZGVkIHdlYnBhY2stc291cmNlcyBvYmplY3Rcbi8vIFdlYnBhY2sgaXMgb25seSBpbXBvcnRlZCBpZiBuZWVkZWQgZHVyaW5nIHRoZSBwcm9jZXNzaW5nXG5sZXQgd2VicGFja1NvdXJjZXM6IHR5cGVvZiBpbXBvcnQoJ3dlYnBhY2snKS5zb3VyY2VzIHwgdW5kZWZpbmVkO1xuXG5jb25zdCB7IGkxOG4gfSA9ICh3b3JrZXJEYXRhIHx8IHt9KSBhcyB7IGkxOG4/OiBJMThuT3B0aW9ucyB9O1xuXG4vKipcbiAqIEludGVybmFsIGZsYWcgdG8gZW5hYmxlIHRoZSBkaXJlY3QgdXNhZ2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgdHJhbnNsYXRpb24gcGx1Z2lucy5cbiAqIFRoZWlyIHVzYWdlIGlzIGN1cnJlbnRseSBzZXZlcmFsIHRpbWVzIHNsb3dlciB0aGFuIHRoZSBzdHJpbmcgbWFuaXB1bGF0aW9uIG1ldGhvZC5cbiAqIEZ1dHVyZSB3b3JrIHRvIG9wdGltaXplIHRoZSBwbHVnaW5zIHNob3VsZCBlbmFibGUgcGx1Z2luIHVzYWdlIGFzIHRoZSBkZWZhdWx0LlxuICovXG5jb25zdCBVU0VfTE9DQUxJWkVfUExVR0lOUyA9IGZhbHNlO1xuXG50eXBlIExvY2FsaXplVXRpbGl0eU1vZHVsZSA9IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIG1vZHVsZS5cbiAqIFRoaXMgaXMgdXNlZCB0byByZW1vdmUgdGhlIG5lZWQgdG8gcmVwZWF0ZWRseSBpbXBvcnQgdGhlIG1vZHVsZSBwZXIgZmlsZSB0cmFuc2xhdGlvbi5cbiAqL1xubGV0IGxvY2FsaXplVG9vbHNNb2R1bGU6IExvY2FsaXplVXRpbGl0eU1vZHVsZSB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBdHRlbXB0cyB0byBsb2FkIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIG1vZHVsZSBjb250YWluaW5nIHRoZSBmdW5jdGlvbmFsaXR5IHRvXG4gKiBwZXJmb3JtIHRoZSBmaWxlIHRyYW5zbGF0aW9ucy5cbiAqIFRoaXMgbW9kdWxlIG11c3QgYmUgZHluYW1pY2FsbHkgbG9hZGVkIGFzIGl0IGlzIGFuIEVTTSBtb2R1bGUgYW5kIHRoaXMgZmlsZSBpcyBDb21tb25KUy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gbG9hZExvY2FsaXplVG9vbHMoKTogUHJvbWlzZTxMb2NhbGl6ZVV0aWxpdHlNb2R1bGU+IHtcbiAgaWYgKGxvY2FsaXplVG9vbHNNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuICB9XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICByZXR1cm4gbG9hZEVzbU1vZHVsZSgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUkxOG5QbHVnaW5zKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgdHJhbnNsYXRpb246IHVua25vd24gfCB1bmRlZmluZWQsXG4gIG1pc3NpbmdUcmFuc2xhdGlvbjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnLFxuICBzaG91bGRJbmxpbmU6IGJvb2xlYW4sXG4gIGxvY2FsZURhdGFDb250ZW50Pzogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IHsgRGlhZ25vc3RpY3MsIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sIG1ha2VFczVUcmFuc2xhdGVQbHVnaW4sIG1ha2VMb2NhbGVQbHVnaW4gfSA9XG4gICAgYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IERpYWdub3N0aWNzKCk7XG5cbiAgaWYgKHNob3VsZElubGluZSkge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCAodHJhbnNsYXRpb24gfHwge30pIGFzIGFueSwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IHRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQgPyAnaWdub3JlJyA6IG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgKHRyYW5zbGF0aW9uIHx8IHt9KSBhcyBhbnksIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiB0cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkID8gJ2lnbm9yZScgOiBtaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcGx1Z2lucy5wdXNoKG1ha2VMb2NhbGVQbHVnaW4obG9jYWxlKSk7XG5cbiAgaWYgKGxvY2FsZURhdGFDb250ZW50KSB7XG4gICAgcGx1Z2lucy5wdXNoKHtcbiAgICAgIHZpc2l0b3I6IHtcbiAgICAgICAgUHJvZ3JhbShwYXRoOiBOb2RlUGF0aDx0eXBlcy5Qcm9ncmFtPikge1xuICAgICAgICAgIHBhdGgudW5zaGlmdENvbnRhaW5lcignYm9keScsIHRlbXBsYXRlQnVpbGRlci5hc3QobG9jYWxlRGF0YUNvbnRlbnQpKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4geyBkaWFnbm9zdGljcywgcGx1Z2lucyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZU9wdGlvbnMge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBjb2RlOiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZXM1OiBib29sZWFuO1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIG1pc3NpbmdUcmFuc2xhdGlvbj86ICd3YXJuaW5nJyB8ICdlcnJvcicgfCAnaWdub3JlJztcbiAgc2V0TG9jYWxlPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvY2FsaXplUG9zaXRpb24ge1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbiAgbWVzc2FnZVBhcnRzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheTtcbiAgZXhwcmVzc2lvbnM6IHR5cGVzLkV4cHJlc3Npb25bXTtcbn1cblxuY29uc3QgbG9jYWxpemVOYW1lID0gJyRsb2NhbGl6ZSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzKG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG4gIGlmIChpMThuLmZsYXRPdXRwdXQgJiYgaTE4bi5pbmxpbmVMb2NhbGVzLnNpemUgPiAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGbGF0IG91dHB1dCBpcyBvbmx5IHN1cHBvcnRlZCB3aGVuIGlubGluaW5nIG9uZSBsb2NhbGUuJyk7XG4gIH1cblxuICBjb25zdCBoYXNMb2NhbGl6ZU5hbWUgPSBvcHRpb25zLmNvZGUuaW5jbHVkZXMobG9jYWxpemVOYW1lKTtcbiAgaWYgKCFoYXNMb2NhbGl6ZU5hbWUgJiYgIW9wdGlvbnMuc2V0TG9jYWxlKSB7XG4gICAgcmV0dXJuIGlubGluZUNvcHlPbmx5KG9wdGlvbnMpO1xuICB9XG5cbiAgYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBsZXQgYXN0OiBQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZCB8IG51bGw7XG4gIHRyeSB7XG4gICAgYXN0ID0gcGFyc2VTeW5jKG9wdGlvbnMuY29kZSwge1xuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHNvdXJjZVR5cGU6ICdzY3JpcHQnLFxuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAvLyBNYWtlIHRoZSBlcnJvciBtb3JlIHJlYWRhYmxlLlxuICAgIC8vIFNhbWUgZXJyb3JzIHdpbGwgY29udGFpbiB0aGUgZnVsbCBjb250ZW50IG9mIHRoZSBmaWxlIGFzIHRoZSBlcnJvciBtZXNzYWdlXG4gICAgLy8gV2hpY2ggbWFrZXMgaXQgaGFyZCB0byBmaW5kIHRoZSBhY3R1YWwgZXJyb3IgbWVzc2FnZS5cbiAgICBjb25zdCBpbmRleCA9IGVycm9yLm1lc3NhZ2UuaW5kZXhPZignKVxcbicpO1xuICAgIGNvbnN0IG1zZyA9IGluZGV4ICE9PSAtMSA/IGVycm9yLm1lc3NhZ2Uuc2xpY2UoMCwgaW5kZXggKyAxKSA6IGVycm9yLm1lc3NhZ2U7XG4gICAgdGhyb3cgbmV3IEVycm9yKGAke21zZ31cXG5BbiBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIWFzdCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIVVTRV9MT0NBTElaRV9QTFVHSU5TKSB7XG4gICAgcmV0dXJuIGlubGluZUxvY2FsZXNEaXJlY3QoYXN0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGRpYWdub3N0aWNzID0gW107XG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGlzU291cmNlTG9jYWxlID0gbG9jYWxlID09PSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IHRyYW5zbGF0aW9uczogYW55ID0gaXNTb3VyY2VMb2NhbGUgPyB7fSA6IGkxOG4ubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uIHx8IHt9O1xuICAgIGxldCBsb2NhbGVEYXRhQ29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIC8vIElmIGxvY2FsZSBkYXRhIGlzIHByb3ZpZGVkLCBsb2FkIGl0IGFuZCBwcmVwZW5kIHRvIGZpbGVcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUsIG9wdGlvbnMuZXM1KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB7IGRpYWdub3N0aWNzOiBsb2NhbGVEaWFnbm9zdGljcywgcGx1Z2lucyB9ID0gYXdhaXQgY3JlYXRlSTE4blBsdWdpbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICB0cmFuc2xhdGlvbnMsXG4gICAgICBpc1NvdXJjZUxvY2FsZSA/ICdpZ25vcmUnIDogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24gfHwgJ3dhcm5pbmcnLFxuICAgICAgdHJ1ZSxcbiAgICAgIGxvY2FsZURhdGFDb250ZW50LFxuICAgICk7XG4gICAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtRnJvbUFzdFN5bmMoYXN0LCBvcHRpb25zLmNvZGUsIHtcbiAgICAgIGZpbGVuYW1lOiBvcHRpb25zLmZpbGVuYW1lLFxuICAgICAgLy8gdXNpbmcgZmFsc2UgZW5zdXJlcyB0aGF0IGJhYmVsIHdpbGwgTk9UIHNlYXJjaCBhbmQgcHJvY2VzcyBzb3VyY2VtYXAgY29tbWVudHMgKGxhcmdlIG1lbW9yeSB1c2FnZSlcbiAgICAgIC8vIFRoZSB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgaW5wdXRTb3VyY2VNYXA6IGZhbHNlIGFzIGFueSxcbiAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICBwbHVnaW5zLFxuICAgICAgY29tcGFjdDogIXNob3VsZEJlYXV0aWZ5LFxuICAgICAgc291cmNlTWFwczogISFvcHRpb25zLm1hcCxcbiAgICB9KTtcblxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubG9jYWxlRGlhZ25vc3RpY3MubWVzc2FnZXMpO1xuXG4gICAgaWYgKCF0cmFuc2Zvcm1SZXN1bHQgfHwgIXRyYW5zZm9ybVJlc3VsdC5jb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZXJyb3Igb2NjdXJyZWQgcHJvY2Vzc2luZyBidW5kbGUgZm9yIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiLmApO1xuICAgIH1cblxuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIHRyYW5zZm9ybVJlc3VsdC5jb2RlKTtcblxuICAgIGlmIChvcHRpb25zLm1hcCAmJiB0cmFuc2Zvcm1SZXN1bHQubWFwKSB7XG4gICAgICBjb25zdCBvdXRwdXRNYXAgPSByZW1hcHBpbmcoW3RyYW5zZm9ybVJlc3VsdC5tYXAgYXMgU291cmNlTWFwSW5wdXQsIG9wdGlvbnMubWFwXSwgKCkgPT4gbnVsbCk7XG5cbiAgICAgIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3MgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlc0RpcmVjdChhc3Q6IFBhcnNlUmVzdWx0LCBvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuXG4gIGNvbnN0IHsgZGVmYXVsdDogZ2VuZXJhdGUgfSA9IGF3YWl0IGltcG9ydCgnQGJhYmVsL2dlbmVyYXRvcicpO1xuICBjb25zdCBsb2NhbGl6ZURpYWcgPSBhd2FpdCBsb2FkTG9jYWxpemVUb29scygpO1xuICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBsb2NhbGl6ZURpYWcuRGlhZ25vc3RpY3MoKTtcblxuICBjb25zdCBwb3NpdGlvbnMgPSBmaW5kTG9jYWxpemVQb3NpdGlvbnMoYXN0LCBvcHRpb25zLCBsb2NhbGl6ZURpYWcpO1xuICBpZiAocG9zaXRpb25zLmxlbmd0aCA9PT0gMCAmJiAhb3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICByZXR1cm4gaW5saW5lQ29weU9ubHkob3B0aW9ucyk7XG4gIH1cblxuICBjb25zdCBpbnB1dE1hcCA9ICEhb3B0aW9ucy5tYXAgJiYgKEpTT04ucGFyc2Uob3B0aW9ucy5tYXApIGFzIHsgc291cmNlUm9vdD86IHN0cmluZyB9KTtcbiAgLy8gQ2xlYW51cCBzb3VyY2Ugcm9vdCBvdGhlcndpc2UgaXQgd2lsbCBiZSBhZGRlZCB0byBlYWNoIHNvdXJjZSBlbnRyeVxuICBjb25zdCBtYXBTb3VyY2VSb290ID0gaW5wdXRNYXAgJiYgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgaWYgKGlucHV0TWFwKSB7XG4gICAgZGVsZXRlIGlucHV0TWFwLnNvdXJjZVJvb3Q7XG4gIH1cblxuICAvLyBMb2FkIFdlYnBhY2sgb25seSB3aGVuIG5lZWRlZFxuICBpZiAod2VicGFja1NvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgIHdlYnBhY2tTb3VyY2VzID0gKGF3YWl0IGltcG9ydCgnd2VicGFjaycpKS5zb3VyY2VzO1xuICB9XG4gIGNvbnN0IHsgQ29uY2F0U291cmNlLCBPcmlnaW5hbFNvdXJjZSwgUmVwbGFjZVNvdXJjZSwgU291cmNlTWFwU291cmNlIH0gPSB3ZWJwYWNrU291cmNlcztcblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBjb250ZW50ID0gbmV3IFJlcGxhY2VTb3VyY2UoXG4gICAgICBpbnB1dE1hcFxuICAgICAgICA/IG5ldyBTb3VyY2VNYXBTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lLCBpbnB1dE1hcClcbiAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lKSxcbiAgICApO1xuXG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgZm9yIChjb25zdCBwb3NpdGlvbiBvZiBwb3NpdGlvbnMpIHtcbiAgICAgIGNvbnN0IHRyYW5zbGF0ZWQgPSBsb2NhbGl6ZURpYWcudHJhbnNsYXRlKFxuICAgICAgICBkaWFnbm9zdGljcyxcbiAgICAgICAgdHJhbnNsYXRpb25zLFxuICAgICAgICBwb3NpdGlvbi5tZXNzYWdlUGFydHMsXG4gICAgICAgIHBvc2l0aW9uLmV4cHJlc3Npb25zLFxuICAgICAgICBpc1NvdXJjZUxvY2FsZSA/ICdpZ25vcmUnIDogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24gfHwgJ3dhcm5pbmcnLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGxvY2FsaXplRGlhZy5idWlsZExvY2FsaXplUmVwbGFjZW1lbnQodHJhbnNsYXRlZFswXSwgdHJhbnNsYXRlZFsxXSk7XG4gICAgICBjb25zdCB7IGNvZGUgfSA9IGdlbmVyYXRlKGV4cHJlc3Npb24pO1xuXG4gICAgICBjb250ZW50LnJlcGxhY2UocG9zaXRpb24uc3RhcnQsIHBvc2l0aW9uLmVuZCAtIDEsIGNvZGUpO1xuICAgIH1cblxuICAgIGxldCBvdXRwdXRTb3VyY2U6IGltcG9ydCgnd2VicGFjaycpLnNvdXJjZXMuU291cmNlID0gY29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIGNvbnN0IHNldExvY2FsZVRleHQgPSBgdmFyICRsb2NhbGl6ZT1PYmplY3QuYXNzaWduKHZvaWQgMD09PSRsb2NhbGl6ZT97fTokbG9jYWxpemUse2xvY2FsZTpcIiR7bG9jYWxlfVwifSk7XFxuYDtcblxuICAgICAgLy8gSWYgbG9jYWxlIGRhdGEgaXMgcHJvdmlkZWQsIGxvYWQgaXQgYW5kIHByZXBlbmQgdG8gZmlsZVxuICAgICAgbGV0IGxvY2FsZURhdGFTb3VyY2U7XG4gICAgICBjb25zdCBsb2NhbGVEYXRhUGF0aCA9IGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGNvbnN0IGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUsIG9wdGlvbnMuZXM1KTtcbiAgICAgICAgbG9jYWxlRGF0YVNvdXJjZSA9IG5ldyBPcmlnaW5hbFNvdXJjZShsb2NhbGVEYXRhQ29udGVudCwgcGF0aC5iYXNlbmFtZShsb2NhbGVEYXRhUGF0aCkpO1xuICAgICAgfVxuXG4gICAgICBvdXRwdXRTb3VyY2UgPSBsb2NhbGVEYXRhU291cmNlXG4gICAgICAgID8gLy8gVGhlIHNlbWljb2xvbiBlbnN1cmVzIHRoYXQgdGhlcmUgaXMgbm8gc3ludGF4IGVycm9yIGJldHdlZW4gc3RhdGVtZW50c1xuICAgICAgICAgIG5ldyBDb25jYXRTb3VyY2Uoc2V0TG9jYWxlVGV4dCwgbG9jYWxlRGF0YVNvdXJjZSwgJztcXG4nLCBjb250ZW50KVxuICAgICAgICA6IG5ldyBDb25jYXRTb3VyY2Uoc2V0TG9jYWxlVGV4dCwgY29udGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBzb3VyY2U6IG91dHB1dENvZGUsIG1hcDogb3V0cHV0TWFwIH0gPSBvdXRwdXRTb3VyY2Uuc291cmNlQW5kTWFwKCkgYXMge1xuICAgICAgc291cmNlOiBzdHJpbmc7XG4gICAgICBtYXA6IHsgZmlsZTogc3RyaW5nOyBzb3VyY2VSb290Pzogc3RyaW5nIH07XG4gICAgfTtcbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoLCBvdXRwdXRDb2RlKTtcblxuICAgIGlmIChpbnB1dE1hcCAmJiBvdXRwdXRNYXApIHtcbiAgICAgIG91dHB1dE1hcC5maWxlID0gb3B0aW9ucy5maWxlbmFtZTtcbiAgICAgIGlmIChtYXBTb3VyY2VSb290KSB7XG4gICAgICAgIG91dHB1dE1hcC5zb3VyY2VSb290ID0gbWFwU291cmNlUm9vdDtcbiAgICAgIH1cbiAgICAgIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IGRpYWdub3N0aWNzLm1lc3NhZ2VzLCBjb3VudDogcG9zaXRpb25zLmxlbmd0aCB9O1xufVxuXG5mdW5jdGlvbiBpbmxpbmVDb3B5T25seShvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4bikge1xuICAgIHRocm93IG5ldyBFcnJvcignaTE4biBvcHRpb25zIGFyZSBtaXNzaW5nJyk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoLCBvcHRpb25zLmNvZGUpO1xuICAgIGlmIChvcHRpb25zLm1hcCkge1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoICsgJy5tYXAnLCBvcHRpb25zLm1hcCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTG9jYWxpemVQb3NpdGlvbnMoXG4gIGFzdDogUGFyc2VSZXN1bHQsXG4gIG9wdGlvbnM6IElubGluZU9wdGlvbnMsXG4gIHV0aWxzOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUsXG4pOiBMb2NhbGl6ZVBvc2l0aW9uW10ge1xuICBjb25zdCBwb3NpdGlvbnM6IExvY2FsaXplUG9zaXRpb25bXSA9IFtdO1xuXG4gIC8vIFdvcmthcm91bmQgdG8gZW5zdXJlIGEgcGF0aCBodWIgaXMgcHJlc2VudCBmb3IgdHJhdmVyc2FsXG4gIGNvbnN0IHsgRmlsZSB9ID0gcmVxdWlyZSgnQGJhYmVsL2NvcmUnKTtcbiAgY29uc3QgZmlsZSA9IG5ldyBGaWxlKHt9LCB7IGNvZGU6IG9wdGlvbnMuY29kZSwgYXN0IH0pO1xuXG4gIGlmIChvcHRpb25zLmVzNSkge1xuICAgIHRyYXZlcnNlKGZpbGUuYXN0LCB7XG4gICAgICBDYWxsRXhwcmVzc2lvbihwYXRoKSB7XG4gICAgICAgIGNvbnN0IGNhbGxlZSA9IHBhdGguZ2V0KCdjYWxsZWUnKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGNhbGxlZS5pc0lkZW50aWZpZXIoKSAmJlxuICAgICAgICAgIGNhbGxlZS5ub2RlLm5hbWUgPT09IGxvY2FsaXplTmFtZSAmJlxuICAgICAgICAgIHV0aWxzLmlzR2xvYmFsSWRlbnRpZmllcihjYWxsZWUpXG4gICAgICAgICkge1xuICAgICAgICAgIGNvbnN0IFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXSA9IHVud3JhcExvY2FsaXplQ2FsbChwYXRoLCB1dGlscyk7XG4gICAgICAgICAgcG9zaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIHN0YXJ0OiBwYXRoLm5vZGUuc3RhcnQhLFxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIGVuZDogcGF0aC5ub2RlLmVuZCEsXG4gICAgICAgICAgICBtZXNzYWdlUGFydHMsXG4gICAgICAgICAgICBleHByZXNzaW9ucyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICB0cmF2ZXJzZShmaWxlLmFzdCwge1xuICAgICAgVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uKHBhdGgpIHtcbiAgICAgICAgaWYgKHR5cGVzLmlzSWRlbnRpZmllcihwYXRoLm5vZGUudGFnKSAmJiBwYXRoLm5vZGUudGFnLm5hbWUgPT09IGxvY2FsaXplTmFtZSkge1xuICAgICAgICAgIGNvbnN0IFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXSA9IHVud3JhcFRlbXBsYXRlTGl0ZXJhbChwYXRoLCB1dGlscyk7XG4gICAgICAgICAgcG9zaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIHN0YXJ0OiBwYXRoLm5vZGUuc3RhcnQhLFxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgIGVuZDogcGF0aC5ub2RlLmVuZCEsXG4gICAgICAgICAgICBtZXNzYWdlUGFydHMsXG4gICAgICAgICAgICBleHByZXNzaW9ucyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBwb3NpdGlvbnM7XG59XG5cbmZ1bmN0aW9uIHVud3JhcFRlbXBsYXRlTGl0ZXJhbChcbiAgcGF0aDogTm9kZVBhdGg8dHlwZXMuVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uPixcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IFtUZW1wbGF0ZVN0cmluZ3NBcnJheSwgdHlwZXMuRXhwcmVzc2lvbltdXSB7XG4gIGNvbnN0IFttZXNzYWdlUGFydHNdID0gdXRpbHMudW53cmFwTWVzc2FnZVBhcnRzRnJvbVRlbXBsYXRlTGl0ZXJhbChcbiAgICBwYXRoLmdldCgncXVhc2knKS5nZXQoJ3F1YXNpcycpLFxuICApO1xuICBjb25zdCBbZXhwcmVzc2lvbnNdID0gdXRpbHMudW53cmFwRXhwcmVzc2lvbnNGcm9tVGVtcGxhdGVMaXRlcmFsKHBhdGguZ2V0KCdxdWFzaScpKTtcblxuICByZXR1cm4gW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdO1xufVxuXG5mdW5jdGlvbiB1bndyYXBMb2NhbGl6ZUNhbGwoXG4gIHBhdGg6IE5vZGVQYXRoPHR5cGVzLkNhbGxFeHByZXNzaW9uPixcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IFtUZW1wbGF0ZVN0cmluZ3NBcnJheSwgdHlwZXMuRXhwcmVzc2lvbltdXSB7XG4gIGNvbnN0IFttZXNzYWdlUGFydHNdID0gdXRpbHMudW53cmFwTWVzc2FnZVBhcnRzRnJvbUxvY2FsaXplQ2FsbChwYXRoKTtcbiAgY29uc3QgW2V4cHJlc3Npb25zXSA9IHV0aWxzLnVud3JhcFN1YnN0aXR1dGlvbnNGcm9tTG9jYWxpemVDYWxsKHBhdGgpO1xuXG4gIHJldHVybiBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbGVEYXRhKHBhdGg6IHN0cmluZywgb3B0aW1pemU6IGJvb2xlYW4sIGVzNTogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIC8vIFRoZSBwYXRoIGlzIHZhbGlkYXRlZCBkdXJpbmcgb3B0aW9uIHByb2Nlc3NpbmcgYmVmb3JlIHRoZSBidWlsZCBzdGFydHNcbiAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpO1xuXG4gIC8vIERvd25sZXZlbCBhbmQgb3B0aW1pemUgdGhlIGRhdGFcbiAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoY29udGVudCwge1xuICAgIGZpbGVuYW1lOiBwYXRoLFxuICAgIC8vIFRoZSB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgcmVxdWlyZS5yZXNvbHZlKCdAYmFiZWwvcHJlc2V0LWVudicpLFxuICAgICAgICB7XG4gICAgICAgICAgYnVnZml4ZXM6IHRydWUsXG4gICAgICAgICAgLy8gSUUgMTEgaXMgdGhlIG9sZGVzdCBzdXBwb3J0ZWQgYnJvd3NlclxuICAgICAgICAgIHRhcmdldHM6IGVzNSA/IHsgaWU6ICcxMScgfSA6IHsgZXNtb2R1bGVzOiB0cnVlIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gICAgbWluaWZpZWQ6IGFsbG93TWluaWZ5ICYmIG9wdGltaXplLFxuICAgIGNvbXBhY3Q6ICFzaG91bGRCZWF1dGlmeSAmJiBvcHRpbWl6ZSxcbiAgICBjb21tZW50czogIW9wdGltaXplLFxuICB9KTtcblxuICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZXJyb3Igb2NjdXJyZWQgcHJvY2Vzc2luZyBidW5kbGUgZm9yIFwiJHtwYXRofVwiLmApO1xuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybVJlc3VsdC5jb2RlO1xufVxuIl19