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
    var _a;
    const projectName = context.target && context.target.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(workspaceRoot, (_a = projectMetadata.root) !== null && _a !== void 0 ? _a : '');
    const sourceRoot = projectMetadata.sourceRoot;
    const projectSourceRoot = sourceRoot ? path.join(workspaceRoot, sourceRoot) : undefined;
    const normalizedOptions = (0, utils_1.normalizeBrowserSchema)(workspaceRoot, projectRoot, projectSourceRoot, options, projectMetadata);
    const config = await generateWebpackConfig(workspaceRoot, projectRoot, projectSourceRoot, projectName, normalizedOptions, webpackPartialGenerator, context.logger, extraBuildOptions);
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
        projectRoot,
        projectSourceRoot,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1icm93c2VyLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlILDJDQUE2QjtBQUM3QiwyQ0FBMEM7QUFDMUMscUNBQW9EO0FBQ3BELGlEQUFzRDtBQUV0RCxvQ0FBbUc7QUFFbkcsMERBQXNEO0FBQ3RELGtGQUFvRztBQUNwRyxpREFBaUU7QUFRMUQsS0FBSyxVQUFVLHFCQUFxQixDQUN6QyxhQUFxQixFQUNyQixXQUFtQixFQUNuQixVQUE4QixFQUM5QixXQUFtQixFQUNuQixPQUF1QyxFQUN2Qyx1QkFBZ0QsRUFDaEQsTUFBeUIsRUFDekIsaUJBQTBEO0lBRTFELGdEQUFnRDtJQUNoRCxJQUFJLE9BQU8sQ0FBQyxjQUFjLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQzFDLE1BQU0sSUFBSSxLQUFLLENBQUMsMkRBQTJELENBQUMsQ0FBQztLQUM5RTtJQUVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuRSxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUEsNEJBQVksRUFBQyxZQUFZLENBQUMsQ0FBQztJQUVsRCxNQUFNLEVBQUUsR0FBRyx3REFBYSxZQUFZLEdBQUMsQ0FBQztJQUN0QyxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQztJQUVwRSxNQUFNLFlBQVksR0FBbUMsRUFBRSxHQUFHLE9BQU8sRUFBRSxHQUFHLGlCQUFpQixFQUFFLENBQUM7SUFD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SyxDQUFDO0tBQ3BCO0FBQ0gsQ0FBQztBQU5ELDhDQU1DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgamF2YXNjcmlwdCB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgbWVyZ2UgYXMgd2VicGFja01lcmdlIH0gZnJvbSAnd2VicGFjay1tZXJnZSc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsIGRlZmF1bHRQcm9ncmVzcywgbm9ybWFsaXplQnJvd3NlclNjaGVtYSB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi91dGlscy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IEJ1aWxkZXJXYXRjaFBsdWdpbiwgQnVpbGRlcldhdGNoZXJGYWN0b3J5IH0gZnJvbSAnLi4vd2VicGFjay9wbHVnaW5zL2J1aWxkZXItd2F0Y2gtcGx1Z2luJztcbmltcG9ydCB7IEkxOG5PcHRpb25zLCBjb25maWd1cmVJMThuQnVpbGQgfSBmcm9tICcuL2kxOG4tb3B0aW9ucyc7XG5cbmV4cG9ydCB0eXBlIEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyA9IFdlYnBhY2tDb25maWdPcHRpb25zPE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYT47XG5cbmV4cG9ydCB0eXBlIFdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yID0gKFxuICBjb25maWd1cmF0aW9uT3B0aW9uczogQnJvd3NlcldlYnBhY2tDb25maWdPcHRpb25zLFxuKSA9PiAoUHJvbWlzZTxDb25maWd1cmF0aW9uPiB8IENvbmZpZ3VyYXRpb24pW107XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVdlYnBhY2tDb25maWcoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFJvb3Q6IHN0cmluZyxcbiAgc291cmNlUm9vdDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIHdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yOiBXZWJwYWNrUGFydGlhbEdlbmVyYXRvcixcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbiAgZXh0cmFCdWlsZE9wdGlvbnM6IFBhcnRpYWw8Tm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hPixcbik6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICAvLyBFbnN1cmUgQnVpbGQgT3B0aW1pemVyIGlzIG9ubHkgdXNlZCB3aXRoIEFPVC5cbiAgaWYgKG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgJiYgIW9wdGlvbnMuYW90KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJ2J1aWxkT3B0aW1pemVyJyBvcHRpb24gY2Fubm90IGJlIHVzZWQgd2l0aG91dCAnYW90Jy5gKTtcbiAgfVxuXG4gIGNvbnN0IHRzQ29uZmlnUGF0aCA9IHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCBvcHRpb25zLnRzQ29uZmlnKTtcbiAgY29uc3QgdHNDb25maWcgPSBhd2FpdCByZWFkVHNjb25maWcodHNDb25maWdQYXRoKTtcblxuICBjb25zdCB0cyA9IGF3YWl0IGltcG9ydCgndHlwZXNjcmlwdCcpO1xuICBjb25zdCBzY3JpcHRUYXJnZXQgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCB8fCB0cy5TY3JpcHRUYXJnZXQuRVM1O1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hID0geyAuLi5vcHRpb25zLCAuLi5leHRyYUJ1aWxkT3B0aW9ucyB9O1xuICBjb25zdCB3Y286IEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyA9IHtcbiAgICByb290OiB3b3Jrc3BhY2VSb290LFxuICAgIGxvZ2dlcjogbG9nZ2VyLmNyZWF0ZUNoaWxkKCd3ZWJwYWNrQ29uZmlnT3B0aW9ucycpLFxuICAgIHByb2plY3RSb290LFxuICAgIHNvdXJjZVJvb3QsXG4gICAgYnVpbGRPcHRpb25zLFxuICAgIHRzQ29uZmlnLFxuICAgIHRzQ29uZmlnUGF0aCxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBzY3JpcHRUYXJnZXQsXG4gIH07XG5cbiAgd2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyA9IGRlZmF1bHRQcm9ncmVzcyh3Y28uYnVpbGRPcHRpb25zLnByb2dyZXNzKTtcblxuICBjb25zdCBwYXJ0aWFscyA9IGF3YWl0IFByb21pc2UuYWxsKHdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yKHdjbykpO1xuICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gd2VicGFja01lcmdlKHBhcnRpYWxzKTtcblxuICByZXR1cm4gd2VicGFja0NvbmZpZztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja1BhcnRpYWxHZW5lcmF0b3I6IFdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yLFxuICBleHRyYUJ1aWxkT3B0aW9uczogUGFydGlhbDxOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWE+ID0ge30sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiBDb25maWd1cmF0aW9uO1xuICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICBwcm9qZWN0U291cmNlUm9vdD86IHN0cmluZztcbiAgaTE4bjogSTE4bk9wdGlvbnM7XG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0O1xufT4ge1xuICBjb25zdCB7IGJ1aWxkT3B0aW9ucywgaTE4biB9ID0gYXdhaXQgY29uZmlndXJlSTE4bkJ1aWxkKGNvbnRleHQsIG9wdGlvbnMpO1xuICBsZXQgdGFyZ2V0ID0gU2NyaXB0VGFyZ2V0LkVTNTtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIGJ1aWxkT3B0aW9ucyxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IHtcbiAgICAgIHRhcmdldCA9IHdjby5zY3JpcHRUYXJnZXQ7XG5cbiAgICAgIHJldHVybiB3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcih3Y28pO1xuICAgIH0sXG4gICAgZXh0cmFCdWlsZE9wdGlvbnMsXG4gICk7XG4gIGNvbnN0IGNvbmZpZyA9IHJlc3VsdC5jb25maWc7XG5cbiAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gUmVtb3ZlIGxvY2FsaXplIFwicG9seWZpbGxcIiBpZiBpbiBBT1QgbW9kZVxuICAgIGlmIChidWlsZE9wdGlvbnMuYW90KSB7XG4gICAgICBpZiAoIWNvbmZpZy5yZXNvbHZlKSB7XG4gICAgICAgIGNvbmZpZy5yZXNvbHZlID0ge307XG4gICAgICB9XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShjb25maWcucmVzb2x2ZS5hbGlhcykpIHtcbiAgICAgICAgY29uZmlnLnJlc29sdmUuYWxpYXMucHVzaCh7XG4gICAgICAgICAgbmFtZTogJ0Bhbmd1bGFyL2xvY2FsaXplL2luaXQnLFxuICAgICAgICAgIGFsaWFzOiBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWNvbmZpZy5yZXNvbHZlLmFsaWFzKSB7XG4gICAgICAgICAgY29uZmlnLnJlc29sdmUuYWxpYXMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBjb25maWcucmVzb2x2ZS5hbGlhc1snQGFuZ3VsYXIvbG9jYWxpemUvaW5pdCddID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGZpbGUgaGFzaGVzIHRvIGluY2x1ZGUgdHJhbnNsYXRpb24gZmlsZSBjb250ZW50XG4gICAgY29uc3QgaTE4bkhhc2ggPSBPYmplY3QudmFsdWVzKGkxOG4ubG9jYWxlcykucmVkdWNlKFxuICAgICAgKGRhdGEsIGxvY2FsZSkgPT4gZGF0YSArIGxvY2FsZS5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5IHx8ICcnKS5qb2luKCd8JyksXG4gICAgICAnJyxcbiAgICApO1xuXG4gICAgY29uZmlnLnBsdWdpbnMgPz89IFtdO1xuICAgIGNvbmZpZy5wbHVnaW5zLnB1c2goe1xuICAgICAgYXBwbHkoY29tcGlsZXIpIHtcbiAgICAgICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKCdidWlsZC1hbmd1bGFyJywgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICAgICAgamF2YXNjcmlwdC5KYXZhc2NyaXB0TW9kdWxlc1BsdWdpbi5nZXRDb21waWxhdGlvbkhvb2tzKGNvbXBpbGF0aW9uKS5jaHVua0hhc2gudGFwKFxuICAgICAgICAgICAgJ2J1aWxkLWFuZ3VsYXInLFxuICAgICAgICAgICAgKF8sIGhhc2gpID0+IHtcbiAgICAgICAgICAgICAgaGFzaC51cGRhdGUoJyRsb2NhbGl6ZScgKyBpMThuSGFzaCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7IC4uLnJlc3VsdCwgaTE4biwgdGFyZ2V0IH07XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tQYXJ0aWFsR2VuZXJhdG9yOiBXZWJwYWNrUGFydGlhbEdlbmVyYXRvcixcbiAgZXh0cmFCdWlsZE9wdGlvbnM6IFBhcnRpYWw8Tm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hPiA9IHt9LFxuKTogUHJvbWlzZTx7IGNvbmZpZzogQ29uZmlndXJhdGlvbjsgcHJvamVjdFJvb3Q6IHN0cmluZzsgcHJvamVjdFNvdXJjZVJvb3Q/OiBzdHJpbmcgfT4ge1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0ICYmIGNvbnRleHQudGFyZ2V0LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3Qgd29ya3NwYWNlUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyk7XG4gIGNvbnN0IHNvdXJjZVJvb3QgPSBwcm9qZWN0TWV0YWRhdGEuc291cmNlUm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHByb2plY3RTb3VyY2VSb290ID0gc291cmNlUm9vdCA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBzb3VyY2VSb290KSA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IG5vcm1hbGl6ZUJyb3dzZXJTY2hlbWEoXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICBvcHRpb25zLFxuICAgIHByb2plY3RNZXRhZGF0YSxcbiAgKTtcblxuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZW5lcmF0ZVdlYnBhY2tDb25maWcoXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBub3JtYWxpemVkT3B0aW9ucyxcbiAgICB3ZWJwYWNrUGFydGlhbEdlbmVyYXRvcixcbiAgICBjb250ZXh0LmxvZ2dlcixcbiAgICBleHRyYUJ1aWxkT3B0aW9ucyxcbiAgKTtcblxuICAvLyBJZiBidWlsZGVyIHdhdGNoIHN1cHBvcnQgaXMgcHJlc2VudCBpbiB0aGUgY29udGV4dCwgYWRkIHdhdGNoIHBsdWdpblxuICAvLyBUaGlzIGlzIGludGVybmFsIG9ubHkgYW5kIGN1cnJlbnRseSBvbmx5IHVzZWQgZm9yIHRlc3RpbmdcbiAgY29uc3Qgd2F0Y2hlckZhY3RvcnkgPSAoXG4gICAgY29udGV4dCBhcyB7XG4gICAgICB3YXRjaGVyRmFjdG9yeT86IEJ1aWxkZXJXYXRjaGVyRmFjdG9yeTtcbiAgICB9XG4gICkud2F0Y2hlckZhY3Rvcnk7XG4gIGlmICh3YXRjaGVyRmFjdG9yeSkge1xuICAgIGlmICghY29uZmlnLnBsdWdpbnMpIHtcbiAgICAgIGNvbmZpZy5wbHVnaW5zID0gW107XG4gICAgfVxuICAgIGNvbmZpZy5wbHVnaW5zLnB1c2gobmV3IEJ1aWxkZXJXYXRjaFBsdWdpbih3YXRjaGVyRmFjdG9yeSkpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjb25maWcsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgcHJvamVjdFNvdXJjZVJvb3QsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleE91dHB1dEZpbGUoaW5kZXg6IEJyb3dzZXJCdWlsZGVyU2NoZW1hWydpbmRleCddKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBpbmRleCA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gcGF0aC5iYXNlbmFtZShpbmRleCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGluZGV4Lm91dHB1dCB8fCAnaW5kZXguaHRtbCc7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4SW5wdXRGaWxlKGluZGV4OiBCcm93c2VyQnVpbGRlclNjaGVtYVsnaW5kZXgnXSk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgaW5kZXggPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGluZGV4O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBpbmRleC5pbnB1dDtcbiAgfVxufVxuIl19