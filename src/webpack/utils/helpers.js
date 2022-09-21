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
exports.getStatsOptions = exports.externalizePackages = exports.assetPatterns = exports.globalScriptsByBundleName = exports.getCacheSettings = exports.getInstrumentationExcludedPaths = exports.assetNameTemplateFactory = exports.normalizeExtraEntryPoints = exports.getOutputHashFormat = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const glob_1 = __importDefault(require("glob"));
const path = __importStar(require("path"));
const schema_1 = require("../../builders/browser/schema");
const package_version_1 = require("../../utils/package-version");
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
        glob_1.default
            .sync(excludeGlob, { nodir: true, cwd: root, root, nomount: true })
            .forEach((p) => excluded.add(path.join(root, p)));
    }
    return excluded;
}
exports.getInstrumentationExcludedPaths = getInstrumentationExcludedPaths;
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
function globalScriptsByBundleName(root, scripts) {
    return normalizeExtraEntryPoints(scripts, 'scripts').reduce((prev, curr) => {
        const { bundleName, inject, input } = curr;
        let resolvedPath = path.resolve(root, input);
        if (!(0, fs_1.existsSync)(resolvedPath)) {
            try {
                resolvedPath = require.resolve(input, { paths: [root] });
            }
            catch (_a) {
                throw new Error(`Script file ${input} does not exist.`);
            }
        }
        const existingEntry = prev.find((el) => el.bundleName === bundleName);
        if (existingEntry) {
            if (existingEntry.inject && !inject) {
                // All entries have to be lazy for the bundle to be lazy.
                throw new Error(`The ${bundleName} bundle is mixing injected and non-injected scripts.`);
            }
            existingEntry.paths.push(resolvedPath);
        }
        else {
            prev.push({
                bundleName,
                inject,
                paths: [resolvedPath],
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
function externalizePackages(context, request, callback) {
    if (!request) {
        return;
    }
    // Absolute & Relative paths are not externals
    if (request.startsWith('.') || path.isAbsolute(request)) {
        callback();
        return;
    }
    try {
        require.resolve(request, { paths: [context] });
        callback(undefined, request);
    }
    catch (_a) {
        // Node couldn't find it, so it must be user-aliased
        callback();
    }
}
exports.externalizePackages = externalizePackages;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywyQkFBZ0M7QUFDaEMsZ0RBQXdCO0FBQ3hCLDJDQUE2QjtBQUU3QiwwREFLdUM7QUFFdkMsaUVBQXNEO0FBV3RELFNBQWdCLG1CQUFtQixDQUFDLGFBQWEsR0FBRyxzQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEdBQUcsRUFBRTtJQUNqRixNQUFNLFlBQVksR0FBRyxpQkFBaUIsTUFBTSxHQUFHLENBQUM7SUFFaEQsUUFBUSxhQUFhLEVBQUU7UUFDckIsS0FBSyxPQUFPO1lBQ1YsT0FBTztnQkFDTCxLQUFLLEVBQUUsRUFBRTtnQkFDVCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsTUFBTSxFQUFFLEVBQUU7YUFDWCxDQUFDO1FBQ0osS0FBSyxTQUFTO1lBQ1osT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxFQUFFO2dCQUNSLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7UUFDSixLQUFLLEtBQUs7WUFDUixPQUFPO2dCQUNMLEtBQUssRUFBRSxZQUFZO2dCQUNuQixPQUFPLEVBQUUsWUFBWTtnQkFDckIsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7UUFDSixLQUFLLE1BQU0sQ0FBQztRQUNaO1lBQ0UsT0FBTztnQkFDTCxLQUFLLEVBQUUsRUFBRTtnQkFDVCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsRUFBRTtn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TSxFQUFFLEtBQUs7UUFDYixXQUFXLEVBQUUsSUFBSTtRQUNqQixtQkFBbUIsRUFBRSxJQUFJO1FBQ3pCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO1FBQ2IsWUFBWSxFQUFFLElBQUk7UUFDbEIsWUFBWSxFQUFFLElBQUk7UUFDbEIsVUFBVSxFQUFFLElBQUk7UUFDaEIsV0FBVyxFQUFFLElBQUk7UUFDakIsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLFFBQVE7S0FDdkIsQ0FBQztJQUVGLE9BQU8sT0FBTztRQUNaLENBQUMsQ0FBQyxFQUFFLEdBQUcsb0JBQW9CLEVBQUUsR0FBRywyQkFBMkIsRUFBRTtRQUM3RCxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDM0IsQ0FBQztBQXRDRCwwQ0FzQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPYmplY3RQYXR0ZXJuIH0gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZCB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgQXNzZXRQYXR0ZXJuQ2xhc3MsXG4gIE91dHB1dEhhc2hpbmcsXG4gIFNjcmlwdEVsZW1lbnQsXG4gIFN0eWxlRWxlbWVudCxcbn0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLXZlcnNpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhc2hGb3JtYXQge1xuICBjaHVuazogc3RyaW5nO1xuICBleHRyYWN0OiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgc2NyaXB0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFdlYnBhY2tTdGF0c09wdGlvbnMgPSBFeGNsdWRlPENvbmZpZ3VyYXRpb25bJ3N0YXRzJ10sIHN0cmluZyB8IGJvb2xlYW4gfCB1bmRlZmluZWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3V0cHV0SGFzaEZvcm1hdChvdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lLCBsZW5ndGggPSAyMCk6IEhhc2hGb3JtYXQge1xuICBjb25zdCBoYXNoVGVtcGxhdGUgPSBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYDtcblxuICBzd2l0Y2ggKG91dHB1dEhhc2hpbmcpIHtcbiAgICBjYXNlICdtZWRpYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICAgIGNhc2UgJ2J1bmRsZXMnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ2FsbCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ25vbmUnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEVudHJ5UG9pbnQgPSBSZXF1aXJlZDxFeGNsdWRlPFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQsIHN0cmluZz4+O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgZXh0cmFFbnRyeVBvaW50czogKFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQpW10sXG4gIGRlZmF1bHRCdW5kbGVOYW1lOiBzdHJpbmcsXG4pOiBOb3JtYWxpemVkRW50cnlQb2ludFtdIHtcbiAgcmV0dXJuIGV4dHJhRW50cnlQb2ludHMubWFwKChlbnRyeSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBpbnB1dDogZW50cnksIGluamVjdDogdHJ1ZSwgYnVuZGxlTmFtZTogZGVmYXVsdEJ1bmRsZU5hbWUgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGluamVjdCA9IHRydWUsIC4uLm5ld0VudHJ5IH0gPSBlbnRyeTtcbiAgICBsZXQgYnVuZGxlTmFtZTtcbiAgICBpZiAoZW50cnkuYnVuZGxlTmFtZSkge1xuICAgICAgYnVuZGxlTmFtZSA9IGVudHJ5LmJ1bmRsZU5hbWU7XG4gICAgfSBlbHNlIGlmICghaW5qZWN0KSB7XG4gICAgICAvLyBMYXp5IGVudHJ5IHBvaW50cyB1c2UgdGhlIGZpbGUgbmFtZSBhcyBidW5kbGUgbmFtZS5cbiAgICAgIGJ1bmRsZU5hbWUgPSBwYXRoLnBhcnNlKGVudHJ5LmlucHV0KS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICBidW5kbGVOYW1lID0gZGVmYXVsdEJ1bmRsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4ubmV3RW50cnksIGluamVjdCwgYnVuZGxlTmFtZSB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0OiBIYXNoRm9ybWF0KTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmcge1xuICBjb25zdCB2aXNpdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIHJldHVybiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoaGFzaEZvcm1hdC5maWxlKSB7XG4gICAgICAvLyBGaWxlIG5hbWVzIGFyZSBoYXNoZWQgdGhlcmVmb3JlIHdlIGRvbid0IG5lZWQgdG8gaGFuZGxlIGZpbGVzIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lLlxuICAgICAgcmV0dXJuIGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShyZXNvdXJjZVBhdGgpO1xuICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIHdpdGggdGhlIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZC5cbiAgICBjb25zdCB2aXNpdGVkID0gdmlzaXRlZEZpbGVzLmdldChmaWxlbmFtZSk7XG4gICAgaWYgKCF2aXNpdGVkKSB7XG4gICAgICAvLyBOb3QgdmlzaXRlZC5cbiAgICAgIHZpc2l0ZWRGaWxlcy5zZXQoZmlsZW5hbWUsIHJlc291cmNlUGF0aCk7XG5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9IGVsc2UgaWYgKHZpc2l0ZWQgPT09IHJlc291cmNlUGF0aCkge1xuICAgICAgLy8gU2FtZSBmaWxlLlxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH1cblxuICAgIC8vIEZpbGUgaGFzIHRoZSBzYW1lIG5hbWUgYnV0IGl0J3MgaW4gYSBkaWZmZXJlbnQgbG9jYXRpb24uXG4gICAgcmV0dXJuICdbcGF0aF1bbmFtZV0uW2V4dF0nO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhcbiAgcm9vdDogc3RyaW5nLFxuICBleGNsdWRlZFBhdGhzOiBzdHJpbmdbXSxcbik6IFNldDxzdHJpbmc+IHtcbiAgY29uc3QgZXhjbHVkZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IGV4Y2x1ZGVHbG9iIG9mIGV4Y2x1ZGVkUGF0aHMpIHtcbiAgICBnbG9iXG4gICAgICAuc3luYyhleGNsdWRlR2xvYiwgeyBub2RpcjogdHJ1ZSwgY3dkOiByb290LCByb290LCBub21vdW50OiB0cnVlIH0pXG4gICAgICAuZm9yRWFjaCgocCkgPT4gZXhjbHVkZWQuYWRkKHBhdGguam9pbihyb290LCBwKSkpO1xuICB9XG5cbiAgcmV0dXJuIGV4Y2x1ZGVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2FjaGVTZXR0aW5ncyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbiAgYW5ndWxhclZlcnNpb246IHN0cmluZyxcbik6IFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZFsnY2FjaGUnXSB7XG4gIGNvbnN0IHsgZW5hYmxlZCwgcGF0aDogY2FjaGVEaXJlY3RvcnkgfSA9IHdjby5idWlsZE9wdGlvbnMuY2FjaGU7XG4gIGlmIChlbmFibGVkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdmaWxlc3lzdGVtJyxcbiAgICAgIHByb2ZpbGU6IHdjby5idWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgIGNhY2hlRGlyZWN0b3J5OiBwYXRoLmpvaW4oY2FjaGVEaXJlY3RvcnksICdhbmd1bGFyLXdlYnBhY2snKSxcbiAgICAgIG1heE1lbW9yeUdlbmVyYXRpb25zOiAxLFxuICAgICAgLy8gV2UgdXNlIHRoZSB2ZXJzaW9ucyBhbmQgYnVpbGQgb3B0aW9ucyBhcyB0aGUgY2FjaGUgbmFtZS4gVGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbnMgYXJlIHRvb1xuICAgICAgLy8gZHluYW1pYyBhbmQgc2hhcmVkIGFtb25nIGRpZmZlcmVudCBidWlsZCB0eXBlczogdGVzdCwgYnVpbGQgYW5kIHNlcnZlLlxuICAgICAgLy8gTm9uZSBvZiB3aGljaCBhcmUgXCJuYW1lZFwiLlxuICAgICAgbmFtZTogY3JlYXRlSGFzaCgnc2hhMScpXG4gICAgICAgIC51cGRhdGUoYW5ndWxhclZlcnNpb24pXG4gICAgICAgIC51cGRhdGUoVkVSU0lPTilcbiAgICAgICAgLnVwZGF0ZSh3Y28ucHJvamVjdFJvb3QpXG4gICAgICAgIC51cGRhdGUoSlNPTi5zdHJpbmdpZnkod2NvLnRzQ29uZmlnKSlcbiAgICAgICAgLnVwZGF0ZShcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi53Y28uYnVpbGRPcHRpb25zLFxuICAgICAgICAgICAgLy8gTmVlZGVkIGJlY2F1c2Ugb3V0cHV0UGF0aCBjaGFuZ2VzIG9uIGV2ZXJ5IGJ1aWxkIHdoZW4gdXNpbmcgaTE4biBleHRyYWN0aW9uXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9ibG9iLzczNmE1Zjg5ZGVhY2E4NWY0ODdiNzhhZWM5ZmY2NmQ0MTE4Y2ViNmEvcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaTE4bi1vcHRpb25zLnRzI0wyNjQtTDI2NVxuICAgICAgICAgICAgb3V0cHV0UGF0aDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pLFxuICAgICAgICApXG4gICAgICAgIC5kaWdlc3QoJ2hleCcpLFxuICAgIH07XG4gIH1cblxuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy53YXRjaCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnbWVtb3J5JyxcbiAgICAgIG1heEdlbmVyYXRpb25zOiAxLFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKFxuICByb290OiBzdHJpbmcsXG4gIHNjcmlwdHM6IFNjcmlwdEVsZW1lbnRbXSxcbik6IHsgYnVuZGxlTmFtZTogc3RyaW5nOyBpbmplY3Q6IGJvb2xlYW47IHBhdGhzOiBzdHJpbmdbXSB9W10ge1xuICByZXR1cm4gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzY3JpcHRzLCAnc2NyaXB0cycpLnJlZHVjZShcbiAgICAocHJldjogeyBidW5kbGVOYW1lOiBzdHJpbmc7IHBhdGhzOiBzdHJpbmdbXTsgaW5qZWN0OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIGlucHV0IH0gPSBjdXJyO1xuICAgICAgbGV0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBpbnB1dCk7XG5cbiAgICAgIGlmICghZXhpc3RzU3luYyhyZXNvbHZlZFBhdGgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzb2x2ZWRQYXRoID0gcmVxdWlyZS5yZXNvbHZlKGlucHV0LCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2NyaXB0IGZpbGUgJHtpbnB1dH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeSA9IHByZXYuZmluZCgoZWwpID0+IGVsLmJ1bmRsZU5hbWUgPT09IGJ1bmRsZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkuaW5qZWN0ICYmICFpbmplY3QpIHtcbiAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAke2J1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgaW5qZWN0ZWQgYW5kIG5vbi1pbmplY3RlZCBzY3JpcHRzLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgaW5qZWN0LFxuICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcmV2O1xuICAgIH0sXG4gICAgW10sXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NldFBhdHRlcm5zKHJvb3Q6IHN0cmluZywgYXNzZXRzOiBBc3NldFBhdHRlcm5DbGFzc1tdKSB7XG4gIHJldHVybiBhc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuQ2xhc3MsIGluZGV4OiBudW1iZXIpOiBPYmplY3RQYXR0ZXJuID0+IHtcbiAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcHJlZmVyLWNvbnN0XG4gICAgbGV0IHsgaW5wdXQsIG91dHB1dCwgaWdub3JlID0gW10sIGdsb2IgfSA9IGFzc2V0O1xuICAgIGlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgaW5wdXQgPSBpbnB1dC5lbmRzV2l0aCgnLycpID8gaW5wdXQgOiBpbnB1dCArICcvJztcbiAgICBvdXRwdXQgPSBvdXRwdXQuZW5kc1dpdGgoJy8nKSA/IG91dHB1dCA6IG91dHB1dCArICcvJztcblxuICAgIGlmIChvdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLicpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZXh0OiBpbnB1dCxcbiAgICAgIC8vIE5vdyB3ZSByZW1vdmUgc3RhcnRpbmcgc2xhc2ggdG8gbWFrZSBXZWJwYWNrIHBsYWNlIGl0IGZyb20gdGhlIG91dHB1dCByb290LlxuICAgICAgdG86IG91dHB1dC5yZXBsYWNlKC9eXFwvLywgJycpLFxuICAgICAgZnJvbTogZ2xvYixcbiAgICAgIG5vRXJyb3JPbk1pc3Npbmc6IHRydWUsXG4gICAgICBmb3JjZTogdHJ1ZSxcbiAgICAgIGdsb2JPcHRpb25zOiB7XG4gICAgICAgIGRvdDogdHJ1ZSxcbiAgICAgICAgZm9sbG93U3ltYm9saWNMaW5rczogISFhc3NldC5mb2xsb3dTeW1saW5rcyxcbiAgICAgICAgaWdub3JlOiBbXG4gICAgICAgICAgJy5naXRrZWVwJyxcbiAgICAgICAgICAnKiovLkRTX1N0b3JlJyxcbiAgICAgICAgICAnKiovVGh1bWJzLmRiJyxcbiAgICAgICAgICAvLyBOZWdhdGUgcGF0dGVybnMgbmVlZHMgdG8gYmUgYWJzb2x1dGUgYmVjYXVzZSBjb3B5LXdlYnBhY2stcGx1Z2luIHVzZXMgYWJzb2x1dGUgZ2xvYnMgd2hpY2hcbiAgICAgICAgICAvLyBjYXVzZXMgbmVnYXRlIHBhdHRlcm5zIG5vdCB0byBtYXRjaC5cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY29weS13ZWJwYWNrLXBsdWdpbi9pc3N1ZXMvNDk4I2lzc3VlY29tbWVudC02MzkzMjc5MDlcbiAgICAgICAgICAuLi5pZ25vcmUsXG4gICAgICAgIF0ubWFwKChpKSA9PiBwYXRoLnBvc2l4LmpvaW4oaW5wdXQsIGkpKSxcbiAgICAgIH0sXG4gICAgICBwcmlvcml0eTogaW5kZXgsXG4gICAgfTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRlcm5hbGl6ZVBhY2thZ2VzKFxuICBjb250ZXh0OiBzdHJpbmcsXG4gIHJlcXVlc3Q6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgY2FsbGJhY2s6IChlcnJvcj86IEVycm9yLCByZXN1bHQ/OiBzdHJpbmcpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQWJzb2x1dGUgJiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IGV4dGVybmFsc1xuICBpZiAocmVxdWVzdC5zdGFydHNXaXRoKCcuJykgfHwgcGF0aC5pc0Fic29sdXRlKHJlcXVlc3QpKSB7XG4gICAgY2FsbGJhY2soKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVxdWlyZS5yZXNvbHZlKHJlcXVlc3QsIHsgcGF0aHM6IFtjb250ZXh0XSB9KTtcbiAgICBjYWxsYmFjayh1bmRlZmluZWQsIHJlcXVlc3QpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBOb2RlIGNvdWxkbid0IGZpbmQgaXQsIHNvIGl0IG11c3QgYmUgdXNlci1hbGlhc2VkXG4gICAgY2FsbGJhY2soKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UgPSBmYWxzZSk6IFdlYnBhY2tTdGF0c09wdGlvbnMge1xuICBjb25zdCB3ZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICBhbGw6IGZhbHNlLCAvLyBGYWxsYmFjayB2YWx1ZSBmb3Igc3RhdHMgb3B0aW9ucyB3aGVuIGFuIG9wdGlvbiBpcyBub3QgZGVmaW5lZC4gSXQgaGFzIHByZWNlZGVuY2Ugb3ZlciBsb2NhbCB3ZWJwYWNrIGRlZmF1bHRzLlxuICAgIGNvbG9yczogdHJ1ZSxcbiAgICBoYXNoOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICB0aW1pbmdzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBjaHVua3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGJ1aWx0QXQ6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHdhcm5pbmdzOiB0cnVlLFxuICAgIGVycm9yczogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNhY2hlZEFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgZm9yIGJ1bmRsZSBzaXplIGNhbGN1bGF0b3JzXG5cbiAgICAvLyBOZWVkZWQgZm9yIG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwuXG4gICAgaWRzOiB0cnVlLFxuICAgIGVudHJ5cG9pbnRzOiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IHZlcmJvc2VXZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICAvLyBUaGUgdmVyYm9zZSBvdXRwdXQgd2lsbCBtb3N0IGxpa2VseSBiZSBwaXBlZCB0byBhIGZpbGUsIHNvIGNvbG9ycyBqdXN0IG1lc3MgaXQgdXAuXG4gICAgY29sb3JzOiBmYWxzZSxcbiAgICB1c2VkRXhwb3J0czogdHJ1ZSxcbiAgICBvcHRpbWl6YXRpb25CYWlsb3V0OiB0cnVlLFxuICAgIHJlYXNvbnM6IHRydWUsXG4gICAgY2hpbGRyZW46IHRydWUsXG4gICAgYXNzZXRzOiB0cnVlLFxuICAgIHZlcnNpb246IHRydWUsXG4gICAgY2h1bmtNb2R1bGVzOiB0cnVlLFxuICAgIGVycm9yRGV0YWlsczogdHJ1ZSxcbiAgICBlcnJvclN0YWNrOiB0cnVlLFxuICAgIG1vZHVsZVRyYWNlOiB0cnVlLFxuICAgIGxvZ2dpbmc6ICd2ZXJib3NlJyxcbiAgICBtb2R1bGVzU3BhY2U6IEluZmluaXR5LFxuICB9O1xuXG4gIHJldHVybiB2ZXJib3NlXG4gICAgPyB7IC4uLndlYnBhY2tPdXRwdXRPcHRpb25zLCAuLi52ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnMgfVxuICAgIDogd2VicGFja091dHB1dE9wdGlvbnM7XG59XG4iXX0=