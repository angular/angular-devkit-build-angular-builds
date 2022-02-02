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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svdXRpbHMvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsbUNBQW9DO0FBQ3BDLDJCQUFnQztBQUNoQyxnREFBd0I7QUFDeEIsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUUxQywwREFLdUM7QUFFdkMsaUVBQXNEO0FBU3RELFNBQWdCLG1CQUFtQixDQUFDLGFBQWEsR0FBRyxzQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEdBQUcsRUFBRTtJQUNqRixNQUFNLFlBQVksR0FBRyxpQkFBaUIsTUFBTSxHQUFHLENBQUM7SUFFaEQsUUFBUSxhQUFhLEVBQUU7UUFDckIsS0FBSyxPQUFPO1lBQ1YsT0FBTztnQkFDTCxLQUFLLEVBQUUsRUFBRTtnQkFDVCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsTUFBTSxFQUFFLEVBQUU7YUFDWCxDQUFDO1FBQ0osS0FBSyxTQUFTO1lBQ1osT0FBTztnQkFDTCxLQUFLLEVBQUUsWUFBWTtnQkFDbkIsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLElBQUksRUFBRSxFQUFFO2dCQUNSLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7UUFDSixLQUFLLEtBQUs7WUFDUixPQUFPO2dCQUNMLEtBQUssRUFBRSxZQUFZO2dCQUNuQixPQUFPLEVBQUUsWUFBWTtnQkFDckIsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7UUFDSixLQUFLLE1BQU0sQ0FBQztRQUNaO1lBQ0UsT0FBTztnQkFDTCxLQUFLLEVBQUUsRUFBRTtnQkFDVCxPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVB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Q2IsV0FBVyxFQUFFLElBQUk7UUFDakIsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixPQUFPLEVBQUUsSUFBSTtRQUNiLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsSUFBSTtRQUNiLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFlBQVksRUFBRSxRQUFRO0tBQ3ZCLENBQUM7SUFFRixPQUFPLE9BQU87UUFDWixDQUFDLENBQUMsRUFBRSxHQUFHLG9CQUFvQixFQUFFLEdBQUcsMkJBQTJCLEVBQUU7UUFDN0QsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO0FBQzNCLENBQUM7QUFyQ0QsMENBcUNDO0FBRUQsU0FBZ0IsOEJBQThCLENBQzVDLE1BQW9CLEVBQ3BCLGNBQXVCO0lBRXZCLE1BQU0sVUFBVSxHQUFHLGNBQWM7UUFDL0IsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDOUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDNUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFFekMsSUFBSSxNQUFNLElBQUkseUJBQVksQ0FBQyxNQUFNLEVBQUU7UUFDakMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3QixjQUFjLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ2xDO0lBRUQsT0FBTztRQUNMLFVBQVU7UUFDVixjQUFjO0tBQ2YsQ0FBQztBQUNKLENBQUM7QUFsQkQsd0VBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT2JqZWN0UGF0dGVybiB9IGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIFdlYnBhY2tPcHRpb25zTm9ybWFsaXplZCB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgQXNzZXRQYXR0ZXJuQ2xhc3MsXG4gIE91dHB1dEhhc2hpbmcsXG4gIFNjcmlwdEVsZW1lbnQsXG4gIFN0eWxlRWxlbWVudCxcbn0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IFZFUlNJT04gfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLXZlcnNpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhc2hGb3JtYXQge1xuICBjaHVuazogc3RyaW5nO1xuICBleHRyYWN0OiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgc2NyaXB0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPdXRwdXRIYXNoRm9ybWF0KG91dHB1dEhhc2hpbmcgPSBPdXRwdXRIYXNoaW5nLk5vbmUsIGxlbmd0aCA9IDIwKTogSGFzaEZvcm1hdCB7XG4gIGNvbnN0IGhhc2hUZW1wbGF0ZSA9IGAuW2NvbnRlbnRoYXNoOiR7bGVuZ3RofV1gO1xuXG4gIHN3aXRjaCAob3V0cHV0SGFzaGluZykge1xuICAgIGNhc2UgJ21lZGlhJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiAnJyxcbiAgICAgICAgZXh0cmFjdDogJycsXG4gICAgICAgIGZpbGU6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgc2NyaXB0OiAnJyxcbiAgICAgIH07XG4gICAgY2FzZSAnYnVuZGxlcyc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjaHVuazogaGFzaFRlbXBsYXRlLFxuICAgICAgICBleHRyYWN0OiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGZpbGU6ICcnLFxuICAgICAgICBzY3JpcHQ6IGhhc2hUZW1wbGF0ZSxcbiAgICAgIH07XG4gICAgY2FzZSAnYWxsJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiBoYXNoVGVtcGxhdGUsXG4gICAgICAgIGV4dHJhY3Q6IGhhc2hUZW1wbGF0ZSxcbiAgICAgICAgZmlsZTogaGFzaFRlbXBsYXRlLFxuICAgICAgICBzY3JpcHQ6IGhhc2hUZW1wbGF0ZSxcbiAgICAgIH07XG4gICAgY2FzZSAnbm9uZSc6XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNodW5rOiAnJyxcbiAgICAgICAgZXh0cmFjdDogJycsXG4gICAgICAgIGZpbGU6ICcnLFxuICAgICAgICBzY3JpcHQ6ICcnLFxuICAgICAgfTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBOb3JtYWxpemVkRW50cnlQb2ludCA9IFJlcXVpcmVkPEV4Y2x1ZGU8U2NyaXB0RWxlbWVudCB8IFN0eWxlRWxlbWVudCwgc3RyaW5nPj47XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICBleHRyYUVudHJ5UG9pbnRzOiAoU2NyaXB0RWxlbWVudCB8IFN0eWxlRWxlbWVudClbXSxcbiAgZGVmYXVsdEJ1bmRsZU5hbWU6IHN0cmluZyxcbik6IE5vcm1hbGl6ZWRFbnRyeVBvaW50W10ge1xuICByZXR1cm4gZXh0cmFFbnRyeVBvaW50cy5tYXAoKGVudHJ5KSA9PiB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB7IGlucHV0OiBlbnRyeSwgaW5qZWN0OiB0cnVlLCBidW5kbGVOYW1lOiBkZWZhdWx0QnVuZGxlTmFtZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IHsgaW5qZWN0ID0gdHJ1ZSwgLi4ubmV3RW50cnkgfSA9IGVudHJ5O1xuICAgIGxldCBidW5kbGVOYW1lO1xuICAgIGlmIChlbnRyeS5idW5kbGVOYW1lKSB7XG4gICAgICBidW5kbGVOYW1lID0gZW50cnkuYnVuZGxlTmFtZTtcbiAgICB9IGVsc2UgaWYgKCFpbmplY3QpIHtcbiAgICAgIC8vIExhenkgZW50cnkgcG9pbnRzIHVzZSB0aGUgZmlsZSBuYW1lIGFzIGJ1bmRsZSBuYW1lLlxuICAgICAgYnVuZGxlTmFtZSA9IHBhdGgucGFyc2UoZW50cnkuaW5wdXQpLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1bmRsZU5hbWUgPSBkZWZhdWx0QnVuZGxlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5uZXdFbnRyeSwgaW5qZWN0LCBidW5kbGVOYW1lIH07XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQ6IEhhc2hGb3JtYXQpOiAocmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHN0cmluZyB7XG4gIGNvbnN0IHZpc2l0ZWRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgcmV0dXJuIChyZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgIGlmIChoYXNoRm9ybWF0LmZpbGUpIHtcbiAgICAgIC8vIEZpbGUgbmFtZXMgYXJlIGhhc2hlZCB0aGVyZWZvcmUgd2UgZG9uJ3QgbmVlZCB0byBoYW5kbGUgZmlsZXMgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUuXG4gICAgICByZXR1cm4gYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWA7XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKHJlc291cmNlUGF0aCk7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGZpbGUgd2l0aCB0aGUgc2FtZSBuYW1lIGhhcyBhbHJlYWR5IGJlZW4gcHJvY2Vzc2VkLlxuICAgIGNvbnN0IHZpc2l0ZWQgPSB2aXNpdGVkRmlsZXMuZ2V0KGZpbGVuYW1lKTtcbiAgICBpZiAoIXZpc2l0ZWQpIHtcbiAgICAgIC8vIE5vdCB2aXNpdGVkLlxuICAgICAgdmlzaXRlZEZpbGVzLnNldChmaWxlbmFtZSwgcmVzb3VyY2VQYXRoKTtcblxuICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgIH0gZWxzZSBpZiAodmlzaXRlZCA9PT0gcmVzb3VyY2VQYXRoKSB7XG4gICAgICAvLyBTYW1lIGZpbGUuXG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfVxuXG4gICAgLy8gRmlsZSBoYXMgdGhlIHNhbWUgbmFtZSBidXQgaXQncyBpbiBhIGRpZmZlcmVudCBsb2NhdGlvbi5cbiAgICByZXR1cm4gJ1twYXRoXVtuYW1lXS5bZXh0XSc7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzKFxuICBzb3VyY2VSb290OiBzdHJpbmcsXG4gIGV4Y2x1ZGVkUGF0aHM6IHN0cmluZ1tdLFxuKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCBleGNsdWRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgZXhjbHVkZUdsb2Igb2YgZXhjbHVkZWRQYXRocykge1xuICAgIGdsb2JcbiAgICAgIC5zeW5jKHBhdGguam9pbihzb3VyY2VSb290LCBleGNsdWRlR2xvYiksIHsgbm9kaXI6IHRydWUgfSlcbiAgICAgIC5mb3JFYWNoKChwKSA9PiBleGNsdWRlZC5hZGQocGF0aC5ub3JtYWxpemUocCkpKTtcbiAgfVxuXG4gIHJldHVybiBleGNsdWRlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENhY2hlU2V0dGluZ3MoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGFuZ3VsYXJWZXJzaW9uOiBzdHJpbmcsXG4pOiBXZWJwYWNrT3B0aW9uc05vcm1hbGl6ZWRbJ2NhY2hlJ10ge1xuICBjb25zdCB7IGVuYWJsZWQsIHBhdGg6IGNhY2hlRGlyZWN0b3J5IH0gPSB3Y28uYnVpbGRPcHRpb25zLmNhY2hlO1xuICBpZiAoZW5hYmxlZCkge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnZmlsZXN5c3RlbScsXG4gICAgICBwcm9maWxlOiB3Y28uYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICBjYWNoZURpcmVjdG9yeTogcGF0aC5qb2luKGNhY2hlRGlyZWN0b3J5LCAnYW5ndWxhci13ZWJwYWNrJyksXG4gICAgICBtYXhNZW1vcnlHZW5lcmF0aW9uczogMSxcbiAgICAgIC8vIFdlIHVzZSB0aGUgdmVyc2lvbnMgYW5kIGJ1aWxkIG9wdGlvbnMgYXMgdGhlIGNhY2hlIG5hbWUuIFRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb25zIGFyZSB0b29cbiAgICAgIC8vIGR5bmFtaWMgYW5kIHNoYXJlZCBhbW9uZyBkaWZmZXJlbnQgYnVpbGQgdHlwZXM6IHRlc3QsIGJ1aWxkIGFuZCBzZXJ2ZS5cbiAgICAgIC8vIE5vbmUgb2Ygd2hpY2ggYXJlIFwibmFtZWRcIi5cbiAgICAgIG5hbWU6IGNyZWF0ZUhhc2goJ3NoYTEnKVxuICAgICAgICAudXBkYXRlKGFuZ3VsYXJWZXJzaW9uKVxuICAgICAgICAudXBkYXRlKFZFUlNJT04pXG4gICAgICAgIC51cGRhdGUod2NvLnByb2plY3RSb290KVxuICAgICAgICAudXBkYXRlKEpTT04uc3RyaW5naWZ5KHdjby50c0NvbmZpZykpXG4gICAgICAgIC51cGRhdGUoXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ud2NvLmJ1aWxkT3B0aW9ucyxcbiAgICAgICAgICAgIC8vIE5lZWRlZCBiZWNhdXNlIG91dHB1dFBhdGggY2hhbmdlcyBvbiBldmVyeSBidWlsZCB3aGVuIHVzaW5nIGkxOG4gZXh0cmFjdGlvblxuICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvYmxvYi83MzZhNWY4OWRlYWNhODVmNDg3Yjc4YWVjOWZmNjZkNDExOGNlYjZhL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4tb3B0aW9ucy50cyNMMjY0LUwyNjVcbiAgICAgICAgICAgIG91dHB1dFBhdGg6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgKVxuICAgICAgICAuZGlnZXN0KCdoZXgnKSxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMud2F0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ21lbW9yeScsXG4gICAgICBtYXhHZW5lcmF0aW9uczogMSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgcm9vdDogc3RyaW5nLFxuICBzY3JpcHRzOiBTY3JpcHRFbGVtZW50W10sXG4pOiB7IGJ1bmRsZU5hbWU6IHN0cmluZzsgaW5qZWN0OiBib29sZWFuOyBwYXRoczogc3RyaW5nW10gfVtdIHtcbiAgcmV0dXJuIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc2NyaXB0cywgJ3NjcmlwdHMnKS5yZWR1Y2UoXG4gICAgKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nOyBwYXRoczogc3RyaW5nW107IGluamVjdDogYm9vbGVhbiB9W10sIGN1cnIpID0+IHtcbiAgICAgIGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBpbnB1dCB9ID0gY3VycjtcbiAgICAgIGxldCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgaW5wdXQpO1xuXG4gICAgICBpZiAoIWV4aXN0c1N5bmMocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc29sdmVkUGF0aCA9IHJlcXVpcmUucmVzb2x2ZShpbnB1dCwgeyBwYXRoczogW3Jvb3RdIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNjcmlwdCBmaWxlICR7aW5wdXR9IGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmluamVjdCAmJiAhaW5qZWN0KSB7XG4gICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtidW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGluamVjdGVkIGFuZCBub24taW5qZWN0ZWQgc2NyaXB0cy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgIGluamVjdCxcbiAgICAgICAgICBwYXRoczogW3Jlc29sdmVkUGF0aF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJldjtcbiAgICB9LFxuICAgIFtdLFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXRQYXR0ZXJucyhyb290OiBzdHJpbmcsIGFzc2V0czogQXNzZXRQYXR0ZXJuQ2xhc3NbXSkge1xuICByZXR1cm4gYXNzZXRzLm1hcCgoYXNzZXQ6IEFzc2V0UGF0dGVybkNsYXNzLCBpbmRleDogbnVtYmVyKTogT2JqZWN0UGF0dGVybiA9PiB7XG4gICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHByZWZlci1jb25zdFxuICAgIGxldCB7IGlucHV0LCBvdXRwdXQsIGlnbm9yZSA9IFtdLCBnbG9iIH0gPSBhc3NldDtcbiAgICBpbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBpbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIGlucHV0ID0gaW5wdXQuZW5kc1dpdGgoJy8nKSA/IGlucHV0IDogaW5wdXQgKyAnLyc7XG4gICAgb3V0cHV0ID0gb3V0cHV0LmVuZHNXaXRoKCcvJykgPyBvdXRwdXQgOiBvdXRwdXQgKyAnLyc7XG5cbiAgICBpZiAob3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGV4dDogaW5wdXQsXG4gICAgICAvLyBOb3cgd2UgcmVtb3ZlIHN0YXJ0aW5nIHNsYXNoIHRvIG1ha2UgV2VicGFjayBwbGFjZSBpdCBmcm9tIHRoZSBvdXRwdXQgcm9vdC5cbiAgICAgIHRvOiBvdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgIGZyb206IGdsb2IsXG4gICAgICBub0Vycm9yT25NaXNzaW5nOiB0cnVlLFxuICAgICAgZm9yY2U6IHRydWUsXG4gICAgICBnbG9iT3B0aW9uczoge1xuICAgICAgICBkb3Q6IHRydWUsXG4gICAgICAgIGZvbGxvd1N5bWJvbGljTGlua3M6ICEhYXNzZXQuZm9sbG93U3ltbGlua3MsXG4gICAgICAgIGlnbm9yZTogW1xuICAgICAgICAgICcuZ2l0a2VlcCcsXG4gICAgICAgICAgJyoqLy5EU19TdG9yZScsXG4gICAgICAgICAgJyoqL1RodW1icy5kYicsXG4gICAgICAgICAgLy8gTmVnYXRlIHBhdHRlcm5zIG5lZWRzIHRvIGJlIGFic29sdXRlIGJlY2F1c2UgY29weS13ZWJwYWNrLXBsdWdpbiB1c2VzIGFic29sdXRlIGdsb2JzIHdoaWNoXG4gICAgICAgICAgLy8gY2F1c2VzIG5lZ2F0ZSBwYXR0ZXJucyBub3QgdG8gbWF0Y2guXG4gICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL2NvcHktd2VicGFjay1wbHVnaW4vaXNzdWVzLzQ5OCNpc3N1ZWNvbW1lbnQtNjM5MzI3OTA5XG4gICAgICAgICAgLi4uaWdub3JlLFxuICAgICAgICBdLm1hcCgoaSkgPT4gcGF0aC5wb3NpeC5qb2luKGlucHV0LCBpKSksXG4gICAgICB9LFxuICAgICAgcHJpb3JpdHk6IGluZGV4LFxuICAgIH07XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0ZXJuYWxpemVQYWNrYWdlcyhcbiAgY29udGV4dDogc3RyaW5nLFxuICByZXF1ZXN0OiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGNhbGxiYWNrOiAoZXJyb3I/OiBFcnJvciwgcmVzdWx0Pzogc3RyaW5nKSA9PiB2b2lkLFxuKTogdm9pZCB7XG4gIGlmICghcmVxdWVzdCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEFic29sdXRlICYgUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBleHRlcm5hbHNcbiAgaWYgKHJlcXVlc3Quc3RhcnRzV2l0aCgnLicpIHx8IHBhdGguaXNBYnNvbHV0ZShyZXF1ZXN0KSkge1xuICAgIGNhbGxiYWNrKCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIHJlcXVpcmUucmVzb2x2ZShyZXF1ZXN0LCB7IHBhdGhzOiBbY29udGV4dF0gfSk7XG4gICAgY2FsbGJhY2sodW5kZWZpbmVkLCByZXF1ZXN0KTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gTm9kZSBjb3VsZG4ndCBmaW5kIGl0LCBzbyBpdCBtdXN0IGJlIHVzZXItYWxpYXNlZFxuICAgIGNhbGxiYWNrKCk7XG4gIH1cbn1cblxudHlwZSBXZWJwYWNrU3RhdHNPcHRpb25zID0gRXhjbHVkZTxDb25maWd1cmF0aW9uWydzdGF0cyddLCBzdHJpbmcgfCBib29sZWFuPjtcbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSA9IGZhbHNlKTogV2VicGFja1N0YXRzT3B0aW9ucyB7XG4gIGNvbnN0IHdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIGFsbDogZmFsc2UsIC8vIEZhbGxiYWNrIHZhbHVlIGZvciBzdGF0cyBvcHRpb25zIHdoZW4gYW4gb3B0aW9uIGlzIG5vdCBkZWZpbmVkLiBJdCBoYXMgcHJlY2VkZW5jZSBvdmVyIGxvY2FsIHdlYnBhY2sgZGVmYXVsdHMuXG4gICAgY29sb3JzOiB0cnVlLFxuICAgIGhhc2g6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIHRpbWluZ3M6IHRydWUsIC8vIHJlcXVpcmVkIGJ5IGN1c3RvbSBzdGF0IG91dHB1dFxuICAgIGNodW5rczogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgYnVpbHRBdDogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgd2FybmluZ3M6IHRydWUsXG4gICAgZXJyb3JzOiB0cnVlLFxuICAgIGFzc2V0czogdHJ1ZSwgLy8gcmVxdWlyZWQgYnkgY3VzdG9tIHN0YXQgb3V0cHV0XG4gICAgY2FjaGVkQXNzZXRzOiB0cnVlLCAvLyByZXF1aXJlZCBmb3IgYnVuZGxlIHNpemUgY2FsY3VsYXRvcnNcblxuICAgIC8vIE5lZWRlZCBmb3IgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbC5cbiAgICBpZHM6IHRydWUsXG4gICAgZW50cnlwb2ludHM6IHRydWUsXG4gIH07XG5cbiAgY29uc3QgdmVyYm9zZVdlYnBhY2tPdXRwdXRPcHRpb25zOiBXZWJwYWNrU3RhdHNPcHRpb25zID0ge1xuICAgIC8vIFRoZSB2ZXJib3NlIG91dHB1dCB3aWxsIG1vc3QgbGlrZWx5IGJlIHBpcGVkIHRvIGEgZmlsZSwgc28gY29sb3JzIGp1c3QgbWVzcyBpdCB1cC5cbiAgICBjb2xvcnM6IGZhbHNlLFxuICAgIHVzZWRFeHBvcnRzOiB0cnVlLFxuICAgIG9wdGltaXphdGlvbkJhaWxvdXQ6IHRydWUsXG4gICAgcmVhc29uczogdHJ1ZSxcbiAgICBjaGlsZHJlbjogdHJ1ZSxcbiAgICBhc3NldHM6IHRydWUsXG4gICAgdmVyc2lvbjogdHJ1ZSxcbiAgICBjaHVua01vZHVsZXM6IHRydWUsXG4gICAgZXJyb3JEZXRhaWxzOiB0cnVlLFxuICAgIG1vZHVsZVRyYWNlOiB0cnVlLFxuICAgIGxvZ2dpbmc6ICd2ZXJib3NlJyxcbiAgICBtb2R1bGVzU3BhY2U6IEluZmluaXR5LFxuICB9O1xuXG4gIHJldHVybiB2ZXJib3NlXG4gICAgPyB7IC4uLndlYnBhY2tPdXRwdXRPcHRpb25zLCAuLi52ZXJib3NlV2VicGFja091dHB1dE9wdGlvbnMgfVxuICAgIDogd2VicGFja091dHB1dE9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoXG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0LFxuICBwbGF0Zm9ybVNlcnZlcjogYm9vbGVhbixcbik6IFBpY2s8V2VicGFja09wdGlvbnNOb3JtYWxpemVkWydyZXNvbHZlJ10sICdtYWluRmllbGRzJyB8ICdjb25kaXRpb25OYW1lcyc+IHtcbiAgY29uc3QgbWFpbkZpZWxkcyA9IHBsYXRmb3JtU2VydmVyXG4gICAgPyBbJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddXG4gICAgOiBbJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ107XG4gIGNvbnN0IGNvbmRpdGlvbk5hbWVzID0gWydlczIwMTUnLCAnLi4uJ107XG5cbiAgaWYgKHRhcmdldCA+PSBTY3JpcHRUYXJnZXQuRVMyMDIwKSB7XG4gICAgbWFpbkZpZWxkcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgICBjb25kaXRpb25OYW1lcy51bnNoaWZ0KCdlczIwMjAnKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbWFpbkZpZWxkcyxcbiAgICBjb25kaXRpb25OYW1lcyxcbiAgfTtcbn1cbiJdfQ==