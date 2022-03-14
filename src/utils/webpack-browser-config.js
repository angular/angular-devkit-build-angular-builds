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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIndexInputFile = exports.getIndexOutputFile = exports.generateBrowserWebpackConfigFromContext = exports.generateI18nBrowserWebpackConfigFromContext = exports.generateWebpackConfig = void 0;
const core_1 = require("@angular-devkit/core");
const path = __importStar(require("path"));
const typescript_1 = require("typescript");
const webpack_1 = require("webpack");
const webpack_merge_1 = require("webpack-merge");
const utils_1 = require("../utils");
const read_tsconfig_1 = require("../utils/read-tsconfig");
const builder_watch_plugin_1 = require("../webpack/plugins/builder-watch-plugin");
const i18n_options_1 = require("./i18n-options");
async function generateWebpackConfig(workspaceRoot, projectRoot, sourceRoot, projectName, options, webpackPartialGenerator, logger, extraBuildOptions) {
    // Ensure Build Optimizer is only used with AOT.
    if (options.buildOptimizer && !options.aot) {
        throw new Error(`The 'buildOptimizer' option cannot be used without 'aot'.`);
    }
    const tsConfigPath = path.resolve(workspaceRoot, options.tsConfig);
    const tsConfig = await (0, read_tsconfig_1.readTsconfig)(tsConfigPath);
    const ts = await Promise.resolve().then(() => __importStar(require('typescript')));
    const scriptTarget = tsConfig.options.target || ts.ScriptTarget.ES5;
    const buildOptions = { ...options, ...extraBuildOptions };
    const wco = {
        root: workspaceRoot,
        logger: logger.createChild('webpackConfigOptions'),
        projectRoot,
        sourceRoot,
        buildOptions,
        tsConfig,
        tsConfigPath,
        projectName,
        scriptTarget,
    };
    wco.buildOptions.progress = (0, utils_1.defaultProgress)(wco.buildOptions.progress);
    const partials = await Promise.all(webpackPartialGenerator(wco));
    const webpackConfig = (0, webpack_merge_1.merge)(partials);
    return webpackConfig;
}
exports.generateWebpackConfig = generateWebpackConfig;
async function generateI18nBrowserWebpackConfigFromContext(options, context, webpackPartialGenerator, extraBuildOptions = {}) {
    var _a;
    const { buildOptions, i18n } = await (0, i18n_options_1.configureI18nBuild)(context, options);
    let target = typescript_1.ScriptTarget.ES5;
    const result = await generateBrowserWebpackConfigFromContext(buildOptions, context, (wco) => {
        target = wco.scriptTarget;
        return webpackPartialGenerator(wco);
    }, extraBuildOptions);
    const config = result.config;
    if (i18n.shouldInline) {
        // Remove localize "polyfill" if in AOT mode
        if (buildOptions.aot) {
            if (!config.resolve) {
                config.resolve = {};
            }
            if (Array.isArray(config.resolve.alias)) {
                config.resolve.alias.push({
                    name: '@angular/localize/init',
                    alias: false,
                });
            }
            else {
                if (!config.resolve.alias) {
                    config.resolve.alias = {};
                }
                config.resolve.alias['@angular/localize/init'] = false;
            }
        }
        // Update file hashes to include translation file content
        const i18nHash = Object.values(i18n.locales).reduce((data, locale) => data + locale.files.map((file) => file.integrity || '').join('|'), '');
        (_a = config.plugins) !== null && _a !== void 0 ? _a : (config.plugins = []);
        config.plugins.push({
            apply(compiler) {
                compiler.hooks.compilation.tap('build-angular', (compilation) => {
                    webpack_1.javascript.JavascriptModulesPlugin.getCompilationHooks(compilation).chunkHash.tap('build-angular', (_, hash) => {
                        hash.update('$localize' + i18nHash);
                    });
                });
            },
        });
    }
    return { ...result, i18n, target };
}
exports.generateI18nBrowserWebpackConfigFromContext = generateI18nBrowserWebpackConfigFromContext;
async function generateBrowserWebpackConfigFromContext(options, context, webpackPartialGenerator, extraBuildOptions = {}) {
    const projectName = context.target && context.target.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const workspaceRoot = (0, core_1.normalize)(context.workspaceRoot);
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = (0, core_1.resolve)(workspaceRoot, (0, core_1.normalize)(projectMetadata.root || ''));
    const projectSourceRoot = projectMetadata.sourceRoot;
    const sourceRoot = projectSourceRoot
        ? (0, core_1.resolve)(workspaceRoot, (0, core_1.normalize)(projectSourceRoot))
        : undefined;
    const normalizedOptions = (0, utils_1.normalizeBrowserSchema)(workspaceRoot, projectRoot, sourceRoot, options, projectMetadata);
    const config = await generateWebpackConfig((0, core_1.getSystemPath)(workspaceRoot), (0, core_1.getSystemPath)(projectRoot), sourceRoot && (0, core_1.getSystemPath)(sourceRoot), projectName, normalizedOptions, webpackPartialGenerator, context.logger, extraBuildOptions);
    // If builder watch support is present in the context, add watch plugin
    // This is internal only and currently only used for testing
    const watcherFactory = context.watcherFactory;
    if (watcherFactory) {
        if (!config.plugins) {
            config.plugins = [];
        }
        config.plugins.push(new builder_watch_plugin_1.BuilderWatchPlugin(watcherFactory));
    }
    return {
        config,
        projectRoot: (0, core_1.getSystemPath)(projectRoot),
        projectSourceRoot: sourceRoot && (0, core_1.getSystemPath)(sourceRoot),
    };
}
exports.generateBrowserWebpackConfigFromContext = generateBrowserWebpackConfigFromContext;
function getIndexOutputFile(index) {
    if (typeof index === 'string') {
        return path.basename(index);
    }
    else {
        return index.output || 'index.html';
    }
}
exports.getIndexOutputFile = getIndexOutputFile;
function getIndexInputFile(index) {
    if (typeof index === 'string') {
        return index;
    }
    else {
        return index.input;
    }
}
exports.getIndexInputFile = getIndexInputFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1icm93c2VyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwrQ0FBd0Y7QUFDeEYsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FBb0Q7QUFDcEQsaURBQXNEO0FBRXRELG9DQUFtRztBQUVuRywwREFBc0Q7QUFDdEQsa0ZBQW9HO0FBQ3BHLGlEQUFpRTtBQVExRCxLQUFLLFVBQVUscUJBQXFCLENBQ3pDLGFBQXFCLEVBQ3JCLFdBQW1CLEVBQ25CLFVBQThCLEVBQzlCLFdBQW1CLEVBQ25CLE9BQXVDLEVBQ3ZDLHVCQUFnRCxFQUNoRCxNQUF5QixFQUN6QixpQkFBMEQ7SUFFMUQsZ0RBQWdEO0lBQ2hELElBQUksT0FBTyxDQUFDLGNBQWMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7UUFDMUMsTUFBTSxJQUFJLEtBQUssQ0FBQywyREFBMkQsQ0FBQyxDQUFDO0tBQzlFO0lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ25FLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBQSw0QkFBWSxFQUFDLFlBQVksQ0FBQyxDQUFDO0lBRWxELE1BQU0sRUFBRSxHQUFHLHdEQUFhLFlBQVksR0FBQyxDQUFDO0lBQ3RDLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDO0lBRXBFLE1BQU0sWUFBWSxHQUFtQyxFQUFFLEdBQUcsT0FBTyxFQUFFLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztJQUMxRixNQUFNLEdBQUcsR0FBZ0M7UUFDdkMsSUFBSSxFQUFFLGFBQWE7UUFDbkIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsc0JBQXNCLENBQUM7UUFDbEQsV0FBVztRQUNYLFVBQVU7UUFDVixZQUFZO1FBQ1osUUFBUTtRQUNSLFlBQVk7UUFDWixXQUFXO1FBQ1gsWUFBWTtLQUNiLENBQUM7SUFFRixHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsR0FBRyxJQUFBLHVCQUFlLEVBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV2RSxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNqRSxNQUFNLGFBQWEsR0FBRyxJQUFBLHFCQUFZLEVBQUMsUUFBUSxDQUFDLENBQUM7SUFFN0MsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQXhDRCxzREF3Q0M7QUFFTSxLQUFLLFVBQVUsMkNBQTJDLENBQy9ELE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLHVCQUFnRCxFQUNoRCxvQkFBNkQsRUFBRTs7SUFRL0QsTUFBTSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsR0FBRyxNQUFNLElBQUEsaUNBQWtCLEVBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFFLElBQUksTUFBTSxHQUFHLHlCQUFZLENBQUMsR0FBRyxDQUFDO0lBQzlCLE1BQU0sTUFBTSxHQUFHLE1BQU0sdUNBQXVDLENBQzFELFlBQVksRUFDWixPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVBQUUsRUFBRTtRQUNOLE1BQU0sR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDO1FBRTFCLE9BQU8sdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdEMsQ0FBQyxFQUNELGlCQUFpQixDQUNsQixDQUFDO0lBQ0YsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUU3QixJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDckIsNENBQTRDO1FBQzVDLElBQUksWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUNwQixJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtnQkFDbkIsTUFBTSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7YUFDckI7WUFDRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDdkMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO29CQUN4QixJQUFJLEVBQUUsd0JBQXdCO29CQUM5QixLQUFLLEVBQUUsS0FBSztpQkFDYixDQUFDLENBQUM7YUFDSjtpQkFBTTtnQkFDTCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7b0JBQ3pCLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztpQkFDM0I7Z0JBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUMsR0FBRyxLQUFLLENBQUM7YUFDeEQ7U0FDRjtRQUVELHlEQUF5RDtRQUN6RCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQ2pELENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFDbkYsRUFBRSxDQUNILENBQUM7UUFFRixNQUFBLE1BQU0sQ0FBQyxPQUFPLG9DQUFkLE1BQU0sQ0FBQyxPQUFPLEdBQUssRUFBRSxFQUFDO1FBQ3RCLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ2xCLEtBQUssQ0FBQyxRQUFRO2dCQUNaLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtvQkFDOUQsb0JBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUMvRSxlQUFlLEVBQ2YsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUU7d0JBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLENBQUM7b0JBQ3RDLENBQUMsQ0FDRixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztTQUNGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxFQUFFLEdBQUcsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUNyQyxDQUFDO0FBbkVELGtHQW1FQztBQUNNLEtBQUssVUFBVSx1Q0FBdUMsQ0FDM0QsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsdUJBQWdELEVBQ2hELG9CQUE2RCxFQUFFO0lBRS9ELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFDN0QsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7S0FDbkQ7SUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFBLGdCQUFTLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3ZELE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLElBQUEsY0FBTyxFQUFDLGFBQWEsRUFBRSxJQUFBLGdCQUFTLEVBQUUsZUFBZSxDQUFDLElBQWUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzlGLE1BQU0saUJBQWlCLEdBQUcsZUFBZSxDQUFDLFVBQWdDLENBQUM7SUFDM0UsTUFBTSxVQUFVLEdBQUcsaUJBQWlCO1FBQ2xDLENBQUMsQ0FBQyxJQUFBLGNBQU8sRUFBQyxhQUFhLEVBQUUsSUFBQSxnQkFBUyxFQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDdEQsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUVkLE1BQU0saUJBQWlCLEdBQUcsSUFBQSw4QkFBc0IsRUFDOUMsYUFBYSxFQUNiLFdBQVcsRUFDWCxVQUFVLEVBQ1YsT0FBTyxFQUNQLGVBQWUsQ0FDaEIsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFHLE1BQU0scUJBQXFCLENBQ3hDLElBQUEsb0JBQWEsRUFBQyxhQUFhLENBQUMsRUFDNUIsSUFBQSxvQkFBYSxFQUFDLFdBQVcsQ0FBQyxFQUMxQixVQUFVLElBQUksSUFBQSxvQkFBYSxFQUFDLFVBQVUsQ0FBQyxFQUN2QyxXQUFXLEVBQ1gsaUJBQWlCLEVBQ2pCLHVCQUF1QixFQUN2QixPQUFPLENBQUMsTUFBTSxFQUNkLGlCQUFpQixDQUNsQixDQUFDO0lBRUYsdUVBQXVFO0lBQ3ZFLDREQUE0RDtJQUM1RCxNQUFNLGNBQWMsR0FDbEIsT0FHRCxDQUFDLGNBQWMsQ0FBQztJQUNqQixJQUFJLGNBQWMsRUFBRTtRQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtZQUNuQixNQUFNLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztTQUNyQjtRQUNELE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUkseUNBQWtCLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztLQUM3RDtJQUVELE9BQU87UUFDTCxNQUFNO1FBQ04sV0FBVyxFQUFFLElBQUEsb0JBQWEsRUFBQyxXQUFXLENBQUM7UUFDdkMsaUJBQWlCLEVBQUUsVUFBVSxJQUFJLElBQUEsb0JBQWEsRUFBQyxVQUFVLENBQUM7S0FDM0QsQ0FBQztBQUNKLENBQUM7QUF6REQsMEZBeURDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQUMsS0FBb0M7SUFDckUsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDN0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQzdCO1NBQU07UUFDTCxPQUFPLEtBQUssQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDO0tBQ3JDO0FBQ0gsQ0FBQztBQU5ELGdEQU1DO0FBRUQsU0FBZ0IsaUJBQWlCLENBQUMsS0FBb0M7SUFDcEUsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDN0IsT0FBTyxLQUFLLENBQUM7S0FDZDtTQUFNO1FBQ0wsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDO0tBQ3BCO0FBQ0gsQ0FBQztBQU5ELDhDQU1DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBnZXRTeXN0ZW1QYXRoLCBqc29uLCBsb2dnaW5nLCBub3JtYWxpemUsIHJlc29sdmUgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBqYXZhc2NyaXB0IH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBtZXJnZSBhcyB3ZWJwYWNrTWVyZ2UgfSBmcm9tICd3ZWJwYWNrLW1lcmdlJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSwgZGVmYXVsdFByb2dyZXNzLCBub3JtYWxpemVCcm93c2VyU2NoZW1hIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL3V0aWxzL3JlYWQtdHNjb25maWcnO1xuaW1wb3J0IHsgQnVpbGRlcldhdGNoUGx1Z2luLCBCdWlsZGVyV2F0Y2hlckZhY3RvcnkgfSBmcm9tICcuLi93ZWJwYWNrL3BsdWdpbnMvYnVpbGRlci13YXRjaC1wbHVnaW4nO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGNvbmZpZ3VyZUkxOG5CdWlsZCB9IGZyb20gJy4vaTE4bi1vcHRpb25zJztcblxuZXhwb3J0IHR5cGUgQnJvd3NlcldlYnBhY2tDb25maWdPcHRpb25zID0gV2VicGFja0NvbmZpZ09wdGlvbnM8Tm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hPjtcblxuZXhwb3J0IHR5cGUgV2VicGFja1BhcnRpYWxHZW5lcmF0b3IgPSAoXG4gIGNvbmZpZ3VyYXRpb25PcHRpb25zOiBCcm93c2VyV2VicGFja0NvbmZpZ09wdGlvbnMsXG4pID0+IChQcm9taXNlPENvbmZpZ3VyYXRpb24+IHwgQ29uZmlndXJhdGlvbilbXTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlV2VicGFja0NvbmZpZyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0Um9vdDogc3RyaW5nLFxuICBzb3VyY2VSb290OiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgd2VicGFja1BhcnRpYWxHZW5lcmF0b3I6IFdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuICBleHRyYUJ1aWxkT3B0aW9uczogUGFydGlhbDxOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWE+LFxuKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIC8vIEVuc3VyZSBCdWlsZCBPcHRpbWl6ZXIgaXMgb25seSB1c2VkIHdpdGggQU9ULlxuICBpZiAob3B0aW9ucy5idWlsZE9wdGltaXplciAmJiAhb3B0aW9ucy5hb3QpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAnYnVpbGRPcHRpbWl6ZXInIG9wdGlvbiBjYW5ub3QgYmUgdXNlZCB3aXRob3V0ICdhb3QnLmApO1xuICB9XG5cbiAgY29uc3QgdHNDb25maWdQYXRoID0gcGF0aC5yZXNvbHZlKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMudHNDb25maWcpO1xuICBjb25zdCB0c0NvbmZpZyA9IGF3YWl0IHJlYWRUc2NvbmZpZyh0c0NvbmZpZ1BhdGgpO1xuXG4gIGNvbnN0IHRzID0gYXdhaXQgaW1wb3J0KCd0eXBlc2NyaXB0Jyk7XG4gIGNvbnN0IHNjcmlwdFRhcmdldCA9IHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0IHx8IHRzLlNjcmlwdFRhcmdldC5FUzU7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEgPSB7IC4uLm9wdGlvbnMsIC4uLmV4dHJhQnVpbGRPcHRpb25zIH07XG4gIGNvbnN0IHdjbzogQnJvd3NlcldlYnBhY2tDb25maWdPcHRpb25zID0ge1xuICAgIHJvb3Q6IHdvcmtzcGFjZVJvb3QsXG4gICAgbG9nZ2VyOiBsb2dnZXIuY3JlYXRlQ2hpbGQoJ3dlYnBhY2tDb25maWdPcHRpb25zJyksXG4gICAgcHJvamVjdFJvb3QsXG4gICAgc291cmNlUm9vdCxcbiAgICBidWlsZE9wdGlvbnMsXG4gICAgdHNDb25maWcsXG4gICAgdHNDb25maWdQYXRoLFxuICAgIHByb2plY3ROYW1lLFxuICAgIHNjcmlwdFRhcmdldCxcbiAgfTtcblxuICB3Y28uYnVpbGRPcHRpb25zLnByb2dyZXNzID0gZGVmYXVsdFByb2dyZXNzKHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MpO1xuXG4gIGNvbnN0IHBhcnRpYWxzID0gYXdhaXQgUHJvbWlzZS5hbGwod2VicGFja1BhcnRpYWxHZW5lcmF0b3Iod2NvKSk7XG4gIGNvbnN0IHdlYnBhY2tDb25maWcgPSB3ZWJwYWNrTWVyZ2UocGFydGlhbHMpO1xuXG4gIHJldHVybiB3ZWJwYWNrQ29uZmlnO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcjogV2VicGFja1BhcnRpYWxHZW5lcmF0b3IsXG4gIGV4dHJhQnVpbGRPcHRpb25zOiBQYXJ0aWFsPE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYT4gPSB7fSxcbik6IFByb21pc2U8e1xuICBjb25maWc6IENvbmZpZ3VyYXRpb247XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQ7XG59PiB7XG4gIGNvbnN0IHsgYnVpbGRPcHRpb25zLCBpMThuIH0gPSBhd2FpdCBjb25maWd1cmVJMThuQnVpbGQoY29udGV4dCwgb3B0aW9ucyk7XG4gIGxldCB0YXJnZXQgPSBTY3JpcHRUYXJnZXQuRVM1O1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgYnVpbGRPcHRpb25zLFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4ge1xuICAgICAgdGFyZ2V0ID0gd2NvLnNjcmlwdFRhcmdldDtcblxuICAgICAgcmV0dXJuIHdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yKHdjbyk7XG4gICAgfSxcbiAgICBleHRyYUJ1aWxkT3B0aW9ucyxcbiAgKTtcbiAgY29uc3QgY29uZmlnID0gcmVzdWx0LmNvbmZpZztcblxuICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAvLyBSZW1vdmUgbG9jYWxpemUgXCJwb2x5ZmlsbFwiIGlmIGluIEFPVCBtb2RlXG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5hb3QpIHtcbiAgICAgIGlmICghY29uZmlnLnJlc29sdmUpIHtcbiAgICAgICAgY29uZmlnLnJlc29sdmUgPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvbmZpZy5yZXNvbHZlLmFsaWFzKSkge1xuICAgICAgICBjb25maWcucmVzb2x2ZS5hbGlhcy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiAnQGFuZ3VsYXIvbG9jYWxpemUvaW5pdCcsXG4gICAgICAgICAgYWxpYXM6IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghY29uZmlnLnJlc29sdmUuYWxpYXMpIHtcbiAgICAgICAgICBjb25maWcucmVzb2x2ZS5hbGlhcyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGNvbmZpZy5yZXNvbHZlLmFsaWFzWydAYW5ndWxhci9sb2NhbGl6ZS9pbml0J10gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgZmlsZSBoYXNoZXMgdG8gaW5jbHVkZSB0cmFuc2xhdGlvbiBmaWxlIGNvbnRlbnRcbiAgICBjb25zdCBpMThuSGFzaCA9IE9iamVjdC52YWx1ZXMoaTE4bi5sb2NhbGVzKS5yZWR1Y2UoXG4gICAgICAoZGF0YSwgbG9jYWxlKSA9PiBkYXRhICsgbG9jYWxlLmZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5pbnRlZ3JpdHkgfHwgJycpLmpvaW4oJ3wnKSxcbiAgICAgICcnLFxuICAgICk7XG5cbiAgICBjb25maWcucGx1Z2lucyA/Pz0gW107XG4gICAgY29uZmlnLnBsdWdpbnMucHVzaCh7XG4gICAgICBhcHBseShjb21waWxlcikge1xuICAgICAgICBjb21waWxlci5ob29rcy5jb21waWxhdGlvbi50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgICAgICBqYXZhc2NyaXB0LkphdmFzY3JpcHRNb2R1bGVzUGx1Z2luLmdldENvbXBpbGF0aW9uSG9va3MoY29tcGlsYXRpb24pLmNodW5rSGFzaC50YXAoXG4gICAgICAgICAgICAnYnVpbGQtYW5ndWxhcicsXG4gICAgICAgICAgICAoXywgaGFzaCkgPT4ge1xuICAgICAgICAgICAgICBoYXNoLnVwZGF0ZSgnJGxvY2FsaXplJyArIGkxOG5IYXNoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBpMThuLCB0YXJnZXQgfTtcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja1BhcnRpYWxHZW5lcmF0b3I6IFdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yLFxuICBleHRyYUJ1aWxkT3B0aW9uczogUGFydGlhbDxOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWE+ID0ge30sXG4pOiBQcm9taXNlPHsgY29uZmlnOiBDb25maWd1cmF0aW9uOyBwcm9qZWN0Um9vdDogc3RyaW5nOyBwcm9qZWN0U291cmNlUm9vdD86IHN0cmluZyB9PiB7XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQgJiYgY29udGV4dC50YXJnZXQucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCB3b3Jrc3BhY2VSb290ID0gbm9ybWFsaXplKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHdvcmtzcGFjZVJvb3QsIG5vcm1hbGl6ZSgocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nKSB8fCAnJykpO1xuICBjb25zdCBwcm9qZWN0U291cmNlUm9vdCA9IHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3Qgc291cmNlUm9vdCA9IHByb2plY3RTb3VyY2VSb290XG4gICAgPyByZXNvbHZlKHdvcmtzcGFjZVJvb3QsIG5vcm1hbGl6ZShwcm9qZWN0U291cmNlUm9vdCkpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3Qgbm9ybWFsaXplZE9wdGlvbnMgPSBub3JtYWxpemVCcm93c2VyU2NoZW1hKFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgc291cmNlUm9vdCxcbiAgICBvcHRpb25zLFxuICAgIHByb2plY3RNZXRhZGF0YSxcbiAgKTtcblxuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZW5lcmF0ZVdlYnBhY2tDb25maWcoXG4gICAgZ2V0U3lzdGVtUGF0aCh3b3Jrc3BhY2VSb290KSxcbiAgICBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICBzb3VyY2VSb290ICYmIGdldFN5c3RlbVBhdGgoc291cmNlUm9vdCksXG4gICAgcHJvamVjdE5hbWUsXG4gICAgbm9ybWFsaXplZE9wdGlvbnMsXG4gICAgd2VicGFja1BhcnRpYWxHZW5lcmF0b3IsXG4gICAgY29udGV4dC5sb2dnZXIsXG4gICAgZXh0cmFCdWlsZE9wdGlvbnMsXG4gICk7XG5cbiAgLy8gSWYgYnVpbGRlciB3YXRjaCBzdXBwb3J0IGlzIHByZXNlbnQgaW4gdGhlIGNvbnRleHQsIGFkZCB3YXRjaCBwbHVnaW5cbiAgLy8gVGhpcyBpcyBpbnRlcm5hbCBvbmx5IGFuZCBjdXJyZW50bHkgb25seSB1c2VkIGZvciB0ZXN0aW5nXG4gIGNvbnN0IHdhdGNoZXJGYWN0b3J5ID0gKFxuICAgIGNvbnRleHQgYXMge1xuICAgICAgd2F0Y2hlckZhY3Rvcnk/OiBCdWlsZGVyV2F0Y2hlckZhY3Rvcnk7XG4gICAgfVxuICApLndhdGNoZXJGYWN0b3J5O1xuICBpZiAod2F0Y2hlckZhY3RvcnkpIHtcbiAgICBpZiAoIWNvbmZpZy5wbHVnaW5zKSB7XG4gICAgICBjb25maWcucGx1Z2lucyA9IFtdO1xuICAgIH1cbiAgICBjb25maWcucGx1Z2lucy5wdXNoKG5ldyBCdWlsZGVyV2F0Y2hQbHVnaW4od2F0Y2hlckZhY3RvcnkpKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29uZmlnLFxuICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICBwcm9qZWN0U291cmNlUm9vdDogc291cmNlUm9vdCAmJiBnZXRTeXN0ZW1QYXRoKHNvdXJjZVJvb3QpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5kZXhPdXRwdXRGaWxlKGluZGV4OiBCcm93c2VyQnVpbGRlclNjaGVtYVsnaW5kZXgnXSk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgaW5kZXggPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHBhdGguYmFzZW5hbWUoaW5kZXgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBpbmRleC5vdXRwdXQgfHwgJ2luZGV4Lmh0bWwnO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleElucHV0RmlsZShpbmRleDogQnJvd3NlckJ1aWxkZXJTY2hlbWFbJ2luZGV4J10pOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIGluZGV4ID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBpbmRleDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gaW5kZXguaW5wdXQ7XG4gIH1cbn1cbiJdfQ==