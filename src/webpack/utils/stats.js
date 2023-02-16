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
exports.webpackStatsLogger = exports.generateBuildEventStats = exports.createWebpackLoggingCallback = exports.statsHasWarnings = exports.statsHasErrors = exports.statsErrorsToString = exports.statsWarningsToString = exports.formatSize = void 0;
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
            const message = statsConfig.errorStack
                ? error.message
                : /[\s\S]+?(?=\n+\s+at\s)/.exec(error.message)?.[0] ?? error.message;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3V0aWxzL3N0YXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsK0NBQXFEO0FBQ3JELG9EQUE0QjtBQUM1QiwyQ0FBNkI7QUFDN0IsNERBQW1DO0FBR25DLHVDQUFvRDtBQUVwRCw2Q0FBc0U7QUFDdEUsaURBQTJEO0FBQzNELHVDQUE0RjtBQUU1RixTQUFnQixVQUFVLENBQUMsSUFBWTtJQUNyQyxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7UUFDYixPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELE1BQU0sYUFBYSxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDakQsOEJBQThCO0lBQzlCLE1BQU0sY0FBYyxHQUFHLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTNDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQzFFLENBQUM7QUFaRCxnQ0FZQztBQWFELFNBQVMsZ0JBQWdCLENBQUMsWUFBOEI7SUFDdEQs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QUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDeEQ7SUFFRCxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUN4QixNQUFNLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUN2RDtBQUNILENBQUM7QUFuQkQsZ0RBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBsb2dnaW5nLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0ZXh0VGFibGUgZnJvbSAndGV4dC10YWJsZSc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBTdGF0c0NvbXBpbGF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdCB9IGZyb20gJy4uLy4uL3V0aWxzL2J1bmRsZS1jYWxjdWxhdG9yJztcbmltcG9ydCB7IGNvbG9ycyBhcyBhbnNpQ29sb3JzLCByZW1vdmVDb2xvciB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwgfSBmcm9tICcuL2FzeW5jLWNodW5rcyc7XG5pbXBvcnQgeyBXZWJwYWNrU3RhdHNPcHRpb25zLCBnZXRTdGF0c09wdGlvbnMsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0U2l6ZShzaXplOiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuICcwIGJ5dGVzJztcbiAgfVxuXG4gIGNvbnN0IGFiYnJldmlhdGlvbnMgPSBbJ2J5dGVzJywgJ2tCJywgJ01CJywgJ0dCJ107XG4gIGNvbnN0IGluZGV4ID0gTWF0aC5mbG9vcihNYXRoLmxvZyhzaXplKSAvIE1hdGgubG9nKDEwMjQpKTtcbiAgY29uc3Qgcm91bmRlZFNpemUgPSBzaXplIC8gTWF0aC5wb3coMTAyNCwgaW5kZXgpO1xuICAvLyBieXRlcyBkb24ndCBoYXZlIGEgZnJhY3Rpb25cbiAgY29uc3QgZnJhY3Rpb25EaWdpdHMgPSBpbmRleCA9PT0gMCA/IDAgOiAyO1xuXG4gIHJldHVybiBgJHtyb3VuZGVkU2l6ZS50b0ZpeGVkKGZyYWN0aW9uRGlnaXRzKX0gJHthYmJyZXZpYXRpb25zW2luZGV4XX1gO1xufVxuXG5leHBvcnQgdHlwZSBCdW5kbGVTdGF0c0RhdGEgPSBbXG4gIGZpbGVzOiBzdHJpbmcsXG4gIG5hbWVzOiBzdHJpbmcsXG4gIHJhd1NpemU6IG51bWJlciB8IHN0cmluZyxcbiAgZXN0aW1hdGVkVHJhbnNmZXJTaXplOiBudW1iZXIgfCBzdHJpbmcsXG5dO1xuZXhwb3J0IGludGVyZmFjZSBCdW5kbGVTdGF0cyB7XG4gIGluaXRpYWw6IGJvb2xlYW47XG4gIHN0YXRzOiBCdW5kbGVTdGF0c0RhdGE7XG59XG5cbmZ1bmN0aW9uIGdldEJ1aWxkRHVyYXRpb24od2VicGFja1N0YXRzOiBTdGF0c0NvbXBpbGF0aW9uKTogbnVtYmVyIHtcbiAgYXNzZXJ0KHdlYnBhY2tTdGF0cy5idWlsdEF0LCAnYnVpbGRBdCBjYW5ub3QgYmUgdW5kZWZpbmVkJyk7XG4gIGFzc2VydCh3ZWJwYWNrU3RhdHMudGltZSwgJ3RpbWUgY2Fubm90IGJlIHVuZGVmaW5lZCcpO1xuXG4gIHJldHVybiBEYXRlLm5vdygpIC0gd2VicGFja1N0YXRzLmJ1aWx0QXQgKyB3ZWJwYWNrU3RhdHMudGltZTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVCdW5kbGVTdGF0cyhpbmZvOiB7XG4gIHJhd1NpemU/OiBudW1iZXI7XG4gIGVzdGltYXRlZFRyYW5zZmVyU2l6ZT86IG51bWJlcjtcbiAgZmlsZXM/OiBzdHJpbmdbXTtcbiAgbmFtZXM/OiBzdHJpbmdbXTtcbiAgaW5pdGlhbD86IGJvb2xlYW47XG4gIHJlbmRlcmVkPzogYm9vbGVhbjtcbn0pOiBCdW5kbGVTdGF0cyB7XG4gIGNvbnN0IHJhd1NpemUgPSB0eXBlb2YgaW5mby5yYXdTaXplID09PSAnbnVtYmVyJyA/IGluZm8ucmF3U2l6ZSA6ICctJztcbiAgY29uc3QgZXN0aW1hdGVkVHJhbnNmZXJTaXplID1cbiAgICB0eXBlb2YgaW5mby5lc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInID8gaW5mby5lc3RpbWF0ZWRUcmFuc2ZlclNpemUgOiAnLSc7XG4gIGNvbnN0IGZpbGVzID1cbiAgICBpbmZvLmZpbGVzXG4gICAgICA/LmZpbHRlcigoZikgPT4gIWYuZW5kc1dpdGgoJy5tYXAnKSlcbiAgICAgIC5tYXAoKGYpID0+IHBhdGguYmFzZW5hbWUoZikpXG4gICAgICAuam9pbignLCAnKSA/PyAnJztcbiAgY29uc3QgbmFtZXMgPSBpbmZvLm5hbWVzPy5sZW5ndGggPyBpbmZvLm5hbWVzLmpvaW4oJywgJykgOiAnLSc7XG4gIGNvbnN0IGluaXRpYWwgPSAhIWluZm8uaW5pdGlhbDtcblxuICByZXR1cm4ge1xuICAgIGluaXRpYWwsXG4gICAgc3RhdHM6IFtmaWxlcywgbmFtZXMsIHJhd1NpemUsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZV0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlKFxuICBkYXRhOiBCdW5kbGVTdGF0c1tdLFxuICBjb2xvcnM6IGJvb2xlYW4sXG4gIHNob3dUb3RhbFNpemU6IGJvb2xlYW4sXG4gIHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemU6IGJvb2xlYW4sXG4gIGJ1ZGdldEZhaWx1cmVzPzogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgZyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmdyZWVuQnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IGMgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5jeWFuQnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IHIgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZWRCcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgeSA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnllbGxvd0JyaWdodCh4KSA6IHgpO1xuICBjb25zdCBib2xkID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuYm9sZCh4KSA6IHgpO1xuICBjb25zdCBkaW0gPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5kaW0oeCkgOiB4KTtcblxuICBjb25zdCBnZXRTaXplQ29sb3IgPSAobmFtZTogc3RyaW5nLCBmaWxlPzogc3RyaW5nLCBkZWZhdWx0Q29sb3IgPSBjKSA9PiB7XG4gICAgY29uc3Qgc2V2ZXJpdHkgPSBidWRnZXRzLmdldChuYW1lKSB8fCAoZmlsZSAmJiBidWRnZXRzLmdldChmaWxlKSk7XG4gICAgc3dpdGNoIChzZXZlcml0eSkge1xuICAgICAgY2FzZSAnd2FybmluZyc6XG4gICAgICAgIHJldHVybiB5O1xuICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICByZXR1cm4gcjtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBkZWZhdWx0Q29sb3I7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGNoYW5nZWRFbnRyeUNodW5rc1N0YXRzOiBCdW5kbGVTdGF0c0RhdGFbXSA9IFtdO1xuICBjb25zdCBjaGFuZ2VkTGF6eUNodW5rc1N0YXRzOiBCdW5kbGVTdGF0c0RhdGFbXSA9IFtdO1xuXG4gIGxldCBpbml0aWFsVG90YWxSYXdTaXplID0gMDtcbiAgbGV0IGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZTtcblxuICBjb25zdCBidWRnZXRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgaWYgKGJ1ZGdldEZhaWx1cmVzKSB7XG4gICAgZm9yIChjb25zdCB7IGxhYmVsLCBzZXZlcml0eSB9IG9mIGJ1ZGdldEZhaWx1cmVzKSB7XG4gICAgICAvLyBJbiBzb21lIGNhc2VzIGEgZmlsZSBjYW4gaGF2ZSBtdWx0aXBsZSBidWRnZXQgZmFpbHVyZXMuXG4gICAgICAvLyBGYXZvciBlcnJvci5cbiAgICAgIGlmIChsYWJlbCAmJiAoIWJ1ZGdldHMuaGFzKGxhYmVsKSB8fCBidWRnZXRzLmdldChsYWJlbCkgPT09ICd3YXJuaW5nJykpIHtcbiAgICAgICAgYnVkZ2V0cy5zZXQobGFiZWwsIHNldmVyaXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHsgaW5pdGlhbCwgc3RhdHMgfSBvZiBkYXRhKSB7XG4gICAgY29uc3QgW2ZpbGVzLCBuYW1lcywgcmF3U2l6ZSwgZXN0aW1hdGVkVHJhbnNmZXJTaXplXSA9IHN0YXRzO1xuICAgIGNvbnN0IGdldFJhd1NpemVDb2xvciA9IGdldFNpemVDb2xvcihuYW1lcywgZmlsZXMpO1xuICAgIGxldCBkYXRhOiBCdW5kbGVTdGF0c0RhdGE7XG5cbiAgICBpZiAoc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZSkge1xuICAgICAgZGF0YSA9IFtcbiAgICAgICAgZyhmaWxlcyksXG4gICAgICAgIG5hbWVzLFxuICAgICAgICBnZXRSYXdTaXplQ29sb3IodHlwZW9mIHJhd1NpemUgPT09ICdudW1iZXInID8gZm9ybWF0U2l6ZShyYXdTaXplKSA6IHJhd1NpemUpLFxuICAgICAgICBjKFxuICAgICAgICAgIHR5cGVvZiBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInXG4gICAgICAgICAgICA/IGZvcm1hdFNpemUoZXN0aW1hdGVkVHJhbnNmZXJTaXplKVxuICAgICAgICAgICAgOiBlc3RpbWF0ZWRUcmFuc2ZlclNpemUsXG4gICAgICAgICksXG4gICAgICBdO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhID0gW1xuICAgICAgICBnKGZpbGVzKSxcbiAgICAgICAgbmFtZXMsXG4gICAgICAgIGdldFJhd1NpemVDb2xvcih0eXBlb2YgcmF3U2l6ZSA9PT0gJ251bWJlcicgPyBmb3JtYXRTaXplKHJhd1NpemUpIDogcmF3U2l6ZSksXG4gICAgICAgICcnLFxuICAgICAgXTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdGlhbCkge1xuICAgICAgY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMucHVzaChkYXRhKTtcbiAgICAgIGlmICh0eXBlb2YgcmF3U2l6ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgaW5pdGlhbFRvdGFsUmF3U2l6ZSArPSByYXdTaXplO1xuICAgICAgfVxuICAgICAgaWYgKHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemUgJiYgdHlwZW9mIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgaWYgKGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplID0gMDtcbiAgICAgICAgfVxuICAgICAgICBpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUgKz0gZXN0aW1hdGVkVHJhbnNmZXJTaXplO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjaGFuZ2VkTGF6eUNodW5rc1N0YXRzLnB1c2goZGF0YSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYnVuZGxlSW5mbzogKHN0cmluZyB8IG51bWJlcilbXVtdID0gW107XG4gIGNvbnN0IGJhc2VUaXRsZXMgPSBbJ05hbWVzJywgJ1JhdyBTaXplJ107XG4gIGNvbnN0IHRhYmxlQWxpZ246ICgnbCcgfCAncicpW10gPSBbJ2wnLCAnbCcsICdyJ107XG5cbiAgaWYgKHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemUpIHtcbiAgICBiYXNlVGl0bGVzLnB1c2goJ0VzdGltYXRlZCBUcmFuc2ZlciBTaXplJyk7XG4gICAgdGFibGVBbGlnbi5wdXNoKCdyJyk7XG4gIH1cblxuICAvLyBFbnRyeSBjaHVua3NcbiAgaWYgKGNoYW5nZWRFbnRyeUNodW5rc1N0YXRzLmxlbmd0aCkge1xuICAgIGJ1bmRsZUluZm8ucHVzaChbJ0luaXRpYWwgQ2h1bmsgRmlsZXMnLCAuLi5iYXNlVGl0bGVzXS5tYXAoYm9sZCksIC4uLmNoYW5nZWRFbnRyeUNodW5rc1N0YXRzKTtcblxuICAgIGlmIChzaG93VG90YWxTaXplKSB7XG4gICAgICBidW5kbGVJbmZvLnB1c2goW10pO1xuXG4gICAgICBjb25zdCBpbml0aWFsU2l6ZVRvdGFsQ29sb3IgPSBnZXRTaXplQ29sb3IoJ2J1bmRsZSBpbml0aWFsJywgdW5kZWZpbmVkLCAoeCkgPT4geCk7XG4gICAgICBjb25zdCB0b3RhbFNpemVFbGVtZW50cyA9IFtcbiAgICAgICAgJyAnLFxuICAgICAgICAnSW5pdGlhbCBUb3RhbCcsXG4gICAgICAgIGluaXRpYWxTaXplVG90YWxDb2xvcihmb3JtYXRTaXplKGluaXRpYWxUb3RhbFJhd1NpemUpKSxcbiAgICAgIF07XG4gICAgICBpZiAoc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZSkge1xuICAgICAgICB0b3RhbFNpemVFbGVtZW50cy5wdXNoKFxuICAgICAgICAgIHR5cGVvZiBpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInXG4gICAgICAgICAgICA/IGZvcm1hdFNpemUoaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplKVxuICAgICAgICAgICAgOiAnLScsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBidW5kbGVJbmZvLnB1c2godG90YWxTaXplRWxlbWVudHMubWFwKGJvbGQpKTtcbiAgICB9XG4gIH1cblxuICAvLyBTZXBlcmF0b3JcbiAgaWYgKGNoYW5nZWRFbnRyeUNodW5rc1N0YXRzLmxlbmd0aCAmJiBjaGFuZ2VkTGF6eUNodW5rc1N0YXRzLmxlbmd0aCkge1xuICAgIGJ1bmRsZUluZm8ucHVzaChbXSk7XG4gIH1cblxuICAvLyBMYXp5IGNodW5rc1xuICBpZiAoY2hhbmdlZExhenlDaHVua3NTdGF0cy5sZW5ndGgpIHtcbiAgICBidW5kbGVJbmZvLnB1c2goWydMYXp5IENodW5rIEZpbGVzJywgLi4uYmFzZVRpdGxlc10ubWFwKGJvbGQpLCAuLi5jaGFuZ2VkTGF6eUNodW5rc1N0YXRzKTtcbiAgfVxuXG4gIHJldHVybiB0ZXh0VGFibGUoYnVuZGxlSW5mbywge1xuICAgIGhzZXA6IGRpbSgnIHwgJyksXG4gICAgc3RyaW5nTGVuZ3RoOiAocykgPT4gcmVtb3ZlQ29sb3IocykubGVuZ3RoLFxuICAgIGFsaWduOiB0YWJsZUFsaWduLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVCdWlsZFN0YXRzKGhhc2g6IHN0cmluZywgdGltZTogbnVtYmVyLCBjb2xvcnM6IGJvb2xlYW4pOiBzdHJpbmcge1xuICBjb25zdCB3ID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuYm9sZC53aGl0ZSh4KSA6IHgpO1xuXG4gIHJldHVybiBgQnVpbGQgYXQ6ICR7dyhuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpfSAtIEhhc2g6ICR7dyhoYXNoKX0gLSBUaW1lOiAke3coJycgKyB0aW1lKX1tc2A7XG59XG5cbi8vIFdlIHVzZSB0aGlzIGNhY2hlIGJlY2F1c2Ugd2UgY2FuIGhhdmUgbXVsdGlwbGUgYnVpbGRlcnMgcnVubmluZyBpbiB0aGUgc2FtZSBwcm9jZXNzLFxuLy8gd2hlcmUgZWFjaCBidWlsZGVyIGhhcyBkaWZmZXJlbnQgb3V0cHV0IHBhdGguXG5cbi8vIElkZWFsbHksIHdlIHNob3VsZCBjcmVhdGUgdGhlIGxvZ2dpbmcgY2FsbGJhY2sgYXMgYSBmYWN0b3J5LCBidXQgdGhhdCB3b3VsZCBuZWVkIGEgcmVmYWN0b3JpbmcuXG5jb25zdCBydW5zQ2FjaGUgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuZnVuY3Rpb24gc3RhdHNUb1N0cmluZyhcbiAganNvbjogU3RhdHNDb21waWxhdGlvbixcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgc3RhdHNDb25maWc6IGFueSxcbiAgYnVkZ2V0RmFpbHVyZXM/OiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10sXG4pOiBzdHJpbmcge1xuICBpZiAoIWpzb24uY2h1bmtzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICBjb25zdCBjb2xvcnMgPSBzdGF0c0NvbmZpZy5jb2xvcnM7XG4gIGNvbnN0IHJzID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQoeCkgOiB4KTtcblxuICBjb25zdCBjaGFuZ2VkQ2h1bmtzU3RhdHM6IEJ1bmRsZVN0YXRzW10gPSBbXTtcbiAgbGV0IHVuY2hhbmdlZENodW5rTnVtYmVyID0gMDtcbiAgbGV0IGhhc0VzdGltYXRlZFRyYW5zZmVyU2l6ZXMgPSBmYWxzZTtcblxuICBjb25zdCBpc0ZpcnN0UnVuID0gIXJ1bnNDYWNoZS5oYXMoanNvbi5vdXRwdXRQYXRoIHx8ICcnKTtcblxuICBmb3IgKGNvbnN0IGNodW5rIG9mIGpzb24uY2h1bmtzKSB7XG4gICAgLy8gRHVyaW5nIGZpcnN0IGJ1aWxkIHdlIHdhbnQgdG8gZGlzcGxheSB1bmNoYW5nZWQgY2h1bmtzXG4gICAgLy8gYnV0IHVuY2hhbmdlZCBjYWNoZWQgY2h1bmtzIGFyZSBhbHdheXMgbWFya2VkIGFzIG5vdCByZW5kZXJlZC5cbiAgICBpZiAoIWlzRmlyc3RSdW4gJiYgIWNodW5rLnJlbmRlcmVkKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBhc3NldHMgPSBqc29uLmFzc2V0cz8uZmlsdGVyKChhc3NldCkgPT4gY2h1bmsuZmlsZXM/LmluY2x1ZGVzKGFzc2V0Lm5hbWUpKTtcbiAgICBsZXQgcmF3U2l6ZSA9IDA7XG4gICAgbGV0IGVzdGltYXRlZFRyYW5zZmVyU2l6ZTtcbiAgICBpZiAoYXNzZXRzKSB7XG4gICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFzc2V0cykge1xuICAgICAgICBpZiAoYXNzZXQubmFtZS5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICByYXdTaXplICs9IGFzc2V0LnNpemU7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhc3NldC5pbmZvLmVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBpZiAoZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9IDA7XG4gICAgICAgICAgICBoYXNFc3RpbWF0ZWRUcmFuc2ZlclNpemVzID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplICs9IGFzc2V0LmluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNoYW5nZWRDaHVua3NTdGF0cy5wdXNoKGdlbmVyYXRlQnVuZGxlU3RhdHMoeyAuLi5jaHVuaywgcmF3U2l6ZSwgZXN0aW1hdGVkVHJhbnNmZXJTaXplIH0pKTtcbiAgfVxuICB1bmNoYW5nZWRDaHVua051bWJlciA9IGpzb24uY2h1bmtzLmxlbmd0aCAtIGNoYW5nZWRDaHVua3NTdGF0cy5sZW5ndGg7XG5cbiAgcnVuc0NhY2hlLmFkZChqc29uLm91dHB1dFBhdGggfHwgJycpO1xuXG4gIC8vIFNvcnQgY2h1bmtzIGJ5IHNpemUgaW4gZGVzY2VuZGluZyBvcmRlclxuICBjaGFuZ2VkQ2h1bmtzU3RhdHMuc29ydCgoYSwgYikgPT4ge1xuICAgIGlmIChhLnN0YXRzWzJdID4gYi5zdGF0c1syXSkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhLnN0YXRzWzJdIDwgYi5zdGF0c1syXSkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIDA7XG4gIH0pO1xuXG4gIGNvbnN0IHN0YXRzVGFibGUgPSBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShcbiAgICBjaGFuZ2VkQ2h1bmtzU3RhdHMsXG4gICAgY29sb3JzLFxuICAgIHVuY2hhbmdlZENodW5rTnVtYmVyID09PSAwLFxuICAgIGhhc0VzdGltYXRlZFRyYW5zZmVyU2l6ZXMsXG4gICAgYnVkZ2V0RmFpbHVyZXMsXG4gICk7XG5cbiAgLy8gSW4gc29tZSBjYXNlcyB3ZSBkbyB0aGluZ3Mgb3V0c2lkZSBvZiB3ZWJwYWNrIGNvbnRleHRcbiAgLy8gU3VjaCB1cyBpbmRleCBnZW5lcmF0aW9uLCBzZXJ2aWNlIHdvcmtlciBhdWdtZW50YXRpb24gZXRjLi4uXG4gIC8vIFRoaXMgd2lsbCBjb3JyZWN0IHRoZSB0aW1lIGFuZCBpbmNsdWRlIHRoZXNlLlxuXG4gIGNvbnN0IHRpbWUgPSBnZXRCdWlsZER1cmF0aW9uKGpzb24pO1xuXG4gIGlmICh1bmNoYW5nZWRDaHVua051bWJlciA+IDApIHtcbiAgICByZXR1cm4gKFxuICAgICAgJ1xcbicgK1xuICAgICAgcnModGFncy5zdHJpcEluZGVudHNgXG4gICAgICAke3N0YXRzVGFibGV9XG5cbiAgICAgICR7dW5jaGFuZ2VkQ2h1bmtOdW1iZXJ9IHVuY2hhbmdlZCBjaHVua3NcblxuICAgICAgJHtnZW5lcmF0ZUJ1aWxkU3RhdHMoanNvbi5oYXNoIHx8ICcnLCB0aW1lLCBjb2xvcnMpfVxuICAgICAgYClcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoXG4gICAgICAnXFxuJyArXG4gICAgICBycyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICR7c3RhdHNUYWJsZX1cblxuICAgICAgJHtnZW5lcmF0ZUJ1aWxkU3RhdHMoanNvbi5oYXNoIHx8ICcnLCB0aW1lLCBjb2xvcnMpfVxuICAgICAgYClcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c1dhcm5pbmdzVG9TdHJpbmcoXG4gIGpzb246IFN0YXRzQ29tcGlsYXRpb24sXG4gIHN0YXRzQ29uZmlnOiBXZWJwYWNrU3RhdHNPcHRpb25zLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQuY3lhbih4KSA6IHgpO1xuICBjb25zdCB5ID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93KHgpIDogeCk7XG4gIGNvbnN0IHliID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93QnJpZ2h0KHgpIDogeCk7XG5cbiAgY29uc3Qgd2FybmluZ3MgPSBqc29uLndhcm5pbmdzID8gWy4uLmpzb24ud2FybmluZ3NdIDogW107XG4gIGlmIChqc29uLmNoaWxkcmVuKSB7XG4gICAgd2FybmluZ3MucHVzaCguLi5qc29uLmNoaWxkcmVuLm1hcCgoYykgPT4gYy53YXJuaW5ncyA/PyBbXSkucmVkdWNlKChhLCBiKSA9PiBbLi4uYSwgLi4uYl0sIFtdKSk7XG4gIH1cblxuICBsZXQgb3V0cHV0ID0gJyc7XG4gIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgIGlmICh0eXBlb2Ygd2FybmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG91dHB1dCArPSB5YihgV2FybmluZzogJHt3YXJuaW5nfVxcblxcbmApO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgZmlsZSA9IHdhcm5pbmcuZmlsZSB8fCB3YXJuaW5nLm1vZHVsZU5hbWU7XG4gICAgICAvLyBDbGVhbiB1cCB3YXJuaW5nIHBhdGhzXG4gICAgICAvLyBFeDogLi9zcmMvYXBwL3N0eWxlcy5zY3NzLndlYnBhY2tbamF2YXNjcmlwdC9hdXRvXSE9IS4vbm9kZV9tb2R1bGVzL2Nzcy1sb2FkZXIvZGlzdC9janMuanMuLi4uXG4gICAgICAvLyB0byAuL3NyYy9hcHAvc3R5bGVzLnNjc3Mud2VicGFja1xuICAgICAgaWYgKGZpbGUgJiYgIXN0YXRzQ29uZmlnLmVycm9yRGV0YWlscykge1xuICAgICAgICBjb25zdCB3ZWJwYWNrUGF0aEluZGV4ID0gZmlsZS5pbmRleE9mKCcud2VicGFja1snKTtcbiAgICAgICAgaWYgKHdlYnBhY2tQYXRoSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgZmlsZSA9IGZpbGUuc3Vic3RyaW5nKDAsIHdlYnBhY2tQYXRoSW5kZXgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIG91dHB1dCArPSBjKGZpbGUpO1xuICAgICAgICBpZiAod2FybmluZy5sb2MpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gJzonICsgeWIod2FybmluZy5sb2MpO1xuICAgICAgICB9XG4gICAgICAgIG91dHB1dCArPSAnIC0gJztcbiAgICAgIH1cbiAgICAgIGlmICghL153YXJuaW5nL2kudGVzdCh3YXJuaW5nLm1lc3NhZ2UpKSB7XG4gICAgICAgIG91dHB1dCArPSB5KCdXYXJuaW5nOiAnKTtcbiAgICAgIH1cbiAgICAgIG91dHB1dCArPSBgJHt3YXJuaW5nLm1lc3NhZ2V9XFxuXFxuYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0ID8gJ1xcbicgKyBvdXRwdXQgOiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0Vycm9yc1RvU3RyaW5nKFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICBzdGF0c0NvbmZpZzogV2VicGFja1N0YXRzT3B0aW9ucyxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGNvbG9ycyA9IHN0YXRzQ29uZmlnLmNvbG9ycztcbiAgY29uc3QgYyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0LmN5YW4oeCkgOiB4KTtcbiAgY29uc3QgeWIgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC55ZWxsb3dCcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgciA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0LnJlZEJyaWdodCh4KSA6IHgpO1xuXG4gIGNvbnN0IGVycm9ycyA9IGpzb24uZXJyb3JzID8gWy4uLmpzb24uZXJyb3JzXSA6IFtdO1xuICBpZiAoanNvbi5jaGlsZHJlbikge1xuICAgIGVycm9ycy5wdXNoKC4uLmpzb24uY2hpbGRyZW4ubWFwKChjKSA9PiBjPy5lcnJvcnMgfHwgW10pLnJlZHVjZSgoYSwgYikgPT4gWy4uLmEsIC4uLmJdLCBbXSkpO1xuICB9XG5cbiAgbGV0IG91dHB1dCA9ICcnO1xuICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICBvdXRwdXQgKz0gcihgRXJyb3I6ICR7ZXJyb3J9XFxuXFxuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBmaWxlID0gZXJyb3IuZmlsZSB8fCBlcnJvci5tb2R1bGVOYW1lO1xuICAgICAgLy8gQ2xlYW4gdXAgZXJyb3IgcGF0aHNcbiAgICAgIC8vIEV4OiAuL3NyYy9hcHAvc3R5bGVzLnNjc3Mud2VicGFja1tqYXZhc2NyaXB0L2F1dG9dIT0hLi9ub2RlX21vZHVsZXMvY3NzLWxvYWRlci9kaXN0L2Nqcy5qcy4uLi5cbiAgICAgIC8vIHRvIC4vc3JjL2FwcC9zdHlsZXMuc2Nzcy53ZWJwYWNrXG4gICAgICBpZiAoZmlsZSAmJiAhc3RhdHNDb25maWcuZXJyb3JEZXRhaWxzKSB7XG4gICAgICAgIGNvbnN0IHdlYnBhY2tQYXRoSW5kZXggPSBmaWxlLmluZGV4T2YoJy53ZWJwYWNrWycpO1xuICAgICAgICBpZiAod2VicGFja1BhdGhJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBmaWxlID0gZmlsZS5zdWJzdHJpbmcoMCwgd2VicGFja1BhdGhJbmRleCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgb3V0cHV0ICs9IGMoZmlsZSk7XG4gICAgICAgIGlmIChlcnJvci5sb2MpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gJzonICsgeWIoZXJyb3IubG9jKTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQgKz0gJyAtICc7XG4gICAgICB9XG5cbiAgICAgIC8vIEluIG1vc3QgY2FzZXMgd2VicGFjayB3aWxsIGFkZCBzdGFjayB0cmFjZXMgdG8gZXJyb3IgbWVzc2FnZXMuXG4gICAgICAvLyBUaGlzIGJlbG93IGNsZWFucyB1cCB0aGUgZXJyb3IgZnJvbSBzdGFja3MuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzE1OTgwXG4gICAgICBjb25zdCBtZXNzYWdlID0gc3RhdHNDb25maWcuZXJyb3JTdGFja1xuICAgICAgICA/IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgOiAvW1xcc1xcU10rPyg/PVxcbitcXHMrYXRcXHMpLy5leGVjKGVycm9yLm1lc3NhZ2UpPy5bMF0gPz8gZXJyb3IubWVzc2FnZTtcblxuICAgICAgaWYgKCEvXmVycm9yL2kudGVzdChtZXNzYWdlKSkge1xuICAgICAgICBvdXRwdXQgKz0gcignRXJyb3I6ICcpO1xuICAgICAgfVxuICAgICAgb3V0cHV0ICs9IGAke21lc3NhZ2V9XFxuXFxuYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0ID8gJ1xcbicgKyBvdXRwdXQgOiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0hhc0Vycm9ycyhqc29uOiBTdGF0c0NvbXBpbGF0aW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiAhIShqc29uLmVycm9ycz8ubGVuZ3RoIHx8IGpzb24uY2hpbGRyZW4/LnNvbWUoKGMpID0+IGMuZXJyb3JzPy5sZW5ndGgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzSGFzV2FybmluZ3MoanNvbjogU3RhdHNDb21waWxhdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gISEoanNvbi53YXJuaW5ncz8ubGVuZ3RoIHx8IGpzb24uY2hpbGRyZW4/LnNvbWUoKGMpID0+IGMud2FybmluZ3M/Lmxlbmd0aCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogV2VicGFja0xvZ2dpbmdDYWxsYmFjayB7XG4gIGNvbnN0IHsgdmVyYm9zZSA9IGZhbHNlLCBzY3JpcHRzID0gW10sIHN0eWxlcyA9IFtdIH0gPSBvcHRpb25zO1xuICBjb25zdCBleHRyYUVudHJ5UG9pbnRzID0gW1xuICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVzLCAnc3R5bGVzJyksXG4gICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzY3JpcHRzLCAnc2NyaXB0cycpLFxuICBdO1xuXG4gIHJldHVybiAoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgIGlmICh2ZXJib3NlKSB7XG4gICAgICBsb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICB9XG5cbiAgICBjb25zdCByYXdTdGF0cyA9IHN0YXRzLnRvSnNvbihnZXRTdGF0c09wdGlvbnMoZmFsc2UpKTtcbiAgICBjb25zdCB3ZWJwYWNrU3RhdHMgPSB7XG4gICAgICAuLi5yYXdTdGF0cyxcbiAgICAgIGNodW5rczogbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbChyYXdTdGF0cywgZXh0cmFFbnRyeVBvaW50cyksXG4gICAgfTtcblxuICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihsb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnKTtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsZEV2ZW50U3RhdHMge1xuICBhb3Q6IGJvb2xlYW47XG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjtcbiAgYWxsQ2h1bmtzQ291bnQ6IG51bWJlcjtcbiAgbGF6eUNodW5rc0NvdW50OiBudW1iZXI7XG4gIGluaXRpYWxDaHVua3NDb3VudDogbnVtYmVyO1xuICBjaGFuZ2VkQ2h1bmtzQ291bnQ/OiBudW1iZXI7XG4gIGR1cmF0aW9uSW5NczogbnVtYmVyO1xuICBjc3NTaXplSW5CeXRlczogbnVtYmVyO1xuICBqc1NpemVJbkJ5dGVzOiBudW1iZXI7XG4gIG5nQ29tcG9uZW50Q291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQnVpbGRFdmVudFN0YXRzKFxuICB3ZWJwYWNrU3RhdHM6IFN0YXRzQ29tcGlsYXRpb24sXG4gIGJyb3dzZXJCdWlsZGVyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuKTogQnVpbGRFdmVudFN0YXRzIHtcbiAgY29uc3QgeyBjaHVua3MgPSBbXSwgYXNzZXRzID0gW10gfSA9IHdlYnBhY2tTdGF0cztcblxuICBsZXQganNTaXplSW5CeXRlcyA9IDA7XG4gIGxldCBjc3NTaXplSW5CeXRlcyA9IDA7XG4gIGxldCBpbml0aWFsQ2h1bmtzQ291bnQgPSAwO1xuICBsZXQgbmdDb21wb25lbnRDb3VudCA9IDA7XG4gIGxldCBjaGFuZ2VkQ2h1bmtzQ291bnQgPSAwO1xuXG4gIGNvbnN0IGFsbENodW5rc0NvdW50ID0gY2h1bmtzLmxlbmd0aDtcbiAgY29uc3QgaXNGaXJzdFJ1biA9ICFydW5zQ2FjaGUuaGFzKHdlYnBhY2tTdGF0cy5vdXRwdXRQYXRoIHx8ICcnKTtcblxuICBjb25zdCBjaHVua0ZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XG4gICAgaWYgKCFpc0ZpcnN0UnVuICYmIGNodW5rLnJlbmRlcmVkKSB7XG4gICAgICBjaGFuZ2VkQ2h1bmtzQ291bnQrKztcbiAgICB9XG5cbiAgICBpZiAoY2h1bmsuaW5pdGlhbCkge1xuICAgICAgaW5pdGlhbENodW5rc0NvdW50Kys7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGNodW5rLmZpbGVzID8/IFtdKSB7XG4gICAgICBjaHVua0ZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFzc2V0cykge1xuICAgIGlmIChhc3NldC5uYW1lLmVuZHNXaXRoKCcubWFwJykgfHwgIWNodW5rRmlsZXMuaGFzKGFzc2V0Lm5hbWUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoYXNzZXQubmFtZS5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgIGpzU2l6ZUluQnl0ZXMgKz0gYXNzZXQuc2l6ZTtcbiAgICAgIG5nQ29tcG9uZW50Q291bnQgKz0gYXNzZXQuaW5mby5uZ0NvbXBvbmVudENvdW50ID8/IDA7XG4gICAgfSBlbHNlIGlmIChhc3NldC5uYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgIGNzc1NpemVJbkJ5dGVzICs9IGFzc2V0LnNpemU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBvcHRpbWl6YXRpb246ICEhbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJCdWlsZGVyT3B0aW9ucy5vcHRpbWl6YXRpb24pLnNjcmlwdHMsXG4gICAgYW90OiBicm93c2VyQnVpbGRlck9wdGlvbnMuYW90ICE9PSBmYWxzZSxcbiAgICBhbGxDaHVua3NDb3VudCxcbiAgICBsYXp5Q2h1bmtzQ291bnQ6IGFsbENodW5rc0NvdW50IC0gaW5pdGlhbENodW5rc0NvdW50LFxuICAgIGluaXRpYWxDaHVua3NDb3VudCxcbiAgICBjaGFuZ2VkQ2h1bmtzQ291bnQsXG4gICAgZHVyYXRpb25Jbk1zOiBnZXRCdWlsZER1cmF0aW9uKHdlYnBhY2tTdGF0cyksXG4gICAgY3NzU2l6ZUluQnl0ZXMsXG4gICAganNTaXplSW5CeXRlcyxcbiAgICBuZ0NvbXBvbmVudENvdW50LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2VicGFja1N0YXRzTG9nZ2VyKFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICBjb25maWc6IENvbmZpZ3VyYXRpb24sXG4gIGJ1ZGdldEZhaWx1cmVzPzogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdLFxuKTogdm9pZCB7XG4gIGxvZ2dlci5pbmZvKHN0YXRzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzLCBidWRnZXRGYWlsdXJlcykpO1xuXG4gIGlmICh0eXBlb2YgY29uZmlnLnN0YXRzICE9PSAnb2JqZWN0Jykge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBXZWJwYWNrIHN0YXRzIGNvbmZpZ3VyYXRpb24uJyk7XG4gIH1cblxuICBpZiAoc3RhdHNIYXNXYXJuaW5ncyhqc29uKSkge1xuICAgIGxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyhqc29uLCBjb25maWcuc3RhdHMpKTtcbiAgfVxuXG4gIGlmIChzdGF0c0hhc0Vycm9ycyhqc29uKSkge1xuICAgIGxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICB9XG59XG4iXX0=