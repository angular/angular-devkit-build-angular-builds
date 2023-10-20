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
exports.getSupportedNodeTargets = exports.transformSupportedBrowsersToTargets = exports.getFullOutputPath = exports.convertOutputFile = exports.createOutputFileFromData = exports.createOutputFileFromText = exports.emitFilesToDisk = exports.writeResultFiles = exports.getFeatureSupport = exports.logMessages = exports.withNoProgress = exports.withSpinner = exports.calculateEstimatedTransferSizes = exports.logBuildStats = void 0;
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
async function writeResultFiles(outputFiles, assetFiles, outputPath) {
    const directoryExists = new Set();
    const ensureDirectoryExists = async (basePath) => {
        if (basePath && !directoryExists.has(basePath)) {
            await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
            directoryExists.add(basePath);
        }
    };
    // Writes the output file to disk and ensures the containing directories are present
    await emitFilesToDisk(outputFiles, async (file) => {
        const fullOutputPath = file.fullOutputPath;
        // Ensure output subdirectories exist
        const basePath = node_path_1.default.dirname(fullOutputPath);
        await ensureDirectoryExists(basePath);
        // Write file contents
        await promises_1.default.writeFile(node_path_1.default.join(outputPath, fullOutputPath), file.contents);
    });
    if (assetFiles?.length) {
        await emitFilesToDisk(assetFiles, async ({ source, destination }) => {
            // Ensure output subdirectories exist
            const destPath = (0, node_path_1.join)('browser', destination);
            const basePath = node_path_1.default.dirname(destPath);
            await ensureDirectoryExists(basePath);
            // Copy file contents
            await promises_1.default.copyFile(source, node_path_1.default.join(outputPath, destPath), node_fs_1.constants.COPYFILE_FICLONE);
        });
    }
}
exports.writeResultFiles = writeResultFiles;
const MAX_CONCURRENT_WRITES = 64;
async function emitFilesToDisk(files, writeFileCallback) {
    // Write files in groups of MAX_CONCURRENT_WRITES to avoid too many open files
    for (let fileIndex = 0; fileIndex < files.length;) {
        const groupMax = Math.min(fileIndex + MAX_CONCURRENT_WRITES, files.length);
        const actions = [];
        while (fileIndex < groupMax) {
            actions.push(writeFileCallback(files[fileIndex++]));
        }
        await Promise.all(actions);
    }
}
exports.emitFilesToDisk = emitFilesToDisk;
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
function convertOutputFile(file, type) {
    const { path, contents, hash } = file;
    return {
        contents,
        hash,
        path,
        type,
        get text() {
            return Buffer.from(this.contents.buffer, this.contents.byteOffset, this.contents.byteLength).toString('utf-8');
        },
        get fullOutputPath() {
            return getFullOutputPath(this);
        },
        clone() {
            return convertOutputFile(this, this.type);
        },
    };
}
exports.convertOutputFile = convertOutputFile;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gscUNBQTZGO0FBQzdGLDZDQUF5QztBQUN6QyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLHVEQUF1QztBQUN2Qyx5Q0FBc0M7QUFDdEMseUNBQTJDO0FBQzNDLG1DQUFnQztBQUVoQyxpREFBOEM7QUFDOUMsa0RBQThFO0FBQzlFLHVEQUE0RjtBQUc1RixNQUFNLGFBQWEsR0FBRyxJQUFBLHFCQUFTLEVBQUMsMEJBQWMsQ0FBQyxDQUFDO0FBRWhELFNBQWdCLGFBQWEsQ0FDM0IsT0FBdUIsRUFDdkIsUUFBa0IsRUFDbEIsT0FBdUMsRUFDdkMsY0FBb0QsRUFDcEQsc0JBQTRDO0lBRTVDLE1BQU0sS0FBSyxHQUFrQixFQUFFLENBQUM7SUFDaEMsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzdELHdDQUF3QztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDbkQsU0FBUztTQUNWO1FBQ0Qsb0NBQW9DO1FBQ3BDLDhEQUE4RDtRQUM5RCxJQUFLLE1BQWMsQ0FBQyxjQUFjLENBQUMsRUFBRTtZQUNuQyxTQUFTO1NBQ1Y7UUFFRCxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQztRQUNuQyxJQUFJLElBQUksS0FBSyxT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SSx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDN0MsSUFBSSxXQUFXLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7Z0JBQ2hELDJGQUEyRjtnQkFDM0YsMEZBQTBGO2dCQUMxRixPQUFPLEdBQUcsS0FBSyxDQUFDO2FBQ2pCO2lCQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNqQyx3RkFBd0Y7Z0JBQ3hGLDBGQUEwRjtnQkFDMUYsMkVBQTJFO2dCQUMzRSxPQUFPLElBQUksSUFBSSxDQUFDO2FBQ2pCO1lBRUQsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUM7U0FDekM7S0FDRjtJQUVELE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUE1Q0Qsa0ZBNENDO0FBRUQsTUFBTSx1QkFBdUIsR0FBRyxvQkFBb0IsQ0FBQztBQUVyRDs7O0dBR0c7QUFDSCxTQUFnQix1QkFBdUI7SUFDckMsSUFBSSx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQzdDLGlHQUFpRztRQUNqRyxPQUFPLEVBQUUsQ0FBQztLQUNYO0lBRUQsT0FBTyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLEdBQUcsSUFBQSxlQUFNLEVBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDckYsQ0FBQztBQVBELDBEQU9DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBCdWlsZE9wdGlvbnMsIE1ldGFmaWxlLCBPdXRwdXRGaWxlLCBQYXJ0aWFsTWVzc2FnZSwgZm9ybWF0TWVzc2FnZXMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyBjb25zdGFudHMgYXMgZnNDb25zdGFudHMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoLCB7IGpvaW4gfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCB7IGJyb3RsaUNvbXByZXNzIH0gZnJvbSAnbm9kZTp6bGliJztcbmltcG9ydCB7IGNvZXJjZSB9IGZyb20gJ3NlbXZlcic7XG5pbXBvcnQgeyBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0IH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgQnVuZGxlU3RhdHMsIGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlIH0gZnJvbSAnLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUsIEluaXRpYWxGaWxlUmVjb3JkIH0gZnJvbSAnLi9idW5kbGVyLWNvbnRleHQnO1xuaW1wb3J0IHsgQnVpbGRPdXRwdXRBc3NldCB9IGZyb20gJy4vYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcblxuY29uc3QgY29tcHJlc3NBc3luYyA9IHByb21pc2lmeShicm90bGlDb21wcmVzcyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dCdWlsZFN0YXRzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgbWV0YWZpbGU6IE1ldGFmaWxlLFxuICBpbml0aWFsOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4sXG4gIGJ1ZGdldEZhaWx1cmVzOiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10gfCB1bmRlZmluZWQsXG4gIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM/OiBNYXA8c3RyaW5nLCBudW1iZXI+LFxuKTogdm9pZCB7XG4gIGNvbnN0IHN0YXRzOiBCdW5kbGVTdGF0c1tdID0gW107XG4gIGZvciAoY29uc3QgW2ZpbGUsIG91dHB1dF0gb2YgT2JqZWN0LmVudHJpZXMobWV0YWZpbGUub3V0cHV0cykpIHtcbiAgICAvLyBPbmx5IGRpc3BsYXkgSmF2YVNjcmlwdCBhbmQgQ1NTIGZpbGVzXG4gICAgaWYgKCFmaWxlLmVuZHNXaXRoKCcuanMnKSAmJiAhZmlsZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gU2tpcCBpbnRlcm5hbCBjb21wb25lbnQgcmVzb3VyY2VzXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBpZiAoKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IG5hbWUgPSBpbml0aWFsLmdldChmaWxlKT8ubmFtZTtcbiAgICBpZiAobmFtZSA9PT0gdW5kZWZpbmVkICYmIG91dHB1dC5lbnRyeVBvaW50KSB7XG4gICAgICBuYW1lID0gcGF0aFxuICAgICAgICAuYmFzZW5hbWUob3V0cHV0LmVudHJ5UG9pbnQpXG4gICAgICAgIC5yZXBsYWNlKC9cXC5bY21dP1tqdF1zJC8sICcnKVxuICAgICAgICAucmVwbGFjZSgvW1xcXFwvLl0vZywgJy0nKTtcbiAgICB9XG5cbiAgICBzdGF0cy5wdXNoKHtcbiAgICAgIGluaXRpYWw6IGluaXRpYWwuaGFzKGZpbGUpLFxuICAgICAgc3RhdHM6IFtmaWxlLCBuYW1lID8/ICctJywgb3V0cHV0LmJ5dGVzLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzPy5nZXQoZmlsZSkgPz8gJy0nXSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRhYmxlVGV4dCA9IGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlKFxuICAgIHN0YXRzLFxuICAgIHRydWUsXG4gICAgdHJ1ZSxcbiAgICAhIWVzdGltYXRlZFRyYW5zZmVyU2l6ZXMsXG4gICAgYnVkZ2V0RmFpbHVyZXMsXG4gICk7XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnXFxuJyArIHRhYmxlVGV4dCArICdcXG4nKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMoXG4gIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10sXG4pOiBQcm9taXNlPE1hcDxzdHJpbmcsIG51bWJlcj4+IHtcbiAgY29uc3Qgc2l6ZXMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBjb25zdCBwZW5kaW5nQ29tcHJlc3Npb24gPSBbXTtcblxuICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICAvLyBPbmx5IGNhbGN1bGF0ZSBKYXZhU2NyaXB0IGFuZCBDU1MgZmlsZXNcbiAgICBpZiAoIW91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJykgJiYgIW91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGNvbXByZXNzaW5nIHNtYWxsIGZpbGVzIHdoaWNoIG1heSBlbmQgYmVpbmcgbGFyZ2VyIG9uY2UgY29tcHJlc3NlZCBhbmQgd2lsbCBtb3N0IGxpa2VseSBub3QgYmVcbiAgICAvLyBjb21wcmVzc2VkIGluIGFjdHVhbCB0cmFuc2l0LlxuICAgIGlmIChvdXRwdXRGaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGggPCAxMDI0KSB7XG4gICAgICBzaXplcy5zZXQob3V0cHV0RmlsZS5wYXRoLCBvdXRwdXRGaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcGVuZGluZ0NvbXByZXNzaW9uLnB1c2goXG4gICAgICBjb21wcmVzc0FzeW5jKG91dHB1dEZpbGUuY29udGVudHMpLnRoZW4oKHJlc3VsdCkgPT5cbiAgICAgICAgc2l6ZXMuc2V0KG91dHB1dEZpbGUucGF0aCwgcmVzdWx0LmJ5dGVMZW5ndGgpLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgUHJvbWlzZS5hbGwocGVuZGluZ0NvbXByZXNzaW9uKTtcblxuICByZXR1cm4gc2l6ZXM7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoU3Bpbm5lcjxUPih0ZXh0OiBzdHJpbmcsIGFjdGlvbjogKCkgPT4gVCB8IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKHRleHQpO1xuICBzcGlubmVyLnN0YXJ0KCk7XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgYWN0aW9uKCk7XG4gIH0gZmluYWxseSB7XG4gICAgc3Bpbm5lci5zdG9wKCk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhOb1Byb2dyZXNzPFQ+KHRleHQ6IHN0cmluZywgYWN0aW9uOiAoKSA9PiBUIHwgUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICByZXR1cm4gYWN0aW9uKCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dNZXNzYWdlcyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHsgZXJyb3JzLCB3YXJuaW5ncyB9OiB7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW107IHdhcm5pbmdzPzogUGFydGlhbE1lc3NhZ2VbXSB9LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICh3YXJuaW5ncz8ubGVuZ3RoKSB7XG4gICAgY29uc3Qgd2FybmluZ01lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMod2FybmluZ3MsIHsga2luZDogJ3dhcm5pbmcnLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmdNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBlcnJvck1lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMoZXJyb3JzLCB7IGtpbmQ6ICdlcnJvcicsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc3ludGF4IGZlYXR1cmUgb2JqZWN0IG1hcCBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYmFzZWQgb24gYSBsaXN0IG9mIHRhcmdldHMuXG4gKiBBIGZ1bGwgc2V0IG9mIGZlYXR1cmUgbmFtZXMgY2FuIGJlIGZvdW5kIGhlcmU6IGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyNzdXBwb3J0ZWRcbiAqIEBwYXJhbSB0YXJnZXQgQW4gYXJyYXkgb2YgYnJvd3Nlci9lbmdpbmUgdGFyZ2V0cyBpbiB0aGUgZm9ybWF0IGFjY2VwdGVkIGJ5IHRoZSBlc2J1aWxkIGB0YXJnZXRgIG9wdGlvbi5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHdpdGggdGhlIGVzYnVpbGQgYnVpbGQgYHN1cHBvcnRlZGAgb3B0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0OiBzdHJpbmdbXSk6IEJ1aWxkT3B0aW9uc1snc3VwcG9ydGVkJ10ge1xuICBjb25zdCBzdXBwb3J0ZWQ6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge1xuICAgIC8vIE5hdGl2ZSBhc3luYy9hd2FpdCBpcyBub3Qgc3VwcG9ydGVkIHdpdGggWm9uZS5qcy4gRGlzYWJsaW5nIHN1cHBvcnQgaGVyZSB3aWxsIGNhdXNlXG4gICAgLy8gZXNidWlsZCB0byBkb3dubGV2ZWwgYXN5bmMvYXdhaXQsIGFzeW5jIGdlbmVyYXRvcnMsIGFuZCBmb3IgYXdhaXQuLi5vZiB0byBhIFpvbmUuanMgc3VwcG9ydGVkIGZvcm0uXG4gICAgJ2FzeW5jLWF3YWl0JzogZmFsc2UsXG4gICAgLy8gVjggY3VycmVudGx5IGhhcyBhIHBlcmZvcm1hbmNlIGRlZmVjdCBpbnZvbHZpbmcgb2JqZWN0IHNwcmVhZCBvcGVyYXRpb25zIHRoYXQgY2FuIGNhdXNlIHNpZ25maWNhbnRcbiAgICAvLyBkZWdyYWRhdGlvbiBpbiBydW50aW1lIHBlcmZvcm1hbmNlLiBCeSBub3Qgc3VwcG9ydGluZyB0aGUgbGFuZ3VhZ2UgZmVhdHVyZSBoZXJlLCBhIGRvd25sZXZlbCBmb3JtXG4gICAgLy8gd2lsbCBiZSB1c2VkIGluc3RlYWQgd2hpY2ggcHJvdmlkZXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgcGVyZm9ybWFuY2UgaXNzdWUuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MTE1MzZcbiAgICAnb2JqZWN0LXJlc3Qtc3ByZWFkJzogZmFsc2UsXG4gIH07XG5cbiAgLy8gRGV0ZWN0IFNhZmFyaSBicm93c2VyIHZlcnNpb25zIHRoYXQgaGF2ZSBhIGNsYXNzIGZpZWxkIGJlaGF2aW9yIGJ1Z1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9XZWJLaXQvV2ViS2l0L2NvbW1pdC9lODc4OGEzNGIzZDVmNWI0ZWRkN2ZmNjQ1MGI4MDkzNmJmZjM5NmYyXG4gIGxldCBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHRhcmdldCkge1xuICAgIGxldCBtYWpvclZlcnNpb247XG4gICAgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnaW9zJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDMsIDUpKTtcbiAgICB9IGVsc2UgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnc2FmYXJpJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDYsIDgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRlY2huaWNhbGx5LCAxNC4wIGlzIG5vdCBicm9rZW4gYnV0IHJhdGhlciBkb2VzIG5vdCBoYXZlIHN1cHBvcnQuIEhvd2V2ZXIsIHRoZSBiZWhhdmlvclxuICAgIC8vIGlzIGlkZW50aWNhbCBzaW5jZSBpdCB3b3VsZCBiZSBzZXQgdG8gZmFsc2UgYnkgZXNidWlsZCBpZiBwcmVzZW50IGFzIGEgdGFyZ2V0LlxuICAgIGlmIChtYWpvclZlcnNpb24gPT09IDE0IHx8IG1ham9yVmVyc2lvbiA9PT0gMTUpIHtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gSWYgY2xhc3MgZmllbGQgc3VwcG9ydCBjYW5ub3QgYmUgdXNlZCBzZXQgdG8gZmFsc2U7IG90aGVyd2lzZSBsZWF2ZSB1bmRlZmluZWQgdG8gYWxsb3dcbiAgLy8gZXNidWlsZCB0byB1c2UgYHRhcmdldGAgdG8gZGV0ZXJtaW5lIHN1cHBvcnQuXG4gIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcpIHtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLWZpZWxkJ10gPSBmYWxzZTtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLXN0YXRpYy1maWVsZCddID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gc3VwcG9ydGVkO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVSZXN1bHRGaWxlcyhcbiAgb3V0cHV0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiBCdWlsZE91dHB1dEFzc2V0W10gfCB1bmRlZmluZWQsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbikge1xuICBjb25zdCBkaXJlY3RvcnlFeGlzdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZW5zdXJlRGlyZWN0b3J5RXhpc3RzID0gYXN5bmMgKGJhc2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgIH1cbiAgfTtcblxuICAvLyBXcml0ZXMgdGhlIG91dHB1dCBmaWxlIHRvIGRpc2sgYW5kIGVuc3VyZXMgdGhlIGNvbnRhaW5pbmcgZGlyZWN0b3JpZXMgYXJlIHByZXNlbnRcbiAgYXdhaXQgZW1pdEZpbGVzVG9EaXNrKG91dHB1dEZpbGVzLCBhc3luYyAoZmlsZTogQnVpbGRPdXRwdXRGaWxlKSA9PiB7XG4gICAgY29uc3QgZnVsbE91dHB1dFBhdGggPSBmaWxlLmZ1bGxPdXRwdXRQYXRoO1xuICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShmdWxsT3V0cHV0UGF0aCk7XG4gICAgYXdhaXQgZW5zdXJlRGlyZWN0b3J5RXhpc3RzKGJhc2VQYXRoKTtcblxuICAgIC8vIFdyaXRlIGZpbGUgY29udGVudHNcbiAgICBhd2FpdCBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZ1bGxPdXRwdXRQYXRoKSwgZmlsZS5jb250ZW50cyk7XG4gIH0pO1xuXG4gIGlmIChhc3NldEZpbGVzPy5sZW5ndGgpIHtcbiAgICBhd2FpdCBlbWl0RmlsZXNUb0Rpc2soYXNzZXRGaWxlcywgYXN5bmMgKHsgc291cmNlLCBkZXN0aW5hdGlvbiB9KSA9PiB7XG4gICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICBjb25zdCBkZXN0UGF0aCA9IGpvaW4oJ2Jyb3dzZXInLCBkZXN0aW5hdGlvbik7XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShkZXN0UGF0aCk7XG4gICAgICBhd2FpdCBlbnN1cmVEaXJlY3RvcnlFeGlzdHMoYmFzZVBhdGgpO1xuXG4gICAgICAvLyBDb3B5IGZpbGUgY29udGVudHNcbiAgICAgIGF3YWl0IGZzLmNvcHlGaWxlKHNvdXJjZSwgcGF0aC5qb2luKG91dHB1dFBhdGgsIGRlc3RQYXRoKSwgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSk7XG4gICAgfSk7XG4gIH1cbn1cblxuY29uc3QgTUFYX0NPTkNVUlJFTlRfV1JJVEVTID0gNjQ7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW1pdEZpbGVzVG9EaXNrPFQgPSBCdWlsZE91dHB1dEFzc2V0IHwgQnVpbGRPdXRwdXRGaWxlPihcbiAgZmlsZXM6IFRbXSxcbiAgd3JpdGVGaWxlQ2FsbGJhY2s6IChmaWxlOiBUKSA9PiBQcm9taXNlPHZvaWQ+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIC8vIFdyaXRlIGZpbGVzIGluIGdyb3VwcyBvZiBNQVhfQ09OQ1VSUkVOVF9XUklURVMgdG8gYXZvaWQgdG9vIG1hbnkgb3BlbiBmaWxlc1xuICBmb3IgKGxldCBmaWxlSW5kZXggPSAwOyBmaWxlSW5kZXggPCBmaWxlcy5sZW5ndGg7ICkge1xuICAgIGNvbnN0IGdyb3VwTWF4ID0gTWF0aC5taW4oZmlsZUluZGV4ICsgTUFYX0NPTkNVUlJFTlRfV1JJVEVTLCBmaWxlcy5sZW5ndGgpO1xuXG4gICAgY29uc3QgYWN0aW9ucyA9IFtdO1xuICAgIHdoaWxlIChmaWxlSW5kZXggPCBncm91cE1heCkge1xuICAgICAgYWN0aW9ucy5wdXNoKHdyaXRlRmlsZUNhbGxiYWNrKGZpbGVzW2ZpbGVJbmRleCsrXSkpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKGFjdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoXG4gIHBhdGg6IHN0cmluZyxcbiAgdGV4dDogc3RyaW5nLFxuICB0eXBlOiBCdWlsZE91dHB1dEZpbGVUeXBlLFxuKTogQnVpbGRPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgdHlwZSxcbiAgICBnZXQgaGFzaCgpIHtcbiAgICAgIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUodGhpcy50ZXh0KS5kaWdlc3QoJ2hleCcpO1xuICAgIH0sXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgICBnZXQgZnVsbE91dHB1dFBhdGgoKTogc3RyaW5nIHtcbiAgICAgIHJldHVybiBnZXRGdWxsT3V0cHV0UGF0aCh0aGlzKTtcbiAgICB9LFxuICAgIGNsb25lKCk6IEJ1aWxkT3V0cHV0RmlsZSB7XG4gICAgICByZXR1cm4gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHRoaXMucGF0aCwgdGhpcy50ZXh0LCB0aGlzLnR5cGUpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbURhdGEoXG4gIHBhdGg6IHN0cmluZyxcbiAgZGF0YTogVWludDhBcnJheSxcbiAgdHlwZTogQnVpbGRPdXRwdXRGaWxlVHlwZSxcbik6IEJ1aWxkT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0eXBlLFxuICAgIGdldCB0ZXh0KCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGRhdGEuYnVmZmVyLCBkYXRhLmJ5dGVPZmZzZXQsIGRhdGEuYnl0ZUxlbmd0aCkudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgfSxcbiAgICBnZXQgaGFzaCgpIHtcbiAgICAgIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUodGhpcy50ZXh0KS5kaWdlc3QoJ2hleCcpO1xuICAgIH0sXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcbiAgICBnZXQgZnVsbE91dHB1dFBhdGgoKTogc3RyaW5nIHtcbiAgICAgIHJldHVybiBnZXRGdWxsT3V0cHV0UGF0aCh0aGlzKTtcbiAgICB9LFxuICAgIGNsb25lKCk6IEJ1aWxkT3V0cHV0RmlsZSB7XG4gICAgICByZXR1cm4gY3JlYXRlT3V0cHV0RmlsZUZyb21EYXRhKHRoaXMucGF0aCwgdGhpcy5jb250ZW50cywgdGhpcy50eXBlKTtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydE91dHB1dEZpbGUoZmlsZTogT3V0cHV0RmlsZSwgdHlwZTogQnVpbGRPdXRwdXRGaWxlVHlwZSk6IEJ1aWxkT3V0cHV0RmlsZSB7XG4gIGNvbnN0IHsgcGF0aCwgY29udGVudHMsIGhhc2ggfSA9IGZpbGU7XG5cbiAgcmV0dXJuIHtcbiAgICBjb250ZW50cyxcbiAgICBoYXNoLFxuICAgIHBhdGgsXG4gICAgdHlwZSxcbiAgICBnZXQgdGV4dCgpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbShcbiAgICAgICAgdGhpcy5jb250ZW50cy5idWZmZXIsXG4gICAgICAgIHRoaXMuY29udGVudHMuYnl0ZU9mZnNldCxcbiAgICAgICAgdGhpcy5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgKS50b1N0cmluZygndXRmLTgnKTtcbiAgICB9LFxuICAgIGdldCBmdWxsT3V0cHV0UGF0aCgpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIGdldEZ1bGxPdXRwdXRQYXRoKHRoaXMpO1xuICAgIH0sXG4gICAgY2xvbmUoKTogQnVpbGRPdXRwdXRGaWxlIHtcbiAgICAgIHJldHVybiBjb252ZXJ0T3V0cHV0RmlsZSh0aGlzLCB0aGlzLnR5cGUpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGdWxsT3V0cHV0UGF0aChmaWxlOiBCdWlsZE91dHB1dEZpbGUpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGZpbGUudHlwZSkge1xuICAgIGNhc2UgQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyOlxuICAgIGNhc2UgQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYTpcbiAgICAgIHJldHVybiBqb2luKCdicm93c2VyJywgZmlsZS5wYXRoKTtcbiAgICBjYXNlIEJ1aWxkT3V0cHV0RmlsZVR5cGUuU2VydmVyOlxuICAgICAgcmV0dXJuIGpvaW4oJ3NlcnZlcicsIGZpbGUucGF0aCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmaWxlLnBhdGg7XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYnJvd3Nlcmxpc3RzIHJlc3VsdCB0byBlc2J1aWxkIHRhcmdldC5cbiAqIEBzZWUgaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3RhcmdldFxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoc3VwcG9ydGVkQnJvd3NlcnM6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICBjb25zdCB0cmFuc2Zvcm1lZDogc3RyaW5nW10gPSBbXTtcblxuICAvLyBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jdGFyZ2V0XG4gIGNvbnN0IGVzQnVpbGRTdXBwb3J0ZWRCcm93c2VycyA9IG5ldyBTZXQoW1xuICAgICdjaHJvbWUnLFxuICAgICdlZGdlJyxcbiAgICAnZmlyZWZveCcsXG4gICAgJ2llJyxcbiAgICAnaW9zJyxcbiAgICAnbm9kZScsXG4gICAgJ29wZXJhJyxcbiAgICAnc2FmYXJpJyxcbiAgXSk7XG5cbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgbGV0IFticm93c2VyTmFtZSwgdmVyc2lvbl0gPSBicm93c2VyLnRvTG93ZXJDYXNlKCkuc3BsaXQoJyAnKTtcblxuICAgIC8vIGJyb3dzZXJzbGlzdCB1c2VzIHRoZSBuYW1lIGBpb3Nfc2FmYCBmb3IgaU9TIFNhZmFyaSB3aGVyZWFzIGVzYnVpbGQgdXNlcyBgaW9zYFxuICAgIGlmIChicm93c2VyTmFtZSA9PT0gJ2lvc19zYWYnKSB7XG4gICAgICBicm93c2VyTmFtZSA9ICdpb3MnO1xuICAgIH1cblxuICAgIC8vIGJyb3dzZXJzbGlzdCB1c2VzIHJhbmdlcyBgMTUuMi0xNS4zYCB2ZXJzaW9ucyBidXQgb25seSB0aGUgbG93ZXN0IGlzIHJlcXVpcmVkXG4gICAgLy8gdG8gcGVyZm9ybSBtaW5pbXVtIHN1cHBvcnRlZCBmZWF0dXJlIGNoZWNrcy4gZXNidWlsZCBhbHNvIGV4cGVjdHMgYSBzaW5nbGUgdmVyc2lvbi5cbiAgICBbdmVyc2lvbl0gPSB2ZXJzaW9uLnNwbGl0KCctJyk7XG5cbiAgICBpZiAoZXNCdWlsZFN1cHBvcnRlZEJyb3dzZXJzLmhhcyhicm93c2VyTmFtZSkpIHtcbiAgICAgIGlmIChicm93c2VyTmFtZSA9PT0gJ3NhZmFyaScgJiYgdmVyc2lvbiA9PT0gJ3RwJykge1xuICAgICAgICAvLyBlc2J1aWxkIG9ubHkgc3VwcG9ydHMgbnVtZXJpYyB2ZXJzaW9ucyBzbyBgVFBgIGlzIGNvbnZlcnRlZCB0byBhIGhpZ2ggbnVtYmVyICg5OTkpIHNpbmNlXG4gICAgICAgIC8vIGEgVGVjaG5vbG9neSBQcmV2aWV3IChUUCkgb2YgU2FmYXJpIGlzIGFzc3VtZWQgdG8gc3VwcG9ydCBhbGwgY3VycmVudGx5IGtub3duIGZlYXR1cmVzLlxuICAgICAgICB2ZXJzaW9uID0gJzk5OSc7XG4gICAgICB9IGVsc2UgaWYgKCF2ZXJzaW9uLmluY2x1ZGVzKCcuJykpIHtcbiAgICAgICAgLy8gQSBsb25lIG1ham9yIHZlcnNpb24gaXMgY29uc2lkZXJlZCBieSBlc2J1aWxkIHRvIGluY2x1ZGUgYWxsIG1pbm9yIHZlcnNpb25zLiBIb3dldmVyLFxuICAgICAgICAvLyBicm93c2Vyc2xpc3QgZG9lcyBub3QgYW5kIGlzIGFsc28gaW5jb25zaXN0ZW50IGluIGl0cyBgLjBgIHZlcnNpb24gbmFtaW5nLiBGb3IgZXhhbXBsZSxcbiAgICAgICAgLy8gU2FmYXJpIDE1LjAgaXMgbmFtZWQgYHNhZmFyaSAxNWAgYnV0IFNhZmFyaSAxNi4wIGlzIG5hbWVkIGBzYWZhcmkgMTYuMGAuXG4gICAgICAgIHZlcnNpb24gKz0gJy4wJztcbiAgICAgIH1cblxuICAgICAgdHJhbnNmb3JtZWQucHVzaChicm93c2VyTmFtZSArIHZlcnNpb24pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cmFuc2Zvcm1lZDtcbn1cblxuY29uc3QgU1VQUE9SVEVEX05PREVfVkVSU0lPTlMgPSAnMC4wLjAtRU5HSU5FUy1OT0RFJztcblxuLyoqXG4gKiBUcmFuc2Zvcm0gc3VwcG9ydGVkIE5vZGUuanMgdmVyc2lvbnMgdG8gZXNidWlsZCB0YXJnZXQuXG4gKiBAc2VlIGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyN0YXJnZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFN1cHBvcnRlZE5vZGVUYXJnZXRzKCk6IHN0cmluZ1tdIHtcbiAgaWYgKFNVUFBPUlRFRF9OT0RFX1ZFUlNJT05TLmNoYXJBdCgwKSA9PT0gJzAnKSB7XG4gICAgLy8gVW5saWtlIGBwa2dfbnBtYCwgYHRzX2xpYnJhcnlgIHdoaWNoIGlzIHVzZWQgdG8gcnVuIHVuaXQgdGVzdHMgZG9lcyBub3Qgc3VwcG9ydCBzdWJzdGl0dXRpb25zLlxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiBTVVBQT1JURURfTk9ERV9WRVJTSU9OUy5zcGxpdCgnfHwnKS5tYXAoKHYpID0+ICdub2RlJyArIGNvZXJjZSh2KT8udmVyc2lvbik7XG59XG4iXX0=