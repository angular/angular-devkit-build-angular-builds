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
exports.createOutputFileFromText = exports.writeResultFiles = exports.getFeatureSupport = exports.logMessages = exports.withNoProgress = exports.withSpinner = exports.calculateEstimatedTransferSizes = exports.logBuildStats = void 0;
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
        // esbuild currently has a defect involving self-referencing a class within a static code block or
        // static field initializer. This is not an issue for projects that use the default browserslist as these
        // elements are an ES2022 feature which is not support by all browsers in the default list. However, if a
        // custom browserslist is used that only has newer browsers than the static code elements may be present.
        // This issue is compounded by the default usage of the tsconfig `"useDefineForClassFields": false` option
        // present in generated CLI projects which causes static code blocks to be used instead of static fields.
        // esbuild currently unconditionally downlevels all static fields in top-level classes so to workaround the
        // Angular issue only static code blocks are disabled here.
        // For more details: https://github.com/evanw/esbuild/issues/2950
        'class-static-blocks': false,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILHFDQUE2RjtBQUM3RixxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUM3Qix5Q0FBc0M7QUFDdEMseUNBQTJDO0FBQzNDLGlEQUE4QztBQUM5QyxrREFBOEU7QUFHOUUsTUFBTSxhQUFhLEdBQUcsSUFBQSxxQkFBUyxFQUFDLDBCQUFjLENBQUMsQ0FBQztBQUVoRCxTQUFnQixhQUFhLENBQzNCLE9BQXVCLEVBQ3ZCLFFBQWtCLEVBQ2xCLE9BQXVDLEVBQ3ZDLHNCQUE0QztJQUU1QyxNQUFNLEtBQUssR0FBa0IsRUFBRSxDQUFDO0lBQ2hDLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM3RCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ25ELFNBQVM7U0FDVjtRQUNELG9DQUFvQztRQUNwQyw4REFBOEQ7UUFDOUQsSUFBSyxNQUFjLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDbkMsU0FBUztTQUNWO1FBRUQsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztZQUMxQixLQUFLLEVBQUU7Z0JBQ0wsSUFBSTtnQkFDSixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksSUFBSSxHQUFHO2dCQUM5QixN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LEVBQUU7UUFDdEIsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7WUFDL0MscUNBQXFDO1lBQ3JDLE1BQU0sUUFBUSxHQUFHLG1CQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNDLElBQUksUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDOUMsTUFBTSxrQkFBRSxDQUFDLEtBQUssQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDckUsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUMvQjtZQUNELHFCQUFxQjtZQUNyQixNQUFNLGtCQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxtQkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLEVBQUUsbUJBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzlGLENBQUMsQ0FBQyxDQUNILENBQUM7S0FDSDtBQUNILENBQUM7QUFqQ0QsNENBaUNDO0FBRUQsU0FBZ0Isd0JBQXdCLENBQUMsSUFBWSxFQUFFLElBQVk7SUFDakUsT0FBTztRQUNMLElBQUk7UUFDSixJQUFJO1FBQ0osSUFBSSxRQUFRO1lBQ1YsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekMsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBUkQsNERBUUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEJ1aWxkT3B0aW9ucywgTWV0YWZpbGUsIE91dHB1dEZpbGUsIFBhcnRpYWxNZXNzYWdlLCBmb3JtYXRNZXNzYWdlcyB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCB7IGJyb3RsaUNvbXByZXNzIH0gZnJvbSAnbm9kZTp6bGliJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IEJ1bmRsZVN0YXRzLCBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZSB9IGZyb20gJy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgSW5pdGlhbEZpbGVSZWNvcmQgfSBmcm9tICcuL2J1bmRsZXItY29udGV4dCc7XG5cbmNvbnN0IGNvbXByZXNzQXN5bmMgPSBwcm9taXNpZnkoYnJvdGxpQ29tcHJlc3MpO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nQnVpbGRTdGF0cyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIG1ldGFmaWxlOiBNZXRhZmlsZSxcbiAgaW5pdGlhbDogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuICBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzPzogTWFwPHN0cmluZywgbnVtYmVyPixcbik6IHZvaWQge1xuICBjb25zdCBzdGF0czogQnVuZGxlU3RhdHNbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtmaWxlLCBvdXRwdXRdIG9mIE9iamVjdC5lbnRyaWVzKG1ldGFmaWxlLm91dHB1dHMpKSB7XG4gICAgLy8gT25seSBkaXNwbGF5IEphdmFTY3JpcHQgYW5kIENTUyBmaWxlc1xuICAgIGlmICghZmlsZS5lbmRzV2l0aCgnLmpzJykgJiYgIWZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFNraXAgaW50ZXJuYWwgY29tcG9uZW50IHJlc291cmNlc1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgaWYgKChvdXRwdXQgYXMgYW55KVsnbmctY29tcG9uZW50J10pIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN0YXRzLnB1c2goe1xuICAgICAgaW5pdGlhbDogaW5pdGlhbC5oYXMoZmlsZSksXG4gICAgICBzdGF0czogW1xuICAgICAgICBmaWxlLFxuICAgICAgICBpbml0aWFsLmdldChmaWxlKT8ubmFtZSA/PyAnLScsXG4gICAgICAgIG91dHB1dC5ieXRlcyxcbiAgICAgICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplcz8uZ2V0KGZpbGUpID8/ICctJyxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0YWJsZVRleHQgPSBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShzdGF0cywgdHJ1ZSwgdHJ1ZSwgISFlc3RpbWF0ZWRUcmFuc2ZlclNpemVzLCB1bmRlZmluZWQpO1xuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oJ1xcbicgKyB0YWJsZVRleHQgKyAnXFxuJyk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxjdWxhdGVFc3RpbWF0ZWRUcmFuc2ZlclNpemVzKFxuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdLFxuKTogUHJvbWlzZTxNYXA8c3RyaW5nLCBudW1iZXI+PiB7XG4gIGNvbnN0IHNpemVzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgY29uc3QgcGVuZGluZ0NvbXByZXNzaW9uID0gW107XG5cbiAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIG91dHB1dEZpbGVzKSB7XG4gICAgLy8gT25seSBjYWxjdWxhdGUgSmF2YVNjcmlwdCBhbmQgQ1NTIGZpbGVzXG4gICAgaWYgKCFvdXRwdXRGaWxlLnBhdGguZW5kc1dpdGgoJy5qcycpICYmICFvdXRwdXRGaWxlLnBhdGguZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBjb21wcmVzc2luZyBzbWFsbCBmaWxlcyB3aGljaCBtYXkgZW5kIGJlaW5nIGxhcmdlciBvbmNlIGNvbXByZXNzZWQgYW5kIHdpbGwgbW9zdCBsaWtlbHkgbm90IGJlXG4gICAgLy8gY29tcHJlc3NlZCBpbiBhY3R1YWwgdHJhbnNpdC5cbiAgICBpZiAob3V0cHV0RmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoIDwgMTAyNCkge1xuICAgICAgc2l6ZXMuc2V0KG91dHB1dEZpbGUucGF0aCwgb3V0cHV0RmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHBlbmRpbmdDb21wcmVzc2lvbi5wdXNoKFxuICAgICAgY29tcHJlc3NBc3luYyhvdXRwdXRGaWxlLmNvbnRlbnRzKS50aGVuKChyZXN1bHQpID0+XG4gICAgICAgIHNpemVzLnNldChvdXRwdXRGaWxlLnBhdGgsIHJlc3VsdC5ieXRlTGVuZ3RoKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGF3YWl0IFByb21pc2UuYWxsKHBlbmRpbmdDb21wcmVzc2lvbik7XG5cbiAgcmV0dXJuIHNpemVzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2l0aFNwaW5uZXI8VD4odGV4dDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQgfCBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcih0ZXh0KTtcbiAgc3Bpbm5lci5zdGFydCgpO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICB9IGZpbmFsbHkge1xuICAgIHNwaW5uZXIuc3RvcCgpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoTm9Qcm9ncmVzczxUPih0ZXN0OiBzdHJpbmcsIGFjdGlvbjogKCkgPT4gVCB8IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgcmV0dXJuIGFjdGlvbigpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9nTWVzc2FnZXMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB7IGVycm9ycywgd2FybmluZ3MgfTogeyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdOyB3YXJuaW5ncz86IFBhcnRpYWxNZXNzYWdlW10gfSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAod2FybmluZ3M/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHdhcm5pbmdNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKHdhcm5pbmdzLCB7IGtpbmQ6ICd3YXJuaW5nJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG5cbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKGVycm9ycywgeyBraW5kOiAnZXJyb3InLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvck1lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHN5bnRheCBmZWF0dXJlIG9iamVjdCBtYXAgZm9yIEFuZ3VsYXIgYXBwbGljYXRpb25zIGJhc2VkIG9uIGEgbGlzdCBvZiB0YXJnZXRzLlxuICogQSBmdWxsIHNldCBvZiBmZWF0dXJlIG5hbWVzIGNhbiBiZSBmb3VuZCBoZXJlOiBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jc3VwcG9ydGVkXG4gKiBAcGFyYW0gdGFyZ2V0IEFuIGFycmF5IG9mIGJyb3dzZXIvZW5naW5lIHRhcmdldHMgaW4gdGhlIGZvcm1hdCBhY2NlcHRlZCBieSB0aGUgZXNidWlsZCBgdGFyZ2V0YCBvcHRpb24uXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB3aXRoIHRoZSBlc2J1aWxkIGJ1aWxkIGBzdXBwb3J0ZWRgIG9wdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldDogc3RyaW5nW10pOiBCdWlsZE9wdGlvbnNbJ3N1cHBvcnRlZCddIHtcbiAgY29uc3Qgc3VwcG9ydGVkOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHtcbiAgICAvLyBOYXRpdmUgYXN5bmMvYXdhaXQgaXMgbm90IHN1cHBvcnRlZCB3aXRoIFpvbmUuanMuIERpc2FibGluZyBzdXBwb3J0IGhlcmUgd2lsbCBjYXVzZVxuICAgIC8vIGVzYnVpbGQgdG8gZG93bmxldmVsIGFzeW5jL2F3YWl0IGFuZCBmb3IgYXdhaXQuLi5vZiB0byBhIFpvbmUuanMgc3VwcG9ydGVkIGZvcm0uIEhvd2V2ZXIsIGVzYnVpbGRcbiAgICAvLyBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBkb3dubGV2ZWxpbmcgYXN5bmMgZ2VuZXJhdG9ycy4gSW5zdGVhZCBiYWJlbCBpcyB1c2VkIHdpdGhpbiB0aGUgSlMvVFNcbiAgICAvLyBsb2FkZXIgdG8gcGVyZm9ybSB0aGUgZG93bmxldmVsIHRyYW5zZm9ybWF0aW9uLlxuICAgIC8vIE5PVEU6IElmIGVzYnVpbGQgYWRkcyBzdXBwb3J0IGluIHRoZSBmdXR1cmUsIHRoZSBiYWJlbCBzdXBwb3J0IGZvciBhc3luYyBnZW5lcmF0b3JzIGNhbiBiZSBkaXNhYmxlZC5cbiAgICAnYXN5bmMtYXdhaXQnOiBmYWxzZSxcbiAgICAvLyBWOCBjdXJyZW50bHkgaGFzIGEgcGVyZm9ybWFuY2UgZGVmZWN0IGludm9sdmluZyBvYmplY3Qgc3ByZWFkIG9wZXJhdGlvbnMgdGhhdCBjYW4gY2F1c2Ugc2lnbmZpY2FudFxuICAgIC8vIGRlZ3JhZGF0aW9uIGluIHJ1bnRpbWUgcGVyZm9ybWFuY2UuIEJ5IG5vdCBzdXBwb3J0aW5nIHRoZSBsYW5ndWFnZSBmZWF0dXJlIGhlcmUsIGEgZG93bmxldmVsIGZvcm1cbiAgICAvLyB3aWxsIGJlIHVzZWQgaW5zdGVhZCB3aGljaCBwcm92aWRlcyBhIHdvcmthcm91bmQgZm9yIHRoZSBwZXJmb3JtYW5jZSBpc3N1ZS5cbiAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0xMTUzNlxuICAgICdvYmplY3QtcmVzdC1zcHJlYWQnOiBmYWxzZSxcbiAgICAvLyBlc2J1aWxkIGN1cnJlbnRseSBoYXMgYSBkZWZlY3QgaW52b2x2aW5nIHNlbGYtcmVmZXJlbmNpbmcgYSBjbGFzcyB3aXRoaW4gYSBzdGF0aWMgY29kZSBibG9jayBvclxuICAgIC8vIHN0YXRpYyBmaWVsZCBpbml0aWFsaXplci4gVGhpcyBpcyBub3QgYW4gaXNzdWUgZm9yIHByb2plY3RzIHRoYXQgdXNlIHRoZSBkZWZhdWx0IGJyb3dzZXJzbGlzdCBhcyB0aGVzZVxuICAgIC8vIGVsZW1lbnRzIGFyZSBhbiBFUzIwMjIgZmVhdHVyZSB3aGljaCBpcyBub3Qgc3VwcG9ydCBieSBhbGwgYnJvd3NlcnMgaW4gdGhlIGRlZmF1bHQgbGlzdC4gSG93ZXZlciwgaWYgYVxuICAgIC8vIGN1c3RvbSBicm93c2Vyc2xpc3QgaXMgdXNlZCB0aGF0IG9ubHkgaGFzIG5ld2VyIGJyb3dzZXJzIHRoYW4gdGhlIHN0YXRpYyBjb2RlIGVsZW1lbnRzIG1heSBiZSBwcmVzZW50LlxuICAgIC8vIFRoaXMgaXNzdWUgaXMgY29tcG91bmRlZCBieSB0aGUgZGVmYXVsdCB1c2FnZSBvZiB0aGUgdHNjb25maWcgYFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIjogZmFsc2VgIG9wdGlvblxuICAgIC8vIHByZXNlbnQgaW4gZ2VuZXJhdGVkIENMSSBwcm9qZWN0cyB3aGljaCBjYXVzZXMgc3RhdGljIGNvZGUgYmxvY2tzIHRvIGJlIHVzZWQgaW5zdGVhZCBvZiBzdGF0aWMgZmllbGRzLlxuICAgIC8vIGVzYnVpbGQgY3VycmVudGx5IHVuY29uZGl0aW9uYWxseSBkb3dubGV2ZWxzIGFsbCBzdGF0aWMgZmllbGRzIGluIHRvcC1sZXZlbCBjbGFzc2VzIHNvIHRvIHdvcmthcm91bmQgdGhlXG4gICAgLy8gQW5ndWxhciBpc3N1ZSBvbmx5IHN0YXRpYyBjb2RlIGJsb2NrcyBhcmUgZGlzYWJsZWQgaGVyZS5cbiAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vZXZhbncvZXNidWlsZC9pc3N1ZXMvMjk1MFxuICAgICdjbGFzcy1zdGF0aWMtYmxvY2tzJzogZmFsc2UsXG4gIH07XG5cbiAgLy8gRGV0ZWN0IFNhZmFyaSBicm93c2VyIHZlcnNpb25zIHRoYXQgaGF2ZSBhIGNsYXNzIGZpZWxkIGJlaGF2aW9yIGJ1Z1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9XZWJLaXQvV2ViS2l0L2NvbW1pdC9lODc4OGEzNGIzZDVmNWI0ZWRkN2ZmNjQ1MGI4MDkzNmJmZjM5NmYyXG4gIGxldCBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHRhcmdldCkge1xuICAgIGxldCBtYWpvclZlcnNpb247XG4gICAgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnaW9zJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDMsIDUpKTtcbiAgICB9IGVsc2UgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnc2FmYXJpJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDYsIDgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRlY2huaWNhbGx5LCAxNC4wIGlzIG5vdCBicm9rZW4gYnV0IHJhdGhlciBkb2VzIG5vdCBoYXZlIHN1cHBvcnQuIEhvd2V2ZXIsIHRoZSBiZWhhdmlvclxuICAgIC8vIGlzIGlkZW50aWNhbCBzaW5jZSBpdCB3b3VsZCBiZSBzZXQgdG8gZmFsc2UgYnkgZXNidWlsZCBpZiBwcmVzZW50IGFzIGEgdGFyZ2V0LlxuICAgIGlmIChtYWpvclZlcnNpb24gPT09IDE0IHx8IG1ham9yVmVyc2lvbiA9PT0gMTUpIHtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gSWYgY2xhc3MgZmllbGQgc3VwcG9ydCBjYW5ub3QgYmUgdXNlZCBzZXQgdG8gZmFsc2U7IG90aGVyd2lzZSBsZWF2ZSB1bmRlZmluZWQgdG8gYWxsb3dcbiAgLy8gZXNidWlsZCB0byB1c2UgYHRhcmdldGAgdG8gZGV0ZXJtaW5lIHN1cHBvcnQuXG4gIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcpIHtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLWZpZWxkJ10gPSBmYWxzZTtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLXN0YXRpYy1maWVsZCddID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gc3VwcG9ydGVkO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVSZXN1bHRGaWxlcyhcbiAgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSxcbiAgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10gfCB1bmRlZmluZWQsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbikge1xuICBjb25zdCBkaXJlY3RvcnlFeGlzdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShmaWxlLnBhdGgpO1xuICAgICAgaWYgKGJhc2VQYXRoICYmICFkaXJlY3RvcnlFeGlzdHMuaGFzKGJhc2VQYXRoKSkge1xuICAgICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgZGlyZWN0b3J5RXhpc3RzLmFkZChiYXNlUGF0aCk7XG4gICAgICB9XG4gICAgICAvLyBXcml0ZSBmaWxlIGNvbnRlbnRzXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpO1xuICAgIH0pLFxuICApO1xuXG4gIGlmIChhc3NldEZpbGVzPy5sZW5ndGgpIHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGFzc2V0RmlsZXMubWFwKGFzeW5jICh7IHNvdXJjZSwgZGVzdGluYXRpb24gfSkgPT4ge1xuICAgICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGRlc3RpbmF0aW9uKTtcbiAgICAgICAgaWYgKGJhc2VQYXRoICYmICFkaXJlY3RvcnlFeGlzdHMuaGFzKGJhc2VQYXRoKSkge1xuICAgICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvcHkgZmlsZSBjb250ZW50c1xuICAgICAgICBhd2FpdCBmcy5jb3B5RmlsZShzb3VyY2UsIHBhdGguam9pbihvdXRwdXRQYXRoLCBkZXN0aW5hdGlvbiksIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG4iXX0=