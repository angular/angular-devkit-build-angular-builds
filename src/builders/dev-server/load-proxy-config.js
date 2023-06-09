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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProxyConfiguration = void 0;
const fast_glob_1 = require("fast-glob");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const picomatch_1 = require("picomatch");
const error_1 = require("../../utils/error");
const load_esm_1 = require("../../utils/load-esm");
async function loadProxyConfiguration(root, proxyConfig, normalize = false) {
    if (!proxyConfig) {
        return undefined;
    }
    const proxyPath = (0, node_path_1.resolve)(root, proxyConfig);
    if (!(0, node_fs_1.existsSync)(proxyPath)) {
        throw new Error(`Proxy configuration file ${proxyPath} does not exist.`);
    }
    let proxyConfiguration;
    switch ((0, node_path_1.extname)(proxyPath)) {
        case '.json': {
            const content = await (0, promises_1.readFile)(proxyPath, 'utf-8');
            const { parse, printParseErrorCode } = await Promise.resolve().then(() => __importStar(require('jsonc-parser')));
            const parseErrors = [];
            proxyConfiguration = parse(content, parseErrors, { allowTrailingComma: true });
            if (parseErrors.length > 0) {
                let errorMessage = `Proxy configuration file ${proxyPath} contains parse errors:`;
                for (const parseError of parseErrors) {
                    const { line, column } = getJsonErrorLineColumn(parseError.offset, content);
                    errorMessage += `\n[${line}, ${column}] ${printParseErrorCode(parseError.error)}`;
                }
                throw new Error(errorMessage);
            }
            break;
        }
        case '.mjs':
            // Load the ESM configuration file using the TypeScript dynamic import workaround.
            // Once TypeScript provides support for keeping the dynamic import this workaround can be
            // changed to a direct dynamic import.
            proxyConfiguration = (await (0, load_esm_1.loadEsmModule)((0, node_url_1.pathToFileURL)(proxyPath)))
                .default;
            break;
        case '.cjs':
            proxyConfiguration = require(proxyPath);
            break;
        default:
            // The file could be either CommonJS or ESM.
            // CommonJS is tried first then ESM if loading fails.
            try {
                proxyConfiguration = require(proxyPath);
                break;
            }
            catch (e) {
                (0, error_1.assertIsError)(e);
                if (e.code === 'ERR_REQUIRE_ESM') {
                    // Load the ESM configuration file using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    proxyConfiguration = (await (0, load_esm_1.loadEsmModule)((0, node_url_1.pathToFileURL)(proxyPath)))
                        .default;
                    break;
                }
                throw e;
            }
    }
    if (normalize) {
        proxyConfiguration = normalizeProxyConfiguration(proxyConfiguration);
    }
    return proxyConfiguration;
}
exports.loadProxyConfiguration = loadProxyConfiguration;
/**
 * Converts glob patterns to regular expressions to support Vite's proxy option.
 * Also converts the Webpack supported array form to an object form supported by both.
 *
 * @param proxy A proxy configuration object.
 */
function normalizeProxyConfiguration(proxy) {
    let normalizedProxy;
    if (Array.isArray(proxy)) {
        // Construct an object-form proxy configuration from the array
        normalizedProxy = {};
        for (const proxyEntry of proxy) {
            if (!('context' in proxyEntry)) {
                continue;
            }
            if (!Array.isArray(proxyEntry.context)) {
                continue;
            }
            // Array-form entries contain a context string array with the path(s)
            // to use for the configuration entry.
            const context = proxyEntry.context;
            delete proxyEntry.context;
            for (const contextEntry of context) {
                if (typeof contextEntry !== 'string') {
                    continue;
                }
                normalizedProxy[contextEntry] = proxyEntry;
            }
        }
    }
    else {
        normalizedProxy = proxy;
    }
    // TODO: Consider upstreaming glob support
    for (const key of Object.keys(normalizedProxy)) {
        if ((0, fast_glob_1.isDynamicPattern)(key)) {
            const { output } = (0, picomatch_1.parse)(key);
            normalizedProxy[`^${output}$`] = normalizedProxy[key];
            delete normalizedProxy[key];
        }
    }
    return normalizedProxy;
}
/**
 * Calculates the line and column for an error offset in the content of a JSON file.
 * @param location The offset error location from the beginning of the content.
 * @param content The full content of the file containing the error.
 * @returns An object containing the line and column
 */
