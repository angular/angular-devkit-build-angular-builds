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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywyQkFBZ0M7QUFDaEMsZ0RBQXdCO0FBQ3hCLDJDQUE2QjtBQUM3QiwyQ0FBMEM7QUFFMUMsMERBS3VDO0FBRXZDLGlFQUFzRDtBQVN0RCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFhLEdBQUcsc0JBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUU7SUFDakYsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLE1BQU0sR0FBRyxDQUFDO0lBRWhELFFBQVEsYUFBYSxFQUFFO1FBQ3JCLEtBQUssT0FBTztZQUNWLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxFQUFFO2FBQ1gsQ0FBQztRQUNKLEtBQUssU0FBUztZQUNaLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixJQUFJLEVBQUUsRUFBRTtnQkFDUixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxLQUFLO1lBQ1IsT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxZQUFZO2dCQUNsQixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxNQUFNLENBQUM7UUFDWjtZQUNFLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFB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SztRQUNiLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLG1CQUFtQixFQUFFLElBQUk7UUFDekIsT0FBTyxFQUFFLElBQUk7UUFDYixRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxJQUFJO1FBQ1osT0FBTyxFQUFFLElBQUk7UUFDYixZQUFZLEVBQUUsSUFBSTtRQUNsQixZQUFZLEVBQUUsSUFBSTtRQUNsQixXQUFXLEVBQUUsSUFBSTtRQUNqQixPQUFPLEVBQUUsU0FBUztRQUNsQixZQUFZLEVBQUUsUUFBUTtLQUN2QixDQUFDO0lBRUYsT0FBTyxPQUFPO1FBQ1osQ0FBQyxDQUFDLEVBQUUsR0FBRyxvQkFBb0IsRUFBRSxHQUFHLDJCQUEyQixFQUFFO1FBQzdELENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztBQUMzQixDQUFDO0FBckNELDBDQXFDQztBQUVELFNBQWdCLDhCQUE4QixDQUM1QyxNQUFvQixFQUNwQixjQUF1QjtJQUV2QixNQUFNLFVBQVUsR0FBRyxjQUFjO1FBQy9CLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLE1BQU0sY0FBYyxHQUFHLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBRXpDLElBQUksTUFBTSxJQUFJLHlCQUFZLENBQUMsTUFBTSxFQUFFO1FBQ2pDLFVBQVUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0IsY0FBYyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNsQztJQUVELE9BQU87UUFDTCxVQUFVO1FBQ1YsY0FBYztLQUNmLENBQUM7QUFDSixDQUFDO0FBbEJELHdFQWtCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9iamVjdFBhdHRlcm4gfSBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb25maWd1cmF0aW9uLCBXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWQgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7XG4gIEFzc2V0UGF0dGVybkNsYXNzLFxuICBPdXRwdXRIYXNoaW5nLFxuICBTY3JpcHRFbGVtZW50LFxuICBTdHlsZUVsZW1lbnQsXG59IGZyb20gJy4uLy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS12ZXJzaW9uJztcblxuZXhwb3J0IGludGVyZmFjZSBIYXNoRm9ybWF0IHtcbiAgY2h1bms6IHN0cmluZztcbiAgZXh0cmFjdDogc3RyaW5nO1xuICBmaWxlOiBzdHJpbmc7XG4gIHNjcmlwdDogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3V0cHV0SGFzaEZvcm1hdChvdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lLCBsZW5ndGggPSAyMCk6IEhhc2hGb3JtYXQge1xuICBjb25zdCBoYXNoVGVtcGxhdGUgPSBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYDtcblxuICBzd2l0Y2ggKG91dHB1dEhhc2hpbmcpIHtcbiAgICBjYXNlICdtZWRpYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICAgIGNhc2UgJ2J1bmRsZXMnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ2FsbCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ25vbmUnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEVudHJ5UG9pbnQgPSBSZXF1aXJlZDxFeGNsdWRlPFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQsIHN0cmluZz4+O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgZXh0cmFFbnRyeVBvaW50czogKFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQpW10sXG4gIGRlZmF1bHRCdW5kbGVOYW1lOiBzdHJpbmcsXG4pOiBOb3JtYWxpemVkRW50cnlQb2ludFtdIHtcbiAgcmV0dXJuIGV4dHJhRW50cnlQb2ludHMubWFwKChlbnRyeSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBpbnB1dDogZW50cnksIGluamVjdDogdHJ1ZSwgYnVuZGxlTmFtZTogZGVmYXVsdEJ1bmRsZU5hbWUgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGluamVjdCA9IHRydWUsIC4uLm5ld0VudHJ5IH0gPSBlbnRyeTtcbiAgICBsZXQgYnVuZGxlTmFtZTtcbiAgICBpZiAoZW50cnkuYnVuZGxlTmFtZSkge1xuICAgICAgYnVuZGxlTmFtZSA9IGVudHJ5LmJ1bmRsZU5hbWU7XG4gICAgfSBlbHNlIGlmICghaW5qZWN0KSB7XG4gICAgICAvLyBMYXp5IGVudHJ5IHBvaW50cyB1c2UgdGhlIGZpbGUgbmFtZSBhcyBidW5kbGUgbmFtZS5cbiAgICAgIGJ1bmRsZU5hbWUgPSBwYXRoLnBhcnNlKGVudHJ5LmlucHV0KS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICBidW5kbGVOYW1lID0gZGVmYXVsdEJ1bmRsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4ubmV3RW50cnksIGluamVjdCwgYnVuZGxlTmFtZSB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0OiBIYXNoRm9ybWF0KTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmcge1xuICBjb25zdCB2aXNpdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIHJldHVybiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoaGFzaEZvcm1hdC5maWxlKSB7XG4gICAgICAvLyBGaWxlIG5hbWVzIGFyZSBoYXNoZWQgdGhlcmVmb3JlIHdlIGRvbid0IG5lZWQgdG8gaGFuZGxlIGZpbGVzIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lLlxuICAgICAgcmV0dXJuIGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShyZXNvdXJjZVBhdGgpO1xuICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIHdpdGggdGhlIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZC5cbiAgICBjb25zdCB2aXNpdGVkID0gdmlzaXRlZEZpbGVzLmdldChmaWxlbmFtZSk7XG4gICAgaWYgKCF2aXNpdGVkKSB7XG4gICAgICAvLyBOb3QgdmlzaXRlZC5cbiAgICAgIHZpc2l0ZWRGaWxlcy5zZXQoZmlsZW5hbWUsIHJlc291cmNlUGF0aCk7XG5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9IGVsc2UgaWYgKHZpc2l0ZWQgPT09IHJlc291cmNlUGF0aCkge1xuICAgICAgLy8gU2FtZSBmaWxlLlxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH1cblxuICAgIC8vIEZpbGUgaGFzIHRoZSBzYW1lIG5hbWUgYnV0IGl0J3MgaW4gYSBkaWZmZXJlbnQgbG9jYXRpb24uXG4gICAgcmV0dXJuICdbcGF0aF1bbmFtZV0uW2V4dF0nO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhcbiAgc291cmNlUm9vdDogc3RyaW5nLFxuICBleGNsdWRlZFBhdGhzOiBzdHJpbmdbXSxcbik6IFNldDxzdHJpbmc+IHtcbiAgY29uc3QgZXhjbHVkZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IGV4Y2x1ZGVHbG9iIG9mIGV4Y2x1ZGVkUGF0aHMpIHtcbiAgICBnbG9iXG4gICAgICAuc3luYyhwYXRoLmpvaW4oc291cmNlUm9vdCwgZXhjbHVkZUdsb2IpLCB7IG5vZGlyOiB0cnVlIH0pXG4gICAgICAuZm9yRWFjaCgocCkgPT4gZXhjbHVkZWQuYWRkKHBhdGgubm9ybWFsaXplKHApKSk7XG4gIH1cblxuICByZXR1cm4gZXhjbHVkZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDYWNoZVNldHRpbmdzKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBhbmd1bGFyVmVyc2lvbjogc3RyaW5nLFxuKTogV2VicGFja09wdGlvbnNOb3JtYWxpemVkWydjYWNoZSddIHtcbiAgY29uc3QgeyBlbmFibGVkLCBwYXRoOiBjYWNoZURpcmVjdG9yeSB9ID0gd2NvLmJ1aWxkT3B0aW9ucy5jYWNoZTtcbiAgaWYgKGVuYWJsZWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2ZpbGVzeXN0ZW0nLFxuICAgICAgcHJvZmlsZTogd2NvLmJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgY2FjaGVEaXJlY3Rvcnk6IHBhdGguam9pbihjYWNoZURpcmVjdG9yeSwgJ2FuZ3VsYXItd2VicGFjaycpLFxuICAgICAgbWF4TWVtb3J5R2VuZXJhdGlvbnM6IDEsXG4gICAgICAvLyBXZSB1c2UgdGhlIHZlcnNpb25zIGFuZCBidWlsZCBvcHRpb25zIGFzIHRoZSBjYWNoZSBuYW1lLiBUaGUgV2VicGFjayBjb25maWd1cmF0aW9ucyBhcmUgdG9vXG4gICAgICAvLyBkeW5hbWljIGFuZCBzaGFyZWQgYW1vbmcgZGlmZmVyZW50IGJ1aWxkIHR5cGVzOiB0ZXN0LCBidWlsZCBhbmQgc2VydmUuXG4gICAgICAvLyBOb25lIG9mIHdoaWNoIGFyZSBcIm5hbWVkXCIuXG4gICAgICBuYW1lOiBjcmVhdGVIYXNoKCdzaGExJylcbiAgICAgICAgLnVwZGF0ZShhbmd1bGFyVmVyc2lvbilcbiAgICAgICAgLnVwZGF0ZShWRVJTSU9OKVxuICAgICAgICAudXBkYXRlKHdjby5wcm9qZWN0Um9vdClcbiAgICAgICAgLnVwZGF0ZShKU09OLnN0cmluZ2lmeSh3Y28udHNDb25maWcpKVxuICAgICAgICAudXBkYXRlKFxuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLndjby5idWlsZE9wdGlvbnMsXG4gICAgICAgICAgICAvLyBOZWVkZWQgYmVjYXVzZSBvdXRwdXRQYXRoIGNoYW5nZXMgb24gZXZlcnkgYnVpbGQgd2hlbiB1c2luZyBpMThuIGV4dHJhY3Rpb25cbiAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2Jsb2IvNzM2YTVmODlkZWFjYTg1ZjQ4N2I3OGFlYzlmZjY2ZDQxMThjZWI2YS9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pMThuLW9wdGlvbnMudHMjTDI2NC1MMjY1XG4gICAgICAgICAgICBvdXRwdXRQYXRoOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSksXG4gICAgICAgIClcbiAgICAgICAgLmRpZ2VzdCgnaGV4JyksXG4gICAgfTtcbiAgfVxuXG4gIGlmICh3Y28uYnVpbGRPcHRpb25zLndhdGNoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdtZW1vcnknLFxuICAgICAgbWF4R2VuZXJhdGlvbnM6IDEsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gIHJvb3Q6IHN0cmluZyxcbiAgc2NyaXB0czogU2NyaXB0RWxlbWVudFtdLFxuKTogeyBidW5kbGVOYW1lOiBzdHJpbmc7IGluamVjdDogYm9vbGVhbjsgcGF0aHM6IHN0cmluZ1tdIH1bXSB7XG4gIHJldHVybiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHNjcmlwdHMsICdzY3JpcHRzJykucmVkdWNlKFxuICAgIChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgcGF0aHM6IHN0cmluZ1tdOyBpbmplY3Q6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICBjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgaW5wdXQgfSA9IGN1cnI7XG4gICAgICBsZXQgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGlucHV0KTtcblxuICAgICAgaWYgKCFleGlzdHNTeW5jKHJlc29sdmVkUGF0aCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXNvbHZlZFBhdGggPSByZXF1aXJlLnJlc29sdmUoaW5wdXQsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTY3JpcHQgZmlsZSAke2lucHV0fSBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeSkge1xuICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5pbmplY3QgJiYgIWluamVjdCkge1xuICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7YnVuZGxlTmFtZX0gYnVuZGxlIGlzIG1peGluZyBpbmplY3RlZCBhbmQgbm9uLWluamVjdGVkIHNjcmlwdHMuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICBpbmplY3QsXG4gICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByZXY7XG4gICAgfSxcbiAgICBbXSxcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0UGF0dGVybnMocm9vdDogc3RyaW5nLCBhc3NldHM6IEFzc2V0UGF0dGVybkNsYXNzW10pIHtcbiAgcmV0dXJuIGFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5DbGFzcywgaW5kZXg6IG51bWJlcik6IE9iamVjdFBhdHRlcm4gPT4ge1xuICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItY29uc3RcbiAgICBsZXQgeyBpbnB1dCwgb3V0cHV0LCBpZ25vcmUgPSBbXSwgZ2xvYiB9ID0gYXNzZXQ7XG4gICAgaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICBpbnB1dCA9IGlucHV0LmVuZHNXaXRoKCcvJykgPyBpbnB1dCA6IGlucHV0ICsgJy8nO1xuICAgIG91dHB1dCA9IG91dHB1dC5lbmRzV2l0aCgnLycpID8gb3V0cHV0IDogb3V0cHV0ICsgJy8nO1xuXG4gICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRleHQ6IGlucHV0LFxuICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICB0bzogb3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICBmcm9tOiBnbG9iLFxuICAgICAgbm9FcnJvck9uTWlzc2luZzogdHJ1ZSxcbiAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgZ2xvYk9wdGlvbnM6IHtcbiAgICAgICAgZG90OiB0cnVlLFxuICAgICAgICBmb2xsb3dTeW1ib2xpY0xpbmtzOiAhIWFzc2V0LmZvbGxvd1N5bWxpbmtzLFxuICAgICAgICBpZ25vcmU6IFtcbiAgICAgICAgICAnLmdpdGtlZXAnLFxuICAgICAgICAgICcqKi8uRFNfU3RvcmUnLFxuICAgICAgICAgICcqKi9UaHVtYnMuZGInLFxuICAgICAgICAgIC8vIE5lZ2F0ZSBwYXR0ZXJucyBuZWVkcyB0byBiZSBhYnNvbHV0ZSBiZWNhdXNlIGNvcHktd2VicGFjay1wbHVnaW4gdXNlcyBhYnNvbHV0ZSBnbG9icyB3aGljaFxuICAgICAgICAgIC8vIGNhdXNlcyBuZWdhdGUgcGF0dGVybnMgbm90IHRvIG1hdGNoLlxuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jb3B5LXdlYnBhY2stcGx1Z2luL2lzc3Vlcy80OTgjaXNzdWVjb21tZW50LTYzOTMyNzkwOVxuICAgICAgICAgIC4uLmlnbm9yZSxcbiAgICAgICAgXS5tYXAoKGkpID0+IHBhdGgucG9zaXguam9pbihpbnB1dCwgaSkpLFxuICAgICAgfSxcbiAgICAgIHByaW9yaXR5OiBpbmRleCxcbiAgICB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVybmFsaXplUGFja2FnZXMoXG4gIGNvbnRleHQ6IHN0cmluZyxcbiAgcmVxdWVzdDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBjYWxsYmFjazogKGVycm9yPzogRXJyb3IsIHJlc3VsdD86IHN0cmluZykgPT4gdm9pZCxcbik6IHZvaWQge1xuICBpZiAoIXJlcXVlc3QpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBYnNvbHV0ZSAmIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgZXh0ZXJuYWxzXG4gIGlmIChyZXF1ZXN0LnN0YXJ0c1dpdGgoJy4nKSB8fCBwYXRoLmlzQWJzb2x1dGUocmVxdWVzdCkpIHtcbiAgICBjYWxsYmFjaygpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXF1aXJlLnJlc29sdmUocmVxdWVzdCwgeyBwYXRoczogW2NvbnRleHRdIH0pO1xuICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgcmVxdWVzdCk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIE5vZGUgY291bGRuJ3QgZmluZCBpdCwgc28gaXQgbXVzdCBiZSB1c2VyLWFsaWFzZWRcbiAgICBjYWxsYmFjaygpO1xuICB9XG59XG5cbnR5cGUgV2VicGFja1N0YXRzT3B0aW9ucyA9IEV4Y2x1ZGU8Q29uZmlndXJhdGlvblsnc3RhdHMnXSwgc3RyaW5nIHwgYm9vbGVhbj47XG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UgPSBmYWxzZSk6IFdlYnBhY2tTdGF0c09wdGlvbnMge1xuICBjb25zdCB3ZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICBhbGw6IGZhbHNlLCAvLyBGYWxsYmFjayB2YWx1ZSBmb3Igc3RhdHMgb3B0aW9ucyB3aGVuIGFuIG9wdGlvbiBpcyBub3QgZGVmaW5lZC4gSXQgaGFzIHByZWNlZGVuY2Ugb3ZlciBsb2NhbCB3ZWJwYWNrIGRlZmF1bHRzLlxuICAgIGNvbG9yczogdHJ1ZSxcbiAgICBoYXNoOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICB0aW1pbmdzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBjaHVua3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGJ1aWx0QXQ6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHdhcm5pbmdzOiB0cnVlLFxuICAgIGVycm9yczogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNhY2hlZEFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgZm9yIGJ1bmRsZSBzaXplIGNhbGN1bGF0b3JzXG5cbiAgICAvLyBOZWVkZWQgZm9yIG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwuXG4gICAgaWRzOiB0cnVlLFxuICAgIGVudHJ5cG9pbnRzOiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IHZlcmJvc2VXZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICAvLyBUaGUgdmVyYm9zZSBvdXRwdXQgd2lsbCBtb3N0IGxpa2VseSBiZSBwaXBlZCB0byBhIGZpbGUsIHNvIGNvbG9ycyBqdXN0IG1lc3MgaXQgdXAuXG4gICAgY29sb3JzOiBmYWxzZSxcbiAgICB1c2VkRXhwb3J0czogdHJ1ZSxcbiAgICBvcHRpbWl6YXRpb25CYWlsb3V0OiB0cnVlLFxuICAgIHJlYXNvbnM6IHRydWUsXG4gICAgY2hpbGRyZW46IHRydWUsXG4gICAgYXNzZXRzOiB0cnVlLFxuICAgIHZlcnNpb246IHRydWUsXG4gICAgY2h1bmtNb2R1bGVzOiB0cnVlLFxuICAgIGVycm9yRGV0YWlsczogdHJ1ZSxcbiAgICBtb2R1bGVUcmFjZTogdHJ1ZSxcbiAgICBsb2dnaW5nOiAndmVyYm9zZScsXG4gICAgbW9kdWxlc1NwYWNlOiBJbmZpbml0eSxcbiAgfTtcblxuICByZXR1cm4gdmVyYm9zZVxuICAgID8geyAuLi53ZWJwYWNrT3V0cHV0T3B0aW9ucywgLi4udmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zIH1cbiAgICA6IHdlYnBhY2tPdXRwdXRPcHRpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzKFxuICB0YXJnZXQ6IFNjcmlwdFRhcmdldCxcbiAgcGxhdGZvcm1TZXJ2ZXI6IGJvb2xlYW4sXG4pOiBQaWNrPFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZFsncmVzb2x2ZSddLCAnbWFpbkZpZWxkcycgfCAnY29uZGl0aW9uTmFtZXMnPiB7XG4gIGNvbnN0IG1haW5GaWVsZHMgPSBwbGF0Zm9ybVNlcnZlclxuICAgID8gWydlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXVxuICAgIDogWydlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddO1xuICBjb25zdCBjb25kaXRpb25OYW1lcyA9IFsnZXMyMDE1JywgJy4uLiddO1xuXG4gIGlmICh0YXJnZXQgPj0gU2NyaXB0VGFyZ2V0LkVTMjAyMCkge1xuICAgIG1haW5GaWVsZHMudW5zaGlmdCgnZXMyMDIwJyk7XG4gICAgY29uZGl0aW9uTmFtZXMudW5zaGlmdCgnZXMyMDIwJyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1haW5GaWVsZHMsXG4gICAgY29uZGl0aW9uTmFtZXMsXG4gIH07XG59XG4iXX0=