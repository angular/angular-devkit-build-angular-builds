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
exports.inlineLocales = void 0;
const remapping_1 = __importDefault(require("@ampproject/remapping"));
const core_1 = require("@babel/core");
const fs = __importStar(require("fs/promises"));
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
    const { Diagnostics, makeEs2015TranslatePlugin, makeLocalePlugin } = await loadLocalizeTools();
    const plugins = [];
    const diagnostics = new Diagnostics();
    if (shouldInline) {
        plugins.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeEs2015TranslatePlugin(diagnostics, (translation || {}), {
            missingTranslation: translation === undefined ? 'ignore' : missingTranslation,
        }));
    }
    plugins.push(makeLocalePlugin(locale));
    if (localeDataContent) {
        plugins.push({
            visitor: {
                Program(path) {
                    path.unshiftContainer('body', core_1.template.ast(localeDataContent));
                },
            },
        });
    }
    return { diagnostics, plugins };
}
const localizeName = '$localize';
async function inlineLocales(options) {
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
            sourceType: 'unambiguous',
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
            const localeDataPath = i18n.locales[locale]?.dataPath;
            if (localeDataPath) {
                localeDataContent = await loadLocaleData(localeDataPath, true);
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
        await fs.writeFile(outputPath, transformResult.code);
        if (options.map && transformResult.map) {
            const outputMap = (0, remapping_1.default)([transformResult.map, options.map], () => null);
            await fs.writeFile(outputPath + '.map', JSON.stringify(outputMap));
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
            const setLocaleText = `globalThis.$localize=Object.assign(globalThis.$localize || {},{locale:"${locale}"});\n`;
            // If locale data is provided, load it and prepend to file
            let localeDataSource;
            const localeDataPath = i18n.locales[locale] && i18n.locales[locale].dataPath;
            if (localeDataPath) {
                const localeDataContent = await loadLocaleData(localeDataPath, true);
                localeDataSource = new OriginalSource(localeDataContent, path.basename(localeDataPath));
            }
            outputSource = localeDataSource
                ? // The semicolon ensures that there is no syntax error between statements
                    new ConcatSource(setLocaleText, localeDataSource, ';\n', content)
                : new ConcatSource(setLocaleText, content);
        }
        const { source: outputCode, map: outputMap } = outputSource.sourceAndMap();
        const outputPath = path.join(options.outputPath, i18n.flatOutput ? '' : locale, options.filename);
        await fs.writeFile(outputPath, outputCode);
        if (inputMap && outputMap) {
            outputMap.file = options.filename;
            if (mapSourceRoot) {
                outputMap.sourceRoot = mapSourceRoot;
            }
            await fs.writeFile(outputPath + '.map', JSON.stringify(outputMap));
        }
    }
    return { file: options.filename, diagnostics: diagnostics.messages, count: positions.length };
}
async function inlineCopyOnly(options) {
    if (!i18n) {
        throw new Error('i18n options are missing');
    }
    for (const locale of i18n.inlineLocales) {
        const outputPath = path.join(options.outputPath, i18n.flatOutput ? '' : locale, options.filename);
        await fs.writeFile(outputPath, options.code);
        if (options.map) {
            await fs.writeFile(outputPath + '.map', options.map);
        }
    }
    return { file: options.filename, diagnostics: [], count: 0 };
}
function findLocalizePositions(ast, options, utils) {
    const positions = [];
    // Workaround to ensure a path hub is present for traversal
    const { File } = require('@babel/core');
    const file = new File({}, { code: options.code, ast });
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
async function loadLocaleData(path, optimize) {
    // The path is validated during option processing before the build starts
    const content = await fs.readFile(path, 'utf8');
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
                    targets: { esmodules: true },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNFQUE4QztBQUM5QyxzQ0FTcUI7QUFDckIsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQUM3QixtREFBNEM7QUFFNUMsK0RBQW9FO0FBQ3BFLG1DQUF3QztBQUV4Qyx5Q0FBMkM7QUFLM0MscUNBQXFDO0FBQ3JDLDJEQUEyRDtBQUMzRCxJQUFJLGNBQTRELENBQUM7QUFFakUsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsMkJBQVUsSUFBSSxFQUFFLENBQTJCLENBQUM7QUFFOUQ7Ozs7R0FJRztBQUNILE1BQU0sb0JBQW9CLEdBQUcsS0FBSyxDQUFDO0FBSW5DOzs7R0FHRztBQUNILElBQUksbUJBQXNELENBQUM7QUFFM0Q7Ozs7R0FJRztBQUNILEtBQUssVUFBVSxpQkFBaUI7SUFDOUIsSUFBSSxtQkFBbUIsS0FBSyxTQUFTLEVBQUU7UUFDckMsT0FBTyxtQkFBbUIsQ0FBQztLQUM1QjtJQUVELHFGQUFxRjtJQUNyRix5RkFBeUY7SUFDekYsc0NBQXNDO0lBQ3RDLE9BQU8sSUFBQSx3QkFBYSxFQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDbEQsQ0FBQztBQUVELEtBQUssVUFBVSxpQkFBaUIsQ0FDOUIsTUFBYyxFQUNkLFdBQWdDLEVBQ2hDLGtCQUFrRCxFQUNsRCxZQUFxQixFQUNyQixpQkFBMEI7SUFFMUIsTUFBTSxFQUFFLFdBQVcsRUFBRSx5QkFBeUIsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLE1BQU0saUJBQWlCLEVBQUUsQ0FBQztJQUUvRixNQUFNLE9BQU8sR0FBRyxFQUFFLENB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T0FBTyxFQUFFLENBQUMsb0NBQWMsSUFBSSxRQUFRO1FBQ3BDLFFBQVEsRUFBRSxDQUFDLFFBQVE7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUU7UUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUM1RTtJQUVELE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCByZW1hcHBpbmcgZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCB7XG4gIE5vZGVQYXRoLFxuICBQYXJzZVJlc3VsdCxcbiAgcGFyc2VTeW5jLFxuICB0ZW1wbGF0ZSBhcyB0ZW1wbGF0ZUJ1aWxkZXIsXG4gIHRyYW5zZm9ybUFzeW5jLFxuICB0cmFuc2Zvcm1Gcm9tQXN0U3luYyxcbiAgdHJhdmVyc2UsXG4gIHR5cGVzLFxufSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCB7IElubGluZU9wdGlvbnMgfSBmcm9tICcuL2J1bmRsZS1pbmxpbmUtb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01pbmlmeSwgc2hvdWxkQmVhdXRpZnkgfSBmcm9tICcuL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi9sb2FkLWVzbSc7XG5cbi8vIEV4dHJhY3QgU291cmNlbWFwIGlucHV0IHR5cGUgZnJvbSB0aGUgcmVtYXBwaW5nIGZ1bmN0aW9uIHNpbmNlIGl0IGlzIG5vdCBjdXJyZW50bHkgZXhwb3J0ZWRcbnR5cGUgU291cmNlTWFwSW5wdXQgPSBFeGNsdWRlPFBhcmFtZXRlcnM8dHlwZW9mIHJlbWFwcGluZz5bMF0sIHVua25vd25bXT47XG5cbi8vIExhenkgbG9hZGVkIHdlYnBhY2stc291cmNlcyBvYmplY3Rcbi8vIFdlYnBhY2sgaXMgb25seSBpbXBvcnRlZCBpZiBuZWVkZWQgZHVyaW5nIHRoZSBwcm9jZXNzaW5nXG5sZXQgd2VicGFja1NvdXJjZXM6IHR5cGVvZiBpbXBvcnQoJ3dlYnBhY2snKS5zb3VyY2VzIHwgdW5kZWZpbmVkO1xuXG5jb25zdCB7IGkxOG4gfSA9ICh3b3JrZXJEYXRhIHx8IHt9KSBhcyB7IGkxOG4/OiBJMThuT3B0aW9ucyB9O1xuXG4vKipcbiAqIEludGVybmFsIGZsYWcgdG8gZW5hYmxlIHRoZSBkaXJlY3QgdXNhZ2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgdHJhbnNsYXRpb24gcGx1Z2lucy5cbiAqIFRoZWlyIHVzYWdlIGlzIGN1cnJlbnRseSBzZXZlcmFsIHRpbWVzIHNsb3dlciB0aGFuIHRoZSBzdHJpbmcgbWFuaXB1bGF0aW9uIG1ldGhvZC5cbiAqIEZ1dHVyZSB3b3JrIHRvIG9wdGltaXplIHRoZSBwbHVnaW5zIHNob3VsZCBlbmFibGUgcGx1Z2luIHVzYWdlIGFzIHRoZSBkZWZhdWx0LlxuICovXG5jb25zdCBVU0VfTE9DQUxJWkVfUExVR0lOUyA9IGZhbHNlO1xuXG50eXBlIExvY2FsaXplVXRpbGl0eU1vZHVsZSA9IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIG1vZHVsZS5cbiAqIFRoaXMgaXMgdXNlZCB0byByZW1vdmUgdGhlIG5lZWQgdG8gcmVwZWF0ZWRseSBpbXBvcnQgdGhlIG1vZHVsZSBwZXIgZmlsZSB0cmFuc2xhdGlvbi5cbiAqL1xubGV0IGxvY2FsaXplVG9vbHNNb2R1bGU6IExvY2FsaXplVXRpbGl0eU1vZHVsZSB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBdHRlbXB0cyB0byBsb2FkIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIG1vZHVsZSBjb250YWluaW5nIHRoZSBmdW5jdGlvbmFsaXR5IHRvXG4gKiBwZXJmb3JtIHRoZSBmaWxlIHRyYW5zbGF0aW9ucy5cbiAqIFRoaXMgbW9kdWxlIG11c3QgYmUgZHluYW1pY2FsbHkgbG9hZGVkIGFzIGl0IGlzIGFuIEVTTSBtb2R1bGUgYW5kIHRoaXMgZmlsZSBpcyBDb21tb25KUy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gbG9hZExvY2FsaXplVG9vbHMoKTogUHJvbWlzZTxMb2NhbGl6ZVV0aWxpdHlNb2R1bGU+IHtcbiAgaWYgKGxvY2FsaXplVG9vbHNNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuICB9XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICByZXR1cm4gbG9hZEVzbU1vZHVsZSgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlSTE4blBsdWdpbnMoXG4gIGxvY2FsZTogc3RyaW5nLFxuICB0cmFuc2xhdGlvbjogdW5rbm93biB8IHVuZGVmaW5lZCxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScsXG4gIHNob3VsZElubGluZTogYm9vbGVhbixcbiAgbG9jYWxlRGF0YUNvbnRlbnQ/OiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgeyBEaWFnbm9zdGljcywgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbiwgbWFrZUxvY2FsZVBsdWdpbiB9ID0gYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IERpYWdub3N0aWNzKCk7XG5cbiAgaWYgKHNob3VsZElubGluZSkge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCAodHJhbnNsYXRpb24gfHwge30pIGFzIGFueSwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IHRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQgPyAnaWdub3JlJyA6IG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwbHVnaW5zLnB1c2gobWFrZUxvY2FsZVBsdWdpbihsb2NhbGUpKTtcblxuICBpZiAobG9jYWxlRGF0YUNvbnRlbnQpIHtcbiAgICBwbHVnaW5zLnB1c2goe1xuICAgICAgdmlzaXRvcjoge1xuICAgICAgICBQcm9ncmFtKHBhdGg6IE5vZGVQYXRoPHR5cGVzLlByb2dyYW0+KSB7XG4gICAgICAgICAgcGF0aC51bnNoaWZ0Q29udGFpbmVyKCdib2R5JywgdGVtcGxhdGVCdWlsZGVyLmFzdChsb2NhbGVEYXRhQ29udGVudCkpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7IGRpYWdub3N0aWNzLCBwbHVnaW5zIH07XG59XG5cbmludGVyZmFjZSBMb2NhbGl6ZVBvc2l0aW9uIHtcbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIG1lc3NhZ2VQYXJ0czogVGVtcGxhdGVTdHJpbmdzQXJyYXk7XG4gIGV4cHJlc3Npb25zOiB0eXBlcy5FeHByZXNzaW9uW107XG59XG5cbmNvbnN0IGxvY2FsaXplTmFtZSA9ICckbG9jYWxpemUnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlcyhvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuICBpZiAoaTE4bi5mbGF0T3V0cHV0ICYmIGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignRmxhdCBvdXRwdXQgaXMgb25seSBzdXBwb3J0ZWQgd2hlbiBpbmxpbmluZyBvbmUgbG9jYWxlLicpO1xuICB9XG5cbiAgY29uc3QgaGFzTG9jYWxpemVOYW1lID0gb3B0aW9ucy5jb2RlLmluY2x1ZGVzKGxvY2FsaXplTmFtZSk7XG4gIGlmICghaGFzTG9jYWxpemVOYW1lICYmICFvcHRpb25zLnNldExvY2FsZSkge1xuICAgIHJldHVybiBpbmxpbmVDb3B5T25seShvcHRpb25zKTtcbiAgfVxuXG4gIGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG5cbiAgbGV0IGFzdDogUGFyc2VSZXN1bHQgfCB1bmRlZmluZWQgfCBudWxsO1xuICB0cnkge1xuICAgIGFzdCA9IHBhcnNlU3luYyhvcHRpb25zLmNvZGUsIHtcbiAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICBzb3VyY2VUeXBlOiAndW5hbWJpZ3VvdXMnLFxuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAvLyBNYWtlIHRoZSBlcnJvciBtb3JlIHJlYWRhYmxlLlxuICAgIC8vIFNhbWUgZXJyb3JzIHdpbGwgY29udGFpbiB0aGUgZnVsbCBjb250ZW50IG9mIHRoZSBmaWxlIGFzIHRoZSBlcnJvciBtZXNzYWdlXG4gICAgLy8gV2hpY2ggbWFrZXMgaXQgaGFyZCB0byBmaW5kIHRoZSBhY3R1YWwgZXJyb3IgbWVzc2FnZS5cbiAgICBjb25zdCBpbmRleCA9IGVycm9yLm1lc3NhZ2UuaW5kZXhPZignKVxcbicpO1xuICAgIGNvbnN0IG1zZyA9IGluZGV4ICE9PSAtMSA/IGVycm9yLm1lc3NhZ2Uuc2xpY2UoMCwgaW5kZXggKyAxKSA6IGVycm9yLm1lc3NhZ2U7XG4gICAgdGhyb3cgbmV3IEVycm9yKGAke21zZ31cXG5BbiBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIWFzdCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIVVTRV9MT0NBTElaRV9QTFVHSU5TKSB7XG4gICAgcmV0dXJuIGlubGluZUxvY2FsZXNEaXJlY3QoYXN0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGRpYWdub3N0aWNzID0gW107XG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGlzU291cmNlTG9jYWxlID0gbG9jYWxlID09PSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IHRyYW5zbGF0aW9uczogYW55ID0gaXNTb3VyY2VMb2NhbGUgPyB7fSA6IGkxOG4ubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uIHx8IHt9O1xuICAgIGxldCBsb2NhbGVEYXRhQ29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIC8vIElmIGxvY2FsZSBkYXRhIGlzIHByb3ZpZGVkLCBsb2FkIGl0IGFuZCBwcmVwZW5kIHRvIGZpbGVcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHsgZGlhZ25vc3RpY3M6IGxvY2FsZURpYWdub3N0aWNzLCBwbHVnaW5zIH0gPSBhd2FpdCBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9ucyxcbiAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICB0cnVlLFxuICAgICAgbG9jYWxlRGF0YUNvbnRlbnQsXG4gICAgKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Gcm9tQXN0U3luYyhhc3QsIG9wdGlvbnMuY29kZSwge1xuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgICAvLyB1c2luZyBmYWxzZSBlbnN1cmVzIHRoYXQgYmFiZWwgd2lsbCBOT1Qgc2VhcmNoIGFuZCBwcm9jZXNzIHNvdXJjZW1hcCBjb21tZW50cyAobGFyZ2UgbWVtb3J5IHVzYWdlKVxuICAgICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHBsdWdpbnMsXG4gICAgICBjb21wYWN0OiAhc2hvdWxkQmVhdXRpZnksXG4gICAgICBzb3VyY2VNYXBzOiAhIW9wdGlvbnMubWFwLFxuICAgIH0pO1xuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5sb2NhbGVEaWFnbm9zdGljcy5tZXNzYWdlcyk7XG5cbiAgICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke29wdGlvbnMuZmlsZW5hbWV9XCIuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihcbiAgICAgIG9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIGkxOG4uZmxhdE91dHB1dCA/ICcnIDogbG9jYWxlLFxuICAgICAgb3B0aW9ucy5maWxlbmFtZSxcbiAgICApO1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoLCB0cmFuc2Zvcm1SZXN1bHQuY29kZSk7XG5cbiAgICBpZiAob3B0aW9ucy5tYXAgJiYgdHJhbnNmb3JtUmVzdWx0Lm1hcCkge1xuICAgICAgY29uc3Qgb3V0cHV0TWFwID0gcmVtYXBwaW5nKFt0cmFuc2Zvcm1SZXN1bHQubWFwIGFzIFNvdXJjZU1hcElucHV0LCBvcHRpb25zLm1hcF0sICgpID0+IG51bGwpO1xuXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3MgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlc0RpcmVjdChhc3Q6IFBhcnNlUmVzdWx0LCBvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuXG4gIGNvbnN0IHsgZGVmYXVsdDogZ2VuZXJhdGUgfSA9IGF3YWl0IGltcG9ydCgnQGJhYmVsL2dlbmVyYXRvcicpO1xuICBjb25zdCBsb2NhbGl6ZURpYWcgPSBhd2FpdCBsb2FkTG9jYWxpemVUb29scygpO1xuICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBsb2NhbGl6ZURpYWcuRGlhZ25vc3RpY3MoKTtcblxuICBjb25zdCBwb3NpdGlvbnMgPSBmaW5kTG9jYWxpemVQb3NpdGlvbnMoYXN0LCBvcHRpb25zLCBsb2NhbGl6ZURpYWcpO1xuICBpZiAocG9zaXRpb25zLmxlbmd0aCA9PT0gMCAmJiAhb3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICByZXR1cm4gaW5saW5lQ29weU9ubHkob3B0aW9ucyk7XG4gIH1cblxuICBjb25zdCBpbnB1dE1hcCA9ICEhb3B0aW9ucy5tYXAgJiYgKEpTT04ucGFyc2Uob3B0aW9ucy5tYXApIGFzIHsgc291cmNlUm9vdD86IHN0cmluZyB9KTtcbiAgLy8gQ2xlYW51cCBzb3VyY2Ugcm9vdCBvdGhlcndpc2UgaXQgd2lsbCBiZSBhZGRlZCB0byBlYWNoIHNvdXJjZSBlbnRyeVxuICBjb25zdCBtYXBTb3VyY2VSb290ID0gaW5wdXRNYXAgJiYgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgaWYgKGlucHV0TWFwKSB7XG4gICAgZGVsZXRlIGlucHV0TWFwLnNvdXJjZVJvb3Q7XG4gIH1cblxuICAvLyBMb2FkIFdlYnBhY2sgb25seSB3aGVuIG5lZWRlZFxuICBpZiAod2VicGFja1NvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgIHdlYnBhY2tTb3VyY2VzID0gKGF3YWl0IGltcG9ydCgnd2VicGFjaycpKS5zb3VyY2VzO1xuICB9XG4gIGNvbnN0IHsgQ29uY2F0U291cmNlLCBPcmlnaW5hbFNvdXJjZSwgUmVwbGFjZVNvdXJjZSwgU291cmNlTWFwU291cmNlIH0gPSB3ZWJwYWNrU291cmNlcztcblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBjb250ZW50ID0gbmV3IFJlcGxhY2VTb3VyY2UoXG4gICAgICBpbnB1dE1hcFxuICAgICAgICA/IG5ldyBTb3VyY2VNYXBTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lLCBpbnB1dE1hcClcbiAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lKSxcbiAgICApO1xuXG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgZm9yIChjb25zdCBwb3NpdGlvbiBvZiBwb3NpdGlvbnMpIHtcbiAgICAgIGNvbnN0IHRyYW5zbGF0ZWQgPSBsb2NhbGl6ZURpYWcudHJhbnNsYXRlKFxuICAgICAgICBkaWFnbm9zdGljcyxcbiAgICAgICAgdHJhbnNsYXRpb25zLFxuICAgICAgICBwb3NpdGlvbi5tZXNzYWdlUGFydHMsXG4gICAgICAgIHBvc2l0aW9uLmV4cHJlc3Npb25zLFxuICAgICAgICBpc1NvdXJjZUxvY2FsZSA/ICdpZ25vcmUnIDogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24gfHwgJ3dhcm5pbmcnLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGxvY2FsaXplRGlhZy5idWlsZExvY2FsaXplUmVwbGFjZW1lbnQodHJhbnNsYXRlZFswXSwgdHJhbnNsYXRlZFsxXSk7XG4gICAgICBjb25zdCB7IGNvZGUgfSA9IGdlbmVyYXRlKGV4cHJlc3Npb24pO1xuXG4gICAgICBjb250ZW50LnJlcGxhY2UocG9zaXRpb24uc3RhcnQsIHBvc2l0aW9uLmVuZCAtIDEsIGNvZGUpO1xuICAgIH1cblxuICAgIGxldCBvdXRwdXRTb3VyY2U6IGltcG9ydCgnd2VicGFjaycpLnNvdXJjZXMuU291cmNlID0gY29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIGNvbnN0IHNldExvY2FsZVRleHQgPSBgZ2xvYmFsVGhpcy4kbG9jYWxpemU9T2JqZWN0LmFzc2lnbihnbG9iYWxUaGlzLiRsb2NhbGl6ZSB8fCB7fSx7bG9jYWxlOlwiJHtsb2NhbGV9XCJ9KTtcXG5gO1xuXG4gICAgICAvLyBJZiBsb2NhbGUgZGF0YSBpcyBwcm92aWRlZCwgbG9hZCBpdCBhbmQgcHJlcGVuZCB0byBmaWxlXG4gICAgICBsZXQgbG9jYWxlRGF0YVNvdXJjZTtcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0uZGF0YVBhdGg7XG4gICAgICBpZiAobG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgICAgY29uc3QgbG9jYWxlRGF0YUNvbnRlbnQgPSBhd2FpdCBsb2FkTG9jYWxlRGF0YShsb2NhbGVEYXRhUGF0aCwgdHJ1ZSk7XG4gICAgICAgIGxvY2FsZURhdGFTb3VyY2UgPSBuZXcgT3JpZ2luYWxTb3VyY2UobG9jYWxlRGF0YUNvbnRlbnQsIHBhdGguYmFzZW5hbWUobG9jYWxlRGF0YVBhdGgpKTtcbiAgICAgIH1cblxuICAgICAgb3V0cHV0U291cmNlID0gbG9jYWxlRGF0YVNvdXJjZVxuICAgICAgICA/IC8vIFRoZSBzZW1pY29sb24gZW5zdXJlcyB0aGF0IHRoZXJlIGlzIG5vIHN5bnRheCBlcnJvciBiZXR3ZWVuIHN0YXRlbWVudHNcbiAgICAgICAgICBuZXcgQ29uY2F0U291cmNlKHNldExvY2FsZVRleHQsIGxvY2FsZURhdGFTb3VyY2UsICc7XFxuJywgY29udGVudClcbiAgICAgICAgOiBuZXcgQ29uY2F0U291cmNlKHNldExvY2FsZVRleHQsIGNvbnRlbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgc291cmNlOiBvdXRwdXRDb2RlLCBtYXA6IG91dHB1dE1hcCB9ID0gb3V0cHV0U291cmNlLnNvdXJjZUFuZE1hcCgpIGFzIHtcbiAgICAgIHNvdXJjZTogc3RyaW5nO1xuICAgICAgbWFwOiB7IGZpbGU6IHN0cmluZzsgc291cmNlUm9vdD86IHN0cmluZyB9O1xuICAgIH07XG4gICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihcbiAgICAgIG9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIGkxOG4uZmxhdE91dHB1dCA/ICcnIDogbG9jYWxlLFxuICAgICAgb3B0aW9ucy5maWxlbmFtZSxcbiAgICApO1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoLCBvdXRwdXRDb2RlKTtcblxuICAgIGlmIChpbnB1dE1hcCAmJiBvdXRwdXRNYXApIHtcbiAgICAgIG91dHB1dE1hcC5maWxlID0gb3B0aW9ucy5maWxlbmFtZTtcbiAgICAgIGlmIChtYXBTb3VyY2VSb290KSB7XG4gICAgICAgIG91dHB1dE1hcC5zb3VyY2VSb290ID0gbWFwU291cmNlUm9vdDtcbiAgICAgIH1cbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoICsgJy5tYXAnLCBKU09OLnN0cmluZ2lmeShvdXRwdXRNYXApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljczogZGlhZ25vc3RpY3MubWVzc2FnZXMsIGNvdW50OiBwb3NpdGlvbnMubGVuZ3RoIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGlubGluZUNvcHlPbmx5KG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpMThuIG9wdGlvbnMgYXJlIG1pc3NpbmcnKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCwgb3B0aW9ucy5jb2RlKTtcbiAgICBpZiAob3B0aW9ucy5tYXApIHtcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoICsgJy5tYXAnLCBvcHRpb25zLm1hcCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTG9jYWxpemVQb3NpdGlvbnMoXG4gIGFzdDogUGFyc2VSZXN1bHQsXG4gIG9wdGlvbnM6IElubGluZU9wdGlvbnMsXG4gIHV0aWxzOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUsXG4pOiBMb2NhbGl6ZVBvc2l0aW9uW10ge1xuICBjb25zdCBwb3NpdGlvbnM6IExvY2FsaXplUG9zaXRpb25bXSA9IFtdO1xuXG4gIC8vIFdvcmthcm91bmQgdG8gZW5zdXJlIGEgcGF0aCBodWIgaXMgcHJlc2VudCBmb3IgdHJhdmVyc2FsXG4gIGNvbnN0IHsgRmlsZSB9ID0gcmVxdWlyZSgnQGJhYmVsL2NvcmUnKTtcbiAgY29uc3QgZmlsZSA9IG5ldyBGaWxlKHt9LCB7IGNvZGU6IG9wdGlvbnMuY29kZSwgYXN0IH0pO1xuXG4gIHRyYXZlcnNlKGZpbGUuYXN0LCB7XG4gICAgVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uKHBhdGgpIHtcbiAgICAgIGlmICh0eXBlcy5pc0lkZW50aWZpZXIocGF0aC5ub2RlLnRhZykgJiYgcGF0aC5ub2RlLnRhZy5uYW1lID09PSBsb2NhbGl6ZU5hbWUpIHtcbiAgICAgICAgY29uc3QgW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdID0gdW53cmFwVGVtcGxhdGVMaXRlcmFsKHBhdGgsIHV0aWxzKTtcbiAgICAgICAgcG9zaXRpb25zLnB1c2goe1xuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICAgICAgc3RhcnQ6IHBhdGgubm9kZS5zdGFydCEsXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICBlbmQ6IHBhdGgubm9kZS5lbmQhLFxuICAgICAgICAgIG1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgICBleHByZXNzaW9ucyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHBvc2l0aW9ucztcbn1cblxuZnVuY3Rpb24gdW53cmFwVGVtcGxhdGVMaXRlcmFsKFxuICBwYXRoOiBOb2RlUGF0aDx0eXBlcy5UYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24+LFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogW1RlbXBsYXRlU3RyaW5nc0FycmF5LCB0eXBlcy5FeHByZXNzaW9uW11dIHtcbiAgY29uc3QgW21lc3NhZ2VQYXJ0c10gPSB1dGlscy51bndyYXBNZXNzYWdlUGFydHNGcm9tVGVtcGxhdGVMaXRlcmFsKFxuICAgIHBhdGguZ2V0KCdxdWFzaScpLmdldCgncXVhc2lzJyksXG4gICk7XG4gIGNvbnN0IFtleHByZXNzaW9uc10gPSB1dGlscy51bndyYXBFeHByZXNzaW9uc0Zyb21UZW1wbGF0ZUxpdGVyYWwocGF0aC5nZXQoJ3F1YXNpJykpO1xuXG4gIHJldHVybiBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc107XG59XG5cbmZ1bmN0aW9uIHVud3JhcExvY2FsaXplQ2FsbChcbiAgcGF0aDogTm9kZVBhdGg8dHlwZXMuQ2FsbEV4cHJlc3Npb24+LFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogW1RlbXBsYXRlU3RyaW5nc0FycmF5LCB0eXBlcy5FeHByZXNzaW9uW11dIHtcbiAgY29uc3QgW21lc3NhZ2VQYXJ0c10gPSB1dGlscy51bndyYXBNZXNzYWdlUGFydHNGcm9tTG9jYWxpemVDYWxsKHBhdGgpO1xuICBjb25zdCBbZXhwcmVzc2lvbnNdID0gdXRpbHMudW53cmFwU3Vic3RpdHV0aW9uc0Zyb21Mb2NhbGl6ZUNhbGwocGF0aCk7XG5cbiAgcmV0dXJuIFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZExvY2FsZURhdGEocGF0aDogc3RyaW5nLCBvcHRpbWl6ZTogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIC8vIFRoZSBwYXRoIGlzIHZhbGlkYXRlZCBkdXJpbmcgb3B0aW9uIHByb2Nlc3NpbmcgYmVmb3JlIHRoZSBidWlsZCBzdGFydHNcbiAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHBhdGgsICd1dGY4Jyk7XG5cbiAgLy8gRG93bmxldmVsIGFuZCBvcHRpbWl6ZSB0aGUgZGF0YVxuICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhjb250ZW50LCB7XG4gICAgZmlsZW5hbWU6IHBhdGgsXG4gICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSBhcyBhbnksXG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgcHJlc2V0czogW1xuICAgICAgW1xuICAgICAgICByZXF1aXJlLnJlc29sdmUoJ0BiYWJlbC9wcmVzZXQtZW52JyksXG4gICAgICAgIHtcbiAgICAgICAgICBidWdmaXhlczogdHJ1ZSxcbiAgICAgICAgICB0YXJnZXRzOiB7IGVzbW9kdWxlczogdHJ1ZSB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICBdLFxuICAgIG1pbmlmaWVkOiBhbGxvd01pbmlmeSAmJiBvcHRpbWl6ZSxcbiAgICBjb21wYWN0OiAhc2hvdWxkQmVhdXRpZnkgJiYgb3B0aW1pemUsXG4gICAgY29tbWVudHM6ICFvcHRpbWl6ZSxcbiAgfSk7XG5cbiAgaWYgKCF0cmFuc2Zvcm1SZXN1bHQgfHwgIXRyYW5zZm9ybVJlc3VsdC5jb2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVycm9yIG9jY3VycmVkIHByb2Nlc3NpbmcgYnVuZGxlIGZvciBcIiR7cGF0aH1cIi5gKTtcbiAgfVxuXG4gIHJldHVybiB0cmFuc2Zvcm1SZXN1bHQuY29kZTtcbn1cbiJdfQ==