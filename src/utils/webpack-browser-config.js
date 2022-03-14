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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1icm93c2VyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUF3RjtBQUN4RiwyQ0FBNkI7QUFDN0IsMkNBQTBDO0FBQzFDLHFDQUFvRDtBQUNwRCxpREFBc0Q7QUFFdEQsb0NBQW1HO0FBRW5HLDBEQUFzRDtBQUN0RCxrRkFBb0c7QUFDcEcsaURBQWlFO0FBUTFELEtBQUssVUFBVSxxQkFBcUIsQ0FDekMsYUFBcUIsRUFDckIsV0FBbUIsRUFDbkIsVUFBOEIsRUFDOUIsV0FBbUIsRUFDbkIsT0FBdUMsRUFDdkMsdUJBQWdELEVBQ2hELE1BQXlCLEVBQ3pCLGlCQUEwRDtJQUUxRCxnREFBZ0Q7SUFDaEQsSUFBSSxPQUFPLENBQUMsY0FBYyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtRQUMxQyxNQUFNLElBQUksS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7S0FDOUU7SUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkUsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFBLDRCQUFZLEVBQUMsWUFBWSxDQUFDLENBQUM7SUFFbEQsTUFBTSxFQUFFLEdBQUcsd0RBQWEsWUFBWSxHQUFDLENBQUM7SUFDdEMsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUM7SUFFcEUsTUFBTSxZQUFZLEdBQW1DLEVBQUUsR0FBRyxPQUFPLEVBQUUsR0FBRyxpQkFBaUIs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QUFDLENBQUM7S0FDN0I7U0FBTTtRQUNMLE9BQU8sS0FBSyxDQUFDLE1BQU0sSUFBSSxZQUFZLENBQUM7S0FDckM7QUFDSCxDQUFDO0FBTkQsZ0RBTUM7QUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxLQUFvQztJQUNwRSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtRQUM3QixPQUFPLEtBQUssQ0FBQztLQUNkO1NBQU07UUFDTCxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUM7S0FDcEI7QUFDSCxDQUFDO0FBTkQsOENBTUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGdldFN5c3RlbVBhdGgsIGpzb24sIGxvZ2dpbmcsIG5vcm1hbGl6ZSwgcmVzb2x2ZSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24sIGphdmFzY3JpcHQgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IG1lcmdlIGFzIHdlYnBhY2tNZXJnZSB9IGZyb20gJ3dlYnBhY2stbWVyZ2UnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBkZWZhdWx0UHJvZ3Jlc3MsIG5vcm1hbGl6ZUJyb3dzZXJTY2hlbWEgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgcmVhZFRzY29uZmlnIH0gZnJvbSAnLi4vdXRpbHMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyBCdWlsZGVyV2F0Y2hQbHVnaW4sIEJ1aWxkZXJXYXRjaGVyRmFjdG9yeSB9IGZyb20gJy4uL3dlYnBhY2svcGx1Z2lucy9idWlsZGVyLXdhdGNoLXBsdWdpbic7XG5pbXBvcnQgeyBJMThuT3B0aW9ucywgY29uZmlndXJlSTE4bkJ1aWxkIH0gZnJvbSAnLi9pMThuLW9wdGlvbnMnO1xuXG5leHBvcnQgdHlwZSBCcm93c2VyV2VicGFja0NvbmZpZ09wdGlvbnMgPSBXZWJwYWNrQ29uZmlnT3B0aW9uczxOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWE+O1xuXG5leHBvcnQgdHlwZSBXZWJwYWNrUGFydGlhbEdlbmVyYXRvciA9IChcbiAgY29uZmlndXJhdGlvbk9wdGlvbnM6IEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbikgPT4gKFByb21pc2U8Q29uZmlndXJhdGlvbj4gfCBDb25maWd1cmF0aW9uKVtdO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVXZWJwYWNrQ29uZmlnKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RSb290OiBzdHJpbmcsXG4gIHNvdXJjZVJvb3Q6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICB3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcjogV2VicGFja1BhcnRpYWxHZW5lcmF0b3IsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4gIGV4dHJhQnVpbGRPcHRpb25zOiBQYXJ0aWFsPE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYT4sXG4pOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgLy8gRW5zdXJlIEJ1aWxkIE9wdGltaXplciBpcyBvbmx5IHVzZWQgd2l0aCBBT1QuXG4gIGlmIChvcHRpb25zLmJ1aWxkT3B0aW1pemVyICYmICFvcHRpb25zLmFvdCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlICdidWlsZE9wdGltaXplcicgb3B0aW9uIGNhbm5vdCBiZSB1c2VkIHdpdGhvdXQgJ2FvdCcuYCk7XG4gIH1cblxuICBjb25zdCB0c0NvbmZpZ1BhdGggPSBwYXRoLnJlc29sdmUod29ya3NwYWNlUm9vdCwgb3B0aW9ucy50c0NvbmZpZyk7XG4gIGNvbnN0IHRzQ29uZmlnID0gYXdhaXQgcmVhZFRzY29uZmlnKHRzQ29uZmlnUGF0aCk7XG5cbiAgY29uc3QgdHMgPSBhd2FpdCBpbXBvcnQoJ3R5cGVzY3JpcHQnKTtcbiAgY29uc3Qgc2NyaXB0VGFyZ2V0ID0gdHNDb25maWcub3B0aW9ucy50YXJnZXQgfHwgdHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICBjb25zdCBidWlsZE9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSA9IHsgLi4ub3B0aW9ucywgLi4uZXh0cmFCdWlsZE9wdGlvbnMgfTtcbiAgY29uc3Qgd2NvOiBCcm93c2VyV2VicGFja0NvbmZpZ09wdGlvbnMgPSB7XG4gICAgcm9vdDogd29ya3NwYWNlUm9vdCxcbiAgICBsb2dnZXI6IGxvZ2dlci5jcmVhdGVDaGlsZCgnd2VicGFja0NvbmZpZ09wdGlvbnMnKSxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBzb3VyY2VSb290LFxuICAgIGJ1aWxkT3B0aW9ucyxcbiAgICB0c0NvbmZpZyxcbiAgICB0c0NvbmZpZ1BhdGgsXG4gICAgcHJvamVjdE5hbWUsXG4gICAgc2NyaXB0VGFyZ2V0LFxuICB9O1xuXG4gIHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MgPSBkZWZhdWx0UHJvZ3Jlc3Mod2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyk7XG5cbiAgY29uc3QgcGFydGlhbHMgPSBhd2FpdCBQcm9taXNlLmFsbCh3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcih3Y28pKTtcbiAgY29uc3Qgd2VicGFja0NvbmZpZyA9IHdlYnBhY2tNZXJnZShwYXJ0aWFscyk7XG5cbiAgcmV0dXJuIHdlYnBhY2tDb25maWc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yOiBXZWJwYWNrUGFydGlhbEdlbmVyYXRvcixcbiAgZXh0cmFCdWlsZE9wdGlvbnM6IFBhcnRpYWw8Tm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hPiA9IHt9LFxuKTogUHJvbWlzZTx7XG4gIGNvbmZpZzogQ29uZmlndXJhdGlvbjtcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgcHJvamVjdFNvdXJjZVJvb3Q/OiBzdHJpbmc7XG4gIGkxOG46IEkxOG5PcHRpb25zO1xuICB0YXJnZXQ6IFNjcmlwdFRhcmdldDtcbn0+IHtcbiAgY29uc3QgeyBidWlsZE9wdGlvbnMsIGkxOG4gfSA9IGF3YWl0IGNvbmZpZ3VyZUkxOG5CdWlsZChjb250ZXh0LCBvcHRpb25zKTtcbiAgbGV0IHRhcmdldCA9IFNjcmlwdFRhcmdldC5FUzU7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICBidWlsZE9wdGlvbnMsXG4gICAgY29udGV4dCxcbiAgICAod2NvKSA9PiB7XG4gICAgICB0YXJnZXQgPSB3Y28uc2NyaXB0VGFyZ2V0O1xuXG4gICAgICByZXR1cm4gd2VicGFja1BhcnRpYWxHZW5lcmF0b3Iod2NvKTtcbiAgICB9LFxuICAgIGV4dHJhQnVpbGRPcHRpb25zLFxuICApO1xuICBjb25zdCBjb25maWcgPSByZXN1bHQuY29uZmlnO1xuXG4gIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgIC8vIFJlbW92ZSBsb2NhbGl6ZSBcInBvbHlmaWxsXCIgaWYgaW4gQU9UIG1vZGVcbiAgICBpZiAoYnVpbGRPcHRpb25zLmFvdCkge1xuICAgICAgaWYgKCFjb25maWcucmVzb2x2ZSkge1xuICAgICAgICBjb25maWcucmVzb2x2ZSA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29uZmlnLnJlc29sdmUuYWxpYXMpKSB7XG4gICAgICAgIGNvbmZpZy5yZXNvbHZlLmFsaWFzLnB1c2goe1xuICAgICAgICAgIG5hbWU6ICdAYW5ndWxhci9sb2NhbGl6ZS9pbml0JyxcbiAgICAgICAgICBhbGlhczogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFjb25maWcucmVzb2x2ZS5hbGlhcykge1xuICAgICAgICAgIGNvbmZpZy5yZXNvbHZlLmFsaWFzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgY29uZmlnLnJlc29sdmUuYWxpYXNbJ0Bhbmd1bGFyL2xvY2FsaXplL2luaXQnXSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBmaWxlIGhhc2hlcyB0byBpbmNsdWRlIHRyYW5zbGF0aW9uIGZpbGUgY29udGVudFxuICAgIGNvbnN0IGkxOG5IYXNoID0gT2JqZWN0LnZhbHVlcyhpMThuLmxvY2FsZXMpLnJlZHVjZShcbiAgICAgIChkYXRhLCBsb2NhbGUpID0+IGRhdGEgKyBsb2NhbGUuZmlsZXMubWFwKChmaWxlKSA9PiBmaWxlLmludGVncml0eSB8fCAnJykuam9pbignfCcpLFxuICAgICAgJycsXG4gICAgKTtcblxuICAgIGNvbmZpZy5wbHVnaW5zID8/PSBbXTtcbiAgICBjb25maWcucGx1Z2lucy5wdXNoKHtcbiAgICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcCgnYnVpbGQtYW5ndWxhcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICAgIGphdmFzY3JpcHQuSmF2YXNjcmlwdE1vZHVsZXNQbHVnaW4uZ2V0Q29tcGlsYXRpb25Ib29rcyhjb21waWxhdGlvbikuY2h1bmtIYXNoLnRhcChcbiAgICAgICAgICAgICdidWlsZC1hbmd1bGFyJyxcbiAgICAgICAgICAgIChfLCBoYXNoKSA9PiB7XG4gICAgICAgICAgICAgIGhhc2gudXBkYXRlKCckbG9jYWxpemUnICsgaTE4bkhhc2gpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4geyAuLi5yZXN1bHQsIGkxOG4sIHRhcmdldCB9O1xufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcjogV2VicGFja1BhcnRpYWxHZW5lcmF0b3IsXG4gIGV4dHJhQnVpbGRPcHRpb25zOiBQYXJ0aWFsPE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYT4gPSB7fSxcbik6IFByb21pc2U8eyBjb25maWc6IENvbmZpZ3VyYXRpb247IHByb2plY3RSb290OiBzdHJpbmc7IHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nIH0+IHtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldCAmJiBjb250ZXh0LnRhcmdldC5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBub3JtYWxpemUoY29udGV4dC53b3Jrc3BhY2VSb290KTtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUod29ya3NwYWNlUm9vdCwgbm9ybWFsaXplKChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcpIHx8ICcnKSk7XG4gIGNvbnN0IHByb2plY3RTb3VyY2VSb290ID0gcHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBjb25zdCBzb3VyY2VSb290ID0gcHJvamVjdFNvdXJjZVJvb3RcbiAgICA/IHJlc29sdmUod29ya3NwYWNlUm9vdCwgbm9ybWFsaXplKHByb2plY3RTb3VyY2VSb290KSlcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IG5vcm1hbGl6ZUJyb3dzZXJTY2hlbWEoXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBzb3VyY2VSb290LFxuICAgIG9wdGlvbnMsXG4gICAgcHJvamVjdE1ldGFkYXRhLFxuICApO1xuXG4gIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGdlbmVyYXRlV2VicGFja0NvbmZpZyhcbiAgICBnZXRTeXN0ZW1QYXRoKHdvcmtzcGFjZVJvb3QpLFxuICAgIGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgIHNvdXJjZVJvb3QgJiYgZ2V0U3lzdGVtUGF0aChzb3VyY2VSb290KSxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBub3JtYWxpemVkT3B0aW9ucyxcbiAgICB3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcixcbiAgICBjb250ZXh0LmxvZ2dlcixcbiAgICBleHRyYUJ1aWxkT3B0aW9ucyxcbiAgKTtcblxuICAvLyBJZiBidWlsZGVyIHdhdGNoIHN1cHBvcnQgaXMgcHJlc2VudCBpbiB0aGUgY29udGV4dCwgYWRkIHdhdGNoIHBsdWdpblxuICAvLyBUaGlzIGlzIGludGVybmFsIG9ubHkgYW5kIGN1cnJlbnRseSBvbmx5IHVzZWQgZm9yIHRlc3RpbmdcbiAgY29uc3Qgd2F0Y2hlckZhY3RvcnkgPSAoXG4gICAgY29udGV4dCBhcyB7XG4gICAgICB3YXRjaGVyRmFjdG9yeT86IEJ1aWxkZXJXYXRjaGVyRmFjdG9yeTtcbiAgICB9XG4gICkud2F0Y2hlckZhY3Rvcnk7XG4gIGlmICh3YXRjaGVyRmFjdG9yeSkge1xuICAgIGlmICghY29uZmlnLnBsdWdpbnMpIHtcbiAgICAgIGNvbmZpZy5wbHVnaW5zID0gW107XG4gICAgfVxuICAgIGNvbmZpZy5wbHVnaW5zLnB1c2gobmV3IEJ1aWxkZXJXYXRjaFBsdWdpbih3YXRjaGVyRmFjdG9yeSkpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjb25maWcsXG4gICAgcHJvamVjdFJvb3Q6IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgIHByb2plY3RTb3VyY2VSb290OiBzb3VyY2VSb290ICYmIGdldFN5c3RlbVBhdGgoc291cmNlUm9vdCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleE91dHB1dEZpbGUoaW5kZXg6IEJyb3dzZXJCdWlsZGVyU2NoZW1hWydpbmRleCddKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBpbmRleCA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gcGF0aC5iYXNlbmFtZShpbmRleCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGluZGV4Lm91dHB1dCB8fCAnaW5kZXguaHRtbCc7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4SW5wdXRGaWxlKGluZGV4OiBCcm93c2VyQnVpbGRlclNjaGVtYVsnaW5kZXgnXSk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgaW5kZXggPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGluZGV4O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBpbmRleC5pbnB1dDtcbiAgfVxufVxuIl19