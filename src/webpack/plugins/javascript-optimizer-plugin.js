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
const typescript_1 = require("typescript");
const environment_options_1 = require("../../utils/environment-options");
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
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        const { OriginalSource, SourceMapSource } = compiler.webpack.sources;
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
            }, async (compilationAssets) => {
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
                            compilation.updateAsset(name, cachedOutput.source, {
                                minimized: true,
                            });
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
                let target = 2017;
                if (this.options.target) {
                    if (this.options.target <= typescript_1.ScriptTarget.ES5) {
                        target = 5;
                    }
                    else if (this.options.target === typescript_1.ScriptTarget.ESNext) {
                        target = 'next';
                    }
                    else {
                        target = Number(typescript_1.ScriptTarget[this.options.target].slice(2));
                    }
                }
                // Setup the options used by all worker tasks
                const optimizeOptions = {
                    sourcemap: this.options.sourcemap,
                    define,
                    keepNames: this.options.keepNames,
                    keepIdentifierNames: this.options.keepIdentifierNames,
                    target,
                    removeLicenses: this.options.removeLicenses,
                    advanced: this.options.advanced,
                    // Perform a single native esbuild support check.
                    // This removes the need for each worker to perform the check which would
                    // otherwise require spawning a separate process per worker.
                    alwaysUseWasm: !esbuild_executor_1.EsbuildExecutor.hasNativeSupport(),
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
                        tasks.push(workerPool
                            .run({
                            asset: {
                                name,
                                code,
                                map,
                            },
                            options: optimizeOptions,
                        })
                            .then(({ code, name, map }) => {
                            const optimizedAsset = map
                                ? new SourceMapSource(code, name, map)
                                : new OriginalSource(code, name);
                            compilation.updateAsset(name, optimizedAsset, { minimized: true });
                            return cacheItem === null || cacheItem === void 0 ? void 0 : cacheItem.storePromise({
                                source: optimizedAsset,
                            });
                        }, (error) => {
                            const optimizationError = new compiler.webpack.WebpackError(`Optimization error [${name}]: ${error.stack || error.message}`);
                            compilation.errors.push(optimizationError);
                        }));
                    }
                    await Promise.all(tasks);
                }
                finally {
                    void workerPool.destroy();
                }
            });
        });
    }
}
exports.JavaScriptOptimizerPlugin = JavaScriptOptimizerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1vcHRpbWl6ZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2phdmFzY3JpcHQtb3B0aW1pemVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxzREFBOEI7QUFDOUIsMkNBQTBDO0FBRTFDLHlFQUE2RDtBQUM3RCx5REFBcUQ7QUFHckQ7O0dBRUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLGdDQUFVLENBQUM7QUFFeEM7O0dBRUc7QUFDSCxNQUFNLFdBQVcsR0FBRyw4QkFBOEIsQ0FBQztBQXNEbkQ7Ozs7Ozs7R0FPRztBQUNILE1BQWEseUJBQXlCO0lBQ3BDLFlBQW1CLE9BQW1DO1FBQW5DLFlBQU8sR0FBUCxPQUFPLENBQTRCO0lBQUcsQ0FBQztJQUUxRCxLQUFLLENBQUMsUUFBa0I7UUFDdEIsTUFBTSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUVyRSxRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDMUQsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUN4QztnQkFDRSxJQUFJLEVBQUUsV0FBVztnQkFDakIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGtDQUFrQzthQUN2RSxFQUNELEtBQUssRUFBRSxpQkFBaUIsRUFBRSxFQUFFO2dCQUMxQixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxLQUFLLEdBQ1QsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksV0FBVyxDQUFDLFFB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ZUFBZTt5QkFDekIsQ0FBQzs2QkFDRCxJQUFJLENBQ0gsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTs0QkFDdEIsTUFBTSxjQUFjLEdBQUcsR0FBRztnQ0FDeEIsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDO2dDQUN0QyxDQUFDLENBQUMsSUFBSSxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUNuQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQzs0QkFFbkUsT0FBTyxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsWUFBWSxDQUFDO2dDQUM3QixNQUFNLEVBQUUsY0FBYzs2QkFDdkIsQ0FBQyxDQUFDO3dCQUNMLENBQUMsRUFDRCxDQUFDLEtBQUssRUFBRSxFQUFFOzRCQUNSLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FDekQsdUJBQXVCLElBQUksTUFBTSxLQUFLLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDaEUsQ0FBQzs0QkFDRixXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO3dCQUM3QyxDQUFDLENBQ0YsQ0FDSixDQUFDO3FCQUNIO29CQUVELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDMUI7d0JBQVM7b0JBQ1IsS0FBSyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7aUJBQzNCO1lBQ0gsQ0FBQyxDQUNGLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXRKRCw4REFzSkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZXIsIHNvdXJjZXMgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEVzYnVpbGRFeGVjdXRvciB9IGZyb20gJy4vZXNidWlsZC1leGVjdXRvcic7XG5pbXBvcnQgdHlwZSB7IE9wdGltaXplUmVxdWVzdE9wdGlvbnMgfSBmcm9tICcuL2phdmFzY3JpcHQtb3B0aW1pemVyLXdvcmtlcic7XG5cbi8qKlxuICogVGhlIG1heGltdW0gbnVtYmVyIG9mIFdvcmtlcnMgdGhhdCB3aWxsIGJlIGNyZWF0ZWQgdG8gZXhlY3V0ZSBvcHRpbWl6ZSB0YXNrcy5cbiAqL1xuY29uc3QgTUFYX09QVElNSVpFX1dPUktFUlMgPSBtYXhXb3JrZXJzO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnYW5ndWxhci1qYXZhc2NyaXB0LW9wdGltaXplcic7XG5cbi8qKlxuICogVGhlIG9wdGlvbnMgdXNlZCB0byBjb25maWd1cmUgdGhlIHtAbGluayBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2lufS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKYXZhU2NyaXB0T3B0aW1pemVyT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBFbmFibGVzIGFkdmFuY2VkIG9wdGltaXphdGlvbnMgaW4gdGhlIHVuZGVybHlpbmcgSmF2YVNjcmlwdCBvcHRpbWl6ZXJzLlxuICAgKiBUaGlzIGN1cnJlbnRseSBpbmNyZWFzZXMgdGhlIGB0ZXJzZXJgIHBhc3NlcyB0byAyIGFuZCBlbmFibGVzIHRoZSBgcHVyZV9nZXR0ZXJzYFxuICAgKiBvcHRpb24gZm9yIGB0ZXJzZXJgLlxuICAgKi9cbiAgYWR2YW5jZWQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBBbiBvYmplY3QgcmVjb3JkIG9mIHN0cmluZyBrZXlzIHRoYXQgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZWlyIHJlc3BlY3RpdmUgdmFsdWVzIHdoZW4gZm91bmRcbiAgICogd2l0aGluIHRoZSBjb2RlIGR1cmluZyBvcHRpbWl6YXRpb24uXG4gICAqL1xuICBkZWZpbmU6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4+O1xuXG4gIC8qKlxuICAgKiBFbmFibGVzIHRoZSBnZW5lcmF0aW9uIG9mIGEgc291cmNlbWFwIGR1cmluZyBvcHRpbWl6YXRpb24uXG4gICAqIFRoZSBvdXRwdXQgc291cmNlbWFwIHdpbGwgYmUgYSBmdWxsIHNvdXJjZW1hcCBjb250YWluaW5nIHRoZSBtZXJnZSBvZiB0aGUgaW5wdXQgc291cmNlbWFwIGFuZFxuICAgKiBhbGwgaW50ZXJtZWRpYXRlIHNvdXJjZW1hcHMuXG4gICAqL1xuICBzb3VyY2VtYXA/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgRUNNQVNjcmlwdCB2ZXJzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgd2hlbiBnZW5lcmF0aW5nIG91dHB1dCBjb2RlLlxuICAgKiBUaGUgb3B0aW1pemVyIHdpbGwgbm90IGFkanVzdCB0aGUgb3V0cHV0IGNvZGUgd2l0aCBmZWF0dXJlcyBwcmVzZW50IGluIG5ld2VyXG4gICAqIEVDTUFTY3JpcHQgdmVyc2lvbnMuXG4gICAqL1xuICB0YXJnZXQ6IFNjcmlwdFRhcmdldDtcblxuICAvKipcbiAgICogRW5hYmxlcyB0aGUgcmV0ZW50aW9uIG9mIGlkZW50aWZpZXIgbmFtZXMgYW5kIGVuc3VyZXMgdGhhdCBmdW5jdGlvbiBhbmQgY2xhc3MgbmFtZXMgYXJlXG4gICAqIHByZXNlbnQgaW4gdGhlIG91dHB1dCBjb2RlLlxuICAgKlxuICAgKiAqKk5vdGUqKjogaW4gc29tZSBjYXNlcyBzeW1ib2xzIGFyZSBzdGlsbCByZW5hbWVkIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gICAqL1xuICBrZWVwSWRlbnRpZmllck5hbWVzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBFbmFibGVzIHRoZSByZXRlbnRpb24gb2Ygb3JpZ2luYWwgbmFtZSBvZiBjbGFzc2VzIGFuZCBmdW5jdGlvbnMuXG4gICAqXG4gICAqICoqTm90ZSoqOiB0aGlzIGNhdXNlcyBpbmNyZWFzZSBvZiBidW5kbGUgc2l6ZSBhcyBpdCBjYXVzZXMgZGVhZC1jb2RlIGVsaW1pbmF0aW9uIHRvIG5vdCB3b3JrIGZ1bGx5LlxuICAgKi9cbiAga2VlcE5hbWVzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBFbmFibGVzIHRoZSByZW1vdmFsIG9mIGFsbCBsaWNlbnNlIGNvbW1lbnRzIGZyb20gdGhlIG91dHB1dCBjb2RlLlxuICAgKi9cbiAgcmVtb3ZlTGljZW5zZXM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgV2VicGFjayBwbHVnaW4gdGhhdCBwcm92aWRlcyBKYXZhU2NyaXB0IG9wdGltaXphdGlvbiBjYXBhYmlsaXRpZXMuXG4gKlxuICogVGhlIHBsdWdpbiB1c2VzIGJvdGggYGVzYnVpbGRgIGFuZCBgdGVyc2VyYCB0byBwcm92aWRlIGJvdGggZmFzdCBhbmQgaGlnaGx5LW9wdGltaXplZFxuICogY29kZSBvdXRwdXQuIGBlc2J1aWxkYCBpcyB1c2VkIGFzIGFuIGluaXRpYWwgcGFzcyB0byByZW1vdmUgdGhlIG1ham9yaXR5IG9mIHVudXNlZCBjb2RlXG4gKiBhcyB3ZWxsIGFzIHNob3J0ZW4gaWRlbnRpZmllcnMuIGB0ZXJzZXJgIGlzIHRoZW4gdXNlZCBhcyBhIHNlY29uZGFyeSBwYXNzIHRvIGFwcGx5XG4gKiBvcHRpbWl6YXRpb25zIG5vdCB5ZXQgaW1wbGVtZW50ZWQgYnkgYGVzYnVpbGRgLlxuICovXG5leHBvcnQgY2xhc3MgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBvcHRpb25zOiBKYXZhU2NyaXB0T3B0aW1pemVyT3B0aW9ucykge31cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpIHtcbiAgICBjb25zdCB7IE9yaWdpbmFsU291cmNlLCBTb3VyY2VNYXBTb3VyY2UgfSA9IGNvbXBpbGVyLndlYnBhY2suc291cmNlcztcblxuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICBjb21waWxhdGlvbi5ob29rcy5wcm9jZXNzQXNzZXRzLnRhcFByb21pc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBQTFVHSU5fTkFNRSxcbiAgICAgICAgICBzdGFnZTogY29tcGlsZXIud2VicGFjay5Db21waWxhdGlvbi5QUk9DRVNTX0FTU0VUU19TVEFHRV9PUFRJTUlaRV9TSVpFLFxuICAgICAgICB9LFxuICAgICAgICBhc3luYyAoY29tcGlsYXRpb25Bc3NldHMpID0+IHtcbiAgICAgICAgICBjb25zdCBzY3JpcHRzVG9PcHRpbWl6ZSA9IFtdO1xuICAgICAgICAgIGNvbnN0IGNhY2hlID1cbiAgICAgICAgICAgIGNvbXBpbGF0aW9uLm9wdGlvbnMuY2FjaGUgJiYgY29tcGlsYXRpb24uZ2V0Q2FjaGUoJ0phdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4nKTtcblxuICAgICAgICAgIC8vIEFuYWx5emUgdGhlIGNvbXBpbGF0aW9uIGFzc2V0cyBmb3Igc2NyaXB0cyB0aGF0IHJlcXVpcmUgb3B0aW1pemF0aW9uXG4gICAgICAgICAgZm9yIChjb25zdCBhc3NldE5hbWUgb2YgT2JqZWN0LmtleXMoY29tcGlsYXRpb25Bc3NldHMpKSB7XG4gICAgICAgICAgICBpZiAoIWFzc2V0TmFtZS5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdEFzc2V0ID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoYXNzZXROYW1lKTtcbiAgICAgICAgICAgIC8vIFNraXAgYXNzZXRzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gb3B0aW1pemVkIG9yIGFyZSB2ZXJiYXRpbSBjb3BpZXMgKHByb2plY3QgYXNzZXRzKVxuICAgICAgICAgICAgaWYgKCFzY3JpcHRBc3NldCB8fCBzY3JpcHRBc3NldC5pbmZvLm1pbmltaXplZCB8fCBzY3JpcHRBc3NldC5pbmZvLmNvcGllZCkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2U6IHNjcmlwdEFzc2V0U291cmNlLCBuYW1lIH0gPSBzY3JpcHRBc3NldDtcbiAgICAgICAgICAgIGxldCBjYWNoZUl0ZW07XG5cbiAgICAgICAgICAgIGlmIChjYWNoZSkge1xuICAgICAgICAgICAgICBjb25zdCBlVGFnID0gY2FjaGUuZ2V0TGF6eUhhc2hlZEV0YWcoc2NyaXB0QXNzZXRTb3VyY2UpO1xuICAgICAgICAgICAgICBjYWNoZUl0ZW0gPSBjYWNoZS5nZXRJdGVtQ2FjaGUobmFtZSwgZVRhZyk7XG4gICAgICAgICAgICAgIGNvbnN0IGNhY2hlZE91dHB1dCA9IGF3YWl0IGNhY2hlSXRlbS5nZXRQcm9taXNlPFxuICAgICAgICAgICAgICAgIHsgc291cmNlOiBzb3VyY2VzLlNvdXJjZSB9IHwgdW5kZWZpbmVkXG4gICAgICAgICAgICAgID4oKTtcblxuICAgICAgICAgICAgICBpZiAoY2FjaGVkT3V0cHV0KSB7XG4gICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgY2FjaGVkT3V0cHV0LnNvdXJjZSwge1xuICAgICAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc291cmNlLCBtYXAgfSA9IHNjcmlwdEFzc2V0U291cmNlLnNvdXJjZUFuZE1hcCgpO1xuICAgICAgICAgICAgc2NyaXB0c1RvT3B0aW1pemUucHVzaCh7XG4gICAgICAgICAgICAgIG5hbWU6IHNjcmlwdEFzc2V0Lm5hbWUsXG4gICAgICAgICAgICAgIGNvZGU6IHR5cGVvZiBzb3VyY2UgPT09ICdzdHJpbmcnID8gc291cmNlIDogc291cmNlLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIG1hcCxcbiAgICAgICAgICAgICAgY2FjaGVJdGVtLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNjcmlwdHNUb09wdGltaXplLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEVuc3VyZSBhbGwgcmVwbGFjZW1lbnQgdmFsdWVzIGFyZSBzdHJpbmdzIHdoaWNoIGlzIHRoZSBleHBlY3RlZCB0eXBlIGZvciBlc2J1aWxkXG4gICAgICAgICAgbGV0IGRlZmluZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmRlZmluZSkge1xuICAgICAgICAgICAgZGVmaW5lID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm9wdGlvbnMuZGVmaW5lKSkge1xuICAgICAgICAgICAgICBkZWZpbmVba2V5XSA9IFN0cmluZyh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHRhcmdldDogT3B0aW1pemVSZXF1ZXN0T3B0aW9uc1sndGFyZ2V0J10gPSAyMDE3O1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMudGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRhcmdldCA8PSBTY3JpcHRUYXJnZXQuRVM1KSB7XG4gICAgICAgICAgICAgIHRhcmdldCA9IDU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy50YXJnZXQgPT09IFNjcmlwdFRhcmdldC5FU05leHQpIHtcbiAgICAgICAgICAgICAgdGFyZ2V0ID0gJ25leHQnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGFyZ2V0ID0gTnVtYmVyKFxuICAgICAgICAgICAgICAgIFNjcmlwdFRhcmdldFt0aGlzLm9wdGlvbnMudGFyZ2V0XS5zbGljZSgyKSxcbiAgICAgICAgICAgICAgKSBhcyBPcHRpbWl6ZVJlcXVlc3RPcHRpb25zWyd0YXJnZXQnXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTZXR1cCB0aGUgb3B0aW9ucyB1c2VkIGJ5IGFsbCB3b3JrZXIgdGFza3NcbiAgICAgICAgICBjb25zdCBvcHRpbWl6ZU9wdGlvbnM6IE9wdGltaXplUmVxdWVzdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBzb3VyY2VtYXA6IHRoaXMub3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBkZWZpbmUsXG4gICAgICAgICAgICBrZWVwTmFtZXM6IHRoaXMub3B0aW9ucy5rZWVwTmFtZXMsXG4gICAgICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiB0aGlzLm9wdGlvbnMua2VlcElkZW50aWZpZXJOYW1lcyxcbiAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgIHJlbW92ZUxpY2Vuc2VzOiB0aGlzLm9wdGlvbnMucmVtb3ZlTGljZW5zZXMsXG4gICAgICAgICAgICBhZHZhbmNlZDogdGhpcy5vcHRpb25zLmFkdmFuY2VkLFxuICAgICAgICAgICAgLy8gUGVyZm9ybSBhIHNpbmdsZSBuYXRpdmUgZXNidWlsZCBzdXBwb3J0IGNoZWNrLlxuICAgICAgICAgICAgLy8gVGhpcyByZW1vdmVzIHRoZSBuZWVkIGZvciBlYWNoIHdvcmtlciB0byBwZXJmb3JtIHRoZSBjaGVjayB3aGljaCB3b3VsZFxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHJlcXVpcmUgc3Bhd25pbmcgYSBzZXBhcmF0ZSBwcm9jZXNzIHBlciB3b3JrZXIuXG4gICAgICAgICAgICBhbHdheXNVc2VXYXNtOiAhRXNidWlsZEV4ZWN1dG9yLmhhc05hdGl2ZVN1cHBvcnQoKSxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gU29ydCBzY3JpcHRzIHNvIGxhcmdlciBzY3JpcHRzIHN0YXJ0IGZpcnN0IC0gd29ya2VyIHBvb2wgdXNlcyBhIEZJRk8gcXVldWVcbiAgICAgICAgICBzY3JpcHRzVG9PcHRpbWl6ZS5zb3J0KChhLCBiKSA9PiBhLmNvZGUubGVuZ3RoIC0gYi5jb2RlLmxlbmd0aCk7XG5cbiAgICAgICAgICAvLyBJbml0aWFsaXplIHRoZSB0YXNrIHdvcmtlciBwb29sXG4gICAgICAgICAgY29uc3Qgd29ya2VyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnLi9qYXZhc2NyaXB0LW9wdGltaXplci13b3JrZXInKTtcbiAgICAgICAgICBjb25zdCB3b3JrZXJQb29sID0gbmV3IFBpc2NpbmEoe1xuICAgICAgICAgICAgZmlsZW5hbWU6IHdvcmtlclBhdGgsXG4gICAgICAgICAgICBtYXhUaHJlYWRzOiBNQVhfT1BUSU1JWkVfV09SS0VSUyxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIEVucXVldWUgc2NyaXB0IG9wdGltaXphdGlvbiB0YXNrcyBhbmQgdXBkYXRlIGNvbXBpbGF0aW9uIGFzc2V0cyBhcyB0aGUgdGFza3MgY29tcGxldGVcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdGFza3MgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgeyBuYW1lLCBjb2RlLCBtYXAsIGNhY2hlSXRlbSB9IG9mIHNjcmlwdHNUb09wdGltaXplKSB7XG4gICAgICAgICAgICAgIHRhc2tzLnB1c2goXG4gICAgICAgICAgICAgICAgd29ya2VyUG9vbFxuICAgICAgICAgICAgICAgICAgLnJ1bih7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgICAgICAgICAgIG1hcCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW1pemVPcHRpb25zLFxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgICAgICAoeyBjb2RlLCBuYW1lLCBtYXAgfSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGltaXplZEFzc2V0ID0gbWFwXG4gICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyBTb3VyY2VNYXBTb3VyY2UoY29kZSwgbmFtZSwgbWFwKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2UoY29kZSwgbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgb3B0aW1pemVkQXNzZXQsIHsgbWluaW1pemVkOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlSXRlbT8uc3RvcmVQcm9taXNlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZTogb3B0aW1pemVkQXNzZXQsXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGltaXphdGlvbkVycm9yID0gbmV3IGNvbXBpbGVyLndlYnBhY2suV2VicGFja0Vycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYE9wdGltaXphdGlvbiBlcnJvciBbJHtuYW1lfV06ICR7ZXJyb3Iuc3RhY2sgfHwgZXJyb3IubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24uZXJyb3JzLnB1c2gob3B0aW1pemF0aW9uRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodGFza3MpO1xuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB2b2lkIHdvcmtlclBvb2wuZGVzdHJveSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==