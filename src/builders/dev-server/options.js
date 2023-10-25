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
exports.normalizeOptions = void 0;
const architect_1 = require("@angular-devkit/architect");
const node_path_1 = __importDefault(require("node:path"));
const normalize_cache_1 = require("../../utils/normalize-cache");
/**
 * Normalize the user provided options by creating full paths for all path based options
 * and converting multi-form options into a single form that can be directly used
 * by the build process.
 *
 * @param context The context for current builder execution.
 * @param projectName The name of the project for the current execution.
 * @param options An object containing the options to use for the build.
 * @returns An object containing normalized options required to perform the build.
 */
async function normalizeOptions(context, projectName, options) {
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = node_path_1.default.join(workspaceRoot, projectMetadata.root ?? '');
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buildTarget = (0, architect_1.targetFromTargetString)(options.buildTarget ?? options.browserTarget);
    // Initial options to keep
    const { host, port, poll, open, verbose, watch, allowedHosts, disableHostCheck, liveReload, hmr, headers, proxyConfig, servePath, publicHost, ssl, sslCert, sslKey, forceEsbuild, } = options;
    // Return all the normalized options
    return {
        buildTarget,
        host: host ?? 'localhost',
        port: port ?? 4200,
        poll,
        open,
        verbose,
        watch,
        liveReload,
        hmr,
        headers,
        workspaceRoot,
        projectRoot,
        cacheOptions,
        allowedHosts,
        disableHostCheck,
        proxyConfig,
        servePath,
        publicHost,
        ssl,
        sslCert,
        sslKey,
        forceEsbuild,
    };
}
exports.normalizeOptions = normalizeOptions;
