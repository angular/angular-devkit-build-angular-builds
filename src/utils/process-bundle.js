"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@babel/core");
const crypto_1 = require("crypto");
const fs = require("fs");
const path = require("path");
const source_map_1 = require("source-map");
const terser_1 = require("terser");
const v8 = require("v8");
const webpack_sources_1 = require("webpack-sources");
const environment_options_1 = require("./environment-options");
const cacache = require('cacache');
const deserialize = v8.deserialize;
let cachePath;
let i18n;
function setup(data) {
    const options = Array.isArray(data)
        ? deserialize(Buffer.from(data))
        : data;
    cachePath = options.cachePath;
    i18n = options.i18n;
}
exports.setup = setup;
async function cachePut(content, key, integrity) {
    if (cachePath && key) {
        await cacache.put(cachePath, key, content, {
            metadata: { integrity },
        });
    }
}
async function process(options) {
    if (!options.cacheKeys) {
        options.cacheKeys = [];
    }
    const result = { name: options.name };
    if (options.integrityAlgorithm) {
        // Store unmodified code integrity value -- used for SRI value replacement
        result.integrity = generateIntegrityValue(options.integrityAlgorithm, options.code);
    }
    // Runtime chunk requires specialized handling
    if (options.runtime) {
        return { ...result, ...(await processRuntime(options)) };
    }
    const basePath = path.dirname(options.filename);
    const filename = path.basename(options.filename);
    const downlevelFilename = filename.replace('es2015', 'es5');
    const downlevel = !options.optimizeOnly;
    // if code size is larger than 500kB, manually handle sourcemaps with newer source-map package.
    // babel currently uses an older version that still supports sync calls
    const codeSize = Buffer.byteLength(options.code);
    const mapSize = options.map ? Buffer.byteLength(options.map) : 0;
    const manualSourceMaps = codeSize >= 500 * 1024 || mapSize >= 500 * 1024;
    const sourceCode = options.code;
    const sourceMap = options.map ? JSON.parse(options.map) : undefined;
    let downlevelCode;
    let downlevelMap;
    if (downlevel) {
        // Downlevel the bundle
        const transformResult = await core_1.transformAsync(sourceCode, {
            filename: options.filename,
            inputSourceMap: manualSourceMaps ? undefined : sourceMap,
            babelrc: false,
            // modules aren't needed since the bundles use webpack's custom module loading
            // 'transform-typeof-symbol' generates slower code
            presets: [['@babel/preset-env', { modules: false, exclude: ['transform-typeof-symbol'] }]],
            minified: options.optimize,
            // `false` ensures it is disabled and prevents large file warnings
            compact: options.optimize || false,
            sourceMaps: !!sourceMap,
        });
        if (!transformResult || !transformResult.code) {
            throw new Error(`Unknown error occurred processing bundle for "${options.filename}".`);
        }
        downlevelCode = transformResult.code;
        if (manualSourceMaps && sourceMap && transformResult.map) {
            downlevelMap = await mergeSourceMapsFast(sourceMap, transformResult.map);
        }
        else {
            // undefined is needed here to normalize the property type
            downlevelMap = transformResult.map || undefined;
        }
    }
    if (options.optimize) {
        if (downlevelCode) {
            const minifyResult = terserMangle(downlevelCode, {
                filename: downlevelFilename,
                map: downlevelMap,
                compress: true,
            });
            downlevelCode = minifyResult.code;
            downlevelMap = minifyResult.map;
        }
        if (!options.ignoreOriginal) {
            result.original = await mangleOriginal(options);
        }
    }
    if (downlevelCode) {
        const downlevelPath = path.join(basePath, downlevelFilename);
        let mapContent;
        if (downlevelMap) {
            if (!options.hiddenSourceMaps) {
                downlevelCode += `\n//# sourceMappingURL=${downlevelFilename}.map`;
            }
            mapContent = JSON.stringify(downlevelMap);
            await cachePut(mapContent, options.cacheKeys[3 /* DownlevelMap */]);
            fs.writeFileSync(downlevelPath + '.map', mapContent);
        }
        result.downlevel = createFileEntry(path.join(basePath, downlevelFilename), downlevelCode, mapContent, options.integrityAlgorithm);
        await cachePut(downlevelCode, options.cacheKeys[2 /* DownlevelCode */], result.downlevel.integrity);
        fs.writeFileSync(downlevelPath, downlevelCode);
    }
    // If original was not processed, add info
    if (!result.original && !options.ignoreOriginal) {
        result.original = createFileEntry(options.filename, options.code, options.map, options.integrityAlgorithm);
    }
    return result;
}
exports.process = process;
function mergeSourceMaps(inputCode, inputSourceMap, resultCode, resultSourceMap, filename) {
    // More accurate but significantly more costly
    // The last argument is not yet in the typings
    // tslint:disable-next-line: no-any
    return new webpack_sources_1.SourceMapSource(resultCode, filename, resultSourceMap, inputCode, inputSourceMap, true).map();
}
async function mergeSourceMapsFast(first, second) {
    const sourceRoot = first.sourceRoot;
    const generator = new source_map_1.SourceMapGenerator();
    // sourcemap package adds the sourceRoot to all position source paths if not removed
    delete first.sourceRoot;
    await source_map_1.SourceMapConsumer.with(first, null, originalConsumer => {
        return source_map_1.SourceMapConsumer.with(second, null, newConsumer => {
            newConsumer.eachMapping(mapping => {
                if (mapping.originalLine === null) {
                    return;
                }
                const originalPosition = originalConsumer.originalPositionFor({
                    line: mapping.originalLine,
                    column: mapping.originalColumn,
                });
                if (originalPosition.line === null ||
                    originalPosition.column === null ||
                    originalPosition.source === null) {
                    return;
                }
                generator.addMapping({
                    generated: {
                        line: mapping.generatedLine,
                        column: mapping.generatedColumn,
                    },
                    name: originalPosition.name || undefined,
                    original: {
                        line: originalPosition.line,
                        column: originalPosition.column,
                    },
                    source: originalPosition.source,
                });
            });
        });
    });
    const map = generator.toJSON();
    map.file = second.file;
    map.sourceRoot = sourceRoot;
    // Put the sourceRoot back
    if (sourceRoot) {
        first.sourceRoot = sourceRoot;
    }
    return map;
}
async function mangleOriginal(options) {
    const result = terserMangle(options.code, {
        filename: path.basename(options.filename),
        map: options.map ? JSON.parse(options.map) : undefined,
        ecma: 6,
    });
    let mapContent;
    if (result.map) {
        if (!options.hiddenSourceMaps) {
            result.code += `\n//# sourceMappingURL=${path.basename(options.filename)}.map`;
        }
        mapContent = JSON.stringify(result.map);
        await cachePut(mapContent, (options.cacheKeys && options.cacheKeys[1 /* OriginalMap */]) || null);
        fs.writeFileSync(options.filename + '.map', mapContent);
    }
    const fileResult = createFileEntry(options.filename, result.code, mapContent, options.integrityAlgorithm);
    await cachePut(result.code, (options.cacheKeys && options.cacheKeys[0 /* OriginalCode */]) || null, fileResult.integrity);
    fs.writeFileSync(options.filename, result.code);
    return fileResult;
}
function terserMangle(code, options = {}) {
    // Note: Investigate converting the AST instead of re-parsing
    // estree -> terser is already supported; need babel -> estree/terser
    // Mangle downlevel code
    const minifyOutput = terser_1.minify(code, {
        compress: options.compress || false,
        ecma: options.ecma || 5,
        mangle: !environment_options_1.manglingDisabled,
        safari10: true,
        output: {
            ascii_only: true,
            webkit: true,
        },
        sourceMap: !!options.map &&
            {
                filename: options.filename,
                // terser uses an old version of the sourcemap typings
                // tslint:disable-next-line: no-any
                content: options.map,
                asObject: true,
            },
    });
    if (minifyOutput.error) {
        throw minifyOutput.error;
    }
    // tslint:disable-next-line: no-non-null-assertion
    return { code: minifyOutput.code, map: minifyOutput.map };
}
function createFileEntry(filename, code, map, integrityAlgorithm) {
    return {
        filename: filename,
        size: Buffer.byteLength(code),
        integrity: integrityAlgorithm && generateIntegrityValue(integrityAlgorithm, code),
        map: !map
            ? undefined
            : {
                filename: filename + '.map',
                size: Buffer.byteLength(map),
            },
    };
}
function generateIntegrityValue(hashAlgorithm, code) {
    return (hashAlgorithm +
        '-' +
        crypto_1.createHash(hashAlgorithm)
            .update(code)
            .digest('base64'));
}
// The webpack runtime chunk is already ES5.
// However, two variants are still needed due to lazy routing and SRI differences
// NOTE: This should eventually be a babel plugin
async function processRuntime(options) {
    let originalCode = options.code;
    let downlevelCode = options.code;
    // Replace integrity hashes with updated values
    if (options.integrityAlgorithm && options.runtimeData) {
        for (const data of options.runtimeData) {
            if (!data.integrity) {
                continue;
            }
            if (data.original && data.original.integrity) {
                originalCode = originalCode.replace(data.integrity, data.original.integrity);
            }
            if (data.downlevel && data.downlevel.integrity) {
                downlevelCode = downlevelCode.replace(data.integrity, data.downlevel.integrity);
            }
        }
    }
    // Adjust lazy loaded scripts to point to the proper variant
    // Extra spacing is intentional to align source line positions
    downlevelCode = downlevelCode.replace('"-es2015.', '   "-es5.');
    const downlevelFilePath = options.filename.replace('es2015', 'es5');
    let downlevelMap;
    let result;
    if (options.optimize) {
        const minifiyResults = terserMangle(downlevelCode, {
            filename: path.basename(downlevelFilePath),
            map: options.map === undefined ? undefined : JSON.parse(options.map),
        });
        downlevelCode = minifiyResults.code;
        downlevelMap = JSON.stringify(minifiyResults.map);
        result = {
            original: await mangleOriginal({ ...options, code: originalCode }),
            downlevel: createFileEntry(downlevelFilePath, downlevelCode, downlevelMap, options.integrityAlgorithm),
        };
    }
    else {
        if (options.map) {
            const rawMap = JSON.parse(options.map);
            rawMap.file = path.basename(downlevelFilePath);
            downlevelMap = JSON.stringify(rawMap);
        }
        result = {
            original: createFileEntry(options.filename, originalCode, options.map, options.integrityAlgorithm),
            downlevel: createFileEntry(downlevelFilePath, downlevelCode, downlevelMap, options.integrityAlgorithm),
        };
    }
    if (downlevelMap) {
        await cachePut(downlevelMap, (options.cacheKeys && options.cacheKeys[3 /* DownlevelMap */]) || null);
        fs.writeFileSync(downlevelFilePath + '.map', downlevelMap);
        if (!options.hiddenSourceMaps) {
            downlevelCode += `\n//# sourceMappingURL=${path.basename(downlevelFilePath)}.map`;
        }
    }
    await cachePut(downlevelCode, (options.cacheKeys && options.cacheKeys[2 /* DownlevelCode */]) || null);
    fs.writeFileSync(downlevelFilePath, downlevelCode);
    return result;
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
    const { default: MagicString } = await Promise.resolve().then(() => require('magic-string'));
    const { default: generate } = await Promise.resolve().then(() => require('@babel/generator'));
    const utils = await Promise.resolve().then(() => require(
    // tslint:disable-next-line: trailing-comma
    '@angular/localize/src/tools/src/translate/source_files/source_file_utils'));
    const localizeDiag = await Promise.resolve().then(() => require('@angular/localize/src/tools/src/diagnostics'));
    const diagnostics = new localizeDiag.Diagnostics();
    const positions = findLocalizePositions(options, utils);
    if (positions.length === 0 && !options.setLocale) {
        return inlineCopyOnly(options);
    }
    let content = new MagicString(options.code);
    const inputMap = options.map && JSON.parse(options.map);
    let contentClone;
    for (const locale of i18n.inlineLocales) {
        const isSourceLocale = locale === i18n.sourceLocale;
        // tslint:disable-next-line: no-any
        const translations = isSourceLocale ? {} : i18n.locales[locale].translation || {};
        for (const position of positions) {
            const translated = utils.translate(diagnostics, translations, position.messageParts, position.expressions, isSourceLocale ? 'ignore' : options.missingTranslation || 'warning');
            const expression = utils.buildLocalizeReplacement(translated[0], translated[1]);
            const { code } = generate(expression);
            content.overwrite(position.start, position.end, code);
        }
        if (options.setLocale) {
            const setLocaleText = `var $localize=Object.assign(void 0===$localize?{}:$localize,{locale:"${locale}"});`;
            contentClone = content.clone();
            content.prepend(setLocaleText);
        }
        const output = content.toString();
        const outputPath = path.join(options.outputPath, i18n.flatOutput ? '' : locale, options.filename);
        fs.writeFileSync(outputPath, output);
        if (inputMap) {
            const contentMap = content.generateMap();
            const outputMap = mergeSourceMaps(options.code, inputMap, output, contentMap, options.filename);
            fs.writeFileSync(outputPath + '.map', JSON.stringify(outputMap));
        }
        if (contentClone) {
            content = contentClone;
            contentClone = undefined;
        }
    }
    return { file: options.filename, diagnostics: diagnostics.messages, count: positions.length };
}
exports.inlineLocales = inlineLocales;
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
function findLocalizePositions(options, utils) {
    let ast;
    try {
        ast = core_1.parseSync(options.code, {
            babelrc: false,
            sourceType: 'script',
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
    const positions = [];
    if (options.es5) {
        core_1.traverse(ast, {
            CallExpression(path) {
                const callee = path.get('callee');
                if (callee.isIdentifier() &&
                    callee.node.name === localizeName &&
                    utils.isGlobalIdentifier(callee)) {
                    const messageParts = utils.unwrapMessagePartsFromLocalizeCall(path);
                    const expressions = utils.unwrapSubstitutionsFromLocalizeCall(path.node);
                    positions.push({
                        // tslint:disable-next-line: no-non-null-assertion
                        start: path.node.start,
                        // tslint:disable-next-line: no-non-null-assertion
                        end: path.node.end,
                        messageParts,
                        expressions,
                    });
                }
            },
        });
    }
    else {
        const traverseFast = core_1.types.traverseFast;
        traverseFast(ast, node => {
            if (node.type === 'TaggedTemplateExpression' &&
                core_1.types.isIdentifier(node.tag) &&
                node.tag.name === localizeName) {
                const messageParts = utils.unwrapMessagePartsFromTemplateLiteral(node.quasi.quasis);
                positions.push({
                    // tslint:disable-next-line: no-non-null-assertion
                    start: node.start,
                    // tslint:disable-next-line: no-non-null-assertion
                    end: node.end,
                    messageParts,
                    expressions: node.quasi.expressions,
                });
            }
        });
    }
    return positions;
}
