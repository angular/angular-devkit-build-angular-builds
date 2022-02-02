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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsbUNBQW9DO0FBQ3BDLDJCQUFnQztBQUNoQyxnREFBd0I7QUFDeEIsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUUxQywwREFLdUM7QUFFdkMsaUVBQXNEO0FBU3RELFNBQWdCLG1CQUFtQixDQUFDLGFBQWEsR0FBRyxzQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEdBQUcsRUFBRTtJQUNqRixNQUFNLFlBQVksR0FBRyxpQkFBaUIsTUFBTSxHQUFHLENBQUM7SUFFaEQsUUFBUSxhQUFhLEVBQUU7UUFDckIsS0FBSyxPQUFPO1lBQ1YsT0FBTztnQkFDTCxLQUFLLEVBQUUsRUFBRTtnQkFDVCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsTUFBTSxFQUFFLEVBQUU7YUFDWCxDQUFDO1FBQ0osS0FBSyxTQUFTO1lBQ1osT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxFQUFFO2dCQUNSLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7UUFDSixLQUFLLEtBQUs7WUFDUixPQUFPO2dCQUNMLEtBQUssRUFBRSxZQUFZO2dCQUNuQixPQUFPLEVBQUUsWUFBWTtnQkFDckIsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7UUFDSixLQUFLLE1BQU0sQ0FBQztRQUNaO1lBQ0UsT0FBTztnQkFDTCxLQUFLLEVBQUUsRUFBRTtnQkFDVCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVB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Q2IsV0FBVyxFQUFFLElBQUk7UUFDakIsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixPQUFPLEVBQUUsSUFBSTtRQUNiLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsSUFBSTtRQUNiLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFlBQVksRUFBRSxRQUFRO0tBQ3ZCLENBQUM7SUFFRixPQUFPLE9BQU87UUFDWixDQUFDLENBQUMsRUFBRSxHQUFHLG9CQUFvQixFQUFFLEdBQUcsMkJBQTJCLEVBQUU7UUFDN0QsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO0FBQzNCLENBQUM7QUFyQ0QsMENBcUNDO0FBRUQsU0FBZ0IsOEJBQThCLENBQzVDLE1BQW9CLEVBQ3BCLGNBQXVCO0lBRXZCLE1BQU0sVUFBVSxHQUFHLGNBQWM7UUFDL0IsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDOUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDNUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFFekMsSUFBSSxNQUFNLElBQUkseUJBQVksQ0FBQyxNQUFNLEVBQUU7UUFDakMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3QixjQUFjLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ2xDO0lBRUQsT0FBTztRQUNMLFVBQVU7UUFDVixjQUFjO0tBQ2YsQ0FBQztBQUNKLENBQUM7QUFsQkQsd0VBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT2JqZWN0UGF0dGVybiB9IGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZCB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgQXNzZXRQYXR0ZXJuQ2xhc3MsXG4gIEV4dHJhRW50cnlQb2ludCxcbiAgRXh0cmFFbnRyeVBvaW50Q2xhc3MsXG4gIE91dHB1dEhhc2hpbmcsXG59IGZyb20gJy4uLy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS12ZXJzaW9uJztcblxuZXhwb3J0IGludGVyZmFjZSBIYXNoRm9ybWF0IHtcbiAgY2h1bms6IHN0cmluZztcbiAgZXh0cmFjdDogc3RyaW5nO1xuICBmaWxlOiBzdHJpbmc7XG4gIHNjcmlwdDogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3V0cHV0SGFzaEZvcm1hdChvdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lLCBsZW5ndGggPSAyMCk6IEhhc2hGb3JtYXQge1xuICBjb25zdCBoYXNoVGVtcGxhdGUgPSBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYDtcblxuICBzd2l0Y2ggKG91dHB1dEhhc2hpbmcpIHtcbiAgICBjYXNlICdtZWRpYSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIHNjcmlwdDogJycsXG4gICAgICB9O1xuICAgIGNhc2UgJ2J1bmRsZXMnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2h1bms6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZXh0cmFjdDogaGFzaFRlbXBsYXRlLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ2FsbCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiBoYXNoVGVtcGxhdGUsXG4gICAgICB9O1xuICAgIGNhc2UgJ25vbmUnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogJycsXG4gICAgICAgIGV4dHJhY3Q6ICcnLFxuICAgICAgICBmaWxlOiAnJyxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEVudHJ5UG9pbnQgPSBSZXF1aXJlZDxFeHRyYUVudHJ5UG9pbnRDbGFzcz47XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICBleHRyYUVudHJ5UG9pbnRzOiBFeHRyYUVudHJ5UG9pbnRbXSxcbiAgZGVmYXVsdEJ1bmRsZU5hbWU6IHN0cmluZyxcbik6IE5vcm1hbGl6ZWRFbnRyeVBvaW50W10ge1xuICByZXR1cm4gZXh0cmFFbnRyeVBvaW50cy5tYXAoKGVudHJ5KSA9PiB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB7IGlucHV0OiBlbnRyeSwgaW5qZWN0OiB0cnVlLCBidW5kbGVOYW1lOiBkZWZhdWx0QnVuZGxlTmFtZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IHsgaW5qZWN0ID0gdHJ1ZSwgLi4ubmV3RW50cnkgfSA9IGVudHJ5O1xuICAgIGxldCBidW5kbGVOYW1lO1xuICAgIGlmIChlbnRyeS5idW5kbGVOYW1lKSB7XG4gICAgICBidW5kbGVOYW1lID0gZW50cnkuYnVuZGxlTmFtZTtcbiAgICB9IGVsc2UgaWYgKCFpbmplY3QpIHtcbiAgICAgIC8vIExhenkgZW50cnkgcG9pbnRzIHVzZSB0aGUgZmlsZSBuYW1lIGFzIGJ1bmRsZSBuYW1lLlxuICAgICAgYnVuZGxlTmFtZSA9IHBhdGgucGFyc2UoZW50cnkuaW5wdXQpLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1bmRsZU5hbWUgPSBkZWZhdWx0QnVuZGxlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5uZXdFbnRyeSwgaW5qZWN0LCBidW5kbGVOYW1lIH07XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQ6IEhhc2hGb3JtYXQpOiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHN0cmluZyB7XG4gIGNvbnN0IHZpc2l0ZWRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgcmV0dXJuIChyZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgIGlmIChoYXNoRm9ybWF0LmZpbGUpIHtcbiAgICAgIC8vIEZpbGUgbmFtZXMgYXJlIGhhc2hlZCB0aGVyZWZvcmUgd2UgZG9uJ3QgbmVlZCB0byBoYW5kbGUgZmlsZXMgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUuXG4gICAgICByZXR1cm4gYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWA7XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKHJlc291cmNlUGF0aCk7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGZpbGUgd2l0aCB0aGUgc2FtZSBuYW1lIGhhcyBhbHJlYWR5IGJlZW4gcHJvY2Vzc2VkLlxuICAgIGNvbnN0IHZpc2l0ZWQgPSB2aXNpdGVkRmlsZXMuZ2V0KGZpbGVuYW1lKTtcbiAgICBpZiAoIXZpc2l0ZWQpIHtcbiAgICAgIC8vIE5vdCB2aXNpdGVkLlxuICAgICAgdmlzaXRlZEZpbGVzLnNldChmaWxlbmFtZSwgcmVzb3VyY2VQYXRoKTtcblxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH0gZWxzZSBpZiAodmlzaXRlZCA9PT0gcmVzb3VyY2VQYXRoKSB7XG4gICAgICAvLyBTYW1lIGZpbGUuXG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfVxuXG4gICAgLy8gRmlsZSBoYXMgdGhlIHNhbWUgbmFtZSBidXQgaXQncyBpbiBhIGRpZmZlcmVudCBsb2NhdGlvbi5cbiAgICByZXR1cm4gJ1twYXRoXVtuYW1lXS5bZXh0XSc7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzKFxuICBzb3VyY2VSb290OiBzdHJpbmcsXG4gIGV4Y2x1ZGVkUGF0aHM6IHN0cmluZ1tdLFxuKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCBleGNsdWRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgZXhjbHVkZUdsb2Igb2YgZXhjbHVkZWRQYXRocykge1xuICAgIGdsb2JcbiAgICAgIC5zeW5jKHBhdGguam9pbihzb3VyY2VSb290LCBleGNsdWRlR2xvYiksIHsgbm9kaXI6IHRydWUgfSlcbiAgICAgIC5mb3JFYWNoKChwKSA9PiBleGNsdWRlZC5hZGQocGF0aC5ub3JtYWxpemUocCkpKTtcbiAgfVxuXG4gIHJldHVybiBleGNsdWRlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENhY2hlU2V0dGluZ3MoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGFuZ3VsYXJWZXJzaW9uOiBzdHJpbmcsXG4pOiBXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWRbJ2NhY2hlJ10ge1xuICBjb25zdCB7IGVuYWJsZWQsIHBhdGg6IGNhY2hlRGlyZWN0b3J5IH0gPSB3Y28uYnVpbGRPcHRpb25zLmNhY2hlO1xuICBpZiAoZW5hYmxlZCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnZmlsZXN5c3RlbScsXG4gICAgICBwcm9maWxlOiB3Y28uYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICBjYWNoZURpcmVjdG9yeTogcGF0aC5qb2luKGNhY2hlRGlyZWN0b3J5LCAnYW5ndWxhci13ZWJwYWNrJyksXG4gICAgICBtYXhNZW1vcnlHZW5lcmF0aW9uczogMSxcbiAgICAgIC8vIFdlIHVzZSB0aGUgdmVyc2lvbnMgYW5kIGJ1aWxkIG9wdGlvbnMgYXMgdGhlIGNhY2hlIG5hbWUuIFRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb25zIGFyZSB0b29cbiAgICAgIC8vIGR5bmFtaWMgYW5kIHNoYXJlZCBhbW9uZyBkaWZmZXJlbnQgYnVpbGQgdHlwZXM6IHRlc3QsIGJ1aWxkIGFuZCBzZXJ2ZS5cbiAgICAgIC8vIE5vbmUgb2Ygd2hpY2ggYXJlIFwibmFtZWRcIi5cbiAgICAgIG5hbWU6IGNyZWF0ZUhhc2goJ3NoYTEnKVxuICAgICAgICAudXBkYXRlKGFuZ3VsYXJWZXJzaW9uKVxuICAgICAgICAudXBkYXRlKFZFUlNJT04pXG4gICAgICAgIC51cGRhdGUod2NvLnByb2plY3RSb290KVxuICAgICAgICAudXBkYXRlKEpTT04uc3RyaW5naWZ5KHdjby50c0NvbmZpZykpXG4gICAgICAgIC51cGRhdGUoXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ud2NvLmJ1aWxkT3B0aW9ucyxcbiAgICAgICAgICAgIC8vIE5lZWRlZCBiZWNhdXNlIG91dHB1dFBhdGggY2hhbmdlcyBvbiBldmVyeSBidWlsZCB3aGVuIHVzaW5nIGkxOG4gZXh0cmFjdGlvblxuICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvYmxvYi83MzZhNWY4OWRlYWNhODVmNDg3Yjc4YWVjOWZmNjZkNDExOGNlYjZhL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4tb3B0aW9ucy50cyNMMjY0LUwyNjVcbiAgICAgICAgICAgIG91dHB1dFBhdGg6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICAuZGlnZXN0KCdoZXgnKSxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMud2F0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ21lbW9yeScsXG4gICAgICBtYXhHZW5lcmF0aW9uczogMSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgcm9vdDogc3RyaW5nLFxuICBzY3JpcHRzOiBFeHRyYUVudHJ5UG9pbnRbXSxcbik6IHsgYnVuZGxlTmFtZTogc3RyaW5nOyBpbmplY3Q6IGJvb2xlYW47IHBhdGhzOiBzdHJpbmdbXSB9W10ge1xuICByZXR1cm4gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzY3JpcHRzLCAnc2NyaXB0cycpLnJlZHVjZShcbiAgICAocHJldjogeyBidW5kbGVOYW1lOiBzdHJpbmc7IHBhdGhzOiBzdHJpbmdbXTsgaW5qZWN0OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIGlucHV0IH0gPSBjdXJyO1xuICAgICAgbGV0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBpbnB1dCk7XG5cbiAgICAgIGlmICghZXhpc3RzU3luYyhyZXNvbHZlZFBhdGgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzb2x2ZWRQYXRoID0gcmVxdWlyZS5yZXNvbHZlKGlucHV0LCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2NyaXB0IGZpbGUgJHtpbnB1dH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeSA9IHByZXYuZmluZCgoZWwpID0+IGVsLmJ1bmRsZU5hbWUgPT09IGJ1bmRsZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkuaW5qZWN0ICYmICFpbmplY3QpIHtcbiAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAke2J1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgaW5qZWN0ZWQgYW5kIG5vbi1pbmplY3RlZCBzY3JpcHRzLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgaW5qZWN0LFxuICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcmV2O1xuICAgIH0sXG4gICAgW10sXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NldFBhdHRlcm5zKHJvb3Q6IHN0cmluZywgYXNzZXRzOiBBc3NldFBhdHRlcm5DbGFzc1tdKSB7XG4gIHJldHVybiBhc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuQ2xhc3MsIGluZGV4OiBudW1iZXIpOiBPYmplY3RQYXR0ZXJuID0+IHtcbiAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcHJlZmVyLWNvbnN0XG4gICAgbGV0IHsgaW5wdXQsIG91dHB1dCwgaWdub3JlID0gW10sIGdsb2IgfSA9IGFzc2V0O1xuICAgIGlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgaW5wdXQgPSBpbnB1dC5lbmRzV2l0aCgnLycpID8gaW5wdXQgOiBpbnB1dCArICcvJztcbiAgICBvdXRwdXQgPSBvdXRwdXQuZW5kc1dpdGgoJy8nKSA/IG91dHB1dCA6IG91dHB1dCArICcvJztcblxuICAgIGlmIChvdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLicpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZXh0OiBpbnB1dCxcbiAgICAgIC8vIE5vdyB3ZSByZW1vdmUgc3RhcnRpbmcgc2xhc2ggdG8gbWFrZSBXZWJwYWNrIHBsYWNlIGl0IGZyb20gdGhlIG91dHB1dCByb290LlxuICAgICAgdG86IG91dHB1dC5yZXBsYWNlKC9eXFwvLywgJycpLFxuICAgICAgZnJvbTogZ2xvYixcbiAgICAgIG5vRXJyb3JPbk1pc3Npbmc6IHRydWUsXG4gICAgICBmb3JjZTogdHJ1ZSxcbiAgICAgIGdsb2JPcHRpb25zOiB7XG4gICAgICAgIGRvdDogdHJ1ZSxcbiAgICAgICAgZm9sbG93U3ltYm9saWNMaW5rczogISFhc3NldC5mb2xsb3dTeW1saW5rcyxcbiAgICAgICAgaWdub3JlOiBbXG4gICAgICAgICAgJy5naXRrZWVwJyxcbiAgICAgICAgICAnKiovLkRTX1N0b3JlJyxcbiAgICAgICAgICAnKiovVGh1bWJzLmRiJyxcbiAgICAgICAgICAvLyBOZWdhdGUgcGF0dGVybnMgbmVlZHMgdG8gYmUgYWJzb2x1dGUgYmVjYXVzZSBjb3B5LXdlYnBhY2stcGx1Z2luIHVzZXMgYWJzb2x1dGUgZ2xvYnMgd2hpY2hcbiAgICAgICAgICAvLyBjYXVzZXMgbmVnYXRlIHBhdHRlcm5zIG5vdCB0byBtYXRjaC5cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY29weS13ZWJwYWNrLXBsdWdpbi9pc3N1ZXMvNDk4I2lzc3VlY29tbWVudC02MzkzMjc5MDlcbiAgICAgICAgICAuLi5pZ25vcmUsXG4gICAgICAgIF0ubWFwKChpKSA9PiBwYXRoLnBvc2l4LmpvaW4oaW5wdXQsIGkpKSxcbiAgICAgIH0sXG4gICAgICBwcmlvcml0eTogaW5kZXgsXG4gICAgfTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRlcm5hbGl6ZVBhY2thZ2VzKFxuICBjb250ZXh0OiBzdHJpbmcsXG4gIHJlcXVlc3Q6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgY2FsbGJhY2s6IChlcnJvcj86IEVycm9yLCByZXN1bHQ/OiBzdHJpbmcpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQWJzb2x1dGUgJiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IGV4dGVybmFsc1xuICBpZiAocmVxdWVzdC5zdGFydHNXaXRoKCcuJykgfHwgcGF0aC5pc0Fic29sdXRlKHJlcXVlc3QpKSB7XG4gICAgY2FsbGJhY2soKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVxdWlyZS5yZXNvbHZlKHJlcXVlc3QsIHsgcGF0aHM6IFtjb250ZXh0XSB9KTtcbiAgICBjYWxsYmFjayh1bmRlZmluZWQsIHJlcXVlc3QpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBOb2RlIGNvdWxkbid0IGZpbmQgaXQsIHNvIGl0IG11c3QgYmUgdXNlci1hbGlhc2VkXG4gICAgY2FsbGJhY2soKTtcbiAgfVxufVxuXG50eXBlIFdlYnBhY2tTdGF0c09wdGlvbnMgPSBFeGNsdWRlPENvbmZpZ3VyYXRpb25bJ3N0YXRzJ10sIHN0cmluZyB8IGJvb2xlYW4+O1xuZXhwb3J0IGZ1bmN0aW9uIGdldFN0YXRzT3B0aW9ucyh2ZXJib3NlID0gZmFsc2UpOiBXZWJwYWNrU3RhdHNPcHRpb25zIHtcbiAgY29uc3Qgd2VicGFja091dHB1dE9wdGlvbnM6IFdlYnBhY2tTdGF0c09wdGlvbnMgPSB7XG4gICAgYWxsOiBmYWxzZSwgLy8gRmFsbGJhY2sgdmFsdWUgZm9yIHN0YXRzIG9wdGlvbnMgd2hlbiBhbiBvcHRpb24gaXMgbm90IGRlZmluZWQuIEl0IGhhcyBwcmVjZWRlbmNlIG92ZXIgbG9jYWwgd2VicGFjayBkZWZhdWx0cy5cbiAgICBjb2xvcnM6IHRydWUsXG4gICAgaGFzaDogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgdGltaW5nczogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgY2h1bmtzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBidWlsdEF0OiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICB3YXJuaW5nczogdHJ1ZSxcbiAgICBlcnJvcnM6IHRydWUsXG4gICAgYXNzZXRzOiB0cnVlLCAvLyByZXF1aXJlZCBieSBjdXN0b20gc3RhdCBvdXRwdXRcbiAgICBjYWNoZWRBc3NldHM6IHRydWUsIC8vIHJlcXVpcmVkIGZvciBidW5kbGUgc2l6ZSBjYWxjdWxhdG9yc1xuXG4gICAgLy8gTmVlZGVkIGZvciBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsLlxuICAgIGlkczogdHJ1ZSxcbiAgICBlbnRyeXBvaW50czogdHJ1ZSxcbiAgfTtcblxuICBjb25zdCB2ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnM6IFdlYnBhY2tTdGF0c09wdGlvbnMgPSB7XG4gICAgLy8gVGhlIHZlcmJvc2Ugb3V0cHV0IHdpbGwgbW9zdCBsaWtlbHkgYmUgcGlwZWQgdG8gYSBmaWxlLCBzbyBjb2xvcnMganVzdCBtZXNzIGl0IHVwLlxuICAgIGNvbG9yczogZmFsc2UsXG4gICAgdXNlZEV4cG9ydHM6IHRydWUsXG4gICAgb3B0aW1pemF0aW9uQmFpbG91dDogdHJ1ZSxcbiAgICByZWFzb25zOiB0cnVlLFxuICAgIGNoaWxkcmVuOiB0cnVlLFxuICAgIGFzc2V0czogdHJ1ZSxcbiAgICB2ZXJzaW9uOiB0cnVlLFxuICAgIGNodW5rTW9kdWxlczogdHJ1ZSxcbiAgICBlcnJvckRldGFpbHM6IHRydWUsXG4gICAgbW9kdWxlVHJhY2U6IHRydWUsXG4gICAgbG9nZ2luZzogJ3ZlcmJvc2UnLFxuICAgIG1vZHVsZXNTcGFjZTogSW5maW5pdHksXG4gIH07XG5cbiAgcmV0dXJuIHZlcmJvc2VcbiAgICA/IHsgLi4ud2VicGFja091dHB1dE9wdGlvbnMsIC4uLnZlcmJvc2VXZWJwYWNrT3V0cHV0T3B0aW9ucyB9XG4gICAgOiB3ZWJwYWNrT3V0cHV0T3B0aW9ucztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1haW5GaWVsZHNBbmRDb25kaXRpb25OYW1lcyhcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQsXG4gIHBsYXRmb3JtU2VydmVyOiBib29sZWFuLFxuKTogUGljazxXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWRbJ3Jlc29sdmUnXSwgJ21haW5GaWVsZHMnIHwgJ2NvbmRpdGlvbk5hbWVzJz4ge1xuICBjb25zdCBtYWluRmllbGRzID0gcGxhdGZvcm1TZXJ2ZXJcbiAgICA/IFsnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ11cbiAgICA6IFsnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXTtcbiAgY29uc3QgY29uZGl0aW9uTmFtZXMgPSBbJ2VzMjAxNScsICcuLi4nXTtcblxuICBpZiAodGFyZ2V0ID49IFNjcmlwdFRhcmdldC5FUzIwMjApIHtcbiAgICBtYWluRmllbGRzLnVuc2hpZnQoJ2VzMjAyMCcpO1xuICAgIGNvbmRpdGlvbk5hbWVzLnVuc2hpZnQoJ2VzMjAyMCcpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtYWluRmllbGRzLFxuICAgIGNvbmRpdGlvbk5hbWVzLFxuICB9O1xufVxuIl19