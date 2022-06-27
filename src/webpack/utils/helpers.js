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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywyQkFBZ0M7QUFDaEMsZ0RBQXdCO0FBQ3hCLDJDQUE2QjtBQUM3QiwyQ0FBMEM7QUFFMUMsMERBS3VDO0FBRXZDLGlFQUFzRDtBQVd0RCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFhLEdBQUcsc0JBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUU7SUFDakYsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLE1BQU0sR0FBRyxDQUFDO0lBRWhELFFBQVEsYUFBYSxFQUFFO1FBQ3JCLEtBQUssT0FBTztZQUNWLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxFQUFFO2FBQ1gsQ0FBQztRQUNKLEtBQUssU0FBUztZQUNaLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixJQUFJLEVBQUUsRUFBRTtnQkFDUixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxLQUFLO1lBQ1IsT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxZQUFZO2dCQUNsQixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxNQUFNLENBQUM7UUFDWjtZQUNFLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFB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YixXQUFXLEVBQUUsSUFBSTtRQUNqQixtQkFBbUIsRUFBRSxJQUFJO1FBQ3pCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO1FBQ2IsWUFBWSxFQUFFLElBQUk7UUFDbEIsWUFBWSxFQUFFLElBQUk7UUFDbEIsVUFBVSxFQUFFLElBQUk7UUFDaEIsV0FBVyxFQUFFLElBQUk7UUFDakIsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLFFBQVE7S0FDdkIsQ0FBQztJQUVGLE9BQU8sT0FBTztRQUNaLENBQUMsQ0FBQyxFQUFFLEdBQUcsb0JBQW9CLEVBQUUsR0FBRywyQkFBMkIsRUFBRTtRQUM3RCxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDM0IsQ0FBQztBQXRDRCwwQ0FzQ0M7QUFFRCxTQUFnQiw4QkFBOEIsQ0FDNUMsTUFBb0IsRUFDcEIsY0FBdUI7SUFFdkIsTUFBTSxVQUFVLEdBQUcsY0FBYztRQUMvQixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUM5QixDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1QyxNQUFNLGNBQWMsR0FBRyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUV6QyxJQUFJLE1BQU0sSUFBSSx5QkFBWSxDQUFDLE1BQU0sRUFBRTtRQUNqQyxVQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdCLGNBQWMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbEM7SUFFRCxPQUFPO1FBQ0wsVUFBVTtRQUNWLGNBQWM7S0FDZixDQUFDO0FBQ0osQ0FBQztBQWxCRCx3RUFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPYmplY3RQYXR0ZXJuIH0gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29uZmlndXJhdGlvbiwgV2VicGFja09wdGlvbnNOb3JtYWxpemVkIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBBc3NldFBhdHRlcm5DbGFzcyxcbiAgT3V0cHV0SGFzaGluZyxcbiAgU2NyaXB0RWxlbWVudCxcbiAgU3R5bGVFbGVtZW50LFxufSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtdmVyc2lvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFzaEZvcm1hdCB7XG4gIGNodW5rOiBzdHJpbmc7XG4gIGV4dHJhY3Q6IHN0cmluZztcbiAgZmlsZTogc3RyaW5nO1xuICBzY3JpcHQ6IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgV2VicGFja1N0YXRzT3B0aW9ucyA9IEV4Y2x1ZGU8Q29uZmlndXJhdGlvblsnc3RhdHMnXSwgc3RyaW5nIHwgYm9vbGVhbiB8IHVuZGVmaW5lZD47XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPdXRwdXRIYXNoRm9ybWF0KG91dHB1dEhhc2hpbmcgPSBPdXRwdXRIYXNoaW5nLk5vbmUsIGxlbmd0aCA9IDIwKTogSGFzaEZvcm1hdCB7XG4gIGNvbnN0IGhhc2hUZW1wbGF0ZSA9IGAuW2NvbnRlbnRoYXNoOiR7bGVuZ3RofV1gO1xuXG4gIHN3aXRjaCAob3V0cHV0SGFzaGluZykge1xuICAgIGNhc2UgJ21lZGlhJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiAnJyxcbiAgICAgICAgZXh0cmFjdDogJycsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gICAgY2FzZSAnYnVuZGxlcyc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6ICcnLFxuICAgICAgICBzY3JpcHQ6IGhhc2hUZW1wbGF0ZSxcbiAgICAgIH07XG4gICAgY2FzZSAnYWxsJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGV4dHJhY3Q6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZmlsZTogaGFzaFRlbXBsYXRlLFxuICAgICAgICBzY3JpcHQ6IGhhc2hUZW1wbGF0ZSxcbiAgICAgIH07XG4gICAgY2FzZSAnbm9uZSc6XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiAnJyxcbiAgICAgICAgZXh0cmFjdDogJycsXG4gICAgICAgIGZpbGU6ICcnLFxuICAgICAgICBzY3JpcHQ6ICcnLFxuICAgICAgfTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBOb3JtYWxpemVkRW50cnlQb2ludCA9IFJlcXVpcmVkPEV4Y2x1ZGU8U2NyaXB0RWxlbWVudCB8IFN0eWxlRWxlbWVudCwgc3RyaW5nPj47XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICBleHRyYUVudHJ5UG9pbnRzOiAoU2NyaXB0RWxlbWVudCB8IFN0eWxlRWxlbWVudClbXSxcbiAgZGVmYXVsdEJ1bmRsZU5hbWU6IHN0cmluZyxcbik6IE5vcm1hbGl6ZWRFbnRyeVBvaW50W10ge1xuICByZXR1cm4gZXh0cmFFbnRyeVBvaW50cy5tYXAoKGVudHJ5KSA9PiB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB7IGlucHV0OiBlbnRyeSwgaW5qZWN0OiB0cnVlLCBidW5kbGVOYW1lOiBkZWZhdWx0QnVuZGxlTmFtZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IHsgaW5qZWN0ID0gdHJ1ZSwgLi4ubmV3RW50cnkgfSA9IGVudHJ5O1xuICAgIGxldCBidW5kbGVOYW1lO1xuICAgIGlmIChlbnRyeS5idW5kbGVOYW1lKSB7XG4gICAgICBidW5kbGVOYW1lID0gZW50cnkuYnVuZGxlTmFtZTtcbiAgICB9IGVsc2UgaWYgKCFpbmplY3QpIHtcbiAgICAgIC8vIExhenkgZW50cnkgcG9pbnRzIHVzZSB0aGUgZmlsZSBuYW1lIGFzIGJ1bmRsZSBuYW1lLlxuICAgICAgYnVuZGxlTmFtZSA9IHBhdGgucGFyc2UoZW50cnkuaW5wdXQpLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1bmRsZU5hbWUgPSBkZWZhdWx0QnVuZGxlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5uZXdFbnRyeSwgaW5qZWN0LCBidW5kbGVOYW1lIH07XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQ6IEhhc2hGb3JtYXQpOiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHN0cmluZyB7XG4gIGNvbnN0IHZpc2l0ZWRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgcmV0dXJuIChyZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgIGlmIChoYXNoRm9ybWF0LmZpbGUpIHtcbiAgICAgIC8vIEZpbGUgbmFtZXMgYXJlIGhhc2hlZCB0aGVyZWZvcmUgd2UgZG9uJ3QgbmVlZCB0byBoYW5kbGUgZmlsZXMgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUuXG4gICAgICByZXR1cm4gYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWA7XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKHJlc291cmNlUGF0aCk7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGZpbGUgd2l0aCB0aGUgc2FtZSBuYW1lIGhhcyBhbHJlYWR5IGJlZW4gcHJvY2Vzc2VkLlxuICAgIGNvbnN0IHZpc2l0ZWQgPSB2aXNpdGVkRmlsZXMuZ2V0KGZpbGVuYW1lKTtcbiAgICBpZiAoIXZpc2l0ZWQpIHtcbiAgICAgIC8vIE5vdCB2aXNpdGVkLlxuICAgICAgdmlzaXRlZEZpbGVzLnNldChmaWxlbmFtZSwgcmVzb3VyY2VQYXRoKTtcblxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH0gZWxzZSBpZiAodmlzaXRlZCA9PT0gcmVzb3VyY2VQYXRoKSB7XG4gICAgICAvLyBTYW1lIGZpbGUuXG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfVxuXG4gICAgLy8gRmlsZSBoYXMgdGhlIHNhbWUgbmFtZSBidXQgaXQncyBpbiBhIGRpZmZlcmVudCBsb2NhdGlvbi5cbiAgICByZXR1cm4gJ1twYXRoXVtuYW1lXS5bZXh0XSc7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzKFxuICBzb3VyY2VSb290OiBzdHJpbmcsXG4gIGV4Y2x1ZGVkUGF0aHM6IHN0cmluZ1tdLFxuKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCBleGNsdWRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgZXhjbHVkZUdsb2Igb2YgZXhjbHVkZWRQYXRocykge1xuICAgIGdsb2JcbiAgICAgIC5zeW5jKGV4Y2x1ZGVHbG9iLCB7IG5vZGlyOiB0cnVlLCBjd2Q6IHNvdXJjZVJvb3QgfSlcbiAgICAgIC5mb3JFYWNoKChwKSA9PiBleGNsdWRlZC5hZGQocGF0aC5qb2luKHNvdXJjZVJvb3QsIHApKSk7XG4gIH1cblxuICByZXR1cm4gZXhjbHVkZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDYWNoZVNldHRpbmdzKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBhbmd1bGFyVmVyc2lvbjogc3RyaW5nLFxuKTogV2VicGFja09wdGlvbnNOb3JtYWxpemVkWydjYWNoZSddIHtcbiAgY29uc3QgeyBlbmFibGVkLCBwYXRoOiBjYWNoZURpcmVjdG9yeSB9ID0gd2NvLmJ1aWxkT3B0aW9ucy5jYWNoZTtcbiAgaWYgKGVuYWJsZWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2ZpbGVzeXN0ZW0nLFxuICAgICAgcHJvZmlsZTogd2NvLmJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgY2FjaGVEaXJlY3Rvcnk6IHBhdGguam9pbihjYWNoZURpcmVjdG9yeSwgJ2FuZ3VsYXItd2VicGFjaycpLFxuICAgICAgbWF4TWVtb3J5R2VuZXJhdGlvbnM6IDEsXG4gICAgICAvLyBXZSB1c2UgdGhlIHZlcnNpb25zIGFuZCBidWlsZCBvcHRpb25zIGFzIHRoZSBjYWNoZSBuYW1lLiBUaGUgV2VicGFjayBjb25maWd1cmF0aW9ucyBhcmUgdG9vXG4gICAgICAvLyBkeW5hbWljIGFuZCBzaGFyZWQgYW1vbmcgZGlmZmVyZW50IGJ1aWxkIHR5cGVzOiB0ZXN0LCBidWlsZCBhbmQgc2VydmUuXG4gICAgICAvLyBOb25lIG9mIHdoaWNoIGFyZSBcIm5hbWVkXCIuXG4gICAgICBuYW1lOiBjcmVhdGVIYXNoKCdzaGExJylcbiAgICAgICAgLnVwZGF0ZShhbmd1bGFyVmVyc2lvbilcbiAgICAgICAgLnVwZGF0ZShWRVJTSU9OKVxuICAgICAgICAudXBkYXRlKHdjby5wcm9qZWN0Um9vdClcbiAgICAgICAgLnVwZGF0ZShKU09OLnN0cmluZ2lmeSh3Y28udHNDb25maWcpKVxuICAgICAgICAudXBkYXRlKFxuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLndjby5idWlsZE9wdGlvbnMsXG4gICAgICAgICAgICAvLyBOZWVkZWQgYmVjYXVzZSBvdXRwdXRQYXRoIGNoYW5nZXMgb24gZXZlcnkgYnVpbGQgd2hlbiB1c2luZyBpMThuIGV4dHJhY3Rpb25cbiAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2Jsb2IvNzM2YTVmODlkZWFjYTg1ZjQ4N2I3OGFlYzlmZjY2ZDQxMThjZWI2YS9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pMThuLW9wdGlvbnMudHMjTDI2NC1MMjY1XG4gICAgICAgICAgICBvdXRwdXRQYXRoOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSksXG4gICAgICAgIClcbiAgICAgICAgLmRpZ2VzdCgnaGV4JyksXG4gICAgfTtcbiAgfVxuXG4gIGlmICh3Y28uYnVpbGRPcHRpb25zLndhdGNoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdtZW1vcnknLFxuICAgICAgbWF4R2VuZXJhdGlvbnM6IDEsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gIHJvb3Q6IHN0cmluZyxcbiAgc2NyaXB0czogU2NyaXB0RWxlbWVudFtdLFxuKTogeyBidW5kbGVOYW1lOiBzdHJpbmc7IGluamVjdDogYm9vbGVhbjsgcGF0aHM6IHN0cmluZ1tdIH1bXSB7XG4gIHJldHVybiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHNjcmlwdHMsICdzY3JpcHRzJykucmVkdWNlKFxuICAgIChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgcGF0aHM6IHN0cmluZ1tdOyBpbmplY3Q6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICBjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgaW5wdXQgfSA9IGN1cnI7XG4gICAgICBsZXQgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGlucHV0KTtcblxuICAgICAgaWYgKCFleGlzdHNTeW5jKHJlc29sdmVkUGF0aCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXNvbHZlZFBhdGggPSByZXF1aXJlLnJlc29sdmUoaW5wdXQsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTY3JpcHQgZmlsZSAke2lucHV0fSBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeSkge1xuICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5pbmplY3QgJiYgIWluamVjdCkge1xuICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7YnVuZGxlTmFtZX0gYnVuZGxlIGlzIG1peGluZyBpbmplY3RlZCBhbmQgbm9uLWluamVjdGVkIHNjcmlwdHMuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICBpbmplY3QsXG4gICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByZXY7XG4gICAgfSxcbiAgICBbXSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0UGF0dGVybnMocm9vdDogc3RyaW5nLCBhc3NldHM6IEFzc2V0UGF0dGVybkNsYXNzW10pIHtcbiAgcmV0dXJuIGFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5DbGFzcywgaW5kZXg6IG51bWJlcik6IE9iamVjdFBhdHRlcm4gPT4ge1xuICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItY29uc3RcbiAgICBsZXQgeyBpbnB1dCwgb3V0cHV0LCBpZ25vcmUgPSBbXSwgZ2xvYiB9ID0gYXNzZXQ7XG4gICAgaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICBpbnB1dCA9IGlucHV0LmVuZHNXaXRoKCcvJykgPyBpbnB1dCA6IGlucHV0ICsgJy8nO1xuICAgIG91dHB1dCA9IG91dHB1dC5lbmRzV2l0aCgnLycpID8gb3V0cHV0IDogb3V0cHV0ICsgJy8nO1xuXG4gICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRleHQ6IGlucHV0LFxuICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICB0bzogb3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICBmcm9tOiBnbG9iLFxuICAgICAgbm9FcnJvck9uTWlzc2luZzogdHJ1ZSxcbiAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgZ2xvYk9wdGlvbnM6IHtcbiAgICAgICAgZG90OiB0cnVlLFxuICAgICAgICBmb2xsb3dTeW1ib2xpY0xpbmtzOiAhIWFzc2V0LmZvbGxvd1N5bWxpbmtzLFxuICAgICAgICBpZ25vcmU6IFtcbiAgICAgICAgICAnLmdpdGtlZXAnLFxuICAgICAgICAgICcqKi8uRFNfU3RvcmUnLFxuICAgICAgICAgICcqKi9UaHVtYnMuZGInLFxuICAgICAgICAgIC8vIE5lZ2F0ZSBwYXR0ZXJucyBuZWVkcyB0byBiZSBhYnNvbHV0ZSBiZWNhdXNlIGNvcHktd2VicGFjay1wbHVnaW4gdXNlcyBhYnNvbHV0ZSBnbG9icyB3aGljaFxuICAgICAgICAgIC8vIGNhdXNlcyBuZWdhdGUgcGF0dGVybnMgbm90IHRvIG1hdGNoLlxuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jb3B5LXdlYnBhY2stcGx1Z2luL2lzc3Vlcy80OTgjaXNzdWVjb21tZW50LTYzOTMyNzkwOVxuICAgICAgICAgIC4uLmlnbm9yZSxcbiAgICAgICAgXS5tYXAoKGkpID0+IHBhdGgucG9zaXguam9pbihpbnB1dCwgaSkpLFxuICAgICAgfSxcbiAgICAgIHByaW9yaXR5OiBpbmRleCxcbiAgICB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVybmFsaXplUGFja2FnZXMoXG4gIGNvbnRleHQ6IHN0cmluZyxcbiAgcmVxdWVzdDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBjYWxsYmFjazogKGVycm9yPzogRXJyb3IsIHJlc3VsdD86IHN0cmluZykgPT4gdm9pZCxcbik6IHZvaWQge1xuICBpZiAoIXJlcXVlc3QpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBYnNvbHV0ZSAmIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgZXh0ZXJuYWxzXG4gIGlmIChyZXF1ZXN0LnN0YXJ0c1dpdGgoJy4nKSB8fCBwYXRoLmlzQWJzb2x1dGUocmVxdWVzdCkpIHtcbiAgICBjYWxsYmFjaygpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXF1aXJlLnJlc29sdmUocmVxdWVzdCwgeyBwYXRoczogW2NvbnRleHRdIH0pO1xuICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgcmVxdWVzdCk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIE5vZGUgY291bGRuJ3QgZmluZCBpdCwgc28gaXQgbXVzdCBiZSB1c2VyLWFsaWFzZWRcbiAgICBjYWxsYmFjaygpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSA9IGZhbHNlKTogV2VicGFja1N0YXRzT3B0aW9ucyB7XG4gIGNvbnN0IHdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIGFsbDogZmFsc2UsIC8vIEZhbGxiYWNrIHZhbHVlIGZvciBzdGF0cyBvcHRpb25zIHdoZW4gYW4gb3B0aW9uIGlzIG5vdCBkZWZpbmVkLiBJdCBoYXMgcHJlY2VkZW5jZSBvdmVyIGxvY2FsIHdlYnBhY2sgZGVmYXVsdHMuXG4gICAgY29sb3JzOiB0cnVlLFxuICAgIGhhc2g6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHRpbWluZ3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNodW5rczogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgYnVpbHRBdDogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgd2FybmluZ3M6IHRydWUsXG4gICAgZXJyb3JzOiB0cnVlLFxuICAgIGFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgY2FjaGVkQXNzZXRzOiB0cnVlLCAvLyByZXF1aXJlZCBmb3IgYnVuZGxlIHNpemUgY2FsY3VsYXRvcnNcblxuICAgIC8vIE5lZWRlZCBmb3IgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbC5cbiAgICBpZHM6IHRydWUsXG4gICAgZW50cnlwb2ludHM6IHRydWUsXG4gIH07XG5cbiAgY29uc3QgdmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIC8vIFRoZSB2ZXJib3NlIG91dHB1dCB3aWxsIG1vc3QgbGlrZWx5IGJlIHBpcGVkIHRvIGEgZmlsZSwgc28gY29sb3JzIGp1c3QgbWVzcyBpdCB1cC5cbiAgICBjb2xvcnM6IGZhbHNlLFxuICAgIHVzZWRFeHBvcnRzOiB0cnVlLFxuICAgIG9wdGltaXphdGlvbkJhaWxvdXQ6IHRydWUsXG4gICAgcmVhc29uczogdHJ1ZSxcbiAgICBjaGlsZHJlbjogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsXG4gICAgdmVyc2lvbjogdHJ1ZSxcbiAgICBjaHVua01vZHVsZXM6IHRydWUsXG4gICAgZXJyb3JEZXRhaWxzOiB0cnVlLFxuICAgIGVycm9yU3RhY2s6IHRydWUsXG4gICAgbW9kdWxlVHJhY2U6IHRydWUsXG4gICAgbG9nZ2luZzogJ3ZlcmJvc2UnLFxuICAgIG1vZHVsZXNTcGFjZTogSW5maW5pdHksXG4gIH07XG5cbiAgcmV0dXJuIHZlcmJvc2VcbiAgICA/IHsgLi4ud2VicGFja091dHB1dE9wdGlvbnMsIC4uLnZlcmJvc2VXZWJwYWNrT3V0cHV0T3B0aW9ucyB9XG4gICAgOiB3ZWJwYWNrT3V0cHV0T3B0aW9ucztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1haW5GaWVsZHNBbmRDb25kaXRpb25OYW1lcyhcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQsXG4gIHBsYXRmb3JtU2VydmVyOiBib29sZWFuLFxuKTogUGljazxXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWRbJ3Jlc29sdmUnXSwgJ21haW5GaWVsZHMnIHwgJ2NvbmRpdGlvbk5hbWVzJz4ge1xuICBjb25zdCBtYWluRmllbGRzID0gcGxhdGZvcm1TZXJ2ZXJcbiAgICA/IFsnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ11cbiAgICA6IFsnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXTtcbiAgY29uc3QgY29uZGl0aW9uTmFtZXMgPSBbJ2VzMjAxNScsICcuLi4nXTtcblxuICBpZiAodGFyZ2V0ID49IFNjcmlwdFRhcmdldC5FUzIwMjApIHtcbiAgICBtYWluRmllbGRzLnVuc2hpZnQoJ2VzMjAyMCcpO1xuICAgIGNvbmRpdGlvbk5hbWVzLnVuc2hpZnQoJ2VzMjAyMCcpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtYWluRmllbGRzLFxuICAgIGNvbmRpdGlvbk5hbWVzLFxuICB9O1xufVxuIl19