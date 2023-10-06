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
async function withNoProgress(test, action) {
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
    await Promise.all(outputFiles.map(async (file) => {
        const fullOutputPath = file.fullOutputPath;
        // Ensure output subdirectories exist
        const basePath = node_path_1.default.dirname(fullOutputPath);
        if (basePath && !directoryExists.has(basePath)) {
            await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
            directoryExists.add(basePath);
        }
        // Write file contents
        await promises_1.default.writeFile(node_path_1.default.join(outputPath, fullOutputPath), file.contents);
    }));
    if (assetFiles?.length) {
        await Promise.all(assetFiles.map(async ({ source, destination }) => {
            // Ensure output subdirectories exist
            const destPath = (0, node_path_1.join)('browser', destination);
            const basePath = node_path_1.default.dirname(destPath);
            if (basePath && !directoryExists.has(basePath)) {
                await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
                directoryExists.add(basePath);
            }
            // Copy file contents
            await promises_1.default.copyFile(source, node_path_1.default.join(outputPath, destPath), node_fs_1.constants.COPYFILE_FICLONE);
        }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gscUNBQTZGO0FBQzdGLDZDQUF5QztBQUN6QyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLHVEQUF1QztBQUN2Qyx5Q0FBc0M7QUFDdEMseUNBQTJDO0FBQzNDLG1DQUFnQztBQUVoQyxpREFBOEM7QUFDOUMsa0RBQThFO0FBQzlFLHVEQUE0RjtBQUU1RixNQUFNLGFBQWEsR0FBRyxJQUFBLHFCQUFTLEVBQUMsMEJBQWMsQ0FBQyxDQUFDO0FBRWhELFNBQWdCLGFBQWEsQ0FDM0IsT0FBdUIsRUFDdkIsUUFBa0IsRUFDbEIsT0FBdUMsRUFDdkMsY0FBb0QsRUFDcEQsc0JBQTRDO0lBRTVDLE1BQU0sS0FBSyxHQUFrQixFQUFFLENBQUM7SUFDaEMsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzdELHdDQUF3QztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDbkQsU0FBUztTQUNWO1FBQ0Qsb0NBQW9DO1FBQ3BDLDhEQUE4RDtRQUM5RCxJQUFLLE1BQWMsQ0FBQyxjQUFjLENBQUMsRUFBRTtZQUNuQyxTQUFTO1NBQ1Y7UUFFRCxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQztRQUNuQyxJQUFJLElBQUksS0FBSyxT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LEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUUvQixJQUFJLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUM3QyxJQUFJLFdBQVcsS0FBSyxRQUFRLElBQUksT0FBTyxLQUFLLElBQUksRUFBRTtnQkFDaEQsMkZBQTJGO2dCQUMzRiwwRkFBMEY7Z0JBQzFGLE9BQU8sR0FBRyxLQUFLLENBQUM7YUFDakI7aUJBQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ2pDLHdGQUF3RjtnQkFDeEYsMEZBQTBGO2dCQUMxRiwyRUFBMkU7Z0JBQzNFLE9BQU8sSUFBSSxJQUFJLENBQUM7YUFDakI7WUFFRCxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsQ0FBQztTQUN6QztLQUNGO0lBRUQsT0FBTyxXQUFXLENBQUM7QUFDckIsQ0FBQztBQTVDRCxrRkE0Q0M7QUFFRCxNQUFNLHVCQUF1QixHQUFHLG9CQUFvQixDQUFDO0FBRXJEOzs7R0FHRztBQUNILFNBQWdCLHVCQUF1QjtJQUNyQyxJQUFJLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7UUFDN0MsaUdBQWlHO1FBQ2pHLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxPQUFPLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sR0FBRyxJQUFBLGVBQU0sRUFBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNyRixDQUFDO0FBUEQsMERBT0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEJ1aWxkT3B0aW9ucywgTWV0YWZpbGUsIE91dHB1dEZpbGUsIFBhcnRpYWxNZXNzYWdlLCBmb3JtYXRNZXNzYWdlcyB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IGNvbnN0YW50cyBhcyBmc0NvbnN0YW50cyB9IGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHBhdGgsIHsgam9pbiB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICdub2RlOnV0aWwnO1xuaW1wb3J0IHsgYnJvdGxpQ29tcHJlc3MgfSBmcm9tICdub2RlOnpsaWInO1xuaW1wb3J0IHsgY29lcmNlIH0gZnJvbSAnc2VtdmVyJztcbmltcG9ydCB7IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHQgfSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBCdW5kbGVTdGF0cywgZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUgfSBmcm9tICcuLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZSwgQnVpbGRPdXRwdXRGaWxlVHlwZSwgSW5pdGlhbEZpbGVSZWNvcmQgfSBmcm9tICcuL2J1bmRsZXItY29udGV4dCc7XG5cbmNvbnN0IGNvbXByZXNzQXN5bmMgPSBwcm9taXNpZnkoYnJvdGxpQ29tcHJlc3MpO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nQnVpbGRTdGF0cyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIG1ldGFmaWxlOiBNZXRhZmlsZSxcbiAgaW5pdGlhbDogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuICBidWRnZXRGYWlsdXJlczogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdIHwgdW5kZWZpbmVkLFxuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzPzogTWFwPHN0cmluZywgbnVtYmVyPixcbik6IHZvaWQge1xuICBjb25zdCBzdGF0czogQnVuZGxlU3RhdHNbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtmaWxlLCBvdXRwdXRdIG9mIE9iamVjdC5lbnRyaWVzKG1ldGFmaWxlLm91dHB1dHMpKSB7XG4gICAgLy8gT25seSBkaXNwbGF5IEphdmFTY3JpcHQgYW5kIENTUyBmaWxlc1xuICAgIGlmICghZmlsZS5lbmRzV2l0aCgnLmpzJykgJiYgIWZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFNraXAgaW50ZXJuYWwgY29tcG9uZW50IHJlc291cmNlc1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgaWYgKChvdXRwdXQgYXMgYW55KVsnbmctY29tcG9uZW50J10pIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxldCBuYW1lID0gaW5pdGlhbC5nZXQoZmlsZSk/Lm5hbWU7XG4gICAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCAmJiBvdXRwdXQuZW50cnlQb2ludCkge1xuICAgICAgbmFtZSA9IHBhdGhcbiAgICAgICAgLmJhc2VuYW1lKG91dHB1dC5lbnRyeVBvaW50KVxuICAgICAgICAucmVwbGFjZSgvXFwuW2NtXT9banRdcyQvLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL1tcXFxcLy5dL2csICctJyk7XG4gICAgfVxuXG4gICAgc3RhdHMucHVzaCh7XG4gICAgICBpbml0aWFsOiBpbml0aWFsLmhhcyhmaWxlKSxcbiAgICAgIHN0YXRzOiBbZmlsZSwgbmFtZSA/PyAnLScsIG91dHB1dC5ieXRlcywgZXN0aW1hdGVkVHJhbnNmZXJTaXplcz8uZ2V0KGZpbGUpID8/ICctJ10sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0YWJsZVRleHQgPSBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShcbiAgICBzdGF0cyxcbiAgICB0cnVlLFxuICAgIHRydWUsXG4gICAgISFlc3RpbWF0ZWRUcmFuc2ZlclNpemVzLFxuICAgIGJ1ZGdldEZhaWx1cmVzLFxuICApO1xuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oJ1xcbicgKyB0YWJsZVRleHQgKyAnXFxuJyk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxjdWxhdGVFc3RpbWF0ZWRUcmFuc2ZlclNpemVzKFxuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdLFxuKTogUHJvbWlzZTxNYXA8c3RyaW5nLCBudW1iZXI+PiB7XG4gIGNvbnN0IHNpemVzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgY29uc3QgcGVuZGluZ0NvbXByZXNzaW9uID0gW107XG5cbiAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIG91dHB1dEZpbGVzKSB7XG4gICAgLy8gT25seSBjYWxjdWxhdGUgSmF2YVNjcmlwdCBhbmQgQ1NTIGZpbGVzXG4gICAgaWYgKCFvdXRwdXRGaWxlLnBhdGguZW5kc1dpdGgoJy5qcycpICYmICFvdXRwdXRGaWxlLnBhdGguZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBjb21wcmVzc2luZyBzbWFsbCBmaWxlcyB3aGljaCBtYXkgZW5kIGJlaW5nIGxhcmdlciBvbmNlIGNvbXByZXNzZWQgYW5kIHdpbGwgbW9zdCBsaWtlbHkgbm90IGJlXG4gICAgLy8gY29tcHJlc3NlZCBpbiBhY3R1YWwgdHJhbnNpdC5cbiAgICBpZiAob3V0cHV0RmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoIDwgMTAyNCkge1xuICAgICAgc2l6ZXMuc2V0KG91dHB1dEZpbGUucGF0aCwgb3V0cHV0RmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHBlbmRpbmdDb21wcmVzc2lvbi5wdXNoKFxuICAgICAgY29tcHJlc3NBc3luYyhvdXRwdXRGaWxlLmNvbnRlbnRzKS50aGVuKChyZXN1bHQpID0+XG4gICAgICAgIHNpemVzLnNldChvdXRwdXRGaWxlLnBhdGgsIHJlc3VsdC5ieXRlTGVuZ3RoKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGF3YWl0IFByb21pc2UuYWxsKHBlbmRpbmdDb21wcmVzc2lvbik7XG5cbiAgcmV0dXJuIHNpemVzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aFNwaW5uZXI8VD4odGV4dDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQgfCBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcih0ZXh0KTtcbiAgc3Bpbm5lci5zdGFydCgpO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICB9IGZpbmFsbHkge1xuICAgIHNwaW5uZXIuc3RvcCgpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoTm9Qcm9ncmVzczxUPih0ZXN0OiBzdHJpbmcsIGFjdGlvbjogKCkgPT4gVCB8IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgcmV0dXJuIGFjdGlvbigpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9nTWVzc2FnZXMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB7IGVycm9ycywgd2FybmluZ3MgfTogeyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdOyB3YXJuaW5ncz86IFBhcnRpYWxNZXNzYWdlW10gfSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAod2FybmluZ3M/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHdhcm5pbmdNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKHdhcm5pbmdzLCB7IGtpbmQ6ICd3YXJuaW5nJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG5cbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKGVycm9ycywgeyBraW5kOiAnZXJyb3InLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvck1lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHN5bnRheCBmZWF0dXJlIG9iamVjdCBtYXAgZm9yIEFuZ3VsYXIgYXBwbGljYXRpb25zIGJhc2VkIG9uIGEgbGlzdCBvZiB0YXJnZXRzLlxuICogQSBmdWxsIHNldCBvZiBmZWF0dXJlIG5hbWVzIGNhbiBiZSBmb3VuZCBoZXJlOiBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jc3VwcG9ydGVkXG4gKiBAcGFyYW0gdGFyZ2V0IEFuIGFycmF5IG9mIGJyb3dzZXIvZW5naW5lIHRhcmdldHMgaW4gdGhlIGZvcm1hdCBhY2NlcHRlZCBieSB0aGUgZXNidWlsZCBgdGFyZ2V0YCBvcHRpb24uXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB3aXRoIHRoZSBlc2J1aWxkIGJ1aWxkIGBzdXBwb3J0ZWRgIG9wdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldDogc3RyaW5nW10pOiBCdWlsZE9wdGlvbnNbJ3N1cHBvcnRlZCddIHtcbiAgY29uc3Qgc3VwcG9ydGVkOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHtcbiAgICAvLyBOYXRpdmUgYXN5bmMvYXdhaXQgaXMgbm90IHN1cHBvcnRlZCB3aXRoIFpvbmUuanMuIERpc2FibGluZyBzdXBwb3J0IGhlcmUgd2lsbCBjYXVzZVxuICAgIC8vIGVzYnVpbGQgdG8gZG93bmxldmVsIGFzeW5jL2F3YWl0LCBhc3luYyBnZW5lcmF0b3JzLCBhbmQgZm9yIGF3YWl0Li4ub2YgdG8gYSBab25lLmpzIHN1cHBvcnRlZCBmb3JtLlxuICAgICdhc3luYy1hd2FpdCc6IGZhbHNlLFxuICAgIC8vIFY4IGN1cnJlbnRseSBoYXMgYSBwZXJmb3JtYW5jZSBkZWZlY3QgaW52b2x2aW5nIG9iamVjdCBzcHJlYWQgb3BlcmF0aW9ucyB0aGF0IGNhbiBjYXVzZSBzaWduZmljYW50XG4gICAgLy8gZGVncmFkYXRpb24gaW4gcnVudGltZSBwZXJmb3JtYW5jZS4gQnkgbm90IHN1cHBvcnRpbmcgdGhlIGxhbmd1YWdlIGZlYXR1cmUgaGVyZSwgYSBkb3dubGV2ZWwgZm9ybVxuICAgIC8vIHdpbGwgYmUgdXNlZCBpbnN0ZWFkIHdoaWNoIHByb3ZpZGVzIGEgd29ya2Fyb3VuZCBmb3IgdGhlIHBlcmZvcm1hbmNlIGlzc3VlLlxuICAgIC8vIEZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTExNTM2XG4gICAgJ29iamVjdC1yZXN0LXNwcmVhZCc6IGZhbHNlLFxuICB9O1xuXG4gIC8vIERldGVjdCBTYWZhcmkgYnJvd3NlciB2ZXJzaW9ucyB0aGF0IGhhdmUgYSBjbGFzcyBmaWVsZCBiZWhhdmlvciBidWdcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjQzNTUjaXNzdWVjb21tZW50LTEzMzM0NzcwMzNcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vV2ViS2l0L1dlYktpdC9jb21taXQvZTg3ODhhMzRiM2Q1ZjViNGVkZDdmZjY0NTBiODA5MzZiZmYzOTZmMlxuICBsZXQgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gZmFsc2U7XG4gIGZvciAoY29uc3QgYnJvd3NlciBvZiB0YXJnZXQpIHtcbiAgICBsZXQgbWFqb3JWZXJzaW9uO1xuICAgIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ2lvcycpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSgzLCA1KSk7XG4gICAgfSBlbHNlIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ3NhZmFyaScpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSg2LCA4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBUZWNobmljYWxseSwgMTQuMCBpcyBub3QgYnJva2VuIGJ1dCByYXRoZXIgZG9lcyBub3QgaGF2ZSBzdXBwb3J0LiBIb3dldmVyLCB0aGUgYmVoYXZpb3JcbiAgICAvLyBpcyBpZGVudGljYWwgc2luY2UgaXQgd291bGQgYmUgc2V0IHRvIGZhbHNlIGJ5IGVzYnVpbGQgaWYgcHJlc2VudCBhcyBhIHRhcmdldC5cbiAgICBpZiAobWFqb3JWZXJzaW9uID09PSAxNCB8fCBtYWpvclZlcnNpb24gPT09IDE1KSB7XG4gICAgICBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIElmIGNsYXNzIGZpZWxkIHN1cHBvcnQgY2Fubm90IGJlIHVzZWQgc2V0IHRvIGZhbHNlOyBvdGhlcndpc2UgbGVhdmUgdW5kZWZpbmVkIHRvIGFsbG93XG4gIC8vIGVzYnVpbGQgdG8gdXNlIGB0YXJnZXRgIHRvIGRldGVybWluZSBzdXBwb3J0LlxuICBpZiAoc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnKSB7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1maWVsZCddID0gZmFsc2U7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1zdGF0aWMtZmllbGQnXSA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHN1cHBvcnRlZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdyaXRlUmVzdWx0RmlsZXMoXG4gIG91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXSxcbiAgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10gfCB1bmRlZmluZWQsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbikge1xuICBjb25zdCBkaXJlY3RvcnlFeGlzdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICBjb25zdCBmdWxsT3V0cHV0UGF0aCA9IGZpbGUuZnVsbE91dHB1dFBhdGg7XG4gICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShmdWxsT3V0cHV0UGF0aCk7XG4gICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIGZpbGUgY29udGVudHNcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZnVsbE91dHB1dFBhdGgpLCBmaWxlLmNvbnRlbnRzKTtcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoYXNzZXRGaWxlcz8ubGVuZ3RoKSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhc3NldEZpbGVzLm1hcChhc3luYyAoeyBzb3VyY2UsIGRlc3RpbmF0aW9uIH0pID0+IHtcbiAgICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGpvaW4oJ2Jyb3dzZXInLCBkZXN0aW5hdGlvbik7XG4gICAgICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGRlc3RQYXRoKTtcbiAgICAgICAgaWYgKGJhc2VQYXRoICYmICFkaXJlY3RvcnlFeGlzdHMuaGFzKGJhc2VQYXRoKSkge1xuICAgICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvcHkgZmlsZSBjb250ZW50c1xuICAgICAgICBhd2FpdCBmcy5jb3B5RmlsZShzb3VyY2UsIHBhdGguam9pbihvdXRwdXRQYXRoLCBkZXN0UGF0aCksIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KFxuICBwYXRoOiBzdHJpbmcsXG4gIHRleHQ6IHN0cmluZyxcbiAgdHlwZTogQnVpbGRPdXRwdXRGaWxlVHlwZSxcbik6IEJ1aWxkT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIHR5cGUsXG4gICAgZ2V0IGhhc2goKSB7XG4gICAgICByZXR1cm4gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKHRoaXMudGV4dCkuZGlnZXN0KCdoZXgnKTtcbiAgICB9LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gICAgZ2V0IGZ1bGxPdXRwdXRQYXRoKCk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gZ2V0RnVsbE91dHB1dFBhdGgodGhpcyk7XG4gICAgfSxcbiAgICBjbG9uZSgpOiBCdWlsZE91dHB1dEZpbGUge1xuICAgICAgcmV0dXJuIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCh0aGlzLnBhdGgsIHRoaXMudGV4dCwgdGhpcy50eXBlKTtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21EYXRhKFxuICBwYXRoOiBzdHJpbmcsXG4gIGRhdGE6IFVpbnQ4QXJyYXksXG4gIHR5cGU6IEJ1aWxkT3V0cHV0RmlsZVR5cGUsXG4pOiBCdWlsZE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdHlwZSxcbiAgICBnZXQgdGV4dCgpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0LCBkYXRhLmJ5dGVMZW5ndGgpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgIH0sXG4gICAgZ2V0IGhhc2goKSB7XG4gICAgICByZXR1cm4gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKHRoaXMudGV4dCkuZGlnZXN0KCdoZXgnKTtcbiAgICB9LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG4gICAgZ2V0IGZ1bGxPdXRwdXRQYXRoKCk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gZ2V0RnVsbE91dHB1dFBhdGgodGhpcyk7XG4gICAgfSxcbiAgICBjbG9uZSgpOiBCdWlsZE91dHB1dEZpbGUge1xuICAgICAgcmV0dXJuIGNyZWF0ZU91dHB1dEZpbGVGcm9tRGF0YSh0aGlzLnBhdGgsIHRoaXMuY29udGVudHMsIHRoaXMudHlwZSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZ1bGxPdXRwdXRQYXRoKGZpbGU6IEJ1aWxkT3V0cHV0RmlsZSk6IHN0cmluZyB7XG4gIHN3aXRjaCAoZmlsZS50eXBlKSB7XG4gICAgY2FzZSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXI6XG4gICAgY2FzZSBCdWlsZE91dHB1dEZpbGVUeXBlLk1lZGlhOlxuICAgICAgcmV0dXJuIGpvaW4oJ2Jyb3dzZXInLCBmaWxlLnBhdGgpO1xuICAgIGNhc2UgQnVpbGRPdXRwdXRGaWxlVHlwZS5TZXJ2ZXI6XG4gICAgICByZXR1cm4gam9pbignc2VydmVyJywgZmlsZS5wYXRoKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZpbGUucGF0aDtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBicm93c2VybGlzdHMgcmVzdWx0IHRvIGVzYnVpbGQgdGFyZ2V0LlxuICogQHNlZSBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jdGFyZ2V0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhzdXBwb3J0ZWRCcm93c2Vyczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHRyYW5zZm9ybWVkOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyN0YXJnZXRcbiAgY29uc3QgZXNCdWlsZFN1cHBvcnRlZEJyb3dzZXJzID0gbmV3IFNldChbXG4gICAgJ2Nocm9tZScsXG4gICAgJ2VkZ2UnLFxuICAgICdmaXJlZm94JyxcbiAgICAnaWUnLFxuICAgICdpb3MnLFxuICAgICdub2RlJyxcbiAgICAnb3BlcmEnLFxuICAgICdzYWZhcmknLFxuICBdKTtcblxuICBmb3IgKGNvbnN0IGJyb3dzZXIgb2Ygc3VwcG9ydGVkQnJvd3NlcnMpIHtcbiAgICBsZXQgW2Jyb3dzZXJOYW1lLCB2ZXJzaW9uXSA9IGJyb3dzZXIudG9Mb3dlckNhc2UoKS5zcGxpdCgnICcpO1xuXG4gICAgLy8gYnJvd3NlcnNsaXN0IHVzZXMgdGhlIG5hbWUgYGlvc19zYWZgIGZvciBpT1MgU2FmYXJpIHdoZXJlYXMgZXNidWlsZCB1c2VzIGBpb3NgXG4gICAgaWYgKGJyb3dzZXJOYW1lID09PSAnaW9zX3NhZicpIHtcbiAgICAgIGJyb3dzZXJOYW1lID0gJ2lvcyc7XG4gICAgfVxuXG4gICAgLy8gYnJvd3NlcnNsaXN0IHVzZXMgcmFuZ2VzIGAxNS4yLTE1LjNgIHZlcnNpb25zIGJ1dCBvbmx5IHRoZSBsb3dlc3QgaXMgcmVxdWlyZWRcbiAgICAvLyB0byBwZXJmb3JtIG1pbmltdW0gc3VwcG9ydGVkIGZlYXR1cmUgY2hlY2tzLiBlc2J1aWxkIGFsc28gZXhwZWN0cyBhIHNpbmdsZSB2ZXJzaW9uLlxuICAgIFt2ZXJzaW9uXSA9IHZlcnNpb24uc3BsaXQoJy0nKTtcblxuICAgIGlmIChlc0J1aWxkU3VwcG9ydGVkQnJvd3NlcnMuaGFzKGJyb3dzZXJOYW1lKSkge1xuICAgICAgaWYgKGJyb3dzZXJOYW1lID09PSAnc2FmYXJpJyAmJiB2ZXJzaW9uID09PSAndHAnKSB7XG4gICAgICAgIC8vIGVzYnVpbGQgb25seSBzdXBwb3J0cyBudW1lcmljIHZlcnNpb25zIHNvIGBUUGAgaXMgY29udmVydGVkIHRvIGEgaGlnaCBudW1iZXIgKDk5OSkgc2luY2VcbiAgICAgICAgLy8gYSBUZWNobm9sb2d5IFByZXZpZXcgKFRQKSBvZiBTYWZhcmkgaXMgYXNzdW1lZCB0byBzdXBwb3J0IGFsbCBjdXJyZW50bHkga25vd24gZmVhdHVyZXMuXG4gICAgICAgIHZlcnNpb24gPSAnOTk5JztcbiAgICAgIH0gZWxzZSBpZiAoIXZlcnNpb24uaW5jbHVkZXMoJy4nKSkge1xuICAgICAgICAvLyBBIGxvbmUgbWFqb3IgdmVyc2lvbiBpcyBjb25zaWRlcmVkIGJ5IGVzYnVpbGQgdG8gaW5jbHVkZSBhbGwgbWlub3IgdmVyc2lvbnMuIEhvd2V2ZXIsXG4gICAgICAgIC8vIGJyb3dzZXJzbGlzdCBkb2VzIG5vdCBhbmQgaXMgYWxzbyBpbmNvbnNpc3RlbnQgaW4gaXRzIGAuMGAgdmVyc2lvbiBuYW1pbmcuIEZvciBleGFtcGxlLFxuICAgICAgICAvLyBTYWZhcmkgMTUuMCBpcyBuYW1lZCBgc2FmYXJpIDE1YCBidXQgU2FmYXJpIDE2LjAgaXMgbmFtZWQgYHNhZmFyaSAxNi4wYC5cbiAgICAgICAgdmVyc2lvbiArPSAnLjAnO1xuICAgICAgfVxuXG4gICAgICB0cmFuc2Zvcm1lZC5wdXNoKGJyb3dzZXJOYW1lICsgdmVyc2lvbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybWVkO1xufVxuXG5jb25zdCBTVVBQT1JURURfTk9ERV9WRVJTSU9OUyA9ICcwLjAuMC1FTkdJTkVTLU5PREUnO1xuXG4vKipcbiAqIFRyYW5zZm9ybSBzdXBwb3J0ZWQgTm9kZS5qcyB2ZXJzaW9ucyB0byBlc2J1aWxkIHRhcmdldC5cbiAqIEBzZWUgaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3RhcmdldFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3VwcG9ydGVkTm9kZVRhcmdldHMoKTogc3RyaW5nW10ge1xuICBpZiAoU1VQUE9SVEVEX05PREVfVkVSU0lPTlMuY2hhckF0KDApID09PSAnMCcpIHtcbiAgICAvLyBVbmxpa2UgYHBrZ19ucG1gLCBgdHNfbGlicmFyeWAgd2hpY2ggaXMgdXNlZCB0byBydW4gdW5pdCB0ZXN0cyBkb2VzIG5vdCBzdXBwb3J0IHN1YnN0aXR1dGlvbnMuXG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIFNVUFBPUlRFRF9OT0RFX1ZFUlNJT05TLnNwbGl0KCd8fCcpLm1hcCgodikgPT4gJ25vZGUnICsgY29lcmNlKHYpPy52ZXJzaW9uKTtcbn1cbiJdfQ==