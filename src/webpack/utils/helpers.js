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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQywyQkFBZ0M7QUFDaEMsZ0RBQXdCO0FBQ3hCLDJDQUE2QjtBQUM3QiwyQ0FBMEM7QUFFMUMsMERBS3VDO0FBRXZDLGlFQUFzRDtBQVd0RCxTQUFnQixtQkFBbUIsQ0FBQyxhQUFhLEdBQUcsc0JBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUU7SUFDakYsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLE1BQU0sR0FBRyxDQUFDO0lBRWhELFFBQVEsYUFBYSxFQUFFO1FBQ3JCLEtBQUssT0FBTztZQUNWLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxFQUFFO2FBQ1gsQ0FBQztRQUNKLEtBQUssU0FBUztZQUNaLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLE9BQU8sRUFBRSxZQUFZO2dCQUNyQixJQUFJLEVBQUUsRUFBRTtnQkFDUixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxLQUFLO1lBQ1IsT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxZQUFZO2dCQUNsQixNQUFNLEVBQUUsWUFBWTthQUNyQixDQUFDO1FBQ0osS0FBSyxNQUFNLENBQUM7UUFDWjtZQUNFLE9BQU87Z0JBQ0wsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFB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IFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT2JqZWN0UGF0dGVybiB9IGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZCB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgQXNzZXRQYXR0ZXJuQ2xhc3MsXG4gIE91dHB1dEhhc2hpbmcsXG4gIFNjcmlwdEVsZW1lbnQsXG4gIFN0eWxlRWxlbWVudCxcbn0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLXZlcnNpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhc2hGb3JtYXQge1xuICBjaHVuazogc3RyaW5nO1xuICBleHRyYWN0OiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgc2NyaXB0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFdlYnBhY2tTdGF0c09wdGlvbnMgPSBFeGNsdWRlPENvbmZpZ3VyYXRpb25bJ3N0YXRzJ10sIHN0cmluZyB8IGJvb2xlYW4gfCB1bmRlZmluZWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3V0cHV0SGFzaEZvcm1hdChvdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lLCBsZW5ndGggPSAyMCk6IEhhc2hGb3JtYXQge1xuICBjb25zdCBoYXNoVGVtcGxhdGUgPSBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYDtcblxuICBzd2l0Y2ggKG91dHB1dEhhc2hpbmcpIHtcbiAgICBjYXNlICdtZWRpYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICAgIGNhc2UgJ2J1bmRsZXMnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ2FsbCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ25vbmUnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEVudHJ5UG9pbnQgPSBSZXF1aXJlZDxFeGNsdWRlPFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQsIHN0cmluZz4+O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgZXh0cmFFbnRyeVBvaW50czogKFNjcmlwdEVsZW1lbnQgfCBTdHlsZUVsZW1lbnQpW10sXG4gIGRlZmF1bHRCdW5kbGVOYW1lOiBzdHJpbmcsXG4pOiBOb3JtYWxpemVkRW50cnlQb2ludFtdIHtcbiAgcmV0dXJuIGV4dHJhRW50cnlQb2ludHMubWFwKChlbnRyeSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4geyBpbnB1dDogZW50cnksIGluamVjdDogdHJ1ZSwgYnVuZGxlTmFtZTogZGVmYXVsdEJ1bmRsZU5hbWUgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGluamVjdCA9IHRydWUsIC4uLm5ld0VudHJ5IH0gPSBlbnRyeTtcbiAgICBsZXQgYnVuZGxlTmFtZTtcbiAgICBpZiAoZW50cnkuYnVuZGxlTmFtZSkge1xuICAgICAgYnVuZGxlTmFtZSA9IGVudHJ5LmJ1bmRsZU5hbWU7XG4gICAgfSBlbHNlIGlmICghaW5qZWN0KSB7XG4gICAgICAvLyBMYXp5IGVudHJ5IHBvaW50cyB1c2UgdGhlIGZpbGUgbmFtZSBhcyBidW5kbGUgbmFtZS5cbiAgICAgIGJ1bmRsZU5hbWUgPSBwYXRoLnBhcnNlKGVudHJ5LmlucHV0KS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICBidW5kbGVOYW1lID0gZGVmYXVsdEJ1bmRsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4ubmV3RW50cnksIGluamVjdCwgYnVuZGxlTmFtZSB9O1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0OiBIYXNoRm9ybWF0KTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmcge1xuICBjb25zdCB2aXNpdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIHJldHVybiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoaGFzaEZvcm1hdC5maWxlKSB7XG4gICAgICAvLyBGaWxlIG5hbWVzIGFyZSBoYXNoZWQgdGhlcmVmb3JlIHdlIGRvbid0IG5lZWQgdG8gaGFuZGxlIGZpbGVzIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lLlxuICAgICAgcmV0dXJuIGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShyZXNvdXJjZVBhdGgpO1xuICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIHdpdGggdGhlIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZC5cbiAgICBjb25zdCB2aXNpdGVkID0gdmlzaXRlZEZpbGVzLmdldChmaWxlbmFtZSk7XG4gICAgaWYgKCF2aXNpdGVkKSB7XG4gICAgICAvLyBOb3QgdmlzaXRlZC5cbiAgICAgIHZpc2l0ZWRGaWxlcy5zZXQoZmlsZW5hbWUsIHJlc291cmNlUGF0aCk7XG5cbiAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICB9IGVsc2UgaWYgKHZpc2l0ZWQgPT09IHJlc291cmNlUGF0aCkge1xuICAgICAgLy8gU2FtZSBmaWxlLlxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH1cblxuICAgIC8vIEZpbGUgaGFzIHRoZSBzYW1lIG5hbWUgYnV0IGl0J3MgaW4gYSBkaWZmZXJlbnQgbG9jYXRpb24uXG4gICAgcmV0dXJuICdbcGF0aF1bbmFtZV0uW2V4dF0nO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhcbiAgcm9vdDogc3RyaW5nLFxuICBleGNsdWRlZFBhdGhzOiBzdHJpbmdbXSxcbik6IFNldDxzdHJpbmc+IHtcbiAgY29uc3QgZXhjbHVkZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IGV4Y2x1ZGVHbG9iIG9mIGV4Y2x1ZGVkUGF0aHMpIHtcbiAgICBnbG9iXG4gICAgICAuc3luYyhleGNsdWRlR2xvYiwgeyBub2RpcjogdHJ1ZSwgY3dkOiByb290LCByb290LCBub21vdW50OiB0cnVlIH0pXG4gICAgICAuZm9yRWFjaCgocCkgPT4gZXhjbHVkZWQuYWRkKHBhdGguam9pbihyb290LCBwKSkpO1xuICB9XG5cbiAgcmV0dXJuIGV4Y2x1ZGVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2FjaGVTZXR0aW5ncyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbiAgYW5ndWxhclZlcnNpb246IHN0cmluZyxcbik6IFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZFsnY2FjaGUnXSB7XG4gIGNvbnN0IHsgZW5hYmxlZCwgcGF0aDogY2FjaGVEaXJlY3RvcnkgfSA9IHdjby5idWlsZE9wdGlvbnMuY2FjaGU7XG4gIGlmIChlbmFibGVkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdmaWxlc3lzdGVtJyxcbiAgICAgIHByb2ZpbGU6IHdjby5idWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgIGNhY2hlRGlyZWN0b3J5OiBwYXRoLmpvaW4oY2FjaGVEaXJlY3RvcnksICdhbmd1bGFyLXdlYnBhY2snKSxcbiAgICAgIG1heE1lbW9yeUdlbmVyYXRpb25zOiAxLFxuICAgICAgLy8gV2UgdXNlIHRoZSB2ZXJzaW9ucyBhbmQgYnVpbGQgb3B0aW9ucyBhcyB0aGUgY2FjaGUgbmFtZS4gVGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbnMgYXJlIHRvb1xuICAgICAgLy8gZHluYW1pYyBhbmQgc2hhcmVkIGFtb25nIGRpZmZlcmVudCBidWlsZCB0eXBlczogdGVzdCwgYnVpbGQgYW5kIHNlcnZlLlxuICAgICAgLy8gTm9uZSBvZiB3aGljaCBhcmUgXCJuYW1lZFwiLlxuICAgICAgbmFtZTogY3JlYXRlSGFzaCgnc2hhMScpXG4gICAgICAgIC51cGRhdGUoYW5ndWxhclZlcnNpb24pXG4gICAgICAgIC51cGRhdGUoVkVSU0lPTilcbiAgICAgICAgLnVwZGF0ZSh3Y28ucHJvamVjdFJvb3QpXG4gICAgICAgIC51cGRhdGUoSlNPTi5zdHJpbmdpZnkod2NvLnRzQ29uZmlnKSlcbiAgICAgICAgLnVwZGF0ZShcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi53Y28uYnVpbGRPcHRpb25zLFxuICAgICAgICAgICAgLy8gTmVlZGVkIGJlY2F1c2Ugb3V0cHV0UGF0aCBjaGFuZ2VzIG9uIGV2ZXJ5IGJ1aWxkIHdoZW4gdXNpbmcgaTE4biBleHRyYWN0aW9uXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9ibG9iLzczNmE1Zjg5ZGVhY2E4NWY0ODdiNzhhZWM5ZmY2NmQ0MTE4Y2ViNmEvcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaTE4bi1vcHRpb25zLnRzI0wyNjQtTDI2NVxuICAgICAgICAgICAgb3V0cHV0UGF0aDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pLFxuICAgICAgICApXG4gICAgICAgIC5kaWdlc3QoJ2hleCcpLFxuICAgIH07XG4gIH1cblxuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy53YXRjaCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnbWVtb3J5JyxcbiAgICAgIG1heEdlbmVyYXRpb25zOiAxLFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKFxuICByb290OiBzdHJpbmcsXG4gIHNjcmlwdHM6IFNjcmlwdEVsZW1lbnRbXSxcbik6IHsgYnVuZGxlTmFtZTogc3RyaW5nOyBpbmplY3Q6IGJvb2xlYW47IHBhdGhzOiBzdHJpbmdbXSB9W10ge1xuICByZXR1cm4gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzY3JpcHRzLCAnc2NyaXB0cycpLnJlZHVjZShcbiAgICAocHJldjogeyBidW5kbGVOYW1lOiBzdHJpbmc7IHBhdGhzOiBzdHJpbmdbXTsgaW5qZWN0OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIGlucHV0IH0gPSBjdXJyO1xuICAgICAgbGV0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBpbnB1dCk7XG5cbiAgICAgIGlmICghZXhpc3RzU3luYyhyZXNvbHZlZFBhdGgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzb2x2ZWRQYXRoID0gcmVxdWlyZS5yZXNvbHZlKGlucHV0LCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2NyaXB0IGZpbGUgJHtpbnB1dH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeSA9IHByZXYuZmluZCgoZWwpID0+IGVsLmJ1bmRsZU5hbWUgPT09IGJ1bmRsZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkuaW5qZWN0ICYmICFpbmplY3QpIHtcbiAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAke2J1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgaW5qZWN0ZWQgYW5kIG5vbi1pbmplY3RlZCBzY3JpcHRzLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgaW5qZWN0LFxuICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcmV2O1xuICAgIH0sXG4gICAgW10sXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NldFBhdHRlcm5zKHJvb3Q6IHN0cmluZywgYXNzZXRzOiBBc3NldFBhdHRlcm5DbGFzc1tdKSB7XG4gIHJldHVybiBhc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuQ2xhc3MsIGluZGV4OiBudW1iZXIpOiBPYmplY3RQYXR0ZXJuID0+IHtcbiAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcHJlZmVyLWNvbnN0XG4gICAgbGV0IHsgaW5wdXQsIG91dHB1dCwgaWdub3JlID0gW10sIGdsb2IgfSA9IGFzc2V0O1xuICAgIGlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgaW5wdXQgPSBpbnB1dC5lbmRzV2l0aCgnLycpID8gaW5wdXQgOiBpbnB1dCArICcvJztcbiAgICBvdXRwdXQgPSBvdXRwdXQuZW5kc1dpdGgoJy8nKSA/IG91dHB1dCA6IG91dHB1dCArICcvJztcblxuICAgIGlmIChvdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLicpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZXh0OiBpbnB1dCxcbiAgICAgIC8vIE5vdyB3ZSByZW1vdmUgc3RhcnRpbmcgc2xhc2ggdG8gbWFrZSBXZWJwYWNrIHBsYWNlIGl0IGZyb20gdGhlIG91dHB1dCByb290LlxuICAgICAgdG86IG91dHB1dC5yZXBsYWNlKC9eXFwvLywgJycpLFxuICAgICAgZnJvbTogZ2xvYixcbiAgICAgIG5vRXJyb3JPbk1pc3Npbmc6IHRydWUsXG4gICAgICBmb3JjZTogdHJ1ZSxcbiAgICAgIGdsb2JPcHRpb25zOiB7XG4gICAgICAgIGRvdDogdHJ1ZSxcbiAgICAgICAgZm9sbG93U3ltYm9saWNMaW5rczogISFhc3NldC5mb2xsb3dTeW1saW5rcyxcbiAgICAgICAgaWdub3JlOiBbXG4gICAgICAgICAgJy5naXRrZWVwJyxcbiAgICAgICAgICAnKiovLkRTX1N0b3JlJyxcbiAgICAgICAgICAnKiovVGh1bWJzLmRiJyxcbiAgICAgICAgICAvLyBOZWdhdGUgcGF0dGVybnMgbmVlZHMgdG8gYmUgYWJzb2x1dGUgYmVjYXVzZSBjb3B5LXdlYnBhY2stcGx1Z2luIHVzZXMgYWJzb2x1dGUgZ2xvYnMgd2hpY2hcbiAgICAgICAgICAvLyBjYXVzZXMgbmVnYXRlIHBhdHRlcm5zIG5vdCB0byBtYXRjaC5cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY29weS13ZWJwYWNrLXBsdWdpbi9pc3N1ZXMvNDk4I2lzc3VlY29tbWVudC02MzkzMjc5MDlcbiAgICAgICAgICAuLi5pZ25vcmUsXG4gICAgICAgIF0ubWFwKChpKSA9PiBwYXRoLnBvc2l4LmpvaW4oaW5wdXQsIGkpKSxcbiAgICAgIH0sXG4gICAgICBwcmlvcml0eTogaW5kZXgsXG4gICAgfTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRlcm5hbGl6ZVBhY2thZ2VzKFxuICBjb250ZXh0OiBzdHJpbmcsXG4gIHJlcXVlc3Q6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgY2FsbGJhY2s6IChlcnJvcj86IEVycm9yLCByZXN1bHQ/OiBzdHJpbmcpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQWJzb2x1dGUgJiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IGV4dGVybmFsc1xuICBpZiAocmVxdWVzdC5zdGFydHNXaXRoKCcuJykgfHwgcGF0aC5pc0Fic29sdXRlKHJlcXVlc3QpKSB7XG4gICAgY2FsbGJhY2soKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVxdWlyZS5yZXNvbHZlKHJlcXVlc3QsIHsgcGF0aHM6IFtjb250ZXh0XSB9KTtcbiAgICBjYWxsYmFjayh1bmRlZmluZWQsIHJlcXVlc3QpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBOb2RlIGNvdWxkbid0IGZpbmQgaXQsIHNvIGl0IG11c3QgYmUgdXNlci1hbGlhc2VkXG4gICAgY2FsbGJhY2soKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UgPSBmYWxzZSk6IFdlYnBhY2tTdGF0c09wdGlvbnMge1xuICBjb25zdCB3ZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICBhbGw6IGZhbHNlLCAvLyBGYWxsYmFjayB2YWx1ZSBmb3Igc3RhdHMgb3B0aW9ucyB3aGVuIGFuIG9wdGlvbiBpcyBub3QgZGVmaW5lZC4gSXQgaGFzIHByZWNlZGVuY2Ugb3ZlciBsb2NhbCB3ZWJwYWNrIGRlZmF1bHRzLlxuICAgIGNvbG9yczogdHJ1ZSxcbiAgICBoYXNoOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICB0aW1pbmdzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBjaHVua3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGJ1aWx0QXQ6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHdhcm5pbmdzOiB0cnVlLFxuICAgIGVycm9yczogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNhY2hlZEFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgZm9yIGJ1bmRsZSBzaXplIGNhbGN1bGF0b3JzXG5cbiAgICAvLyBOZWVkZWQgZm9yIG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwuXG4gICAgaWRzOiB0cnVlLFxuICAgIGVudHJ5cG9pbnRzOiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IHZlcmJvc2VXZWJwYWNrT3V0cHV0T3B0aW9uczogV2VicGFja1N0YXRzT3B0aW9ucyA9IHtcbiAgICAvLyBUaGUgdmVyYm9zZSBvdXRwdXQgd2lsbCBtb3N0IGxpa2VseSBiZSBwaXBlZCB0byBhIGZpbGUsIHNvIGNvbG9ycyBqdXN0IG1lc3MgaXQgdXAuXG4gICAgY29sb3JzOiBmYWxzZSxcbiAgICB1c2VkRXhwb3J0czogdHJ1ZSxcbiAgICBvcHRpbWl6YXRpb25CYWlsb3V0OiB0cnVlLFxuICAgIHJlYXNvbnM6IHRydWUsXG4gICAgY2hpbGRyZW46IHRydWUsXG4gICAgYXNzZXRzOiB0cnVlLFxuICAgIHZlcnNpb246IHRydWUsXG4gICAgY2h1bmtNb2R1bGVzOiB0cnVlLFxuICAgIGVycm9yRGV0YWlsczogdHJ1ZSxcbiAgICBlcnJvclN0YWNrOiB0cnVlLFxuICAgIG1vZHVsZVRyYWNlOiB0cnVlLFxuICAgIGxvZ2dpbmc6ICd2ZXJib3NlJyxcbiAgICBtb2R1bGVzU3BhY2U6IEluZmluaXR5LFxuICB9O1xuXG4gIHJldHVybiB2ZXJib3NlXG4gICAgPyB7IC4uLndlYnBhY2tPdXRwdXRPcHRpb25zLCAuLi52ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnMgfVxuICAgIDogd2VicGFja091dHB1dE9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoXG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0LFxuICBwbGF0Zm9ybVNlcnZlcjogYm9vbGVhbixcbik6IFBpY2s8V2VicGFja09wdGlvbnNOb3JtYWxpemVkWydyZXNvbHZlJ10sICdtYWluRmllbGRzJyB8ICdjb25kaXRpb25OYW1lcyc+IHtcbiAgY29uc3QgbWFpbkZpZWxkcyA9IHBsYXRmb3JtU2VydmVyXG4gICAgPyBbJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddXG4gICAgOiBbJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ107XG4gIGNvbnN0IGNvbmRpdGlvbk5hbWVzID0gWydlczIwMTUnLCAnLi4uJ107XG5cbiAgaWYgKHRhcmdldCA+PSBTY3JpcHRUYXJnZXQuRVMyMDIwKSB7XG4gICAgbWFpbkZpZWxkcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgICBjb25kaXRpb25OYW1lcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbWFpbkZpZWxkcyxcbiAgICBjb25kaXRpb25OYW1lcyxcbiAgfTtcbn1cbiJdfQ==