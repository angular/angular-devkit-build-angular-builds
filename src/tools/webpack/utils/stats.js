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
exports.webpackStatsLogger = exports.generateBuildEventStats = exports.createWebpackLoggingCallback = exports.statsHasWarnings = exports.statsHasErrors = exports.statsErrorsToString = exports.statsWarningsToString = exports.generateBuildStatsTable = exports.generateEsbuildBuildStatsTable = exports.formatSize = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const path = __importStar(require("node:path"));
const utils_1 = require("../../../utils");
const color_1 = require("../../../utils/color");
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
function getBuildDuration(webpackStats) {
    (0, node_assert_1.default)(webpackStats.builtAt, 'buildAt cannot be undefined');
    (0, node_assert_1.default)(webpackStats.time, 'time cannot be undefined');
    return Date.now() - webpackStats.builtAt + webpackStats.time;
}
function generateBundleStats(info) {
    const rawSize = typeof info.rawSize === 'number' ? info.rawSize : '-';
    const estimatedTransferSize = typeof info.estimatedTransferSize === 'number' ? info.estimatedTransferSize : '-';
    const files = info.files
        ?.filter((f) => !f.endsWith('.map'))
        .map((f) => path.basename(f))
        .join(', ') ?? '';
    const names = info.names?.length ? info.names.join(', ') : '-';
    const initial = !!info.initial;
    return {
        initial,
        stats: [files, names, rawSize, estimatedTransferSize],
    };
}
function generateEsbuildBuildStatsTable([browserStats, serverStats], colors, showTotalSize, showEstimatedTransferSize, budgetFailures, verbose) {
    const bundleInfo = generateBuildStatsData(browserStats, colors, showTotalSize, showEstimatedTransferSize, budgetFailures, verbose);
    if (serverStats.length) {
        const m = (x) => (colors ? color_1.colors.magenta(x) : x);
        if (browserStats.length) {
            bundleInfo.unshift([m('Browser bundles')]);
            // Add seperators between browser and server logs
            bundleInfo.push([], []);
        }
        bundleInfo.push([m('Server bundles')], ...generateBuildStatsData(serverStats, colors, false, false, undefined, verbose));
    }
    return generateTableText(bundleInfo, colors);
}
exports.generateEsbuildBuildStatsTable = generateEsbuildBuildStatsTable;
function generateBuildStatsTable(data, colors, showTotalSize, showEstimatedTransferSize, budgetFailures) {
    const bundleInfo = generateBuildStatsData(data, colors, showTotalSize, showEstimatedTransferSize, budgetFailures, true);
    return generateTableText(bundleInfo, colors);
}
exports.generateBuildStatsTable = generateBuildStatsTable;
function generateBuildStatsData(data, colors, showTotalSize, showEstimatedTransferSize, budgetFailures, verbose) {
    if (data.length === 0) {
        return [];
    }
    const g = (x) => (colors ? color_1.colors.green(x) : x);
    const c = (x) => (colors ? color_1.colors.cyan(x) : x);
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
    let changedLazyChunksCount = 0;
    let initialTotalEstimatedTransferSize;
    const maxLazyChunksWithoutBudgetFailures = 15;
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
    // Sort descending by raw size
    data.sort((a, b) => {
        if (a.stats[2] > b.stats[2]) {
            return -1;
        }
        if (a.stats[2] < b.stats[2]) {
            return 1;
        }
        return 0;
    });
    for (const { initial, stats } of data) {
        const [files, names, rawSize, estimatedTransferSize] = stats;
        if (!initial &&
            !verbose &&
            changedLazyChunksStats.length >= maxLazyChunksWithoutBudgetFailures &&
            !budgets.has(names) &&
            !budgets.has(files)) {
            // Limit the number of lazy chunks displayed in the stats table when there is no budget failure and not in verbose mode.
            changedLazyChunksCount++;
            continue;
        }
        const getRawSizeColor = getSizeColor(names, files);
        let data;
        if (showEstimatedTransferSize) {
            data = [
                g(files),
                dim(names),
                getRawSizeColor(typeof rawSize === 'number' ? formatSize(rawSize) : rawSize),
                c(typeof estimatedTransferSize === 'number'
                    ? formatSize(estimatedTransferSize)
                    : estimatedTransferSize),
            ];
        }
        else {
            data = [
                g(files),
                dim(names),
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
            changedLazyChunksCount++;
        }
    }
    const bundleInfo = [];
    const baseTitles = ['Names', 'Raw size'];
    if (showEstimatedTransferSize) {
        baseTitles.push('Estimated transfer size');
    }
    // Entry chunks
    if (changedEntryChunksStats.length) {
        bundleInfo.push(['Initial chunk files', ...baseTitles].map(bold), ...changedEntryChunksStats);
        if (showTotalSize) {
            const initialSizeTotalColor = getSizeColor('bundle initial', undefined, (x) => x);
            const totalSizeElements = [
                ' ',
                'Initial total',
                initialSizeTotalColor(formatSize(initialTotalRawSize)),
            ];
            if (showEstimatedTransferSize) {
                totalSizeElements.push(typeof initialTotalEstimatedTransferSize === 'number'
                    ? formatSize(initialTotalEstimatedTransferSize)
                    : '-');
            }
            bundleInfo.push([], totalSizeElements.map(bold));
        }
    }
    // Seperator
    if (changedEntryChunksStats.length && changedLazyChunksStats.length) {
        bundleInfo.push([]);
    }
    // Lazy chunks
    if (changedLazyChunksStats.length) {
        bundleInfo.push(['Lazy chunk files', ...baseTitles].map(bold), ...changedLazyChunksStats);
        if (changedLazyChunksCount > changedLazyChunksStats.length) {
            bundleInfo.push([
                dim(`...and ${changedLazyChunksCount - changedLazyChunksStats.length} more lazy chunks files. ` +
                    'Use "--verbose" to show all the files.'),
            ]);
        }
    }
    return bundleInfo;
}
function generateTableText(bundleInfo, colors) {
    const skipText = (value) => value.includes('...and ');
    const longest = [];
    for (const item of bundleInfo) {
        for (let i = 0; i < item.length; i++) {
            if (item[i] === undefined) {
                continue;
            }
            const currentItem = item[i].toString();
            if (skipText(currentItem)) {
                continue;
            }
            const currentLongest = (longest[i] ??= 0);
            const currentItemLength = (0, color_1.removeColor)(currentItem).length;
            if (currentLongest < currentItemLength) {
                longest[i] = currentItemLength;
            }
        }
    }
    const seperator = colors ? color_1.colors.dim(' | ') : ' | ';
    const outputTable = [];
    for (const item of bundleInfo) {
        for (let i = 0; i < longest.length; i++) {
            if (item[i] === undefined) {
                continue;
            }
            const currentItem = item[i].toString();
            if (skipText(currentItem)) {
                continue;
            }
            const currentItemLength = (0, color_1.removeColor)(currentItem).length;
            const stringPad = ' '.repeat(longest[i] - currentItemLength);
            // Values in columns at index 2 and 3 (Raw and Estimated sizes) are always right aligned.
            item[i] = i >= 2 ? stringPad + currentItem : currentItem + stringPad;
        }
        outputTable.push(item.join(seperator));
    }
    return outputTable.join('\n');
}
// We use this cache because we can have multiple builders running in the same process,
// where each builder has different output path.
// Ideally, we should create the logging callback as a factory, but that would need a refactoring.
const runsCache = new Set();
function statsToString(json, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
statsConfig, budgetFailures) {
    if (!json.chunks?.length) {
        return '';
    }
    const colors = statsConfig.colors;
    const rs = (x) => (colors ? color_1.colors.reset(x) : x);
    const w = (x) => (colors ? color_1.colors.bold.white(x) : x);
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
        const assets = json.assets?.filter((asset) => chunk.files?.includes(asset.name));
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
    const statsTable = generateBuildStatsTable(changedChunksStats, colors, unchangedChunkNumber === 0, hasEstimatedTransferSizes, budgetFailures);
    // In some cases we do things outside of webpack context
    // Such us index generation, service worker augmentation etc...
    // This will correct the time and include these.
    const time = getBuildDuration(json);
    return rs(`\n${statsTable}\n\n` +
        (unchangedChunkNumber > 0 ? `${unchangedChunkNumber} unchanged chunks\n\n` : '') +
        `Build at: ${w(new Date().toISOString())} - Hash: ${w(json.hash || '')} - Time: ${w('' + time)}ms`);
}
function statsWarningsToString(json, statsConfig) {
    const colors = statsConfig.colors;
    const c = (x) => (colors ? color_1.colors.reset.cyan(x) : x);
    const y = (x) => (colors ? color_1.colors.reset.yellow(x) : x);
    const yb = (x) => (colors ? color_1.colors.reset.yellowBright(x) : x);
    const warnings = json.warnings ? [...json.warnings] : [];
    if (json.children) {
        warnings.push(...json.children.map((c) => c.warnings ?? []).reduce((a, b) => [...a, ...b], []));
    }
    let output = '';
    for (const warning of warnings) {
        if (typeof warning === 'string') {
            output += yb(`Warning: ${warning}\n\n`);
        }
        else {
            let file = warning.file || warning.moduleName;
            // Clean up warning paths
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
    const colors = statsConfig.colors;
    const c = (x) => (colors ? color_1.colors.reset.cyan(x) : x);
    const yb = (x) => (colors ? color_1.colors.reset.yellowBright(x) : x);
    const r = (x) => (colors ? color_1.colors.reset.redBright(x) : x);
    const errors = json.errors ? [...json.errors] : [];
    if (json.children) {
        errors.push(...json.children.map((c) => c?.errors || []).reduce((a, b) => [...a, ...b], []));
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
            const index = error.message.search(/[\n\s]+at /);
            const message = statsConfig.errorStack || index === -1 ? error.message : error.message.substring(0, index);
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
    return !!(json.errors?.length || json.children?.some((c) => c.errors?.length));
}
exports.statsHasErrors = statsHasErrors;
function statsHasWarnings(json) {
    return !!(json.warnings?.length || json.children?.some((c) => c.warnings?.length));
}
exports.statsHasWarnings = statsHasWarnings;
function createWebpackLoggingCallback(options, logger) {
    const { verbose = false, scripts = [], styles = [] } = options;
    const extraEntryPoints = [
        ...(0, helpers_1.normalizeExtraEntryPoints)(styles, 'styles'),
        ...(0, helpers_1.normalizeExtraEntryPoints)(scripts, 'scripts'),
    ];
    return (stats, config) => {
        if (verbose && config.stats !== false) {
            const statsOptions = config.stats === true ? undefined : config.stats;
            logger.info(stats.toString(statsOptions));
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
function generateBuildEventStats(webpackStats, browserBuilderOptions) {
    const { chunks = [], assets = [] } = webpackStats;
    let jsSizeInBytes = 0;
    let cssSizeInBytes = 0;
    let initialChunksCount = 0;
    let ngComponentCount = 0;
    let changedChunksCount = 0;
    const allChunksCount = chunks.length;
    const isFirstRun = !runsCache.has(webpackStats.outputPath || '');
    const chunkFiles = new Set();
    for (const chunk of chunks) {
        if (!isFirstRun && chunk.rendered) {
            changedChunksCount++;
        }
        if (chunk.initial) {
            initialChunksCount++;
        }
        for (const file of chunk.files ?? []) {
            chunkFiles.add(file);
        }
    }
    for (const asset of assets) {
        if (asset.name.endsWith('.map') || !chunkFiles.has(asset.name)) {
            continue;
        }
        if (asset.name.endsWith('.js')) {
            jsSizeInBytes += asset.size;
            ngComponentCount += asset.info.ngComponentCount ?? 0;
        }
        else if (asset.name.endsWith('.css')) {
            cssSizeInBytes += asset.size;
        }
    }
    return {
        optimization: !!(0, utils_1.normalizeOptimization)(browserBuilderOptions.optimization).scripts,
        aot: browserBuilderOptions.aot !== false,
        allChunksCount,
        lazyChunksCount: allChunksCount - initialChunksCount,
        initialChunksCount,
        changedChunksCount,
        durationInMs: getBuildDuration(webpackStats),
        cssSizeInBytes,
        jsSizeInBytes,
        ngComponentCount,
    };
}
exports.generateBuildEventStats = generateBuildEventStats;
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
