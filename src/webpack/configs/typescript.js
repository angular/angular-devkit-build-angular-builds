"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTypescriptWorkerPlugin = exports.getAotConfig = exports.getNonAotConfig = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const build_optimizer_1 = require("@angular-devkit/build-optimizer");
const core_1 = require("@angular-devkit/core");
const webpack_1 = require("@ngtools/webpack");
function ensureIvy(wco) {
    if (wco.tsConfig.options.enableIvy !== false) {
        return;
    }
    wco.logger.warn('Project is attempting to disable the Ivy compiler. ' +
        'Angular versions 12 and higher do not support the deprecated View Engine compiler for applications. ' +
        'The Ivy compiler will be used to build this project. ' +
        '\nFor additional information or if the build fails, please see https://angular.io/guide/ivy');
    wco.tsConfig.options.enableIvy = true;
}
function createIvyPlugin(wco, aot, tsconfig) {
    const { buildOptions } = wco;
    const optimize = buildOptions.optimization.scripts;
    const compilerOptions = {
        sourceMap: buildOptions.sourceMap.scripts,
        declaration: false,
        declarationMap: false,
    };
    if (buildOptions.preserveSymlinks !== undefined) {
        compilerOptions.preserveSymlinks = buildOptions.preserveSymlinks;
    }
    const fileReplacements = {};
    if (buildOptions.fileReplacements) {
        for (const replacement of buildOptions.fileReplacements) {
            fileReplacements[core_1.getSystemPath(replacement.replace)] = core_1.getSystemPath(replacement.with);
        }
    }
    return new webpack_1.ivy.AngularWebpackPlugin({
        tsconfig,
        compilerOptions,
        fileReplacements,
        jitMode: !aot,
        emitNgModuleScope: !optimize,
    });
}
function getNonAotConfig(wco) {
    const { tsConfigPath } = wco;
    return {
        module: {
            rules: [
                {
                    test: /\.[jt]sx?$/,
                    loader: webpack_1.ivy.AngularWebpackLoaderPath,
                },
            ],
        },
        plugins: [
            createIvyPlugin(wco, false, tsConfigPath),
        ],
    };
}
exports.getNonAotConfig = getNonAotConfig;
function getAotConfig(wco) {
    const { tsConfigPath, buildOptions } = wco;
    ensureIvy(wco);
    return {
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: [
                        ...(buildOptions.buildOptimizer
                            ? [
                                {
                                    loader: build_optimizer_1.buildOptimizerLoaderPath,
                                    options: { sourceMap: buildOptions.sourceMap.scripts },
                                },
                            ]
                            : []),
                        webpack_1.ivy.AngularWebpackLoaderPath,
                    ],
                },
                // "allowJs" support with ivy plugin - ensures build optimizer is not run twice
                {
                    test: /\.jsx?$/,
                    use: [webpack_1.ivy.AngularWebpackLoaderPath],
                },
            ],
        },
        plugins: [
            createIvyPlugin(wco, true, tsConfigPath),
        ],
    };
}
exports.getAotConfig = getAotConfig;
function getTypescriptWorkerPlugin(wco, workerTsConfigPath) {
    return createIvyPlugin(wco, false, workerTsConfigPath);
}
exports.getTypescriptWorkerPlugin = getTypescriptWorkerPlugin;
