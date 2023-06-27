"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformSupportedBrowsersToTargets = exports.createOutputFileFromText = exports.writeResultFiles = exports.getFeatureSupport = exports.logMessages = exports.withNoProgress = exports.withSpinner = exports.calculateEstimatedTransferSizes = exports.logBuildStats = void 0;
const esbuild_1 = require("esbuild");
const node_fs_1 = require("node:fs");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const node_zlib_1 = require("node:zlib");
const spinner_1 = require("../../utils/spinner");
const stats_1 = require("../webpack/utils/stats");
const compressAsync = (0, node_util_1.promisify)(node_zlib_1.brotliCompress);
function logBuildStats(context, metafile, initial, estimatedTransferSizes) {
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
        stats.push({
            initial: initial.has(file),
            stats: [
                file,
                initial.get(file)?.name ?? '-',
                output.bytes,
                estimatedTransferSizes?.get(file) ?? '-',
            ],
        });
    }
    const tableText = (0, stats_1.generateBuildStatsTable)(stats, true, true, !!estimatedTransferSizes, undefined);
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
        // esbuild to downlevel async/await and for await...of to a Zone.js supported form. However, esbuild
        // does not currently support downleveling async generators. Instead babel is used within the JS/TS
        // loader to perform the downlevel transformation.
        // NOTE: If esbuild adds support in the future, the babel support for async generators can be disabled.
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
        // Ensure output subdirectories exist
        const basePath = node_path_1.default.dirname(file.path);
        if (basePath && !directoryExists.has(basePath)) {
            await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
            directoryExists.add(basePath);
        }
        // Write file contents
        await promises_1.default.writeFile(node_path_1.default.join(outputPath, file.path), file.contents);
    }));
    if (assetFiles?.length) {
        await Promise.all(assetFiles.map(async ({ source, destination }) => {
            // Ensure output subdirectories exist
            const basePath = node_path_1.default.dirname(destination);
            if (basePath && !directoryExists.has(basePath)) {
                await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
                directoryExists.add(basePath);
            }
            // Copy file contents
            await promises_1.default.copyFile(source, node_path_1.default.join(outputPath, destination), node_fs_1.constants.COPYFILE_FICLONE);
        }));
    }
}
exports.writeResultFiles = writeResultFiles;
function createOutputFileFromText(path, text) {
    return {
        path,
        text,
        get contents() {
            return Buffer.from(this.text, 'utf-8');
        },
    };
}
exports.createOutputFileFromText = createOutputFileFromText;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILHFDQUE2RjtBQUM3RixxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUM3Qix5Q0FBc0M7QUFDdEMseUNBQTJDO0FBQzNDLGlEQUE4QztBQUM5QyxrREFBOEU7QUFHOUUsTUFBTSxhQUFhLEdBQUcsSUFBQSxxQkFBUyxFQUFDLDBCQUFjLENBQUMsQ0FBQztBQUVoRCxTQUFnQixhQUFhLENBQzNCLE9BQXVCLEVBQ3ZCLFFBQWtCLEVBQ2xCLE9BQXVDLEVBQ3ZDLHNCQUE0QztJQUU1QyxNQUFNLEtBQUssR0FBa0IsRUFBRSxDQUFDO0lBQ2hDLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM3RCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ25ELFNBQVM7U0FDVjtRQUNELG9DQUFvQztRQUNwQyw4REFBOEQ7UUFDOUQsSUFBSyxNQUFjLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDbkMsU0FBUztTQUNWO1FBRUQsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztZQUMxQixLQUFLLEVBQUU7Z0JBQ0wsSUFBSTtnQkFDSixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksSUFBSSxHQUFHO2dCQUM5QixN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LFdBQVcsRUFBRSxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTlELGlGQUFpRjtRQUNqRixJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUU7WUFDN0IsV0FBVyxHQUFHLEtBQUssQ0FBQztTQUNyQjtRQUVELGdGQUFnRjtRQUNoRixzRkFBc0Y7UUFDdEYsQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRS9CLElBQUksd0JBQXdCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQzdDLElBQUksV0FBVyxLQUFLLFFBQVEsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO2dCQUNoRCwyRkFBMkY7Z0JBQzNGLDBGQUEwRjtnQkFDMUYsT0FBTyxHQUFHLEtBQUssQ0FBQzthQUNqQjtpQkFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDakMsd0ZBQXdGO2dCQUN4RiwwRkFBMEY7Z0JBQzFGLDJFQUEyRTtnQkFDM0UsT0FBTyxJQUFJLElBQUksQ0FBQzthQUNqQjtZQUVELFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxDQUFDO1NBQ3pDO0tBQ0Y7SUFFRCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBNUNELGtGQTRDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgQnVpbGRPcHRpb25zLCBNZXRhZmlsZSwgT3V0cHV0RmlsZSwgUGFydGlhbE1lc3NhZ2UsIGZvcm1hdE1lc3NhZ2VzIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBjb25zdGFudHMgYXMgZnNDb25zdGFudHMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICdub2RlOnV0aWwnO1xuaW1wb3J0IHsgYnJvdGxpQ29tcHJlc3MgfSBmcm9tICdub2RlOnpsaWInO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgQnVuZGxlU3RhdHMsIGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlIH0gZnJvbSAnLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBJbml0aWFsRmlsZVJlY29yZCB9IGZyb20gJy4vYnVuZGxlci1jb250ZXh0JztcblxuY29uc3QgY29tcHJlc3NBc3luYyA9IHByb21pc2lmeShicm90bGlDb21wcmVzcyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dCdWlsZFN0YXRzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgbWV0YWZpbGU6IE1ldGFmaWxlLFxuICBpbml0aWFsOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4sXG4gIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM/OiBNYXA8c3RyaW5nLCBudW1iZXI+LFxuKTogdm9pZCB7XG4gIGNvbnN0IHN0YXRzOiBCdW5kbGVTdGF0c1tdID0gW107XG4gIGZvciAoY29uc3QgW2ZpbGUsIG91dHB1dF0gb2YgT2JqZWN0LmVudHJpZXMobWV0YWZpbGUub3V0cHV0cykpIHtcbiAgICAvLyBPbmx5IGRpc3BsYXkgSmF2YVNjcmlwdCBhbmQgQ1NTIGZpbGVzXG4gICAgaWYgKCFmaWxlLmVuZHNXaXRoKCcuanMnKSAmJiAhZmlsZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gU2tpcCBpbnRlcm5hbCBjb21wb25lbnQgcmVzb3VyY2VzXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBpZiAoKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgc3RhdHMucHVzaCh7XG4gICAgICBpbml0aWFsOiBpbml0aWFsLmhhcyhmaWxlKSxcbiAgICAgIHN0YXRzOiBbXG4gICAgICAgIGZpbGUsXG4gICAgICAgIGluaXRpYWwuZ2V0KGZpbGUpPy5uYW1lID8/ICctJyxcbiAgICAgICAgb3V0cHV0LmJ5dGVzLFxuICAgICAgICBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzPy5nZXQoZmlsZSkgPz8gJy0nLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRhYmxlVGV4dCA9IGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlKHN0YXRzLCB0cnVlLCB0cnVlLCAhIWVzdGltYXRlZFRyYW5zZmVyU2l6ZXMsIHVuZGVmaW5lZCk7XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnXFxuJyArIHRhYmxlVGV4dCArICdcXG4nKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMoXG4gIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10sXG4pOiBQcm9taXNlPE1hcDxzdHJpbmcsIG51bWJlcj4+IHtcbiAgY29uc3Qgc2l6ZXMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBjb25zdCBwZW5kaW5nQ29tcHJlc3Npb24gPSBbXTtcblxuICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICAvLyBPbmx5IGNhbGN1bGF0ZSBKYXZhU2NyaXB0IGFuZCBDU1MgZmlsZXNcbiAgICBpZiAoIW91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJykgJiYgIW91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGNvbXByZXNzaW5nIHNtYWxsIGZpbGVzIHdoaWNoIG1heSBlbmQgYmVpbmcgbGFyZ2VyIG9uY2UgY29tcHJlc3NlZCBhbmQgd2lsbCBtb3N0IGxpa2VseSBub3QgYmVcbiAgICAvLyBjb21wcmVzc2VkIGluIGFjdHVhbCB0cmFuc2l0LlxuICAgIGlmIChvdXRwdXRGaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGggPCAxMDI0KSB7XG4gICAgICBzaXplcy5zZXQob3V0cHV0RmlsZS5wYXRoLCBvdXRwdXRGaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcGVuZGluZ0NvbXByZXNzaW9uLnB1c2goXG4gICAgICBjb21wcmVzc0FzeW5jKG91dHB1dEZpbGUuY29udGVudHMpLnRoZW4oKHJlc3VsdCkgPT5cbiAgICAgICAgc2l6ZXMuc2V0KG91dHB1dEZpbGUucGF0aCwgcmVzdWx0LmJ5dGVMZW5ndGgpLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgUHJvbWlzZS5hbGwocGVuZGluZ0NvbXByZXNzaW9uKTtcblxuICByZXR1cm4gc2l6ZXM7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoU3Bpbm5lcjxUPih0ZXh0OiBzdHJpbmcsIGFjdGlvbjogKCkgPT4gVCB8IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKHRleHQpO1xuICBzcGlubmVyLnN0YXJ0KCk7XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgYWN0aW9uKCk7XG4gIH0gZmluYWxseSB7XG4gICAgc3Bpbm5lci5zdG9wKCk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhOb1Byb2dyZXNzPFQ+KHRlc3Q6IHN0cmluZywgYWN0aW9uOiAoKSA9PiBUIHwgUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICByZXR1cm4gYWN0aW9uKCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dNZXNzYWdlcyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHsgZXJyb3JzLCB3YXJuaW5ncyB9OiB7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW107IHdhcm5pbmdzPzogUGFydGlhbE1lc3NhZ2VbXSB9LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICh3YXJuaW5ncz8ubGVuZ3RoKSB7XG4gICAgY29uc3Qgd2FybmluZ01lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMod2FybmluZ3MsIHsga2luZDogJ3dhcm5pbmcnLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmdNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBlcnJvck1lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMoZXJyb3JzLCB7IGtpbmQ6ICdlcnJvcicsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc3ludGF4IGZlYXR1cmUgb2JqZWN0IG1hcCBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYmFzZWQgb24gYSBsaXN0IG9mIHRhcmdldHMuXG4gKiBBIGZ1bGwgc2V0IG9mIGZlYXR1cmUgbmFtZXMgY2FuIGJlIGZvdW5kIGhlcmU6IGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyNzdXBwb3J0ZWRcbiAqIEBwYXJhbSB0YXJnZXQgQW4gYXJyYXkgb2YgYnJvd3Nlci9lbmdpbmUgdGFyZ2V0cyBpbiB0aGUgZm9ybWF0IGFjY2VwdGVkIGJ5IHRoZSBlc2J1aWxkIGB0YXJnZXRgIG9wdGlvbi5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHdpdGggdGhlIGVzYnVpbGQgYnVpbGQgYHN1cHBvcnRlZGAgb3B0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0OiBzdHJpbmdbXSk6IEJ1aWxkT3B0aW9uc1snc3VwcG9ydGVkJ10ge1xuICBjb25zdCBzdXBwb3J0ZWQ6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge1xuICAgIC8vIE5hdGl2ZSBhc3luYy9hd2FpdCBpcyBub3Qgc3VwcG9ydGVkIHdpdGggWm9uZS5qcy4gRGlzYWJsaW5nIHN1cHBvcnQgaGVyZSB3aWxsIGNhdXNlXG4gICAgLy8gZXNidWlsZCB0byBkb3dubGV2ZWwgYXN5bmMvYXdhaXQgYW5kIGZvciBhd2FpdC4uLm9mIHRvIGEgWm9uZS5qcyBzdXBwb3J0ZWQgZm9ybS4gSG93ZXZlciwgZXNidWlsZFxuICAgIC8vIGRvZXMgbm90IGN1cnJlbnRseSBzdXBwb3J0IGRvd25sZXZlbGluZyBhc3luYyBnZW5lcmF0b3JzLiBJbnN0ZWFkIGJhYmVsIGlzIHVzZWQgd2l0aGluIHRoZSBKUy9UU1xuICAgIC8vIGxvYWRlciB0byBwZXJmb3JtIHRoZSBkb3dubGV2ZWwgdHJhbnNmb3JtYXRpb24uXG4gICAgLy8gTk9URTogSWYgZXNidWlsZCBhZGRzIHN1cHBvcnQgaW4gdGhlIGZ1dHVyZSwgdGhlIGJhYmVsIHN1cHBvcnQgZm9yIGFzeW5jIGdlbmVyYXRvcnMgY2FuIGJlIGRpc2FibGVkLlxuICAgICdhc3luYy1hd2FpdCc6IGZhbHNlLFxuICAgIC8vIFY4IGN1cnJlbnRseSBoYXMgYSBwZXJmb3JtYW5jZSBkZWZlY3QgaW52b2x2aW5nIG9iamVjdCBzcHJlYWQgb3BlcmF0aW9ucyB0aGF0IGNhbiBjYXVzZSBzaWduZmljYW50XG4gICAgLy8gZGVncmFkYXRpb24gaW4gcnVudGltZSBwZXJmb3JtYW5jZS4gQnkgbm90IHN1cHBvcnRpbmcgdGhlIGxhbmd1YWdlIGZlYXR1cmUgaGVyZSwgYSBkb3dubGV2ZWwgZm9ybVxuICAgIC8vIHdpbGwgYmUgdXNlZCBpbnN0ZWFkIHdoaWNoIHByb3ZpZGVzIGEgd29ya2Fyb3VuZCBmb3IgdGhlIHBlcmZvcm1hbmNlIGlzc3VlLlxuICAgIC8vIEZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTExNTM2XG4gICAgJ29iamVjdC1yZXN0LXNwcmVhZCc6IGZhbHNlLFxuICB9O1xuXG4gIC8vIERldGVjdCBTYWZhcmkgYnJvd3NlciB2ZXJzaW9ucyB0aGF0IGhhdmUgYSBjbGFzcyBmaWVsZCBiZWhhdmlvciBidWdcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjQzNTUjaXNzdWVjb21tZW50LTEzMzM0NzcwMzNcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vV2ViS2l0L1dlYktpdC9jb21taXQvZTg3ODhhMzRiM2Q1ZjViNGVkZDdmZjY0NTBiODA5MzZiZmYzOTZmMlxuICBsZXQgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gZmFsc2U7XG4gIGZvciAoY29uc3QgYnJvd3NlciBvZiB0YXJnZXQpIHtcbiAgICBsZXQgbWFqb3JWZXJzaW9uO1xuICAgIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ2lvcycpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSgzLCA1KSk7XG4gICAgfSBlbHNlIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ3NhZmFyaScpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSg2LCA4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBUZWNobmljYWxseSwgMTQuMCBpcyBub3QgYnJva2VuIGJ1dCByYXRoZXIgZG9lcyBub3QgaGF2ZSBzdXBwb3J0LiBIb3dldmVyLCB0aGUgYmVoYXZpb3JcbiAgICAvLyBpcyBpZGVudGljYWwgc2luY2UgaXQgd291bGQgYmUgc2V0IHRvIGZhbHNlIGJ5IGVzYnVpbGQgaWYgcHJlc2VudCBhcyBhIHRhcmdldC5cbiAgICBpZiAobWFqb3JWZXJzaW9uID09PSAxNCB8fCBtYWpvclZlcnNpb24gPT09IDE1KSB7XG4gICAgICBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIElmIGNsYXNzIGZpZWxkIHN1cHBvcnQgY2Fubm90IGJlIHVzZWQgc2V0IHRvIGZhbHNlOyBvdGhlcndpc2UgbGVhdmUgdW5kZWZpbmVkIHRvIGFsbG93XG4gIC8vIGVzYnVpbGQgdG8gdXNlIGB0YXJnZXRgIHRvIGRldGVybWluZSBzdXBwb3J0LlxuICBpZiAoc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnKSB7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1maWVsZCddID0gZmFsc2U7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1zdGF0aWMtZmllbGQnXSA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHN1cHBvcnRlZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdyaXRlUmVzdWx0RmlsZXMoXG4gIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGFzc2V0RmlsZXM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdIHwgdW5kZWZpbmVkLFxuICBvdXRwdXRQYXRoOiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgZGlyZWN0b3J5RXhpc3RzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGF3YWl0IFByb21pc2UuYWxsKFxuICAgIG91dHB1dEZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZmlsZS5wYXRoKTtcbiAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgfVxuICAgICAgLy8gV3JpdGUgZmlsZSBjb250ZW50c1xuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihvdXRwdXRQYXRoLCBmaWxlLnBhdGgpLCBmaWxlLmNvbnRlbnRzKTtcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoYXNzZXRGaWxlcz8ubGVuZ3RoKSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhc3NldEZpbGVzLm1hcChhc3luYyAoeyBzb3VyY2UsIGRlc3RpbmF0aW9uIH0pID0+IHtcbiAgICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShkZXN0aW5hdGlvbik7XG4gICAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDb3B5IGZpbGUgY29udGVudHNcbiAgICAgICAgYXdhaXQgZnMuY29weUZpbGUoc291cmNlLCBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZGVzdGluYXRpb24pLCBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdGV4dCxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20odGhpcy50ZXh0LCAndXRmLTgnKTtcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBicm93c2VybGlzdHMgcmVzdWx0IHRvIGVzYnVpbGQgdGFyZ2V0LlxuICogQHNlZSBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jdGFyZ2V0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhzdXBwb3J0ZWRCcm93c2Vyczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHRyYW5zZm9ybWVkOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyN0YXJnZXRcbiAgY29uc3QgZXNCdWlsZFN1cHBvcnRlZEJyb3dzZXJzID0gbmV3IFNldChbXG4gICAgJ2Nocm9tZScsXG4gICAgJ2VkZ2UnLFxuICAgICdmaXJlZm94JyxcbiAgICAnaWUnLFxuICAgICdpb3MnLFxuICAgICdub2RlJyxcbiAgICAnb3BlcmEnLFxuICAgICdzYWZhcmknLFxuICBdKTtcblxuICBmb3IgKGNvbnN0IGJyb3dzZXIgb2Ygc3VwcG9ydGVkQnJvd3NlcnMpIHtcbiAgICBsZXQgW2Jyb3dzZXJOYW1lLCB2ZXJzaW9uXSA9IGJyb3dzZXIudG9Mb3dlckNhc2UoKS5zcGxpdCgnICcpO1xuXG4gICAgLy8gYnJvd3NlcnNsaXN0IHVzZXMgdGhlIG5hbWUgYGlvc19zYWZgIGZvciBpT1MgU2FmYXJpIHdoZXJlYXMgZXNidWlsZCB1c2VzIGBpb3NgXG4gICAgaWYgKGJyb3dzZXJOYW1lID09PSAnaW9zX3NhZicpIHtcbiAgICAgIGJyb3dzZXJOYW1lID0gJ2lvcyc7XG4gICAgfVxuXG4gICAgLy8gYnJvd3NlcnNsaXN0IHVzZXMgcmFuZ2VzIGAxNS4yLTE1LjNgIHZlcnNpb25zIGJ1dCBvbmx5IHRoZSBsb3dlc3QgaXMgcmVxdWlyZWRcbiAgICAvLyB0byBwZXJmb3JtIG1pbmltdW0gc3VwcG9ydGVkIGZlYXR1cmUgY2hlY2tzLiBlc2J1aWxkIGFsc28gZXhwZWN0cyBhIHNpbmdsZSB2ZXJzaW9uLlxuICAgIFt2ZXJzaW9uXSA9IHZlcnNpb24uc3BsaXQoJy0nKTtcblxuICAgIGlmIChlc0J1aWxkU3VwcG9ydGVkQnJvd3NlcnMuaGFzKGJyb3dzZXJOYW1lKSkge1xuICAgICAgaWYgKGJyb3dzZXJOYW1lID09PSAnc2FmYXJpJyAmJiB2ZXJzaW9uID09PSAndHAnKSB7XG4gICAgICAgIC8vIGVzYnVpbGQgb25seSBzdXBwb3J0cyBudW1lcmljIHZlcnNpb25zIHNvIGBUUGAgaXMgY29udmVydGVkIHRvIGEgaGlnaCBudW1iZXIgKDk5OSkgc2luY2VcbiAgICAgICAgLy8gYSBUZWNobm9sb2d5IFByZXZpZXcgKFRQKSBvZiBTYWZhcmkgaXMgYXNzdW1lZCB0byBzdXBwb3J0IGFsbCBjdXJyZW50bHkga25vd24gZmVhdHVyZXMuXG4gICAgICAgIHZlcnNpb24gPSAnOTk5JztcbiAgICAgIH0gZWxzZSBpZiAoIXZlcnNpb24uaW5jbHVkZXMoJy4nKSkge1xuICAgICAgICAvLyBBIGxvbmUgbWFqb3IgdmVyc2lvbiBpcyBjb25zaWRlcmVkIGJ5IGVzYnVpbGQgdG8gaW5jbHVkZSBhbGwgbWlub3IgdmVyc2lvbnMuIEhvd2V2ZXIsXG4gICAgICAgIC8vIGJyb3dzZXJzbGlzdCBkb2VzIG5vdCBhbmQgaXMgYWxzbyBpbmNvbnNpc3RlbnQgaW4gaXRzIGAuMGAgdmVyc2lvbiBuYW1pbmcuIEZvciBleGFtcGxlLFxuICAgICAgICAvLyBTYWZhcmkgMTUuMCBpcyBuYW1lZCBgc2FmYXJpIDE1YCBidXQgU2FmYXJpIDE2LjAgaXMgbmFtZWQgYHNhZmFyaSAxNi4wYC5cbiAgICAgICAgdmVyc2lvbiArPSAnLjAnO1xuICAgICAgfVxuXG4gICAgICB0cmFuc2Zvcm1lZC5wdXNoKGJyb3dzZXJOYW1lICsgdmVyc2lvbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybWVkO1xufVxuIl19