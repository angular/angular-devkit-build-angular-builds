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
exports.webpackStatsLogger = exports.createWebpackLoggingCallback = exports.statsHasWarnings = exports.statsHasErrors = exports.statsErrorsToString = exports.statsWarningsToString = exports.generateBundleStats = exports.formatSize = void 0;
const core_1 = require("@angular-devkit/core");
const path = __importStar(require("path"));
const text_table_1 = __importDefault(require("text-table"));
const color_1 = require("../../utils/color");
const async_chunks_1 = require("./async-chunks");
const helpers_1 = require("./helpers");
function formatSize(size) {
    if (size <= 0) {
        return '0 bytes';
    }
    const abbreviations = ['bytes', 'kB', 'MB', 'GB'];
    const index = Math.floor(Math.log(size) / Math.log(1024));
    const roundedSize = size / Math.pow(1024, index);
    // bytes don't have a fraction
    const fractionDigits = index === 0 ? 0 : 2;
    return `${roundedSize.toFixed(fractionDigits)} ${abbreviations[index]}`;
}
exports.formatSize = formatSize;
function generateBundleStats(info) {
    var _a, _b, _c;
    const rawSize = typeof info.rawSize === 'number' ? info.rawSize : '-';
    const estimatedTransferSize = typeof info.estimatedTransferSize === 'number' ? info.estimatedTransferSize : '-';
    const files = (_b = (_a = info.files) === null || _a === void 0 ? void 0 : _a.filter((f) => !f.endsWith('.map')).map((f) => path.basename(f)).join(', ')) !== null && _b !== void 0 ? _b : '';
    const names = ((_c = info.names) === null || _c === void 0 ? void 0 : _c.length) ? info.names.join(', ') : '-';
    const initial = !!info.initial;
    return {
        initial,
        stats: [files, names, rawSize, estimatedTransferSize],
    };
}
exports.generateBundleStats = generateBundleStats;
function generateBuildStatsTable(data, colors, showTotalSize, showEstimatedTransferSize, budgetFailures) {
    const g = (x) => (colors ? color_1.colors.greenBright(x) : x);
    const c = (x) => (colors ? color_1.colors.cyanBright(x) : x);
    const r = (x) => (colors ? color_1.colors.redBright(x) : x);
    const y = (x) => (colors ? color_1.colors.yellowBright(x) : x);
    const bold = (x) => (colors ? color_1.colors.bold(x) : x);
    const dim = (x) => (colors ? color_1.colors.dim(x) : x);
    const getSizeColor = (name, file, defaultColor = c) => {
        const severity = budgets.get(name) || (file && budgets.get(file));
        switch (severity) {
            case 'warning':
                return y;
            case 'error':
                return r;
            default:
                return defaultColor;
        }
    };
    const changedEntryChunksStats = [];
    const changedLazyChunksStats = [];
    let initialTotalRawSize = 0;
    let initialTotalEstimatedTransferSize;
    const budgets = new Map();
    if (budgetFailures) {
        for (const { label, severity } of budgetFailures) {
            // In some cases a file can have multiple budget failures.
            // Favor error.
            if (label && (!budgets.has(label) || budgets.get(label) === 'warning')) {
                budgets.set(label, severity);
            }
        }
    }
    for (const { initial, stats } of data) {
        const [files, names, rawSize, estimatedTransferSize] = stats;
        const getRawSizeColor = getSizeColor(names, files);
        let data;
        if (showEstimatedTransferSize) {
            data = [
                g(files),
                names,
                getRawSizeColor(typeof rawSize === 'number' ? formatSize(rawSize) : rawSize),
                c(typeof estimatedTransferSize === 'number'
                    ? formatSize(estimatedTransferSize)
                    : estimatedTransferSize),
            ];
        }
        else {
            data = [
                g(files),
                names,
                getRawSizeColor(typeof rawSize === 'number' ? formatSize(rawSize) : rawSize),
                '',
            ];
        }
        if (initial) {
            changedEntryChunksStats.push(data);
            if (typeof rawSize === 'number') {
                initialTotalRawSize += rawSize;
            }
            if (showEstimatedTransferSize && typeof estimatedTransferSize === 'number') {
                if (initialTotalEstimatedTransferSize === undefined) {
                    initialTotalEstimatedTransferSize = 0;
                }
                initialTotalEstimatedTransferSize += estimatedTransferSize;
            }
        }
        else {
            changedLazyChunksStats.push(data);
        }
    }
    const bundleInfo = [];
    const baseTitles = ['Names', 'Raw Size'];
    const tableAlign = ['l', 'l', 'r'];
    if (showEstimatedTransferSize) {
        baseTitles.push('Estimated Transfer Size');
        tableAlign.push('r');
    }
    // Entry chunks
    if (changedEntryChunksStats.length) {
        bundleInfo.push(['Initial Chunk Files', ...baseTitles].map(bold), ...changedEntryChunksStats);
        if (showTotalSize) {
            bundleInfo.push([]);
            const initialSizeTotalColor = getSizeColor('bundle initial', undefined, (x) => x);
            const totalSizeElements = [
                ' ',
                'Initial Total',
                initialSizeTotalColor(formatSize(initialTotalRawSize)),
            ];
            if (showEstimatedTransferSize) {
                totalSizeElements.push(typeof initialTotalEstimatedTransferSize === 'number'
                    ? formatSize(initialTotalEstimatedTransferSize)
                    : '-');
            }
            bundleInfo.push(totalSizeElements.map(bold));
        }
    }
    // Seperator
    if (changedEntryChunksStats.length && changedLazyChunksStats.length) {
        bundleInfo.push([]);
    }
    // Lazy chunks
    if (changedLazyChunksStats.length) {
        bundleInfo.push(['Lazy Chunk Files', ...baseTitles].map(bold), ...changedLazyChunksStats);
    }
    return (0, text_table_1.default)(bundleInfo, {
        hsep: dim(' | '),
        stringLength: (s) => (0, color_1.removeColor)(s).length,
        align: tableAlign,
    });
}
function generateBuildStats(hash, time, colors) {
    const w = (x) => (colors ? color_1.colors.bold.white(x) : x);
    return `Build at: ${w(new Date().toISOString())} - Hash: ${w(hash)} - Time: ${w('' + time)}ms`;
}
// We use this cache because we can have multiple builders running in the same process,
// where each builder has different output path.
// Ideally, we should create the logging callback as a factory, but that would need a refactoring.
const runsCache = new Set();
function statsToString(json, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
statsConfig, budgetFailures) {
    var _a, _b;
    if (!((_a = json.chunks) === null || _a === void 0 ? void 0 : _a.length)) {
        return '';
    }
    const colors = statsConfig.colors;
    const rs = (x) => (colors ? color_1.colors.reset(x) : x);
    const changedChunksStats = [];
    let unchangedChunkNumber = 0;
    let hasEstimatedTransferSizes = false;
    const isFirstRun = !runsCache.has(json.outputPath || '');
    for (const chunk of json.chunks) {
        // During first build we want to display unchanged chunks
        // but unchanged cached chunks are always marked as not rendered.
        if (!isFirstRun && !chunk.rendered) {
            continue;
        }
        const assets = (_b = json.assets) === null || _b === void 0 ? void 0 : _b.filter((asset) => { var _a; return (_a = chunk.files) === null || _a === void 0 ? void 0 : _a.includes(asset.name); });
        let rawSize = 0;
        let estimatedTransferSize;
        if (assets) {
            for (const asset of assets) {
                if (asset.name.endsWith('.map')) {
                    continue;
                }
                rawSize += asset.size;
                if (typeof asset.info.estimatedTransferSize === 'number') {
                    if (estimatedTransferSize === undefined) {
                        estimatedTransferSize = 0;
                        hasEstimatedTransferSizes = true;
                    }
                    estimatedTransferSize += asset.info.estimatedTransferSize;
                }
            }
        }
        changedChunksStats.push(generateBundleStats({ ...chunk, rawSize, estimatedTransferSize }));
    }
    unchangedChunkNumber = json.chunks.length - changedChunksStats.length;
    runsCache.add(json.outputPath || '');
    // Sort chunks by size in descending order
    changedChunksStats.sort((a, b) => {
        if (a.stats[2] > b.stats[2]) {
            return -1;
        }
        if (a.stats[2] < b.stats[2]) {
            return 1;
        }
        return 0;
    });
    const statsTable = generateBuildStatsTable(changedChunksStats, colors, unchangedChunkNumber === 0, hasEstimatedTransferSizes, budgetFailures);
    // In some cases we do things outside of webpack context
    // Such us index generation, service worker augmentation etc...
    // This will correct the time and include these.
    let time = 0;
    if (json.builtAt !== undefined && json.time !== undefined) {
        time = Date.now() - json.builtAt + json.time;
    }
    if (unchangedChunkNumber > 0) {
        return ('\n' +
            rs(core_1.tags.stripIndents `
      ${statsTable}

      ${unchangedChunkNumber} unchanged chunks

      ${generateBuildStats(json.hash || '', time, colors)}
      `));
    }
    else {
        return ('\n' +
            rs(core_1.tags.stripIndents `
      ${statsTable}

      ${generateBuildStats(json.hash || '', time, colors)}
      `));
    }
}
function statsWarningsToString(json, statsConfig) {
    const colors = statsConfig.colors;
    const c = (x) => (colors ? color_1.colors.reset.cyan(x) : x);
    const y = (x) => (colors ? color_1.colors.reset.yellow(x) : x);
    const yb = (x) => (colors ? color_1.colors.reset.yellowBright(x) : x);
    const warnings = json.warnings ? [...json.warnings] : [];
    if (json.children) {
        warnings.push(...json.children.map((c) => { var _a; return (_a = c.warnings) !== null && _a !== void 0 ? _a : []; }).reduce((a, b) => [...a, ...b], []));
    }
    let output = '';
    for (const warning of warnings) {
        if (typeof warning === 'string') {
            output += yb(`Warning: ${warning}\n\n`);
        }
        else {
            const file = warning.file || warning.moduleName;
            if (file) {
                output += c(file);
                if (warning.loc) {
                    output += ':' + yb(warning.loc);
                }
                output += ' - ';
            }
            if (!/^warning/i.test(warning.message)) {
                output += y('Warning: ');
            }
            output += `${warning.message}\n\n`;
        }
    }
    return output ? '\n' + output : output;
}
exports.statsWarningsToString = statsWarningsToString;
function statsErrorsToString(json, statsConfig) {
    var _a, _b;
    const colors = statsConfig.colors;
    const c = (x) => (colors ? color_1.colors.reset.cyan(x) : x);
    const yb = (x) => (colors ? color_1.colors.reset.yellowBright(x) : x);
    const r = (x) => (colors ? color_1.colors.reset.redBright(x) : x);
    const errors = json.errors ? [...json.errors] : [];
    if (json.children) {
        errors.push(...json.children.map((c) => (c === null || c === void 0 ? void 0 : c.errors) || []).reduce((a, b) => [...a, ...b], []));
    }
    let output = '';
    for (const error of errors) {
        if (typeof error === 'string') {
            output += r(`Error: ${error}\n\n`);
        }
        else {
            let file = error.file || error.moduleName;
            // Clean up error paths
            // Ex: ./src/app/styles.scss.webpack[javascript/auto]!=!./node_modules/css-loader/dist/cjs.js....
            // to ./src/app/styles.scss.webpack
            if (file && !statsConfig.errorDetails) {
                const webpackPathIndex = file.indexOf('.webpack[');
                if (webpackPathIndex !== -1) {
                    file = file.substring(0, webpackPathIndex);
                }
            }
            if (file) {
                output += c(file);
                if (error.loc) {
                    output += ':' + yb(error.loc);
                }
                output += ' - ';
            }
            // In most cases webpack will add stack traces to error messages.
            // This below cleans up the error from stacks.
            // See: https://github.com/webpack/webpack/issues/15980
            const message = statsConfig.errorStack
                ? error.message
                : (_b = (_a = /[\s\S]+?(?=[\n\s]+at)/.exec(error.message)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : error.message;
            if (!/^error/i.test(message)) {
                output += r('Error: ');
            }
            output += `${message}\n\n`;
        }
    }
    return output ? '\n' + output : output;
}
exports.statsErrorsToString = statsErrorsToString;
function statsHasErrors(json) {
    var _a, _b;
    return !!(((_a = json.errors) === null || _a === void 0 ? void 0 : _a.length) || ((_b = json.children) === null || _b === void 0 ? void 0 : _b.some((c) => { var _a; return (_a = c.errors) === null || _a === void 0 ? void 0 : _a.length; })));
}
exports.statsHasErrors = statsHasErrors;
function statsHasWarnings(json) {
    var _a, _b;
    return !!(((_a = json.warnings) === null || _a === void 0 ? void 0 : _a.length) || ((_b = json.children) === null || _b === void 0 ? void 0 : _b.some((c) => { var _a; return (_a = c.warnings) === null || _a === void 0 ? void 0 : _a.length; })));
}
exports.statsHasWarnings = statsHasWarnings;
function createWebpackLoggingCallback(options, logger) {
    const { verbose = false, scripts = [], styles = [] } = options;
    const extraEntryPoints = [
        ...(0, helpers_1.normalizeExtraEntryPoints)(styles, 'styles'),
        ...(0, helpers_1.normalizeExtraEntryPoints)(scripts, 'scripts'),
    ];
    return (stats, config) => {
        if (verbose) {
            logger.info(stats.toString(config.stats));
        }
        const rawStats = stats.toJson((0, helpers_1.getStatsOptions)(false));
        const webpackStats = {
            ...rawStats,
            chunks: (0, async_chunks_1.markAsyncChunksNonInitial)(rawStats, extraEntryPoints),
        };
        webpackStatsLogger(logger, webpackStats, config);
    };
}
exports.createWebpackLoggingCallback = createWebpackLoggingCallback;
function webpackStatsLogger(logger, json, config, budgetFailures) {
    logger.info(statsToString(json, config.stats, budgetFailures));
    if (typeof config.stats !== 'object') {
        throw new Error('Invalid Webpack stats configuration.');
    }
    if (statsHasWarnings(json)) {
        logger.warn(statsWarningsToString(json, config.stats));
    }
    if (statsHasErrors(json)) {
        logger.error(statsErrorsToString(json, config.stats));
    }
}
exports.webpackStatsLogger = webpackStatsLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3V0aWxzL3N0YXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsK0NBQXFEO0FBQ3JELDJDQUE2QjtBQUM3Qiw0REFBbUM7QUFJbkMsNkNBQXNFO0FBQ3RFLGlEQUEyRDtBQUMzRCx1Q0FBNEY7QUFFNUYsU0FBZ0IsVUFBVSxDQUFDLElBQVk7SUFDckMsSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFO1FBQ2IsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFFRCxNQUFNLGFBQWEsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2xELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDMUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pELDhCQUE4QjtJQUM5QixNQUFNLGNBQWMsR0FBRyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUzQyxPQUFPLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUMxRSxDQUFDO0FBWkQsZ0NBWUM7QUFhRCxTQUFnQixtQkFBbUIsQ0FBQyxJQU9uQzs7SUFDQyxNQUFNLE9BQU8sR0FBRyxPQUFPLElBQUks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QUFDLENBQUMsQ0FBQztJQUUvRCxJQUFJLE9BQU8sTUFBTSxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0tBQ3pEO0lBRUQsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUN4RDtJQUVELElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3hCLE1BQU0sQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3ZEO0FBQ0gsQ0FBQztBQW5CRCxnREFtQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgV2VicGFja0xvZ2dpbmdDYWxsYmFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGxvZ2dpbmcsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHRleHRUYWJsZSBmcm9tICd0ZXh0LXRhYmxlJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24sIFN0YXRzQ29tcGlsYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0IH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgY29sb3JzIGFzIGFuc2lDb2xvcnMsIHJlbW92ZUNvbG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCB9IGZyb20gJy4vYXN5bmMtY2h1bmtzJztcbmltcG9ydCB7IFdlYnBhY2tTdGF0c09wdGlvbnMsIGdldFN0YXRzT3B0aW9ucywgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vaGVscGVycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRTaXplKHNpemU6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gJzAgYnl0ZXMnO1xuICB9XG5cbiAgY29uc3QgYWJicmV2aWF0aW9ucyA9IFsnYnl0ZXMnLCAna0InLCAnTUInLCAnR0InXTtcbiAgY29uc3QgaW5kZXggPSBNYXRoLmZsb29yKE1hdGgubG9nKHNpemUpIC8gTWF0aC5sb2coMTAyNCkpO1xuICBjb25zdCByb3VuZGVkU2l6ZSA9IHNpemUgLyBNYXRoLnBvdygxMDI0LCBpbmRleCk7XG4gIC8vIGJ5dGVzIGRvbid0IGhhdmUgYSBmcmFjdGlvblxuICBjb25zdCBmcmFjdGlvbkRpZ2l0cyA9IGluZGV4ID09PSAwID8gMCA6IDI7XG5cbiAgcmV0dXJuIGAke3JvdW5kZWRTaXplLnRvRml4ZWQoZnJhY3Rpb25EaWdpdHMpfSAke2FiYnJldmlhdGlvbnNbaW5kZXhdfWA7XG59XG5cbmV4cG9ydCB0eXBlIEJ1bmRsZVN0YXRzRGF0YSA9IFtcbiAgZmlsZXM6IHN0cmluZyxcbiAgbmFtZXM6IHN0cmluZyxcbiAgcmF3U2l6ZTogbnVtYmVyIHwgc3RyaW5nLFxuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemU6IG51bWJlciB8IHN0cmluZyxcbl07XG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0YXRzIHtcbiAgaW5pdGlhbDogYm9vbGVhbjtcbiAgc3RhdHM6IEJ1bmRsZVN0YXRzRGF0YTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQnVuZGxlU3RhdHMoaW5mbzoge1xuICByYXdTaXplPzogbnVtYmVyO1xuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemU/OiBudW1iZXI7XG4gIGZpbGVzPzogc3RyaW5nW107XG4gIG5hbWVzPzogc3RyaW5nW107XG4gIGluaXRpYWw/OiBib29sZWFuO1xuICByZW5kZXJlZD86IGJvb2xlYW47XG59KTogQnVuZGxlU3RhdHMge1xuICBjb25zdCByYXdTaXplID0gdHlwZW9mIGluZm8ucmF3U2l6ZSA9PT0gJ251bWJlcicgPyBpbmZvLnJhd1NpemUgOiAnLSc7XG4gIGNvbnN0IGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9XG4gICAgdHlwZW9mIGluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJyA/IGluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplIDogJy0nO1xuICBjb25zdCBmaWxlcyA9XG4gICAgaW5mby5maWxlc1xuICAgICAgPy5maWx0ZXIoKGYpID0+ICFmLmVuZHNXaXRoKCcubWFwJykpXG4gICAgICAubWFwKChmKSA9PiBwYXRoLmJhc2VuYW1lKGYpKVxuICAgICAgLmpvaW4oJywgJykgPz8gJyc7XG4gIGNvbnN0IG5hbWVzID0gaW5mby5uYW1lcz8ubGVuZ3RoID8gaW5mby5uYW1lcy5qb2luKCcsICcpIDogJy0nO1xuICBjb25zdCBpbml0aWFsID0gISFpbmZvLmluaXRpYWw7XG5cbiAgcmV0dXJuIHtcbiAgICBpbml0aWFsLFxuICAgIHN0YXRzOiBbZmlsZXMsIG5hbWVzLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVdLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShcbiAgZGF0YTogQnVuZGxlU3RhdHNbXSxcbiAgY29sb3JzOiBib29sZWFuLFxuICBzaG93VG90YWxTaXplOiBib29sZWFuLFxuICBzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplOiBib29sZWFuLFxuICBidWRnZXRGYWlsdXJlcz86IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGcgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5ncmVlbkJyaWdodCh4KSA6IHgpO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuY3lhbkJyaWdodCh4KSA6IHgpO1xuICBjb25zdCByID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVkQnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IHkgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy55ZWxsb3dCcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgYm9sZCA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmJvbGQoeCkgOiB4KTtcbiAgY29uc3QgZGltID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuZGltKHgpIDogeCk7XG5cbiAgY29uc3QgZ2V0U2l6ZUNvbG9yID0gKG5hbWU6IHN0cmluZywgZmlsZT86IHN0cmluZywgZGVmYXVsdENvbG9yID0gYykgPT4ge1xuICAgIGNvbnN0IHNldmVyaXR5ID0gYnVkZ2V0cy5nZXQobmFtZSkgfHwgKGZpbGUgJiYgYnVkZ2V0cy5nZXQoZmlsZSkpO1xuICAgIHN3aXRjaCAoc2V2ZXJpdHkpIHtcbiAgICAgIGNhc2UgJ3dhcm5pbmcnOlxuICAgICAgICByZXR1cm4geTtcbiAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgcmV0dXJuIHI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gZGVmYXVsdENvbG9yO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjaGFuZ2VkRW50cnlDaHVua3NTdGF0czogQnVuZGxlU3RhdHNEYXRhW10gPSBbXTtcbiAgY29uc3QgY2hhbmdlZExhenlDaHVua3NTdGF0czogQnVuZGxlU3RhdHNEYXRhW10gPSBbXTtcblxuICBsZXQgaW5pdGlhbFRvdGFsUmF3U2l6ZSA9IDA7XG4gIGxldCBpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG5cbiAgY29uc3QgYnVkZ2V0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGlmIChidWRnZXRGYWlsdXJlcykge1xuICAgIGZvciAoY29uc3QgeyBsYWJlbCwgc2V2ZXJpdHkgfSBvZiBidWRnZXRGYWlsdXJlcykge1xuICAgICAgLy8gSW4gc29tZSBjYXNlcyBhIGZpbGUgY2FuIGhhdmUgbXVsdGlwbGUgYnVkZ2V0IGZhaWx1cmVzLlxuICAgICAgLy8gRmF2b3IgZXJyb3IuXG4gICAgICBpZiAobGFiZWwgJiYgKCFidWRnZXRzLmhhcyhsYWJlbCkgfHwgYnVkZ2V0cy5nZXQobGFiZWwpID09PSAnd2FybmluZycpKSB7XG4gICAgICAgIGJ1ZGdldHMuc2V0KGxhYmVsLCBzZXZlcml0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB7IGluaXRpYWwsIHN0YXRzIH0gb2YgZGF0YSkge1xuICAgIGNvbnN0IFtmaWxlcywgbmFtZXMsIHJhd1NpemUsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZV0gPSBzdGF0cztcbiAgICBjb25zdCBnZXRSYXdTaXplQ29sb3IgPSBnZXRTaXplQ29sb3IobmFtZXMsIGZpbGVzKTtcbiAgICBsZXQgZGF0YTogQnVuZGxlU3RhdHNEYXRhO1xuXG4gICAgaWYgKHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemUpIHtcbiAgICAgIGRhdGEgPSBbXG4gICAgICAgIGcoZmlsZXMpLFxuICAgICAgICBuYW1lcyxcbiAgICAgICAgZ2V0UmF3U2l6ZUNvbG9yKHR5cGVvZiByYXdTaXplID09PSAnbnVtYmVyJyA/IGZvcm1hdFNpemUocmF3U2l6ZSkgOiByYXdTaXplKSxcbiAgICAgICAgYyhcbiAgICAgICAgICB0eXBlb2YgZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgPyBmb3JtYXRTaXplKGVzdGltYXRlZFRyYW5zZmVyU2l6ZSlcbiAgICAgICAgICAgIDogZXN0aW1hdGVkVHJhbnNmZXJTaXplLFxuICAgICAgICApLFxuICAgICAgXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IFtcbiAgICAgICAgZyhmaWxlcyksXG4gICAgICAgIG5hbWVzLFxuICAgICAgICBnZXRSYXdTaXplQ29sb3IodHlwZW9mIHJhd1NpemUgPT09ICdudW1iZXInID8gZm9ybWF0U2l6ZShyYXdTaXplKSA6IHJhd1NpemUpLFxuICAgICAgICAnJyxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgaWYgKGluaXRpYWwpIHtcbiAgICAgIGNoYW5nZWRFbnRyeUNodW5rc1N0YXRzLnB1c2goZGF0YSk7XG4gICAgICBpZiAodHlwZW9mIHJhd1NpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGluaXRpYWxUb3RhbFJhd1NpemUgKz0gcmF3U2l6ZTtcbiAgICAgIH1cbiAgICAgIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplICYmIHR5cGVvZiBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGlmIChpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplICs9IGVzdGltYXRlZFRyYW5zZmVyU2l6ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY2hhbmdlZExhenlDaHVua3NTdGF0cy5wdXNoKGRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGJ1bmRsZUluZm86IChzdHJpbmcgfCBudW1iZXIpW11bXSA9IFtdO1xuICBjb25zdCBiYXNlVGl0bGVzID0gWydOYW1lcycsICdSYXcgU2l6ZSddO1xuICBjb25zdCB0YWJsZUFsaWduOiAoJ2wnIHwgJ3InKVtdID0gWydsJywgJ2wnLCAnciddO1xuXG4gIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplKSB7XG4gICAgYmFzZVRpdGxlcy5wdXNoKCdFc3RpbWF0ZWQgVHJhbnNmZXIgU2l6ZScpO1xuICAgIHRhYmxlQWxpZ24ucHVzaCgncicpO1xuICB9XG5cbiAgLy8gRW50cnkgY2h1bmtzXG4gIGlmIChjaGFuZ2VkRW50cnlDaHVua3NTdGF0cy5sZW5ndGgpIHtcbiAgICBidW5kbGVJbmZvLnB1c2goWydJbml0aWFsIENodW5rIEZpbGVzJywgLi4uYmFzZVRpdGxlc10ubWFwKGJvbGQpLCAuLi5jaGFuZ2VkRW50cnlDaHVua3NTdGF0cyk7XG5cbiAgICBpZiAoc2hvd1RvdGFsU2l6ZSkge1xuICAgICAgYnVuZGxlSW5mby5wdXNoKFtdKTtcblxuICAgICAgY29uc3QgaW5pdGlhbFNpemVUb3RhbENvbG9yID0gZ2V0U2l6ZUNvbG9yKCdidW5kbGUgaW5pdGlhbCcsIHVuZGVmaW5lZCwgKHgpID0+IHgpO1xuICAgICAgY29uc3QgdG90YWxTaXplRWxlbWVudHMgPSBbXG4gICAgICAgICcgJyxcbiAgICAgICAgJ0luaXRpYWwgVG90YWwnLFxuICAgICAgICBpbml0aWFsU2l6ZVRvdGFsQ29sb3IoZm9ybWF0U2l6ZShpbml0aWFsVG90YWxSYXdTaXplKSksXG4gICAgICBdO1xuICAgICAgaWYgKHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemUpIHtcbiAgICAgICAgdG90YWxTaXplRWxlbWVudHMucHVzaChcbiAgICAgICAgICB0eXBlb2YgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgPyBmb3JtYXRTaXplKGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSlcbiAgICAgICAgICAgIDogJy0nLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgYnVuZGxlSW5mby5wdXNoKHRvdGFsU2l6ZUVsZW1lbnRzLm1hcChib2xkKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU2VwZXJhdG9yXG4gIGlmIChjaGFuZ2VkRW50cnlDaHVua3NTdGF0cy5sZW5ndGggJiYgY2hhbmdlZExhenlDaHVua3NTdGF0cy5sZW5ndGgpIHtcbiAgICBidW5kbGVJbmZvLnB1c2goW10pO1xuICB9XG5cbiAgLy8gTGF6eSBjaHVua3NcbiAgaWYgKGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMubGVuZ3RoKSB7XG4gICAgYnVuZGxlSW5mby5wdXNoKFsnTGF6eSBDaHVuayBGaWxlcycsIC4uLmJhc2VUaXRsZXNdLm1hcChib2xkKSwgLi4uY2hhbmdlZExhenlDaHVua3NTdGF0cyk7XG4gIH1cblxuICByZXR1cm4gdGV4dFRhYmxlKGJ1bmRsZUluZm8sIHtcbiAgICBoc2VwOiBkaW0oJyB8ICcpLFxuICAgIHN0cmluZ0xlbmd0aDogKHMpID0+IHJlbW92ZUNvbG9yKHMpLmxlbmd0aCxcbiAgICBhbGlnbjogdGFibGVBbGlnbixcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQnVpbGRTdGF0cyhoYXNoOiBzdHJpbmcsIHRpbWU6IG51bWJlciwgY29sb3JzOiBib29sZWFuKTogc3RyaW5nIHtcbiAgY29uc3QgdyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmJvbGQud2hpdGUoeCkgOiB4KTtcblxuICByZXR1cm4gYEJ1aWxkIGF0OiAke3cobmV3IERhdGUoKS50b0lTT1N0cmluZygpKX0gLSBIYXNoOiAke3coaGFzaCl9IC0gVGltZTogJHt3KCcnICsgdGltZSl9bXNgO1xufVxuXG4vLyBXZSB1c2UgdGhpcyBjYWNoZSBiZWNhdXNlIHdlIGNhbiBoYXZlIG11bHRpcGxlIGJ1aWxkZXJzIHJ1bm5pbmcgaW4gdGhlIHNhbWUgcHJvY2Vzcyxcbi8vIHdoZXJlIGVhY2ggYnVpbGRlciBoYXMgZGlmZmVyZW50IG91dHB1dCBwYXRoLlxuXG4vLyBJZGVhbGx5LCB3ZSBzaG91bGQgY3JlYXRlIHRoZSBsb2dnaW5nIGNhbGxiYWNrIGFzIGEgZmFjdG9yeSwgYnV0IHRoYXQgd291bGQgbmVlZCBhIHJlZmFjdG9yaW5nLlxuY29uc3QgcnVuc0NhY2hlID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbmZ1bmN0aW9uIHN0YXRzVG9TdHJpbmcoXG4gIGpzb246IFN0YXRzQ29tcGlsYXRpb24sXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIHN0YXRzQ29uZmlnOiBhbnksXG4gIGJ1ZGdldEZhaWx1cmVzPzogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdLFxuKTogc3RyaW5nIHtcbiAgaWYgKCFqc29uLmNodW5rcz8ubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBycyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0KHgpIDogeCk7XG5cbiAgY29uc3QgY2hhbmdlZENodW5rc1N0YXRzOiBCdW5kbGVTdGF0c1tdID0gW107XG4gIGxldCB1bmNoYW5nZWRDaHVua051bWJlciA9IDA7XG4gIGxldCBoYXNFc3RpbWF0ZWRUcmFuc2ZlclNpemVzID0gZmFsc2U7XG5cbiAgY29uc3QgaXNGaXJzdFJ1biA9ICFydW5zQ2FjaGUuaGFzKGpzb24ub3V0cHV0UGF0aCB8fCAnJyk7XG5cbiAgZm9yIChjb25zdCBjaHVuayBvZiBqc29uLmNodW5rcykge1xuICAgIC8vIER1cmluZyBmaXJzdCBidWlsZCB3ZSB3YW50IHRvIGRpc3BsYXkgdW5jaGFuZ2VkIGNodW5rc1xuICAgIC8vIGJ1dCB1bmNoYW5nZWQgY2FjaGVkIGNodW5rcyBhcmUgYWx3YXlzIG1hcmtlZCBhcyBub3QgcmVuZGVyZWQuXG4gICAgaWYgKCFpc0ZpcnN0UnVuICYmICFjaHVuay5yZW5kZXJlZCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgYXNzZXRzID0ganNvbi5hc3NldHM/LmZpbHRlcigoYXNzZXQpID0+IGNodW5rLmZpbGVzPy5pbmNsdWRlcyhhc3NldC5uYW1lKSk7XG4gICAgbGV0IHJhd1NpemUgPSAwO1xuICAgIGxldCBlc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG4gICAgaWYgKGFzc2V0cykge1xuICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgaWYgKGFzc2V0Lm5hbWUuZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmF3U2l6ZSArPSBhc3NldC5zaXplO1xuXG4gICAgICAgIGlmICh0eXBlb2YgYXNzZXQuaW5mby5lc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgaWYgKGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPSAwO1xuICAgICAgICAgICAgaGFzRXN0aW1hdGVkVHJhbnNmZXJTaXplcyA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSArPSBhc3NldC5pbmZvLmVzdGltYXRlZFRyYW5zZmVyU2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjaGFuZ2VkQ2h1bmtzU3RhdHMucHVzaChnZW5lcmF0ZUJ1bmRsZVN0YXRzKHsgLi4uY2h1bmssIHJhd1NpemUsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSB9KSk7XG4gIH1cbiAgdW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPSBqc29uLmNodW5rcy5sZW5ndGggLSBjaGFuZ2VkQ2h1bmtzU3RhdHMubGVuZ3RoO1xuXG4gIHJ1bnNDYWNoZS5hZGQoanNvbi5vdXRwdXRQYXRoIHx8ICcnKTtcblxuICAvLyBTb3J0IGNodW5rcyBieSBzaXplIGluIGRlc2NlbmRpbmcgb3JkZXJcbiAgY2hhbmdlZENodW5rc1N0YXRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICBpZiAoYS5zdGF0c1syXSA+IGIuc3RhdHNbMl0pIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYS5zdGF0c1syXSA8IGIuc3RhdHNbMl0pIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9KTtcblxuICBjb25zdCBzdGF0c1RhYmxlID0gZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUoXG4gICAgY2hhbmdlZENodW5rc1N0YXRzLFxuICAgIGNvbG9ycyxcbiAgICB1bmNoYW5nZWRDaHVua051bWJlciA9PT0gMCxcbiAgICBoYXNFc3RpbWF0ZWRUcmFuc2ZlclNpemVzLFxuICAgIGJ1ZGdldEZhaWx1cmVzLFxuICApO1xuXG4gIC8vIEluIHNvbWUgY2FzZXMgd2UgZG8gdGhpbmdzIG91dHNpZGUgb2Ygd2VicGFjayBjb250ZXh0XG4gIC8vIFN1Y2ggdXMgaW5kZXggZ2VuZXJhdGlvbiwgc2VydmljZSB3b3JrZXIgYXVnbWVudGF0aW9uIGV0Yy4uLlxuICAvLyBUaGlzIHdpbGwgY29ycmVjdCB0aGUgdGltZSBhbmQgaW5jbHVkZSB0aGVzZS5cbiAgbGV0IHRpbWUgPSAwO1xuICBpZiAoanNvbi5idWlsdEF0ICE9PSB1bmRlZmluZWQgJiYganNvbi50aW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICB0aW1lID0gRGF0ZS5ub3coKSAtIGpzb24uYnVpbHRBdCArIGpzb24udGltZTtcbiAgfVxuXG4gIGlmICh1bmNoYW5nZWRDaHVua051bWJlciA+IDApIHtcbiAgICByZXR1cm4gKFxuICAgICAgJ1xcbicgK1xuICAgICAgcnModGFncy5zdHJpcEluZGVudHNgXG4gICAgICAke3N0YXRzVGFibGV9XG5cbiAgICAgICR7dW5jaGFuZ2VkQ2h1bmtOdW1iZXJ9IHVuY2hhbmdlZCBjaHVua3NcblxuICAgICAgJHtnZW5lcmF0ZUJ1aWxkU3RhdHMoanNvbi5oYXNoIHx8ICcnLCB0aW1lLCBjb2xvcnMpfVxuICAgICAgYClcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoXG4gICAgICAnXFxuJyArXG4gICAgICBycyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICR7c3RhdHNUYWJsZX1cblxuICAgICAgJHtnZW5lcmF0ZUJ1aWxkU3RhdHMoanNvbi5oYXNoIHx8ICcnLCB0aW1lLCBjb2xvcnMpfVxuICAgICAgYClcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c1dhcm5pbmdzVG9TdHJpbmcoXG4gIGpzb246IFN0YXRzQ29tcGlsYXRpb24sXG4gIHN0YXRzQ29uZmlnOiBXZWJwYWNrU3RhdHNPcHRpb25zLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQuY3lhbih4KSA6IHgpO1xuICBjb25zdCB5ID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93KHgpIDogeCk7XG4gIGNvbnN0IHliID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93QnJpZ2h0KHgpIDogeCk7XG5cbiAgY29uc3Qgd2FybmluZ3MgPSBqc29uLndhcm5pbmdzID8gWy4uLmpzb24ud2FybmluZ3NdIDogW107XG4gIGlmIChqc29uLmNoaWxkcmVuKSB7XG4gICAgd2FybmluZ3MucHVzaCguLi5qc29uLmNoaWxkcmVuLm1hcCgoYykgPT4gYy53YXJuaW5ncyA/PyBbXSkucmVkdWNlKChhLCBiKSA9PiBbLi4uYSwgLi4uYl0sIFtdKSk7XG4gIH1cblxuICBsZXQgb3V0cHV0ID0gJyc7XG4gIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgIGlmICh0eXBlb2Ygd2FybmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG91dHB1dCArPSB5YihgV2FybmluZzogJHt3YXJuaW5nfVxcblxcbmApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmaWxlID0gd2FybmluZy5maWxlIHx8IHdhcm5pbmcubW9kdWxlTmFtZTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIG91dHB1dCArPSBjKGZpbGUpO1xuICAgICAgICBpZiAod2FybmluZy5sb2MpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gJzonICsgeWIod2FybmluZy5sb2MpO1xuICAgICAgICB9XG4gICAgICAgIG91dHB1dCArPSAnIC0gJztcbiAgICAgIH1cbiAgICAgIGlmICghL153YXJuaW5nL2kudGVzdCh3YXJuaW5nLm1lc3NhZ2UpKSB7XG4gICAgICAgIG91dHB1dCArPSB5KCdXYXJuaW5nOiAnKTtcbiAgICAgIH1cbiAgICAgIG91dHB1dCArPSBgJHt3YXJuaW5nLm1lc3NhZ2V9XFxuXFxuYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0ID8gJ1xcbicgKyBvdXRwdXQgOiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0Vycm9yc1RvU3RyaW5nKFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICBzdGF0c0NvbmZpZzogV2VicGFja1N0YXRzT3B0aW9ucyxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGNvbG9ycyA9IHN0YXRzQ29uZmlnLmNvbG9ycztcbiAgY29uc3QgYyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0LmN5YW4oeCkgOiB4KTtcbiAgY29uc3QgeWIgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC55ZWxsb3dCcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgciA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0LnJlZEJyaWdodCh4KSA6IHgpO1xuXG4gIGNvbnN0IGVycm9ycyA9IGpzb24uZXJyb3JzID8gWy4uLmpzb24uZXJyb3JzXSA6IFtdO1xuICBpZiAoanNvbi5jaGlsZHJlbikge1xuICAgIGVycm9ycy5wdXNoKC4uLmpzb24uY2hpbGRyZW4ubWFwKChjKSA9PiBjPy5lcnJvcnMgfHwgW10pLnJlZHVjZSgoYSwgYikgPT4gWy4uLmEsIC4uLmJdLCBbXSkpO1xuICB9XG5cbiAgbGV0IG91dHB1dCA9ICcnO1xuICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICBvdXRwdXQgKz0gcihgRXJyb3I6ICR7ZXJyb3J9XFxuXFxuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBmaWxlID0gZXJyb3IuZmlsZSB8fCBlcnJvci5tb2R1bGVOYW1lO1xuICAgICAgLy8gQ2xlYW4gdXAgZXJyb3IgcGF0aHNcbiAgICAgIC8vIEV4OiAuL3NyYy9hcHAvc3R5bGVzLnNjc3Mud2VicGFja1tqYXZhc2NyaXB0L2F1dG9dIT0hLi9ub2RlX21vZHVsZXMvY3NzLWxvYWRlci9kaXN0L2Nqcy5qcy4uLi5cbiAgICAgIC8vIHRvIC4vc3JjL2FwcC9zdHlsZXMuc2Nzcy53ZWJwYWNrXG4gICAgICBpZiAoZmlsZSAmJiAhc3RhdHNDb25maWcuZXJyb3JEZXRhaWxzKSB7XG4gICAgICAgIGNvbnN0IHdlYnBhY2tQYXRoSW5kZXggPSBmaWxlLmluZGV4T2YoJy53ZWJwYWNrWycpO1xuICAgICAgICBpZiAod2VicGFja1BhdGhJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBmaWxlID0gZmlsZS5zdWJzdHJpbmcoMCwgd2VicGFja1BhdGhJbmRleCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgb3V0cHV0ICs9IGMoZmlsZSk7XG4gICAgICAgIGlmIChlcnJvci5sb2MpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gJzonICsgeWIoZXJyb3IubG9jKTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQgKz0gJyAtICc7XG4gICAgICB9XG5cbiAgICAgIC8vIEluIG1vc3QgY2FzZXMgd2VicGFjayB3aWxsIGFkZCBzdGFjayB0cmFjZXMgdG8gZXJyb3IgbWVzc2FnZXMuXG4gICAgICAvLyBUaGlzIGJlbG93IGNsZWFucyB1cCB0aGUgZXJyb3IgZnJvbSBzdGFja3MuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzE1OTgwXG4gICAgICBjb25zdCBtZXNzYWdlID0gc3RhdHNDb25maWcuZXJyb3JTdGFja1xuICAgICAgICA/IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgOiAvW1xcc1xcU10rPyg/PVtcXG5cXHNdK2F0KS8uZXhlYyhlcnJvci5tZXNzYWdlKT8uWzBdID8/IGVycm9yLm1lc3NhZ2U7XG5cbiAgICAgIGlmICghL15lcnJvci9pLnRlc3QobWVzc2FnZSkpIHtcbiAgICAgICAgb3V0cHV0ICs9IHIoJ0Vycm9yOiAnKTtcbiAgICAgIH1cbiAgICAgIG91dHB1dCArPSBgJHttZXNzYWdlfVxcblxcbmA7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG91dHB1dCA/ICdcXG4nICsgb3V0cHV0IDogb3V0cHV0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RhdHNIYXNFcnJvcnMoanNvbjogU3RhdHNDb21waWxhdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gISEoanNvbi5lcnJvcnM/Lmxlbmd0aCB8fCBqc29uLmNoaWxkcmVuPy5zb21lKChjKSA9PiBjLmVycm9ycz8ubGVuZ3RoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0hhc1dhcm5pbmdzKGpzb246IFN0YXRzQ29tcGlsYXRpb24pOiBib29sZWFuIHtcbiAgcmV0dXJuICEhKGpzb24ud2FybmluZ3M/Lmxlbmd0aCB8fCBqc29uLmNoaWxkcmVuPy5zb21lKChjKSA9PiBjLndhcm5pbmdzPy5sZW5ndGgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2soXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2sge1xuICBjb25zdCB7IHZlcmJvc2UgPSBmYWxzZSwgc2NyaXB0cyA9IFtdLCBzdHlsZXMgPSBbXSB9ID0gb3B0aW9ucztcbiAgY29uc3QgZXh0cmFFbnRyeVBvaW50cyA9IFtcbiAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHN0eWxlcywgJ3N0eWxlcycpLFxuICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc2NyaXB0cywgJ3NjcmlwdHMnKSxcbiAgXTtcblxuICByZXR1cm4gKHN0YXRzLCBjb25maWcpID0+IHtcbiAgICBpZiAodmVyYm9zZSkge1xuICAgICAgbG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmF3U3RhdHMgPSBzdGF0cy50b0pzb24oZ2V0U3RhdHNPcHRpb25zKGZhbHNlKSk7XG4gICAgY29uc3Qgd2VicGFja1N0YXRzID0ge1xuICAgICAgLi4ucmF3U3RhdHMsXG4gICAgICBjaHVua3M6IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwocmF3U3RhdHMsIGV4dHJhRW50cnlQb2ludHMpLFxuICAgIH07XG5cbiAgICB3ZWJwYWNrU3RhdHNMb2dnZXIobG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3ZWJwYWNrU3RhdHNMb2dnZXIoXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4gIGpzb246IFN0YXRzQ29tcGlsYXRpb24sXG4gIGNvbmZpZzogQ29uZmlndXJhdGlvbixcbiAgYnVkZ2V0RmFpbHVyZXM/OiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10sXG4pOiB2b2lkIHtcbiAgbG9nZ2VyLmluZm8oc3RhdHNUb1N0cmluZyhqc29uLCBjb25maWcuc3RhdHMsIGJ1ZGdldEZhaWx1cmVzKSk7XG5cbiAgaWYgKHR5cGVvZiBjb25maWcuc3RhdHMgIT09ICdvYmplY3QnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFdlYnBhY2sgc3RhdHMgY29uZmlndXJhdGlvbi4nKTtcbiAgfVxuXG4gIGlmIChzdGF0c0hhc1dhcm5pbmdzKGpzb24pKSB7XG4gICAgbG9nZ2VyLndhcm4oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICB9XG5cbiAgaWYgKHN0YXRzSGFzRXJyb3JzKGpzb24pKSB7XG4gICAgbG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gIH1cbn1cbiJdfQ==