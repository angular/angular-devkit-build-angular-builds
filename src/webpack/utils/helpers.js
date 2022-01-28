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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainFieldsAndConditionNames = exports.getStatsOptions = exports.externalizePackages = exports.assetPatterns = exports.globalScriptsByBundleName = exports.getCacheSettings = exports.getInstrumentationExcludedPaths = exports.assetNameTemplateFactory = exports.normalizeExtraEntryPoints = exports.getOutputHashFormat = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const glob_1 = __importDefault(require("glob"));
const path = __importStar(require("path"));
const typescript_1 = require("typescript");
const package_version_1 = require("../../utils/package-version");
function getOutputHashFormat(option, length = 20) {
    const hashFormats = {
        none: { chunk: '', extract: '', file: '', script: '' },
        media: { chunk: '', extract: '', file: `.[hash:${length}]`, script: '' },
        bundles: {
            chunk: `.[contenthash:${length}]`,
            extract: `.[contenthash:${length}]`,
            file: '',
            script: `.[hash:${length}]`,
        },
        all: {
            chunk: `.[contenthash:${length}]`,
            extract: `.[contenthash:${length}]`,
            file: `.[hash:${length}]`,
            script: `.[hash:${length}]`,
        },
    };
    return hashFormats[option] || hashFormats['none'];
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
function getInstrumentationExcludedPaths(sourceRoot, excludedPaths) {
    const excluded = new Set();
    for (const excludeGlob of excludedPaths) {
        glob_1.default
            .sync(path.join(sourceRoot, excludeGlob), { nodir: true })
            .forEach((p) => excluded.add(path.normalize(p)));
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
        moduleTrace: true,
        logging: 'verbose',
        modulesSpace: Infinity,
    };
    return verbose
        ? { ...webpackOutputOptions, ...verboseWebpackOutputOptions }
        : webpackOutputOptions;
}
exports.getStatsOptions = getStatsOptions;
function getMainFieldsAndConditionNames(target, platformServer) {
    const mainFields = platformServer
        ? ['es2015', 'module', 'main']
        : ['es2015', 'browser', 'module', 'main'];
    const conditionNames = ['es2015', '...'];
    if (target >= typescript_1.ScriptTarget.ES2020) {
        mainFields.unshift('es2020');
        conditionNames.unshift('es2020');
    }
    return {
        mainFields,
        conditionNames,
    };
}
exports.getMainFieldsAndConditionNames = getMainFieldsAndConditionNames;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsbUNBQW9DO0FBQ3BDLDJCQUFnQztBQUNoQyxnREFBd0I7QUFDeEIsMkNBQTZCO0FBQzdCLDJDQUEwQztBQVExQyxpRUFBc0Q7QUFTdEQsU0FBZ0IsbUJBQW1CLENBQUMsTUFBYyxFQUFFLE1BQU0sR0FBRyxFQUFFO0lBQzdELE1BQU0sV0FBVyxHQUFxQztRQUNwRCxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO1FBQ3RELEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxNQUFNLEdBQUcsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO1FBQ3hFLE9BQU8sRUFBRTtZQUNQLEtBQUssRUFBRSxpQkFBaUIsTUFBTSxHQUFHO1lBQ2pDLE9BQU8sRUFBRSxpQkFBaUIsTUFBTSxHQUFHO1lBQ25DLElBQUksRUFBRSxFQUFFO1lBQ1IsTUFBTSxFQUFFLFVBQVUsTUFBTSxHQUFHO1NBQzVCO1FBQ0QsR0FBRyxFQUFFO1lBQ0gsS0FBSyxFQUFFLGlCQUFpQixNQUFNLEdBQUc7WUFDakMsT0FBTyxFQUFFLGlCQUFpQixNQUFNLEdBQUc7WUFDbkMsSUFBSSxFQUFFLFVBQVUsTUFBTSxHQUFHO1lBQ3pCLE1BQU0sRUFBRSxVQUFVLE1BQU0sR0FBRztTQUM1QjtLQUNGLENBQUM7SUFFRixPQUFPLFdBQVcsQ0FBQyxNQUFN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LEVBQUUsSUFBSTtRQUNqQixtQkFBbUIsRUFBRSxJQUFJO1FBQ3pCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO1FBQ2IsWUFBWSxFQUFFLElBQUk7UUFDbEIsWUFBWSxFQUFFLElBQUk7UUFDbEIsV0FBVyxFQUFFLElBQUk7UUFDakIsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLFFBQVE7S0FDdkIsQ0FBQztJQUVGLE9BQU8sT0FBTztRQUNaLENBQUMsQ0FBQyxFQUFFLEdBQUcsb0JBQW9CLEVBQUUsR0FBRywyQkFBMkIsRUFBRTtRQUM3RCxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDM0IsQ0FBQztBQXJDRCwwQ0FxQ0M7QUFFRCxTQUFnQiw4QkFBOEIsQ0FDNUMsTUFBb0IsRUFDcEIsY0FBdUI7SUFFdkIsTUFBTSxVQUFVLEdBQUcsY0FBYztRQUMvQixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUM5QixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1QyxNQUFNLGNBQWMsR0FBRyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUV6QyxJQUFJLE1BQU0sSUFBSSx5QkFBWSxDQUFDLE1BQU0sRUFBRTtRQUNqQyxVQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdCLGNBQWMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbEM7SUFFRCxPQUFPO1FBQ0wsVUFBVTtRQUNWLGNBQWM7S0FDZixDQUFDO0FBQ0osQ0FBQztBQWxCRCx3RUFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPYmplY3RQYXR0ZXJuIH0gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29uZmlndXJhdGlvbiwgV2VicGFja09wdGlvbnNOb3JtYWxpemVkIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBBc3NldFBhdHRlcm5DbGFzcyxcbiAgRXh0cmFFbnRyeVBvaW50LFxuICBFeHRyYUVudHJ5UG9pbnRDbGFzcyxcbn0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLXZlcnNpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhc2hGb3JtYXQge1xuICBjaHVuazogc3RyaW5nO1xuICBleHRyYWN0OiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgc2NyaXB0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPdXRwdXRIYXNoRm9ybWF0KG9wdGlvbjogc3RyaW5nLCBsZW5ndGggPSAyMCk6IEhhc2hGb3JtYXQge1xuICBjb25zdCBoYXNoRm9ybWF0czogeyBbb3B0aW9uOiBzdHJpbmddOiBIYXNoRm9ybWF0IH0gPSB7XG4gICAgbm9uZTogeyBjaHVuazogJycsIGV4dHJhY3Q6ICcnLCBmaWxlOiAnJywgc2NyaXB0OiAnJyB9LFxuICAgIG1lZGlhOiB7IGNodW5rOiAnJywgZXh0cmFjdDogJycsIGZpbGU6IGAuW2hhc2g6JHtsZW5ndGh9XWAsIHNjcmlwdDogJycgfSxcbiAgICBidW5kbGVzOiB7XG4gICAgICBjaHVuazogYC5bY29udGVudGhhc2g6JHtsZW5ndGh9XWAsXG4gICAgICBleHRyYWN0OiBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYCxcbiAgICAgIGZpbGU6ICcnLFxuICAgICAgc2NyaXB0OiBgLltoYXNoOiR7bGVuZ3RofV1gLFxuICAgIH0sXG4gICAgYWxsOiB7XG4gICAgICBjaHVuazogYC5bY29udGVudGhhc2g6JHtsZW5ndGh9XWAsXG4gICAgICBleHRyYWN0OiBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYCxcbiAgICAgIGZpbGU6IGAuW2hhc2g6JHtsZW5ndGh9XWAsXG4gICAgICBzY3JpcHQ6IGAuW2hhc2g6JHtsZW5ndGh9XWAsXG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4gaGFzaEZvcm1hdHNbb3B0aW9uXSB8fCBoYXNoRm9ybWF0c1snbm9uZSddO1xufVxuXG5leHBvcnQgdHlwZSBOb3JtYWxpemVkRW50cnlQb2ludCA9IFJlcXVpcmVkPEV4dHJhRW50cnlQb2ludENsYXNzPjtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoXG4gIGV4dHJhRW50cnlQb2ludHM6IEV4dHJhRW50cnlQb2ludFtdLFxuICBkZWZhdWx0QnVuZGxlTmFtZTogc3RyaW5nLFxuKTogTm9ybWFsaXplZEVudHJ5UG9pbnRbXSB7XG4gIHJldHVybiBleHRyYUVudHJ5UG9pbnRzLm1hcCgoZW50cnkpID0+IHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHsgaW5wdXQ6IGVudHJ5LCBpbmplY3Q6IHRydWUsIGJ1bmRsZU5hbWU6IGRlZmF1bHRCdW5kbGVOYW1lIH07XG4gICAgfVxuXG4gICAgY29uc3QgeyBpbmplY3QgPSB0cnVlLCAuLi5uZXdFbnRyeSB9ID0gZW50cnk7XG4gICAgbGV0IGJ1bmRsZU5hbWU7XG4gICAgaWYgKGVudHJ5LmJ1bmRsZU5hbWUpIHtcbiAgICAgIGJ1bmRsZU5hbWUgPSBlbnRyeS5idW5kbGVOYW1lO1xuICAgIH0gZWxzZSBpZiAoIWluamVjdCkge1xuICAgICAgLy8gTGF6eSBlbnRyeSBwb2ludHMgdXNlIHRoZSBmaWxlIG5hbWUgYXMgYnVuZGxlIG5hbWUuXG4gICAgICBidW5kbGVOYW1lID0gcGF0aC5wYXJzZShlbnRyeS5pbnB1dCkubmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVuZGxlTmFtZSA9IGRlZmF1bHRCdW5kbGVOYW1lO1xuICAgIH1cblxuICAgIHJldHVybiB7IC4uLm5ld0VudHJ5LCBpbmplY3QsIGJ1bmRsZU5hbWUgfTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnkoaGFzaEZvcm1hdDogSGFzaEZvcm1hdCk6IChyZXNvdXJjZVBhdGg6IHN0cmluZykgPT4gc3RyaW5nIHtcbiAgY29uc3QgdmlzaXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICByZXR1cm4gKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKGhhc2hGb3JtYXQuZmlsZSkge1xuICAgICAgLy8gRmlsZSBuYW1lcyBhcmUgaGFzaGVkIHRoZXJlZm9yZSB3ZSBkb24ndCBuZWVkIHRvIGhhbmRsZSBmaWxlcyB3aXRoIHRoZSBzYW1lIGZpbGUgbmFtZS5cbiAgICAgIHJldHVybiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYDtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUocmVzb3VyY2VQYXRoKTtcbiAgICAvLyBDaGVjayBpZiB0aGUgZmlsZSB3aXRoIHRoZSBzYW1lIG5hbWUgaGFzIGFscmVhZHkgYmVlbiBwcm9jZXNzZWQuXG4gICAgY29uc3QgdmlzaXRlZCA9IHZpc2l0ZWRGaWxlcy5nZXQoZmlsZW5hbWUpO1xuICAgIGlmICghdmlzaXRlZCkge1xuICAgICAgLy8gTm90IHZpc2l0ZWQuXG4gICAgICB2aXNpdGVkRmlsZXMuc2V0KGZpbGVuYW1lLCByZXNvdXJjZVBhdGgpO1xuXG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfSBlbHNlIGlmICh2aXNpdGVkID09PSByZXNvdXJjZVBhdGgpIHtcbiAgICAgIC8vIFNhbWUgZmlsZS5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9XG5cbiAgICAvLyBGaWxlIGhhcyB0aGUgc2FtZSBuYW1lIGJ1dCBpdCdzIGluIGEgZGlmZmVyZW50IGxvY2F0aW9uLlxuICAgIHJldHVybiAnW3BhdGhdW25hbWVdLltleHRdJztcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMoXG4gIHNvdXJjZVJvb3Q6IHN0cmluZyxcbiAgZXhjbHVkZWRQYXRoczogc3RyaW5nW10sXG4pOiBTZXQ8c3RyaW5nPiB7XG4gIGNvbnN0IGV4Y2x1ZGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBleGNsdWRlR2xvYiBvZiBleGNsdWRlZFBhdGhzKSB7XG4gICAgZ2xvYlxuICAgICAgLnN5bmMocGF0aC5qb2luKHNvdXJjZVJvb3QsIGV4Y2x1ZGVHbG9iKSwgeyBub2RpcjogdHJ1ZSB9KVxuICAgICAgLmZvckVhY2goKHApID0+IGV4Y2x1ZGVkLmFkZChwYXRoLm5vcm1hbGl6ZShwKSkpO1xuICB9XG5cbiAgcmV0dXJuIGV4Y2x1ZGVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2FjaGVTZXR0aW5ncyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbiAgYW5ndWxhclZlcnNpb246IHN0cmluZyxcbik6IFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZFsnY2FjaGUnXSB7XG4gIGNvbnN0IHsgZW5hYmxlZCwgcGF0aDogY2FjaGVEaXJlY3RvcnkgfSA9IHdjby5idWlsZE9wdGlvbnMuY2FjaGU7XG4gIGlmIChlbmFibGVkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdmaWxlc3lzdGVtJyxcbiAgICAgIHByb2ZpbGU6IHdjby5idWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgIGNhY2hlRGlyZWN0b3J5OiBwYXRoLmpvaW4oY2FjaGVEaXJlY3RvcnksICdhbmd1bGFyLXdlYnBhY2snKSxcbiAgICAgIG1heE1lbW9yeUdlbmVyYXRpb25zOiAxLFxuICAgICAgLy8gV2UgdXNlIHRoZSB2ZXJzaW9ucyBhbmQgYnVpbGQgb3B0aW9ucyBhcyB0aGUgY2FjaGUgbmFtZS4gVGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbnMgYXJlIHRvb1xuICAgICAgLy8gZHluYW1pYyBhbmQgc2hhcmVkIGFtb25nIGRpZmZlcmVudCBidWlsZCB0eXBlczogdGVzdCwgYnVpbGQgYW5kIHNlcnZlLlxuICAgICAgLy8gTm9uZSBvZiB3aGljaCBhcmUgXCJuYW1lZFwiLlxuICAgICAgbmFtZTogY3JlYXRlSGFzaCgnc2hhMScpXG4gICAgICAgIC51cGRhdGUoYW5ndWxhclZlcnNpb24pXG4gICAgICAgIC51cGRhdGUoVkVSU0lPTilcbiAgICAgICAgLnVwZGF0ZSh3Y28ucHJvamVjdFJvb3QpXG4gICAgICAgIC51cGRhdGUoSlNPTi5zdHJpbmdpZnkod2NvLnRzQ29uZmlnKSlcbiAgICAgICAgLnVwZGF0ZShcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi53Y28uYnVpbGRPcHRpb25zLFxuICAgICAgICAgICAgLy8gTmVlZGVkIGJlY2F1c2Ugb3V0cHV0UGF0aCBjaGFuZ2VzIG9uIGV2ZXJ5IGJ1aWxkIHdoZW4gdXNpbmcgaTE4biBleHRyYWN0aW9uXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9ibG9iLzczNmE1Zjg5ZGVhY2E4NWY0ODdiNzhhZWM5ZmY2NmQ0MTE4Y2ViNmEvcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaTE4bi1vcHRpb25zLnRzI0wyNjQtTDI2NVxuICAgICAgICAgICAgb3V0cHV0UGF0aDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pLFxuICAgICAgICApXG4gICAgICAgIC5kaWdlc3QoJ2hleCcpLFxuICAgIH07XG4gIH1cblxuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy53YXRjaCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnbWVtb3J5JyxcbiAgICAgIG1heEdlbmVyYXRpb25zOiAxLFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKFxuICByb290OiBzdHJpbmcsXG4gIHNjcmlwdHM6IEV4dHJhRW50cnlQb2ludFtdLFxuKTogeyBidW5kbGVOYW1lOiBzdHJpbmc7IGluamVjdDogYm9vbGVhbjsgcGF0aHM6IHN0cmluZ1tdIH1bXSB7XG4gIHJldHVybiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHNjcmlwdHMsICdzY3JpcHRzJykucmVkdWNlKFxuICAgIChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgcGF0aHM6IHN0cmluZ1tdOyBpbmplY3Q6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICBjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgaW5wdXQgfSA9IGN1cnI7XG4gICAgICBsZXQgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGlucHV0KTtcblxuICAgICAgaWYgKCFleGlzdHNTeW5jKHJlc29sdmVkUGF0aCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXNvbHZlZFBhdGggPSByZXF1aXJlLnJlc29sdmUoaW5wdXQsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTY3JpcHQgZmlsZSAke2lucHV0fSBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeSkge1xuICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5pbmplY3QgJiYgIWluamVjdCkge1xuICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7YnVuZGxlTmFtZX0gYnVuZGxlIGlzIG1peGluZyBpbmplY3RlZCBhbmQgbm9uLWluamVjdGVkIHNjcmlwdHMuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICBpbmplY3QsXG4gICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByZXY7XG4gICAgfSxcbiAgICBbXSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0UGF0dGVybnMocm9vdDogc3RyaW5nLCBhc3NldHM6IEFzc2V0UGF0dGVybkNsYXNzW10pIHtcbiAgcmV0dXJuIGFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5DbGFzcywgaW5kZXg6IG51bWJlcik6IE9iamVjdFBhdHRlcm4gPT4ge1xuICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItY29uc3RcbiAgICBsZXQgeyBpbnB1dCwgb3V0cHV0LCBpZ25vcmUgPSBbXSwgZ2xvYiB9ID0gYXNzZXQ7XG4gICAgaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICBpbnB1dCA9IGlucHV0LmVuZHNXaXRoKCcvJykgPyBpbnB1dCA6IGlucHV0ICsgJy8nO1xuICAgIG91dHB1dCA9IG91dHB1dC5lbmRzV2l0aCgnLycpID8gb3V0cHV0IDogb3V0cHV0ICsgJy8nO1xuXG4gICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRleHQ6IGlucHV0LFxuICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICB0bzogb3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICBmcm9tOiBnbG9iLFxuICAgICAgbm9FcnJvck9uTWlzc2luZzogdHJ1ZSxcbiAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgZ2xvYk9wdGlvbnM6IHtcbiAgICAgICAgZG90OiB0cnVlLFxuICAgICAgICBmb2xsb3dTeW1ib2xpY0xpbmtzOiAhIWFzc2V0LmZvbGxvd1N5bWxpbmtzLFxuICAgICAgICBpZ25vcmU6IFtcbiAgICAgICAgICAnLmdpdGtlZXAnLFxuICAgICAgICAgICcqKi8uRFNfU3RvcmUnLFxuICAgICAgICAgICcqKi9UaHVtYnMuZGInLFxuICAgICAgICAgIC8vIE5lZ2F0ZSBwYXR0ZXJucyBuZWVkcyB0byBiZSBhYnNvbHV0ZSBiZWNhdXNlIGNvcHktd2VicGFjay1wbHVnaW4gdXNlcyBhYnNvbHV0ZSBnbG9icyB3aGljaFxuICAgICAgICAgIC8vIGNhdXNlcyBuZWdhdGUgcGF0dGVybnMgbm90IHRvIG1hdGNoLlxuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jb3B5LXdlYnBhY2stcGx1Z2luL2lzc3Vlcy80OTgjaXNzdWVjb21tZW50LTYzOTMyNzkwOVxuICAgICAgICAgIC4uLmlnbm9yZSxcbiAgICAgICAgXS5tYXAoKGkpID0+IHBhdGgucG9zaXguam9pbihpbnB1dCwgaSkpLFxuICAgICAgfSxcbiAgICAgIHByaW9yaXR5OiBpbmRleCxcbiAgICB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVybmFsaXplUGFja2FnZXMoXG4gIGNvbnRleHQ6IHN0cmluZyxcbiAgcmVxdWVzdDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBjYWxsYmFjazogKGVycm9yPzogRXJyb3IsIHJlc3VsdD86IHN0cmluZykgPT4gdm9pZCxcbik6IHZvaWQge1xuICBpZiAoIXJlcXVlc3QpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBYnNvbHV0ZSAmIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgZXh0ZXJuYWxzXG4gIGlmIChyZXF1ZXN0LnN0YXJ0c1dpdGgoJy4nKSB8fCBwYXRoLmlzQWJzb2x1dGUocmVxdWVzdCkpIHtcbiAgICBjYWxsYmFjaygpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXF1aXJlLnJlc29sdmUocmVxdWVzdCwgeyBwYXRoczogW2NvbnRleHRdIH0pO1xuICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgcmVxdWVzdCk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIE5vZGUgY291bGRuJ3QgZmluZCBpdCwgc28gaXQgbXVzdCBiZSB1c2VyLWFsaWFzZWRcbiAgICBjYWxsYmFjaygpO1xuICB9XG59XG5cbnR5cGUgV2VicGFja1N0YXRzT3B0aW9ucyA9IEV4Y2x1ZGU8Q29uZmlndXJhdGlvblsnc3RhdHMnXSwgc3RyaW5nIHwgYm9vbGVhbj47XG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UgPSBmYWxzZSk6IFdlYnBhY2tTdGF0c09wdGlvbnMge1xuICBjb25zdCB3ZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICBhbGw6IGZhbHNlLCAvLyBGYWxsYmFjayB2YWx1ZSBmb3Igc3RhdHMgb3B0aW9ucyB3aGVuIGFuIG9wdGlvbiBpcyBub3QgZGVmaW5lZC4gSXQgaGFzIHByZWNlZGVuY2Ugb3ZlciBsb2NhbCB3ZWJwYWNrIGRlZmF1bHRzLlxuICAgIGNvbG9yczogdHJ1ZSxcbiAgICBoYXNoOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICB0aW1pbmdzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBjaHVua3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGJ1aWx0QXQ6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHdhcm5pbmdzOiB0cnVlLFxuICAgIGVycm9yczogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNhY2hlZEFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgZm9yIGJ1bmRsZSBzaXplIGNhbGN1bGF0b3JzXG5cbiAgICAvLyBOZWVkZWQgZm9yIG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwuXG4gICAgaWRzOiB0cnVlLFxuICAgIGVudHJ5cG9pbnRzOiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IHZlcmJvc2VXZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICAvLyBUaGUgdmVyYm9zZSBvdXRwdXQgd2lsbCBtb3N0IGxpa2VseSBiZSBwaXBlZCB0byBhIGZpbGUsIHNvIGNvbG9ycyBqdXN0IG1lc3MgaXQgdXAuXG4gICAgY29sb3JzOiBmYWxzZSxcbiAgICB1c2VkRXhwb3J0czogdHJ1ZSxcbiAgICBvcHRpbWl6YXRpb25CYWlsb3V0OiB0cnVlLFxuICAgIHJlYXNvbnM6IHRydWUsXG4gICAgY2hpbGRyZW46IHRydWUsXG4gICAgYXNzZXRzOiB0cnVlLFxuICAgIHZlcnNpb246IHRydWUsXG4gICAgY2h1bmtNb2R1bGVzOiB0cnVlLFxuICAgIGVycm9yRGV0YWlsczogdHJ1ZSxcbiAgICBtb2R1bGVUcmFjZTogdHJ1ZSxcbiAgICBsb2dnaW5nOiAndmVyYm9zZScsXG4gICAgbW9kdWxlc1NwYWNlOiBJbmZpbml0eSxcbiAgfTtcblxuICByZXR1cm4gdmVyYm9zZVxuICAgID8geyAuLi53ZWJwYWNrT3V0cHV0T3B0aW9ucywgLi4udmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zIH1cbiAgICA6IHdlYnBhY2tPdXRwdXRPcHRpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzKFxuICB0YXJnZXQ6IFNjcmlwdFRhcmdldCxcbiAgcGxhdGZvcm1TZXJ2ZXI6IGJvb2xlYW4sXG4pOiBQaWNrPFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZFsncmVzb2x2ZSddLCAnbWFpbkZpZWxkcycgfCAnY29uZGl0aW9uTmFtZXMnPiB7XG4gIGNvbnN0IG1haW5GaWVsZHMgPSBwbGF0Zm9ybVNlcnZlclxuICAgID8gWydlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXVxuICAgIDogWydlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddO1xuICBjb25zdCBjb25kaXRpb25OYW1lcyA9IFsnZXMyMDE1JywgJy4uLiddO1xuXG4gIGlmICh0YXJnZXQgPj0gU2NyaXB0VGFyZ2V0LkVTMjAyMCkge1xuICAgIG1haW5GaWVsZHMudW5zaGlmdCgnZXMyMDIwJyk7XG4gICAgY29uZGl0aW9uTmFtZXMudW5zaGlmdCgnZXMyMDIwJyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1haW5GaWVsZHMsXG4gICAgY29uZGl0aW9uTmFtZXMsXG4gIH07XG59XG4iXX0=