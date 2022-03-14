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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywyQkFBZ0M7QUFDaEMsZ0RBQXdCO0FBQ3hCLDJDQUE2QjtBQUM3QiwyQ0FBMEM7QUFFMUMsMERBS3VDO0FBRXZDLGlFQUFzRDtBQVN0RCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFhLEdBQUcsc0JBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUU7SUFDakYsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLE1BQU0sR0FBRyxDQUFDO0lBRWhELFFBQVEsYUFBYSxFQUFFO1FBQ3JCLEtBQUssT0FBTztZQUNWLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxFQUFFO2FBQ1gsQ0FBQztRQUNKLEtBQUssU0FBUztZQUNaLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixJQUFJLEVBQUUsRUFBRTtnQkFDUixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxLQUFLO1lBQ1IsT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxZQUFZO2dCQUNsQixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxNQUFNLENBQUM7UUFDWjtZQUNFLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFB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SztRQUNiLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLG1CQUFtQixFQUFFLElBQUk7UUFDekIsT0FBTyxFQUFFLElBQUk7UUFDYixRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxJQUFJO1FBQ1osT0FBTyxFQUFFLElBQUk7UUFDYixZQUFZLEVBQUUsSUFBSTtRQUNsQixZQUFZLEVBQUUsSUFBSTtRQUNsQixXQUFXLEVBQUUsSUFBSTtRQUNqQixPQUFPLEVBQUUsU0FBUztRQUNsQixZQUFZLEVBQUUsUUFBUTtLQUN2QixDQUFDO0lBRUYsT0FBTyxPQUFPO1FBQ1osQ0FBQyxDQUFDLEVBQUUsR0FBRyxvQkFBb0IsRUFBRSxHQUFHLDJCQUEyQixFQUFFO1FBQzdELENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztBQUMzQixDQUFDO0FBckNELDBDQXFDQztBQUVELFNBQWdCLDhCQUE4QixDQUM1QyxNQUFvQixFQUNwQixjQUF1QjtJQUV2QixNQUFNLFVBQVUsR0FBRyxjQUFjO1FBQy9CLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLE1BQU0sY0FBYyxHQUFHLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBRXpDLElBQUksTUFBTSxJQUFJLHlCQUFZLENBQUMsTUFBTSxFQUFFO1FBQ2pDLFVBQVUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0IsY0FBYyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNsQztJQUVELE9BQU87UUFDTCxVQUFVO1FBQ1YsY0FBYztLQUNmLENBQUM7QUFDSixDQUFDO0FBbEJELHdFQWtCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9iamVjdFBhdHRlcm4gfSBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb25maWd1cmF0aW9uLCBXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWQgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7XG4gIEFzc2V0UGF0dGVybkNsYXNzLFxuICBFeHRyYUVudHJ5UG9pbnQsXG4gIEV4dHJhRW50cnlQb2ludENsYXNzLFxuICBPdXRwdXRIYXNoaW5nLFxufSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtdmVyc2lvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFzaEZvcm1hdCB7XG4gIGNodW5rOiBzdHJpbmc7XG4gIGV4dHJhY3Q6IHN0cmluZztcbiAgZmlsZTogc3RyaW5nO1xuICBzY3JpcHQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE91dHB1dEhhc2hGb3JtYXQob3V0cHV0SGFzaGluZyA9IE91dHB1dEhhc2hpbmcuTm9uZSwgbGVuZ3RoID0gMjApOiBIYXNoRm9ybWF0IHtcbiAgY29uc3QgaGFzaFRlbXBsYXRlID0gYC5bY29udGVudGhhc2g6JHtsZW5ndGh9XWA7XG5cbiAgc3dpdGNoIChvdXRwdXRIYXNoaW5nKSB7XG4gICAgY2FzZSAnbWVkaWEnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6ICcnLFxuICAgICAgICBleHRyYWN0OiAnJyxcbiAgICAgICAgZmlsZTogaGFzaFRlbXBsYXRlLFxuICAgICAgICBzY3JpcHQ6ICcnLFxuICAgICAgfTtcbiAgICBjYXNlICdidW5kbGVzJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGV4dHJhY3Q6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZmlsZTogJycsXG4gICAgICAgIHNjcmlwdDogaGFzaFRlbXBsYXRlLFxuICAgICAgfTtcbiAgICBjYXNlICdhbGwnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogaGFzaFRlbXBsYXRlLFxuICAgICAgfTtcbiAgICBjYXNlICdub25lJzpcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6ICcnLFxuICAgICAgICBleHRyYWN0OiAnJyxcbiAgICAgICAgZmlsZTogJycsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRFbnRyeVBvaW50ID0gUmVxdWlyZWQ8RXh0cmFFbnRyeVBvaW50Q2xhc3M+O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgZXh0cmFFbnRyeVBvaW50czogRXh0cmFFbnRyeVBvaW50W10sXG4gIGRlZmF1bHRCdW5kbGVOYW1lOiBzdHJpbmcsXG4pOiBOb3JtYWxpemVkRW50cnlQb2ludFtdIHtcbiAgcmV0dXJuIGV4dHJhRW50cnlQb2ludHMubWFwKChlbnRyeSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBpbnB1dDogZW50cnksIGluamVjdDogdHJ1ZSwgYnVuZGxlTmFtZTogZGVmYXVsdEJ1bmRsZU5hbWUgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGluamVjdCA9IHRydWUsIC4uLm5ld0VudHJ5IH0gPSBlbnRyeTtcbiAgICBsZXQgYnVuZGxlTmFtZTtcbiAgICBpZiAoZW50cnkuYnVuZGxlTmFtZSkge1xuICAgICAgYnVuZGxlTmFtZSA9IGVudHJ5LmJ1bmRsZU5hbWU7XG4gICAgfSBlbHNlIGlmICghaW5qZWN0KSB7XG4gICAgICAvLyBMYXp5IGVudHJ5IHBvaW50cyB1c2UgdGhlIGZpbGUgbmFtZSBhcyBidW5kbGUgbmFtZS5cbiAgICAgIGJ1bmRsZU5hbWUgPSBwYXRoLnBhcnNlKGVudHJ5LmlucHV0KS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICBidW5kbGVOYW1lID0gZGVmYXVsdEJ1bmRsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4ubmV3RW50cnksIGluamVjdCwgYnVuZGxlTmFtZSB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0OiBIYXNoRm9ybWF0KTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmcge1xuICBjb25zdCB2aXNpdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIHJldHVybiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoaGFzaEZvcm1hdC5maWxlKSB7XG4gICAgICAvLyBGaWxlIG5hbWVzIGFyZSBoYXNoZWQgdGhlcmVmb3JlIHdlIGRvbid0IG5lZWQgdG8gaGFuZGxlIGZpbGVzIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lLlxuICAgICAgcmV0dXJuIGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShyZXNvdXJjZVBhdGgpO1xuICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIHdpdGggdGhlIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZC5cbiAgICBjb25zdCB2aXNpdGVkID0gdmlzaXRlZEZpbGVzLmdldChmaWxlbmFtZSk7XG4gICAgaWYgKCF2aXNpdGVkKSB7XG4gICAgICAvLyBOb3QgdmlzaXRlZC5cbiAgICAgIHZpc2l0ZWRGaWxlcy5zZXQoZmlsZW5hbWUsIHJlc291cmNlUGF0aCk7XG5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9IGVsc2UgaWYgKHZpc2l0ZWQgPT09IHJlc291cmNlUGF0aCkge1xuICAgICAgLy8gU2FtZSBmaWxlLlxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH1cblxuICAgIC8vIEZpbGUgaGFzIHRoZSBzYW1lIG5hbWUgYnV0IGl0J3MgaW4gYSBkaWZmZXJlbnQgbG9jYXRpb24uXG4gICAgcmV0dXJuICdbcGF0aF1bbmFtZV0uW2V4dF0nO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhcbiAgc291cmNlUm9vdDogc3RyaW5nLFxuICBleGNsdWRlZFBhdGhzOiBzdHJpbmdbXSxcbik6IFNldDxzdHJpbmc+IHtcbiAgY29uc3QgZXhjbHVkZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IGV4Y2x1ZGVHbG9iIG9mIGV4Y2x1ZGVkUGF0aHMpIHtcbiAgICBnbG9iXG4gICAgICAuc3luYyhwYXRoLmpvaW4oc291cmNlUm9vdCwgZXhjbHVkZUdsb2IpLCB7IG5vZGlyOiB0cnVlIH0pXG4gICAgICAuZm9yRWFjaCgocCkgPT4gZXhjbHVkZWQuYWRkKHBhdGgubm9ybWFsaXplKHApKSk7XG4gIH1cblxuICByZXR1cm4gZXhjbHVkZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDYWNoZVNldHRpbmdzKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zLFxuICBhbmd1bGFyVmVyc2lvbjogc3RyaW5nLFxuKTogV2VicGFja09wdGlvbnNOb3JtYWxpemVkWydjYWNoZSddIHtcbiAgY29uc3QgeyBlbmFibGVkLCBwYXRoOiBjYWNoZURpcmVjdG9yeSB9ID0gd2NvLmJ1aWxkT3B0aW9ucy5jYWNoZTtcbiAgaWYgKGVuYWJsZWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2ZpbGVzeXN0ZW0nLFxuICAgICAgcHJvZmlsZTogd2NvLmJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgY2FjaGVEaXJlY3Rvcnk6IHBhdGguam9pbihjYWNoZURpcmVjdG9yeSwgJ2FuZ3VsYXItd2VicGFjaycpLFxuICAgICAgbWF4TWVtb3J5R2VuZXJhdGlvbnM6IDEsXG4gICAgICAvLyBXZSB1c2UgdGhlIHZlcnNpb25zIGFuZCBidWlsZCBvcHRpb25zIGFzIHRoZSBjYWNoZSBuYW1lLiBUaGUgV2VicGFjayBjb25maWd1cmF0aW9ucyBhcmUgdG9vXG4gICAgICAvLyBkeW5hbWljIGFuZCBzaGFyZWQgYW1vbmcgZGlmZmVyZW50IGJ1aWxkIHR5cGVzOiB0ZXN0LCBidWlsZCBhbmQgc2VydmUuXG4gICAgICAvLyBOb25lIG9mIHdoaWNoIGFyZSBcIm5hbWVkXCIuXG4gICAgICBuYW1lOiBjcmVhdGVIYXNoKCdzaGExJylcbiAgICAgICAgLnVwZGF0ZShhbmd1bGFyVmVyc2lvbilcbiAgICAgICAgLnVwZGF0ZShWRVJTSU9OKVxuICAgICAgICAudXBkYXRlKHdjby5wcm9qZWN0Um9vdClcbiAgICAgICAgLnVwZGF0ZShKU09OLnN0cmluZ2lmeSh3Y28udHNDb25maWcpKVxuICAgICAgICAudXBkYXRlKFxuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLndjby5idWlsZE9wdGlvbnMsXG4gICAgICAgICAgICAvLyBOZWVkZWQgYmVjYXVzZSBvdXRwdXRQYXRoIGNoYW5nZXMgb24gZXZlcnkgYnVpbGQgd2hlbiB1c2luZyBpMThuIGV4dHJhY3Rpb25cbiAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2Jsb2IvNzM2YTVmODlkZWFjYTg1ZjQ4N2I3OGFlYzlmZjY2ZDQxMThjZWI2YS9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pMThuLW9wdGlvbnMudHMjTDI2NC1MMjY1XG4gICAgICAgICAgICBvdXRwdXRQYXRoOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSksXG4gICAgICAgIClcbiAgICAgICAgLmRpZ2VzdCgnaGV4JyksXG4gICAgfTtcbiAgfVxuXG4gIGlmICh3Y28uYnVpbGRPcHRpb25zLndhdGNoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdtZW1vcnknLFxuICAgICAgbWF4R2VuZXJhdGlvbnM6IDEsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gIHJvb3Q6IHN0cmluZyxcbiAgc2NyaXB0czogRXh0cmFFbnRyeVBvaW50W10sXG4pOiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgaW5qZWN0OiBib29sZWFuOyBwYXRoczogc3RyaW5nW10gfVtdIHtcbiAgcmV0dXJuIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc2NyaXB0cywgJ3NjcmlwdHMnKS5yZWR1Y2UoXG4gICAgKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nOyBwYXRoczogc3RyaW5nW107IGluamVjdDogYm9vbGVhbiB9W10sIGN1cnIpID0+IHtcbiAgICAgIGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBpbnB1dCB9ID0gY3VycjtcbiAgICAgIGxldCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpO1xuXG4gICAgICBpZiAoIWV4aXN0c1N5bmMocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc29sdmVkUGF0aCA9IHJlcXVpcmUucmVzb2x2ZShpbnB1dCwgeyBwYXRoczogW3Jvb3RdIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNjcmlwdCBmaWxlICR7aW5wdXR9IGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmluamVjdCAmJiAhaW5qZWN0KSB7XG4gICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtidW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGluamVjdGVkIGFuZCBub24taW5qZWN0ZWQgc2NyaXB0cy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgIGluamVjdCxcbiAgICAgICAgICBwYXRoczogW3Jlc29sdmVkUGF0aF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJldjtcbiAgICB9LFxuICAgIFtdLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXRQYXR0ZXJucyhyb290OiBzdHJpbmcsIGFzc2V0czogQXNzZXRQYXR0ZXJuQ2xhc3NbXSkge1xuICByZXR1cm4gYXNzZXRzLm1hcCgoYXNzZXQ6IEFzc2V0UGF0dGVybkNsYXNzLCBpbmRleDogbnVtYmVyKTogT2JqZWN0UGF0dGVybiA9PiB7XG4gICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHByZWZlci1jb25zdFxuICAgIGxldCB7IGlucHV0LCBvdXRwdXQsIGlnbm9yZSA9IFtdLCBnbG9iIH0gPSBhc3NldDtcbiAgICBpbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBpbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGlucHV0ID0gaW5wdXQuZW5kc1dpdGgoJy8nKSA/IGlucHV0IDogaW5wdXQgKyAnLyc7XG4gICAgb3V0cHV0ID0gb3V0cHV0LmVuZHNXaXRoKCcvJykgPyBvdXRwdXQgOiBvdXRwdXQgKyAnLyc7XG5cbiAgICBpZiAob3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGV4dDogaW5wdXQsXG4gICAgICAvLyBOb3cgd2UgcmVtb3ZlIHN0YXJ0aW5nIHNsYXNoIHRvIG1ha2UgV2VicGFjayBwbGFjZSBpdCBmcm9tIHRoZSBvdXRwdXQgcm9vdC5cbiAgICAgIHRvOiBvdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgIGZyb206IGdsb2IsXG4gICAgICBub0Vycm9yT25NaXNzaW5nOiB0cnVlLFxuICAgICAgZm9yY2U6IHRydWUsXG4gICAgICBnbG9iT3B0aW9uczoge1xuICAgICAgICBkb3Q6IHRydWUsXG4gICAgICAgIGZvbGxvd1N5bWJvbGljTGlua3M6ICEhYXNzZXQuZm9sbG93U3ltbGlua3MsXG4gICAgICAgIGlnbm9yZTogW1xuICAgICAgICAgICcuZ2l0a2VlcCcsXG4gICAgICAgICAgJyoqLy5EU19TdG9yZScsXG4gICAgICAgICAgJyoqL1RodW1icy5kYicsXG4gICAgICAgICAgLy8gTmVnYXRlIHBhdHRlcm5zIG5lZWRzIHRvIGJlIGFic29sdXRlIGJlY2F1c2UgY29weS13ZWJwYWNrLXBsdWdpbiB1c2VzIGFic29sdXRlIGdsb2JzIHdoaWNoXG4gICAgICAgICAgLy8gY2F1c2VzIG5lZ2F0ZSBwYXR0ZXJucyBub3QgdG8gbWF0Y2guXG4gICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL2NvcHktd2VicGFjay1wbHVnaW4vaXNzdWVzLzQ5OCNpc3N1ZWNvbW1lbnQtNjM5MzI3OTA5XG4gICAgICAgICAgLi4uaWdub3JlLFxuICAgICAgICBdLm1hcCgoaSkgPT4gcGF0aC5wb3NpeC5qb2luKGlucHV0LCBpKSksXG4gICAgICB9LFxuICAgICAgcHJpb3JpdHk6IGluZGV4LFxuICAgIH07XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0ZXJuYWxpemVQYWNrYWdlcyhcbiAgY29udGV4dDogc3RyaW5nLFxuICByZXF1ZXN0OiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGNhbGxiYWNrOiAoZXJyb3I/OiBFcnJvciwgcmVzdWx0Pzogc3RyaW5nKSA9PiB2b2lkLFxuKTogdm9pZCB7XG4gIGlmICghcmVxdWVzdCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEFic29sdXRlICYgUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBleHRlcm5hbHNcbiAgaWYgKHJlcXVlc3Quc3RhcnRzV2l0aCgnLicpIHx8IHBhdGguaXNBYnNvbHV0ZShyZXF1ZXN0KSkge1xuICAgIGNhbGxiYWNrKCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIHJlcXVpcmUucmVzb2x2ZShyZXF1ZXN0LCB7IHBhdGhzOiBbY29udGV4dF0gfSk7XG4gICAgY2FsbGJhY2sodW5kZWZpbmVkLCByZXF1ZXN0KTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gTm9kZSBjb3VsZG4ndCBmaW5kIGl0LCBzbyBpdCBtdXN0IGJlIHVzZXItYWxpYXNlZFxuICAgIGNhbGxiYWNrKCk7XG4gIH1cbn1cblxudHlwZSBXZWJwYWNrU3RhdHNPcHRpb25zID0gRXhjbHVkZTxDb25maWd1cmF0aW9uWydzdGF0cyddLCBzdHJpbmcgfCBib29sZWFuPjtcbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSA9IGZhbHNlKTogV2VicGFja1N0YXRzT3B0aW9ucyB7XG4gIGNvbnN0IHdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIGFsbDogZmFsc2UsIC8vIEZhbGxiYWNrIHZhbHVlIGZvciBzdGF0cyBvcHRpb25zIHdoZW4gYW4gb3B0aW9uIGlzIG5vdCBkZWZpbmVkLiBJdCBoYXMgcHJlY2VkZW5jZSBvdmVyIGxvY2FsIHdlYnBhY2sgZGVmYXVsdHMuXG4gICAgY29sb3JzOiB0cnVlLFxuICAgIGhhc2g6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHRpbWluZ3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNodW5rczogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgYnVpbHRBdDogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgd2FybmluZ3M6IHRydWUsXG4gICAgZXJyb3JzOiB0cnVlLFxuICAgIGFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgY2FjaGVkQXNzZXRzOiB0cnVlLCAvLyByZXF1aXJlZCBmb3IgYnVuZGxlIHNpemUgY2FsY3VsYXRvcnNcblxuICAgIC8vIE5lZWRlZCBmb3IgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbC5cbiAgICBpZHM6IHRydWUsXG4gICAgZW50cnlwb2ludHM6IHRydWUsXG4gIH07XG5cbiAgY29uc3QgdmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIC8vIFRoZSB2ZXJib3NlIG91dHB1dCB3aWxsIG1vc3QgbGlrZWx5IGJlIHBpcGVkIHRvIGEgZmlsZSwgc28gY29sb3JzIGp1c3QgbWVzcyBpdCB1cC5cbiAgICBjb2xvcnM6IGZhbHNlLFxuICAgIHVzZWRFeHBvcnRzOiB0cnVlLFxuICAgIG9wdGltaXphdGlvbkJhaWxvdXQ6IHRydWUsXG4gICAgcmVhc29uczogdHJ1ZSxcbiAgICBjaGlsZHJlbjogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsXG4gICAgdmVyc2lvbjogdHJ1ZSxcbiAgICBjaHVua01vZHVsZXM6IHRydWUsXG4gICAgZXJyb3JEZXRhaWxzOiB0cnVlLFxuICAgIG1vZHVsZVRyYWNlOiB0cnVlLFxuICAgIGxvZ2dpbmc6ICd2ZXJib3NlJyxcbiAgICBtb2R1bGVzU3BhY2U6IEluZmluaXR5LFxuICB9O1xuXG4gIHJldHVybiB2ZXJib3NlXG4gICAgPyB7IC4uLndlYnBhY2tPdXRwdXRPcHRpb25zLCAuLi52ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnMgfVxuICAgIDogd2VicGFja091dHB1dE9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoXG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0LFxuICBwbGF0Zm9ybVNlcnZlcjogYm9vbGVhbixcbik6IFBpY2s8V2VicGFja09wdGlvbnNOb3JtYWxpemVkWydyZXNvbHZlJ10sICdtYWluRmllbGRzJyB8ICdjb25kaXRpb25OYW1lcyc+IHtcbiAgY29uc3QgbWFpbkZpZWxkcyA9IHBsYXRmb3JtU2VydmVyXG4gICAgPyBbJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddXG4gICAgOiBbJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ107XG4gIGNvbnN0IGNvbmRpdGlvbk5hbWVzID0gWydlczIwMTUnLCAnLi4uJ107XG5cbiAgaWYgKHRhcmdldCA+PSBTY3JpcHRUYXJnZXQuRVMyMDIwKSB7XG4gICAgbWFpbkZpZWxkcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgICBjb25kaXRpb25OYW1lcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbWFpbkZpZWxkcyxcbiAgICBjb25kaXRpb25OYW1lcyxcbiAgfTtcbn1cbiJdfQ==