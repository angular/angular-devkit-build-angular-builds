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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statsErrorsToString(json, statsConfig) {
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
            const file = error.file || error.moduleName;
            if (file) {
                output += c(file);
                if (error.loc) {
                    output += ':' + yb(error.loc);
                }
                output += ' - ';
            }
            if (!/^error/i.test(error.message)) {
                output += r('Error: ');
            }
            output += `${error.message}\n\n`;
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
    if (statsHasWarnings(json)) {
        logger.warn(statsWarningsToString(json, config.stats));
    }
    if (statsHasErrors(json)) {
        logger.error(statsErrorsToString(json, config.stats));
    }
}
exports.webpackStatsLogger = webpackStatsLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3V0aWxzL3N0YXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsK0NBQXFEO0FBQ3JELDJDQUE2QjtBQUM3Qiw0REFBbUM7QUFJbkMsNkNBQXNFO0FBQ3RFLGlEQUEyRDtBQUMzRCx1Q0FBdUU7QUFFdkUsU0FBZ0IsVUFBVSxDQUFDLElBQVk7SUFDckMsSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFO1FBQ2IsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFFRCxNQUFNLGFBQWEsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2xELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDMUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pELDhCQUE4QjtJQUM5QixNQUFNLGNBQWMsR0FBRyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUzQyxPQUFPLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUMxRSxDQUFDO0FBWkQsZ0NBWUM7QUFhRCxTQUFnQixtQkFBbUIsQ0FBQyxJQU9uQzs7SUFDQyxNQUFNLE9BQU8sR0FBRyxPQUFPLElBQUks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QUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztTQUMzQztRQUVELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBQSx5QkFBZSxFQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDdEQsTUFBTSxZQUFZLEdBQUc7WUFDbkIsR0FBRyxRQUFRO1lBQ1gsTUFBTSxFQUFFLElBQUEsd0NBQXlCLEVBQUMsUUFBUSxFQUFFLGdCQUFnQixDQUFDO1NBQzlELENBQUM7UUFFRixrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELENBQUMsQ0FBQztBQUNKLENBQUM7QUF2QkQsb0VBdUJDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQ2hDLE1BQXlCLEVBQ3pCLElBQXNCLEVBQ3RCLE1BQXFCLEVBQ3JCLGNBQXlDO0lBRXpDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFFL0QsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUN4RDtJQUNELElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3hCLE1BQU0sQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3ZEO0FBQ0gsQ0FBQztBQWRELGdEQWNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBsb2dnaW5nLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0ZXh0VGFibGUgZnJvbSAndGV4dC10YWJsZSc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBTdGF0c0NvbXBpbGF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdCB9IGZyb20gJy4uLy4uL3V0aWxzL2J1bmRsZS1jYWxjdWxhdG9yJztcbmltcG9ydCB7IGNvbG9ycyBhcyBhbnNpQ29sb3JzLCByZW1vdmVDb2xvciB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwgfSBmcm9tICcuL2FzeW5jLWNodW5rcyc7XG5pbXBvcnQgeyBnZXRTdGF0c09wdGlvbnMsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0U2l6ZShzaXplOiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuICcwIGJ5dGVzJztcbiAgfVxuXG4gIGNvbnN0IGFiYnJldmlhdGlvbnMgPSBbJ2J5dGVzJywgJ2tCJywgJ01CJywgJ0dCJ107XG4gIGNvbnN0IGluZGV4ID0gTWF0aC5mbG9vcihNYXRoLmxvZyhzaXplKSAvIE1hdGgubG9nKDEwMjQpKTtcbiAgY29uc3Qgcm91bmRlZFNpemUgPSBzaXplIC8gTWF0aC5wb3coMTAyNCwgaW5kZXgpO1xuICAvLyBieXRlcyBkb24ndCBoYXZlIGEgZnJhY3Rpb25cbiAgY29uc3QgZnJhY3Rpb25EaWdpdHMgPSBpbmRleCA9PT0gMCA/IDAgOiAyO1xuXG4gIHJldHVybiBgJHtyb3VuZGVkU2l6ZS50b0ZpeGVkKGZyYWN0aW9uRGlnaXRzKX0gJHthYmJyZXZpYXRpb25zW2luZGV4XX1gO1xufVxuXG5leHBvcnQgdHlwZSBCdW5kbGVTdGF0c0RhdGEgPSBbXG4gIGZpbGVzOiBzdHJpbmcsXG4gIG5hbWVzOiBzdHJpbmcsXG4gIHJhd1NpemU6IG51bWJlciB8IHN0cmluZyxcbiAgZXN0aW1hdGVkVHJhbnNmZXJTaXplOiBudW1iZXIgfCBzdHJpbmcsXG5dO1xuZXhwb3J0IGludGVyZmFjZSBCdW5kbGVTdGF0cyB7XG4gIGluaXRpYWw6IGJvb2xlYW47XG4gIHN0YXRzOiBCdW5kbGVTdGF0c0RhdGE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUJ1bmRsZVN0YXRzKGluZm86IHtcbiAgcmF3U2l6ZT86IG51bWJlcjtcbiAgZXN0aW1hdGVkVHJhbnNmZXJTaXplPzogbnVtYmVyO1xuICBmaWxlcz86IHN0cmluZ1tdO1xuICBuYW1lcz86IHN0cmluZ1tdO1xuICBpbml0aWFsPzogYm9vbGVhbjtcbiAgcmVuZGVyZWQ/OiBib29sZWFuO1xufSk6IEJ1bmRsZVN0YXRzIHtcbiAgY29uc3QgcmF3U2l6ZSA9IHR5cGVvZiBpbmZvLnJhd1NpemUgPT09ICdudW1iZXInID8gaW5mby5yYXdTaXplIDogJy0nO1xuICBjb25zdCBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPVxuICAgIHR5cGVvZiBpbmZvLmVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcicgPyBpbmZvLmVzdGltYXRlZFRyYW5zZmVyU2l6ZSA6ICctJztcbiAgY29uc3QgZmlsZXMgPVxuICAgIGluZm8uZmlsZXNcbiAgICAgID8uZmlsdGVyKChmKSA9PiAhZi5lbmRzV2l0aCgnLm1hcCcpKVxuICAgICAgLm1hcCgoZikgPT4gcGF0aC5iYXNlbmFtZShmKSlcbiAgICAgIC5qb2luKCcsICcpID8/ICcnO1xuICBjb25zdCBuYW1lcyA9IGluZm8ubmFtZXM/Lmxlbmd0aCA/IGluZm8ubmFtZXMuam9pbignLCAnKSA6ICctJztcbiAgY29uc3QgaW5pdGlhbCA9ICEhaW5mby5pbml0aWFsO1xuXG4gIHJldHVybiB7XG4gICAgaW5pdGlhbCxcbiAgICBzdGF0czogW2ZpbGVzLCBuYW1lcywgcmF3U2l6ZSwgZXN0aW1hdGVkVHJhbnNmZXJTaXplXSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUoXG4gIGRhdGE6IEJ1bmRsZVN0YXRzW10sXG4gIGNvbG9yczogYm9vbGVhbixcbiAgc2hvd1RvdGFsU2l6ZTogYm9vbGVhbixcbiAgc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZTogYm9vbGVhbixcbiAgYnVkZ2V0RmFpbHVyZXM/OiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10sXG4pOiBzdHJpbmcge1xuICBjb25zdCBnID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuZ3JlZW5CcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgYyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmN5YW5CcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgciA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlZEJyaWdodCh4KSA6IHgpO1xuICBjb25zdCB5ID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMueWVsbG93QnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IGJvbGQgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5ib2xkKHgpIDogeCk7XG4gIGNvbnN0IGRpbSA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmRpbSh4KSA6IHgpO1xuXG4gIGNvbnN0IGdldFNpemVDb2xvciA9IChuYW1lOiBzdHJpbmcsIGZpbGU/OiBzdHJpbmcsIGRlZmF1bHRDb2xvciA9IGMpID0+IHtcbiAgICBjb25zdCBzZXZlcml0eSA9IGJ1ZGdldHMuZ2V0KG5hbWUpIHx8IChmaWxlICYmIGJ1ZGdldHMuZ2V0KGZpbGUpKTtcbiAgICBzd2l0Y2ggKHNldmVyaXR5KSB7XG4gICAgICBjYXNlICd3YXJuaW5nJzpcbiAgICAgICAgcmV0dXJuIHk7XG4gICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgIHJldHVybiByO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGRlZmF1bHRDb2xvcjtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHM6IEJ1bmRsZVN0YXRzRGF0YVtdID0gW107XG4gIGNvbnN0IGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHM6IEJ1bmRsZVN0YXRzRGF0YVtdID0gW107XG5cbiAgbGV0IGluaXRpYWxUb3RhbFJhd1NpemUgPSAwO1xuICBsZXQgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplO1xuXG4gIGNvbnN0IGJ1ZGdldHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBpZiAoYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICBmb3IgKGNvbnN0IHsgbGFiZWwsIHNldmVyaXR5IH0gb2YgYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICAgIC8vIEluIHNvbWUgY2FzZXMgYSBmaWxlIGNhbiBoYXZlIG11bHRpcGxlIGJ1ZGdldCBmYWlsdXJlcy5cbiAgICAgIC8vIEZhdm9yIGVycm9yLlxuICAgICAgaWYgKGxhYmVsICYmICghYnVkZ2V0cy5oYXMobGFiZWwpIHx8IGJ1ZGdldHMuZ2V0KGxhYmVsKSA9PT0gJ3dhcm5pbmcnKSkge1xuICAgICAgICBidWRnZXRzLnNldChsYWJlbCwgc2V2ZXJpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgeyBpbml0aWFsLCBzdGF0cyB9IG9mIGRhdGEpIHtcbiAgICBjb25zdCBbZmlsZXMsIG5hbWVzLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVdID0gc3RhdHM7XG4gICAgY29uc3QgZ2V0UmF3U2l6ZUNvbG9yID0gZ2V0U2l6ZUNvbG9yKG5hbWVzLCBmaWxlcyk7XG4gICAgbGV0IGRhdGE6IEJ1bmRsZVN0YXRzRGF0YTtcblxuICAgIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplKSB7XG4gICAgICBkYXRhID0gW1xuICAgICAgICBnKGZpbGVzKSxcbiAgICAgICAgbmFtZXMsXG4gICAgICAgIGdldFJhd1NpemVDb2xvcih0eXBlb2YgcmF3U2l6ZSA9PT0gJ251bWJlcicgPyBmb3JtYXRTaXplKHJhd1NpemUpIDogcmF3U2l6ZSksXG4gICAgICAgIGMoXG4gICAgICAgICAgdHlwZW9mIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcidcbiAgICAgICAgICAgID8gZm9ybWF0U2l6ZShlc3RpbWF0ZWRUcmFuc2ZlclNpemUpXG4gICAgICAgICAgICA6IGVzdGltYXRlZFRyYW5zZmVyU2l6ZSxcbiAgICAgICAgKSxcbiAgICAgIF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEgPSBbXG4gICAgICAgIGcoZmlsZXMpLFxuICAgICAgICBuYW1lcyxcbiAgICAgICAgZ2V0UmF3U2l6ZUNvbG9yKHR5cGVvZiByYXdTaXplID09PSAnbnVtYmVyJyA/IGZvcm1hdFNpemUocmF3U2l6ZSkgOiByYXdTaXplKSxcbiAgICAgICAgJycsXG4gICAgICBdO1xuICAgIH1cblxuICAgIGlmIChpbml0aWFsKSB7XG4gICAgICBjaGFuZ2VkRW50cnlDaHVua3NTdGF0cy5wdXNoKGRhdGEpO1xuICAgICAgaWYgKHR5cGVvZiByYXdTaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBpbml0aWFsVG90YWxSYXdTaXplICs9IHJhd1NpemU7XG4gICAgICB9XG4gICAgICBpZiAoc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZSAmJiB0eXBlb2YgZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSArPSBlc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMucHVzaChkYXRhKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBidW5kbGVJbmZvOiAoc3RyaW5nIHwgbnVtYmVyKVtdW10gPSBbXTtcbiAgY29uc3QgYmFzZVRpdGxlcyA9IFsnTmFtZXMnLCAnUmF3IFNpemUnXTtcbiAgY29uc3QgdGFibGVBbGlnbjogKCdsJyB8ICdyJylbXSA9IFsnbCcsICdsJywgJ3InXTtcblxuICBpZiAoc2hvd0VzdGltYXRlZFRyYW5zZmVyU2l6ZSkge1xuICAgIGJhc2VUaXRsZXMucHVzaCgnRXN0aW1hdGVkIFRyYW5zZmVyIFNpemUnKTtcbiAgICB0YWJsZUFsaWduLnB1c2goJ3InKTtcbiAgfVxuXG4gIC8vIEVudHJ5IGNodW5rc1xuICBpZiAoY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMubGVuZ3RoKSB7XG4gICAgYnVuZGxlSW5mby5wdXNoKFsnSW5pdGlhbCBDaHVuayBGaWxlcycsIC4uLmJhc2VUaXRsZXNdLm1hcChib2xkKSwgLi4uY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMpO1xuXG4gICAgaWYgKHNob3dUb3RhbFNpemUpIHtcbiAgICAgIGJ1bmRsZUluZm8ucHVzaChbXSk7XG5cbiAgICAgIGNvbnN0IGluaXRpYWxTaXplVG90YWxDb2xvciA9IGdldFNpemVDb2xvcignYnVuZGxlIGluaXRpYWwnLCB1bmRlZmluZWQsICh4KSA9PiB4KTtcbiAgICAgIGNvbnN0IHRvdGFsU2l6ZUVsZW1lbnRzID0gW1xuICAgICAgICAnICcsXG4gICAgICAgICdJbml0aWFsIFRvdGFsJyxcbiAgICAgICAgaW5pdGlhbFNpemVUb3RhbENvbG9yKGZvcm1hdFNpemUoaW5pdGlhbFRvdGFsUmF3U2l6ZSkpLFxuICAgICAgXTtcbiAgICAgIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplKSB7XG4gICAgICAgIHRvdGFsU2l6ZUVsZW1lbnRzLnB1c2goXG4gICAgICAgICAgdHlwZW9mIGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gJ251bWJlcidcbiAgICAgICAgICAgID8gZm9ybWF0U2l6ZShpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUpXG4gICAgICAgICAgICA6ICctJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGJ1bmRsZUluZm8ucHVzaCh0b3RhbFNpemVFbGVtZW50cy5tYXAoYm9sZCkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNlcGVyYXRvclxuICBpZiAoY2hhbmdlZEVudHJ5Q2h1bmtzU3RhdHMubGVuZ3RoICYmIGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMubGVuZ3RoKSB7XG4gICAgYnVuZGxlSW5mby5wdXNoKFtdKTtcbiAgfVxuXG4gIC8vIExhenkgY2h1bmtzXG4gIGlmIChjaGFuZ2VkTGF6eUNodW5rc1N0YXRzLmxlbmd0aCkge1xuICAgIGJ1bmRsZUluZm8ucHVzaChbJ0xhenkgQ2h1bmsgRmlsZXMnLCAuLi5iYXNlVGl0bGVzXS5tYXAoYm9sZCksIC4uLmNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMpO1xuICB9XG5cbiAgcmV0dXJuIHRleHRUYWJsZShidW5kbGVJbmZvLCB7XG4gICAgaHNlcDogZGltKCcgfCAnKSxcbiAgICBzdHJpbmdMZW5ndGg6IChzKSA9PiByZW1vdmVDb2xvcihzKS5sZW5ndGgsXG4gICAgYWxpZ246IHRhYmxlQWxpZ24sXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUJ1aWxkU3RhdHMoaGFzaDogc3RyaW5nLCB0aW1lOiBudW1iZXIsIGNvbG9yczogYm9vbGVhbik6IHN0cmluZyB7XG4gIGNvbnN0IHcgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5ib2xkLndoaXRlKHgpIDogeCk7XG5cbiAgcmV0dXJuIGBCdWlsZCBhdDogJHt3KG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSl9IC0gSGFzaDogJHt3KGhhc2gpfSAtIFRpbWU6ICR7dygnJyArIHRpbWUpfW1zYDtcbn1cblxuLy8gV2UgdXNlIHRoaXMgY2FjaGUgYmVjYXVzZSB3ZSBjYW4gaGF2ZSBtdWx0aXBsZSBidWlsZGVycyBydW5uaW5nIGluIHRoZSBzYW1lIHByb2Nlc3MsXG4vLyB3aGVyZSBlYWNoIGJ1aWxkZXIgaGFzIGRpZmZlcmVudCBvdXRwdXQgcGF0aC5cblxuLy8gSWRlYWxseSwgd2Ugc2hvdWxkIGNyZWF0ZSB0aGUgbG9nZ2luZyBjYWxsYmFjayBhcyBhIGZhY3RvcnksIGJ1dCB0aGF0IHdvdWxkIG5lZWQgYSByZWZhY3RvcmluZy5cbmNvbnN0IHJ1bnNDYWNoZSA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5mdW5jdGlvbiBzdGF0c1RvU3RyaW5nKFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBzdGF0c0NvbmZpZzogYW55LFxuICBidWRnZXRGYWlsdXJlcz86IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSxcbik6IHN0cmluZyB7XG4gIGlmICghanNvbi5jaHVua3M/Lmxlbmd0aCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGNvbnN0IGNvbG9ycyA9IHN0YXRzQ29uZmlnLmNvbG9ycztcbiAgY29uc3QgcnMgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldCh4KSA6IHgpO1xuXG4gIGNvbnN0IGNoYW5nZWRDaHVua3NTdGF0czogQnVuZGxlU3RhdHNbXSA9IFtdO1xuICBsZXQgdW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPSAwO1xuICBsZXQgaGFzRXN0aW1hdGVkVHJhbnNmZXJTaXplcyA9IGZhbHNlO1xuXG4gIGNvbnN0IGlzRmlyc3RSdW4gPSAhcnVuc0NhY2hlLmhhcyhqc29uLm91dHB1dFBhdGggfHwgJycpO1xuXG4gIGZvciAoY29uc3QgY2h1bmsgb2YganNvbi5jaHVua3MpIHtcbiAgICAvLyBEdXJpbmcgZmlyc3QgYnVpbGQgd2Ugd2FudCB0byBkaXNwbGF5IHVuY2hhbmdlZCBjaHVua3NcbiAgICAvLyBidXQgdW5jaGFuZ2VkIGNhY2hlZCBjaHVua3MgYXJlIGFsd2F5cyBtYXJrZWQgYXMgbm90IHJlbmRlcmVkLlxuICAgIGlmICghaXNGaXJzdFJ1biAmJiAhY2h1bmsucmVuZGVyZWQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGFzc2V0cyA9IGpzb24uYXNzZXRzPy5maWx0ZXIoKGFzc2V0KSA9PiBjaHVuay5maWxlcz8uaW5jbHVkZXMoYXNzZXQubmFtZSkpO1xuICAgIGxldCByYXdTaXplID0gMDtcbiAgICBsZXQgZXN0aW1hdGVkVHJhbnNmZXJTaXplO1xuICAgIGlmIChhc3NldHMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgIGlmIChhc3NldC5uYW1lLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJhd1NpemUgKz0gYXNzZXQuc2l6ZTtcblxuICAgICAgICBpZiAodHlwZW9mIGFzc2V0LmluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIGlmIChlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplID0gMDtcbiAgICAgICAgICAgIGhhc0VzdGltYXRlZFRyYW5zZmVyU2l6ZXMgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgKz0gYXNzZXQuaW5mby5lc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY2hhbmdlZENodW5rc1N0YXRzLnB1c2goZ2VuZXJhdGVCdW5kbGVTdGF0cyh7IC4uLmNodW5rLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgfSkpO1xuICB9XG4gIHVuY2hhbmdlZENodW5rTnVtYmVyID0ganNvbi5jaHVua3MubGVuZ3RoIC0gY2hhbmdlZENodW5rc1N0YXRzLmxlbmd0aDtcblxuICBydW5zQ2FjaGUuYWRkKGpzb24ub3V0cHV0UGF0aCB8fCAnJyk7XG5cbiAgLy8gU29ydCBjaHVua3MgYnkgc2l6ZSBpbiBkZXNjZW5kaW5nIG9yZGVyXG4gIGNoYW5nZWRDaHVua3NTdGF0cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgaWYgKGEuc3RhdHNbMl0gPiBiLnN0YXRzWzJdKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgaWYgKGEuc3RhdHNbMl0gPCBiLnN0YXRzWzJdKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gMDtcbiAgfSk7XG5cbiAgY29uc3Qgc3RhdHNUYWJsZSA9IGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlKFxuICAgIGNoYW5nZWRDaHVua3NTdGF0cyxcbiAgICBjb2xvcnMsXG4gICAgdW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPT09IDAsXG4gICAgaGFzRXN0aW1hdGVkVHJhbnNmZXJTaXplcyxcbiAgICBidWRnZXRGYWlsdXJlcyxcbiAgKTtcblxuICAvLyBJbiBzb21lIGNhc2VzIHdlIGRvIHRoaW5ncyBvdXRzaWRlIG9mIHdlYnBhY2sgY29udGV4dFxuICAvLyBTdWNoIHVzIGluZGV4IGdlbmVyYXRpb24sIHNlcnZpY2Ugd29ya2VyIGF1Z21lbnRhdGlvbiBldGMuLi5cbiAgLy8gVGhpcyB3aWxsIGNvcnJlY3QgdGhlIHRpbWUgYW5kIGluY2x1ZGUgdGhlc2UuXG4gIGxldCB0aW1lID0gMDtcbiAgaWYgKGpzb24uYnVpbHRBdCAhPT0gdW5kZWZpbmVkICYmIGpzb24udGltZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdGltZSA9IERhdGUubm93KCkgLSBqc29uLmJ1aWx0QXQgKyBqc29uLnRpbWU7XG4gIH1cblxuICBpZiAodW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPiAwKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICdcXG4nICtcbiAgICAgIHJzKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgJHtzdGF0c1RhYmxlfVxuXG4gICAgICAke3VuY2hhbmdlZENodW5rTnVtYmVyfSB1bmNoYW5nZWQgY2h1bmtzXG5cbiAgICAgICR7Z2VuZXJhdGVCdWlsZFN0YXRzKGpzb24uaGFzaCB8fCAnJywgdGltZSwgY29sb3JzKX1cbiAgICAgIGApXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKFxuICAgICAgJ1xcbicgK1xuICAgICAgcnModGFncy5zdHJpcEluZGVudHNgXG4gICAgICAke3N0YXRzVGFibGV9XG5cbiAgICAgICR7Z2VuZXJhdGVCdWlsZFN0YXRzKGpzb24uaGFzaCB8fCAnJywgdGltZSwgY29sb3JzKX1cbiAgICAgIGApXG4gICAgKTtcbiAgfVxufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzV2FybmluZ3NUb1N0cmluZyhqc29uOiBTdGF0c0NvbXBpbGF0aW9uLCBzdGF0c0NvbmZpZzogYW55KTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQuY3lhbih4KSA6IHgpO1xuICBjb25zdCB5ID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93KHgpIDogeCk7XG4gIGNvbnN0IHliID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93QnJpZ2h0KHgpIDogeCk7XG5cbiAgY29uc3Qgd2FybmluZ3MgPSBqc29uLndhcm5pbmdzID8gWy4uLmpzb24ud2FybmluZ3NdIDogW107XG4gIGlmIChqc29uLmNoaWxkcmVuKSB7XG4gICAgd2FybmluZ3MucHVzaCguLi5qc29uLmNoaWxkcmVuLm1hcCgoYykgPT4gYy53YXJuaW5ncyA/PyBbXSkucmVkdWNlKChhLCBiKSA9PiBbLi4uYSwgLi4uYl0sIFtdKSk7XG4gIH1cblxuICBsZXQgb3V0cHV0ID0gJyc7XG4gIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgIGlmICh0eXBlb2Ygd2FybmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG91dHB1dCArPSB5YihgV2FybmluZzogJHt3YXJuaW5nfVxcblxcbmApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmaWxlID0gd2FybmluZy5maWxlIHx8IHdhcm5pbmcubW9kdWxlTmFtZTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIG91dHB1dCArPSBjKGZpbGUpO1xuICAgICAgICBpZiAod2FybmluZy5sb2MpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gJzonICsgeWIod2FybmluZy5sb2MpO1xuICAgICAgICB9XG4gICAgICAgIG91dHB1dCArPSAnIC0gJztcbiAgICAgIH1cbiAgICAgIGlmICghL153YXJuaW5nL2kudGVzdCh3YXJuaW5nLm1lc3NhZ2UpKSB7XG4gICAgICAgIG91dHB1dCArPSB5KCdXYXJuaW5nOiAnKTtcbiAgICAgIH1cbiAgICAgIG91dHB1dCArPSBgJHt3YXJuaW5nLm1lc3NhZ2V9XFxuXFxuYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0ID8gJ1xcbicgKyBvdXRwdXQgOiBvdXRwdXQ7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gc3RhdHNFcnJvcnNUb1N0cmluZyhqc29uOiBTdGF0c0NvbXBpbGF0aW9uLCBzdGF0c0NvbmZpZzogYW55KTogc3RyaW5nIHtcbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQuY3lhbih4KSA6IHgpO1xuICBjb25zdCB5YiA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0LnllbGxvd0JyaWdodCh4KSA6IHgpO1xuICBjb25zdCByID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQucmVkQnJpZ2h0KHgpIDogeCk7XG5cbiAgY29uc3QgZXJyb3JzID0ganNvbi5lcnJvcnMgPyBbLi4uanNvbi5lcnJvcnNdIDogW107XG4gIGlmIChqc29uLmNoaWxkcmVuKSB7XG4gICAgZXJyb3JzLnB1c2goLi4uanNvbi5jaGlsZHJlbi5tYXAoKGMpID0+IGM/LmVycm9ycyB8fCBbXSkucmVkdWNlKChhLCBiKSA9PiBbLi4uYSwgLi4uYl0sIFtdKSk7XG4gIH1cblxuICBsZXQgb3V0cHV0ID0gJyc7XG4gIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG91dHB1dCArPSByKGBFcnJvcjogJHtlcnJvcn1cXG5cXG5gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZmlsZSA9IGVycm9yLmZpbGUgfHwgZXJyb3IubW9kdWxlTmFtZTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIG91dHB1dCArPSBjKGZpbGUpO1xuICAgICAgICBpZiAoZXJyb3IubG9jKSB7XG4gICAgICAgICAgb3V0cHV0ICs9ICc6JyArIHliKGVycm9yLmxvYyk7XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0ICs9ICcgLSAnO1xuICAgICAgfVxuICAgICAgaWYgKCEvXmVycm9yL2kudGVzdChlcnJvci5tZXNzYWdlKSkge1xuICAgICAgICBvdXRwdXQgKz0gcignRXJyb3I6ICcpO1xuICAgICAgfVxuICAgICAgb3V0cHV0ICs9IGAke2Vycm9yLm1lc3NhZ2V9XFxuXFxuYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3V0cHV0ID8gJ1xcbicgKyBvdXRwdXQgOiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0hhc0Vycm9ycyhqc29uOiBTdGF0c0NvbXBpbGF0aW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiAhIShqc29uLmVycm9ycz8ubGVuZ3RoIHx8IGpzb24uY2hpbGRyZW4/LnNvbWUoKGMpID0+IGMuZXJyb3JzPy5sZW5ndGgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzSGFzV2FybmluZ3MoanNvbjogU3RhdHNDb21waWxhdGlvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gISEoanNvbi53YXJuaW5ncz8ubGVuZ3RoIHx8IGpzb24uY2hpbGRyZW4/LnNvbWUoKGMpID0+IGMud2FybmluZ3M/Lmxlbmd0aCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogV2VicGFja0xvZ2dpbmdDYWxsYmFjayB7XG4gIGNvbnN0IHsgdmVyYm9zZSA9IGZhbHNlLCBzY3JpcHRzID0gW10sIHN0eWxlcyA9IFtdIH0gPSBvcHRpb25zO1xuICBjb25zdCBleHRyYUVudHJ5UG9pbnRzID0gW1xuICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVzLCAnc3R5bGVzJyksXG4gICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzY3JpcHRzLCAnc2NyaXB0cycpLFxuICBdO1xuXG4gIHJldHVybiAoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgIGlmICh2ZXJib3NlKSB7XG4gICAgICBsb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICB9XG5cbiAgICBjb25zdCByYXdTdGF0cyA9IHN0YXRzLnRvSnNvbihnZXRTdGF0c09wdGlvbnMoZmFsc2UpKTtcbiAgICBjb25zdCB3ZWJwYWNrU3RhdHMgPSB7XG4gICAgICAuLi5yYXdTdGF0cyxcbiAgICAgIGNodW5rczogbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbChyYXdTdGF0cywgZXh0cmFFbnRyeVBvaW50cyksXG4gICAgfTtcblxuICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihsb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnKTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdlYnBhY2tTdGF0c0xvZ2dlcihcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbiAganNvbjogU3RhdHNDb21waWxhdGlvbixcbiAgY29uZmlnOiBDb25maWd1cmF0aW9uLFxuICBidWRnZXRGYWlsdXJlcz86IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSxcbik6IHZvaWQge1xuICBsb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cywgYnVkZ2V0RmFpbHVyZXMpKTtcblxuICBpZiAoc3RhdHNIYXNXYXJuaW5ncyhqc29uKSkge1xuICAgIGxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyhqc29uLCBjb25maWcuc3RhdHMpKTtcbiAgfVxuICBpZiAoc3RhdHNIYXNFcnJvcnMoanNvbikpIHtcbiAgICBsb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyhqc29uLCBjb25maWcuc3RhdHMpKTtcbiAgfVxufVxuIl19