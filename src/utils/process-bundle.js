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
            const setLocaleText = `var $localize=Object.assign(void 0===$localize?{}:$localize,{locale:"${locale}"});\n`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wcm9jZXNzLWJ1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNFQUE4QztBQUM5QyxzQ0FRcUI7QUFDckIsK0RBQThDO0FBQzlDLGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsbURBQTRDO0FBQzVDLCtEQUFvRTtBQUNwRSxtQ0FBd0M7QUFFeEMseUNBQTJDO0FBSzNDLHFDQUFxQztBQUNyQywyREFBMkQ7QUFDM0QsSUFBSSxjQUE0RCxDQUFDO0FBRWpFLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLDJCQUFVLElBQUksRUFBRSxDQUEyQixDQUFDO0FBRTlEOzs7O0dBSUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLEtBQUssQ0FBQztBQUluQzs7O0dBR0c7QUFDSCxJQUFJLG1CQUFzRCxDQUFDO0FBRTNEOzs7O0dBSUc7QUFDSCxLQUFLLFVBQVUsaUJBQWlCO0lBQzlCLElBQUksbUJBQW1CLEtBQUssU0FBUyxFQUFFO1FBQ3JDLE9BQU8sbUJBQW1CLENBQUM7S0FDNUI7SUFFRCxxRkFBcUY7SUFDckYseUZBQXlGO0lBQ3pGLHNDQUFzQztJQUN0QyxPQUFPLElBQUEsd0JBQWEsRUFBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFTSxLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLE1BQWMsRUFDZCxXQUFnQyxFQUNoQyxrQkFBa0QsRUFDbEQsWUFBcUIsRUFDckIsaUJBQTBCO0lBRTFCLE1BQU0sRUFBRSxXQUFXLEVBQUUseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxNQUFNLGlCQUFpQixFQUFFLENBQUM7SUFFL0YsTUFBTSxPQUFP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Q0QsUUFBUSxFQUFFLGlDQUFXLElBQUksUUFBUTtRQUNqQyxPQUFPLEVBQUUsQ0FBQyxvQ0FBYyxJQUFJLFFBQVE7UUFDcEMsUUFBUSxFQUFFLENBQUMsUUFBUTtLQUNwQixDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRTtRQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxJQUFJLElBQUksQ0FBQyxDQUFDO0tBQzVFO0lBRUQsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDO0FBQzlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHJlbWFwcGluZyBmcm9tICdAYW1wcHJvamVjdC9yZW1hcHBpbmcnO1xuaW1wb3J0IHtcbiAgTm9kZVBhdGgsXG4gIFBhcnNlUmVzdWx0LFxuICBwYXJzZVN5bmMsXG4gIHRyYW5zZm9ybUFzeW5jLFxuICB0cmFuc2Zvcm1Gcm9tQXN0U3luYyxcbiAgdHJhdmVyc2UsXG4gIHR5cGVzLFxufSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgdGVtcGxhdGVCdWlsZGVyIGZyb20gJ0BiYWJlbC90ZW1wbGF0ZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCB7IGFsbG93TWluaWZ5LCBzaG91bGRCZWF1dGlmeSB9IGZyb20gJy4vZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4vaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuL2xvYWQtZXNtJztcblxuLy8gRXh0cmFjdCBTb3VyY2VtYXAgaW5wdXQgdHlwZSBmcm9tIHRoZSByZW1hcHBpbmcgZnVuY3Rpb24gc2luY2UgaXQgaXMgbm90IGN1cnJlbnRseSBleHBvcnRlZFxudHlwZSBTb3VyY2VNYXBJbnB1dCA9IEV4Y2x1ZGU8UGFyYW1ldGVyczx0eXBlb2YgcmVtYXBwaW5nPlswXSwgdW5rbm93bltdPjtcblxuLy8gTGF6eSBsb2FkZWQgd2VicGFjay1zb3VyY2VzIG9iamVjdFxuLy8gV2VicGFjayBpcyBvbmx5IGltcG9ydGVkIGlmIG5lZWRlZCBkdXJpbmcgdGhlIHByb2Nlc3NpbmdcbmxldCB3ZWJwYWNrU291cmNlczogdHlwZW9mIGltcG9ydCgnd2VicGFjaycpLnNvdXJjZXMgfCB1bmRlZmluZWQ7XG5cbmNvbnN0IHsgaTE4biB9ID0gKHdvcmtlckRhdGEgfHwge30pIGFzIHsgaTE4bj86IEkxOG5PcHRpb25zIH07XG5cbi8qKlxuICogSW50ZXJuYWwgZmxhZyB0byBlbmFibGUgdGhlIGRpcmVjdCB1c2FnZSBvZiB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCB0cmFuc2xhdGlvbiBwbHVnaW5zLlxuICogVGhlaXIgdXNhZ2UgaXMgY3VycmVudGx5IHNldmVyYWwgdGltZXMgc2xvd2VyIHRoYW4gdGhlIHN0cmluZyBtYW5pcHVsYXRpb24gbWV0aG9kLlxuICogRnV0dXJlIHdvcmsgdG8gb3B0aW1pemUgdGhlIHBsdWdpbnMgc2hvdWxkIGVuYWJsZSBwbHVnaW4gdXNhZ2UgYXMgdGhlIGRlZmF1bHQuXG4gKi9cbmNvbnN0IFVTRV9MT0NBTElaRV9QTFVHSU5TID0gZmFsc2U7XG5cbnR5cGUgTG9jYWxpemVVdGlsaXR5TW9kdWxlID0gdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKTtcblxuLyoqXG4gKiBDYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgbW9kdWxlLlxuICogVGhpcyBpcyB1c2VkIHRvIHJlbW92ZSB0aGUgbmVlZCB0byByZXBlYXRlZGx5IGltcG9ydCB0aGUgbW9kdWxlIHBlciBmaWxlIHRyYW5zbGF0aW9uLlxuICovXG5sZXQgbG9jYWxpemVUb29sc01vZHVsZTogTG9jYWxpemVVdGlsaXR5TW9kdWxlIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIEF0dGVtcHRzIHRvIGxvYWQgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZS90b29sc2AgbW9kdWxlIGNvbnRhaW5pbmcgdGhlIGZ1bmN0aW9uYWxpdHkgdG9cbiAqIHBlcmZvcm0gdGhlIGZpbGUgdHJhbnNsYXRpb25zLlxuICogVGhpcyBtb2R1bGUgbXVzdCBiZSBkeW5hbWljYWxseSBsb2FkZWQgYXMgaXQgaXMgYW4gRVNNIG1vZHVsZSBhbmQgdGhpcyBmaWxlIGlzIENvbW1vbkpTLlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkTG9jYWxpemVUb29scygpOiBQcm9taXNlPExvY2FsaXplVXRpbGl0eU1vZHVsZT4ge1xuICBpZiAobG9jYWxpemVUb29sc01vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGxvY2FsaXplVG9vbHNNb2R1bGU7XG4gIH1cblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIHJldHVybiBsb2FkRXNtTW9kdWxlKCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlSTE4blBsdWdpbnMoXG4gIGxvY2FsZTogc3RyaW5nLFxuICB0cmFuc2xhdGlvbjogdW5rbm93biB8IHVuZGVmaW5lZCxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScsXG4gIHNob3VsZElubGluZTogYm9vbGVhbixcbiAgbG9jYWxlRGF0YUNvbnRlbnQ/OiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgeyBEaWFnbm9zdGljcywgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbiwgbWFrZUxvY2FsZVBsdWdpbiB9ID0gYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IERpYWdub3N0aWNzKCk7XG5cbiAgaWYgKHNob3VsZElubGluZSkge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCAodHJhbnNsYXRpb24gfHwge30pIGFzIGFueSwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IHRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQgPyAnaWdub3JlJyA6IG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwbHVnaW5zLnB1c2gobWFrZUxvY2FsZVBsdWdpbihsb2NhbGUpKTtcblxuICBpZiAobG9jYWxlRGF0YUNvbnRlbnQpIHtcbiAgICBwbHVnaW5zLnB1c2goe1xuICAgICAgdmlzaXRvcjoge1xuICAgICAgICBQcm9ncmFtKHBhdGg6IE5vZGVQYXRoPHR5cGVzLlByb2dyYW0+KSB7XG4gICAgICAgICAgcGF0aC51bnNoaWZ0Q29udGFpbmVyKCdib2R5JywgdGVtcGxhdGVCdWlsZGVyLmFzdChsb2NhbGVEYXRhQ29udGVudCkpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7IGRpYWdub3N0aWNzLCBwbHVnaW5zIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5saW5lT3B0aW9ucyB7XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIGNvZGU6IHN0cmluZztcbiAgbWFwPzogc3RyaW5nO1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIG1pc3NpbmdUcmFuc2xhdGlvbj86ICd3YXJuaW5nJyB8ICdlcnJvcicgfCAnaWdub3JlJztcbiAgc2V0TG9jYWxlPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExvY2FsaXplUG9zaXRpb24ge1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbiAgbWVzc2FnZVBhcnRzOiBUZW1wbGF0ZVN0cmluZ3NBcnJheTtcbiAgZXhwcmVzc2lvbnM6IHR5cGVzLkV4cHJlc3Npb25bXTtcbn1cblxuY29uc3QgbG9jYWxpemVOYW1lID0gJyRsb2NhbGl6ZSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbmxpbmVMb2NhbGVzKG9wdGlvbnM6IElubGluZU9wdGlvbnMpIHtcbiAgaWYgKCFpMThuIHx8IGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IFtdLCBjb3VudDogMCB9O1xuICB9XG4gIGlmIChpMThuLmZsYXRPdXRwdXQgJiYgaTE4bi5pbmxpbmVMb2NhbGVzLnNpemUgPiAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGbGF0IG91dHB1dCBpcyBvbmx5IHN1cHBvcnRlZCB3aGVuIGlubGluaW5nIG9uZSBsb2NhbGUuJyk7XG4gIH1cblxuICBjb25zdCBoYXNMb2NhbGl6ZU5hbWUgPSBvcHRpb25zLmNvZGUuaW5jbHVkZXMobG9jYWxpemVOYW1lKTtcbiAgaWYgKCFoYXNMb2NhbGl6ZU5hbWUgJiYgIW9wdGlvbnMuc2V0TG9jYWxlKSB7XG4gICAgcmV0dXJuIGlubGluZUNvcHlPbmx5KG9wdGlvbnMpO1xuICB9XG5cbiAgYXdhaXQgbG9hZExvY2FsaXplVG9vbHMoKTtcblxuICBsZXQgYXN0OiBQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZCB8IG51bGw7XG4gIHRyeSB7XG4gICAgYXN0ID0gcGFyc2VTeW5jKG9wdGlvbnMuY29kZSwge1xuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHNvdXJjZVR5cGU6ICdzY3JpcHQnLFxuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAvLyBNYWtlIHRoZSBlcnJvciBtb3JlIHJlYWRhYmxlLlxuICAgIC8vIFNhbWUgZXJyb3JzIHdpbGwgY29udGFpbiB0aGUgZnVsbCBjb250ZW50IG9mIHRoZSBmaWxlIGFzIHRoZSBlcnJvciBtZXNzYWdlXG4gICAgLy8gV2hpY2ggbWFrZXMgaXQgaGFyZCB0byBmaW5kIHRoZSBhY3R1YWwgZXJyb3IgbWVzc2FnZS5cbiAgICBjb25zdCBpbmRleCA9IGVycm9yLm1lc3NhZ2UuaW5kZXhPZignKVxcbicpO1xuICAgIGNvbnN0IG1zZyA9IGluZGV4ICE9PSAtMSA/IGVycm9yLm1lc3NhZ2Uuc2xpY2UoMCwgaW5kZXggKyAxKSA6IGVycm9yLm1lc3NhZ2U7XG4gICAgdGhyb3cgbmV3IEVycm9yKGAke21zZ31cXG5BbiBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIWFzdCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBpbmxpbmluZyBmaWxlIFwiJHtvcHRpb25zLmZpbGVuYW1lfVwiYCk7XG4gIH1cblxuICBpZiAoIVVTRV9MT0NBTElaRV9QTFVHSU5TKSB7XG4gICAgcmV0dXJuIGlubGluZUxvY2FsZXNEaXJlY3QoYXN0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGRpYWdub3N0aWNzID0gW107XG4gIGZvciAoY29uc3QgbG9jYWxlIG9mIGkxOG4uaW5saW5lTG9jYWxlcykge1xuICAgIGNvbnN0IGlzU291cmNlTG9jYWxlID0gbG9jYWxlID09PSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IHRyYW5zbGF0aW9uczogYW55ID0gaXNTb3VyY2VMb2NhbGUgPyB7fSA6IGkxOG4ubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uIHx8IHt9O1xuICAgIGxldCBsb2NhbGVEYXRhQ29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIC8vIElmIGxvY2FsZSBkYXRhIGlzIHByb3ZpZGVkLCBsb2FkIGl0IGFuZCBwcmVwZW5kIHRvIGZpbGVcbiAgICAgIGNvbnN0IGxvY2FsZURhdGFQYXRoID0gaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHsgZGlhZ25vc3RpY3M6IGxvY2FsZURpYWdub3N0aWNzLCBwbHVnaW5zIH0gPSBhd2FpdCBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9ucyxcbiAgICAgIGlzU291cmNlTG9jYWxlID8gJ2lnbm9yZScgOiBvcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnd2FybmluZycsXG4gICAgICB0cnVlLFxuICAgICAgbG9jYWxlRGF0YUNvbnRlbnQsXG4gICAgKTtcbiAgICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Gcm9tQXN0U3luYyhhc3QsIG9wdGlvbnMuY29kZSwge1xuICAgICAgZmlsZW5hbWU6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgICAvLyB1c2luZyBmYWxzZSBlbnN1cmVzIHRoYXQgYmFiZWwgd2lsbCBOT1Qgc2VhcmNoIGFuZCBwcm9jZXNzIHNvdXJjZW1hcCBjb21tZW50cyAobGFyZ2UgbWVtb3J5IHVzYWdlKVxuICAgICAgLy8gVGhlIHR5cGVzIGRvIG5vdCBpbmNsdWRlIHRoZSBmYWxzZSBvcHRpb24gZXZlbiB0aG91Z2ggaXQgaXMgdmFsaWRcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgIHBsdWdpbnMsXG4gICAgICBjb21wYWN0OiAhc2hvdWxkQmVhdXRpZnksXG4gICAgICBzb3VyY2VNYXBzOiAhIW9wdGlvbnMubWFwLFxuICAgIH0pO1xuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5sb2NhbGVEaWFnbm9zdGljcy5tZXNzYWdlcyk7XG5cbiAgICBpZiAoIXRyYW5zZm9ybVJlc3VsdCB8fCAhdHJhbnNmb3JtUmVzdWx0LmNvZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke29wdGlvbnMuZmlsZW5hbWV9XCIuYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihcbiAgICAgIG9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIGkxOG4uZmxhdE91dHB1dCA/ICcnIDogbG9jYWxlLFxuICAgICAgb3B0aW9ucy5maWxlbmFtZSxcbiAgICApO1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShvdXRwdXRQYXRoLCB0cmFuc2Zvcm1SZXN1bHQuY29kZSk7XG5cbiAgICBpZiAob3B0aW9ucy5tYXAgJiYgdHJhbnNmb3JtUmVzdWx0Lm1hcCkge1xuICAgICAgY29uc3Qgb3V0cHV0TWFwID0gcmVtYXBwaW5nKFt0cmFuc2Zvcm1SZXN1bHQubWFwIGFzIFNvdXJjZU1hcElucHV0LCBvcHRpb25zLm1hcF0sICgpID0+IG51bGwpO1xuXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3MgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5saW5lTG9jYWxlc0RpcmVjdChhc3Q6IFBhcnNlUmVzdWx0LCBvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4biB8fCBpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA9PT0gMCkge1xuICAgIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbiAgfVxuXG4gIGNvbnN0IHsgZGVmYXVsdDogZ2VuZXJhdGUgfSA9IGF3YWl0IGltcG9ydCgnQGJhYmVsL2dlbmVyYXRvcicpO1xuICBjb25zdCBsb2NhbGl6ZURpYWcgPSBhd2FpdCBsb2FkTG9jYWxpemVUb29scygpO1xuICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBsb2NhbGl6ZURpYWcuRGlhZ25vc3RpY3MoKTtcblxuICBjb25zdCBwb3NpdGlvbnMgPSBmaW5kTG9jYWxpemVQb3NpdGlvbnMoYXN0LCBvcHRpb25zLCBsb2NhbGl6ZURpYWcpO1xuICBpZiAocG9zaXRpb25zLmxlbmd0aCA9PT0gMCAmJiAhb3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICByZXR1cm4gaW5saW5lQ29weU9ubHkob3B0aW9ucyk7XG4gIH1cblxuICBjb25zdCBpbnB1dE1hcCA9ICEhb3B0aW9ucy5tYXAgJiYgKEpTT04ucGFyc2Uob3B0aW9ucy5tYXApIGFzIHsgc291cmNlUm9vdD86IHN0cmluZyB9KTtcbiAgLy8gQ2xlYW51cCBzb3VyY2Ugcm9vdCBvdGhlcndpc2UgaXQgd2lsbCBiZSBhZGRlZCB0byBlYWNoIHNvdXJjZSBlbnRyeVxuICBjb25zdCBtYXBTb3VyY2VSb290ID0gaW5wdXRNYXAgJiYgaW5wdXRNYXAuc291cmNlUm9vdDtcbiAgaWYgKGlucHV0TWFwKSB7XG4gICAgZGVsZXRlIGlucHV0TWFwLnNvdXJjZVJvb3Q7XG4gIH1cblxuICAvLyBMb2FkIFdlYnBhY2sgb25seSB3aGVuIG5lZWRlZFxuICBpZiAod2VicGFja1NvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgIHdlYnBhY2tTb3VyY2VzID0gKGF3YWl0IGltcG9ydCgnd2VicGFjaycpKS5zb3VyY2VzO1xuICB9XG4gIGNvbnN0IHsgQ29uY2F0U291cmNlLCBPcmlnaW5hbFNvdXJjZSwgUmVwbGFjZVNvdXJjZSwgU291cmNlTWFwU291cmNlIH0gPSB3ZWJwYWNrU291cmNlcztcblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBjb250ZW50ID0gbmV3IFJlcGxhY2VTb3VyY2UoXG4gICAgICBpbnB1dE1hcFxuICAgICAgICA/IG5ldyBTb3VyY2VNYXBTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lLCBpbnB1dE1hcClcbiAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2Uob3B0aW9ucy5jb2RlLCBvcHRpb25zLmZpbGVuYW1lKSxcbiAgICApO1xuXG4gICAgY29uc3QgaXNTb3VyY2VMb2NhbGUgPSBsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgdHJhbnNsYXRpb25zOiBhbnkgPSBpc1NvdXJjZUxvY2FsZSA/IHt9IDogaTE4bi5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24gfHwge307XG4gICAgZm9yIChjb25zdCBwb3NpdGlvbiBvZiBwb3NpdGlvbnMpIHtcbiAgICAgIGNvbnN0IHRyYW5zbGF0ZWQgPSBsb2NhbGl6ZURpYWcudHJhbnNsYXRlKFxuICAgICAgICBkaWFnbm9zdGljcyxcbiAgICAgICAgdHJhbnNsYXRpb25zLFxuICAgICAgICBwb3NpdGlvbi5tZXNzYWdlUGFydHMsXG4gICAgICAgIHBvc2l0aW9uLmV4cHJlc3Npb25zLFxuICAgICAgICBpc1NvdXJjZUxvY2FsZSA/ICdpZ25vcmUnIDogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24gfHwgJ3dhcm5pbmcnLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IGxvY2FsaXplRGlhZy5idWlsZExvY2FsaXplUmVwbGFjZW1lbnQodHJhbnNsYXRlZFswXSwgdHJhbnNsYXRlZFsxXSk7XG4gICAgICBjb25zdCB7IGNvZGUgfSA9IGdlbmVyYXRlKGV4cHJlc3Npb24pO1xuXG4gICAgICBjb250ZW50LnJlcGxhY2UocG9zaXRpb24uc3RhcnQsIHBvc2l0aW9uLmVuZCAtIDEsIGNvZGUpO1xuICAgIH1cblxuICAgIGxldCBvdXRwdXRTb3VyY2U6IGltcG9ydCgnd2VicGFjaycpLnNvdXJjZXMuU291cmNlID0gY29udGVudDtcbiAgICBpZiAob3B0aW9ucy5zZXRMb2NhbGUpIHtcbiAgICAgIGNvbnN0IHNldExvY2FsZVRleHQgPSBgdmFyICRsb2NhbGl6ZT1PYmplY3QuYXNzaWduKHZvaWQgMD09PSRsb2NhbGl6ZT97fTokbG9jYWxpemUse2xvY2FsZTpcIiR7bG9jYWxlfVwifSk7XFxuYDtcblxuICAgICAgLy8gSWYgbG9jYWxlIGRhdGEgaXMgcHJvdmlkZWQsIGxvYWQgaXQgYW5kIHByZXBlbmQgdG8gZmlsZVxuICAgICAgbGV0IGxvY2FsZURhdGFTb3VyY2U7XG4gICAgICBjb25zdCBsb2NhbGVEYXRhUGF0aCA9IGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmRhdGFQYXRoO1xuICAgICAgaWYgKGxvY2FsZURhdGFQYXRoKSB7XG4gICAgICAgIGNvbnN0IGxvY2FsZURhdGFDb250ZW50ID0gYXdhaXQgbG9hZExvY2FsZURhdGEobG9jYWxlRGF0YVBhdGgsIHRydWUpO1xuICAgICAgICBsb2NhbGVEYXRhU291cmNlID0gbmV3IE9yaWdpbmFsU291cmNlKGxvY2FsZURhdGFDb250ZW50LCBwYXRoLmJhc2VuYW1lKGxvY2FsZURhdGFQYXRoKSk7XG4gICAgICB9XG5cbiAgICAgIG91dHB1dFNvdXJjZSA9IGxvY2FsZURhdGFTb3VyY2VcbiAgICAgICAgPyAvLyBUaGUgc2VtaWNvbG9uIGVuc3VyZXMgdGhhdCB0aGVyZSBpcyBubyBzeW50YXggZXJyb3IgYmV0d2VlbiBzdGF0ZW1lbnRzXG4gICAgICAgICAgbmV3IENvbmNhdFNvdXJjZShzZXRMb2NhbGVUZXh0LCBsb2NhbGVEYXRhU291cmNlLCAnO1xcbicsIGNvbnRlbnQpXG4gICAgICAgIDogbmV3IENvbmNhdFNvdXJjZShzZXRMb2NhbGVUZXh0LCBjb250ZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHNvdXJjZTogb3V0cHV0Q29kZSwgbWFwOiBvdXRwdXRNYXAgfSA9IG91dHB1dFNvdXJjZS5zb3VyY2VBbmRNYXAoKSBhcyB7XG4gICAgICBzb3VyY2U6IHN0cmluZztcbiAgICAgIG1hcDogeyBmaWxlOiBzdHJpbmc7IHNvdXJjZVJvb3Q/OiBzdHJpbmcgfTtcbiAgICB9O1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oXG4gICAgICBvcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBpMThuLmZsYXRPdXRwdXQgPyAnJyA6IGxvY2FsZSxcbiAgICAgIG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgKTtcbiAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCwgb3V0cHV0Q29kZSk7XG5cbiAgICBpZiAoaW5wdXRNYXAgJiYgb3V0cHV0TWFwKSB7XG4gICAgICBvdXRwdXRNYXAuZmlsZSA9IG9wdGlvbnMuZmlsZW5hbWU7XG4gICAgICBpZiAobWFwU291cmNlUm9vdCkge1xuICAgICAgICBvdXRwdXRNYXAuc291cmNlUm9vdCA9IG1hcFNvdXJjZVJvb3Q7XG4gICAgICB9XG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCArICcubWFwJywgSlNPTi5zdHJpbmdpZnkob3V0cHV0TWFwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZmlsZTogb3B0aW9ucy5maWxlbmFtZSwgZGlhZ25vc3RpY3M6IGRpYWdub3N0aWNzLm1lc3NhZ2VzLCBjb3VudDogcG9zaXRpb25zLmxlbmd0aCB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbmxpbmVDb3B5T25seShvcHRpb25zOiBJbmxpbmVPcHRpb25zKSB7XG4gIGlmICghaTE4bikge1xuICAgIHRocm93IG5ldyBFcnJvcignaTE4biBvcHRpb25zIGFyZSBtaXNzaW5nJyk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuLmlubGluZUxvY2FsZXMpIHtcbiAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKFxuICAgICAgb3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgaTE4bi5mbGF0T3V0cHV0ID8gJycgOiBsb2NhbGUsXG4gICAgICBvcHRpb25zLmZpbGVuYW1lLFxuICAgICk7XG4gICAgYXdhaXQgZnMud3JpdGVGaWxlKG91dHB1dFBhdGgsIG9wdGlvbnMuY29kZSk7XG4gICAgaWYgKG9wdGlvbnMubWFwKSB7XG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCArICcubWFwJywgb3B0aW9ucy5tYXApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IGZpbGU6IG9wdGlvbnMuZmlsZW5hbWUsIGRpYWdub3N0aWNzOiBbXSwgY291bnQ6IDAgfTtcbn1cblxuZnVuY3Rpb24gZmluZExvY2FsaXplUG9zaXRpb25zKFxuICBhc3Q6IFBhcnNlUmVzdWx0LFxuICBvcHRpb25zOiBJbmxpbmVPcHRpb25zLFxuICB1dGlsczogTG9jYWxpemVVdGlsaXR5TW9kdWxlLFxuKTogTG9jYWxpemVQb3NpdGlvbltdIHtcbiAgY29uc3QgcG9zaXRpb25zOiBMb2NhbGl6ZVBvc2l0aW9uW10gPSBbXTtcblxuICAvLyBXb3JrYXJvdW5kIHRvIGVuc3VyZSBhIHBhdGggaHViIGlzIHByZXNlbnQgZm9yIHRyYXZlcnNhbFxuICBjb25zdCB7IEZpbGUgfSA9IHJlcXVpcmUoJ0BiYWJlbC9jb3JlJyk7XG4gIGNvbnN0IGZpbGUgPSBuZXcgRmlsZSh7fSwgeyBjb2RlOiBvcHRpb25zLmNvZGUsIGFzdCB9KTtcblxuICB0cmF2ZXJzZShmaWxlLmFzdCwge1xuICAgIFRhZ2dlZFRlbXBsYXRlRXhwcmVzc2lvbihwYXRoKSB7XG4gICAgICBpZiAodHlwZXMuaXNJZGVudGlmaWVyKHBhdGgubm9kZS50YWcpICYmIHBhdGgubm9kZS50YWcubmFtZSA9PT0gbG9jYWxpemVOYW1lKSB7XG4gICAgICAgIGNvbnN0IFttZXNzYWdlUGFydHMsIGV4cHJlc3Npb25zXSA9IHVud3JhcFRlbXBsYXRlTGl0ZXJhbChwYXRoLCB1dGlscyk7XG4gICAgICAgIHBvc2l0aW9ucy5wdXNoKHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgIHN0YXJ0OiBwYXRoLm5vZGUuc3RhcnQhLFxuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICAgICAgZW5kOiBwYXRoLm5vZGUuZW5kISxcbiAgICAgICAgICBtZXNzYWdlUGFydHMsXG4gICAgICAgICAgZXhwcmVzc2lvbnMsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBwb3NpdGlvbnM7XG59XG5cbmZ1bmN0aW9uIHVud3JhcFRlbXBsYXRlTGl0ZXJhbChcbiAgcGF0aDogTm9kZVBhdGg8dHlwZXMuVGFnZ2VkVGVtcGxhdGVFeHByZXNzaW9uPixcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IFtUZW1wbGF0ZVN0cmluZ3NBcnJheSwgdHlwZXMuRXhwcmVzc2lvbltdXSB7XG4gIGNvbnN0IFttZXNzYWdlUGFydHNdID0gdXRpbHMudW53cmFwTWVzc2FnZVBhcnRzRnJvbVRlbXBsYXRlTGl0ZXJhbChcbiAgICBwYXRoLmdldCgncXVhc2knKS5nZXQoJ3F1YXNpcycpLFxuICApO1xuICBjb25zdCBbZXhwcmVzc2lvbnNdID0gdXRpbHMudW53cmFwRXhwcmVzc2lvbnNGcm9tVGVtcGxhdGVMaXRlcmFsKHBhdGguZ2V0KCdxdWFzaScpKTtcblxuICByZXR1cm4gW21lc3NhZ2VQYXJ0cywgZXhwcmVzc2lvbnNdO1xufVxuXG5mdW5jdGlvbiB1bndyYXBMb2NhbGl6ZUNhbGwoXG4gIHBhdGg6IE5vZGVQYXRoPHR5cGVzLkNhbGxFeHByZXNzaW9uPixcbiAgdXRpbHM6IExvY2FsaXplVXRpbGl0eU1vZHVsZSxcbik6IFtUZW1wbGF0ZVN0cmluZ3NBcnJheSwgdHlwZXMuRXhwcmVzc2lvbltdXSB7XG4gIGNvbnN0IFttZXNzYWdlUGFydHNdID0gdXRpbHMudW53cmFwTWVzc2FnZVBhcnRzRnJvbUxvY2FsaXplQ2FsbChwYXRoKTtcbiAgY29uc3QgW2V4cHJlc3Npb25zXSA9IHV0aWxzLnVud3JhcFN1YnN0aXR1dGlvbnNGcm9tTG9jYWxpemVDYWxsKHBhdGgpO1xuXG4gIHJldHVybiBbbWVzc2FnZVBhcnRzLCBleHByZXNzaW9uc107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbGVEYXRhKHBhdGg6IHN0cmluZywgb3B0aW1pemU6IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAvLyBUaGUgcGF0aCBpcyB2YWxpZGF0ZWQgZHVyaW5nIG9wdGlvbiBwcm9jZXNzaW5nIGJlZm9yZSB0aGUgYnVpbGQgc3RhcnRzXG4gIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShwYXRoLCAndXRmOCcpO1xuXG4gIC8vIERvd25sZXZlbCBhbmQgb3B0aW1pemUgdGhlIGRhdGFcbiAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoY29udGVudCwge1xuICAgIGZpbGVuYW1lOiBwYXRoLFxuICAgIC8vIFRoZSB0eXBlcyBkbyBub3QgaW5jbHVkZSB0aGUgZmFsc2Ugb3B0aW9uIGV2ZW4gdGhvdWdoIGl0IGlzIHZhbGlkXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBpbnB1dFNvdXJjZU1hcDogZmFsc2UgYXMgYW55LFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgcmVxdWlyZS5yZXNvbHZlKCdAYmFiZWwvcHJlc2V0LWVudicpLFxuICAgICAgICB7XG4gICAgICAgICAgYnVnZml4ZXM6IHRydWUsXG4gICAgICAgICAgdGFyZ2V0czogeyBlc21vZHVsZXM6IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgXSxcbiAgICBtaW5pZmllZDogYWxsb3dNaW5pZnkgJiYgb3B0aW1pemUsXG4gICAgY29tcGFjdDogIXNob3VsZEJlYXV0aWZ5ICYmIG9wdGltaXplLFxuICAgIGNvbW1lbnRzOiAhb3B0aW1pemUsXG4gIH0pO1xuXG4gIGlmICghdHJhbnNmb3JtUmVzdWx0IHx8ICF0cmFuc2Zvcm1SZXN1bHQuY29kZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlcnJvciBvY2N1cnJlZCBwcm9jZXNzaW5nIGJ1bmRsZSBmb3IgXCIke3BhdGh9XCIuYCk7XG4gIH1cblxuICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0LmNvZGU7XG59XG4iXX0=