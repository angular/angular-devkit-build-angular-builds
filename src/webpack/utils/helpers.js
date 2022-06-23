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
exports.getMainFieldsAndConditionNames = exports.getStatsOptions = exports.externalizePackages = exports.assetPatterns = exports.globalScriptsByBundleName = exports.getCacheSettings = exports.getInstrumentationExcludedPaths = exports.assetNameTemplateFactory = exports.normalizeExtraEntryPoints = exports.getOutputHashFormat = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const glob_1 = __importDefault(require("glob"));
const path = __importStar(require("path"));
const typescript_1 = require("typescript");
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
function getInstrumentationExcludedPaths(sourceRoot, excludedPaths) {
    const excluded = new Set();
    for (const excludeGlob of excludedPaths) {
        glob_1.default
            .sync(excludeGlob, { nodir: true, cwd: sourceRoot })
            .forEach((p) => excluded.add(path.join(sourceRoot, p)));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywyQkFBZ0M7QUFDaEMsZ0RBQXdCO0FBQ3hCLDJDQUE2QjtBQUM3QiwyQ0FBMEM7QUFFMUMsMERBS3VDO0FBRXZDLGlFQUFzRDtBQVN0RCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFhLEdBQUcsc0JBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUU7SUFDakYsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLE1BQU0sR0FBRyxDQUFDO0lBRWhELFFBQVEsYUFBYSxFQUFFO1FBQ3JCLEtBQUssT0FBTztZQUNWLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxFQUFFO2FBQ1gsQ0FBQztRQUNKLEtBQUssU0FBUztZQUNaLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixJQUFJLEVBQUUsRUFBRTtnQkFDUixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxLQUFLO1lBQ1IsT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxZQUFZO2dCQUNsQixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxNQUFNLENBQUM7UUFDWjtZQUNFLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFB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YixXQUFXLEVBQUUsSUFBSTtRQUNqQixtQkFBbUIsRUFBRSxJQUFJO1FBQ3pCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO1FBQ2IsWUFBWSxFQUFFLElBQUk7UUFDbEIsWUFBWSxFQUFFLElBQUk7UUFDbEIsV0FBVyxFQUFFLElBQUk7UUFDakIsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLFFBQVE7S0FDdkIsQ0FBQztJQUVGLE9BQU8sT0FBTztRQUNaLENBQUMsQ0FBQyxFQUFFLEdBQUcsb0JBQW9CLEVBQUUsR0FBRywyQkFBMkIsRUFBRTtRQUM3RCxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDM0IsQ0FBQztBQXJDRCwwQ0FxQ0M7QUFFRCxTQUFnQiw4QkFBOEIsQ0FDNUMsTUFBb0IsRUFDcEIsY0FBdUI7SUFFdkIsTUFBTSxVQUFVLEdBQUcsY0FBYztRQUMvQixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUM5QixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1QyxNQUFNLGNBQWMsR0FBRyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUV6QyxJQUFJLE1BQU0sSUFBSSx5QkFBWSxDQUFDLE1BQU0sRUFBRTtRQUNqQyxVQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdCLGNBQWMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbEM7SUFFRCxPQUFPO1FBQ0wsVUFBVTtRQUNWLGNBQWM7S0FDZixDQUFDO0FBQ0osQ0FBQztBQWxCRCx3RUFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPYmplY3RQYXR0ZXJuIH0gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29uZmlndXJhdGlvbiwgV2VicGFja09wdGlvbnNOb3JtYWxpemVkIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBBc3NldFBhdHRlcm5DbGFzcyxcbiAgT3V0cHV0SGFzaGluZyxcbiAgU2NyaXB0RWxlbWVudCxcbiAgU3R5bGVFbGVtZW50LFxufSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtdmVyc2lvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFzaEZvcm1hdCB7XG4gIGNodW5rOiBzdHJpbmc7XG4gIGV4dHJhY3Q6IHN0cmluZztcbiAgZmlsZTogc3RyaW5nO1xuICBzY3JpcHQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE91dHB1dEhhc2hGb3JtYXQob3V0cHV0SGFzaGluZyA9IE91dHB1dEhhc2hpbmcuTm9uZSwgbGVuZ3RoID0gMjApOiBIYXNoRm9ybWF0IHtcbiAgY29uc3QgaGFzaFRlbXBsYXRlID0gYC5bY29udGVudGhhc2g6JHtsZW5ndGh9XWA7XG5cbiAgc3dpdGNoIChvdXRwdXRIYXNoaW5nKSB7XG4gICAgY2FzZSAnbWVkaWEnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6ICcnLFxuICAgICAgICBleHRyYWN0OiAnJyxcbiAgICAgICAgZmlsZTogaGFzaFRlbXBsYXRlLFxuICAgICAgICBzY3JpcHQ6ICcnLFxuICAgICAgfTtcbiAgICBjYXNlICdidW5kbGVzJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGV4dHJhY3Q6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZmlsZTogJycsXG4gICAgICAgIHNjcmlwdDogaGFzaFRlbXBsYXRlLFxuICAgICAgfTtcbiAgICBjYXNlICdhbGwnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogaGFzaFRlbXBsYXRlLFxuICAgICAgfTtcbiAgICBjYXNlICdub25lJzpcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6ICcnLFxuICAgICAgICBleHRyYWN0OiAnJyxcbiAgICAgICAgZmlsZTogJycsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRFbnRyeVBvaW50ID0gUmVxdWlyZWQ8RXhjbHVkZTxTY3JpcHRFbGVtZW50IHwgU3R5bGVFbGVtZW50LCBzdHJpbmc+PjtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoXG4gIGV4dHJhRW50cnlQb2ludHM6IChTY3JpcHRFbGVtZW50IHwgU3R5bGVFbGVtZW50KVtdLFxuICBkZWZhdWx0QnVuZGxlTmFtZTogc3RyaW5nLFxuKTogTm9ybWFsaXplZEVudHJ5UG9pbnRbXSB7XG4gIHJldHVybiBleHRyYUVudHJ5UG9pbnRzLm1hcCgoZW50cnkpID0+IHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHsgaW5wdXQ6IGVudHJ5LCBpbmplY3Q6IHRydWUsIGJ1bmRsZU5hbWU6IGRlZmF1bHRCdW5kbGVOYW1lIH07XG4gICAgfVxuXG4gICAgY29uc3QgeyBpbmplY3QgPSB0cnVlLCAuLi5uZXdFbnRyeSB9ID0gZW50cnk7XG4gICAgbGV0IGJ1bmRsZU5hbWU7XG4gICAgaWYgKGVudHJ5LmJ1bmRsZU5hbWUpIHtcbiAgICAgIGJ1bmRsZU5hbWUgPSBlbnRyeS5idW5kbGVOYW1lO1xuICAgIH0gZWxzZSBpZiAoIWluamVjdCkge1xuICAgICAgLy8gTGF6eSBlbnRyeSBwb2ludHMgdXNlIHRoZSBmaWxlIG5hbWUgYXMgYnVuZGxlIG5hbWUuXG4gICAgICBidW5kbGVOYW1lID0gcGF0aC5wYXJzZShlbnRyeS5pbnB1dCkubmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVuZGxlTmFtZSA9IGRlZmF1bHRCdW5kbGVOYW1lO1xuICAgIH1cblxuICAgIHJldHVybiB7IC4uLm5ld0VudHJ5LCBpbmplY3QsIGJ1bmRsZU5hbWUgfTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnkoaGFzaEZvcm1hdDogSGFzaEZvcm1hdCk6IChyZXNvdXJjZVBhdGg6IHN0cmluZykgPT4gc3RyaW5nIHtcbiAgY29uc3QgdmlzaXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICByZXR1cm4gKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKGhhc2hGb3JtYXQuZmlsZSkge1xuICAgICAgLy8gRmlsZSBuYW1lcyBhcmUgaGFzaGVkIHRoZXJlZm9yZSB3ZSBkb24ndCBuZWVkIHRvIGhhbmRsZSBmaWxlcyB3aXRoIHRoZSBzYW1lIGZpbGUgbmFtZS5cbiAgICAgIHJldHVybiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYDtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUocmVzb3VyY2VQYXRoKTtcbiAgICAvLyBDaGVjayBpZiB0aGUgZmlsZSB3aXRoIHRoZSBzYW1lIG5hbWUgaGFzIGFscmVhZHkgYmVlbiBwcm9jZXNzZWQuXG4gICAgY29uc3QgdmlzaXRlZCA9IHZpc2l0ZWRGaWxlcy5nZXQoZmlsZW5hbWUpO1xuICAgIGlmICghdmlzaXRlZCkge1xuICAgICAgLy8gTm90IHZpc2l0ZWQuXG4gICAgICB2aXNpdGVkRmlsZXMuc2V0KGZpbGVuYW1lLCByZXNvdXJjZVBhdGgpO1xuXG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfSBlbHNlIGlmICh2aXNpdGVkID09PSByZXNvdXJjZVBhdGgpIHtcbiAgICAgIC8vIFNhbWUgZmlsZS5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9XG5cbiAgICAvLyBGaWxlIGhhcyB0aGUgc2FtZSBuYW1lIGJ1dCBpdCdzIGluIGEgZGlmZmVyZW50IGxvY2F0aW9uLlxuICAgIHJldHVybiAnW3BhdGhdW25hbWVdLltleHRdJztcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMoXG4gIHNvdXJjZVJvb3Q6IHN0cmluZyxcbiAgZXhjbHVkZWRQYXRoczogc3RyaW5nW10sXG4pOiBTZXQ8c3RyaW5nPiB7XG4gIGNvbnN0IGV4Y2x1ZGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBleGNsdWRlR2xvYiBvZiBleGNsdWRlZFBhdGhzKSB7XG4gICAgZ2xvYlxuICAgICAgLnN5bmMoZXhjbHVkZUdsb2IsIHsgbm9kaXI6IHRydWUsIGN3ZDogc291cmNlUm9vdCB9KVxuICAgICAgLmZvckVhY2goKHApID0+IGV4Y2x1ZGVkLmFkZChwYXRoLmpvaW4oc291cmNlUm9vdCwgcCkpKTtcbiAgfVxuXG4gIHJldHVybiBleGNsdWRlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENhY2hlU2V0dGluZ3MoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGFuZ3VsYXJWZXJzaW9uOiBzdHJpbmcsXG4pOiBXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWRbJ2NhY2hlJ10ge1xuICBjb25zdCB7IGVuYWJsZWQsIHBhdGg6IGNhY2hlRGlyZWN0b3J5IH0gPSB3Y28uYnVpbGRPcHRpb25zLmNhY2hlO1xuICBpZiAoZW5hYmxlZCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnZmlsZXN5c3RlbScsXG4gICAgICBwcm9maWxlOiB3Y28uYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICBjYWNoZURpcmVjdG9yeTogcGF0aC5qb2luKGNhY2hlRGlyZWN0b3J5LCAnYW5ndWxhci13ZWJwYWNrJyksXG4gICAgICBtYXhNZW1vcnlHZW5lcmF0aW9uczogMSxcbiAgICAgIC8vIFdlIHVzZSB0aGUgdmVyc2lvbnMgYW5kIGJ1aWxkIG9wdGlvbnMgYXMgdGhlIGNhY2hlIG5hbWUuIFRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb25zIGFyZSB0b29cbiAgICAgIC8vIGR5bmFtaWMgYW5kIHNoYXJlZCBhbW9uZyBkaWZmZXJlbnQgYnVpbGQgdHlwZXM6IHRlc3QsIGJ1aWxkIGFuZCBzZXJ2ZS5cbiAgICAgIC8vIE5vbmUgb2Ygd2hpY2ggYXJlIFwibmFtZWRcIi5cbiAgICAgIG5hbWU6IGNyZWF0ZUhhc2goJ3NoYTEnKVxuICAgICAgICAudXBkYXRlKGFuZ3VsYXJWZXJzaW9uKVxuICAgICAgICAudXBkYXRlKFZFUlNJT04pXG4gICAgICAgIC51cGRhdGUod2NvLnByb2plY3RSb290KVxuICAgICAgICAudXBkYXRlKEpTT04uc3RyaW5naWZ5KHdjby50c0NvbmZpZykpXG4gICAgICAgIC51cGRhdGUoXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ud2NvLmJ1aWxkT3B0aW9ucyxcbiAgICAgICAgICAgIC8vIE5lZWRlZCBiZWNhdXNlIG91dHB1dFBhdGggY2hhbmdlcyBvbiBldmVyeSBidWlsZCB3aGVuIHVzaW5nIGkxOG4gZXh0cmFjdGlvblxuICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvYmxvYi83MzZhNWY4OWRlYWNhODVmNDg3Yjc4YWVjOWZmNjZkNDExOGNlYjZhL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4tb3B0aW9ucy50cyNMMjY0LUwyNjVcbiAgICAgICAgICAgIG91dHB1dFBhdGg6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICAuZGlnZXN0KCdoZXgnKSxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMud2F0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ21lbW9yeScsXG4gICAgICBtYXhHZW5lcmF0aW9uczogMSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgcm9vdDogc3RyaW5nLFxuICBzY3JpcHRzOiBTY3JpcHRFbGVtZW50W10sXG4pOiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgaW5qZWN0OiBib29sZWFuOyBwYXRoczogc3RyaW5nW10gfVtdIHtcbiAgcmV0dXJuIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc2NyaXB0cywgJ3NjcmlwdHMnKS5yZWR1Y2UoXG4gICAgKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nOyBwYXRoczogc3RyaW5nW107IGluamVjdDogYm9vbGVhbiB9W10sIGN1cnIpID0+IHtcbiAgICAgIGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBpbnB1dCB9ID0gY3VycjtcbiAgICAgIGxldCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpO1xuXG4gICAgICBpZiAoIWV4aXN0c1N5bmMocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc29sdmVkUGF0aCA9IHJlcXVpcmUucmVzb2x2ZShpbnB1dCwgeyBwYXRoczogW3Jvb3RdIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNjcmlwdCBmaWxlICR7aW5wdXR9IGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmluamVjdCAmJiAhaW5qZWN0KSB7XG4gICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtidW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGluamVjdGVkIGFuZCBub24taW5qZWN0ZWQgc2NyaXB0cy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgIGluamVjdCxcbiAgICAgICAgICBwYXRoczogW3Jlc29sdmVkUGF0aF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJldjtcbiAgICB9LFxuICAgIFtdLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXRQYXR0ZXJucyhyb290OiBzdHJpbmcsIGFzc2V0czogQXNzZXRQYXR0ZXJuQ2xhc3NbXSkge1xuICByZXR1cm4gYXNzZXRzLm1hcCgoYXNzZXQ6IEFzc2V0UGF0dGVybkNsYXNzLCBpbmRleDogbnVtYmVyKTogT2JqZWN0UGF0dGVybiA9PiB7XG4gICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHByZWZlci1jb25zdFxuICAgIGxldCB7IGlucHV0LCBvdXRwdXQsIGlnbm9yZSA9IFtdLCBnbG9iIH0gPSBhc3NldDtcbiAgICBpbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBpbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGlucHV0ID0gaW5wdXQuZW5kc1dpdGgoJy8nKSA/IGlucHV0IDogaW5wdXQgKyAnLyc7XG4gICAgb3V0cHV0ID0gb3V0cHV0LmVuZHNXaXRoKCcvJykgPyBvdXRwdXQgOiBvdXRwdXQgKyAnLyc7XG5cbiAgICBpZiAob3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGV4dDogaW5wdXQsXG4gICAgICAvLyBOb3cgd2UgcmVtb3ZlIHN0YXJ0aW5nIHNsYXNoIHRvIG1ha2UgV2VicGFjayBwbGFjZSBpdCBmcm9tIHRoZSBvdXRwdXQgcm9vdC5cbiAgICAgIHRvOiBvdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgIGZyb206IGdsb2IsXG4gICAgICBub0Vycm9yT25NaXNzaW5nOiB0cnVlLFxuICAgICAgZm9yY2U6IHRydWUsXG4gICAgICBnbG9iT3B0aW9uczoge1xuICAgICAgICBkb3Q6IHRydWUsXG4gICAgICAgIGZvbGxvd1N5bWJvbGljTGlua3M6ICEhYXNzZXQuZm9sbG93U3ltbGlua3MsXG4gICAgICAgIGlnbm9yZTogW1xuICAgICAgICAgICcuZ2l0a2VlcCcsXG4gICAgICAgICAgJyoqLy5EU19TdG9yZScsXG4gICAgICAgICAgJyoqL1RodW1icy5kYicsXG4gICAgICAgICAgLy8gTmVnYXRlIHBhdHRlcm5zIG5lZWRzIHRvIGJlIGFic29sdXRlIGJlY2F1c2UgY29weS13ZWJwYWNrLXBsdWdpbiB1c2VzIGFic29sdXRlIGdsb2JzIHdoaWNoXG4gICAgICAgICAgLy8gY2F1c2VzIG5lZ2F0ZSBwYXR0ZXJucyBub3QgdG8gbWF0Y2guXG4gICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL2NvcHktd2VicGFjay1wbHVnaW4vaXNzdWVzLzQ5OCNpc3N1ZWNvbW1lbnQtNjM5MzI3OTA5XG4gICAgICAgICAgLi4uaWdub3JlLFxuICAgICAgICBdLm1hcCgoaSkgPT4gcGF0aC5wb3NpeC5qb2luKGlucHV0LCBpKSksXG4gICAgICB9LFxuICAgICAgcHJpb3JpdHk6IGluZGV4LFxuICAgIH07XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0ZXJuYWxpemVQYWNrYWdlcyhcbiAgY29udGV4dDogc3RyaW5nLFxuICByZXF1ZXN0OiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGNhbGxiYWNrOiAoZXJyb3I/OiBFcnJvciwgcmVzdWx0Pzogc3RyaW5nKSA9PiB2b2lkLFxuKTogdm9pZCB7XG4gIGlmICghcmVxdWVzdCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEFic29sdXRlICYgUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBleHRlcm5hbHNcbiAgaWYgKHJlcXVlc3Quc3RhcnRzV2l0aCgnLicpIHx8IHBhdGguaXNBYnNvbHV0ZShyZXF1ZXN0KSkge1xuICAgIGNhbGxiYWNrKCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIHJlcXVpcmUucmVzb2x2ZShyZXF1ZXN0LCB7IHBhdGhzOiBbY29udGV4dF0gfSk7XG4gICAgY2FsbGJhY2sodW5kZWZpbmVkLCByZXF1ZXN0KTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gTm9kZSBjb3VsZG4ndCBmaW5kIGl0LCBzbyBpdCBtdXN0IGJlIHVzZXItYWxpYXNlZFxuICAgIGNhbGxiYWNrKCk7XG4gIH1cbn1cblxudHlwZSBXZWJwYWNrU3RhdHNPcHRpb25zID0gRXhjbHVkZTxDb25maWd1cmF0aW9uWydzdGF0cyddLCBzdHJpbmcgfCBib29sZWFuPjtcbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSA9IGZhbHNlKTogV2VicGFja1N0YXRzT3B0aW9ucyB7XG4gIGNvbnN0IHdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIGFsbDogZmFsc2UsIC8vIEZhbGxiYWNrIHZhbHVlIGZvciBzdGF0cyBvcHRpb25zIHdoZW4gYW4gb3B0aW9uIGlzIG5vdCBkZWZpbmVkLiBJdCBoYXMgcHJlY2VkZW5jZSBvdmVyIGxvY2FsIHdlYnBhY2sgZGVmYXVsdHMuXG4gICAgY29sb3JzOiB0cnVlLFxuICAgIGhhc2g6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHRpbWluZ3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNodW5rczogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgYnVpbHRBdDogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgd2FybmluZ3M6IHRydWUsXG4gICAgZXJyb3JzOiB0cnVlLFxuICAgIGFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgY2FjaGVkQXNzZXRzOiB0cnVlLCAvLyByZXF1aXJlZCBmb3IgYnVuZGxlIHNpemUgY2FsY3VsYXRvcnNcblxuICAgIC8vIE5lZWRlZCBmb3IgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbC5cbiAgICBpZHM6IHRydWUsXG4gICAgZW50cnlwb2ludHM6IHRydWUsXG4gIH07XG5cbiAgY29uc3QgdmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIC8vIFRoZSB2ZXJib3NlIG91dHB1dCB3aWxsIG1vc3QgbGlrZWx5IGJlIHBpcGVkIHRvIGEgZmlsZSwgc28gY29sb3JzIGp1c3QgbWVzcyBpdCB1cC5cbiAgICBjb2xvcnM6IGZhbHNlLFxuICAgIHVzZWRFeHBvcnRzOiB0cnVlLFxuICAgIG9wdGltaXphdGlvbkJhaWxvdXQ6IHRydWUsXG4gICAgcmVhc29uczogdHJ1ZSxcbiAgICBjaGlsZHJlbjogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsXG4gICAgdmVyc2lvbjogdHJ1ZSxcbiAgICBjaHVua01vZHVsZXM6IHRydWUsXG4gICAgZXJyb3JEZXRhaWxzOiB0cnVlLFxuICAgIG1vZHVsZVRyYWNlOiB0cnVlLFxuICAgIGxvZ2dpbmc6ICd2ZXJib3NlJyxcbiAgICBtb2R1bGVzU3BhY2U6IEluZmluaXR5LFxuICB9O1xuXG4gIHJldHVybiB2ZXJib3NlXG4gICAgPyB7IC4uLndlYnBhY2tPdXRwdXRPcHRpb25zLCAuLi52ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnMgfVxuICAgIDogd2VicGFja091dHB1dE9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoXG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0LFxuICBwbGF0Zm9ybVNlcnZlcjogYm9vbGVhbixcbik6IFBpY2s8V2VicGFja09wdGlvbnNOb3JtYWxpemVkWydyZXNvbHZlJ10sICdtYWluRmllbGRzJyB8ICdjb25kaXRpb25OYW1lcyc+IHtcbiAgY29uc3QgbWFpbkZpZWxkcyA9IHBsYXRmb3JtU2VydmVyXG4gICAgPyBbJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddXG4gICAgOiBbJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ107XG4gIGNvbnN0IGNvbmRpdGlvbk5hbWVzID0gWydlczIwMTUnLCAnLi4uJ107XG5cbiAgaWYgKHRhcmdldCA+PSBTY3JpcHRUYXJnZXQuRVMyMDIwKSB7XG4gICAgbWFpbkZpZWxkcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgICBjb25kaXRpb25OYW1lcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbWFpbkZpZWxkcyxcbiAgICBjb25kaXRpb25OYW1lcyxcbiAgfTtcbn1cbiJdfQ==