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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3V0aWxzL3N0YXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwrQ0FBcUQ7QUFDckQsMkNBQTZCO0FBQzdCLDREQUFtQztBQUluQyw2Q0FBc0U7QUFDdEUsaURBQTJEO0FBQzNELHVDQUF1RTtBQUV2RSxTQUFnQixVQUFVLENBQUMsSUFBWTtJQUNyQyxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7UUFDYixPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELE1BQU0sYUFBYSxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDakQsOEJBQThCO0lBQzlCLE1BQU0sY0FBYyxHQUFHLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTNDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQzFFLENBQUM7QUFaRCxnQ0FZQztBQWFELFNBQWdCLG1CQUFtQixDQUFDLElBT25DOztJQUNDLE1BQU0sT0FBTyxHQUFHLE9BQU8sSUFBSSxDQUFD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QUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQzNDO1FBRUQsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFBLHlCQUFlLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN0RCxNQUFNLFlBQVksR0FBRztZQUNuQixHQUFHLFFBQVE7WUFDWCxNQUFNLEVBQUUsSUFBQSx3Q0FBeUIsRUFBQyxRQUFRLEVBQUUsZ0JBQWdCLENBQUM7U0FDOUQsQ0FBQztRQUVGLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbkQsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQXZCRCxvRUF1QkM7QUFFRCxTQUFnQixrQkFBa0IsQ0FDaEMsTUFBeUIsRUFDekIsSUFBc0IsRUFDdEIsTUFBcUIsRUFDckIsY0FBeUM7SUFFekMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUUvRCxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3hEO0lBQ0QsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDeEIsTUFBTSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDdkQ7QUFDSCxDQUFDO0FBZEQsZ0RBY0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgV2VicGFja0xvZ2dpbmdDYWxsYmFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGxvZ2dpbmcsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHRleHRUYWJsZSBmcm9tICd0ZXh0LXRhYmxlJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24sIFN0YXRzQ29tcGlsYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0IH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgY29sb3JzIGFzIGFuc2lDb2xvcnMsIHJlbW92ZUNvbG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCB9IGZyb20gJy4vYXN5bmMtY2h1bmtzJztcbmltcG9ydCB7IGdldFN0YXRzT3B0aW9ucywgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vaGVscGVycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRTaXplKHNpemU6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gJzAgYnl0ZXMnO1xuICB9XG5cbiAgY29uc3QgYWJicmV2aWF0aW9ucyA9IFsnYnl0ZXMnLCAna0InLCAnTUInLCAnR0InXTtcbiAgY29uc3QgaW5kZXggPSBNYXRoLmZsb29yKE1hdGgubG9nKHNpemUpIC8gTWF0aC5sb2coMTAyNCkpO1xuICBjb25zdCByb3VuZGVkU2l6ZSA9IHNpemUgLyBNYXRoLnBvdygxMDI0LCBpbmRleCk7XG4gIC8vIGJ5dGVzIGRvbid0IGhhdmUgYSBmcmFjdGlvblxuICBjb25zdCBmcmFjdGlvbkRpZ2l0cyA9IGluZGV4ID09PSAwID8gMCA6IDI7XG5cbiAgcmV0dXJuIGAke3JvdW5kZWRTaXplLnRvRml4ZWQoZnJhY3Rpb25EaWdpdHMpfSAke2FiYnJldmlhdGlvbnNbaW5kZXhdfWA7XG59XG5cbmV4cG9ydCB0eXBlIEJ1bmRsZVN0YXRzRGF0YSA9IFtcbiAgZmlsZXM6IHN0cmluZyxcbiAgbmFtZXM6IHN0cmluZyxcbiAgcmF3U2l6ZTogbnVtYmVyIHwgc3RyaW5nLFxuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemU6IG51bWJlciB8IHN0cmluZyxcbl07XG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0YXRzIHtcbiAgaW5pdGlhbDogYm9vbGVhbjtcbiAgc3RhdHM6IEJ1bmRsZVN0YXRzRGF0YTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQnVuZGxlU3RhdHMoaW5mbzoge1xuICByYXdTaXplPzogbnVtYmVyO1xuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemU/OiBudW1iZXI7XG4gIGZpbGVzPzogc3RyaW5nW107XG4gIG5hbWVzPzogc3RyaW5nW107XG4gIGluaXRpYWw/OiBib29sZWFuO1xuICByZW5kZXJlZD86IGJvb2xlYW47XG59KTogQnVuZGxlU3RhdHMge1xuICBjb25zdCByYXdTaXplID0gdHlwZW9mIGluZm8ucmF3U2l6ZSA9PT0gJ251bWJlcicgPyBpbmZvLnJhd1NpemUgOiAnLSc7XG4gIGNvbnN0IGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9XG4gICAgdHlwZW9mIGluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJyA/IGluZm8uZXN0aW1hdGVkVHJhbnNmZXJTaXplIDogJy0nO1xuICBjb25zdCBmaWxlcyA9XG4gICAgaW5mby5maWxlc1xuICAgICAgPy5maWx0ZXIoKGYpID0+ICFmLmVuZHNXaXRoKCcubWFwJykpXG4gICAgICAubWFwKChmKSA9PiBwYXRoLmJhc2VuYW1lKGYpKVxuICAgICAgLmpvaW4oJywgJykgPz8gJyc7XG4gIGNvbnN0IG5hbWVzID0gaW5mby5uYW1lcz8ubGVuZ3RoID8gaW5mby5uYW1lcy5qb2luKCcsICcpIDogJy0nO1xuICBjb25zdCBpbml0aWFsID0gISFpbmZvLmluaXRpYWw7XG5cbiAgcmV0dXJuIHtcbiAgICBpbml0aWFsLFxuICAgIHN0YXRzOiBbZmlsZXMsIG5hbWVzLCByYXdTaXplLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVdLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShcbiAgZGF0YTogQnVuZGxlU3RhdHNbXSxcbiAgY29sb3JzOiBib29sZWFuLFxuICBzaG93VG90YWxTaXplOiBib29sZWFuLFxuICBzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplOiBib29sZWFuLFxuICBidWRnZXRGYWlsdXJlcz86IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGcgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5ncmVlbkJyaWdodCh4KSA6IHgpO1xuICBjb25zdCBjID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuY3lhbkJyaWdodCh4KSA6IHgpO1xuICBjb25zdCByID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVkQnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IHkgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy55ZWxsb3dCcmlnaHQoeCkgOiB4KTtcbiAgY29uc3QgYm9sZCA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmJvbGQoeCkgOiB4KTtcbiAgY29uc3QgZGltID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMuZGltKHgpIDogeCk7XG5cbiAgY29uc3QgZ2V0U2l6ZUNvbG9yID0gKG5hbWU6IHN0cmluZywgZmlsZT86IHN0cmluZywgZGVmYXVsdENvbG9yID0gYykgPT4ge1xuICAgIGNvbnN0IHNldmVyaXR5ID0gYnVkZ2V0cy5nZXQobmFtZSkgfHwgKGZpbGUgJiYgYnVkZ2V0cy5nZXQoZmlsZSkpO1xuICAgIHN3aXRjaCAoc2V2ZXJpdHkpIHtcbiAgICAgIGNhc2UgJ3dhcm5pbmcnOlxuICAgICAgICByZXR1cm4geTtcbiAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgcmV0dXJuIHI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gZGVmYXVsdENvbG9yO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjaGFuZ2VkRW50cnlDaHVua3NTdGF0czogQnVuZGxlU3RhdHNEYXRhW10gPSBbXTtcbiAgY29uc3QgY2hhbmdlZExhenlDaHVua3NTdGF0czogQnVuZGxlU3RhdHNEYXRhW10gPSBbXTtcblxuICBsZXQgaW5pdGlhbFRvdGFsUmF3U2l6ZSA9IDA7XG4gIGxldCBpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG5cbiAgY29uc3QgYnVkZ2V0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGlmIChidWRnZXRGYWlsdXJlcykge1xuICAgIGZvciAoY29uc3QgeyBsYWJlbCwgc2V2ZXJpdHkgfSBvZiBidWRnZXRGYWlsdXJlcykge1xuICAgICAgLy8gSW4gc29tZSBjYXNlcyBhIGZpbGUgY2FuIGhhdmUgbXVsdGlwbGUgYnVkZ2V0IGZhaWx1cmVzLlxuICAgICAgLy8gRmF2b3IgZXJyb3IuXG4gICAgICBpZiAobGFiZWwgJiYgKCFidWRnZXRzLmhhcyhsYWJlbCkgfHwgYnVkZ2V0cy5nZXQobGFiZWwpID09PSAnd2FybmluZycpKSB7XG4gICAgICAgIGJ1ZGdldHMuc2V0KGxhYmVsLCBzZXZlcml0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCB7IGluaXRpYWwsIHN0YXRzIH0gb2YgZGF0YSkge1xuICAgIGNvbnN0IFtmaWxlcywgbmFtZXMsIHJhd1NpemUsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZV0gPSBzdGF0cztcbiAgICBjb25zdCBnZXRSYXdTaXplQ29sb3IgPSBnZXRTaXplQ29sb3IobmFtZXMsIGZpbGVzKTtcbiAgICBsZXQgZGF0YTogQnVuZGxlU3RhdHNEYXRhO1xuXG4gICAgaWYgKHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemUpIHtcbiAgICAgIGRhdGEgPSBbXG4gICAgICAgIGcoZmlsZXMpLFxuICAgICAgICBuYW1lcyxcbiAgICAgICAgZ2V0UmF3U2l6ZUNvbG9yKHR5cGVvZiByYXdTaXplID09PSAnbnVtYmVyJyA/IGZvcm1hdFNpemUocmF3U2l6ZSkgOiByYXdTaXplKSxcbiAgICAgICAgYyhcbiAgICAgICAgICB0eXBlb2YgZXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgPyBmb3JtYXRTaXplKGVzdGltYXRlZFRyYW5zZmVyU2l6ZSlcbiAgICAgICAgICAgIDogZXN0aW1hdGVkVHJhbnNmZXJTaXplLFxuICAgICAgICApLFxuICAgICAgXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IFtcbiAgICAgICAgZyhmaWxlcyksXG4gICAgICAgIG5hbWVzLFxuICAgICAgICBnZXRSYXdTaXplQ29sb3IodHlwZW9mIHJhd1NpemUgPT09ICdudW1iZXInID8gZm9ybWF0U2l6ZShyYXdTaXplKSA6IHJhd1NpemUpLFxuICAgICAgICAnJyxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgaWYgKGluaXRpYWwpIHtcbiAgICAgIGNoYW5nZWRFbnRyeUNodW5rc1N0YXRzLnB1c2goZGF0YSk7XG4gICAgICBpZiAodHlwZW9mIHJhd1NpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGluaXRpYWxUb3RhbFJhd1NpemUgKz0gcmF3U2l6ZTtcbiAgICAgIH1cbiAgICAgIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplICYmIHR5cGVvZiBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGlmIChpbml0aWFsVG90YWxFc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplICs9IGVzdGltYXRlZFRyYW5zZmVyU2l6ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY2hhbmdlZExhenlDaHVua3NTdGF0cy5wdXNoKGRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGJ1bmRsZUluZm86IChzdHJpbmcgfCBudW1iZXIpW11bXSA9IFtdO1xuICBjb25zdCBiYXNlVGl0bGVzID0gWydOYW1lcycsICdSYXcgU2l6ZSddO1xuICBjb25zdCB0YWJsZUFsaWduOiAoJ2wnIHwgJ3InKVtdID0gWydsJywgJ2wnLCAnciddO1xuXG4gIGlmIChzaG93RXN0aW1hdGVkVHJhbnNmZXJTaXplKSB7XG4gICAgYmFzZVRpdGxlcy5wdXNoKCdFc3RpbWF0ZWQgVHJhbnNmZXIgU2l6ZScpO1xuICAgIHRhYmxlQWxpZ24ucHVzaCgncicpO1xuICB9XG5cbiAgLy8gRW50cnkgY2h1bmtzXG4gIGlmIChjaGFuZ2VkRW50cnlDaHVua3NTdGF0cy5sZW5ndGgpIHtcbiAgICBidW5kbGVJbmZvLnB1c2goWydJbml0aWFsIENodW5rIEZpbGVzJywgLi4uYmFzZVRpdGxlc10ubWFwKGJvbGQpLCAuLi5jaGFuZ2VkRW50cnlDaHVua3NTdGF0cyk7XG5cbiAgICBpZiAoc2hvd1RvdGFsU2l6ZSkge1xuICAgICAgYnVuZGxlSW5mby5wdXNoKFtdKTtcblxuICAgICAgY29uc3QgaW5pdGlhbFNpemVUb3RhbENvbG9yID0gZ2V0U2l6ZUNvbG9yKCdidW5kbGUgaW5pdGlhbCcsIHVuZGVmaW5lZCwgKHgpID0+IHgpO1xuICAgICAgY29uc3QgdG90YWxTaXplRWxlbWVudHMgPSBbXG4gICAgICAgICcgJyxcbiAgICAgICAgJ0luaXRpYWwgVG90YWwnLFxuICAgICAgICBpbml0aWFsU2l6ZVRvdGFsQ29sb3IoZm9ybWF0U2l6ZShpbml0aWFsVG90YWxSYXdTaXplKSksXG4gICAgICBdO1xuICAgICAgaWYgKHNob3dFc3RpbWF0ZWRUcmFuc2ZlclNpemUpIHtcbiAgICAgICAgdG90YWxTaXplRWxlbWVudHMucHVzaChcbiAgICAgICAgICB0eXBlb2YgaW5pdGlhbFRvdGFsRXN0aW1hdGVkVHJhbnNmZXJTaXplID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgPyBmb3JtYXRTaXplKGluaXRpYWxUb3RhbEVzdGltYXRlZFRyYW5zZmVyU2l6ZSlcbiAgICAgICAgICAgIDogJy0nLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgYnVuZGxlSW5mby5wdXNoKHRvdGFsU2l6ZUVsZW1lbnRzLm1hcChib2xkKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU2VwZXJhdG9yXG4gIGlmIChjaGFuZ2VkRW50cnlDaHVua3NTdGF0cy5sZW5ndGggJiYgY2hhbmdlZExhenlDaHVua3NTdGF0cy5sZW5ndGgpIHtcbiAgICBidW5kbGVJbmZvLnB1c2goW10pO1xuICB9XG5cbiAgLy8gTGF6eSBjaHVua3NcbiAgaWYgKGNoYW5nZWRMYXp5Q2h1bmtzU3RhdHMubGVuZ3RoKSB7XG4gICAgYnVuZGxlSW5mby5wdXNoKFsnTGF6eSBDaHVuayBGaWxlcycsIC4uLmJhc2VUaXRsZXNdLm1hcChib2xkKSwgLi4uY2hhbmdlZExhenlDaHVua3NTdGF0cyk7XG4gIH1cblxuICByZXR1cm4gdGV4dFRhYmxlKGJ1bmRsZUluZm8sIHtcbiAgICBoc2VwOiBkaW0oJyB8ICcpLFxuICAgIHN0cmluZ0xlbmd0aDogKHMpID0+IHJlbW92ZUNvbG9yKHMpLmxlbmd0aCxcbiAgICBhbGlnbjogdGFibGVBbGlnbixcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQnVpbGRTdGF0cyhoYXNoOiBzdHJpbmcsIHRpbWU6IG51bWJlciwgY29sb3JzOiBib29sZWFuKTogc3RyaW5nIHtcbiAgY29uc3QgdyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLmJvbGQud2hpdGUoeCkgOiB4KTtcblxuICByZXR1cm4gYEJ1aWxkIGF0OiAke3cobmV3IERhdGUoKS50b0lTT1N0cmluZygpKX0gLSBIYXNoOiAke3coaGFzaCl9IC0gVGltZTogJHt3KCcnICsgdGltZSl9bXNgO1xufVxuXG4vLyBXZSB1c2UgdGhpcyBjYWNoZSBiZWNhdXNlIHdlIGNhbiBoYXZlIG11bHRpcGxlIGJ1aWxkZXJzIHJ1bm5pbmcgaW4gdGhlIHNhbWUgcHJvY2Vzcyxcbi8vIHdoZXJlIGVhY2ggYnVpbGRlciBoYXMgZGlmZmVyZW50IG91dHB1dCBwYXRoLlxuXG4vLyBJZGVhbGx5LCB3ZSBzaG91bGQgY3JlYXRlIHRoZSBsb2dnaW5nIGNhbGxiYWNrIGFzIGEgZmFjdG9yeSwgYnV0IHRoYXQgd291bGQgbmVlZCBhIHJlZmFjdG9yaW5nLlxuY29uc3QgcnVuc0NhY2hlID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbmZ1bmN0aW9uIHN0YXRzVG9TdHJpbmcoXG4gIGpzb246IFN0YXRzQ29tcGlsYXRpb24sXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIHN0YXRzQ29uZmlnOiBhbnksXG4gIGJ1ZGdldEZhaWx1cmVzPzogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdLFxuKTogc3RyaW5nIHtcbiAgaWYgKCFqc29uLmNodW5rcz8ubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgY29uc3QgY29sb3JzID0gc3RhdHNDb25maWcuY29sb3JzO1xuICBjb25zdCBycyA9ICh4OiBzdHJpbmcpID0+IChjb2xvcnMgPyBhbnNpQ29sb3JzLnJlc2V0KHgpIDogeCk7XG5cbiAgY29uc3QgY2hhbmdlZENodW5rc1N0YXRzOiBCdW5kbGVTdGF0c1tdID0gW107XG4gIGxldCB1bmNoYW5nZWRDaHVua051bWJlciA9IDA7XG4gIGxldCBoYXNFc3RpbWF0ZWRUcmFuc2ZlclNpemVzID0gZmFsc2U7XG5cbiAgY29uc3QgaXNGaXJzdFJ1biA9ICFydW5zQ2FjaGUuaGFzKGpzb24ub3V0cHV0UGF0aCB8fCAnJyk7XG5cbiAgZm9yIChjb25zdCBjaHVuayBvZiBqc29uLmNodW5rcykge1xuICAgIC8vIER1cmluZyBmaXJzdCBidWlsZCB3ZSB3YW50IHRvIGRpc3BsYXkgdW5jaGFuZ2VkIGNodW5rc1xuICAgIC8vIGJ1dCB1bmNoYW5nZWQgY2FjaGVkIGNodW5rcyBhcmUgYWx3YXlzIG1hcmtlZCBhcyBub3QgcmVuZGVyZWQuXG4gICAgaWYgKCFpc0ZpcnN0UnVuICYmICFjaHVuay5yZW5kZXJlZCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgYXNzZXRzID0ganNvbi5hc3NldHM/LmZpbHRlcigoYXNzZXQpID0+IGNodW5rLmZpbGVzPy5pbmNsdWRlcyhhc3NldC5uYW1lKSk7XG4gICAgbGV0IHJhd1NpemUgPSAwO1xuICAgIGxldCBlc3RpbWF0ZWRUcmFuc2ZlclNpemU7XG4gICAgaWYgKGFzc2V0cykge1xuICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgaWYgKGFzc2V0Lm5hbWUuZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmF3U2l6ZSArPSBhc3NldC5zaXplO1xuXG4gICAgICAgIGlmICh0eXBlb2YgYXNzZXQuaW5mby5lc3RpbWF0ZWRUcmFuc2ZlclNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgaWYgKGVzdGltYXRlZFRyYW5zZmVyU2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBlc3RpbWF0ZWRUcmFuc2ZlclNpemUgPSAwO1xuICAgICAgICAgICAgaGFzRXN0aW1hdGVkVHJhbnNmZXJTaXplcyA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSArPSBhc3NldC5pbmZvLmVzdGltYXRlZFRyYW5zZmVyU2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjaGFuZ2VkQ2h1bmtzU3RhdHMucHVzaChnZW5lcmF0ZUJ1bmRsZVN0YXRzKHsgLi4uY2h1bmssIHJhd1NpemUsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZSB9KSk7XG4gIH1cbiAgdW5jaGFuZ2VkQ2h1bmtOdW1iZXIgPSBqc29uLmNodW5rcy5sZW5ndGggLSBjaGFuZ2VkQ2h1bmtzU3RhdHMubGVuZ3RoO1xuXG4gIHJ1bnNDYWNoZS5hZGQoanNvbi5vdXRwdXRQYXRoIHx8ICcnKTtcblxuICAvLyBTb3J0IGNodW5rcyBieSBzaXplIGluIGRlc2NlbmRpbmcgb3JkZXJcbiAgY2hhbmdlZENodW5rc1N0YXRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICBpZiAoYS5zdGF0c1syXSA+IGIuc3RhdHNbMl0pIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYS5zdGF0c1syXSA8IGIuc3RhdHNbMl0pIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9KTtcblxuICBjb25zdCBzdGF0c1RhYmxlID0gZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUoXG4gICAgY2hhbmdlZENodW5rc1N0YXRzLFxuICAgIGNvbG9ycyxcbiAgICB1bmNoYW5nZWRDaHVua051bWJlciA9PT0gMCxcbiAgICBoYXNFc3RpbWF0ZWRUcmFuc2ZlclNpemVzLFxuICAgIGJ1ZGdldEZhaWx1cmVzLFxuICApO1xuXG4gIC8vIEluIHNvbWUgY2FzZXMgd2UgZG8gdGhpbmdzIG91dHNpZGUgb2Ygd2VicGFjayBjb250ZXh0XG4gIC8vIFN1Y2ggdXMgaW5kZXggZ2VuZXJhdGlvbiwgc2VydmljZSB3b3JrZXIgYXVnbWVudGF0aW9uIGV0Yy4uLlxuICAvLyBUaGlzIHdpbGwgY29ycmVjdCB0aGUgdGltZSBhbmQgaW5jbHVkZSB0aGVzZS5cbiAgbGV0IHRpbWUgPSAwO1xuICBpZiAoanNvbi5idWlsdEF0ICE9PSB1bmRlZmluZWQgJiYganNvbi50aW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICB0aW1lID0gRGF0ZS5ub3coKSAtIGpzb24uYnVpbHRBdCArIGpzb24udGltZTtcbiAgfVxuXG4gIGlmICh1bmNoYW5nZWRDaHVua051bWJlciA+IDApIHtcbiAgICByZXR1cm4gKFxuICAgICAgJ1xcbicgK1xuICAgICAgcnModGFncy5zdHJpcEluZGVudHNgXG4gICAgICAke3N0YXRzVGFibGV9XG5cbiAgICAgICR7dW5jaGFuZ2VkQ2h1bmtOdW1iZXJ9IHVuY2hhbmdlZCBjaHVua3NcblxuICAgICAgJHtnZW5lcmF0ZUJ1aWxkU3RhdHMoanNvbi5oYXNoIHx8ICcnLCB0aW1lLCBjb2xvcnMpfVxuICAgICAgYClcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoXG4gICAgICAnXFxuJyArXG4gICAgICBycyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICR7c3RhdHNUYWJsZX1cblxuICAgICAgJHtnZW5lcmF0ZUJ1aWxkU3RhdHMoanNvbi5oYXNoIHx8ICcnLCB0aW1lLCBjb2xvcnMpfVxuICAgICAgYClcbiAgICApO1xuICB9XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb246IFN0YXRzQ29tcGlsYXRpb24sIHN0YXRzQ29uZmlnOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBjb2xvcnMgPSBzdGF0c0NvbmZpZy5jb2xvcnM7XG4gIGNvbnN0IGMgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC5jeWFuKHgpIDogeCk7XG4gIGNvbnN0IHkgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC55ZWxsb3coeCkgOiB4KTtcbiAgY29uc3QgeWIgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC55ZWxsb3dCcmlnaHQoeCkgOiB4KTtcblxuICBjb25zdCB3YXJuaW5ncyA9IGpzb24ud2FybmluZ3MgPyBbLi4uanNvbi53YXJuaW5nc10gOiBbXTtcbiAgaWYgKGpzb24uY2hpbGRyZW4pIHtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLmpzb24uY2hpbGRyZW4ubWFwKChjKSA9PiBjLndhcm5pbmdzID8/IFtdKS5yZWR1Y2UoKGEsIGIpID0+IFsuLi5hLCAuLi5iXSwgW10pKTtcbiAgfVxuXG4gIGxldCBvdXRwdXQgPSAnJztcbiAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgaWYgKHR5cGVvZiB3YXJuaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgb3V0cHV0ICs9IHliKGBXYXJuaW5nOiAke3dhcm5pbmd9XFxuXFxuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZpbGUgPSB3YXJuaW5nLmZpbGUgfHwgd2FybmluZy5tb2R1bGVOYW1lO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgb3V0cHV0ICs9IGMoZmlsZSk7XG4gICAgICAgIGlmICh3YXJuaW5nLmxvYykge1xuICAgICAgICAgIG91dHB1dCArPSAnOicgKyB5Yih3YXJuaW5nLmxvYyk7XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0ICs9ICcgLSAnO1xuICAgICAgfVxuICAgICAgaWYgKCEvXndhcm5pbmcvaS50ZXN0KHdhcm5pbmcubWVzc2FnZSkpIHtcbiAgICAgICAgb3V0cHV0ICs9IHkoJ1dhcm5pbmc6ICcpO1xuICAgICAgfVxuICAgICAgb3V0cHV0ICs9IGAke3dhcm5pbmcubWVzc2FnZX1cXG5cXG5gO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvdXRwdXQgPyAnXFxuJyArIG91dHB1dCA6IG91dHB1dDtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbmV4cG9ydCBmdW5jdGlvbiBzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb246IFN0YXRzQ29tcGlsYXRpb24sIHN0YXRzQ29uZmlnOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBjb2xvcnMgPSBzdGF0c0NvbmZpZy5jb2xvcnM7XG4gIGNvbnN0IGMgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC5jeWFuKHgpIDogeCk7XG4gIGNvbnN0IHliID0gKHg6IHN0cmluZykgPT4gKGNvbG9ycyA/IGFuc2lDb2xvcnMucmVzZXQueWVsbG93QnJpZ2h0KHgpIDogeCk7XG4gIGNvbnN0IHIgPSAoeDogc3RyaW5nKSA9PiAoY29sb3JzID8gYW5zaUNvbG9ycy5yZXNldC5yZWRCcmlnaHQoeCkgOiB4KTtcblxuICBjb25zdCBlcnJvcnMgPSBqc29uLmVycm9ycyA/IFsuLi5qc29uLmVycm9yc10gOiBbXTtcbiAgaWYgKGpzb24uY2hpbGRyZW4pIHtcbiAgICBlcnJvcnMucHVzaCguLi5qc29uLmNoaWxkcmVuLm1hcCgoYykgPT4gYz8uZXJyb3JzIHx8IFtdKS5yZWR1Y2UoKGEsIGIpID0+IFsuLi5hLCAuLi5iXSwgW10pKTtcbiAgfVxuXG4gIGxldCBvdXRwdXQgPSAnJztcbiAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICBpZiAodHlwZW9mIGVycm9yID09PSAnc3RyaW5nJykge1xuICAgICAgb3V0cHV0ICs9IHIoYEVycm9yOiAke2Vycm9yfVxcblxcbmApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmaWxlID0gZXJyb3IuZmlsZSB8fCBlcnJvci5tb2R1bGVOYW1lO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgb3V0cHV0ICs9IGMoZmlsZSk7XG4gICAgICAgIGlmIChlcnJvci5sb2MpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gJzonICsgeWIoZXJyb3IubG9jKTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQgKz0gJyAtICc7XG4gICAgICB9XG4gICAgICBpZiAoIS9eZXJyb3IvaS50ZXN0KGVycm9yLm1lc3NhZ2UpKSB7XG4gICAgICAgIG91dHB1dCArPSByKCdFcnJvcjogJyk7XG4gICAgICB9XG4gICAgICBvdXRwdXQgKz0gYCR7ZXJyb3IubWVzc2FnZX1cXG5cXG5gO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvdXRwdXQgPyAnXFxuJyArIG91dHB1dCA6IG91dHB1dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXRzSGFzRXJyb3JzKGpzb246IFN0YXRzQ29tcGlsYXRpb24pOiBib29sZWFuIHtcbiAgcmV0dXJuICEhKGpzb24uZXJyb3JzPy5sZW5ndGggfHwganNvbi5jaGlsZHJlbj8uc29tZSgoYykgPT4gYy5lcnJvcnM/Lmxlbmd0aCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RhdHNIYXNXYXJuaW5ncyhqc29uOiBTdGF0c0NvbXBpbGF0aW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiAhIShqc29uLndhcm5pbmdzPy5sZW5ndGggfHwganNvbi5jaGlsZHJlbj8uc29tZSgoYykgPT4gYy53YXJuaW5ncz8ubGVuZ3RoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrKFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIHtcbiAgY29uc3QgeyB2ZXJib3NlID0gZmFsc2UsIHNjcmlwdHMgPSBbXSwgc3R5bGVzID0gW10gfSA9IG9wdGlvbnM7XG4gIGNvbnN0IGV4dHJhRW50cnlQb2ludHMgPSBbXG4gICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzdHlsZXMsICdzdHlsZXMnKSxcbiAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHNjcmlwdHMsICdzY3JpcHRzJyksXG4gIF07XG5cbiAgcmV0dXJuIChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgaWYgKHZlcmJvc2UpIHtcbiAgICAgIGxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgIH1cblxuICAgIGNvbnN0IHJhd1N0YXRzID0gc3RhdHMudG9Kc29uKGdldFN0YXRzT3B0aW9ucyhmYWxzZSkpO1xuICAgIGNvbnN0IHdlYnBhY2tTdGF0cyA9IHtcbiAgICAgIC4uLnJhd1N0YXRzLFxuICAgICAgY2h1bmtzOiBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsKHJhd1N0YXRzLCBleHRyYUVudHJ5UG9pbnRzKSxcbiAgICB9O1xuXG4gICAgd2VicGFja1N0YXRzTG9nZ2VyKGxvZ2dlciwgd2VicGFja1N0YXRzLCBjb25maWcpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2VicGFja1N0YXRzTG9nZ2VyKFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuICBqc29uOiBTdGF0c0NvbXBpbGF0aW9uLFxuICBjb25maWc6IENvbmZpZ3VyYXRpb24sXG4gIGJ1ZGdldEZhaWx1cmVzPzogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdLFxuKTogdm9pZCB7XG4gIGxvZ2dlci5pbmZvKHN0YXRzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzLCBidWRnZXRGYWlsdXJlcykpO1xuXG4gIGlmIChzdGF0c0hhc1dhcm5pbmdzKGpzb24pKSB7XG4gICAgbG9nZ2VyLndhcm4oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICB9XG4gIGlmIChzdGF0c0hhc0Vycm9ycyhqc29uKSkge1xuICAgIGxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICB9XG59XG4iXX0=