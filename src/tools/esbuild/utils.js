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
exports.getSupportedNodeTargets = exports.transformSupportedBrowsersToTargets = exports.getFullOutputPath = exports.createOutputFileFromData = exports.createOutputFileFromText = exports.writeResultFiles = exports.getFeatureSupport = exports.logMessages = exports.withNoProgress = exports.withSpinner = exports.calculateEstimatedTransferSizes = exports.logBuildStats = void 0;
const esbuild_1 = require("esbuild");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const node_zlib_1 = require("node:zlib");
const semver_1 = require("semver");
const spinner_1 = require("../../utils/spinner");
const stats_1 = require("../webpack/utils/stats");
const bundler_context_1 = require("./bundler-context");
const compressAsync = (0, node_util_1.promisify)(node_zlib_1.brotliCompress);
function logBuildStats(context, metafile, initial, budgetFailures, estimatedTransferSizes) {
    const stats = [];
    for (const [file, output] of Object.entries(metafile.outputs)) {
        // Only display JavaScript and CSS files
        if (!file.endsWith('.js') && !file.endsWith('.css')) {
            continue;
        }
        // Skip internal component resources
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (output['ng-component']) {
            continue;
        }
        let name = initial.get(file)?.name;
        if (name === undefined && output.entryPoint) {
            name = node_path_1.default
                .basename(output.entryPoint)
                .replace(/\.[cm]?[jt]s$/, '')
                .replace(/[\\/.]/g, '-');
        }
        stats.push({
            initial: initial.has(file),
            stats: [file, name ?? '-', output.bytes, estimatedTransferSizes?.get(file) ?? '-'],
        });
    }
    const tableText = (0, stats_1.generateBuildStatsTable)(stats, true, true, !!estimatedTransferSizes, budgetFailures);
    context.logger.info('\n' + tableText + '\n');
}
exports.logBuildStats = logBuildStats;
async function calculateEstimatedTransferSizes(outputFiles) {
    const sizes = new Map();
    const pendingCompression = [];
    for (const outputFile of outputFiles) {
        // Only calculate JavaScript and CSS files
        if (!outputFile.path.endsWith('.js') && !outputFile.path.endsWith('.css')) {
            continue;
        }
        // Skip compressing small files which may end being larger once compressed and will most likely not be
        // compressed in actual transit.
        if (outputFile.contents.byteLength < 1024) {
            sizes.set(outputFile.path, outputFile.contents.byteLength);
            continue;
        }
        pendingCompression.push(compressAsync(outputFile.contents).then((result) => sizes.set(outputFile.path, result.byteLength)));
    }
    await Promise.all(pendingCompression);
    return sizes;
}
exports.calculateEstimatedTransferSizes = calculateEstimatedTransferSizes;
async function withSpinner(text, action) {
    const spinner = new spinner_1.Spinner(text);
    spinner.start();
    try {
        return await action();
    }
    finally {
        spinner.stop();
    }
}
exports.withSpinner = withSpinner;
async function withNoProgress(text, action) {
    return action();
}
exports.withNoProgress = withNoProgress;
async function logMessages(context, { errors, warnings }) {
    if (warnings?.length) {
        const warningMessages = await (0, esbuild_1.formatMessages)(warnings, { kind: 'warning', color: true });
        context.logger.warn(warningMessages.join('\n'));
    }
    if (errors?.length) {
        const errorMessages = await (0, esbuild_1.formatMessages)(errors, { kind: 'error', color: true });
        context.logger.error(errorMessages.join('\n'));
    }
}
exports.logMessages = logMessages;
/**
 * Generates a syntax feature object map for Angular applications based on a list of targets.
 * A full set of feature names can be found here: https://esbuild.github.io/api/#supported
 * @param target An array of browser/engine targets in the format accepted by the esbuild `target` option.
 * @returns An object that can be used with the esbuild build `supported` option.
 */
