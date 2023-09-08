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
exports.isPlatformServerInstalled = exports.getStatsOptions = exports.assetPatterns = exports.globalScriptsByBundleName = exports.getCacheSettings = exports.normalizeGlobalStyles = exports.getInstrumentationExcludedPaths = exports.assetNameTemplateFactory = exports.normalizeExtraEntryPoints = exports.getOutputHashFormat = void 0;
const crypto_1 = require("crypto");
const fast_glob_1 = __importDefault(require("fast-glob"));
const path = __importStar(require("path"));
const schema_1 = require("../../../builders/browser/schema");
const package_version_1 = require("../../../utils/package-version");
function getOutputHashFormat(outputHashing = schema_1.OutputHashing.None, length = 20) {
    const hashTemplate = `.[contenthash:${length}]`;
    switch (outputHashing) {
        case 'media':
            return {
                chunk: '',
                extract: '',
                file: hashTemplate,
                script: '',
            };
        case 'bundles':
            return {
                chunk: hashTemplate,
                extract: hashTemplate,
                file: '',
                script: hashTemplate,
            };
        case 'all':
            return {
                chunk: hashTemplate,
                extract: hashTemplate,
                file: hashTemplate,
                script: hashTemplate,
            };
        case 'none':
        default:
            return {
                chunk: '',
                extract: '',
                file: '',
                script: '',
            };
    }
}
exports.getOutputHashFormat = getOutputHashFormat;
function normalizeExtraEntryPoints(extraEntryPoints, defaultBundleName) {
    return extraEntryPoints.map((entry) => {
        if (typeof entry === 'string') {
            return { input: entry, inject: true, bundleName: defaultBundleName };
        }
        const { inject = true, ...newEntry } = entry;
        let bundleName;
        if (entry.bundleName) {
            bundleName = entry.bundleName;
        }
        else if (!inject) {
            // Lazy entry points use the file name as bundle name.
            bundleName = path.parse(entry.input).name;
        }
        else {
            bundleName = defaultBundleName;
        }
        return { ...newEntry, inject, bundleName };
    });
}
exports.normalizeExtraEntryPoints = normalizeExtraEntryPoints;
function assetNameTemplateFactory(hashFormat) {
    const visitedFiles = new Map();
    return (resourcePath) => {
        if (hashFormat.file) {
            // File names are hashed therefore we don't need to handle files with the same file name.
            return `[name]${hashFormat.file}.[ext]`;
        }
        const filename = path.basename(resourcePath);
        // Check if the file with the same name has already been processed.
        const visited = visitedFiles.get(filename);
        if (!visited) {
            // Not visited.
            visitedFiles.set(filename, resourcePath);
            return filename;
        }
        else if (visited === resourcePath) {
            // Same file.
            return filename;
        }
        // File has the same name but it's in a different location.
        return '[path][name].[ext]';
    };
}
exports.assetNameTemplateFactory = assetNameTemplateFactory;
function getInstrumentationExcludedPaths(root, excludedPaths) {
    const excluded = new Set();
    for (const excludeGlob of excludedPaths) {
        const excludePath = excludeGlob[0] === '/' ? excludeGlob.slice(1) : excludeGlob;
        fast_glob_1.default.sync(excludePath, { cwd: root }).forEach((p) => excluded.add(path.join(root, p)));
    }
    return excluded;
}
exports.getInstrumentationExcludedPaths = getInstrumentationExcludedPaths;
function normalizeGlobalStyles(styleEntrypoints) {
    const entryPoints = {};
    const noInjectNames = [];
    if (styleEntrypoints.length === 0) {
        return { entryPoints, noInjectNames };
    }
    for (const style of normalizeExtraEntryPoints(styleEntrypoints, 'styles')) {
        // Add style entry points.
        entryPoints[style.bundleName] ??= [];
        entryPoints[style.bundleName].push(style.input);
        // Add non injected styles to the list.
        if (!style.inject) {
            noInjectNames.push(style.bundleName);
        }
    }
    return { entryPoints, noInjectNames };
}
exports.normalizeGlobalStyles = normalizeGlobalStyles;
function getCacheSettings(wco, angularVersion) {
    const { enabled, path: cacheDirectory } = wco.buildOptions.cache;
    if (enabled) {
        return {
            type: 'filesystem',
            profile: wco.buildOptions.verbose,
            cacheDirectory: path.join(cacheDirectory, 'angular-webpack'),
            maxMemoryGenerations: 1,
            // We use the versions and build options as the cache name. The Webpack configurations are too
            // dynamic and shared among different build types: test, build and serve.
            // None of which are "named".
            name: (0, crypto_1.createHash)('sha1')
                .update(angularVersion)
                .update(package_version_1.VERSION)
                .update(wco.projectRoot)
                .update(JSON.stringify(wco.tsConfig))
                .update(JSON.stringify({
                ...wco.buildOptions,
                // Needed because outputPath changes on every build when using i18n extraction
                // https://github.com/angular/angular-cli/blob/736a5f89deaca85f487b78aec9ff66d4118ceb6a/packages/angular_devkit/build_angular/src/utils/i18n-options.ts#L264-L265
                outputPath: undefined,
            }))
                .digest('hex'),
        };
    }
    if (wco.buildOptions.watch) {
        return {
            type: 'memory',
            maxGenerations: 1,
        };
    }
    return false;
}
exports.getCacheSettings = getCacheSettings;
function globalScriptsByBundleName(scripts) {
    return normalizeExtraEntryPoints(scripts, 'scripts').reduce((prev, curr) => {
        const { bundleName, inject, input } = curr;
        const existingEntry = prev.find((el) => el.bundleName === bundleName);
        if (existingEntry) {
            if (existingEntry.inject && !inject) {
                // All entries have to be lazy for the bundle to be lazy.
                throw new Error(`The ${bundleName} bundle is mixing injected and non-injected scripts.`);
            }
            existingEntry.paths.push(input);
        }
        else {
            prev.push({
                bundleName,
                inject,
                paths: [input],
            });
        }
        return prev;
    }, []);
}
exports.globalScriptsByBundleName = globalScriptsByBundleName;
function assetPatterns(root, assets) {
    return assets.map((asset, index) => {
        // Resolve input paths relative to workspace root and add slash at the end.
        // eslint-disable-next-line prefer-const
        let { input, output, ignore = [], glob } = asset;
        input = path.resolve(root, input).replace(/\\/g, '/');
        input = input.endsWith('/') ? input : input + '/';
        output = output.endsWith('/') ? output : output + '/';
        if (output.startsWith('..')) {
            throw new Error('An asset cannot be written to a location outside of the output path.');
        }
        return {
            context: input,
            // Now we remove starting slash to make Webpack place it from the output root.
            to: output.replace(/^\//, ''),
            from: glob,
            noErrorOnMissing: true,
            force: true,
            globOptions: {
                dot: true,
                followSymbolicLinks: !!asset.followSymlinks,
                ignore: [
                    '.gitkeep',
                    '**/.DS_Store',
                    '**/Thumbs.db',
                    // Negate patterns needs to be absolute because copy-webpack-plugin uses absolute globs which
                    // causes negate patterns not to match.
                    // See: https://github.com/webpack-contrib/copy-webpack-plugin/issues/498#issuecomment-639327909
                    ...ignore,
                ].map((i) => path.posix.join(input, i)),
            },
            priority: index,
        };
    });
}
exports.assetPatterns = assetPatterns;
function getStatsOptions(verbose = false) {
    const webpackOutputOptions = {
        all: false,
        colors: true,
        hash: true,
        timings: true,
        chunks: true,
        builtAt: true,
        warnings: true,
        errors: true,
        assets: true,
        cachedAssets: true,
        // Needed for markAsyncChunksNonInitial.
        ids: true,
        entrypoints: true,
    };
    const verboseWebpackOutputOptions = {
        // The verbose output will most likely be piped to a file, so colors just mess it up.
        colors: false,
        usedExports: true,
        optimizationBailout: true,
        reasons: true,
        children: true,
        assets: true,
        version: true,
        chunkModules: true,
        errorDetails: true,
        errorStack: true,
        moduleTrace: true,
        logging: 'verbose',
        modulesSpace: Infinity,
    };
    return verbose
        ? { ...webpackOutputOptions, ...verboseWebpackOutputOptions }
        : webpackOutputOptions;
}
exports.getStatsOptions = getStatsOptions;
/**
 * @param root the workspace root
 * @returns `true` when `@angular/platform-server` is installed.
 */
function isPlatformServerInstalled(root) {
    try {
        require.resolve('@angular/platform-server', { paths: [root] });
        return true;
    }
    catch {
        return false;
    }
}
exports.isPlatformServerInstalled = isPlatformServerInstalled;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywwREFBNkI7QUFDN0IsMkNBQTZCO0FBRTdCLDZEQUswQztBQUUxQyxvRUFBeUQ7QUFXekQsU0FBZ0IsbUJBQW1CLENBQUMsYUFBYSxHQUFHLHNCQUFhLENBQUMsSUFBSSxFQUFFLE1BQU0sR0FBRyxFQUFFO0lBQ2pGLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixNQUFNLEdBQUcsQ0FBQztJQUVoRCxRQUFRLGFBQWEsRUFBRTtRQUNyQixLQUFLLE9BQU87WUFDVixPQUFPO2dCQUNMLEtBQUssRUFBRSxFQUFFO2dCQUNULE9BQU8sRUFBRSxFQUFFO2dCQUNYLElBQUksRUFBRSxZQUFZO2dCQUNsQixNQUFNLEVBQUUsRUFBRTthQUNYLENBQUM7UUFDSixLQUFLLFNBQVM7WUFDWixPQUFPO2dCQUNMLEtBQUssRUFBRSxZQUFZO2dCQUNuQixPQUFPLEVBQUUsWUFBWTtnQkFDckIsSUFBSSxFQUFFLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFLFlBQVk7YUFDckIsQ0FBQztRQUNKLEtBQUssS0FBSztZQUNSLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsTUFBTSxFQUFFLFlBQVk7YUFDckIsQ0FBQztRQUNKLEtBQUssTUFBTSxDQUFDO1FBQ1o7WUFDRSxPQUFPO2dCQUNMLEtBQUssRUFBRSxFQUFFO2dCQUNULE9BQU8sRUFBRSxFQUFFO2dCQUNYLElBQUksRUFBRSxFQUFFO2dCQUNS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LEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO1FBQ2IsWUFBWSxFQUFFLElBQUk7UUFDbEIsWUFBWSxFQUFFLElBQUk7UUFDbEIsVUFBVSxFQUFFLElBQUk7UUFDaEIsV0FBVyxFQUFFLElBQUk7UUFDakIsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLFFBQVE7S0FDdkIsQ0FBQztJQUVGLE9BQU8sT0FBTztRQUNaLENBQUMsQ0FBQyxFQUFFLEdBQUcsb0JBQW9CLEVBQUUsR0FBRywyQkFBMkIsRUFBRTtRQUM3RCxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDM0IsQ0FBQztBQXRDRCwwQ0FzQ0M7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQix5QkFBeUIsQ0FBQyxJQUFZO0lBQ3BELElBQUk7UUFDRixPQUFPLENBQUMsT0FBTyxDQUFDLDBCQUEwQixFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRS9ELE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFBQyxNQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNILENBQUM7QUFSRCw4REFRQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9iamVjdFBhdHRlcm4gfSBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IGdsb2IgZnJvbSAnZmFzdC1nbG9iJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZCB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgQXNzZXRQYXR0ZXJuQ2xhc3MsXG4gIE91dHB1dEhhc2hpbmcsXG4gIFNjcmlwdEVsZW1lbnQsXG4gIFN0eWxlRWxlbWVudCxcbn0gZnJvbSAnLi4vLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tICcuLi8uLi8uLi91dGlscy9wYWNrYWdlLXZlcnNpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhc2hGb3JtYXQge1xuICBjaHVuazogc3RyaW5nO1xuICBleHRyYWN0OiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgc2NyaXB0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFdlYnBhY2tTdGF0c09wdGlvbnMgPSBFeGNsdWRlPENvbmZpZ3VyYXRpb25bJ3N0YXRzJ10sIHN0cmluZyB8IGJvb2xlYW4gfCB1bmRlZmluZWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3V0cHV0SGFzaEZvcm1hdChvdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lLCBsZW5ndGggPSAyMCk6IEhhc2hGb3JtYXQge1xuICBjb25zdCBoYXNoVGVtcGxhdGUgPSBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYDtcblxuICBzd2l0Y2ggKG91dHB1dEhhc2hpbmcpIHtcbiAgICBjYXNlICdtZWRpYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICAgIGNhc2UgJ2J1bmRsZXMnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ2FsbCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ25vbmUnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEVudHJ5UG9pbnQgPSBSZXF1aXJlZDxFeGNsdWRlPFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQsIHN0cmluZz4+O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgZXh0cmFFbnRyeVBvaW50czogKFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQpW10sXG4gIGRlZmF1bHRCdW5kbGVOYW1lOiBzdHJpbmcsXG4pOiBOb3JtYWxpemVkRW50cnlQb2ludFtdIHtcbiAgcmV0dXJuIGV4dHJhRW50cnlQb2ludHMubWFwKChlbnRyeSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBpbnB1dDogZW50cnksIGluamVjdDogdHJ1ZSwgYnVuZGxlTmFtZTogZGVmYXVsdEJ1bmRsZU5hbWUgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGluamVjdCA9IHRydWUsIC4uLm5ld0VudHJ5IH0gPSBlbnRyeTtcbiAgICBsZXQgYnVuZGxlTmFtZTtcbiAgICBpZiAoZW50cnkuYnVuZGxlTmFtZSkge1xuICAgICAgYnVuZGxlTmFtZSA9IGVudHJ5LmJ1bmRsZU5hbWU7XG4gICAgfSBlbHNlIGlmICghaW5qZWN0KSB7XG4gICAgICAvLyBMYXp5IGVudHJ5IHBvaW50cyB1c2UgdGhlIGZpbGUgbmFtZSBhcyBidW5kbGUgbmFtZS5cbiAgICAgIGJ1bmRsZU5hbWUgPSBwYXRoLnBhcnNlKGVudHJ5LmlucHV0KS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICBidW5kbGVOYW1lID0gZGVmYXVsdEJ1bmRsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4ubmV3RW50cnksIGluamVjdCwgYnVuZGxlTmFtZSB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0OiBIYXNoRm9ybWF0KTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmcge1xuICBjb25zdCB2aXNpdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIHJldHVybiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoaGFzaEZvcm1hdC5maWxlKSB7XG4gICAgICAvLyBGaWxlIG5hbWVzIGFyZSBoYXNoZWQgdGhlcmVmb3JlIHdlIGRvbid0IG5lZWQgdG8gaGFuZGxlIGZpbGVzIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lLlxuICAgICAgcmV0dXJuIGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShyZXNvdXJjZVBhdGgpO1xuICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIHdpdGggdGhlIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZC5cbiAgICBjb25zdCB2aXNpdGVkID0gdmlzaXRlZEZpbGVzLmdldChmaWxlbmFtZSk7XG4gICAgaWYgKCF2aXNpdGVkKSB7XG4gICAgICAvLyBOb3QgdmlzaXRlZC5cbiAgICAgIHZpc2l0ZWRGaWxlcy5zZXQoZmlsZW5hbWUsIHJlc291cmNlUGF0aCk7XG5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9IGVsc2UgaWYgKHZpc2l0ZWQgPT09IHJlc291cmNlUGF0aCkge1xuICAgICAgLy8gU2FtZSBmaWxlLlxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH1cblxuICAgIC8vIEZpbGUgaGFzIHRoZSBzYW1lIG5hbWUgYnV0IGl0J3MgaW4gYSBkaWZmZXJlbnQgbG9jYXRpb24uXG4gICAgcmV0dXJuICdbcGF0aF1bbmFtZV0uW2V4dF0nO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhcbiAgcm9vdDogc3RyaW5nLFxuICBleGNsdWRlZFBhdGhzOiBzdHJpbmdbXSxcbik6IFNldDxzdHJpbmc+IHtcbiAgY29uc3QgZXhjbHVkZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IGV4Y2x1ZGVHbG9iIG9mIGV4Y2x1ZGVkUGF0aHMpIHtcbiAgICBjb25zdCBleGNsdWRlUGF0aCA9IGV4Y2x1ZGVHbG9iWzBdID09PSAnLycgPyBleGNsdWRlR2xvYi5zbGljZSgxKSA6IGV4Y2x1ZGVHbG9iO1xuICAgIGdsb2Iuc3luYyhleGNsdWRlUGF0aCwgeyBjd2Q6IHJvb3QgfSkuZm9yRWFjaCgocCkgPT4gZXhjbHVkZWQuYWRkKHBhdGguam9pbihyb290LCBwKSkpO1xuICB9XG5cbiAgcmV0dXJuIGV4Y2x1ZGVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplR2xvYmFsU3R5bGVzKHN0eWxlRW50cnlwb2ludHM6IFN0eWxlRWxlbWVudFtdKToge1xuICBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+O1xuICBub0luamVjdE5hbWVzOiBzdHJpbmdbXTtcbn0ge1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gIGNvbnN0IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKHN0eWxlRW50cnlwb2ludHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMgfTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgc3R5bGUgb2Ygbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzdHlsZUVudHJ5cG9pbnRzLCAnc3R5bGVzJykpIHtcbiAgICAvLyBBZGQgc3R5bGUgZW50cnkgcG9pbnRzLlxuICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID8/PSBbXTtcbiAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXS5wdXNoKHN0eWxlLmlucHV0KTtcblxuICAgIC8vIEFkZCBub24gaW5qZWN0ZWQgc3R5bGVzIHRvIHRoZSBsaXN0LlxuICAgIGlmICghc3R5bGUuaW5qZWN0KSB7XG4gICAgICBub0luamVjdE5hbWVzLnB1c2goc3R5bGUuYnVuZGxlTmFtZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENhY2hlU2V0dGluZ3MoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGFuZ3VsYXJWZXJzaW9uOiBzdHJpbmcsXG4pOiBXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWRbJ2NhY2hlJ10ge1xuICBjb25zdCB7IGVuYWJsZWQsIHBhdGg6IGNhY2hlRGlyZWN0b3J5IH0gPSB3Y28uYnVpbGRPcHRpb25zLmNhY2hlO1xuICBpZiAoZW5hYmxlZCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnZmlsZXN5c3RlbScsXG4gICAgICBwcm9maWxlOiB3Y28uYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICBjYWNoZURpcmVjdG9yeTogcGF0aC5qb2luKGNhY2hlRGlyZWN0b3J5LCAnYW5ndWxhci13ZWJwYWNrJyksXG4gICAgICBtYXhNZW1vcnlHZW5lcmF0aW9uczogMSxcbiAgICAgIC8vIFdlIHVzZSB0aGUgdmVyc2lvbnMgYW5kIGJ1aWxkIG9wdGlvbnMgYXMgdGhlIGNhY2hlIG5hbWUuIFRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb25zIGFyZSB0b29cbiAgICAgIC8vIGR5bmFtaWMgYW5kIHNoYXJlZCBhbW9uZyBkaWZmZXJlbnQgYnVpbGQgdHlwZXM6IHRlc3QsIGJ1aWxkIGFuZCBzZXJ2ZS5cbiAgICAgIC8vIE5vbmUgb2Ygd2hpY2ggYXJlIFwibmFtZWRcIi5cbiAgICAgIG5hbWU6IGNyZWF0ZUhhc2goJ3NoYTEnKVxuICAgICAgICAudXBkYXRlKGFuZ3VsYXJWZXJzaW9uKVxuICAgICAgICAudXBkYXRlKFZFUlNJT04pXG4gICAgICAgIC51cGRhdGUod2NvLnByb2plY3RSb290KVxuICAgICAgICAudXBkYXRlKEpTT04uc3RyaW5naWZ5KHdjby50c0NvbmZpZykpXG4gICAgICAgIC51cGRhdGUoXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ud2NvLmJ1aWxkT3B0aW9ucyxcbiAgICAgICAgICAgIC8vIE5lZWRlZCBiZWNhdXNlIG91dHB1dFBhdGggY2hhbmdlcyBvbiBldmVyeSBidWlsZCB3aGVuIHVzaW5nIGkxOG4gZXh0cmFjdGlvblxuICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvYmxvYi83MzZhNWY4OWRlYWNhODVmNDg3Yjc4YWVjOWZmNjZkNDExOGNlYjZhL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4tb3B0aW9ucy50cyNMMjY0LUwyNjVcbiAgICAgICAgICAgIG91dHB1dFBhdGg6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICAuZGlnZXN0KCdoZXgnKSxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMud2F0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ21lbW9yeScsXG4gICAgICBtYXhHZW5lcmF0aW9uczogMSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgc2NyaXB0czogU2NyaXB0RWxlbWVudFtdLFxuKTogeyBidW5kbGVOYW1lOiBzdHJpbmc7IGluamVjdDogYm9vbGVhbjsgcGF0aHM6IHN0cmluZ1tdIH1bXSB7XG4gIHJldHVybiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHNjcmlwdHMsICdzY3JpcHRzJykucmVkdWNlKFxuICAgIChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgcGF0aHM6IHN0cmluZ1tdOyBpbmplY3Q6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICBjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgaW5wdXQgfSA9IGN1cnI7XG5cbiAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmluamVjdCAmJiAhaW5qZWN0KSB7XG4gICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtidW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGluamVjdGVkIGFuZCBub24taW5qZWN0ZWQgc2NyaXB0cy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChpbnB1dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgaW5qZWN0LFxuICAgICAgICAgIHBhdGhzOiBbaW5wdXRdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByZXY7XG4gICAgfSxcbiAgICBbXSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0UGF0dGVybnMocm9vdDogc3RyaW5nLCBhc3NldHM6IEFzc2V0UGF0dGVybkNsYXNzW10pIHtcbiAgcmV0dXJuIGFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5DbGFzcywgaW5kZXg6IG51bWJlcik6IE9iamVjdFBhdHRlcm4gPT4ge1xuICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItY29uc3RcbiAgICBsZXQgeyBpbnB1dCwgb3V0cHV0LCBpZ25vcmUgPSBbXSwgZ2xvYiB9ID0gYXNzZXQ7XG4gICAgaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICBpbnB1dCA9IGlucHV0LmVuZHNXaXRoKCcvJykgPyBpbnB1dCA6IGlucHV0ICsgJy8nO1xuICAgIG91dHB1dCA9IG91dHB1dC5lbmRzV2l0aCgnLycpID8gb3V0cHV0IDogb3V0cHV0ICsgJy8nO1xuXG4gICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRleHQ6IGlucHV0LFxuICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICB0bzogb3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICBmcm9tOiBnbG9iLFxuICAgICAgbm9FcnJvck9uTWlzc2luZzogdHJ1ZSxcbiAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgZ2xvYk9wdGlvbnM6IHtcbiAgICAgICAgZG90OiB0cnVlLFxuICAgICAgICBmb2xsb3dTeW1ib2xpY0xpbmtzOiAhIWFzc2V0LmZvbGxvd1N5bWxpbmtzLFxuICAgICAgICBpZ25vcmU6IFtcbiAgICAgICAgICAnLmdpdGtlZXAnLFxuICAgICAgICAgICcqKi8uRFNfU3RvcmUnLFxuICAgICAgICAgICcqKi9UaHVtYnMuZGInLFxuICAgICAgICAgIC8vIE5lZ2F0ZSBwYXR0ZXJucyBuZWVkcyB0byBiZSBhYnNvbHV0ZSBiZWNhdXNlIGNvcHktd2VicGFjay1wbHVnaW4gdXNlcyBhYnNvbHV0ZSBnbG9icyB3aGljaFxuICAgICAgICAgIC8vIGNhdXNlcyBuZWdhdGUgcGF0dGVybnMgbm90IHRvIG1hdGNoLlxuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jb3B5LXdlYnBhY2stcGx1Z2luL2lzc3Vlcy80OTgjaXNzdWVjb21tZW50LTYzOTMyNzkwOVxuICAgICAgICAgIC4uLmlnbm9yZSxcbiAgICAgICAgXS5tYXAoKGkpID0+IHBhdGgucG9zaXguam9pbihpbnB1dCwgaSkpLFxuICAgICAgfSxcbiAgICAgIHByaW9yaXR5OiBpbmRleCxcbiAgICB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0YXRzT3B0aW9ucyh2ZXJib3NlID0gZmFsc2UpOiBXZWJwYWNrU3RhdHNPcHRpb25zIHtcbiAgY29uc3Qgd2VicGFja091dHB1dE9wdGlvbnM6IFdlYnBhY2tTdGF0c09wdGlvbnMgPSB7XG4gICAgYWxsOiBmYWxzZSwgLy8gRmFsbGJhY2sgdmFsdWUgZm9yIHN0YXRzIG9wdGlvbnMgd2hlbiBhbiBvcHRpb24gaXMgbm90IGRlZmluZWQuIEl0IGhhcyBwcmVjZWRlbmNlIG92ZXIgbG9jYWwgd2VicGFjayBkZWZhdWx0cy5cbiAgICBjb2xvcnM6IHRydWUsXG4gICAgaGFzaDogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgdGltaW5nczogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgY2h1bmtzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBidWlsdEF0OiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICB3YXJuaW5nczogdHJ1ZSxcbiAgICBlcnJvcnM6IHRydWUsXG4gICAgYXNzZXRzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBjYWNoZWRBc3NldHM6IHRydWUsIC8vIHJlcXVpcmVkIGZvciBidW5kbGUgc2l6ZSBjYWxjdWxhdG9yc1xuXG4gICAgLy8gTmVlZGVkIGZvciBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsLlxuICAgIGlkczogdHJ1ZSxcbiAgICBlbnRyeXBvaW50czogdHJ1ZSxcbiAgfTtcblxuICBjb25zdCB2ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnM6IFdlYnBhY2tTdGF0c09wdGlvbnMgPSB7XG4gICAgLy8gVGhlIHZlcmJvc2Ugb3V0cHV0IHdpbGwgbW9zdCBsaWtlbHkgYmUgcGlwZWQgdG8gYSBmaWxlLCBzbyBjb2xvcnMganVzdCBtZXNzIGl0IHVwLlxuICAgIGNvbG9yczogZmFsc2UsXG4gICAgdXNlZEV4cG9ydHM6IHRydWUsXG4gICAgb3B0aW1pemF0aW9uQmFpbG91dDogdHJ1ZSxcbiAgICByZWFzb25zOiB0cnVlLFxuICAgIGNoaWxkcmVuOiB0cnVlLFxuICAgIGFzc2V0czogdHJ1ZSxcbiAgICB2ZXJzaW9uOiB0cnVlLFxuICAgIGNodW5rTW9kdWxlczogdHJ1ZSxcbiAgICBlcnJvckRldGFpbHM6IHRydWUsXG4gICAgZXJyb3JTdGFjazogdHJ1ZSxcbiAgICBtb2R1bGVUcmFjZTogdHJ1ZSxcbiAgICBsb2dnaW5nOiAndmVyYm9zZScsXG4gICAgbW9kdWxlc1NwYWNlOiBJbmZpbml0eSxcbiAgfTtcblxuICByZXR1cm4gdmVyYm9zZVxuICAgID8geyAuLi53ZWJwYWNrT3V0cHV0T3B0aW9ucywgLi4udmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zIH1cbiAgICA6IHdlYnBhY2tPdXRwdXRPcHRpb25zO1xufVxuXG4vKipcbiAqIEBwYXJhbSByb290IHRoZSB3b3Jrc3BhY2Ugcm9vdFxuICogQHJldHVybnMgYHRydWVgIHdoZW4gYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgaXMgaW5zdGFsbGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQbGF0Zm9ybVNlcnZlckluc3RhbGxlZChyb290OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgdHJ5IHtcbiAgICByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcicsIHsgcGF0aHM6IFtyb290XSB9KTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==