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
                            .then(({ code, name, map }) => {
                            const optimizedAsset = map
                                ? new SourceMapSource(code, name, map)
                                : new OriginalSource(code, name);
                            compilation.updateAsset(name, optimizedAsset, (assetInfo) => ({
                                ...assetInfo,
                                minimized: true,
                            }));
                            logger.timeEnd(`optimize asset: ${name}`);
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
                logger.timeEnd('optimize js assets');
            });
        });
    }
}
exports.JavaScriptOptimizerPlugin = JavaScriptOptimizerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1vcHRpbWl6ZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2phdmFzY3JpcHQtb3B0aW1pemVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxzREFBOEI7QUFDOUIsMkNBQTBDO0FBRTFDLHlFQUE2RDtBQUM3RCx5REFBcUQ7QUFHckQ7O0dBRUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLGdDQUFVLENBQUM7QUFFeEM7O0dBRUc7QUFDSCxNQUFNLFdBQVcsR0FBRyw4QkFBOEIsQ0FBQztBQXNEbkQ7Ozs7Ozs7R0FPRztBQUNILE1BQWEseUJBQXlCO0lBQ3BDLFlBQW1CLE9BQW1DO1FBQW5DLFlBQU8sR0FBUCxPQUFPLENBQTRCO0lBQUcsQ0FBQztJQUUxRCxLQUFLLENBQUMsUUFBa0I7UUFDdEIsTUFBTSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUVyRSxRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDMUQsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO1lBRWhGLFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDeEM7Z0JBQ0UsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxrQ0FBa0M7YUFDdkUsRUFDRCxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxD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QUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDaEUsQ0FBQzs0QkFDRixXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO3dCQUM3QyxDQUFDLENBQ0YsQ0FDSixDQUFDO3FCQUNIO29CQUVELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDMUI7d0JBQVM7b0JBQ1IsS0FBSyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7aUJBQzNCO2dCQUVELE1BQU0sQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUN2QyxDQUFDLENBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcEtELDhEQW9LQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlciwgc291cmNlcyB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgRXNidWlsZEV4ZWN1dG9yIH0gZnJvbSAnLi9lc2J1aWxkLWV4ZWN1dG9yJztcbmltcG9ydCB0eXBlIHsgT3B0aW1pemVSZXF1ZXN0T3B0aW9ucyB9IGZyb20gJy4vamF2YXNjcmlwdC1vcHRpbWl6ZXItd29ya2VyJztcblxuLyoqXG4gKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgV29ya2VycyB0aGF0IHdpbGwgYmUgY3JlYXRlZCB0byBleGVjdXRlIG9wdGltaXplIHRhc2tzLlxuICovXG5jb25zdCBNQVhfT1BUSU1JWkVfV09SS0VSUyA9IG1heFdvcmtlcnM7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIHBsdWdpbiBwcm92aWRlZCB0byBXZWJwYWNrIHdoZW4gdGFwcGluZyBXZWJwYWNrIGNvbXBpbGVyIGhvb2tzLlxuICovXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdhbmd1bGFyLWphdmFzY3JpcHQtb3B0aW1pemVyJztcblxuLyoqXG4gKiBUaGUgb3B0aW9ucyB1c2VkIHRvIGNvbmZpZ3VyZSB0aGUge0BsaW5rIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW59LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEphdmFTY3JpcHRPcHRpbWl6ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVuYWJsZXMgYWR2YW5jZWQgb3B0aW1pemF0aW9ucyBpbiB0aGUgdW5kZXJseWluZyBKYXZhU2NyaXB0IG9wdGltaXplcnMuXG4gICAqIFRoaXMgY3VycmVudGx5IGluY3JlYXNlcyB0aGUgYHRlcnNlcmAgcGFzc2VzIHRvIDIgYW5kIGVuYWJsZXMgdGhlIGBwdXJlX2dldHRlcnNgXG4gICAqIG9wdGlvbiBmb3IgYHRlcnNlcmAuXG4gICAqL1xuICBhZHZhbmNlZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIG9iamVjdCByZWNvcmQgb2Ygc3RyaW5nIGtleXMgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlaXIgcmVzcGVjdGl2ZSB2YWx1ZXMgd2hlbiBmb3VuZFxuICAgKiB3aXRoaW4gdGhlIGNvZGUgZHVyaW5nIG9wdGltaXphdGlvbi5cbiAgICovXG4gIGRlZmluZTogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbj47XG5cbiAgLyoqXG4gICAqIEVuYWJsZXMgdGhlIGdlbmVyYXRpb24gb2YgYSBzb3VyY2VtYXAgZHVyaW5nIG9wdGltaXphdGlvbi5cbiAgICogVGhlIG91dHB1dCBzb3VyY2VtYXAgd2lsbCBiZSBhIGZ1bGwgc291cmNlbWFwIGNvbnRhaW5pbmcgdGhlIG1lcmdlIG9mIHRoZSBpbnB1dCBzb3VyY2VtYXAgYW5kXG4gICAqIGFsbCBpbnRlcm1lZGlhdGUgc291cmNlbWFwcy5cbiAgICovXG4gIHNvdXJjZW1hcD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBFQ01BU2NyaXB0IHZlcnNpb24gdGhhdCBzaG91bGQgYmUgdXNlZCB3aGVuIGdlbmVyYXRpbmcgb3V0cHV0IGNvZGUuXG4gICAqIFRoZSBvcHRpbWl6ZXIgd2lsbCBub3QgYWRqdXN0IHRoZSBvdXRwdXQgY29kZSB3aXRoIGZlYXR1cmVzIHByZXNlbnQgaW4gbmV3ZXJcbiAgICogRUNNQVNjcmlwdCB2ZXJzaW9ucy5cbiAgICovXG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0O1xuXG4gIC8qKlxuICAgKiBFbmFibGVzIHRoZSByZXRlbnRpb24gb2YgaWRlbnRpZmllciBuYW1lcyBhbmQgZW5zdXJlcyB0aGF0IGZ1bmN0aW9uIGFuZCBjbGFzcyBuYW1lcyBhcmVcbiAgICogcHJlc2VudCBpbiB0aGUgb3V0cHV0IGNvZGUuXG4gICAqXG4gICAqICoqTm90ZSoqOiBpbiBzb21lIGNhc2VzIHN5bWJvbHMgYXJlIHN0aWxsIHJlbmFtZWQgdG8gYXZvaWQgY29sbGlzaW9ucy5cbiAgICovXG4gIGtlZXBJZGVudGlmaWVyTmFtZXM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEVuYWJsZXMgdGhlIHJldGVudGlvbiBvZiBvcmlnaW5hbCBuYW1lIG9mIGNsYXNzZXMgYW5kIGZ1bmN0aW9ucy5cbiAgICpcbiAgICogKipOb3RlKio6IHRoaXMgY2F1c2VzIGluY3JlYXNlIG9mIGJ1bmRsZSBzaXplIGFzIGl0IGNhdXNlcyBkZWFkLWNvZGUgZWxpbWluYXRpb24gdG8gbm90IHdvcmsgZnVsbHkuXG4gICAqL1xuICBrZWVwTmFtZXM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEVuYWJsZXMgdGhlIHJlbW92YWwgb2YgYWxsIGxpY2Vuc2UgY29tbWVudHMgZnJvbSB0aGUgb3V0cHV0IGNvZGUuXG4gICAqL1xuICByZW1vdmVMaWNlbnNlcz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBXZWJwYWNrIHBsdWdpbiB0aGF0IHByb3ZpZGVzIEphdmFTY3JpcHQgb3B0aW1pemF0aW9uIGNhcGFiaWxpdGllcy5cbiAqXG4gKiBUaGUgcGx1Z2luIHVzZXMgYm90aCBgZXNidWlsZGAgYW5kIGB0ZXJzZXJgIHRvIHByb3ZpZGUgYm90aCBmYXN0IGFuZCBoaWdobHktb3B0aW1pemVkXG4gKiBjb2RlIG91dHB1dC4gYGVzYnVpbGRgIGlzIHVzZWQgYXMgYW4gaW5pdGlhbCBwYXNzIHRvIHJlbW92ZSB0aGUgbWFqb3JpdHkgb2YgdW51c2VkIGNvZGVcbiAqIGFzIHdlbGwgYXMgc2hvcnRlbiBpZGVudGlmaWVycy4gYHRlcnNlcmAgaXMgdGhlbiB1c2VkIGFzIGEgc2Vjb25kYXJ5IHBhc3MgdG8gYXBwbHlcbiAqIG9wdGltaXphdGlvbnMgbm90IHlldCBpbXBsZW1lbnRlZCBieSBgZXNidWlsZGAuXG4gKi9cbmV4cG9ydCBjbGFzcyBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHVibGljIG9wdGlvbnM6IEphdmFTY3JpcHRPcHRpbWl6ZXJPcHRpb25zKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbnN0IHsgT3JpZ2luYWxTb3VyY2UsIFNvdXJjZU1hcFNvdXJjZSB9ID0gY29tcGlsZXIud2VicGFjay5zb3VyY2VzO1xuXG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKFBMVUdJTl9OQU1FLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbnN0IGxvZ2dlciA9IGNvbXBpbGF0aW9uLmdldExvZ2dlcignYnVpbGQtYW5ndWxhci5KYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luJyk7XG5cbiAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLnByb2Nlc3NBc3NldHMudGFwUHJvbWlzZShcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFBMVUdJTl9OQU1FLFxuICAgICAgICAgIHN0YWdlOiBjb21waWxlci53ZWJwYWNrLkNvbXBpbGF0aW9uLlBST0NFU1NfQVNTRVRTX1NUQUdFX09QVElNSVpFX1NJWkUsXG4gICAgICAgIH0sXG4gICAgICAgIGFzeW5jIChjb21waWxhdGlvbkFzc2V0cykgPT4ge1xuICAgICAgICAgIGxvZ2dlci50aW1lKCdvcHRpbWl6ZSBqcyBhc3NldHMnKTtcbiAgICAgICAgICBjb25zdCBzY3JpcHRzVG9PcHRpbWl6ZSA9IFtdO1xuICAgICAgICAgIGNvbnN0IGNhY2hlID1cbiAgICAgICAgICAgIGNvbXBpbGF0aW9uLm9wdGlvbnMuY2FjaGUgJiYgY29tcGlsYXRpb24uZ2V0Q2FjaGUoJ0phdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4nKTtcblxuICAgICAgICAgIC8vIEFuYWx5emUgdGhlIGNvbXBpbGF0aW9uIGFzc2V0cyBmb3Igc2NyaXB0cyB0aGF0IHJlcXVpcmUgb3B0aW1pemF0aW9uXG4gICAgICAgICAgZm9yIChjb25zdCBhc3NldE5hbWUgb2YgT2JqZWN0LmtleXMoY29tcGlsYXRpb25Bc3NldHMpKSB7XG4gICAgICAgICAgICBpZiAoIWFzc2V0TmFtZS5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdEFzc2V0ID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoYXNzZXROYW1lKTtcbiAgICAgICAgICAgIC8vIFNraXAgYXNzZXRzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gb3B0aW1pemVkIG9yIGFyZSB2ZXJiYXRpbSBjb3BpZXMgKHByb2plY3QgYXNzZXRzKVxuICAgICAgICAgICAgaWYgKCFzY3JpcHRBc3NldCB8fCBzY3JpcHRBc3NldC5pbmZvLm1pbmltaXplZCB8fCBzY3JpcHRBc3NldC5pbmZvLmNvcGllZCkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2U6IHNjcmlwdEFzc2V0U291cmNlLCBuYW1lIH0gPSBzY3JpcHRBc3NldDtcbiAgICAgICAgICAgIGxldCBjYWNoZUl0ZW07XG5cbiAgICAgICAgICAgIGlmIChjYWNoZSkge1xuICAgICAgICAgICAgICBjb25zdCBlVGFnID0gY2FjaGUuZ2V0TGF6eUhhc2hlZEV0YWcoc2NyaXB0QXNzZXRTb3VyY2UpO1xuICAgICAgICAgICAgICBjYWNoZUl0ZW0gPSBjYWNoZS5nZXRJdGVtQ2FjaGUobmFtZSwgZVRhZyk7XG4gICAgICAgICAgICAgIGNvbnN0IGNhY2hlZE91dHB1dCA9IGF3YWl0IGNhY2hlSXRlbS5nZXRQcm9taXNlPFxuICAgICAgICAgICAgICAgIHsgc291cmNlOiBzb3VyY2VzLlNvdXJjZSB9IHwgdW5kZWZpbmVkXG4gICAgICAgICAgICAgID4oKTtcblxuICAgICAgICAgICAgICBpZiAoY2FjaGVkT3V0cHV0KSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKGAke25hbWV9IHJlc3RvcmVkIGZyb20gY2FjaGVgKTtcbiAgICAgICAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGVBc3NldChuYW1lLCBjYWNoZWRPdXRwdXQuc291cmNlLCAoYXNzZXRJbmZvKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IHNvdXJjZSwgbWFwIH0gPSBzY3JpcHRBc3NldFNvdXJjZS5zb3VyY2VBbmRNYXAoKTtcbiAgICAgICAgICAgIHNjcmlwdHNUb09wdGltaXplLnB1c2goe1xuICAgICAgICAgICAgICBuYW1lOiBzY3JpcHRBc3NldC5uYW1lLFxuICAgICAgICAgICAgICBjb2RlOiB0eXBlb2Ygc291cmNlID09PSAnc3RyaW5nJyA/IHNvdXJjZSA6IHNvdXJjZS50b1N0cmluZygpLFxuICAgICAgICAgICAgICBtYXAsXG4gICAgICAgICAgICAgIGNhY2hlSXRlbSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzY3JpcHRzVG9PcHRpbWl6ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBFbnN1cmUgYWxsIHJlcGxhY2VtZW50IHZhbHVlcyBhcmUgc3RyaW5ncyB3aGljaCBpcyB0aGUgZXhwZWN0ZWQgdHlwZSBmb3IgZXNidWlsZFxuICAgICAgICAgIGxldCBkZWZpbmU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAgIGRlZmluZSA9IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5vcHRpb25zLmRlZmluZSkpIHtcbiAgICAgICAgICAgICAgZGVmaW5lW2tleV0gPSBTdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCB0YXJnZXQ6IE9wdGltaXplUmVxdWVzdE9wdGlvbnNbJ3RhcmdldCddID0gMjAxNztcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRhcmdldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy50YXJnZXQgPD0gU2NyaXB0VGFyZ2V0LkVTNSkge1xuICAgICAgICAgICAgICB0YXJnZXQgPSA1O1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMudGFyZ2V0ID09PSBTY3JpcHRUYXJnZXQuRVNOZXh0KSB7XG4gICAgICAgICAgICAgIHRhcmdldCA9ICduZXh0JztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRhcmdldCA9IE51bWJlcihcbiAgICAgICAgICAgICAgICBTY3JpcHRUYXJnZXRbdGhpcy5vcHRpb25zLnRhcmdldF0uc2xpY2UoMiksXG4gICAgICAgICAgICAgICkgYXMgT3B0aW1pemVSZXF1ZXN0T3B0aW9uc1sndGFyZ2V0J107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gU2V0dXAgdGhlIG9wdGlvbnMgdXNlZCBieSBhbGwgd29ya2VyIHRhc2tzXG4gICAgICAgICAgY29uc3Qgb3B0aW1pemVPcHRpb25zOiBPcHRpbWl6ZVJlcXVlc3RPcHRpb25zID0ge1xuICAgICAgICAgICAgc291cmNlbWFwOiB0aGlzLm9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgZGVmaW5lLFxuICAgICAgICAgICAga2VlcE5hbWVzOiB0aGlzLm9wdGlvbnMua2VlcE5hbWVzLFxuICAgICAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogdGhpcy5vcHRpb25zLmtlZXBJZGVudGlmaWVyTmFtZXMsXG4gICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICByZW1vdmVMaWNlbnNlczogdGhpcy5vcHRpb25zLnJlbW92ZUxpY2Vuc2VzLFxuICAgICAgICAgICAgYWR2YW5jZWQ6IHRoaXMub3B0aW9ucy5hZHZhbmNlZCxcbiAgICAgICAgICAgIC8vIFBlcmZvcm0gYSBzaW5nbGUgbmF0aXZlIGVzYnVpbGQgc3VwcG9ydCBjaGVjay5cbiAgICAgICAgICAgIC8vIFRoaXMgcmVtb3ZlcyB0aGUgbmVlZCBmb3IgZWFjaCB3b3JrZXIgdG8gcGVyZm9ybSB0aGUgY2hlY2sgd2hpY2ggd291bGRcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSByZXF1aXJlIHNwYXduaW5nIGEgc2VwYXJhdGUgcHJvY2VzcyBwZXIgd29ya2VyLlxuICAgICAgICAgICAgYWx3YXlzVXNlV2FzbTogIUVzYnVpbGRFeGVjdXRvci5oYXNOYXRpdmVTdXBwb3J0KCksXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIFNvcnQgc2NyaXB0cyBzbyBsYXJnZXIgc2NyaXB0cyBzdGFydCBmaXJzdCAtIHdvcmtlciBwb29sIHVzZXMgYSBGSUZPIHF1ZXVlXG4gICAgICAgICAgc2NyaXB0c1RvT3B0aW1pemUuc29ydCgoYSwgYikgPT4gYS5jb2RlLmxlbmd0aCAtIGIuY29kZS5sZW5ndGgpO1xuXG4gICAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgdGFzayB3b3JrZXIgcG9vbFxuICAgICAgICAgIGNvbnN0IHdvcmtlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJy4vamF2YXNjcmlwdC1vcHRpbWl6ZXItd29ya2VyJyk7XG4gICAgICAgICAgY29uc3Qgd29ya2VyUG9vbCA9IG5ldyBQaXNjaW5hKHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiB3b3JrZXJQYXRoLFxuICAgICAgICAgICAgbWF4VGhyZWFkczogTUFYX09QVElNSVpFX1dPUktFUlMsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBFbnF1ZXVlIHNjcmlwdCBvcHRpbWl6YXRpb24gdGFza3MgYW5kIHVwZGF0ZSBjb21waWxhdGlvbiBhc3NldHMgYXMgdGhlIHRhc2tzIGNvbXBsZXRlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRhc2tzID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgbmFtZSwgY29kZSwgbWFwLCBjYWNoZUl0ZW0gfSBvZiBzY3JpcHRzVG9PcHRpbWl6ZSkge1xuICAgICAgICAgICAgICBsb2dnZXIudGltZShgb3B0aW1pemUgYXNzZXQ6ICR7bmFtZX1gKTtcblxuICAgICAgICAgICAgICB0YXNrcy5wdXNoKFxuICAgICAgICAgICAgICAgIHdvcmtlclBvb2xcbiAgICAgICAgICAgICAgICAgIC5ydW4oe1xuICAgICAgICAgICAgICAgICAgICBhc3NldDoge1xuICAgICAgICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgY29kZSxcbiAgICAgICAgICAgICAgICAgICAgICBtYXAsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGltaXplT3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICAgICAgKHsgY29kZSwgbmFtZSwgbWFwIH0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvcHRpbWl6ZWRBc3NldCA9IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgPyBuZXcgU291cmNlTWFwU291cmNlKGNvZGUsIG5hbWUsIG1hcClcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbmV3IE9yaWdpbmFsU291cmNlKGNvZGUsIG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGF0aW9uLnVwZGF0ZUFzc2V0KG5hbWUsIG9wdGltaXplZEFzc2V0LCAoYXNzZXRJbmZvKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci50aW1lRW5kKGBvcHRpbWl6ZSBhc3NldDogJHtuYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlSXRlbT8uc3RvcmVQcm9taXNlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZTogb3B0aW1pemVkQXNzZXQsXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGltaXphdGlvbkVycm9yID0gbmV3IGNvbXBpbGVyLndlYnBhY2suV2VicGFja0Vycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYE9wdGltaXphdGlvbiBlcnJvciBbJHtuYW1lfV06ICR7ZXJyb3Iuc3RhY2sgfHwgZXJyb3IubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24uZXJyb3JzLnB1c2gob3B0aW1pemF0aW9uRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodGFza3MpO1xuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB2b2lkIHdvcmtlclBvb2wuZGVzdHJveSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxvZ2dlci50aW1lRW5kKCdvcHRpbWl6ZSBqcyBhc3NldHMnKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==