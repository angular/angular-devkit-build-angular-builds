"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApplication = exports.buildApplicationInternal = void 0;
const architect_1 = require("@angular-devkit/architect");
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const build_action_1 = require("./build-action");
const execute_build_1 = require("./execute-build");
const options_1 = require("./options");
async function* buildApplicationInternal(options, 
// TODO: Integrate abort signal support into builder system
context, infrastructureSettings, plugins) {
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'application' builder requires a target to be specified.`);
        return;
    }
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, options, plugins);
    yield* (0, build_action_1.runEsBuildBuildAction)(async (rebuildState) => {
        const startTime = process.hrtime.bigint();
        const result = await (0, execute_build_1.executeBuild)(normalizedOptions, context, rebuildState);
        const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
        const status = result.errors.length > 0 ? 'failed' : 'complete';
        context.logger.info(`Application bundle generation ${status}. [${buildTime.toFixed(3)} seconds]`);
        return result;
    }, {
        watch: normalizedOptions.watch,
        preserveSymlinks: normalizedOptions.preserveSymlinks,
        poll: normalizedOptions.poll,
        deleteOutputPath: normalizedOptions.deleteOutputPath,
        cacheOptions: normalizedOptions.cacheOptions,
        outputPath: normalizedOptions.outputPath,
        verbose: normalizedOptions.verbose,
        projectRoot: normalizedOptions.projectRoot,
        workspaceRoot: normalizedOptions.workspaceRoot,
        progress: normalizedOptions.progress,
        writeToFileSystem: infrastructureSettings?.write,
        // For app-shell and SSG server files are not required by users.
        // Omit these when SSR is not enabled.
        writeToFileSystemFilter: normalizedOptions.ssrOptions && normalizedOptions.serverEntryPoint
            ? undefined
            : (file) => file.type !== bundler_context_1.BuildOutputFileType.Server,
        logger: context.logger,
        signal: context.signal,
    });
}
exports.buildApplicationInternal = buildApplicationInternal;
/**
 * Builds an application using the `application` builder with the provided
 * options.
 *
 * Usage of the `plugins` parameter is NOT supported and may cause unexpected
 * build output or build failures.
 *
 * @experimental Direct usage of this function is considered experimental.
 *
 * @param options The options defined by the builder's schema to use.
 * @param context An Architect builder context instance.
 * @param plugins An array of plugins to apply to the main code bundling.
 * @returns The build output results of the build.
 */
function buildApplication(options, context, plugins) {
    return buildApplicationInternal(options, context, undefined, plugins);
}
exports.buildApplication = buildApplication;
exports.default = (0, architect_1.createBuilder)(buildApplication);