function getFeatureSupport(target) {
    const supported = {
        // Native async/await is not supported with Zone.js. Disabling support here will cause
        // esbuild to downlevel async/await, async generators, and for await...of to a Zone.js supported form.
        'async-await': false,
        // V8 currently has a performance defect involving object spread operations that can cause signficant
        // degradation in runtime performance. By not supporting the language feature here, a downlevel form
        // will be used instead which provides a workaround for the performance issue.
        // For more details: https://bugs.chromium.org/p/v8/issues/detail?id=11536
        'object-rest-spread': false,
    };
    // Detect Safari browser versions that have a class field behavior bug
    // See: https://github.com/angular/angular-cli/issues/24355#issuecomment-1333477033
    // See: https://github.com/WebKit/WebKit/commit/e8788a34b3d5f5b4edd7ff6450b80936bff396f2
    let safariClassFieldScopeBug = false;
    for (const browser of target) {
        let majorVersion;
        if (browser.startsWith('ios')) {
            majorVersion = Number(browser.slice(3, 5));
        }
        else if (browser.startsWith('safari')) {
            majorVersion = Number(browser.slice(6, 8));
        }
        else {
            continue;
        }
        // Technically, 14.0 is not broken but rather does not have support. However, the behavior
        // is identical since it would be set to false by esbuild if present as a target.
        if (majorVersion === 14 || majorVersion === 15) {
            safariClassFieldScopeBug = true;
            break;
        }
    }
    // If class field support cannot be used set to false; otherwise leave undefined to allow
    // esbuild to use `target` to determine support.
    if (safariClassFieldScopeBug) {
        supported['class-field'] = false;
        supported['class-static-field'] = false;
    }
    return supported;
}
exports.getFeatureSupport = getFeatureSupport;
const MAX_CONCURRENT_WRITES = 64;
async function writeResultFiles(outputFiles, assetFiles, outputPath) {
    const directoryExists = new Set();
    // Writes the output file to disk and ensures the containing directories are present
    const writeOutputFile = async (file) => {
        const fullOutputPath = file.fullOutputPath;
        // Ensure output subdirectories exist
        const basePath = node_path_1.default.dirname(fullOutputPath);
        if (basePath && !directoryExists.has(basePath)) {
            await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
            directoryExists.add(basePath);
        }
        // Write file contents
        await promises_1.default.writeFile(node_path_1.default.join(outputPath, fullOutputPath), file.contents);
    };
    // Write files in groups of MAX_CONCURRENT_WRITES to avoid too many open files
    for (let fileIndex = 0; fileIndex < outputFiles.length;) {
        const groupMax = Math.min(fileIndex + MAX_CONCURRENT_WRITES, outputFiles.length);
        const actions = [];
        while (fileIndex < groupMax) {
            actions.push(writeOutputFile(outputFiles[fileIndex++]));
        }
        await Promise.all(actions);
    }
    if (assetFiles?.length) {
        const copyAssetFile = async (asset) => {
            // Ensure output subdirectories exist
            const destPath = (0, node_path_1.join)('browser', asset.destination);
            const basePath = node_path_1.default.dirname(destPath);
            if (basePath && !directoryExists.has(basePath)) {
                await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
                directoryExists.add(basePath);
            }
            // Copy file contents
            await promises_1.default.copyFile(asset.source, node_path_1.default.join(outputPath, destPath), node_fs_1.constants.COPYFILE_FICLONE);
        };
        for (let fileIndex = 0; fileIndex < assetFiles.length;) {
            const groupMax = Math.min(fileIndex + MAX_CONCURRENT_WRITES, assetFiles.length);
            const actions = [];
            while (fileIndex < groupMax) {
                actions.push(copyAssetFile(assetFiles[fileIndex++]));
            }
            await Promise.all(actions);
        }
    }
}
exports.writeResultFiles = writeResultFiles;
function createOutputFileFromText(path, text, type) {
    return {
        path,
        text,
        type,
        get hash() {
            return (0, node_crypto_1.createHash)('sha256').update(this.text).digest('hex');
        },
        get contents() {
            return Buffer.from(this.text, 'utf-8');
        },
        get fullOutputPath() {
            return getFullOutputPath(this);
        },
        clone() {
            return createOutputFileFromText(this.path, this.text, this.type);
        },
    };
}
exports.createOutputFileFromText = createOutputFileFromText;
function createOutputFileFromData(path, data, type) {
    return {
        path,
        type,
        get text() {
            return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf-8');
        },
        get hash() {
            return (0, node_crypto_1.createHash)('sha256').update(this.text).digest('hex');
        },
        get contents() {
            return data;
        },
        get fullOutputPath() {
            return getFullOutputPath(this);
        },
        clone() {
            return createOutputFileFromData(this.path, this.contents, this.type);
        },
    };
}
exports.createOutputFileFromData = createOutputFileFromData;
function getFullOutputPath(file) {
    switch (file.type) {
        case bundler_context_1.BuildOutputFileType.Browser:
        case bundler_context_1.BuildOutputFileType.Media:
            return (0, node_path_1.join)('browser', file.path);
        case bundler_context_1.BuildOutputFileType.Server:
            return (0, node_path_1.join)('server', file.path);
        default:
            return file.path;
    }
}
exports.getFullOutputPath = getFullOutputPath;
/**
 * Transform browserlists result to esbuild target.
 * @see https://esbuild.github.io/api/#target
 */
function transformSupportedBrowsersToTargets(supportedBrowsers) {
    const transformed = [];
    // https://esbuild.github.io/api/#target
    const esBuildSupportedBrowsers = new Set([
        'chrome',
        'edge',
        'firefox',
        'ie',
        'ios',
        'node',
        'opera',
        'safari',
    ]);
    for (const browser of supportedBrowsers) {
        let [browserName, version] = browser.toLowerCase().split(' ');
        // browserslist uses the name `ios_saf` for iOS Safari whereas esbuild uses `ios`
        if (browserName === 'ios_saf') {
            browserName = 'ios';
        }
        // browserslist uses ranges `15.2-15.3` versions but only the lowest is required
        // to perform minimum supported feature checks. esbuild also expects a single version.
        [version] = version.split('-');
        if (esBuildSupportedBrowsers.has(browserName)) {
            if (browserName === 'safari' && version === 'tp') {
                // esbuild only supports numeric versions so `TP` is converted to a high number (999) since
                // a Technology Preview (TP) of Safari is assumed to support all currently known features.
                version = '999';
            }
            else if (!version.includes('.')) {
                // A lone major version is considered by esbuild to include all minor versions. However,
                // browserslist does not and is also inconsistent in its `.0` version naming. For example,
                // Safari 15.0 is named `safari 15` but Safari 16.0 is named `safari 16.0`.
                version += '.0';
            }
            transformed.push(browserName + version);
        }
    }
    return transformed;
}
exports.transformSupportedBrowsersToTargets = transformSupportedBrowsersToTargets;
const SUPPORTED_NODE_VERSIONS = '>=18.13.0';
/**
 * Transform supported Node.js versions to esbuild target.
 * @see https://esbuild.github.io/api/#target
 */
