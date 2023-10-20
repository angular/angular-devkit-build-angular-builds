"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaScriptOptimizerPlugin = void 0;
const piscina_1 = __importDefault(require("piscina"));
const environment_options_1 = require("../../../utils/environment-options");
const webpack_diagnostics_1 = require("../../../utils/webpack-diagnostics");
const utils_1 = require("../../esbuild/utils");
const esbuild_executor_1 = require("./esbuild-executor");
/**
 * The maximum number of Workers that will be created to execute optimize tasks.
 */
const MAX_OPTIMIZE_WORKERS = environment_options_1.maxWorkers;
/**
 * The name of the plugin provided to Webpack when tapping Webpack compiler hooks.
 */
const PLUGIN_NAME = 'angular-javascript-optimizer';
/**
 * A Webpack plugin that provides JavaScript optimization capabilities.
 *
 * The plugin uses both `esbuild` and `terser` to provide both fast and highly-optimized
 * code output. `esbuild` is used as an initial pass to remove the majority of unused code
 * as well as shorten identifiers. `terser` is then used as a secondary pass to apply
 * optimizations not yet implemented by `esbuild`.
 */
class JavaScriptOptimizerPlugin {
    options;
    targets;
    constructor(options) {
        this.options = options;
        if (options.supportedBrowsers) {
            this.targets = (0, utils_1.transformSupportedBrowsersToTargets)(options.supportedBrowsers);
        }
    }
    apply(compiler) {
        const { OriginalSource, SourceMapSource } = compiler.webpack.sources;
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            const logger = compilation.getLogger('build-angular.JavaScriptOptimizerPlugin');
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
            }, async (compilationAssets) => {
                logger.time('optimize js assets');
                const scriptsToOptimize = [];
                const cache = compilation.options.cache && compilation.getCache('JavaScriptOptimizerPlugin');
                // Analyze the compilation assets for scripts that require optimization
                for (const assetName of Object.keys(compilationAssets)) {
                    if (!assetName.endsWith('.js')) {
                        continue;
                    }
                    const scriptAsset = compilation.getAsset(assetName);
                    // Skip assets that have already been optimized or are verbatim copies (project assets)
                    if (!scriptAsset || scriptAsset.info.minimized || scriptAsset.info.copied) {
                        continue;
                    }
                    const { source: scriptAssetSource, name } = scriptAsset;
                    let cacheItem;
                    if (cache) {
                        const eTag = cache.getLazyHashedEtag(scriptAssetSource);
                        cacheItem = cache.getItemCache(name, eTag);
                        const cachedOutput = await cacheItem.getPromise();
                        if (cachedOutput) {
                            logger.debug(`${name} restored from cache`);
                            compilation.updateAsset(name, cachedOutput.source, (assetInfo) => ({
                                ...assetInfo,
                                minimized: true,
                            }));
                            continue;
                        }
                    }
                    const { source, map } = scriptAssetSource.sourceAndMap();
                    scriptsToOptimize.push({
                        name: scriptAsset.name,
                        code: typeof source === 'string' ? source : source.toString(),
                        map,
                        cacheItem,
                    });
                }
                if (scriptsToOptimize.length === 0) {
                    return;
                }
                // Ensure all replacement values are strings which is the expected type for esbuild
                let define;
                if (this.options.define) {
                    define = {};
                    for (const [key, value] of Object.entries(this.options.define)) {
                        define[key] = String(value);
                    }
                }
                // Setup the options used by all worker tasks
                const optimizeOptions = {
                    sourcemap: this.options.sourcemap,
                    define,
                    keepIdentifierNames: this.options.keepIdentifierNames,
                    target: this.targets,
                    removeLicenses: this.options.removeLicenses,
                    advanced: this.options.advanced,
                    // Perform a single native esbuild support check.
                    // This removes the need for each worker to perform the check which would
                    // otherwise require spawning a separate process per worker.
                    alwaysUseWasm: !(await esbuild_executor_1.EsbuildExecutor.hasNativeSupport()),
                };
                // Sort scripts so larger scripts start first - worker pool uses a FIFO queue
                scriptsToOptimize.sort((a, b) => a.code.length - b.code.length);
                // Initialize the task worker pool
                const workerPath = require.resolve('./javascript-optimizer-worker');
                const workerPool = new piscina_1.default({
                    filename: workerPath,
                    maxThreads: MAX_OPTIMIZE_WORKERS,
                });
                // Enqueue script optimization tasks and update compilation assets as the tasks complete
                try {
                    const tasks = [];
                    for (const { name, code, map, cacheItem } of scriptsToOptimize) {
                        logger.time(`optimize asset: ${name}`);
                        tasks.push(workerPool
                            .run({
                            asset: {
                                name,
                                code,
                                map,
                            },
                            options: optimizeOptions,
                        })
                            .then(async ({ code, name, map, errors }) => {
                            if (errors?.length) {
                                for (const error of errors) {
                                    (0, webpack_diagnostics_1.addError)(compilation, `Optimization error [${name}]: ${error}`);
                                }
                                return;
                            }
                            const optimizedAsset = map
                                ? new SourceMapSource(code, name, map)
                                : new OriginalSource(code, name);
                            compilation.updateAsset(name, optimizedAsset, (assetInfo) => ({
                                ...assetInfo,
                                minimized: true,
                            }));
                            logger.timeEnd(`optimize asset: ${name}`);
                            return cacheItem?.storePromise({
                                source: optimizedAsset,
                            });
                        }, (error) => {
                            (0, webpack_diagnostics_1.addError)(compilation, `Optimization error [${name}]: ${error.stack || error.message}`);
                        }));
                    }
                    await Promise.all(tasks);
                }
                finally {
                    void workerPool.destroy();
                }
                logger.timeEnd('optimize js assets');
            });
        });
    }
}
exports.JavaScriptOptimizerPlugin = JavaScriptOptimizerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1vcHRpbWl6ZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL2phdmFzY3JpcHQtb3B0aW1pemVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxzREFBOEI7QUFFOUIsNEVBQWdFO0FBQ2hFLDRFQUE4RDtBQUM5RCwrQ0FBMEU7QUFDMUUseURBQXFEO0FBR3JEOztHQUVHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxnQ0FBVSxDQUFDO0FBRXhDOztHQUVHO0FBQ0gsTUFBTSxXQUFXLEdBQUcsOEJBQThCLENBQUM7QUE2Q25EOzs7Ozs7O0dBT0c7QUFDSCxNQUFhLHlCQUF5QjtJQUdoQjtJQUZaLE9BQU8sQ0FBdUI7SUFFdEMsWUFBb0IsT0FBbUM7UUFBbkMsWUFBTyxHQUFQLE9BQU8sQ0FBNEI7UUFDckQsSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7WUFDN0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLDJDQUFtQyxFQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1NBQy9FO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixNQUFNLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBRXJFLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUMxRCxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7WUFFaEYsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUN4Qztn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O2lCQUMxQjt3QkFBUztvQkFDUixLQUFLLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztpQkFDM0I7Z0JBRUQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZDLENBQUMsQ0FDRixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFwS0QsOERBb0tDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBQaXNjaW5hIGZyb20gJ3Bpc2NpbmEnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlciwgc291cmNlcyB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgYWRkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBFc2J1aWxkRXhlY3V0b3IgfSBmcm9tICcuL2VzYnVpbGQtZXhlY3V0b3InO1xuaW1wb3J0IHR5cGUgeyBPcHRpbWl6ZVJlcXVlc3RPcHRpb25zIH0gZnJvbSAnLi9qYXZhc2NyaXB0LW9wdGltaXplci13b3JrZXInO1xuXG4vKipcbiAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBXb3JrZXJzIHRoYXQgd2lsbCBiZSBjcmVhdGVkIHRvIGV4ZWN1dGUgb3B0aW1pemUgdGFza3MuXG4gKi9cbmNvbnN0IE1BWF9PUFRJTUlaRV9XT1JLRVJTID0gbWF4V29ya2VycztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgcGx1Z2luIHByb3ZpZGVkIHRvIFdlYnBhY2sgd2hlbiB0YXBwaW5nIFdlYnBhY2sgY29tcGlsZXIgaG9va3MuXG4gKi9cbmNvbnN0IFBMVUdJTl9OQU1FID0gJ2FuZ3VsYXItamF2YXNjcmlwdC1vcHRpbWl6ZXInO1xuXG4vKipcbiAqIFRoZSBvcHRpb25zIHVzZWQgdG8gY29uZmlndXJlIHRoZSB7QGxpbmsgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbn0uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSmF2YVNjcmlwdE9wdGltaXplck9wdGlvbnMge1xuICAvKipcbiAgICogRW5hYmxlcyBhZHZhbmNlZCBvcHRpbWl6YXRpb25zIGluIHRoZSB1bmRlcmx5aW5nIEphdmFTY3JpcHQgb3B0aW1pemVycy5cbiAgICogVGhpcyBjdXJyZW50bHkgaW5jcmVhc2VzIHRoZSBgdGVyc2VyYCBwYXNzZXMgdG8gMiBhbmQgZW5hYmxlcyB0aGUgYHB1cmVfZ2V0dGVyc2BcbiAgICogb3B0aW9uIGZvciBgdGVyc2VyYC5cbiAgICovXG4gIGFkdmFuY2VkPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQW4gb2JqZWN0IHJlY29yZCBvZiBzdHJpbmcga2V5cyB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCB0aGVpciByZXNwZWN0aXZlIHZhbHVlcyB3aGVuIGZvdW5kXG4gICAqIHdpdGhpbiB0aGUgY29kZSBkdXJpbmcgb3B0aW1pemF0aW9uLlxuICAgKi9cbiAgZGVmaW5lOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuPjtcblxuICAvKipcbiAgICogRW5hYmxlcyB0aGUgZ2VuZXJhdGlvbiBvZiBhIHNvdXJjZW1hcCBkdXJpbmcgb3B0aW1pemF0aW9uLlxuICAgKiBUaGUgb3V0cHV0IHNvdXJjZW1hcCB3aWxsIGJlIGEgZnVsbCBzb3VyY2VtYXAgY29udGFpbmluZyB0aGUgbWVyZ2Ugb2YgdGhlIGlucHV0IHNvdXJjZW1hcCBhbmRcbiAgICogYWxsIGludGVybWVkaWF0ZSBzb3VyY2VtYXBzLlxuICAgKi9cbiAgc291cmNlbWFwPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQSBsaXN0IG9mIHN1cHBvcnRlZCBicm93c2VycyB0aGF0IGlzIHVzZWQgZm9yIG91dHB1dCBjb2RlLlxuICAgKi9cbiAgc3VwcG9ydGVkQnJvd3NlcnM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogRW5hYmxlcyB0aGUgcmV0ZW50aW9uIG9mIGlkZW50aWZpZXIgbmFtZXMgYW5kIGVuc3VyZXMgdGhhdCBmdW5jdGlvbiBhbmQgY2xhc3MgbmFtZXMgYXJlXG4gICAqIHByZXNlbnQgaW4gdGhlIG91dHB1dCBjb2RlLlxuICAgKlxuICAgKiAqKk5vdGUqKjogaW4gc29tZSBjYXNlcyBzeW1ib2xzIGFyZSBzdGlsbCByZW5hbWVkIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gICAqL1xuICBrZWVwSWRlbnRpZmllck5hbWVzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBFbmFibGVzIHRoZSByZW1vdmFsIG9mIGFsbCBsaWNlbnNlIGNvbW1lbnRzIGZyb20gdGhlIG91dHB1dCBjb2RlLlxuICAgKi9cbiAgcmVtb3ZlTGljZW5zZXM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgV2VicGFjayBwbHVnaW4gdGhhdCBwcm92aWRlcyBKYXZhU2NyaXB0IG9wdGltaXphdGlvbiBjYXBhYmlsaXRpZXMuXG4gKlxuICogVGhlIHBsdWdpbiB1c2VzIGJvdGggYGVzYnVpbGRgIGFuZCBgdGVyc2VyYCB0byBwcm92aWRlIGJvdGggZmFzdCBhbmQgaGlnaGx5LW9wdGltaXplZFxuICogY29kZSBvdXRwdXQuIGBlc2J1aWxkYCBpcyB1c2VkIGFzIGFuIGluaXRpYWwgcGFzcyB0byByZW1vdmUgdGhlIG1ham9yaXR5IG9mIHVudXNlZCBjb2RlXG4gKiBhcyB3ZWxsIGFzIHNob3J0ZW4gaWRlbnRpZmllcnMuIGB0ZXJzZXJgIGlzIHRoZW4gdXNlZCBhcyBhIHNlY29uZGFyeSBwYXNzIHRvIGFwcGx5XG4gKiBvcHRpbWl6YXRpb25zIG5vdCB5ZXQgaW1wbGVtZW50ZWQgYnkgYGVzYnVpbGRgLlxuICovXG5leHBvcnQgY2xhc3MgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbiB7XG4gIHByaXZhdGUgdGFyZ2V0czogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBKYXZhU2NyaXB0T3B0aW1pemVyT3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgICB0aGlzLnRhcmdldHMgPSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzKTtcbiAgICB9XG4gIH1cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpIHtcbiAgICBjb25zdCB7IE9yaWdpbmFsU291cmNlLCBTb3VyY2VNYXBTb3VyY2UgfSA9IGNvbXBpbGVyLndlYnBhY2suc291cmNlcztcblxuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICBjb25zdCBsb2dnZXIgPSBjb21waWxhdGlvbi5nZXRMb2dnZXIoJ2J1aWxkLWFuZ3VsYXIuSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbicpO1xuXG4gICAgICBjb21waWxhdGlvbi5ob29rcy5wcm9jZXNzQXNzZXRzLnRhcFByb21pc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBQTFVHSU5fTkFNRSxcbiAgICAgICAgICBzdGFnZTogY29tcGlsZXIud2VicGFjay5Db21waWxhdGlvbi5QUk9DRVNTX0FTU0VUU19TVEFHRV9PUFRJTUlaRV9TSVpFLFxuICAgICAgICB9LFxuICAgICAgICBhc3luYyAoY29tcGlsYXRpb25Bc3NldHMpID0+IHtcbiAgICAgICAgICBsb2dnZXIudGltZSgnb3B0aW1pemUganMgYXNzZXRzJyk7XG4gICAgICAgICAgY29uc3Qgc2NyaXB0c1RvT3B0aW1pemUgPSBbXTtcbiAgICAgICAgICBjb25zdCBjYWNoZSA9XG4gICAgICAgICAgICBjb21waWxhdGlvbi5vcHRpb25zLmNhY2hlICYmIGNvbXBpbGF0aW9uLmdldENhY2hlKCdKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luJyk7XG5cbiAgICAgICAgICAvLyBBbmFseXplIHRoZSBjb21waWxhdGlvbiBhc3NldHMgZm9yIHNjcmlwdHMgdGhhdCByZXF1aXJlIG9wdGltaXphdGlvblxuICAgICAgICAgIGZvciAoY29uc3QgYXNzZXROYW1lIG9mIE9iamVjdC5rZXlzKGNvbXBpbGF0aW9uQXNzZXRzKSkge1xuICAgICAgICAgICAgaWYgKCFhc3NldE5hbWUuZW5kc1dpdGgoJy5qcycpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHRBc3NldCA9IGNvbXBpbGF0aW9uLmdldEFzc2V0KGFzc2V0TmFtZSk7XG4gICAgICAgICAgICAvLyBTa2lwIGFzc2V0cyB0aGF0IGhhdmUgYWxyZWFkeSBiZWVuIG9wdGltaXplZCBvciBhcmUgdmVyYmF0aW0gY29waWVzIChwcm9qZWN0IGFzc2V0cylcbiAgICAgICAgICAgIGlmICghc2NyaXB0QXNzZXQgfHwgc2NyaXB0QXNzZXQuaW5mby5taW5pbWl6ZWQgfHwgc2NyaXB0QXNzZXQuaW5mby5jb3BpZWQpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc291cmNlOiBzY3JpcHRBc3NldFNvdXJjZSwgbmFtZSB9ID0gc2NyaXB0QXNzZXQ7XG4gICAgICAgICAgICBsZXQgY2FjaGVJdGVtO1xuXG4gICAgICAgICAgICBpZiAoY2FjaGUpIHtcbiAgICAgICAgICAgICAgY29uc3QgZVRhZyA9IGNhY2hlLmdldExhenlIYXNoZWRFdGFnKHNjcmlwdEFzc2V0U291cmNlKTtcbiAgICAgICAgICAgICAgY2FjaGVJdGVtID0gY2FjaGUuZ2V0SXRlbUNhY2hlKG5hbWUsIGVUYWcpO1xuICAgICAgICAgICAgICBjb25zdCBjYWNoZWRPdXRwdXQgPSBhd2FpdCBjYWNoZUl0ZW0uZ2V0UHJvbWlzZTxcbiAgICAgICAgICAgICAgICB7IHNvdXJjZTogc291cmNlcy5Tb3VyY2UgfSB8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA+KCk7XG5cbiAgICAgICAgICAgICAgaWYgKGNhY2hlZE91dHB1dCkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5kZWJ1ZyhgJHtuYW1lfSByZXN0b3JlZCBmcm9tIGNhY2hlYCk7XG4gICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgY2FjaGVkT3V0cHV0LnNvdXJjZSwgKGFzc2V0SW5mbykgPT4gKHtcbiAgICAgICAgICAgICAgICAgIC4uLmFzc2V0SW5mbyxcbiAgICAgICAgICAgICAgICAgIG1pbmltaXplZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2UsIG1hcCB9ID0gc2NyaXB0QXNzZXRTb3VyY2Uuc291cmNlQW5kTWFwKCk7XG4gICAgICAgICAgICBzY3JpcHRzVG9PcHRpbWl6ZS5wdXNoKHtcbiAgICAgICAgICAgICAgbmFtZTogc2NyaXB0QXNzZXQubmFtZSxcbiAgICAgICAgICAgICAgY29kZTogdHlwZW9mIHNvdXJjZSA9PT0gJ3N0cmluZycgPyBzb3VyY2UgOiBzb3VyY2UudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgbWFwLFxuICAgICAgICAgICAgICBjYWNoZUl0ZW0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc2NyaXB0c1RvT3B0aW1pemUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRW5zdXJlIGFsbCByZXBsYWNlbWVudCB2YWx1ZXMgYXJlIHN0cmluZ3Mgd2hpY2ggaXMgdGhlIGV4cGVjdGVkIHR5cGUgZm9yIGVzYnVpbGRcbiAgICAgICAgICBsZXQgZGVmaW5lOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgICBkZWZpbmUgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMub3B0aW9ucy5kZWZpbmUpKSB7XG4gICAgICAgICAgICAgIGRlZmluZVtrZXldID0gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTZXR1cCB0aGUgb3B0aW9ucyB1c2VkIGJ5IGFsbCB3b3JrZXIgdGFza3NcbiAgICAgICAgICBjb25zdCBvcHRpbWl6ZU9wdGlvbnM6IE9wdGltaXplUmVxdWVzdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBzb3VyY2VtYXA6IHRoaXMub3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBkZWZpbmUsXG4gICAgICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiB0aGlzLm9wdGlvbnMua2VlcElkZW50aWZpZXJOYW1lcyxcbiAgICAgICAgICAgIHRhcmdldDogdGhpcy50YXJnZXRzLFxuICAgICAgICAgICAgcmVtb3ZlTGljZW5zZXM6IHRoaXMub3B0aW9ucy5yZW1vdmVMaWNlbnNlcyxcbiAgICAgICAgICAgIGFkdmFuY2VkOiB0aGlzLm9wdGlvbnMuYWR2YW5jZWQsXG4gICAgICAgICAgICAvLyBQZXJmb3JtIGEgc2luZ2xlIG5hdGl2ZSBlc2J1aWxkIHN1cHBvcnQgY2hlY2suXG4gICAgICAgICAgICAvLyBUaGlzIHJlbW92ZXMgdGhlIG5lZWQgZm9yIGVhY2ggd29ya2VyIHRvIHBlcmZvcm0gdGhlIGNoZWNrIHdoaWNoIHdvdWxkXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgcmVxdWlyZSBzcGF3bmluZyBhIHNlcGFyYXRlIHByb2Nlc3MgcGVyIHdvcmtlci5cbiAgICAgICAgICAgIGFsd2F5c1VzZVdhc206ICEoYXdhaXQgRXNidWlsZEV4ZWN1dG9yLmhhc05hdGl2ZVN1cHBvcnQoKSksXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIFNvcnQgc2NyaXB0cyBzbyBsYXJnZXIgc2NyaXB0cyBzdGFydCBmaXJzdCAtIHdvcmtlciBwb29sIHVzZXMgYSBGSUZPIHF1ZXVlXG4gICAgICAgICAgc2NyaXB0c1RvT3B0aW1pemUuc29ydCgoYSwgYikgPT4gYS5jb2RlLmxlbmd0aCAtIGIuY29kZS5sZW5ndGgpO1xuXG4gICAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgdGFzayB3b3JrZXIgcG9vbFxuICAgICAgICAgIGNvbnN0IHdvcmtlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJy4vamF2YXNjcmlwdC1vcHRpbWl6ZXItd29ya2VyJyk7XG4gICAgICAgICAgY29uc3Qgd29ya2VyUG9vbCA9IG5ldyBQaXNjaW5hKHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiB3b3JrZXJQYXRoLFxuICAgICAgICAgICAgbWF4VGhyZWFkczogTUFYX09QVElNSVpFX1dPUktFUlMsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBFbnF1ZXVlIHNjcmlwdCBvcHRpbWl6YXRpb24gdGFza3MgYW5kIHVwZGF0ZSBjb21waWxhdGlvbiBhc3NldHMgYXMgdGhlIHRhc2tzIGNvbXBsZXRlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRhc2tzID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgbmFtZSwgY29kZSwgbWFwLCBjYWNoZUl0ZW0gfSBvZiBzY3JpcHRzVG9PcHRpbWl6ZSkge1xuICAgICAgICAgICAgICBsb2dnZXIudGltZShgb3B0aW1pemUgYXNzZXQ6ICR7bmFtZX1gKTtcblxuICAgICAgICAgICAgICB0YXNrcy5wdXNoKFxuICAgICAgICAgICAgICAgIHdvcmtlclBvb2xcbiAgICAgICAgICAgICAgICAgIC5ydW4oe1xuICAgICAgICAgICAgICAgICAgICBhc3NldDoge1xuICAgICAgICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgY29kZSxcbiAgICAgICAgICAgICAgICAgICAgICBtYXAsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGltaXplT3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICAgICAgYXN5bmMgKHsgY29kZSwgbmFtZSwgbWFwLCBlcnJvcnMgfSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcnM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkRXJyb3IoY29tcGlsYXRpb24sIGBPcHRpbWl6YXRpb24gZXJyb3IgWyR7bmFtZX1dOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkQXNzZXQgPSBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgID8gbmV3IFNvdXJjZU1hcFNvdXJjZShjb2RlLCBuYW1lLCBtYXApXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG5ldyBPcmlnaW5hbFNvdXJjZShjb2RlLCBuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGVBc3NldChuYW1lLCBvcHRpbWl6ZWRBc3NldCwgKGFzc2V0SW5mbykgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLmFzc2V0SW5mbyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbmltaXplZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIudGltZUVuZChgb3B0aW1pemUgYXNzZXQ6ICR7bmFtZX1gKTtcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWNoZUl0ZW0/LnN0b3JlUHJvbWlzZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IG9wdGltaXplZEFzc2V0LFxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBhZGRFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgYE9wdGltaXphdGlvbiBlcnJvciBbJHtuYW1lfV06ICR7ZXJyb3Iuc3RhY2sgfHwgZXJyb3IubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbCh0YXNrcyk7XG4gICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHZvaWQgd29ya2VyUG9vbC5kZXN0cm95KCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbG9nZ2VyLnRpbWVFbmQoJ29wdGltaXplIGpzIGFzc2V0cycpO1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxufVxuIl19