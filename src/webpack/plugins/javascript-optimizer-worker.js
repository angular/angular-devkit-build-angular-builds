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
const remapping_1 = __importDefault(require("@ampproject/remapping"));
const terser_1 = require("terser");
const esbuild_executor_1 = require("./esbuild-executor");
/**
 * The cached esbuild executor.
 * This will automatically use the native or WASM version based on platform and availability
 * with the native version given priority due to its superior performance.
 */
let esbuild;
/**
 * Handles optimization requests sent from the main thread via the `JavaScriptOptimizerPlugin`.
 */
async function default_1({ asset, options }) {
    // esbuild is used as a first pass
    const esbuildResult = await optimizeWithEsbuild(asset.code, asset.name, options);
    // terser is used as a second pass
    const terserResult = await optimizeWithTerser(asset.name, esbuildResult.code, options.sourcemap, 
    // Terser only supports up to ES2020.
    options.target === 'next' ? 2020 : options.target, options.advanced);
    // Merge intermediate sourcemaps with input sourcemap if enabled
    let fullSourcemap;
    if (options.sourcemap) {
        const partialSourcemaps = [];
        if (esbuildResult.map) {
            partialSourcemaps.unshift(JSON.parse(esbuildResult.map));
        }
        if (terserResult.map) {
            partialSourcemaps.unshift(terserResult.map);
        }
        if (asset.map) {
            partialSourcemaps.push(asset.map);
        }
        fullSourcemap = (0, remapping_1.default)(partialSourcemaps, () => null);
    }
    return { name: asset.name, code: terserResult.code, map: fullSourcemap };
}
exports.default = default_1;
/**
 * Optimizes a JavaScript asset using esbuild.
 *
 * @param content The JavaScript asset source content to optimize.
 * @param name The name of the JavaScript asset. Used to generate source maps.
 * @param options The optimization request options to apply to the content.
 * @returns A promise that resolves with the optimized code, source map, and any warnings.
 */
async function optimizeWithEsbuild(content, name, options) {
    var _a;
    if (!esbuild) {
        esbuild = new esbuild_executor_1.EsbuildExecutor(options.alwaysUseWasm);
    }
    let result;
    try {
        result = await esbuild.transform(content, {
            minifyIdentifiers: !options.keepIdentifierNames,
            minifySyntax: true,
            // NOTE: Disabling whitespace ensures unused pure annotations are kept
            minifyWhitespace: false,
            pure: ['forwardRef'],
            legalComments: options.removeLicenses ? 'none' : 'inline',
            sourcefile: name,
            sourcemap: options.sourcemap && 'external',
            define: options.define,
            // This option should always be disabled for browser builds as we don't rely on `.name`
            // and causes deadcode to be retained which makes `NG_BUILD_MANGLE` unusable to investigate tree-shaking issues.
            // We enable `keepNames` only for server builds as Domino relies on `.name`.
            // Once we no longer rely on Domino for SSR we should be able to remove this.
            keepNames: options.keepNames,
            target: `es${options.target}`,
        });
    }
    catch (error) {
        const failure = error;
        // If esbuild fails with only ES5 support errors, fallback to just terser.
        // This will only happen if ES5 is the output target and a global script contains ES2015+ syntax.
        // In that case, the global script is technically already invalid for the target environment but
        // this is and has been considered a configuration issue. Global scripts must be compatible with
        // the target environment.
        if ((_a = failure.errors) === null || _a === void 0 ? void 0 : _a.every((error) => error.text.includes('to the configured target environment ("es5") is not supported yet'))) {
            result = {
                code: content,
                map: '',
                warnings: [],
            };
        }
        else {
            throw error;
        }
    }
    return result;
}
/**
 * Optimizes a JavaScript asset using terser.
 *
 * @param name The name of the JavaScript asset. Used to generate source maps.
 * @param code The JavaScript asset source content to optimize.
 * @param sourcemaps If true, generate an output source map for the optimized code.
 * @param target Specifies the target ECMAScript version for the output code.
 * @param advanced Controls advanced optimizations.
 * @returns A promise that resolves with the optimized code and source map.
 */