function getSupportedNodeTargets() {
    if (SUPPORTED_NODE_VERSIONS.charAt(0) === '0') {
        // Unlike `pkg_npm`, `ts_library` which is used to run unit tests does not support substitutions.
        return [];
    }
    return SUPPORTED_NODE_VERSIONS.split('||').map((v) => 'node' + (0, semver_1.coerce)(v)?.version);
}
exports.getSupportedNodeTargets = getSupportedNodeTargets;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gscUNBQTZGO0FBQzdGLDZDQUF5QztBQUN6QyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLHVEQUF1QztBQUN2Qyx5Q0FBc0M7QUFDdEMseUNBQTJDO0FBQzNDLG1DQUFnQztBQUVoQyxpREFBOEM7QUFDOUMsa0RBQThFO0FBQzlFLHVEQUE0RjtBQUU1RixNQUFNLGFBQWEsR0FBRyxJQUFBLHFCQUFTLEVBQUMsMEJBQWMsQ0FBQyxDQUFDO0FBRWhELFNBQWdCLGFBQWEsQ0FDM0IsT0FBdUIsRUFDdkIsUUFBa0IsRUFDbEIsT0FBdUMsRUFDdkMsY0FBb0QsRUFDcEQsc0JBQTRDO0lBRTVDLE1BQU0sS0FBSyxHQUFrQixFQUFFLENBQUM7SUFDaEMsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzdELHdDQUF3QztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDbkQsU0FBUztTQUNWO1FBQ0Qsb0NBQW9DO1FBQ3BDLDhEQUE4RDtRQUM5RCxJQUFLLE1BQWMsQ0FBQyxjQUFjLENBQUMsRUFBRTtZQUNuQyxTQUFTO1NBQ1Y7UUFFRCxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQztRQUNuQyxJQUFJLElBQUksS0FBSyxTQUFTLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUMzQyxJQUFJLEdBQUcsbUJBQUk7aUJBQ1IsUUFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7aUJBQzNCLE9BQU8sQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDO2lCQUM1QixPQUFPLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQzVCO1FBRUQsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztZQUMxQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLHNCQUFzQixFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUM7U0FDbkYsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFBLCtCQUF1QixFQUN2QyxLQUFLLEVBQ0wsSUFBSSxFQUNKLElBQUksRUFDSixDQUFDLENBQUMsc0JBQXNCLEVBQ3hCLGNBQWMsQ0FDZixDQUFDO0lBRUYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLFNBQVMsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBMUNELHNDQTBDQztBQUVNLEtBQUssVUFBVSwrQkFBK0IsQ0FDbkQsV0FBeUI7SUFFekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7SUFDeEMsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7SUFFOUIsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUU7UUFDcEMsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3pFLFNBQVM7U0FDVjtRQUVELHNHQUFzRztRQUN0RyxnQ0FBZ0M7UUFDaEMsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxJQUFJLEVBQUU7WUFDekMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDM0QsU0FBUztTQUNWO1FBRUQsa0JBQWtCLENBQUMsSUFBSSxDQUNyQixhQUFhLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQ2pELEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQzlDLENBQ0YsQ0FBQztLQUNIO0lBRUQsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFFdEMsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBN0JELDBFQTZCQztBQUVNLEtBQUssVUFBVSxXQUFXLENBQUksSUFBWSxFQUFFLE1BQTRCO0lBQzdFLE1BQU0sT0FBTyxHQUFHLElBQUksaUJBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7SUFFaEIsSUFBSTtRQUNGLE9BQU8sTUFBTSxNQUFNLEVBQUUsQ0FBQztLQUN2QjtZQUFTO1FBQ1IsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO0tBQ2hCO0FBQ0gsQ0FBQztBQVRELGtDQVNDO0FBRU0sS0FBSyxVQUFVLGNBQWMsQ0FBSSxJQUFZLEVBQUUsTUFBNEI7SUFDaEYsT0FBTyxNQUFNLEVBQUUsQ0FBQztBQUNsQixDQUFDO0FBRkQsd0NBRUM7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUMvQixPQUF1QixFQUN2QixFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQThEO0lBRWhGLElBQUksUUFBUSxFQUFFLE1BQU0sRUFBRTtRQUNwQixNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNqRDtJQUVELElBQUksTUFBTSxFQUFFLE1BQU0sRUFBRTtRQUNsQixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ25GLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNoRDtBQUNILENBQUM7QUFiRCxrQ0FhQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBZ0IsaUJBQWlCLENBQUMsTUFBZ0I7SUFDaEQsTUFBTSxTQUFTLEdBQTRCO1FBQ3pDLHNGQUFzRjtRQUN0RixzR0FBc0c7UUFDdEcsYUFBYSxFQUFFLEtBQUs7UUFDcEIscUdBQXFHO1FBQ3JHLG9HQUFvRztRQUNwRyw4RUFBOEU7UUFDOUUsMEVBQTBFO1FBQzFFLG9CQUFvQixFQUFFLEtBQUs7S0FDNUIsQ0FBQztJQUVGLHNFQUFzRTtJQUN0RSxtRkFBbUY7SUFDbkYsd0ZBQXdGO0lBQ3hGLElBQUksd0JBQXdCLEdBQUcsS0FBSyxDQUFDO0lBQ3JDLEtBQUssTUFBTSxPQUFPLElBQUksTUFBTSxFQUFFO1FBQzVCLElBQUksWUFBWSxDQUFDO1FBQ2pCLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUM3QixZQUFZLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDNUM7YUFBTSxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdkMsWUFBWSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzVDO2FBQU07WUFDTCxTQUFTO1NBQ1Y7UUFDRCwwRkFBMEY7UUFDMUYsaUZBQWlGO1FBQ2pGLElBQUksWUFBWSxLQUFLLEVBQUUsSUFBSSxZQUFZLEtBQUssRUFBRSxFQUFFO1lBQzlDLHdCQUF3QixHQUFHLElBQUksQ0FBQztZQUNoQyxNQUFNO1NBQ1A7S0FDRjtJQUNELHlGQUF5RjtJQUN6RixnREFBZ0Q7SUFDaEQsSUFBSSx3QkFBd0IsRUFBRTtRQUM1QixTQUFTLENBQUMsYUFBYSxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQ2pDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEtBQUssQ0FBQztLQUN6QztJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUF4Q0QsOENBd0NDO0FBRUQsTUFBTSxxQkFBcUIsR0FBRyxFQUFFLENBQUM7QUFFMUIsS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxXQUE4QixFQUM5QixVQUFpRSxFQUNqRSxVQUFrQjtJQUVsQixNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBRTFDLG9GQUFvRjtJQUNwRixNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUUsSUFBcUIsRUFBRSxFQUFFO1FBQ3RELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDM0MscUNBQXFDO1FBQ3JDLE1BQU0sUUFBUSxHQUFHLG1CQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzlDLElBQUksUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUM5QyxNQUFNLGtCQUFFLENBQUMsS0FBSyxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3JFLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDL0I7UUFDRCxzQkFBc0I7UUFDdEIsTUFBTSxrQkFBRSxDQUFDLFNBQVMsQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsY0FBYyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzNFLENBQUMsQ0FBQztJQUVGLDhFQUE4RTtJQUM5RSxLQUFLLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBSTtRQUN4RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxxQkFBcUIsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFakYsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ25CLE9BQU8sU0FBUyxHQUFHLFFBQVEsRUFBRTtZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDekQ7UUFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7S0FDNUI7SUFFRCxJQUFJLFVBQVUsRUFBRSxNQUFNLEVBQUU7UUFDdEIsTUFBTSxhQUFhLEdBQUcsS0FBSyxFQUFFLEtBQThDLEVBQUUsRUFBRTtZQUM3RSxxQ0FBcUM7WUFDckMsTUFBTSxRQUFRLEdBQUcsSUFBQSxnQkFBSSxFQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDcEQsTUFBTSxRQUFRLEdBQUcsbUJBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDeEMsSUFBSSxRQUFRLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM5QyxNQUFNLGtCQUFFLENBQUMsS0FBSyxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRSxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQy9CO1lBQ0QscUJBQXFCO1lBQ3JCLE1BQU0sa0JBQUUsQ0FBQyxRQUFRLENBQ2YsS0FBSyxDQUFDLE1BQU0sRUFDWixtQkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLEVBQy9CLG1CQUFXLENBQUMsZ0JBQWdCLENBQzdCLENBQUM7UUFDSixDQUFDLENBQUM7UUFFRixLQUFLLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sR0FBSTtZQUN2RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxxQkFBcUIsRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFaEYsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ25CLE9BQU8sU0FBUyxHQUFHLFFBQVEsRUFBRTtnQkFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3REO1lBRUQsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQzVCO0tBQ0Y7QUFDSCxDQUFDO0FBNURELDRDQTREQztBQUVELFNBQWdCLHdCQUF3QixDQUN0QyxJQUFZLEVBQ1osSUFBWSxFQUNaLElBQXlCO0lBRXpCLE9BQU87UUFDTCxJQUFJO1FBQ0osSUFBSTtRQUNKLElBQUk7UUFDSixJQUFJLElBQUk7WUFDTixPQUFPLElBQUEsd0JBQVUsRUFBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBQ0QsSUFBSSxRQUFRO1lBQ1YsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUNELElBQUksY0FBYztZQUNoQixPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFDRCxLQUFLO1lBQ0gsT0FBTyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25FLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXRCRCw0REFzQkM7QUFFRCxTQUFnQix3QkFBd0IsQ0FDdEMsSUFBWSxFQUNaLElBQWdCLEVBQ2hCLElBQXlCO0lBRXpCLE9BQU87UUFDTCxJQUFJO1FBQ0osSUFBSTtRQUNKLElBQUksSUFBSTtZQUNOLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBQ0QsSUFBSSxJQUFJO1lBQ04sT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUNELElBQUksUUFBUTtZQUNWLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksY0FBYztZQUNoQixPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFDRCxLQUFLO1lBQ0gsT0FBTyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXhCRCw0REF3QkM7QUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxJQUFxQjtJQUNyRCxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDakIsS0FBSyxxQ0FBbUIsQ0FBQyxPQUFPLENBQUM7UUFDakMsS0FBSyxxQ0FBbUIsQ0FBQyxLQUFLO1lBQzVCLE9BQU8sSUFBQSxnQkFBSSxFQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEMsS0FBSyxxQ0FBbUIsQ0FBQyxNQUFNO1lBQzdCLE9BQU8sSUFBQSxnQkFBSSxFQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkM7WUFDRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7S0FDcEI7QUFDSCxDQUFDO0FBVkQsOENBVUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQixtQ0FBbUMsQ0FBQyxpQkFBMkI7SUFDN0UsTUFBTSxXQUFXLEdBQWEsRUFBRSxDQUFDO0lBRWpDLHdDQUF3QztJQUN4QyxNQUFNLHdCQUF3QixHQUFHLElBQUksR0FBRyxDQUFDO1FBQ3ZDLFFBQVE7UUFDUixNQUFNO1FBQ04sU0FBUztRQUNULElBQUk7UUFDSixLQUFLO1FBQ0wsTUFBTTtRQUNOLE9BQU87UUFDUCxRQUFRO0tBQ1QsQ0FBQyxDQUFDO0lBRUgsS0FBSyxNQUFNLE9BQU8sSUFBSSxpQkFBaUIsRUFBRTtRQUN2QyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFOUQsaUZBQWlGO1FBQ2pGLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtZQUM3QixXQUFXLEdBQUcsS0FBSyxDQUFDO1NBQ3JCO1FBRUQsZ0ZBQWdGO1FBQ2hGLHNGQUFzRjtRQUN0RixDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFL0IsSUFBSSx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDN0MsSUFBSSxXQUFXLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7Z0JBQ2hELDJGQUEyRjtnQkFDM0YsMEZBQTBGO2dCQUMxRixPQUFPLEdBQUcsS0FBSyxDQUFDO2FBQ2pCO2lCQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNqQyx3RkFBd0Y7Z0JBQ3hGLDBGQUEwRjtnQkFDMUYsMkVBQTJFO2dCQUMzRSxPQUFPLElBQUksSUFBSSxDQUFDO2FBQ2pCO1lBRUQsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUM7U0FDekM7S0FDRjtJQUVELE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUE1Q0Qsa0ZBNENDO0FBRUQsTUFBTSx1QkFBdUIsR0FBRyxvQkFBb0IsQ0FBQztBQUVyRDs7O0dBR0c7QUFDSCxTQUFnQix1QkFBdUI7SUFDckMsSUFBSSx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQzdDLGlHQUFpRztRQUNqRyxPQUFPLEVBQUUsQ0FBQztLQUNYO0lBRUQsT0FBTyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLEdBQUcsSUFBQSxlQUFNLEVBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDckYsQ0FBQztBQVBELDBEQU9DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBCdWlsZE9wdGlvbnMsIE1ldGFmaWxlLCBPdXRwdXRGaWxlLCBQYXJ0aWFsTWVzc2FnZSwgZm9ybWF0TWVzc2FnZXMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyBjb25zdGFudHMgYXMgZnNDb25zdGFudHMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoLCB7IGpvaW4gfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCB7IGJyb3RsaUNvbXByZXNzIH0gZnJvbSAnbm9kZTp6bGliJztcbmltcG9ydCB7IGNvZXJjZSB9IGZyb20gJ3NlbXZlcic7XG5pbXBvcnQgeyBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0IH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgQnVuZGxlU3RhdHMsIGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlIH0gZnJvbSAnLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUsIEluaXRpYWxGaWxlUmVjb3JkIH0gZnJvbSAnLi9idW5kbGVyLWNvbnRleHQnO1xuXG5jb25zdCBjb21wcmVzc0FzeW5jID0gcHJvbWlzaWZ5KGJyb3RsaUNvbXByZXNzKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ0J1aWxkU3RhdHMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBtZXRhZmlsZTogTWV0YWZpbGUsXG4gIGluaXRpYWw6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPixcbiAgYnVkZ2V0RmFpbHVyZXM6IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSB8IHVuZGVmaW5lZCxcbiAgZXN0aW1hdGVkVHJhbnNmZXJTaXplcz86IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4pOiB2b2lkIHtcbiAgY29uc3Qgc3RhdHM6IEJ1bmRsZVN0YXRzW10gPSBbXTtcbiAgZm9yIChjb25zdCBbZmlsZSwgb3V0cHV0XSBvZiBPYmplY3QuZW50cmllcyhtZXRhZmlsZS5vdXRwdXRzKSkge1xuICAgIC8vIE9ubHkgZGlzcGxheSBKYXZhU2NyaXB0IGFuZCBDU1MgZmlsZXNcbiAgICBpZiAoIWZpbGUuZW5kc1dpdGgoJy5qcycpICYmICFmaWxlLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBTa2lwIGludGVybmFsIGNvbXBvbmVudCByZXNvdXJjZXNcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGlmICgob3V0cHV0IGFzIGFueSlbJ25nLWNvbXBvbmVudCddKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsZXQgbmFtZSA9IGluaXRpYWwuZ2V0KGZpbGUpPy5uYW1lO1xuICAgIGlmIChuYW1lID09PSB1bmRlZmluZWQgJiYgb3V0cHV0LmVudHJ5UG9pbnQpIHtcbiAgICAgIG5hbWUgPSBwYXRoXG4gICAgICAgIC5iYXNlbmFtZShvdXRwdXQuZW50cnlQb2ludClcbiAgICAgICAgLnJlcGxhY2UoL1xcLltjbV0/W2p0XXMkLywgJycpXG4gICAgICAgIC5yZXBsYWNlKC9bXFxcXC8uXS9nLCAnLScpO1xuICAgIH1cblxuICAgIHN0YXRzLnB1c2goe1xuICAgICAgaW5pdGlhbDogaW5pdGlhbC5oYXMoZmlsZSksXG4gICAgICBzdGF0czogW2ZpbGUsIG5hbWUgPz8gJy0nLCBvdXRwdXQuYnl0ZXMsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM/LmdldChmaWxlKSA/PyAnLSddLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdGFibGVUZXh0ID0gZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUoXG4gICAgc3RhdHMsXG4gICAgdHJ1ZSxcbiAgICB0cnVlLFxuICAgICEhZXN0aW1hdGVkVHJhbnNmZXJTaXplcyxcbiAgICBidWRnZXRGYWlsdXJlcyxcbiAgKTtcblxuICBjb250ZXh0LmxvZ2dlci5pbmZvKCdcXG4nICsgdGFibGVUZXh0ICsgJ1xcbicpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsY3VsYXRlRXN0aW1hdGVkVHJhbnNmZXJTaXplcyhcbiAgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSxcbik6IFByb21pc2U8TWFwPHN0cmluZywgbnVtYmVyPj4ge1xuICBjb25zdCBzaXplcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIGNvbnN0IHBlbmRpbmdDb21wcmVzc2lvbiA9IFtdO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiBvdXRwdXRGaWxlcykge1xuICAgIC8vIE9ubHkgY2FsY3VsYXRlIEphdmFTY3JpcHQgYW5kIENTUyBmaWxlc1xuICAgIGlmICghb3V0cHV0RmlsZS5wYXRoLmVuZHNXaXRoKCcuanMnKSAmJiAhb3V0cHV0RmlsZS5wYXRoLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFNraXAgY29tcHJlc3Npbmcgc21hbGwgZmlsZXMgd2hpY2ggbWF5IGVuZCBiZWluZyBsYXJnZXIgb25jZSBjb21wcmVzc2VkIGFuZCB3aWxsIG1vc3QgbGlrZWx5IG5vdCBiZVxuICAgIC8vIGNvbXByZXNzZWQgaW4gYWN0dWFsIHRyYW5zaXQuXG4gICAgaWYgKG91dHB1dEZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCA8IDEwMjQpIHtcbiAgICAgIHNpemVzLnNldChvdXRwdXRGaWxlLnBhdGgsIG91dHB1dEZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwZW5kaW5nQ29tcHJlc3Npb24ucHVzaChcbiAgICAgIGNvbXByZXNzQXN5bmMob3V0cHV0RmlsZS5jb250ZW50cykudGhlbigocmVzdWx0KSA9PlxuICAgICAgICBzaXplcy5zZXQob3V0cHV0RmlsZS5wYXRoLCByZXN1bHQuYnl0ZUxlbmd0aCksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhd2FpdCBQcm9taXNlLmFsbChwZW5kaW5nQ29tcHJlc3Npb24pO1xuXG4gIHJldHVybiBzaXplcztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhTcGlubmVyPFQ+KHRleHQ6IHN0cmluZywgYWN0aW9uOiAoKSA9PiBUIHwgUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIodGV4dCk7XG4gIHNwaW5uZXIuc3RhcnQoKTtcblxuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBhY3Rpb24oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzcGlubmVyLnN0b3AoKTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aE5vUHJvZ3Jlc3M8VD4odGV4dDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQgfCBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIHJldHVybiBhY3Rpb24oKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ01lc3NhZ2VzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgeyBlcnJvcnMsIHdhcm5pbmdzIH06IHsgZXJyb3JzPzogUGFydGlhbE1lc3NhZ2VbXTsgd2FybmluZ3M/OiBQYXJ0aWFsTWVzc2FnZVtdIH0sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHdhcm5pbmdzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB3YXJuaW5nTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyh3YXJuaW5ncywgeyBraW5kOiAnd2FybmluZycsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZ01lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIGlmIChlcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IGVycm9yTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyhlcnJvcnMsIHsga2luZDogJ2Vycm9yJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3JNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBzeW50YXggZmVhdHVyZSBvYmplY3QgbWFwIGZvciBBbmd1bGFyIGFwcGxpY2F0aW9ucyBiYXNlZCBvbiBhIGxpc3Qgb2YgdGFyZ2V0cy5cbiAqIEEgZnVsbCBzZXQgb2YgZmVhdHVyZSBuYW1lcyBjYW4gYmUgZm91bmQgaGVyZTogaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3N1cHBvcnRlZFxuICogQHBhcmFtIHRhcmdldCBBbiBhcnJheSBvZiBicm93c2VyL2VuZ2luZSB0YXJnZXRzIGluIHRoZSBmb3JtYXQgYWNjZXB0ZWQgYnkgdGhlIGVzYnVpbGQgYHRhcmdldGAgb3B0aW9uLlxuICogQHJldHVybnMgQW4gb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgd2l0aCB0aGUgZXNidWlsZCBidWlsZCBgc3VwcG9ydGVkYCBvcHRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQ6IHN0cmluZ1tdKTogQnVpbGRPcHRpb25zWydzdXBwb3J0ZWQnXSB7XG4gIGNvbnN0IHN1cHBvcnRlZDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7XG4gICAgLy8gTmF0aXZlIGFzeW5jL2F3YWl0IGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBab25lLmpzLiBEaXNhYmxpbmcgc3VwcG9ydCBoZXJlIHdpbGwgY2F1c2VcbiAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCwgYXN5bmMgZ2VuZXJhdG9ycywgYW5kIGZvciBhd2FpdC4uLm9mIHRvIGEgWm9uZS5qcyBzdXBwb3J0ZWQgZm9ybS5cbiAgICAnYXN5bmMtYXdhaXQnOiBmYWxzZSxcbiAgICAvLyBWOCBjdXJyZW50bHkgaGFzIGEgcGVyZm9ybWFuY2UgZGVmZWN0IGludm9sdmluZyBvYmplY3Qgc3ByZWFkIG9wZXJhdGlvbnMgdGhhdCBjYW4gY2F1c2Ugc2lnbmZpY2FudFxuICAgIC8vIGRlZ3JhZGF0aW9uIGluIHJ1bnRpbWUgcGVyZm9ybWFuY2UuIEJ5IG5vdCBzdXBwb3J0aW5nIHRoZSBsYW5ndWFnZSBmZWF0dXJlIGhlcmUsIGEgZG93bmxldmVsIGZvcm1cbiAgICAvLyB3aWxsIGJlIHVzZWQgaW5zdGVhZCB3aGljaCBwcm92aWRlcyBhIHdvcmthcm91bmQgZm9yIHRoZSBwZXJmb3JtYW5jZSBpc3N1ZS5cbiAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0xMTUzNlxuICAgICdvYmplY3QtcmVzdC1zcHJlYWQnOiBmYWxzZSxcbiAgfTtcblxuICAvLyBEZXRlY3QgU2FmYXJpIGJyb3dzZXIgdmVyc2lvbnMgdGhhdCBoYXZlIGEgY2xhc3MgZmllbGQgYmVoYXZpb3IgYnVnXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI0MzU1I2lzc3VlY29tbWVudC0xMzMzNDc3MDMzXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1dlYktpdC9XZWJLaXQvY29tbWl0L2U4Nzg4YTM0YjNkNWY1YjRlZGQ3ZmY2NDUwYjgwOTM2YmZmMzk2ZjJcbiAgbGV0IHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IGZhbHNlO1xuICBmb3IgKGNvbnN0IGJyb3dzZXIgb2YgdGFyZ2V0KSB7XG4gICAgbGV0IG1ham9yVmVyc2lvbjtcbiAgICBpZiAoYnJvd3Nlci5zdGFydHNXaXRoKCdpb3MnKSkge1xuICAgICAgbWFqb3JWZXJzaW9uID0gTnVtYmVyKGJyb3dzZXIuc2xpY2UoMywgNSkpO1xuICAgIH0gZWxzZSBpZiAoYnJvd3Nlci5zdGFydHNXaXRoKCdzYWZhcmknKSkge1xuICAgICAgbWFqb3JWZXJzaW9uID0gTnVtYmVyKGJyb3dzZXIuc2xpY2UoNiwgOCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gVGVjaG5pY2FsbHksIDE0LjAgaXMgbm90IGJyb2tlbiBidXQgcmF0aGVyIGRvZXMgbm90IGhhdmUgc3VwcG9ydC4gSG93ZXZlciwgdGhlIGJlaGF2aW9yXG4gICAgLy8gaXMgaWRlbnRpY2FsIHNpbmNlIGl0IHdvdWxkIGJlIHNldCB0byBmYWxzZSBieSBlc2J1aWxkIGlmIHByZXNlbnQgYXMgYSB0YXJnZXQuXG4gICAgaWYgKG1ham9yVmVyc2lvbiA9PT0gMTQgfHwgbWFqb3JWZXJzaW9uID09PSAxNSkge1xuICAgICAgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICAvLyBJZiBjbGFzcyBmaWVsZCBzdXBwb3J0IGNhbm5vdCBiZSB1c2VkIHNldCB0byBmYWxzZTsgb3RoZXJ3aXNlIGxlYXZlIHVuZGVmaW5lZCB0byBhbGxvd1xuICAvLyBlc2J1aWxkIHRvIHVzZSBgdGFyZ2V0YCB0byBkZXRlcm1pbmUgc3VwcG9ydC5cbiAgaWYgKHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1Zykge1xuICAgIHN1cHBvcnRlZFsnY2xhc3MtZmllbGQnXSA9IGZhbHNlO1xuICAgIHN1cHBvcnRlZFsnY2xhc3Mtc3RhdGljLWZpZWxkJ10gPSBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBzdXBwb3J0ZWQ7XG59XG5cbmNvbnN0IE1BWF9DT05DVVJSRU5UX1dSSVRFUyA9IDY0O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVSZXN1bHRGaWxlcyhcbiAgb3V0cHV0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSB8IHVuZGVmaW5lZCxcbiAgb3V0cHV0UGF0aDogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IGRpcmVjdG9yeUV4aXN0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIC8vIFdyaXRlcyB0aGUgb3V0cHV0IGZpbGUgdG8gZGlzayBhbmQgZW5zdXJlcyB0aGUgY29udGFpbmluZyBkaXJlY3RvcmllcyBhcmUgcHJlc2VudFxuICBjb25zdCB3cml0ZU91dHB1dEZpbGUgPSBhc3luYyAoZmlsZTogQnVpbGRPdXRwdXRGaWxlKSA9PiB7XG4gICAgY29uc3QgZnVsbE91dHB1dFBhdGggPSBmaWxlLmZ1bGxPdXRwdXRQYXRoO1xuICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShmdWxsT3V0cHV0UGF0aCk7XG4gICAgaWYgKGJhc2VQYXRoICYmICFkaXJlY3RvcnlFeGlzdHMuaGFzKGJhc2VQYXRoKSkge1xuICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICB9XG4gICAgLy8gV3JpdGUgZmlsZSBjb250ZW50c1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZnVsbE91dHB1dFBhdGgpLCBmaWxlLmNvbnRlbnRzKTtcbiAgfTtcblxuICAvLyBXcml0ZSBmaWxlcyBpbiBncm91cHMgb2YgTUFYX0NPTkNVUlJFTlRfV1JJVEVTIHRvIGF2b2lkIHRvbyBtYW55IG9wZW4gZmlsZXNcbiAgZm9yIChsZXQgZmlsZUluZGV4ID0gMDsgZmlsZUluZGV4IDwgb3V0cHV0RmlsZXMubGVuZ3RoOyApIHtcbiAgICBjb25zdCBncm91cE1heCA9IE1hdGgubWluKGZpbGVJbmRleCArIE1BWF9DT05DVVJSRU5UX1dSSVRFUywgb3V0cHV0RmlsZXMubGVuZ3RoKTtcblxuICAgIGNvbnN0IGFjdGlvbnMgPSBbXTtcbiAgICB3aGlsZSAoZmlsZUluZGV4IDwgZ3JvdXBNYXgpIHtcbiAgICAgIGFjdGlvbnMucHVzaCh3cml0ZU91dHB1dEZpbGUob3V0cHV0RmlsZXNbZmlsZUluZGV4KytdKSk7XG4gICAgfVxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoYWN0aW9ucyk7XG4gIH1cblxuICBpZiAoYXNzZXRGaWxlcz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgY29weUFzc2V0RmlsZSA9IGFzeW5jIChhc3NldDogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9KSA9PiB7XG4gICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICBjb25zdCBkZXN0UGF0aCA9IGpvaW4oJ2Jyb3dzZXInLCBhc3NldC5kZXN0aW5hdGlvbik7XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShkZXN0UGF0aCk7XG4gICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgIH1cbiAgICAgIC8vIENvcHkgZmlsZSBjb250ZW50c1xuICAgICAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgICAgIGFzc2V0LnNvdXJjZSxcbiAgICAgICAgcGF0aC5qb2luKG91dHB1dFBhdGgsIGRlc3RQYXRoKSxcbiAgICAgICAgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSxcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGZvciAobGV0IGZpbGVJbmRleCA9IDA7IGZpbGVJbmRleCA8IGFzc2V0RmlsZXMubGVuZ3RoOyApIHtcbiAgICAgIGNvbnN0IGdyb3VwTWF4ID0gTWF0aC5taW4oZmlsZUluZGV4ICsgTUFYX0NPTkNVUlJFTlRfV1JJVEVTLCBhc3NldEZpbGVzLmxlbmd0aCk7XG5cbiAgICAgIGNvbnN0IGFjdGlvbnMgPSBbXTtcbiAgICAgIHdoaWxlIChmaWxlSW5kZXggPCBncm91cE1heCkge1xuICAgICAgICBhY3Rpb25zLnB1c2goY29weUFzc2V0RmlsZShhc3NldEZpbGVzW2ZpbGVJbmRleCsrXSkpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChhY3Rpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChcbiAgcGF0aDogc3RyaW5nLFxuICB0ZXh0OiBzdHJpbmcsXG4gIHR5cGU6IEJ1aWxkT3V0cHV0RmlsZVR5cGUsXG4pOiBCdWlsZE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdGV4dCxcbiAgICB0eXBlLFxuICAgIGdldCBoYXNoKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZSh0aGlzLnRleHQpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgfSxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20odGhpcy50ZXh0LCAndXRmLTgnKTtcbiAgICB9LFxuICAgIGdldCBmdWxsT3V0cHV0UGF0aCgpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIGdldEZ1bGxPdXRwdXRQYXRoKHRoaXMpO1xuICAgIH0sXG4gICAgY2xvbmUoKTogQnVpbGRPdXRwdXRGaWxlIHtcbiAgICAgIHJldHVybiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQodGhpcy5wYXRoLCB0aGlzLnRleHQsIHRoaXMudHlwZSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tRGF0YShcbiAgcGF0aDogc3RyaW5nLFxuICBkYXRhOiBVaW50OEFycmF5LFxuICB0eXBlOiBCdWlsZE91dHB1dEZpbGVUeXBlLFxuKTogQnVpbGRPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHR5cGUsXG4gICAgZ2V0IHRleHQoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20oZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCwgZGF0YS5ieXRlTGVuZ3RoKS50b1N0cmluZygndXRmLTgnKTtcbiAgICB9LFxuICAgIGdldCBoYXNoKCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZSh0aGlzLnRleHQpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgfSxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuICAgIGdldCBmdWxsT3V0cHV0UGF0aCgpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIGdldEZ1bGxPdXRwdXRQYXRoKHRoaXMpO1xuICAgIH0sXG4gICAgY2xvbmUoKTogQnVpbGRPdXRwdXRGaWxlIHtcbiAgICAgIHJldHVybiBjcmVhdGVPdXRwdXRGaWxlRnJvbURhdGEodGhpcy5wYXRoLCB0aGlzLmNvbnRlbnRzLCB0aGlzLnR5cGUpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGdWxsT3V0cHV0UGF0aChmaWxlOiBCdWlsZE91dHB1dEZpbGUpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGZpbGUudHlwZSkge1xuICAgIGNhc2UgQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyOlxuICAgIGNhc2UgQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYTpcbiAgICAgIHJldHVybiBqb2luKCdicm93c2VyJywgZmlsZS5wYXRoKTtcbiAgICBjYXNlIEJ1aWxkT3V0cHV0RmlsZVR5cGUuU2VydmVyOlxuICAgICAgcmV0dXJuIGpvaW4oJ3NlcnZlcicsIGZpbGUucGF0aCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmaWxlLnBhdGg7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYnJvd3Nlcmxpc3RzIHJlc3VsdCB0byBlc2J1aWxkIHRhcmdldC5cbiAqIEBzZWUgaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3RhcmdldFxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoc3VwcG9ydGVkQnJvd3NlcnM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICBjb25zdCB0cmFuc2Zvcm1lZDogc3RyaW5nW10gPSBbXTtcblxuICAvLyBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jdGFyZ2V0XG4gIGNvbnN0IGVzQnVpbGRTdXBwb3J0ZWRCcm93c2VycyA9IG5ldyBTZXQoW1xuICAgICdjaHJvbWUnLFxuICAgICdlZGdlJyxcbiAgICAnZmlyZWZveCcsXG4gICAgJ2llJyxcbiAgICAnaW9zJyxcbiAgICAnbm9kZScsXG4gICAgJ29wZXJhJyxcbiAgICAnc2FmYXJpJyxcbiAgXSk7XG5cbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgbGV0IFticm93c2VyTmFtZSwgdmVyc2lvbl0gPSBicm93c2VyLnRvTG93ZXJDYXNlKCkuc3BsaXQoJyAnKTtcblxuICAgIC8vIGJyb3dzZXJzbGlzdCB1c2VzIHRoZSBuYW1lIGBpb3Nfc2FmYCBmb3IgaU9TIFNhZmFyaSB3aGVyZWFzIGVzYnVpbGQgdXNlcyBgaW9zYFxuICAgIGlmIChicm93c2VyTmFtZSA9PT0gJ2lvc19zYWYnKSB7XG4gICAgICBicm93c2VyTmFtZSA9ICdpb3MnO1xuICAgIH1cblxuICAgIC8vIGJyb3dzZXJzbGlzdCB1c2VzIHJhbmdlcyBgMTUuMi0xNS4zYCB2ZXJzaW9ucyBidXQgb25seSB0aGUgbG93ZXN0IGlzIHJlcXVpcmVkXG4gICAgLy8gdG8gcGVyZm9ybSBtaW5pbXVtIHN1cHBvcnRlZCBmZWF0dXJlIGNoZWNrcy4gZXNidWlsZCBhbHNvIGV4cGVjdHMgYSBzaW5nbGUgdmVyc2lvbi5cbiAgICBbdmVyc2lvbl0gPSB2ZXJzaW9uLnNwbGl0KCctJyk7XG5cbiAgICBpZiAoZXNCdWlsZFN1cHBvcnRlZEJyb3dzZXJzLmhhcyhicm93c2VyTmFtZSkpIHtcbiAgICAgIGlmIChicm93c2VyTmFtZSA9PT0gJ3NhZmFyaScgJiYgdmVyc2lvbiA9PT0gJ3RwJykge1xuICAgICAgICAvLyBlc2J1aWxkIG9ubHkgc3VwcG9ydHMgbnVtZXJpYyB2ZXJzaW9ucyBzbyBgVFBgIGlzIGNvbnZlcnRlZCB0byBhIGhpZ2ggbnVtYmVyICg5OTkpIHNpbmNlXG4gICAgICAgIC8vIGEgVGVjaG5vbG9neSBQcmV2aWV3IChUUCkgb2YgU2FmYXJpIGlzIGFzc3VtZWQgdG8gc3VwcG9ydCBhbGwgY3VycmVudGx5IGtub3duIGZlYXR1cmVzLlxuICAgICAgICB2ZXJzaW9uID0gJzk5OSc7XG4gICAgICB9IGVsc2UgaWYgKCF2ZXJzaW9uLmluY2x1ZGVzKCcuJykpIHtcbiAgICAgICAgLy8gQSBsb25lIG1ham9yIHZlcnNpb24gaXMgY29uc2lkZXJlZCBieSBlc2J1aWxkIHRvIGluY2x1ZGUgYWxsIG1pbm9yIHZlcnNpb25zLiBIb3dldmVyLFxuICAgICAgICAvLyBicm93c2Vyc2xpc3QgZG9lcyBub3QgYW5kIGlzIGFsc28gaW5jb25zaXN0ZW50IGluIGl0cyBgLjBgIHZlcnNpb24gbmFtaW5nLiBGb3IgZXhhbXBsZSxcbiAgICAgICAgLy8gU2FmYXJpIDE1LjAgaXMgbmFtZWQgYHNhZmFyaSAxNWAgYnV0IFNhZmFyaSAxNi4wIGlzIG5hbWVkIGBzYWZhcmkgMTYuMGAuXG4gICAgICAgIHZlcnNpb24gKz0gJy4wJztcbiAgICAgIH1cblxuICAgICAgdHJhbnNmb3JtZWQucHVzaChicm93c2VyTmFtZSArIHZlcnNpb24pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cmFuc2Zvcm1lZDtcbn1cblxuY29uc3QgU1VQUE9SVEVEX05PREVfVkVSU0lPTlMgPSAnMC4wLjAtRU5HSU5FUy1OT0RFJztcblxuLyoqXG4gKiBUcmFuc2Zvcm0gc3VwcG9ydGVkIE5vZGUuanMgdmVyc2lvbnMgdG8gZXNidWlsZCB0YXJnZXQuXG4gKiBAc2VlIGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyN0YXJnZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFN1cHBvcnRlZE5vZGVUYXJnZXRzKCk6IHN0cmluZ1tdIHtcbiAgaWYgKFNVUFBPUlRFRF9OT0RFX1ZFUlNJT05TLmNoYXJBdCgwKSA9PT0gJzAnKSB7XG4gICAgLy8gVW5saWtlIGBwa2dfbnBtYCwgYHRzX2xpYnJhcnlgIHdoaWNoIGlzIHVzZWQgdG8gcnVuIHVuaXQgdGVzdHMgZG9lcyBub3Qgc3VwcG9ydCBzdWJzdGl0dXRpb25zLlxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiBTVVBQT1JURURfTk9ERV9WRVJTSU9OUy5zcGxpdCgnfHwnKS5tYXAoKHYpID0+ICdub2RlJyArIGNvZXJjZSh2KT8udmVyc2lvbik7XG59XG4iXX0=