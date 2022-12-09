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
            const localeDataPath = (_a = i18n.locales[locale]) === null || _a === void 0 ? void 0 : _a.dataPath;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNFQUE4QztBQUM5QyxzQ0FRcUI7QUFDckIsK0RBQThDO0FBQzlDLGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsbURBQTRDO0FBQzVDLCtEQUFvRTtBQUNwRSxtQ0FBd0M7QUFFeEMseUNBQTJDO0FBSzNDLHFDQUFxQztBQUNyQywyREFBMkQ7QUFDM0QsSUFBSSxjQUE0RCxDQUFDO0FBRWpFLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLDJCQUFVLElBQUksRUFBRSxDQUEyQixDQUFDO0FBRTlEOzs7O0dBSUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLEtBQUssQ0FBQztBQUluQzs7O0dBR0c7QUFDSCxJQUFJLG1CQUFzRCxDQUFDO0FBRTNEOzs7O0dBSUc7QUFDSCxLQUFLLFVBQVUsaUJBQWlCO0lBQzlCLElBQUksbUJBQW1CLEtBQUssU0FBUyxFQUFFO1FBQ3JDLE9BQU8sbUJBQW1CLENBQUM7S0FDNUI7SUFFRCxxRkFBcUY7SUFDckYseUZBQXlGO0lBQ3pGLHNDQUFzQztJQUN0QyxPQUFPLElBQUEsd0JBQWEsRUFBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFTSxLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLE1BQWMsRUFDZCxXQUFnQyxFQUNoQyxrQkFBa0QsRUFDbEQsWUFBcUIsRUFDckIsaUJBQTBCO0lBRTFCLE1BQU0sRUFBRSxXQUFXLEVBQUUseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFFL0YsTUFBTSxPQUFP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Q0QsUUFBUSxFQUFFLGlDQUFXLElBQUksUUFBUTtRQUNqQyxPQUFPLEVBQUUsQ0FBQyxvQ0FBYyxJQUFJLFFBQVE7UUFDcEMsUUFBUSxFQUFFLENBQUMsUUFBUTtLQUNwQixDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRTtRQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxJQUFJLElBQUksQ0FBQyxDQUFDO0tBQzVFO0lBRUQsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHJlbWFwcGluZyBmcm9tICdAYW1wcHJvamVjdC9yZW1hcHBpbmcnO1xuaW1wb3J0IHtcbiAgTm9kZVBhdGgsXG4gIFBhcnNlUmVzdWx0LFxuICBwYXJzZVN5bmMsXG4gIHRyYW5zZm9ybUFzeW5jLFxuICB0cmFuc2Zvcm1Gcm9tQXN0U3luYyxcbiAgdHJhdmVyc2UsXG4gIHR5cGVzLFxufSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgdGVtcGxhdGVCdWlsZGVyIGZyb20gJ0BiYWJlbC90ZW1wbGF0ZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCB7IGFsbG93TWluaWZ5LCBzaG91bGRCZWF1dGlmeSB9IGZyb20gJy4vZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4vaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuL2xvYWQtZXNtJztcblxuLy8gRXh0cmFjdCBTb3VyY2VtYXAgaW5wdXQgdHlwZSBmcm9tIHRoZSByZW1hcHBpbmcgZnVuY3Rpb24gc2luY2UgaXQgaXMgbm90IGN1cnJlbnRseSBleHBvcnRlZFxudHlwZSBTb3VyY2VNYXBJbnB1dCA9IEV4Y2x1ZGU8UGFyYW1ldGVyczx0eXBlb2YgcmVtYXBwaW5nPlswXSwgdW5rbm93bltdPjtcblxuLy8gTGF6eSBsb2FkZWQgd2VicGFjay1zb3VyY2VzIG9iamVjdFxuLy8gV2VicGFjayBpcyBvbmx5IGltcG9ydGVkIGlmIG5lZWRlZCBkdXJpbmcgdGhlIHByb2Nlc3NpbmdcbmxldCB3ZWJwYWNrU291cmNlczogdHlwZW9mIGltcG9ydCgnd2VicGFjaycpLnNvdXJjZXMgfCB1bmRlZmluZWQ7XG5cbmNvbnN0IHsgaTE4biB9ID0gKHdvcmtlckRhdGEgfHwge30pIGFzIHsgaTE4bj86IEkxOG5PcHRpb25zIH07XG5cbi8qKlxuICogSW50ZXJuYWwgZmxhZyB0byBlbmFibGUgdGhlIGRpcmVjdCB1c2FnZSBvZiB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCB0cmFuc2xhdGlvbiBwbHVnaW5zLlxuICogVGhlaXIgdXNhZ2UgaXMgY3VycmVudGx5IHNldmVyYWwgdGltZXMgc2xvd2VyIHRoYW4gdGhlIHN0cmluZyBtYW5pcHVsYXRpb24gbWV0aG9kLlxuICogRnV0dXJlIHdvcmsgdG8gb3B0aW1pemUgdGhlIHBsdWdpbnMgc2hvdWxkIGVuYWJsZSBwbHVnaW4gdXNhZ2UgYXMgdGhlIGRlZmF1bHQuXG4gKi9cbmNvbnN0IFVTRV9MT0NBTElaRV9QTFVHSU5TID0gZmFsc2U7XG5cbnR5cGUgTG9jYWxpemVVdGlsaXR5TW9kdWxlID0gdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgbW9kdWxlLlxuICogVGhpcyBpcyB1c2VkIHRvIHJlbW92ZSB0aGUgbmVlZCB0byByZXBlYXRlZGx5IGltcG9ydCB0aGUgbW9kdWxlIHBlciBmaWxlIHRyYW5zbGF0aW9uLlxuICovXG5sZXQgbG9jYWxpemVUb29sc01vZHVsZTogTG9jYWxpemVVdGlsaXR5TW9kdWxlIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIEF0dGVtcHRzIHRvIGxvYWQgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgbW9kdWxlIGNvbnRhaW5pbmcgdGhlIGZ1bmN0aW9uYWxpdHkgdG9cbiAqIHBlcmZvcm0gdGhlIGZpbGUgdHJhbnNsYXRpb25zLlxuICogVGhpcyBtb2R1bGUgbXVzdCBiZSBkeW5hbWljYWxseSBsb2FkZWQgYXMgaXQgaXMgYW4gRVNNIG1vZHVsZSBhbmQgdGhpcyBmaWxlIGlzIENvbW1vbkpTLlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkTG9jYWxpemVUb29scygpOiBQcm9taXNlPExvY2FsaXplVXRpbGl0eU1vZHVsZT4ge1xuICBpZiAobG9jYWxpemVUb29sc01vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGxvY2FsaXplVG9vbHNNb2R1bGU7XG4gIH1cblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIHJldHVybiBsb2FkRXNtTW9kdWxlKCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlSTE4blBsdWdpbnMoXG4gIGxvY2FsZTogc3RyaW5nLFxuICB0cmFuc2xhdGlvbjogdW5rbm93biB8IHVuZGVmaW5lZCxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScsXG4gIHNob3VsZElubGluZTogYm9vbGVhbixcbiAgbG9jYWxlRGF0YUNvbnRlbnQ/OiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgeyBEaWFnbm9zdGljcywgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbiwgbWFrZUxvY2FsZVBsdWdpbiB9ID0gYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IERpYWdub3N0aWNzKCk7XG5cbiAgaWYgKHNob3VsZElubGluZSkge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCAodHJhbnNsYXRpb24gfHwge30pIGFzIGFueSwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IHRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQgPyAnaWdub3JlJyA6IG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwbHVnaW5zLnB1c2gobWFrZUxvY2FsZVBsdWdpbihsb2NhbGUpKTtcblxuICBpZiAobG9jYWxlRGF0YUNvbnRlbnQpIHtcbiAgICBwbHVnaW5zLnB1c2goe1xuICAgICAgdmlzaXRvcjoge1xuICAgICAgICBQcm9ncmFtKHBhdGg6IE5vZGVQYXRoPHR5cGVzLlByb2dyYW0+KSB7XG4gICAgICAgICAgcGF0aC51bnNoaWZ0Q29udGFpbmVyKCdib2R5JywgdGVtcGxhdGVCdWlsZGVyLmFzdChsb2NhbGVEYXRhQ29udGVudCkpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7IGRpYWdub3N0aWNzLCBwbHVnaW5zIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5saW5lT3B0aW9ucyB7XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIGNvZGU6IHN0cmluZztcbiAgbWFwPzogc3RyaW5nO1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIG1pc3NpbmdUcmFuc2xhdGlvbj86ICd3YXJuaW5nJyB8ICdlcnJvcicgfCAnaWdub3JlJztcbiAgc2V0TG9jYWxlPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvY2FsaXplUG9zaXRpb24ge1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbiAgbWVzc2FnZVBhcnRzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheTtcbiAgZXhwcmVzc2lvbnM6IHR5cGVzLkV4cHJlc3Npb25bXTtcbn1cblxuY29uc3QgbG9jYWxpemVOYW1lID0gJyRsb2NhbGl6ZSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzKG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG4gIGlmIChpMThuLmZsYXRPdXRwdXQgJiYgaTE4bi5pbmxpbmVMb2NhbGVzLnNpemUgPiAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGbGF0IG91dHB1dCBpcyBvbmx5IHN1cHBvcnRlZCB3aGVuIGlubGluaW5nIG9uZSBsb2NhbGUuJyk7XG4gIH1cblxuICBjb25zdCBoYXNMb2NhbGl6ZU5hbWUgPSBvcHRpb25zLmNvZGUuaW5jbHVkZXMobG9jYWxpemVOYW1lKTtcbiAgaWYgKCFoYXNMb2NhbGl6ZU5hbWUgJiYgIW9wdGlvbnMuc2V0TG9jYWxlKSB7XG4gICAgcmV0dXJuIGlubGluZUNvcHlPbmx5KG9wdGlvbnMpO1xuICB9XG5cbiAgYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBsZXQgYXN0OiBQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZCB8IG51bGw7XG4gIHRyeSB7XG4gICAgYXN0ID0gcGFyc2VTeW5jKG9wdGlvbnMuY29kZSwge1xuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHNvdXJjZVR5cGU6ICd1bmFtYmlndW91cycsXG4gICAgICBmaWxlbmFtZTogb3B0aW9ucy5maWxlbmFtZSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGVycm9yKTtcblxuICAgIC8vIE1ha2UgdGhlIGVycm9yIG1vcmUgcmVhZGFibGUuXG4gICAgLy8gU2FtZSBlcnJvcnMgd2lsbCBjb250YWluIHRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgYXMgdGhlIGVycm9yIG1lc3NhZ2VcbiAgICAvLyBXaGljaCBtYWtlcyBpdCBoYXJkIHRvIGZpbmQgdGhlIGFjdHVhbCBlcnJvciBtZXNzYWdlLlxuICAgIGNvbnN0IGluZGV4ID0gZXJyb3IubWVzc2FnZS5pbmRleE9mKCcpXFxuJyk7XG4gICAgY29uc3QgbXNnID0gaW5kZXggIT09IC0xID8gZXJyb3IubWVzc2FnZS5zbGljZSgwLCBpbmRleCArIDEpIDogZXJyb3IubWVzc2FnZTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYCR7bXNnfVxcbkFuIGVycm9yIG9jY3VycmVkIGlubGluaW5nIGZpbGUgXCIke29wdGlvbnMuZmlsZW5hbWV9XCJgKTtcbiAgfVxuXG4gIGlmICghYXN0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVycm9yIG9jY3VycmVkIGlubGluaW5nIGZpbGUgXCIke29wdGlvbnMuZmlsZW5hbWV9XCJgKTtcbiAgfVxuXG4gIGlmICghVVNFX0xPQ0FMSVpFX1BMVUdJTlMpIHtcbiAgICByZXR1cm4gaW5saW5lTG9jYWxlc0RpcmVjdChhc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgY29uc3QgZGlhZ25vc3RpY3MgPSBbXTtcbiAgZm9yIChjb25zdCBsb2NhbGUgb2YgaTE4bi5pbmxpbmVMb2NhbGVzKSB7XG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgbGV0IGxvY2FsZURhdGFDb250ZW50O1xuICAgIGlmIChvcHRpb25zLnNldExvY2FsZSkge1xuICAgICAgLy8gSWYgbG9jYWxlIGRhdGEgaXMgcHJvdmlkZWQsIGxvYWQgaXQgYW5kIHByZXBlbmQgdG8gZmlsZVxuICAgICAgY29uc3QgbG9jYWxlRGF0YVBhdGggPSBpMThuLmxvY2FsZXNbbG9jYWxlXT8uZGF0YVBhdGg7XG4gICAgICBpZiAobG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgICAgbG9jYWxlRGF0YUNvbnRlbnQgPSBhd2FpdCBsb2FkTG9jYWxlRGF0YShsb2NhbGVEYXRhUGF0aCwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgeyBkaWFnbm9zdGljczogbG9jYWxlRGlhZ25vc3RpY3MsIHBsdWdpbnMgfSA9IGF3YWl0IGNyZWF0ZUkxOG5QbHVnaW5zKFxuICAgICAgbG9jYWxlLFxuICAgICAgdHJhbnNsYXRpb25zLFxuICAgICAgaXNTb3VyY2VMb2NhbGUgPyAnaWdub3JlJyA6IG9wdGlvbnMubWlzc2luZ1RyYW5zbGF0aW9uIHx8ICd3YXJuaW5nJyxcbiAgICAgIHRydWUsXG4gICAgICBsb2NhbGVEYXRhQ29udGVudCxcbiAgICApO1xuICAgIGNvbnN0IHRyYW5zZm9ybVJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUZyb21Bc3RTeW5jKGFzdCwgb3B0aW9ucy5jb2RlLCB7XG4gICAgICBmaWxlbmFtZTogb3B0aW9ucy5maWxlbmFtZSxcbiAgICAgIC8vIHVzaW5nIGZhbHNlIGVuc3VyZXMgdGhhdCBiYWJlbCB3aWxsIE5PVCBzZWFyY2ggYW5kIHByb2Nlc3Mgc291cmNlbWFwIGNvbW1lbnRzIChsYXJnZSBtZW1vcnkgdXNhZ2UpXG4gICAgICAvLyBUaGUgdHlwZXMgZG8gbm90IGluY2x1ZGUgdGhlIGZhbHNlIG9wdGlvbiBldmVuIHRob3VnaCBpdCBpcyB2YWxpZFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIGlucHV0U291cmNlTWFwOiBmYWxzZSBhcyBhbnksXG4gICAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgICAgcGx1Z2lucyxcbiAgICAgIGNvbXBhY3Q6ICFzaG91bGRCZWF1dGlmeSxcbiAgICAgIHNvdXJjZU1hcHM6ICEhb3B0aW9ucy5tYXAsXG4gICAgfSk7XG5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLmxvY2FsZURpYWdub3N0aWNzLm1lc3NhZ2VzKTtcblxuICAgIGlmICghdHJhbnNmb3JtUmVzdWx0IHx8ICF0cmFuc2Zvcm1SZXN1bHQuY29kZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVycm9yIG9jY3VycmVkIHByb2Nlc3NpbmcgYnVuZGxlIGZvciBcIiR7b3B0aW9ucy5maWxlbmFtZX1cIi5gKTtcbiAgICB9XG5cbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgYXdhaXQgZnMud3JpdGVGaWxlKG91dHB1dFBhdGgsIHRyYW5zZm9ybVJlc3VsdC5jb2RlKTtcblxuICAgIGlmIChvcHRpb25zLm1hcCAmJiB0cmFuc2Zvcm1SZXN1bHQubWFwKSB7XG4gICAgICBjb25zdCBvdXRwdXRNYXAgPSByZW1hcHBpbmcoW3RyYW5zZm9ybVJlc3VsdC5tYXAgYXMgU291cmNlTWFwSW5wdXQsIG9wdGlvbnMubWFwXSwgKCkgPT4gbnVsbCk7XG5cbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoICsgJy5tYXAnLCBKU09OLnN0cmluZ2lmeShvdXRwdXRNYXApKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljcyB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzRGlyZWN0KGFzdDogUGFyc2VSZXN1bHQsIG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG5cbiAgY29uc3QgeyBkZWZhdWx0OiBnZW5lcmF0ZSB9ID0gYXdhaXQgaW1wb3J0KCdAYmFiZWwvZ2VuZXJhdG9yJyk7XG4gIGNvbnN0IGxvY2FsaXplRGlhZyA9IGF3YWl0IGxvYWRMb2NhbGl6ZVRvb2xzKCk7XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IGxvY2FsaXplRGlhZy5EaWFnbm9zdGljcygpO1xuXG4gIGNvbnN0IHBvc2l0aW9ucyA9IGZpbmRMb2NhbGl6ZVBvc2l0aW9ucyhhc3QsIG9wdGlvbnMsIGxvY2FsaXplRGlhZyk7XG4gIGlmIChwb3NpdGlvbnMubGVuZ3RoID09PSAwICYmICFvcHRpb25zLnNldExvY2FsZSkge1xuICAgIHJldHVybiBpbmxpbmVDb3B5T25seShvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGlucHV0TWFwID0gISFvcHRpb25zLm1hcCAmJiAoSlNPTi5wYXJzZShvcHRpb25zLm1hcCkgYXMgeyBzb3VyY2VSb290Pzogc3RyaW5nIH0pO1xuICAvLyBDbGVhbnVwIHNvdXJjZSByb290IG90aGVyd2lzZSBpdCB3aWxsIGJlIGFkZGVkIHRvIGVhY2ggc291cmNlIGVudHJ5XG4gIGNvbnN0IG1hcFNvdXJjZVJvb3QgPSBpbnB1dE1hcCAmJiBpbnB1dE1hcC5zb3VyY2VSb290O1xuICBpZiAoaW5wdXRNYXApIHtcbiAgICBkZWxldGUgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgfVxuXG4gIC8vIExvYWQgV2VicGFjayBvbmx5IHdoZW4gbmVlZGVkXG4gIGlmICh3ZWJwYWNrU291cmNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgd2VicGFja1NvdXJjZXMgPSAoYXdhaXQgaW1wb3J0KCd3ZWJwYWNrJykpLnNvdXJjZXM7XG4gIH1cbiAgY29uc3QgeyBDb25jYXRTb3VyY2UsIE9yaWdpbmFsU291cmNlLCBSZXBsYWNlU291cmNlLCBTb3VyY2VNYXBTb3VyY2UgfSA9IHdlYnBhY2tTb3VyY2VzO1xuXG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBuZXcgUmVwbGFjZVNvdXJjZShcbiAgICAgIGlucHV0TWFwXG4gICAgICAgID8gbmV3IFNvdXJjZU1hcFNvdXJjZShvcHRpb25zLmNvZGUsIG9wdGlvbnMuZmlsZW5hbWUsIGlucHV0TWFwKVxuICAgICAgICA6IG5ldyBPcmlnaW5hbFNvdXJjZShvcHRpb25zLmNvZGUsIG9wdGlvbnMuZmlsZW5hbWUpLFxuICAgICk7XG5cbiAgICBjb25zdCBpc1NvdXJjZUxvY2FsZSA9IGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGU7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCB0cmFuc2xhdGlvbnM6IGFueSA9IGlzU291cmNlTG9jYWxlID8ge30gOiBpMThuLmxvY2FsZXNbbG9jYWxlXS50cmFuc2xhdGlvbiB8fCB7fTtcbiAgICBmb3IgKGNvbnN0IHBvc2l0aW9uIG9mIHBvc2l0aW9ucykge1xuICAgICAgY29uc3QgdHJhbnNsYXRlZCA9IGxvY2FsaXplRGlhZy50cmFuc2xhdGUoXG4gICAgICAgIGRpYWdub3N0aWNzLFxuICAgICAgICB0cmFuc2xhdGlvbnMsXG4gICAgICAgIHBvc2l0aW9uLm1lc3NhZ2VQYXJ0cyxcbiAgICAgICAgcG9zaXRpb24uZXhwcmVzc2lvbnMsXG4gICAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICApO1xuXG4gICAgICBjb25zdCBleHByZXNzaW9uID0gbG9jYWxpemVEaWFnLmJ1aWxkTG9jYWxpemVSZXBsYWNlbWVudCh0cmFuc2xhdGVkWzBdLCB0cmFuc2xhdGVkWzFdKTtcbiAgICAgIGNvbnN0IHsgY29kZSB9ID0gZ2VuZXJhdGUoZXhwcmVzc2lvbik7XG5cbiAgICAgIGNvbnRlbnQucmVwbGFjZShwb3NpdGlvbi5zdGFydCwgcG9zaXRpb24uZW5kIC0gMSwgY29kZSk7XG4gICAgfVxuXG4gICAgbGV0IG91dHB1dFNvdXJjZTogaW1wb3J0KCd3ZWJwYWNrJykuc291cmNlcy5Tb3VyY2UgPSBjb250ZW50O1xuICAgIGlmIChvcHRpb25zLnNldExvY2FsZSkge1xuICAgICAgY29uc3Qgc2V0TG9jYWxlVGV4dCA9IGBnbG9iYWxUaGlzLiRsb2NhbGl6ZT1PYmplY3QuYXNzaWduKGdsb2JhbFRoaXMuJGxvY2FsaXplIHx8IHt9LHtsb2NhbGU6XCIke2xvY2FsZX1cIn0pO1xcbmA7XG5cbiAgICAgIC8vIElmIGxvY2FsZSBkYXRhIGlzIHByb3ZpZGVkLCBsb2FkIGl0IGFuZCBwcmVwZW5kIHRvIGZpbGVcbiAgICAgIGxldCBsb2NhbGVEYXRhU291cmNlO1xuICAgICAgY29uc3QgbG9jYWxlRGF0YVBhdGggPSBpMThuLmxvY2FsZXNbbG9jYWxlXSAmJiBpMThuLmxvY2FsZXNbbG9jYWxlXS5kYXRhUGF0aDtcbiAgICAgIGlmIChsb2NhbGVEYXRhUGF0aCkge1xuICAgICAgICBjb25zdCBsb2NhbGVEYXRhQ29udGVudCA9IGF3YWl0IGxvYWRMb2NhbGVEYXRhKGxvY2FsZURhdGFQYXRoLCB0cnVlKTtcbiAgICAgICAgbG9jYWxlRGF0YVNvdXJjZSA9IG5ldyBPcmlnaW5hbFNvdXJjZShsb2NhbGVEYXRhQ29udGVudCwgcGF0aC5iYXNlbmFtZShsb2NhbGVEYXRhUGF0aCkpO1xuICAgICAgfVxuXG4gICAgICBvdXRwdXRTb3VyY2UgPSBsb2NhbGVEYXRhU291cmNlXG4gICAgICAgID8gLy8gVGhlIHNlbWljb2xvbiBlbnN1cmVzIHRoYXQgdGhlcmUgaXMgbm8gc3ludGF4IGVycm9yIGJldHdlZW4gc3RhdGVtZW50c1xuICAgICAgICAgIG5ldyBDb25jYXRTb3VyY2Uoc2V0TG9jYWxlVGV4dCwgbG9jYWxlRGF0YVNvdXJjZSwgJztcXG4nLCBjb250ZW50KVxuICAgICAgICA6IG5ldyBDb25jYXRTb3VyY2Uoc2V0TG9jYWxlVGV4dCwgY29udGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBzb3VyY2U6IG91dHB1dENvZGUsIG1hcDogb3V0cHV0TWFwIH0gPSBvdXRwdXRTb3VyY2Uuc291cmNlQW5kTWFwKCkgYXMge1xuICAgICAgc291cmNlOiBzdHJpbmc7XG4gICAgICBtYXA6IHsgZmlsZTogc3RyaW5nOyBzb3VyY2VSb290Pzogc3RyaW5nIH07XG4gICAgfTtcbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgYXdhaXQgZnMud3JpdGVGaWxlKG91dHB1dFBhdGgsIG91dHB1dENvZGUpO1xuXG4gICAgaWYgKGlucHV0TWFwICYmIG91dHB1dE1hcCkge1xuICAgICAgb3V0cHV0TWFwLmZpbGUgPSBvcHRpb25zLmZpbGVuYW1lO1xuICAgICAgaWYgKG1hcFNvdXJjZVJvb3QpIHtcbiAgICAgICAgb3V0cHV0TWFwLnNvdXJjZVJvb3QgPSBtYXBTb3VyY2VSb290O1xuICAgICAgfVxuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKG91dHB1dFBhdGggKyAnLm1hcCcsIEpTT04uc3RyaW5naWZ5KG91dHB1dE1hcCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBkaWFnbm9zdGljcy5tZXNzYWdlcywgY291bnQ6IHBvc2l0aW9ucy5sZW5ndGggfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5saW5lQ29weU9ubHkob3B0aW9uczogSW5saW5lT3B0aW9ucykge1xuICBpZiAoIWkxOG4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2kxOG4gb3B0aW9ucyBhcmUgbWlzc2luZycpO1xuICB9XG5cbiAgZm9yIChjb25zdCBsb2NhbGUgb2YgaTE4bi5pbmxpbmVMb2NhbGVzKSB7XG4gICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihcbiAgICAgIG9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIGkxOG4uZmxhdE91dHB1dCA/ICcnIDogbG9jYWxlLFxuICAgICAgb3B0aW9ucy5maWxlbmFtZSxcbiAgICApO1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoLCBvcHRpb25zLmNvZGUpO1xuICAgIGlmIChvcHRpb25zLm1hcCkge1xuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKG91dHB1dFBhdGggKyAnLm1hcCcsIG9wdGlvbnMubWFwKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBmaWxlOiBvcHRpb25zLmZpbGVuYW1lLCBkaWFnbm9zdGljczogW10sIGNvdW50OiAwIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRMb2NhbGl6ZVBvc2l0aW9ucyhcbiAgYXN0OiBQYXJzZVJlc3VsdCxcbiAgb3B0aW9uczogSW5saW5lT3B0aW9ucyxcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IExvY2FsaXplUG9zaXRpb25bXSB7XG4gIGNvbnN0IHBvc2l0aW9uczogTG9jYWxpemVQb3NpdGlvbltdID0gW107XG5cbiAgLy8gV29ya2Fyb3VuZCB0byBlbnN1cmUgYSBwYXRoIGh1YiBpcyBwcmVzZW50IGZvciB0cmF2ZXJzYWxcbiAgY29uc3QgeyBGaWxlIH0gPSByZXF1aXJlKCdAYmFiZWwvY29yZScpO1xuICBjb25zdCBmaWxlID0gbmV3IEZpbGUoe30sIHsgY29kZTogb3B0aW9ucy5jb2RlLCBhc3QgfSk7XG5cbiAgdHJhdmVyc2UoZmlsZS5hc3QsIHtcbiAgICBUYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24ocGF0aCkge1xuICAgICAgaWYgKHR5cGVzLmlzSWRlbnRpZmllcihwYXRoLm5vZGUudGFnKSAmJiBwYXRoLm5vZGUudGFnLm5hbWUgPT09IGxvY2FsaXplTmFtZSkge1xuICAgICAgICBjb25zdCBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc10gPSB1bndyYXBUZW1wbGF0ZUxpdGVyYWwocGF0aCwgdXRpbHMpO1xuICAgICAgICBwb3NpdGlvbnMucHVzaCh7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICBzdGFydDogcGF0aC5ub2RlLnN0YXJ0ISxcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgIGVuZDogcGF0aC5ub2RlLmVuZCEsXG4gICAgICAgICAgbWVzc2FnZVBhcnRzLFxuICAgICAgICAgIGV4cHJlc3Npb25zLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gcG9zaXRpb25zO1xufVxuXG5mdW5jdGlvbiB1bndyYXBUZW1wbGF0ZUxpdGVyYWwoXG4gIHBhdGg6IE5vZGVQYXRoPHR5cGVzLlRhZ2dlZFRlbXBsYXRlRXhwcmVzc2lvbj4sXG4gIHV0aWxzOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUsXG4pOiBbVGVtcGxhdGVTdHJpbmdzQXJyYXksIHR5cGVzLkV4cHJlc3Npb25bXV0ge1xuICBjb25zdCBbbWVzc2FnZVBhcnRzXSA9IHV0aWxzLnVud3JhcE1lc3NhZ2VQYXJ0c0Zyb21UZW1wbGF0ZUxpdGVyYWwoXG4gICAgcGF0aC5nZXQoJ3F1YXNpJykuZ2V0KCdxdWFzaXMnKSxcbiAgKTtcbiAgY29uc3QgW2V4cHJlc3Npb25zXSA9IHV0aWxzLnVud3JhcEV4cHJlc3Npb25zRnJvbVRlbXBsYXRlTGl0ZXJhbChwYXRoLmdldCgncXVhc2knKSk7XG5cbiAgcmV0dXJuIFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXTtcbn1cblxuZnVuY3Rpb24gdW53cmFwTG9jYWxpemVDYWxsKFxuICBwYXRoOiBOb2RlUGF0aDx0eXBlcy5DYWxsRXhwcmVzc2lvbj4sXG4gIHV0aWxzOiBMb2NhbGl6ZVV0aWxpdHlNb2R1bGUsXG4pOiBbVGVtcGxhdGVTdHJpbmdzQXJyYXksIHR5cGVzLkV4cHJlc3Npb25bXV0ge1xuICBjb25zdCBbbWVzc2FnZVBhcnRzXSA9IHV0aWxzLnVud3JhcE1lc3NhZ2VQYXJ0c0Zyb21Mb2NhbGl6ZUNhbGwocGF0aCk7XG4gIGNvbnN0IFtleHByZXNzaW9uc10gPSB1dGlscy51bndyYXBTdWJzdGl0dXRpb25zRnJvbUxvY2FsaXplQ2FsbChwYXRoKTtcblxuICByZXR1cm4gW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkTG9jYWxlRGF0YShwYXRoOiBzdHJpbmcsIG9wdGltaXplOiBib29sZWFuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgLy8gVGhlIHBhdGggaXMgdmFsaWRhdGVkIGR1cmluZyBvcHRpb24gcHJvY2Vzc2luZyBiZWZvcmUgdGhlIGJ1aWxkIHN0YXJ0c1xuICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUocGF0aCwgJ3V0ZjgnKTtcblxuICAvLyBEb3dubGV2ZWwgYW5kIG9wdGltaXplIHRoZSBkYXRhXG4gIGNvbnN0IHRyYW5zZm9ybVJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGNvbnRlbnQsIHtcbiAgICBmaWxlbmFtZTogcGF0aCxcbiAgICAvLyBUaGUgdHlwZXMgZG8gbm90IGluY2x1ZGUgdGhlIGZhbHNlIG9wdGlvbiBldmVuIHRob3VnaCBpdCBpcyB2YWxpZFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgaW5wdXRTb3VyY2VNYXA6IGZhbHNlIGFzIGFueSxcbiAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBwcmVzZXRzOiBbXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUucmVzb2x2ZSgnQGJhYmVsL3ByZXNldC1lbnYnKSxcbiAgICAgICAge1xuICAgICAgICAgIGJ1Z2ZpeGVzOiB0cnVlLFxuICAgICAgICAgIHRhcmdldHM6IHsgZXNtb2R1bGVzOiB0cnVlIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gICAgbWluaWZpZWQ6IGFsbG93TWluaWZ5ICYmIG9wdGltaXplLFxuICAgIGNvbXBhY3Q6ICFzaG91bGRCZWF1dGlmeSAmJiBvcHRpbWl6ZSxcbiAgICBjb21tZW50czogIW9wdGltaXplLFxuICB9KTtcblxuICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZXJyb3Igb2NjdXJyZWQgcHJvY2Vzc2luZyBidW5kbGUgZm9yIFwiJHtwYXRofVwiLmApO1xuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybVJlc3VsdC5jb2RlO1xufVxuIl19