async function optimizeWithTerser(name, code, sourcemaps, target, advanced) {
    const result = await (0, terser_1.minify)({ [name]: code }, {
        compress: {
            passes: advanced ? 2 : 1,
            pure_getters: advanced,
        },
        ecma: target,
        // esbuild in the first pass is used to minify identifiers instead of mangle here
        mangle: false,
        // esbuild in the first pass is used to minify function names
        keep_fnames: true,
        format: {
            // ASCII output is enabled here as well to prevent terser from converting back to UTF-8
            ascii_only: true,
            wrap_func_args: false,
        },
        sourceMap: sourcemaps &&
            {
                asObject: true,
                // typings don't include asObject option
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            },
    });
    if (!result.code) {
        throw new Error('Terser failed for unknown reason.');
    }
    return { code: result.code, map: result.map };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1vcHRpbWl6ZXItd29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2phdmFzY3JpcHQtb3B0aW1pemVyLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7OztBQUVILHNFQUE4QztBQUU5QyxtQ0FBZ0M7QUFDaEMseURBQXFEO0FBNkVyRDs7OztHQUlHO0FBQ0gsSUFBSSxPQUFvQyxDQUFDO0FBRXpDOztHQUVHO0FBQ1ksS0FBSyxvQkFBVyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQW1CO0lBQ2hFLGtDQUFrQztJQUNsQyxNQUFNLGFBQWEsR0FBRyxNQUFNLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVqRixrQ0FBa0M7SUFDbEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxrQkFBa0IsQ0FDM0MsS0FBSyxDQUFDLElBQUksRUFDVixhQUFhLENBQUMsSUFBSSxFQUNsQixPQUFPLENBQUMsU0FBUztJQUNqQixxQ0FBcUM7SUFDckMsT0FBTyxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFDakQsT0FBTyxDQUFDLFFBQVEsQ0FDakIsQ0FBQztJQUVGLGdFQUFnRTtJQUNoRSxJQUFJLGFBQWEsQ0FBQztJQUNsQixJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUU7UUFDckIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7UUFFN0IsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFO1lBQ3JCLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFH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TUFBTSxFQUFFLEtBQUs7UUFDYiw2REFBNkQ7UUFDN0QsV0FBVyxFQUFFLElBQUk7UUFDakIsTUFBTSxFQUFFO1lBQ04sdUZBQXVGO1lBQ3ZGLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLGNBQWMsRUFBRSxLQUFLO1NBQ3RCO1FBQ0QsU0FBUyxFQUNQLFVBQVU7WUFDVDtnQkFDQyxRQUFRLEVBQUUsSUFBSTtnQkFDZCx3Q0FBd0M7Z0JBQ3hDLDhEQUE4RDthQUN2RDtLQUNaLENBQ0YsQ0FBQztJQUVGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO1FBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztLQUN0RDtJQUVELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQWEsRUFBRSxDQUFDO0FBQzFELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHJlbWFwcGluZyBmcm9tICdAYW1wcHJvamVjdC9yZW1hcHBpbmcnO1xuaW1wb3J0IHR5cGUgeyBUcmFuc2Zvcm1GYWlsdXJlLCBUcmFuc2Zvcm1SZXN1bHQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IG1pbmlmeSB9IGZyb20gJ3RlcnNlcic7XG5pbXBvcnQgeyBFc2J1aWxkRXhlY3V0b3IgfSBmcm9tICcuL2VzYnVpbGQtZXhlY3V0b3InO1xuXG4vKipcbiAqIFRoZSBvcHRpb25zIHRvIHVzZSB3aGVuIG9wdGltaXppbmcuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW1pemVSZXF1ZXN0T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBDb250cm9scyBhZHZhbmNlZCBvcHRpbWl6YXRpb25zLlxuICAgKiBDdXJyZW50bHkgdGhlc2UgYXJlIG9ubHkgdGVyc2VyIHJlbGF0ZWQ6XG4gICAqICogdGVyc2VyIGNvbXByZXNzIHBhc3NlcyBhcmUgc2V0IHRvIDJcbiAgICogKiB0ZXJzZXIgcHVyZV9nZXR0ZXJzIG9wdGlvbiBpcyBlbmFibGVkXG4gICAqL1xuICBhZHZhbmNlZD86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBTcGVjaWZpZXMgdGhlIHN0cmluZyB0b2tlbnMgdGhhdCBzaG91bGQgYmUgcmVwbGFjZWQgd2l0aCBhIGRlZmluZWQgdmFsdWUuXG4gICAqL1xuICBkZWZpbmU/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAvKipcbiAgICogQ29udHJvbHMgd2hldGhlciBjbGFzcywgZnVuY3Rpb24sIGFuZCB2YXJpYWJsZSBuYW1lcyBzaG91bGQgYmUgbGVmdCBpbnRhY3RcbiAgICogdGhyb3VnaG91dCB0aGUgb3V0cHV0IGNvZGUuXG4gICAqL1xuICBrZWVwSWRlbnRpZmllck5hbWVzOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBDb250cm9scyB3aGV0aGVyIHRvIHJldGFpbiB0aGUgb3JpZ2luYWwgbmFtZSBvZiBjbGFzc2VzIGFuZCBmdW5jdGlvbnMuXG4gICAqL1xuICBrZWVwTmFtZXM6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBDb250cm9scyB3aGV0aGVyIGxpY2Vuc2UgdGV4dCBpcyByZW1vdmVkIGZyb20gdGhlIG91dHB1dCBjb2RlLlxuICAgKiBXaXRoaW4gdGhlIENMSSwgdGhpcyBvcHRpb24gaXMgbGlua2VkIHRvIHRoZSBsaWNlbnNlIGV4dHJhY3Rpb24gZnVuY3Rpb25hbGl0eS5cbiAgICovXG4gIHJlbW92ZUxpY2Vuc2VzPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIENvbnRyb2xzIHdoZXRoZXIgc291cmNlIG1hcHMgc2hvdWxkIGJlIGdlbmVyYXRlZC5cbiAgICovXG4gIHNvdXJjZW1hcD86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBTcGVjaWZpZXMgdGhlIHRhcmdldCBFQ01BU2NyaXB0IHZlcnNpb24gZm9yIHRoZSBvdXRwdXQgY29kZS5cbiAgICovXG4gIHRhcmdldDogNSB8IDIwMTUgfCAyMDE2IHwgMjAxNyB8IDIwMTggfCAyMDE5IHwgMjAyMCB8ICduZXh0JztcbiAgLyoqXG4gICAqIENvbnRyb2xzIHdoZXRoZXIgZXNidWlsZCBzaG91bGQgb25seSB1c2UgdGhlIFdBU00tdmFyaWFudCBpbnN0ZWFkIG9mIHRyeWluZyB0b1xuICAgKiB1c2UgdGhlIG5hdGl2ZSB2YXJpYW50LiBTb21lIHBsYXRmb3JtcyBtYXkgbm90IHN1cHBvcnQgdGhlIG5hdGl2ZS12YXJpYW50IGFuZFxuICAgKiB0aGlzIG9wdGlvbiBhbGxvd3Mgb25lIHN1cHBvcnQgdGVzdCB0byBiZSBjb25kdWN0ZWQgcHJpb3IgdG8gYWxsIHRoZSB3b3JrZXJzIHN0YXJ0aW5nLlxuICAgKi9cbiAgYWx3YXlzVXNlV2FzbTogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBBIHJlcXVlc3QgdG8gb3B0aW1pemUgSmF2YVNjcmlwdCB1c2luZyB0aGUgc3VwcGxpZWQgb3B0aW9ucy5cbiAqL1xuaW50ZXJmYWNlIE9wdGltaXplUmVxdWVzdCB7XG4gIC8qKlxuICAgKiBUaGUgb3B0aW9ucyB0byB1c2Ugd2hlbiBvcHRpbWl6aW5nLlxuICAgKi9cbiAgb3B0aW9uczogT3B0aW1pemVSZXF1ZXN0T3B0aW9ucztcblxuICAvKipcbiAgICogVGhlIEphdmFTY3JpcHQgYXNzZXQgdG8gb3B0aW1pemUuXG4gICAqL1xuICBhc3NldDoge1xuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSBKYXZhU2NyaXB0IGFzc2V0ICh0eXBpY2FsbHkgdGhlIGZpbGVuYW1lKS5cbiAgICAgKi9cbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIHNvdXJjZSBjb250ZW50IG9mIHRoZSBKYXZhU2NyaXB0IGFzc2V0LlxuICAgICAqL1xuICAgIGNvZGU6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgc291cmNlIG1hcCBvZiB0aGUgSmF2YVNjcmlwdCBhc3NldCwgaWYgYXZhaWxhYmxlLlxuICAgICAqIFRoaXMgbWFwIGlzIG1lcmdlZCB3aXRoIGFsbCBpbnRlcm1lZGlhdGUgc291cmNlIG1hcHMgZHVyaW5nIG9wdGltaXphdGlvbi5cbiAgICAgKi9cbiAgICBtYXA6IG9iamVjdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBUaGUgY2FjaGVkIGVzYnVpbGQgZXhlY3V0b3IuXG4gKiBUaGlzIHdpbGwgYXV0b21hdGljYWxseSB1c2UgdGhlIG5hdGl2ZSBvciBXQVNNIHZlcnNpb24gYmFzZWQgb24gcGxhdGZvcm0gYW5kIGF2YWlsYWJpbGl0eVxuICogd2l0aCB0aGUgbmF0aXZlIHZlcnNpb24gZ2l2ZW4gcHJpb3JpdHkgZHVlIHRvIGl0cyBzdXBlcmlvciBwZXJmb3JtYW5jZS5cbiAqL1xubGV0IGVzYnVpbGQ6IEVzYnVpbGRFeGVjdXRvciB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBIYW5kbGVzIG9wdGltaXphdGlvbiByZXF1ZXN0cyBzZW50IGZyb20gdGhlIG1haW4gdGhyZWFkIHZpYSB0aGUgYEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW5gLlxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiAoeyBhc3NldCwgb3B0aW9ucyB9OiBPcHRpbWl6ZVJlcXVlc3QpIHtcbiAgLy8gZXNidWlsZCBpcyB1c2VkIGFzIGEgZmlyc3QgcGFzc1xuICBjb25zdCBlc2J1aWxkUmVzdWx0ID0gYXdhaXQgb3B0aW1pemVXaXRoRXNidWlsZChhc3NldC5jb2RlLCBhc3NldC5uYW1lLCBvcHRpb25zKTtcblxuICAvLyB0ZXJzZXIgaXMgdXNlZCBhcyBhIHNlY29uZCBwYXNzXG4gIGNvbnN0IHRlcnNlclJlc3VsdCA9IGF3YWl0IG9wdGltaXplV2l0aFRlcnNlcihcbiAgICBhc3NldC5uYW1lLFxuICAgIGVzYnVpbGRSZXN1bHQuY29kZSxcbiAgICBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAvLyBUZXJzZXIgb25seSBzdXBwb3J0cyB1cCB0byBFUzIwMjAuXG4gICAgb3B0aW9ucy50YXJnZXQgPT09ICduZXh0JyA/IDIwMjAgOiBvcHRpb25zLnRhcmdldCxcbiAgICBvcHRpb25zLmFkdmFuY2VkLFxuICApO1xuXG4gIC8vIE1lcmdlIGludGVybWVkaWF0ZSBzb3VyY2VtYXBzIHdpdGggaW5wdXQgc291cmNlbWFwIGlmIGVuYWJsZWRcbiAgbGV0IGZ1bGxTb3VyY2VtYXA7XG4gIGlmIChvcHRpb25zLnNvdXJjZW1hcCkge1xuICAgIGNvbnN0IHBhcnRpYWxTb3VyY2VtYXBzID0gW107XG5cbiAgICBpZiAoZXNidWlsZFJlc3VsdC5tYXApIHtcbiAgICAgIHBhcnRpYWxTb3VyY2VtYXBzLnVuc2hpZnQoSlNPTi5wYXJzZShlc2J1aWxkUmVzdWx0Lm1hcCkpO1xuICAgIH1cblxuICAgIGlmICh0ZXJzZXJSZXN1bHQubWFwKSB7XG4gICAgICBwYXJ0aWFsU291cmNlbWFwcy51bnNoaWZ0KHRlcnNlclJlc3VsdC5tYXApO1xuICAgIH1cblxuICAgIGlmIChhc3NldC5tYXApIHtcbiAgICAgIHBhcnRpYWxTb3VyY2VtYXBzLnB1c2goYXNzZXQubWFwKTtcbiAgICB9XG5cbiAgICBmdWxsU291cmNlbWFwID0gcmVtYXBwaW5nKHBhcnRpYWxTb3VyY2VtYXBzLCAoKSA9PiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiB7IG5hbWU6IGFzc2V0Lm5hbWUsIGNvZGU6IHRlcnNlclJlc3VsdC5jb2RlLCBtYXA6IGZ1bGxTb3VyY2VtYXAgfTtcbn1cblxuLyoqXG4gKiBPcHRpbWl6ZXMgYSBKYXZhU2NyaXB0IGFzc2V0IHVzaW5nIGVzYnVpbGQuXG4gKlxuICogQHBhcmFtIGNvbnRlbnQgVGhlIEphdmFTY3JpcHQgYXNzZXQgc291cmNlIGNvbnRlbnQgdG8gb3B0aW1pemUuXG4gKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgSmF2YVNjcmlwdCBhc3NldC4gVXNlZCB0byBnZW5lcmF0ZSBzb3VyY2UgbWFwcy5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpbWl6YXRpb24gcmVxdWVzdCBvcHRpb25zIHRvIGFwcGx5IHRvIHRoZSBjb250ZW50LlxuICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgb3B0aW1pemVkIGNvZGUsIHNvdXJjZSBtYXAsIGFuZCBhbnkgd2FybmluZ3MuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIG9wdGltaXplV2l0aEVzYnVpbGQoXG4gIGNvbnRlbnQ6IHN0cmluZyxcbiAgbmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBPcHRpbWl6ZVJlcXVlc3RbJ29wdGlvbnMnXSxcbik6IFByb21pc2U8VHJhbnNmb3JtUmVzdWx0PiB7XG4gIGlmICghZXNidWlsZCkge1xuICAgIGVzYnVpbGQgPSBuZXcgRXNidWlsZEV4ZWN1dG9yKG9wdGlvbnMuYWx3YXlzVXNlV2FzbSk7XG4gIH1cblxuICBsZXQgcmVzdWx0OiBUcmFuc2Zvcm1SZXN1bHQ7XG4gIHRyeSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgZXNidWlsZC50cmFuc2Zvcm0oY29udGVudCwge1xuICAgICAgbWluaWZ5SWRlbnRpZmllcnM6ICFvcHRpb25zLmtlZXBJZGVudGlmaWVyTmFtZXMsXG4gICAgICBtaW5pZnlTeW50YXg6IHRydWUsXG4gICAgICAvLyBOT1RFOiBEaXNhYmxpbmcgd2hpdGVzcGFjZSBlbnN1cmVzIHVudXNlZCBwdXJlIGFubm90YXRpb25zIGFyZSBrZXB0XG4gICAgICBtaW5pZnlXaGl0ZXNwYWNlOiBmYWxzZSxcbiAgICAgIHB1cmU6IFsnZm9yd2FyZFJlZiddLFxuICAgICAgbGVnYWxDb21tZW50czogb3B0aW9ucy5yZW1vdmVMaWNlbnNlcyA/ICdub25lJyA6ICdpbmxpbmUnLFxuICAgICAgc291cmNlZmlsZTogbmFtZSxcbiAgICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAgJiYgJ2V4dGVybmFsJyxcbiAgICAgIGRlZmluZTogb3B0aW9ucy5kZWZpbmUsXG4gICAgICAvLyBUaGlzIG9wdGlvbiBzaG91bGQgYWx3YXlzIGJlIGRpc2FibGVkIGZvciBicm93c2VyIGJ1aWxkcyBhcyB3ZSBkb24ndCByZWx5IG9uIGAubmFtZWBcbiAgICAgIC8vIGFuZCBjYXVzZXMgZGVhZGNvZGUgdG8gYmUgcmV0YWluZWQgd2hpY2ggbWFrZXMgYE5HX0JVSUxEX01BTkdMRWAgdW51c2FibGUgdG8gaW52ZXN0aWdhdGUgdHJlZS1zaGFraW5nIGlzc3Vlcy5cbiAgICAgIC8vIFdlIGVuYWJsZSBga2VlcE5hbWVzYCBvbmx5IGZvciBzZXJ2ZXIgYnVpbGRzIGFzIERvbWlubyByZWxpZXMgb24gYC5uYW1lYC5cbiAgICAgIC8vIE9uY2Ugd2Ugbm8gbG9uZ2VyIHJlbHkgb24gRG9taW5vIGZvciBTU1Igd2Ugc2hvdWxkIGJlIGFibGUgdG8gcmVtb3ZlIHRoaXMuXG4gICAgICBrZWVwTmFtZXM6IG9wdGlvbnMua2VlcE5hbWVzLFxuICAgICAgdGFyZ2V0OiBgZXMke29wdGlvbnMudGFyZ2V0fWAsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgZmFpbHVyZSA9IGVycm9yIGFzIFRyYW5zZm9ybUZhaWx1cmU7XG5cbiAgICAvLyBJZiBlc2J1aWxkIGZhaWxzIHdpdGggb25seSBFUzUgc3VwcG9ydCBlcnJvcnMsIGZhbGxiYWNrIHRvIGp1c3QgdGVyc2VyLlxuICAgIC8vIFRoaXMgd2lsbCBvbmx5IGhhcHBlbiBpZiBFUzUgaXMgdGhlIG91dHB1dCB0YXJnZXQgYW5kIGEgZ2xvYmFsIHNjcmlwdCBjb250YWlucyBFUzIwMTUrIHN5bnRheC5cbiAgICAvLyBJbiB0aGF0IGNhc2UsIHRoZSBnbG9iYWwgc2NyaXB0IGlzIHRlY2huaWNhbGx5IGFscmVhZHkgaW52YWxpZCBmb3IgdGhlIHRhcmdldCBlbnZpcm9ubWVudCBidXRcbiAgICAvLyB0aGlzIGlzIGFuZCBoYXMgYmVlbiBjb25zaWRlcmVkIGEgY29uZmlndXJhdGlvbiBpc3N1ZS4gR2xvYmFsIHNjcmlwdHMgbXVzdCBiZSBjb21wYXRpYmxlIHdpdGhcbiAgICAvLyB0aGUgdGFyZ2V0IGVudmlyb25tZW50LlxuICAgIGlmIChcbiAgICAgIGZhaWx1cmUuZXJyb3JzPy5ldmVyeSgoZXJyb3IpID0+XG4gICAgICAgIGVycm9yLnRleHQuaW5jbHVkZXMoJ3RvIHRoZSBjb25maWd1cmVkIHRhcmdldCBlbnZpcm9ubWVudCAoXCJlczVcIikgaXMgbm90IHN1cHBvcnRlZCB5ZXQnKSxcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgY29kZTogY29udGVudCxcbiAgICAgICAgbWFwOiAnJyxcbiAgICAgICAgd2FybmluZ3M6IFtdLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBPcHRpbWl6ZXMgYSBKYXZhU2NyaXB0IGFzc2V0IHVzaW5nIHRlcnNlci5cbiAqXG4gKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgSmF2YVNjcmlwdCBhc3NldC4gVXNlZCB0byBnZW5lcmF0ZSBzb3VyY2UgbWFwcy5cbiAqIEBwYXJhbSBjb2RlIFRoZSBKYXZhU2NyaXB0IGFzc2V0IHNvdXJjZSBjb250ZW50IHRvIG9wdGltaXplLlxuICogQHBhcmFtIHNvdXJjZW1hcHMgSWYgdHJ1ZSwgZ2VuZXJhdGUgYW4gb3V0cHV0IHNvdXJjZSBtYXAgZm9yIHRoZSBvcHRpbWl6ZWQgY29kZS5cbiAqIEBwYXJhbSB0YXJnZXQgU3BlY2lmaWVzIHRoZSB0YXJnZXQgRUNNQVNjcmlwdCB2ZXJzaW9uIGZvciB0aGUgb3V0cHV0IGNvZGUuXG4gKiBAcGFyYW0gYWR2YW5jZWQgQ29udHJvbHMgYWR2YW5jZWQgb3B0aW1pemF0aW9ucy5cbiAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIG9wdGltaXplZCBjb2RlIGFuZCBzb3VyY2UgbWFwLlxuICovXG5hc3luYyBmdW5jdGlvbiBvcHRpbWl6ZVdpdGhUZXJzZXIoXG4gIG5hbWU6IHN0cmluZyxcbiAgY29kZTogc3RyaW5nLFxuICBzb3VyY2VtYXBzOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuICB0YXJnZXQ6IEV4Y2x1ZGU8T3B0aW1pemVSZXF1ZXN0WydvcHRpb25zJ11bJ3RhcmdldCddLCAnbmV4dCc+LFxuICBhZHZhbmNlZDogYm9vbGVhbiB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8eyBjb2RlOiBzdHJpbmc7IG1hcD86IG9iamVjdCB9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG1pbmlmeShcbiAgICB7IFtuYW1lXTogY29kZSB9LFxuICAgIHtcbiAgICAgIGNvbXByZXNzOiB7XG4gICAgICAgIHBhc3NlczogYWR2YW5jZWQgPyAyIDogMSxcbiAgICAgICAgcHVyZV9nZXR0ZXJzOiBhZHZhbmNlZCxcbiAgICAgIH0sXG4gICAgICBlY21hOiB0YXJnZXQsXG4gICAgICAvLyBlc2J1aWxkIGluIHRoZSBmaXJzdCBwYXNzIGlzIHVzZWQgdG8gbWluaWZ5IGlkZW50aWZpZXJzIGluc3RlYWQgb2YgbWFuZ2xlIGhlcmVcbiAgICAgIG1hbmdsZTogZmFsc2UsXG4gICAgICAvLyBlc2J1aWxkIGluIHRoZSBmaXJzdCBwYXNzIGlzIHVzZWQgdG8gbWluaWZ5IGZ1bmN0aW9uIG5hbWVzXG4gICAgICBrZWVwX2ZuYW1lczogdHJ1ZSxcbiAgICAgIGZvcm1hdDoge1xuICAgICAgICAvLyBBU0NJSSBvdXRwdXQgaXMgZW5hYmxlZCBoZXJlIGFzIHdlbGwgdG8gcHJldmVudCB0ZXJzZXIgZnJvbSBjb252ZXJ0aW5nIGJhY2sgdG8gVVRGLThcbiAgICAgICAgYXNjaWlfb25seTogdHJ1ZSxcbiAgICAgICAgd3JhcF9mdW5jX2FyZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHNvdXJjZU1hcDpcbiAgICAgICAgc291cmNlbWFwcyAmJlxuICAgICAgICAoe1xuICAgICAgICAgIGFzT2JqZWN0OiB0cnVlLFxuICAgICAgICAgIC8vIHR5cGluZ3MgZG9uJ3QgaW5jbHVkZSBhc09iamVjdCBvcHRpb25cbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICB9IGFzIGFueSksXG4gICAgfSxcbiAgKTtcblxuICBpZiAoIXJlc3VsdC5jb2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUZXJzZXIgZmFpbGVkIGZvciB1bmtub3duIHJlYXNvbi4nKTtcbiAgfVxuXG4gIHJldHVybiB7IGNvZGU6IHJlc3VsdC5jb2RlLCBtYXA6IHJlc3VsdC5tYXAgYXMgb2JqZWN0IH07XG59XG4iXX0=