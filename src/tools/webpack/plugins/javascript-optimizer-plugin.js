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
                    // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
                    workerPool.options.minThreads = 0;
                    void workerPool.destroy();
                }
                logger.timeEnd('optimize js assets');
            });
        });
    }
}
exports.JavaScriptOptimizerPlugin = JavaScriptOptimizerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1vcHRpbWl6ZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL2phdmFzY3JpcHQtb3B0aW1pemVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxzREFBOEI7QUFFOUIsNEVBQWdFO0FBQ2hFLDRFQUE4RDtBQUM5RCwrQ0FBMEU7QUFDMUUseURBQXFEO0FBR3JEOztHQUVHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxnQ0FBVSxDQUFDO0FBRXhDOztHQUVHO0FBQ0gsTUFBTSxXQUFXLEdBQUcsOEJBQThCLENBQUM7QUE2Q25EOzs7Ozs7O0dBT0c7QUFDSCxNQUFhLHlCQUF5QjtJQUdoQjtJQUZaLE9BQU8sQ0FBdUI7SUFFdEMsWUFBb0IsT0FBbUM7UUFBbkMsWUFBTyxHQUFQLE9BQU8sQ0FBNEI7UUFDckQsSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7WUFDN0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLDJDQUFtQyxFQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1NBQy9FO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixNQUFNLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBRXJFLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUMxRCxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7WUFFaEYsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUN4Qztn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O2lCQUMxQjt3QkFBUztvQkFDUixvR0FBb0c7b0JBQ3BHLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztvQkFDbEMsS0FBSyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7aUJBQzNCO2dCQUVELE1BQU0sQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUN2QyxDQUFDLENBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdEtELDhEQXNLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZXIsIHNvdXJjZXMgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGFkZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyB9IGZyb20gJy4uLy4uL2VzYnVpbGQvdXRpbHMnO1xuaW1wb3J0IHsgRXNidWlsZEV4ZWN1dG9yIH0gZnJvbSAnLi9lc2J1aWxkLWV4ZWN1dG9yJztcbmltcG9ydCB0eXBlIHsgT3B0aW1pemVSZXF1ZXN0T3B0aW9ucyB9IGZyb20gJy4vamF2YXNjcmlwdC1vcHRpbWl6ZXItd29ya2VyJztcblxuLyoqXG4gKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgV29ya2VycyB0aGF0IHdpbGwgYmUgY3JlYXRlZCB0byBleGVjdXRlIG9wdGltaXplIHRhc2tzLlxuICovXG5jb25zdCBNQVhfT1BUSU1JWkVfV09SS0VSUyA9IG1heFdvcmtlcnM7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIHBsdWdpbiBwcm92aWRlZCB0byBXZWJwYWNrIHdoZW4gdGFwcGluZyBXZWJwYWNrIGNvbXBpbGVyIGhvb2tzLlxuICovXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdhbmd1bGFyLWphdmFzY3JpcHQtb3B0aW1pemVyJztcblxuLyoqXG4gKiBUaGUgb3B0aW9ucyB1c2VkIHRvIGNvbmZpZ3VyZSB0aGUge0BsaW5rIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW59LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEphdmFTY3JpcHRPcHRpbWl6ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVuYWJsZXMgYWR2YW5jZWQgb3B0aW1pemF0aW9ucyBpbiB0aGUgdW5kZXJseWluZyBKYXZhU2NyaXB0IG9wdGltaXplcnMuXG4gICAqIFRoaXMgY3VycmVudGx5IGluY3JlYXNlcyB0aGUgYHRlcnNlcmAgcGFzc2VzIHRvIDIgYW5kIGVuYWJsZXMgdGhlIGBwdXJlX2dldHRlcnNgXG4gICAqIG9wdGlvbiBmb3IgYHRlcnNlcmAuXG4gICAqL1xuICBhZHZhbmNlZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIG9iamVjdCByZWNvcmQgb2Ygc3RyaW5nIGtleXMgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlaXIgcmVzcGVjdGl2ZSB2YWx1ZXMgd2hlbiBmb3VuZFxuICAgKiB3aXRoaW4gdGhlIGNvZGUgZHVyaW5nIG9wdGltaXphdGlvbi5cbiAgICovXG4gIGRlZmluZTogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbj47XG5cbiAgLyoqXG4gICAqIEVuYWJsZXMgdGhlIGdlbmVyYXRpb24gb2YgYSBzb3VyY2VtYXAgZHVyaW5nIG9wdGltaXphdGlvbi5cbiAgICogVGhlIG91dHB1dCBzb3VyY2VtYXAgd2lsbCBiZSBhIGZ1bGwgc291cmNlbWFwIGNvbnRhaW5pbmcgdGhlIG1lcmdlIG9mIHRoZSBpbnB1dCBzb3VyY2VtYXAgYW5kXG4gICAqIGFsbCBpbnRlcm1lZGlhdGUgc291cmNlbWFwcy5cbiAgICovXG4gIHNvdXJjZW1hcD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBzdXBwb3J0ZWQgYnJvd3NlcnMgdGhhdCBpcyB1c2VkIGZvciBvdXRwdXQgY29kZS5cbiAgICovXG4gIHN1cHBvcnRlZEJyb3dzZXJzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIEVuYWJsZXMgdGhlIHJldGVudGlvbiBvZiBpZGVudGlmaWVyIG5hbWVzIGFuZCBlbnN1cmVzIHRoYXQgZnVuY3Rpb24gYW5kIGNsYXNzIG5hbWVzIGFyZVxuICAgKiBwcmVzZW50IGluIHRoZSBvdXRwdXQgY29kZS5cbiAgICpcbiAgICogKipOb3RlKio6IGluIHNvbWUgY2FzZXMgc3ltYm9scyBhcmUgc3RpbGwgcmVuYW1lZCB0byBhdm9pZCBjb2xsaXNpb25zLlxuICAgKi9cbiAga2VlcElkZW50aWZpZXJOYW1lczogYm9vbGVhbjtcblxuICAvKipcbiAgICogRW5hYmxlcyB0aGUgcmVtb3ZhbCBvZiBhbGwgbGljZW5zZSBjb21tZW50cyBmcm9tIHRoZSBvdXRwdXQgY29kZS5cbiAgICovXG4gIHJlbW92ZUxpY2Vuc2VzPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBBIFdlYnBhY2sgcGx1Z2luIHRoYXQgcHJvdmlkZXMgSmF2YVNjcmlwdCBvcHRpbWl6YXRpb24gY2FwYWJpbGl0aWVzLlxuICpcbiAqIFRoZSBwbHVnaW4gdXNlcyBib3RoIGBlc2J1aWxkYCBhbmQgYHRlcnNlcmAgdG8gcHJvdmlkZSBib3RoIGZhc3QgYW5kIGhpZ2hseS1vcHRpbWl6ZWRcbiAqIGNvZGUgb3V0cHV0LiBgZXNidWlsZGAgaXMgdXNlZCBhcyBhbiBpbml0aWFsIHBhc3MgdG8gcmVtb3ZlIHRoZSBtYWpvcml0eSBvZiB1bnVzZWQgY29kZVxuICogYXMgd2VsbCBhcyBzaG9ydGVuIGlkZW50aWZpZXJzLiBgdGVyc2VyYCBpcyB0aGVuIHVzZWQgYXMgYSBzZWNvbmRhcnkgcGFzcyB0byBhcHBseVxuICogb3B0aW1pemF0aW9ucyBub3QgeWV0IGltcGxlbWVudGVkIGJ5IGBlc2J1aWxkYC5cbiAqL1xuZXhwb3J0IGNsYXNzIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4ge1xuICBwcml2YXRlIHRhcmdldHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogSmF2YVNjcmlwdE9wdGltaXplck9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycykge1xuICAgICAgdGhpcy50YXJnZXRzID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMob3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycyk7XG4gICAgfVxuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29uc3QgeyBPcmlnaW5hbFNvdXJjZSwgU291cmNlTWFwU291cmNlIH0gPSBjb21waWxlci53ZWJwYWNrLnNvdXJjZXM7XG5cbiAgICBjb21waWxlci5ob29rcy5jb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29uc3QgbG9nZ2VyID0gY29tcGlsYXRpb24uZ2V0TG9nZ2VyKCdidWlsZC1hbmd1bGFyLkphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4nKTtcblxuICAgICAgY29tcGlsYXRpb24uaG9va3MucHJvY2Vzc0Fzc2V0cy50YXBQcm9taXNlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IGNvbXBpbGVyLndlYnBhY2suQ29tcGlsYXRpb24uUFJPQ0VTU19BU1NFVFNfU1RBR0VfT1BUSU1JWkVfU0laRSxcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgKGNvbXBpbGF0aW9uQXNzZXRzKSA9PiB7XG4gICAgICAgICAgbG9nZ2VyLnRpbWUoJ29wdGltaXplIGpzIGFzc2V0cycpO1xuICAgICAgICAgIGNvbnN0IHNjcmlwdHNUb09wdGltaXplID0gW107XG4gICAgICAgICAgY29uc3QgY2FjaGUgPVxuICAgICAgICAgICAgY29tcGlsYXRpb24ub3B0aW9ucy5jYWNoZSAmJiBjb21waWxhdGlvbi5nZXRDYWNoZSgnSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbicpO1xuXG4gICAgICAgICAgLy8gQW5hbHl6ZSB0aGUgY29tcGlsYXRpb24gYXNzZXRzIGZvciBzY3JpcHRzIHRoYXQgcmVxdWlyZSBvcHRpbWl6YXRpb25cbiAgICAgICAgICBmb3IgKGNvbnN0IGFzc2V0TmFtZSBvZiBPYmplY3Qua2V5cyhjb21waWxhdGlvbkFzc2V0cykpIHtcbiAgICAgICAgICAgIGlmICghYXNzZXROYW1lLmVuZHNXaXRoKCcuanMnKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0QXNzZXQgPSBjb21waWxhdGlvbi5nZXRBc3NldChhc3NldE5hbWUpO1xuICAgICAgICAgICAgLy8gU2tpcCBhc3NldHMgdGhhdCBoYXZlIGFscmVhZHkgYmVlbiBvcHRpbWl6ZWQgb3IgYXJlIHZlcmJhdGltIGNvcGllcyAocHJvamVjdCBhc3NldHMpXG4gICAgICAgICAgICBpZiAoIXNjcmlwdEFzc2V0IHx8IHNjcmlwdEFzc2V0LmluZm8ubWluaW1pemVkIHx8IHNjcmlwdEFzc2V0LmluZm8uY29waWVkKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IHNvdXJjZTogc2NyaXB0QXNzZXRTb3VyY2UsIG5hbWUgfSA9IHNjcmlwdEFzc2V0O1xuICAgICAgICAgICAgbGV0IGNhY2hlSXRlbTtcblxuICAgICAgICAgICAgaWYgKGNhY2hlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVUYWcgPSBjYWNoZS5nZXRMYXp5SGFzaGVkRXRhZyhzY3JpcHRBc3NldFNvdXJjZSk7XG4gICAgICAgICAgICAgIGNhY2hlSXRlbSA9IGNhY2hlLmdldEl0ZW1DYWNoZShuYW1lLCBlVGFnKTtcbiAgICAgICAgICAgICAgY29uc3QgY2FjaGVkT3V0cHV0ID0gYXdhaXQgY2FjaGVJdGVtLmdldFByb21pc2U8XG4gICAgICAgICAgICAgICAgeyBzb3VyY2U6IHNvdXJjZXMuU291cmNlIH0gfCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgPigpO1xuXG4gICAgICAgICAgICAgIGlmIChjYWNoZWRPdXRwdXQpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZGVidWcoYCR7bmFtZX0gcmVzdG9yZWQgZnJvbSBjYWNoZWApO1xuICAgICAgICAgICAgICAgIGNvbXBpbGF0aW9uLnVwZGF0ZUFzc2V0KG5hbWUsIGNhY2hlZE91dHB1dC5zb3VyY2UsIChhc3NldEluZm8pID0+ICh7XG4gICAgICAgICAgICAgICAgICAuLi5hc3NldEluZm8sXG4gICAgICAgICAgICAgICAgICBtaW5pbWl6ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc291cmNlLCBtYXAgfSA9IHNjcmlwdEFzc2V0U291cmNlLnNvdXJjZUFuZE1hcCgpO1xuICAgICAgICAgICAgc2NyaXB0c1RvT3B0aW1pemUucHVzaCh7XG4gICAgICAgICAgICAgIG5hbWU6IHNjcmlwdEFzc2V0Lm5hbWUsXG4gICAgICAgICAgICAgIGNvZGU6IHR5cGVvZiBzb3VyY2UgPT09ICdzdHJpbmcnID8gc291cmNlIDogc291cmNlLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIG1hcCxcbiAgICAgICAgICAgICAgY2FjaGVJdGVtLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNjcmlwdHNUb09wdGltaXplLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEVuc3VyZSBhbGwgcmVwbGFjZW1lbnQgdmFsdWVzIGFyZSBzdHJpbmdzIHdoaWNoIGlzIHRoZSBleHBlY3RlZCB0eXBlIGZvciBlc2J1aWxkXG4gICAgICAgICAgbGV0IGRlZmluZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmRlZmluZSkge1xuICAgICAgICAgICAgZGVmaW5lID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm9wdGlvbnMuZGVmaW5lKSkge1xuICAgICAgICAgICAgICBkZWZpbmVba2V5XSA9IFN0cmluZyh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gU2V0dXAgdGhlIG9wdGlvbnMgdXNlZCBieSBhbGwgd29ya2VyIHRhc2tzXG4gICAgICAgICAgY29uc3Qgb3B0aW1pemVPcHRpb25zOiBPcHRpbWl6ZVJlcXVlc3RPcHRpb25zID0ge1xuICAgICAgICAgICAgc291cmNlbWFwOiB0aGlzLm9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgZGVmaW5lLFxuICAgICAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogdGhpcy5vcHRpb25zLmtlZXBJZGVudGlmaWVyTmFtZXMsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXMudGFyZ2V0cyxcbiAgICAgICAgICAgIHJlbW92ZUxpY2Vuc2VzOiB0aGlzLm9wdGlvbnMucmVtb3ZlTGljZW5zZXMsXG4gICAgICAgICAgICBhZHZhbmNlZDogdGhpcy5vcHRpb25zLmFkdmFuY2VkLFxuICAgICAgICAgICAgLy8gUGVyZm9ybSBhIHNpbmdsZSBuYXRpdmUgZXNidWlsZCBzdXBwb3J0IGNoZWNrLlxuICAgICAgICAgICAgLy8gVGhpcyByZW1vdmVzIHRoZSBuZWVkIGZvciBlYWNoIHdvcmtlciB0byBwZXJmb3JtIHRoZSBjaGVjayB3aGljaCB3b3VsZFxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHJlcXVpcmUgc3Bhd25pbmcgYSBzZXBhcmF0ZSBwcm9jZXNzIHBlciB3b3JrZXIuXG4gICAgICAgICAgICBhbHdheXNVc2VXYXNtOiAhKGF3YWl0IEVzYnVpbGRFeGVjdXRvci5oYXNOYXRpdmVTdXBwb3J0KCkpLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBTb3J0IHNjcmlwdHMgc28gbGFyZ2VyIHNjcmlwdHMgc3RhcnQgZmlyc3QgLSB3b3JrZXIgcG9vbCB1c2VzIGEgRklGTyBxdWV1ZVxuICAgICAgICAgIHNjcmlwdHNUb09wdGltaXplLnNvcnQoKGEsIGIpID0+IGEuY29kZS5sZW5ndGggLSBiLmNvZGUubGVuZ3RoKTtcblxuICAgICAgICAgIC8vIEluaXRpYWxpemUgdGhlIHRhc2sgd29ya2VyIHBvb2xcbiAgICAgICAgICBjb25zdCB3b3JrZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCcuL2phdmFzY3JpcHQtb3B0aW1pemVyLXdvcmtlcicpO1xuICAgICAgICAgIGNvbnN0IHdvcmtlclBvb2wgPSBuZXcgUGlzY2luYSh7XG4gICAgICAgICAgICBmaWxlbmFtZTogd29ya2VyUGF0aCxcbiAgICAgICAgICAgIG1heFRocmVhZHM6IE1BWF9PUFRJTUlaRV9XT1JLRVJTLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gRW5xdWV1ZSBzY3JpcHQgb3B0aW1pemF0aW9uIHRhc2tzIGFuZCB1cGRhdGUgY29tcGlsYXRpb24gYXNzZXRzIGFzIHRoZSB0YXNrcyBjb21wbGV0ZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0YXNrcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IG5hbWUsIGNvZGUsIG1hcCwgY2FjaGVJdGVtIH0gb2Ygc2NyaXB0c1RvT3B0aW1pemUpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLnRpbWUoYG9wdGltaXplIGFzc2V0OiAke25hbWV9YCk7XG5cbiAgICAgICAgICAgICAgdGFza3MucHVzaChcbiAgICAgICAgICAgICAgICB3b3JrZXJQb29sXG4gICAgICAgICAgICAgICAgICAucnVuKHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgIGNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgbWFwLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpbWl6ZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLnRoZW4oXG4gICAgICAgICAgICAgICAgICAgIGFzeW5jICh7IGNvZGUsIG5hbWUsIG1hcCwgZXJyb3JzIH0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFkZEVycm9yKGNvbXBpbGF0aW9uLCBgT3B0aW1pemF0aW9uIGVycm9yIFske25hbWV9XTogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGltaXplZEFzc2V0ID0gbWFwXG4gICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyBTb3VyY2VNYXBTb3VyY2UoY29kZSwgbmFtZSwgbWFwKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2UoY29kZSwgbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgb3B0aW1pemVkQXNzZXQsIChhc3NldEluZm8pID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5hc3NldEluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5pbWl6ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLnRpbWVFbmQoYG9wdGltaXplIGFzc2V0OiAke25hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVJdGVtPy5zdG9yZVByb21pc2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiBvcHRpbWl6ZWRBc3NldCxcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgYWRkRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21waWxhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGBPcHRpbWl6YXRpb24gZXJyb3IgWyR7bmFtZX1dOiAke2Vycm9yLnN0YWNrIHx8IGVycm9yLm1lc3NhZ2V9YCxcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodGFza3MpO1xuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAvLyBXb3JrYXJvdW5kIHBpc2NpbmEgYnVnIHdoZXJlIGEgd29ya2VyIHRocmVhZCB3aWxsIGJlIHJlY3JlYXRlZCBhZnRlciBkZXN0cm95IHRvIG1lZXQgdGhlIG1pbmltdW0uXG4gICAgICAgICAgICB3b3JrZXJQb29sLm9wdGlvbnMubWluVGhyZWFkcyA9IDA7XG4gICAgICAgICAgICB2b2lkIHdvcmtlclBvb2wuZGVzdHJveSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxvZ2dlci50aW1lRW5kKCdvcHRpbWl6ZSBqcyBhc3NldHMnKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==