function getJsonErrorLineColumn(offset, content) {
    if (offset === 0) {
        return { line: 1, column: 1 };
    }
    let line = 0;
    let position = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        ++line;
        const nextNewline = content.indexOf('\n', position);
        if (nextNewline === -1 || nextNewline > offset) {
            break;
        }
        position = nextNewline + 1;
    }
    return { line, column: offset - position + 1 };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1wcm94eS1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2xvYWQtcHJveHktY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseUNBQTZDO0FBQzdDLHFDQUFxQztBQUNyQywrQ0FBNEM7QUFDNUMseUNBQTZDO0FBQzdDLHVDQUF5QztBQUN6Qyx5Q0FBK0M7QUFDL0MsNkNBQWtEO0FBQ2xELG1EQUFxRDtBQUU5QyxLQUFLLFVBQVUsc0JBQXNCLENBQzFDLElBQVksRUFDWixXQUErQixFQUMvQixTQUFTLEdBQUcsS0FBSztJQUVqQixJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0lBRUQsTUFBTSxTQUFTLEdBQUcsSUFBQSxtQkFBTyxFQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU3QyxJQUFJLENBQUMsSUFBQSxvQkFBVSxFQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLFNBQVMsa0JBQWtCLENBQUMsQ0FBQztLQUMxRTtJQUVELElBQUksa0JBQWtCLENBQUM7SUFDdkIsUUFBUSxJQUFBLG1CQUFPLEVBQUMsU0FBUyxDQUFDLEVBQUU7UUFDMUIsS0FBSyxPQUFPLENBQUMsQ0FBQztZQUNaLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUVuRCxNQUFNLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLEdBQUcsd0RBQWEsY0FBYyxHQUFDLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQXdDLEVBQUUsQ0FBQztZQUM1RCxrQkFB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QzFDLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUM5QyxJQUFJLElBQUEsNEJBQWdCLEVBQUMsR0FBRyxDQUFDLEVBQUU7WUFDekIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUEsaUJBQVMsRUFBQyxHQUFHLENBQUMsQ0FBQztZQUNsQyxlQUFlLENBQUMsSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0RCxPQUFPLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUM3QjtLQUNGO0lBRUQsT0FBTyxlQUFlLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBUyxzQkFBc0IsQ0FBQyxNQUFjLEVBQUUsT0FBZTtJQUM3RCxJQUFJLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDaEIsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO0tBQy9CO0lBRUQsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ2IsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQ2pCLGlEQUFpRDtJQUNqRCxPQUFPLElBQUksRUFBRTtRQUNYLEVBQUUsSUFBSSxDQUFDO1FBRVAsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDcEQsSUFBSSxXQUFXLEtBQUssQ0FBQyxDQUFDLElBQUksV0FBVyxHQUFHLE1BQU0sRUFBRTtZQUM5QyxNQUFNO1NBQ1A7UUFFRCxRQUFRLEdBQUcsV0FBVyxHQUFHLENBQUMsQ0FBQztLQUM1QjtJQUVELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sR0FBRyxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFDakQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBpc0R5bmFtaWNQYXR0ZXJuIH0gZnJvbSAnZmFzdC1nbG9iJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lLCByZXNvbHZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZUdsb2IgfSBmcm9tICdwaWNvbWF0Y2gnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkUHJveHlDb25maWd1cmF0aW9uKFxuICByb290OiBzdHJpbmcsXG4gIHByb3h5Q29uZmlnOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIG5vcm1hbGl6ZSA9IGZhbHNlLFxuKSB7XG4gIGlmICghcHJveHlDb25maWcpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgcHJveHlQYXRoID0gcmVzb2x2ZShyb290LCBwcm94eUNvbmZpZyk7XG5cbiAgaWYgKCFleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3h5IGNvbmZpZ3VyYXRpb24gZmlsZSAke3Byb3h5UGF0aH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gIH1cblxuICBsZXQgcHJveHlDb25maWd1cmF0aW9uO1xuICBzd2l0Y2ggKGV4dG5hbWUocHJveHlQYXRoKSkge1xuICAgIGNhc2UgJy5qc29uJzoge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHByb3h5UGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgIGNvbnN0IHsgcGFyc2UsIHByaW50UGFyc2VFcnJvckNvZGUgfSA9IGF3YWl0IGltcG9ydCgnanNvbmMtcGFyc2VyJyk7XG4gICAgICBjb25zdCBwYXJzZUVycm9yczogaW1wb3J0KCdqc29uYy1wYXJzZXInKS5QYXJzZUVycm9yW10gPSBbXTtcbiAgICAgIHByb3h5Q29uZmlndXJhdGlvbiA9IHBhcnNlKGNvbnRlbnQsIHBhcnNlRXJyb3JzLCB7IGFsbG93VHJhaWxpbmdDb21tYTogdHJ1ZSB9KTtcblxuICAgICAgaWYgKHBhcnNlRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGNvbnRhaW5zIHBhcnNlIGVycm9yczpgO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcnNlRXJyb3Igb2YgcGFyc2VFcnJvcnMpIHtcbiAgICAgICAgICBjb25zdCB7IGxpbmUsIGNvbHVtbiB9ID0gZ2V0SnNvbkVycm9yTGluZUNvbHVtbihwYXJzZUVycm9yLm9mZnNldCwgY29udGVudCk7XG4gICAgICAgICAgZXJyb3JNZXNzYWdlICs9IGBcXG5bJHtsaW5lfSwgJHtjb2x1bW59XSAke3ByaW50UGFyc2VFcnJvckNvZGUocGFyc2VFcnJvci5lcnJvcil9YDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJy5tanMnOlxuICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICBwcm94eUNvbmZpZ3VyYXRpb24gPSAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSlcbiAgICAgICAgLmRlZmF1bHQ7XG4gICAgICBicmVhaztcbiAgICBjYXNlICcuY2pzJzpcbiAgICAgIHByb3h5Q29uZmlndXJhdGlvbiA9IHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBUaGUgZmlsZSBjb3VsZCBiZSBlaXRoZXIgQ29tbW9uSlMgb3IgRVNNLlxuICAgICAgLy8gQ29tbW9uSlMgaXMgdHJpZWQgZmlyc3QgdGhlbiBFU00gaWYgbG9hZGluZyBmYWlscy5cbiAgICAgIHRyeSB7XG4gICAgICAgIHByb3h5Q29uZmlndXJhdGlvbiA9IHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICAgIGlmIChlLmNvZGUgPT09ICdFUlJfUkVRVUlSRV9FU00nKSB7XG4gICAgICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICBwcm94eUNvbmZpZ3VyYXRpb24gPSAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSlcbiAgICAgICAgICAgIC5kZWZhdWx0O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgfVxuXG4gIGlmIChub3JtYWxpemUpIHtcbiAgICBwcm94eUNvbmZpZ3VyYXRpb24gPSBub3JtYWxpemVQcm94eUNvbmZpZ3VyYXRpb24ocHJveHlDb25maWd1cmF0aW9uKTtcbiAgfVxuXG4gIHJldHVybiBwcm94eUNvbmZpZ3VyYXRpb247XG59XG5cbi8qKlxuICogQ29udmVydHMgZ2xvYiBwYXR0ZXJucyB0byByZWd1bGFyIGV4cHJlc3Npb25zIHRvIHN1cHBvcnQgVml0ZSdzIHByb3h5IG9wdGlvbi5cbiAqIEFsc28gY29udmVydHMgdGhlIFdlYnBhY2sgc3VwcG9ydGVkIGFycmF5IGZvcm0gdG8gYW4gb2JqZWN0IGZvcm0gc3VwcG9ydGVkIGJ5IGJvdGguXG4gKlxuICogQHBhcmFtIHByb3h5IEEgcHJveHkgY29uZmlndXJhdGlvbiBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVByb3h5Q29uZmlndXJhdGlvbihcbiAgcHJveHk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgb2JqZWN0W10sXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGxldCBub3JtYWxpemVkUHJveHk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KHByb3h5KSkge1xuICAgIC8vIENvbnN0cnVjdCBhbiBvYmplY3QtZm9ybSBwcm94eSBjb25maWd1cmF0aW9uIGZyb20gdGhlIGFycmF5XG4gICAgbm9ybWFsaXplZFByb3h5ID0ge307XG4gICAgZm9yIChjb25zdCBwcm94eUVudHJ5IG9mIHByb3h5KSB7XG4gICAgICBpZiAoISgnY29udGV4dCcgaW4gcHJveHlFbnRyeSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJveHlFbnRyeS5jb250ZXh0KSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQXJyYXktZm9ybSBlbnRyaWVzIGNvbnRhaW4gYSBjb250ZXh0IHN0cmluZyBhcnJheSB3aXRoIHRoZSBwYXRoKHMpXG4gICAgICAvLyB0byB1c2UgZm9yIHRoZSBjb25maWd1cmF0aW9uIGVudHJ5LlxuICAgICAgY29uc3QgY29udGV4dCA9IHByb3h5RW50cnkuY29udGV4dDtcbiAgICAgIGRlbGV0ZSBwcm94eUVudHJ5LmNvbnRleHQ7XG4gICAgICBmb3IgKGNvbnN0IGNvbnRleHRFbnRyeSBvZiBjb250ZXh0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29udGV4dEVudHJ5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9ybWFsaXplZFByb3h5W2NvbnRleHRFbnRyeV0gPSBwcm94eUVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBub3JtYWxpemVkUHJveHkgPSBwcm94eTtcbiAgfVxuXG4gIC8vIFRPRE86IENvbnNpZGVyIHVwc3RyZWFtaW5nIGdsb2Igc3VwcG9ydFxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhub3JtYWxpemVkUHJveHkpKSB7XG4gICAgaWYgKGlzRHluYW1pY1BhdHRlcm4oa2V5KSkge1xuICAgICAgY29uc3QgeyBvdXRwdXQgfSA9IHBhcnNlR2xvYihrZXkpO1xuICAgICAgbm9ybWFsaXplZFByb3h5W2BeJHtvdXRwdXR9JGBdID0gbm9ybWFsaXplZFByb3h5W2tleV07XG4gICAgICBkZWxldGUgbm9ybWFsaXplZFByb3h5W2tleV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZWRQcm94eTtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBsaW5lIGFuZCBjb2x1bW4gZm9yIGFuIGVycm9yIG9mZnNldCBpbiB0aGUgY29udGVudCBvZiBhIEpTT04gZmlsZS5cbiAqIEBwYXJhbSBsb2NhdGlvbiBUaGUgb2Zmc2V0IGVycm9yIGxvY2F0aW9uIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgY29udGVudC5cbiAqIEBwYXJhbSBjb250ZW50IFRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgZXJyb3IuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgbGluZSBhbmQgY29sdW1uXG4gKi9cbmZ1bmN0aW9uIGdldEpzb25FcnJvckxpbmVDb2x1bW4ob2Zmc2V0OiBudW1iZXIsIGNvbnRlbnQ6IHN0cmluZykge1xuICBpZiAob2Zmc2V0ID09PSAwKSB7XG4gICAgcmV0dXJuIHsgbGluZTogMSwgY29sdW1uOiAxIH07XG4gIH1cblxuICBsZXQgbGluZSA9IDA7XG4gIGxldCBwb3NpdGlvbiA9IDA7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgd2hpbGUgKHRydWUpIHtcbiAgICArK2xpbmU7XG5cbiAgICBjb25zdCBuZXh0TmV3bGluZSA9IGNvbnRlbnQuaW5kZXhPZignXFxuJywgcG9zaXRpb24pO1xuICAgIGlmIChuZXh0TmV3bGluZSA9PT0gLTEgfHwgbmV4dE5ld2xpbmUgPiBvZmZzZXQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHBvc2l0aW9uID0gbmV4dE5ld2xpbmUgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHsgbGluZSwgY29sdW1uOiBvZmZzZXQgLSBwb3NpdGlvbiArIDEgfTtcbn1cbiJdfQ==