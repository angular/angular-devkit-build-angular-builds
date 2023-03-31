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
exports.webpackStatsLogger = exports.generateBuildEventStats = exports.createWebpackLoggingCallback = exports.statsHasWarnings = exports.statsHasErrors = exports.statsErrorsToString = exports.statsWarningsToString = exports.generateBuildStatsTable = exports.formatSize = void 0;
const core_1 = require("@angular-devkit/core");
const assert_1 = __importDefault(require("assert"));
const path = __importStar(require("path"));
const text_table_1 = __importDefault(require("text-table"));
const utils_1 = require("../../utils");
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
function getBuildDuration(webpackStats) {
    (0, assert_1.default)(webpackStats.builtAt, 'buildAt cannot be undefined');
    (0, assert_1.default)(webpackStats.time, 'time cannot be undefined');
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
exports.generateBuildStatsTable = generateBuildStatsTable;
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
    if (!json.chunks?.length) {
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
    const time = getBuildDuration(json);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3V0aWxzL3N0YXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsK0NBQXFEO0FBQ3JELG9EQUE0QjtBQUM1QiwyQ0FBNkI7QUFDN0IsNERBQW1DO0FBR25DLHVDQUFvRDtBQUVwRCw2Q0FBc0U7QUFDdEUsaURBQTJEO0FBQzNELHVDQUE0RjtBQUU1RixTQUFnQixVQUFVLENBQUMsSUFBWTtJQUNyQyxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7UUFDYixPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELE1BQU0sYUFBYSxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDakQsOEJBQThCO0lBQzlCLE1BQU0sY0FBYyxHQUFHLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTNDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQzFFLENBQUM7QUFaRCxnQ0FZQztBQWFELFNBQVMsZ0JBQWdCLENBQUMsWUFBOEI7SUFDdEQs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LElBQUksQ0FBQyxFQUFFO1FBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3hEO0lBRUQsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDeEIsTUFBTSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDdkQ7QUFDSCxDQUFDO0FBbkJELGdEQW1CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsgbG9nZ2luZywgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdGV4dFRhYmxlIGZyb20gJ3RleHQtdGFibGUnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgU3RhdHNDb21waWxhdGlvbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHQgfSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBjb2xvcnMgYXMgYW5zaUNvbG9ycywgcmVtb3ZlQ29sb3IgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsIH0gZnJvbSAnLi9hc3luYy1jaHVua3MnO1xuaW1wb3J0IHsgV2VicGFja1N0YXRzT3B0aW9ucywgZ2V0U3RhdHNPcHRpb25zLCBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi9oZWxwZXJzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFNpemUoc2l6ZTogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKHNpemUgPD0gMCkge1xuICAgIHJldHVybiAnMCBieXRlcyc7XG4gIH1cblxuICBjb25zdCBhYmJyZXZpYXRpb25zID0gWydieXRlcycsICdrQicsICdNQicsICdHQiddO1xuICBjb25zdCBpbmRleCA9IE1hdGguZmxvb3IoTWF0aC5sb2coc2l6ZSkgLyBNYXRoLmxvZygxMDI0KSk7XG4gIGNvbnN0IHJvdW5kZWRTaXplID0gc2l6ZSAvIE1hdGgucG93KDEwMjQsIGluZGV4KTtcbiAgLy8gYnl0ZXMgZG9uJ3QgaGF2ZSBhIGZyYWN0aW9uXG4gIGNvbnN0IGZyYWN0aW9uRGlnaXRzID0gaW5kZXggPT09IDAgPyAwIDogMjtcblxuICByZXR1cm4gYCR7cm91bmRlZFNpemUudG9GaXhlZChmcmFjdGlvbkRpZ2l0cyl9ICR7YWJicmV2aWF0aW9uc1tpbmRleF19YDtcbn1cblxuZXhwb3J0IHR5cGUgQnVuZGxlU3RhdHNEYXRhID0gW1xuICBmaWxlczogc3RyaW5nLFxuICBuYW1lczogc3RyaW5nLFxuICByYXdTaXplOiBudW1iZXIgfCBzdHJpbmcsXG4gIGVzdGltYXRlZFRyYW5zZmVyU2l6ZTogbnVtYmVyIHwgc3RyaW5nLFxuXTtcbmV4cG9ydCBpbnRlcmZhY2UgQnVuZGxlU3RhdHMge1xuICBpbml0aWFsOiBib29sZWFuO1xuICBzdGF0czogQnVuZGxlU3RhdHNEYXRhO1xufVxuXG5mdW5jdGlvbiBnZXRCdWlsZER1cmF0aW9uKHdlYnBhY2tTdGF0czogU3RhdHNDb21waWxhdGlvbik6IG51bWJlciB7XG4gIGFzc2VydCh3ZWJwYWNrU3RhdHMuYnVpbHRBdCwgJ2J1aWxkQXQgY2Fubm90IGJlIHVuZGVmaW5lZCcpO1xuICBhc3NlcnQod2VicGFja1N0YXRzLnRpbWUsICd0aW1lIGNhbm5vdCBiZSB1bmRlZmluZWQnKTtcblxuICByZXR1cm4gRGF0ZS5ub3coKSAtIHdlYnBhY2tTdGF0cy5idWlsdEF0ICsgd2VicGFja1N0YXRzLnRpbWU7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQnVuZGxlU3RhdHMoaW5mbzoge1xuICByYXdTaXplPzogbnVtYmVyO1xuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemU/OiBudW1iZXI7XG4gIGZpbGVzPzogc3RyaW5nW107XG4gIG5hbWVzPzogc3RyaW5nW107XG4gIGluaXRpYWw/OiBib29sZWFuO1xuICByZW5kZXJlZD86IGJvb2xlYW47XG59KTogQnVuZGxlU3RhdHMge1xuICBjb25zdCByYXdTaXplID0gdHlwZW9mIGluZm8ucmF3U2l6ZSA9PT0gJ251bWJlcicgPyBpbmZvLnJhd1NpemUgOiAnLSc7XG4gIGNvbnN0IGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9XG4gICAgdHlwZW9mIGluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJyA/IGluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplIDogJy0nO1xuICBjb25zdCBmaWxlcyA9XG4gICAgaW5mby5maWxlc1xuICAgICAgPy5maWx0ZXIoKGYpID0+ICFmLmVuZHNXaXRoKCcubWFwJykpXG4gICAgICAubWFwKChmKSA9PiBwYXRoLmJhc2VuYW1lKGYpKVxuICAgICAgLmpvaW4oJywgJykgPz8gJyc7XG4gIGNvbnN0IG5hbWVzID0gaW5mby5uYW1lcz8ubGVuZ3RoID8gaW5mby5uYW1lcy5qb2luKCcsICcpIDogJy0nO1xuICBjb25zdCBpbml0aWFsID0gISFpbmZvLmluaXRpYWw7XG5cbiAgcmV0dXJuIHtcbiAgICBpbml0aWFsLFxuICAgIHN0YXRzOiBbZmlsZXMsIG5hbWVzLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVdLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUoXG4gIGRhdGE6IEJ1bmRsZVN0YXRzW10sXG4gIGNvbG9yczogYm9vbGVhbixcbiAgc2hvd1RvdGFsU2l6ZTogYm9vbGVhbixcbiAgc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZTogYm9vbGVhbixcbiAgYnVkZ2V0RmFpbHVyZXM/OiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10sXG4pOiBzdHJpbmcge1xuICBjb25zdCBnID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuZ3JlZW5CcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgYyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmN5YW5CcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgciA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlZEJyaWdodCh4KSA6IHgpO1xuICBjb25zdCB5ID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMueWVsbG93QnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IGJvbGQgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5ib2xkKHgpIDogeCk7XG4gIGNvbnN0IGRpbSA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmRpbSh4KSA6IHgpO1xuXG4gIGNvbnN0IGdldFNpemVDb2xvciA9IChuYW1lOiBzdHJpbmcsIGZpbGU/OiBzdHJpbmcsIGRlZmF1bHRDb2xvciA9IGMpID0+IHtcbiAgICBjb25zdCBzZXZlcml0eSA9IGJ1ZGdldHMuZ2V0KG5hbWUpIHx8IChmaWxlICYmIGJ1ZGdldHMuZ2V0KGZpbGUpKTtcbiAgICBzd2l0Y2ggKHNldmVyaXR5KSB7XG4gICAgICBjYXNlICd3YXJuaW5nJzpcbiAgICAgICAgcmV0dXJuIHk7XG4gICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgIHJldHVybiByO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGRlZmF1bHRDb2xvcjtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHM6IEJ1bmRsZVN0YXRzRGF0YVtdID0gW107XG4gIGNvbnN0IGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHM6IEJ1bmRsZVN0YXRzRGF0YVtdID0gW107XG5cbiAgbGV0IGluaXRpYWxUb3RhbFJhd1NpemUgPSAwO1xuICBsZXQgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplO1xuXG4gIGNvbnN0IGJ1ZGdldHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBpZiAoYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICBmb3IgKGNvbnN0IHsgbGFiZWwsIHNldmVyaXR5IH0gb2YgYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICAgIC8vIEluIHNvbWUgY2FzZXMgYSBmaWxlIGNhbiBoYXZlIG11bHRpcGxlIGJ1ZGdldCBmYWlsdXJlcy5cbiAgICAgIC8vIEZhdm9yIGVycm9yLlxuICAgICAgaWYgKGxhYmVsICYmICghYnVkZ2V0cy5oYXMobGFiZWwpIHx8IGJ1ZGdldHMuZ2V0KGxhYmVsKSA9PT0gJ3dhcm5pbmcnKSkge1xuICAgICAgICBidWRnZXRzLnNldChsYWJlbCwgc2V2ZXJpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgeyBpbml0aWFsLCBzdGF0cyB9IG9mIGRhdGEpIHtcbiAgICBjb25zdCBbZmlsZXMsIG5hbWVzLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVdID0gc3RhdHM7XG4gICAgY29uc3QgZ2V0UmF3U2l6ZUNvbG9yID0gZ2V0U2l6ZUNvbG9yKG5hbWVzLCBmaWxlcyk7XG4gICAgbGV0IGRhdGE6IEJ1bmRsZVN0YXRzRGF0YTtcblxuICAgIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplKSB7XG4gICAgICBkYXRhID0gW1xuICAgICAgICBnKGZpbGVzKSxcbiAgICAgICAgbmFtZXMsXG4gICAgICAgIGdldFJhd1NpemVDb2xvcih0eXBlb2YgcmF3U2l6ZSA9PT0gJ251bWJlcicgPyBmb3JtYXRTaXplKHJhd1NpemUpIDogcmF3U2l6ZSksXG4gICAgICAgIGMoXG4gICAgICAgICAgdHlwZW9mIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcidcbiAgICAgICAgICAgID8gZm9ybWF0U2l6ZShlc3RpbWF0ZWRUcmFuc2ZlclNpemUpXG4gICAgICAgICAgICA6IGVzdGltYXRlZFRyYW5zZmVyU2l6ZSxcbiAgICAgICAgKSxcbiAgICAgIF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEgPSBbXG4gICAgICAgIGcoZmlsZXMpLFxuICAgICAgICBuYW1lcyxcbiAgICAgICAgZ2V0UmF3U2l6ZUNvbG9yKHR5cGVvZiByYXdTaXplID09PSAnbnVtYmVyJyA/IGZvcm1hdFNpemUocmF3U2l6ZSkgOiByYXdTaXplKSxcbiAgICAgICAgJycsXG4gICAgICBdO1xuICAgIH1cblxuICAgIGlmIChpbml0aWFsKSB7XG4gICAgICBjaGFuZ2VkRW50cnlDaHVua3NTdGF0cy5wdXNoKGRhdGEpO1xuICAgICAgaWYgKHR5cGVvZiByYXdTaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBpbml0aWFsVG90YWxSYXdTaXplICs9IHJhd1NpemU7XG4gICAgICB9XG4gICAgICBpZiAoc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZSAmJiB0eXBlb2YgZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSArPSBlc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMucHVzaChkYXRhKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBidW5kbGVJbmZvOiAoc3RyaW5nIHwgbnVtYmVyKVtdW10gPSBbXTtcbiAgY29uc3QgYmFzZVRpdGxlcyA9IFsnTmFtZXMnLCAnUmF3IFNpemUnXTtcbiAgY29uc3QgdGFibGVBbGlnbjogKCdsJyB8ICdyJylbXSA9IFsnbCcsICdsJywgJ3InXTtcblxuICBpZiAoc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZSkge1xuICAgIGJhc2VUaXRsZXMucHVzaCgnRXN0aW1hdGVkIFRyYW5zZmVyIFNpemUnKTtcbiAgICB0YWJsZUFsaWduLnB1c2goJ3InKTtcbiAgfVxuXG4gIC8vIEVudHJ5IGNodW5rc1xuICBpZiAoY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMubGVuZ3RoKSB7XG4gICAgYnVuZGxlSW5mby5wdXNoKFsnSW5pdGlhbCBDaHVuayBGaWxlcycsIC4uLmJhc2VUaXRsZXNdLm1hcChib2xkKSwgLi4uY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMpO1xuXG4gICAgaWYgKHNob3dUb3RhbFNpemUpIHtcbiAgICAgIGJ1bmRsZUluZm8ucHVzaChbXSk7XG5cbiAgICAgIGNvbnN0IGluaXRpYWxTaXplVG90YWxDb2xvciA9IGdldFNpemVDb2xvcignYnVuZGxlIGluaXRpYWwnLCB1bmRlZmluZWQsICh4KSA9PiB4KTtcbiAgICAgIGNvbnN0IHRvdGFsU2l6ZUVsZW1lbnRzID0gW1xuICAgICAgICAnICcsXG4gICAgICAgICdJbml0aWFsIFRvdGFsJyxcbiAgICAgICAgaW5pdGlhbFNpemVUb3RhbENvbG9yKGZvcm1hdFNpemUoaW5pdGlhbFRvdGFsUmF3U2l6ZSkpLFxuICAgICAgXTtcbiAgICAgIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplKSB7XG4gICAgICAgIHRvdGFsU2l6ZUVsZW1lbnRzLnB1c2goXG4gICAgICAgICAgdHlwZW9mIGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcidcbiAgICAgICAgICAgID8gZm9ybWF0U2l6ZShpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUpXG4gICAgICAgICAgICA6ICctJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGJ1bmRsZUluZm8ucHVzaCh0b3RhbFNpemVFbGVtZW50cy5tYXAoYm9sZCkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNlcGVyYXRvclxuICBpZiAoY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMubGVuZ3RoICYmIGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMubGVuZ3RoKSB7XG4gICAgYnVuZGxlSW5mby5wdXNoKFtdKTtcbiAgfVxuXG4gIC8vIExhenkgY2h1bmtzXG4gIGlmIChjaGFuZ2VkTGF6eUNodW5rc1N0YXRzLmxlbmd0aCkge1xuICAgIGJ1bmRsZUluZm8ucHVzaChbJ0xhenkgQ2h1bmsgRmlsZXMnLCAuLi5iYXNlVGl0bGVzXS5tYXAoYm9sZCksIC4uLmNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMpO1xuICB9XG5cbiAgcmV0dXJuIHRleHRUYWJsZShidW5kbGVJbmZvLCB7XG4gICAgaHNlcDogZGltKCcgfCAnKSxcbiAgICBzdHJpbmdMZW5ndGg6IChzKSA9PiByZW1vdmVDb2xvcihzKS5sZW5ndGgsXG4gICAgYWxpZ246IHRhYmxlQWxpZ24sXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUJ1aWxkU3RhdHMoaGFzaDogc3RyaW5nLCB0aW1lOiBudW1iZXIsIGNvbG9yczogYm9vbGVhbik6IHN0cmluZyB7XG4gIGNvbnN0IHcgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5ib2xkLndoaXRlKHgpIDogeCk7XG5cbiAgcmV0dXJuIGBCdWlsZCBhdDogJHt3KG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSl9IC0gSGFzaDogJHt3KGhhc2gpfSAtIFRpbWU6ICR7dygnJyArIHRpbWUpfW1zYDtcbn1cblxuLy8gV2UgdXNlIHRoaXMgY2FjaGUgYmVjYXVzZSB3ZSBjYW4gaGF2ZSBtdWx0aXBsZSBidWlsZGVycyBydW5uaW5nIGluIHRoZSBzYW1lIHByb2Nlc3MsXG4vLyB3aGVyZSBlYWNoIGJ1aWxkZXIgaGFzIGRpZmZlcmVudCBvdXRwdXQgcGF0aC5cblxuLy8gSWRlYWxseSwgd2Ugc2hvdWxkIGNyZWF0ZSB0aGUgbG9nZ2luZyBjYWxsYmFjayBhcyBhIGZhY3RvcnksIGJ1dCB0aGF0IHdvdWxkIG5lZWQgYSByZWZhY3RvcmluZy5cbmNvbnN0IHJ1bnNDYWNoZSA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5mdW5jdGlvbiBzdGF0c1RvU3RyaW5nKFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBzdGF0c0NvbmZpZzogYW55LFxuICBidWRnZXRGYWlsdXJlcz86IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSxcbik6IHN0cmluZyB7XG4gIGlmICghanNvbi5jaHVua3M/Lmxlbmd0aCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGNvbnN0IGNvbG9ycyA9IHN0YXRzQ29uZmlnLmNvbG9ycztcbiAgY29uc3QgcnMgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldCh4KSA6IHgpO1xuXG4gIGNvbnN0IGNoYW5nZWRDaHVua3NTdGF0czogQnVuZGxlU3RhdHNbXSA9IFtdO1xuICBsZXQgdW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPSAwO1xuICBsZXQgaGFzRXN0aW1hdGVkVHJhbnNmZXJTaXplcyA9IGZhbHNlO1xuXG4gIGNvbnN0IGlzRmlyc3RSdW4gPSAhcnVuc0NhY2hlLmhhcyhqc29uLm91dHB1dFBhdGggfHwgJycpO1xuXG4gIGZvciAoY29uc3QgY2h1bmsgb2YganNvbi5jaHVua3MpIHtcbiAgICAvLyBEdXJpbmcgZmlyc3QgYnVpbGQgd2Ugd2FudCB0byBkaXNwbGF5IHVuY2hhbmdlZCBjaHVua3NcbiAgICAvLyBidXQgdW5jaGFuZ2VkIGNhY2hlZCBjaHVua3MgYXJlIGFsd2F5cyBtYXJrZWQgYXMgbm90IHJlbmRlcmVkLlxuICAgIGlmICghaXNGaXJzdFJ1biAmJiAhY2h1bmsucmVuZGVyZWQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGFzc2V0cyA9IGpzb24uYXNzZXRzPy5maWx0ZXIoKGFzc2V0KSA9PiBjaHVuay5maWxlcz8uaW5jbHVkZXMoYXNzZXQubmFtZSkpO1xuICAgIGxldCByYXdTaXplID0gMDtcbiAgICBsZXQgZXN0aW1hdGVkVHJhbnNmZXJTaXplO1xuICAgIGlmIChhc3NldHMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgIGlmIChhc3NldC5uYW1lLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJhd1NpemUgKz0gYXNzZXQuc2l6ZTtcblxuICAgICAgICBpZiAodHlwZW9mIGFzc2V0LmluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIGlmIChlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplID0gMDtcbiAgICAgICAgICAgIGhhc0VzdGltYXRlZFRyYW5zZmVyU2l6ZXMgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgKz0gYXNzZXQuaW5mby5lc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY2hhbmdlZENodW5rc1N0YXRzLnB1c2goZ2VuZXJhdGVCdW5kbGVTdGF0cyh7IC4uLmNodW5rLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgfSkpO1xuICB9XG4gIHVuY2hhbmdlZENodW5rTnVtYmVyID0ganNvbi5jaHVua3MubGVuZ3RoIC0gY2hhbmdlZENodW5rc1N0YXRzLmxlbmd0aDtcblxuICBydW5zQ2FjaGUuYWRkKGpzb24ub3V0cHV0UGF0aCB8fCAnJyk7XG5cbiAgLy8gU29ydCBjaHVua3MgYnkgc2l6ZSBpbiBkZXNjZW5kaW5nIG9yZGVyXG4gIGNoYW5nZWRDaHVua3NTdGF0cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgaWYgKGEuc3RhdHNbMl0gPiBiLnN0YXRzWzJdKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgaWYgKGEuc3RhdHNbMl0gPCBiLnN0YXRzWzJdKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gMDtcbiAgfSk7XG5cbiAgY29uc3Qgc3RhdHNUYWJsZSA9IGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlKFxuICAgIGNoYW5nZWRDaHVua3NTdGF0cyxcbiAgICBjb2xvcnMsXG4gICAgdW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPT09IDAsXG4gICAgaGFzRXN0aW1hdGVkVHJhbnNmZXJTaXplcyxcbiAgICBidWRnZXRGYWlsdXJlcyxcbiAgKTtcblxuICAvLyBJbiBzb21lIGNhc2VzIHdlIGRvIHRoaW5ncyBvdXRzaWRlIG9mIHdlYnBhY2sgY29udGV4dFxuICAvLyBTdWNoIHVzIGluZGV4IGdlbmVyYXRpb24sIHNlcnZpY2Ugd29ya2VyIGF1Z21lbnRhdGlvbiBldGMuLi5cbiAgLy8gVGhpcyB3aWxsIGNvcnJlY3QgdGhlIHRpbWUgYW5kIGluY2x1ZGUgdGhlc2UuXG5cbiAgY29uc3QgdGltZSA9IGdldEJ1aWxkRHVyYXRpb24oanNvbik7XG5cbiAgaWYgKHVuY2hhbmdlZENodW5rTnVtYmVyID4gMCkge1xuICAgIHJldHVybiAoXG4gICAgICAnXFxuJyArXG4gICAgICBycyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICR7c3RhdHNUYWJsZX1cblxuICAgICAgJHt1bmNoYW5nZWRDaHVua051bWJlcn0gdW5jaGFuZ2VkIGNodW5rc1xuXG4gICAgICAke2dlbmVyYXRlQnVpbGRTdGF0cyhqc29uLmhhc2ggfHwgJycsIHRpbWUsIGNvbG9ycyl9XG4gICAgICBgKVxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIChcbiAgICAgICdcXG4nICtcbiAgICAgIHJzKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgJHtzdGF0c1RhYmxlfVxuXG4gICAgICAke2dlbmVyYXRlQnVpbGRTdGF0cyhqc29uLmhhc2ggfHwgJycsIHRpbWUsIGNvbG9ycyl9XG4gICAgICBgKVxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzV2FybmluZ3NUb1N0cmluZyhcbiAganNvbjogU3RhdHNDb21waWxhdGlvbixcbiAgc3RhdHNDb25maWc6IFdlYnBhY2tTdGF0c09wdGlvbnMsXG4pOiBzdHJpbmcge1xuICBjb25zdCBjb2xvcnMgPSBzdGF0c0NvbmZpZy5jb2xvcnM7XG4gIGNvbnN0IGMgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC5jeWFuKHgpIDogeCk7XG4gIGNvbnN0IHkgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC55ZWxsb3coeCkgOiB4KTtcbiAgY29uc3QgeWIgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC55ZWxsb3dCcmlnaHQoeCkgOiB4KTtcblxuICBjb25zdCB3YXJuaW5ncyA9IGpzb24ud2FybmluZ3MgPyBbLi4uanNvbi53YXJuaW5nc10gOiBbXTtcbiAgaWYgKGpzb24uY2hpbGRyZW4pIHtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLmpzb24uY2hpbGRyZW4ubWFwKChjKSA9PiBjLndhcm5pbmdzID8/IFtdKS5yZWR1Y2UoKGEsIGIpID0+IFsuLi5hLCAuLi5iXSwgW10pKTtcbiAgfVxuXG4gIGxldCBvdXRwdXQgPSAnJztcbiAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgaWYgKHR5cGVvZiB3YXJuaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgb3V0cHV0ICs9IHliKGBXYXJuaW5nOiAke3dhcm5pbmd9XFxuXFxuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBmaWxlID0gd2FybmluZy5maWxlIHx8IHdhcm5pbmcubW9kdWxlTmFtZTtcbiAgICAgIC8vIENsZWFuIHVwIHdhcm5pbmcgcGF0aHNcbiAgICAgIC8vIEV4OiAuL3NyYy9hcHAvc3R5bGVzLnNjc3Mud2VicGFja1tqYXZhc2NyaXB0L2F1dG9dIT0hLi9ub2RlX21vZHVsZXMvY3NzLWxvYWRlci9kaXN0L2Nqcy5qcy4uLi5cbiAgICAgIC8vIHRvIC4vc3JjL2FwcC9zdHlsZXMuc2Nzcy53ZWJwYWNrXG4gICAgICBpZiAoZmlsZSAmJiAhc3RhdHNDb25maWcuZXJyb3JEZXRhaWxzKSB7XG4gICAgICAgIGNvbnN0IHdlYnBhY2tQYXRoSW5kZXggPSBmaWxlLmluZGV4T2YoJy53ZWJwYWNrWycpO1xuICAgICAgICBpZiAod2VicGFja1BhdGhJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBmaWxlID0gZmlsZS5zdWJzdHJpbmcoMCwgd2VicGFja1BhdGhJbmRleCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgb3V0cHV0ICs9IGMoZmlsZSk7XG4gICAgICAgIGlmICh3YXJuaW5nLmxvYykge1xuICAgICAgICAgIG91dHB1dCArPSAnOicgKyB5Yih3YXJuaW5nLmxvYyk7XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0ICs9ICcgLSAnO1xuICAgICAgfVxuICAgICAgaWYgKCEvXndhcm5pbmcvaS50ZXN0KHdhcm5pbmcubWVzc2FnZSkpIHtcbiAgICAgICAgb3V0cHV0ICs9IHkoJ1dhcm5pbmc6ICcpO1xuICAgICAgfVxuICAgICAgb3V0cHV0ICs9IGAke3dhcm5pbmcubWVzc2FnZX1cXG5cXG5gO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvdXRwdXQgPyAnXFxuJyArIG91dHB1dCA6IG91dHB1dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzRXJyb3JzVG9TdHJpbmcoXG4gIGpzb246IFN0YXRzQ29tcGlsYXRpb24sXG4gIHN0YXRzQ29uZmlnOiBXZWJwYWNrU3RhdHNPcHRpb25zLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQuY3lhbih4KSA6IHgpO1xuICBjb25zdCB5YiA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0LnllbGxvd0JyaWdodCh4KSA6IHgpO1xuICBjb25zdCByID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQucmVkQnJpZ2h0KHgpIDogeCk7XG5cbiAgY29uc3QgZXJyb3JzID0ganNvbi5lcnJvcnMgPyBbLi4uanNvbi5lcnJvcnNdIDogW107XG4gIGlmIChqc29uLmNoaWxkcmVuKSB7XG4gICAgZXJyb3JzLnB1c2goLi4uanNvbi5jaGlsZHJlbi5tYXAoKGMpID0+IGM/LmVycm9ycyB8fCBbXSkucmVkdWNlKChhLCBiKSA9PiBbLi4uYSwgLi4uYl0sIFtdKSk7XG4gIH1cblxuICBsZXQgb3V0cHV0ID0gJyc7XG4gIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG91dHB1dCArPSByKGBFcnJvcjogJHtlcnJvcn1cXG5cXG5gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGZpbGUgPSBlcnJvci5maWxlIHx8IGVycm9yLm1vZHVsZU5hbWU7XG4gICAgICAvLyBDbGVhbiB1cCBlcnJvciBwYXRoc1xuICAgICAgLy8gRXg6IC4vc3JjL2FwcC9zdHlsZXMuc2Nzcy53ZWJwYWNrW2phdmFzY3JpcHQvYXV0b10hPSEuL25vZGVfbW9kdWxlcy9jc3MtbG9hZGVyL2Rpc3QvY2pzLmpzLi4uLlxuICAgICAgLy8gdG8gLi9zcmMvYXBwL3N0eWxlcy5zY3NzLndlYnBhY2tcbiAgICAgIGlmIChmaWxlICYmICFzdGF0c0NvbmZpZy5lcnJvckRldGFpbHMpIHtcbiAgICAgICAgY29uc3Qgd2VicGFja1BhdGhJbmRleCA9IGZpbGUuaW5kZXhPZignLndlYnBhY2tbJyk7XG4gICAgICAgIGlmICh3ZWJwYWNrUGF0aEluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGZpbGUgPSBmaWxlLnN1YnN0cmluZygwLCB3ZWJwYWNrUGF0aEluZGV4KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZmlsZSkge1xuICAgICAgICBvdXRwdXQgKz0gYyhmaWxlKTtcbiAgICAgICAgaWYgKGVycm9yLmxvYykge1xuICAgICAgICAgIG91dHB1dCArPSAnOicgKyB5YihlcnJvci5sb2MpO1xuICAgICAgICB9XG4gICAgICAgIG91dHB1dCArPSAnIC0gJztcbiAgICAgIH1cblxuICAgICAgLy8gSW4gbW9zdCBjYXNlcyB3ZWJwYWNrIHdpbGwgYWRkIHN0YWNrIHRyYWNlcyB0byBlcnJvciBtZXNzYWdlcy5cbiAgICAgIC8vIFRoaXMgYmVsb3cgY2xlYW5zIHVwIHRoZSBlcnJvciBmcm9tIHN0YWNrcy5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9pc3N1ZXMvMTU5ODBcbiAgICAgIGNvbnN0IGluZGV4ID0gZXJyb3IubWVzc2FnZS5zZWFyY2goL1tcXG5cXHNdK2F0IC8pO1xuICAgICAgY29uc3QgbWVzc2FnZSA9XG4gICAgICAgIHN0YXRzQ29uZmlnLmVycm9yU3RhY2sgfHwgaW5kZXggPT09IC0xID8gZXJyb3IubWVzc2FnZSA6IGVycm9yLm1lc3NhZ2Uuc3Vic3RyaW5nKDAsIGluZGV4KTtcblxuICAgICAgaWYgKCEvXmVycm9yL2kudGVzdChtZXNzYWdlKSkge1xuICAgICAgICBvdXRwdXQgKz0gcignRXJyb3I6ICcpO1xuICAgICAgfVxuICAgICAgb3V0cHV0ICs9IGAke21lc3NhZ2V9XFxuXFxuYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0ID8gJ1xcbicgKyBvdXRwdXQgOiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0hhc0Vycm9ycyhqc29uOiBTdGF0c0NvbXBpbGF0aW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiAhIShqc29uLmVycm9ycz8ubGVuZ3RoIHx8IGpzb24uY2hpbGRyZW4/LnNvbWUoKGMpID0+IGMuZXJyb3JzPy5sZW5ndGgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzSGFzV2FybmluZ3MoanNvbjogU3RhdHNDb21waWxhdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gISEoanNvbi53YXJuaW5ncz8ubGVuZ3RoIHx8IGpzb24uY2hpbGRyZW4/LnNvbWUoKGMpID0+IGMud2FybmluZ3M/Lmxlbmd0aCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogV2VicGFja0xvZ2dpbmdDYWxsYmFjayB7XG4gIGNvbnN0IHsgdmVyYm9zZSA9IGZhbHNlLCBzY3JpcHRzID0gW10sIHN0eWxlcyA9IFtdIH0gPSBvcHRpb25zO1xuICBjb25zdCBleHRyYUVudHJ5UG9pbnRzID0gW1xuICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVzLCAnc3R5bGVzJyksXG4gICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzY3JpcHRzLCAnc2NyaXB0cycpLFxuICBdO1xuXG4gIHJldHVybiAoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgIGlmICh2ZXJib3NlKSB7XG4gICAgICBsb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICB9XG5cbiAgICBjb25zdCByYXdTdGF0cyA9IHN0YXRzLnRvSnNvbihnZXRTdGF0c09wdGlvbnMoZmFsc2UpKTtcbiAgICBjb25zdCB3ZWJwYWNrU3RhdHMgPSB7XG4gICAgICAuLi5yYXdTdGF0cyxcbiAgICAgIGNodW5rczogbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbChyYXdTdGF0cywgZXh0cmFFbnRyeVBvaW50cyksXG4gICAgfTtcblxuICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihsb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnKTtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsZEV2ZW50U3RhdHMge1xuICBhb3Q6IGJvb2xlYW47XG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjtcbiAgYWxsQ2h1bmtzQ291bnQ6IG51bWJlcjtcbiAgbGF6eUNodW5rc0NvdW50OiBudW1iZXI7XG4gIGluaXRpYWxDaHVua3NDb3VudDogbnVtYmVyO1xuICBjaGFuZ2VkQ2h1bmtzQ291bnQ/OiBudW1iZXI7XG4gIGR1cmF0aW9uSW5NczogbnVtYmVyO1xuICBjc3NTaXplSW5CeXRlczogbnVtYmVyO1xuICBqc1NpemVJbkJ5dGVzOiBudW1iZXI7XG4gIG5nQ29tcG9uZW50Q291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQnVpbGRFdmVudFN0YXRzKFxuICB3ZWJwYWNrU3RhdHM6IFN0YXRzQ29tcGlsYXRpb24sXG4gIGJyb3dzZXJCdWlsZGVyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuKTogQnVpbGRFdmVudFN0YXRzIHtcbiAgY29uc3QgeyBjaHVua3MgPSBbXSwgYXNzZXRzID0gW10gfSA9IHdlYnBhY2tTdGF0cztcblxuICBsZXQganNTaXplSW5CeXRlcyA9IDA7XG4gIGxldCBjc3NTaXplSW5CeXRlcyA9IDA7XG4gIGxldCBpbml0aWFsQ2h1bmtzQ291bnQgPSAwO1xuICBsZXQgbmdDb21wb25lbnRDb3VudCA9IDA7XG4gIGxldCBjaGFuZ2VkQ2h1bmtzQ291bnQgPSAwO1xuXG4gIGNvbnN0IGFsbENodW5rc0NvdW50ID0gY2h1bmtzLmxlbmd0aDtcbiAgY29uc3QgaXNGaXJzdFJ1biA9ICFydW5zQ2FjaGUuaGFzKHdlYnBhY2tTdGF0cy5vdXRwdXRQYXRoIHx8ICcnKTtcblxuICBjb25zdCBjaHVua0ZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XG4gICAgaWYgKCFpc0ZpcnN0UnVuICYmIGNodW5rLnJlbmRlcmVkKSB7XG4gICAgICBjaGFuZ2VkQ2h1bmtzQ291bnQrKztcbiAgICB9XG5cbiAgICBpZiAoY2h1bmsuaW5pdGlhbCkge1xuICAgICAgaW5pdGlhbENodW5rc0NvdW50Kys7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGNodW5rLmZpbGVzID8/IFtdKSB7XG4gICAgICBjaHVua0ZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFzc2V0cykge1xuICAgIGlmIChhc3NldC5uYW1lLmVuZHNXaXRoKCcubWFwJykgfHwgIWNodW5rRmlsZXMuaGFzKGFzc2V0Lm5hbWUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoYXNzZXQubmFtZS5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgIGpzU2l6ZUluQnl0ZXMgKz0gYXNzZXQuc2l6ZTtcbiAgICAgIG5nQ29tcG9uZW50Q291bnQgKz0gYXNzZXQuaW5mby5uZ0NvbXBvbmVudENvdW50ID8/IDA7XG4gICAgfSBlbHNlIGlmIChhc3NldC5uYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgIGNzc1NpemVJbkJ5dGVzICs9IGFzc2V0LnNpemU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBvcHRpbWl6YXRpb246ICEhbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJCdWlsZGVyT3B0aW9ucy5vcHRpbWl6YXRpb24pLnNjcmlwdHMsXG4gICAgYW90OiBicm93c2VyQnVpbGRlck9wdGlvbnMuYW90ICE9PSBmYWxzZSxcbiAgICBhbGxDaHVua3NDb3VudCxcbiAgICBsYXp5Q2h1bmtzQ291bnQ6IGFsbENodW5rc0NvdW50IC0gaW5pdGlhbENodW5rc0NvdW50LFxuICAgIGluaXRpYWxDaHVua3NDb3VudCxcbiAgICBjaGFuZ2VkQ2h1bmtzQ291bnQsXG4gICAgZHVyYXRpb25Jbk1zOiBnZXRCdWlsZER1cmF0aW9uKHdlYnBhY2tTdGF0cyksXG4gICAgY3NzU2l6ZUluQnl0ZXMsXG4gICAganNTaXplSW5CeXRlcyxcbiAgICBuZ0NvbXBvbmVudENvdW50LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2VicGFja1N0YXRzTG9nZ2VyKFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICBjb25maWc6IENvbmZpZ3VyYXRpb24sXG4gIGJ1ZGdldEZhaWx1cmVzPzogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdLFxuKTogdm9pZCB7XG4gIGxvZ2dlci5pbmZvKHN0YXRzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzLCBidWRnZXRGYWlsdXJlcykpO1xuXG4gIGlmICh0eXBlb2YgY29uZmlnLnN0YXRzICE9PSAnb2JqZWN0Jykge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBXZWJwYWNrIHN0YXRzIGNvbmZpZ3VyYXRpb24uJyk7XG4gIH1cblxuICBpZiAoc3RhdHNIYXNXYXJuaW5ncyhqc29uKSkge1xuICAgIGxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyhqc29uLCBjb25maWcuc3RhdHMpKTtcbiAgfVxuXG4gIGlmIChzdGF0c0hhc0Vycm9ycyhqc29uKSkge1xuICAgIGxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICB9XG59XG4iXX0=