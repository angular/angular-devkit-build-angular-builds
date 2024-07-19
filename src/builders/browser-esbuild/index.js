"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEsbuildBrowser = buildEsbuildBrowser;
exports.buildEsbuildBrowserArchitect = buildEsbuildBrowserArchitect;
const private_1 = require("@angular/build/private");
const architect_1 = require("@angular-devkit/architect");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const builder_status_warnings_1 = require("./builder-status-warnings");
/**
 * Main execution function for the esbuild-based application builder.
 * The options are compatible with the Webpack-based builder.
 * @param userOptions The browser builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns An async iterable with the builder result output
 */
async function* buildEsbuildBrowser(userOptions, context, infrastructureSettings, plugins) {
    // Inform user of status of builder and options
    (0, builder_status_warnings_1.logBuilderStatusWarnings)(userOptions, context);
    const normalizedOptions = normalizeOptions(userOptions);
    const { deleteOutputPath, outputPath } = normalizedOptions;
    const fullOutputPath = node_path_1.default.join(context.workspaceRoot, outputPath.base);
    if (deleteOutputPath && infrastructureSettings?.write !== false) {
        await (0, private_1.deleteOutputDir)(context.workspaceRoot, outputPath.base);
    }
    for await (const result of (0, private_1.buildApplicationInternal)(normalizedOptions, context, {
        write: false,
    }, plugins && { codePlugins: plugins })) {
        // Write the file directly from this builder to maintain webpack output compatibility
        // and not output browser files into '/browser'.
        if (infrastructureSettings?.write !== false &&
            (result.kind === private_1.ResultKind.Full || result.kind === private_1.ResultKind.Incremental)) {
            const directoryExists = new Set();
            // Writes the output file to disk and ensures the containing directories are present
            await (0, private_1.emitFilesToDisk)(Object.entries(result.files), async ([filePath, file]) => {
                // Ensure output subdirectories exist
                const basePath = node_path_1.default.dirname(filePath);
                if (basePath && !directoryExists.has(basePath)) {
                    await promises_1.default.mkdir(node_path_1.default.join(fullOutputPath, basePath), { recursive: true });
                    directoryExists.add(basePath);
                }
                if (file.origin === 'memory') {
                    // Write file contents
                    await promises_1.default.writeFile(node_path_1.default.join(fullOutputPath, filePath), file.contents);
                }
                else {
                    // Copy file contents
                    await promises_1.default.copyFile(file.inputPath, node_path_1.default.join(fullOutputPath, filePath), promises_1.default.constants.COPYFILE_FICLONE);
                }
            });
        }
        yield result;
    }
}
function normalizeOptions(options) {
    const { main: browser, outputPath, ngswConfigPath, serviceWorker, polyfills, ...otherOptions } = options;
    return {
        browser,
        serviceWorker: serviceWorker ? ngswConfigPath : false,
        polyfills: typeof polyfills === 'string' ? [polyfills] : polyfills,
        outputPath: {
            base: outputPath,
            browser: '',
        },
        ...otherOptions,
    };
}
async function* buildEsbuildBrowserArchitect(options, context) {
    for await (const result of buildEsbuildBrowser(options, context)) {
        yield { success: result.kind !== private_1.ResultKind.Failure };
    }
}
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowserArchitect);
