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
    // Replace `pathRewrite` field with a `rewrite` function
    for (const proxyEntry of Object.values(normalizedProxy)) {
        if (typeof proxyEntry === 'object' &&
            'pathRewrite' in proxyEntry &&
            proxyEntry.pathRewrite &&
            typeof proxyEntry.pathRewrite === 'object') {
            // Preprocess path rewrite entries
            const pathRewriteEntries = [];
            for (const [pattern, value] of Object.entries(proxyEntry.pathRewrite)) {
                pathRewriteEntries.push([new RegExp(pattern), value]);
            }
            proxyEntry.rewrite = pathRewriter.bind(undefined, pathRewriteEntries);
            delete proxyEntry.pathRewrite;
        }
    }
    return normalizedProxy;
}
function pathRewriter(pathRewriteEntries, path) {
    for (const [pattern, value] of pathRewriteEntries) {
        const updated = path.replace(pattern, value);
        if (path !== updated) {
            return updated;
        }
    }
    return path;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1wcm94eS1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2xvYWQtcHJveHktY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseUNBQTZDO0FBQzdDLHFDQUFxQztBQUNyQywrQ0FBNEM7QUFDNUMseUNBQTZDO0FBQzdDLHVDQUF5QztBQUN6Qyx5Q0FBK0M7QUFDL0MsNkNBQWtEO0FBQ2xELG1EQUFxRDtBQUU5QyxLQUFLLFVBQVUsc0JBQXNCLENBQzFDLElBQVksRUFDWixXQUErQixFQUMvQixTQUFTLEdBQUcsS0FBSztJQUVqQixJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0lBRUQsTUFBTSxTQUFTLEdBQUcsSUFBQSxtQkFBTyxFQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU3QyxJQUFJLENBQUMsSUFBQSxvQkFBVSxFQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLFNBQVMsa0JBQWtCLENBQUMsQ0FBQztLQUMxRTtJQUVELElBQUksa0JBQWtCLENBQUM7SUFDdkIsUUFBUSxJQUFBLG1CQUFPLEVBQUMsU0FBUyxDQUFDLEVBQUU7UUFDMUIsS0FBSyxPQUFPLENBQUMsQ0FBQztZQUNaLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUVuRCxNQUFNLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLEdBQUcsd0RBQWEsY0FBYyxHQUFDLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQXdDLEVBQUUsQ0FBQztZQUM1RCxrQkFB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QUFPLEVBQUUsS0FBSyxDQUFDLElBQUksa0JBQWtCLEVBQUU7UUFDakQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDN0MsSUFBSSxJQUFJLEtBQUssT0FBTyxFQUFFO1lBQ3BCLE9BQU8sT0FBTyxDQUFDO1NBQ2hCO0tBQ0Y7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQVMsc0JBQXNCLENBQUMsTUFBYyxFQUFFLE9BQWU7SUFDN0QsSUFBSSxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2hCLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztLQUMvQjtJQUVELElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztJQUNiLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztJQUNqQixpREFBaUQ7SUFDakQsT0FBTyxJQUFJLEVBQUU7UUFDWCxFQUFFLElBQUksQ0FBQztRQUVQLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3BELElBQUksV0FBVyxLQUFLLENBQUMsQ0FBQyxJQUFJLFdBQVcsR0FBRyxNQUFNLEVBQUU7WUFDOUMsTUFBTTtTQUNQO1FBRUQsUUFBUSxHQUFHLFdBQVcsR0FBRyxDQUFDLENBQUM7S0FDNUI7SUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEdBQUcsUUFBUSxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgaXNEeW5hbWljUGF0dGVybiB9IGZyb20gJ2Zhc3QtZ2xvYic7XG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VHbG9iIH0gZnJvbSAncGljb21hdGNoJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgcm9vdDogc3RyaW5nLFxuICBwcm94eUNvbmZpZzogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBub3JtYWxpemUgPSBmYWxzZSxcbikge1xuICBpZiAoIXByb3h5Q29uZmlnKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IHByb3h5UGF0aCA9IHJlc29sdmUocm9vdCwgcHJveHlDb25maWcpO1xuXG4gIGlmICghZXhpc3RzU3luYyhwcm94eVBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGRvZXMgbm90IGV4aXN0LmApO1xuICB9XG5cbiAgbGV0IHByb3h5Q29uZmlndXJhdGlvbjtcbiAgc3dpdGNoIChleHRuYW1lKHByb3h5UGF0aCkpIHtcbiAgICBjYXNlICcuanNvbic6IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZShwcm94eVBhdGgsICd1dGYtOCcpO1xuXG4gICAgICBjb25zdCB7IHBhcnNlLCBwcmludFBhcnNlRXJyb3JDb2RlIH0gPSBhd2FpdCBpbXBvcnQoJ2pzb25jLXBhcnNlcicpO1xuICAgICAgY29uc3QgcGFyc2VFcnJvcnM6IGltcG9ydCgnanNvbmMtcGFyc2VyJykuUGFyc2VFcnJvcltdID0gW107XG4gICAgICBwcm94eUNvbmZpZ3VyYXRpb24gPSBwYXJzZShjb250ZW50LCBwYXJzZUVycm9ycywgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUgfSk7XG5cbiAgICAgIGlmIChwYXJzZUVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBjb250YWlucyBwYXJzZSBlcnJvcnM6YDtcbiAgICAgICAgZm9yIChjb25zdCBwYXJzZUVycm9yIG9mIHBhcnNlRXJyb3JzKSB7XG4gICAgICAgICAgY29uc3QgeyBsaW5lLCBjb2x1bW4gfSA9IGdldEpzb25FcnJvckxpbmVDb2x1bW4ocGFyc2VFcnJvci5vZmZzZXQsIGNvbnRlbnQpO1xuICAgICAgICAgIGVycm9yTWVzc2FnZSArPSBgXFxuWyR7bGluZX0sICR7Y29sdW1ufV0gJHtwcmludFBhcnNlRXJyb3JDb2RlKHBhcnNlRXJyb3IuZXJyb3IpfWA7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICB9XG5cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlICcubWpzJzpcbiAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgcHJveHlDb25maWd1cmF0aW9uID0gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpXG4gICAgICAgIC5kZWZhdWx0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnLmNqcyc6XG4gICAgICBwcm94eUNvbmZpZ3VyYXRpb24gPSByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gVGhlIGZpbGUgY291bGQgYmUgZWl0aGVyIENvbW1vbkpTIG9yIEVTTS5cbiAgICAgIC8vIENvbW1vbkpTIGlzIHRyaWVkIGZpcnN0IHRoZW4gRVNNIGlmIGxvYWRpbmcgZmFpbHMuXG4gICAgICB0cnkge1xuICAgICAgICBwcm94eUNvbmZpZ3VyYXRpb24gPSByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgICAgICBpZiAoZS5jb2RlID09PSAnRVJSX1JFUVVJUkVfRVNNJykge1xuICAgICAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgICAgcHJveHlDb25maWd1cmF0aW9uID0gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpXG4gICAgICAgICAgICAuZGVmYXVsdDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gIH1cblxuICBpZiAobm9ybWFsaXplKSB7XG4gICAgcHJveHlDb25maWd1cmF0aW9uID0gbm9ybWFsaXplUHJveHlDb25maWd1cmF0aW9uKHByb3h5Q29uZmlndXJhdGlvbik7XG4gIH1cblxuICByZXR1cm4gcHJveHlDb25maWd1cmF0aW9uO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGdsb2IgcGF0dGVybnMgdG8gcmVndWxhciBleHByZXNzaW9ucyB0byBzdXBwb3J0IFZpdGUncyBwcm94eSBvcHRpb24uXG4gKiBBbHNvIGNvbnZlcnRzIHRoZSBXZWJwYWNrIHN1cHBvcnRlZCBhcnJheSBmb3JtIHRvIGFuIG9iamVjdCBmb3JtIHN1cHBvcnRlZCBieSBib3RoLlxuICpcbiAqIEBwYXJhbSBwcm94eSBBIHByb3h5IGNvbmZpZ3VyYXRpb24gb2JqZWN0LlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVQcm94eUNvbmZpZ3VyYXRpb24oXG4gIHByb3h5OiBSZWNvcmQ8c3RyaW5nLCBvYmplY3Q+IHwgb2JqZWN0W10sXG4pOiBSZWNvcmQ8c3RyaW5nLCBvYmplY3Q+IHtcbiAgbGV0IG5vcm1hbGl6ZWRQcm94eTogUmVjb3JkPHN0cmluZywgb2JqZWN0PiB8IHVuZGVmaW5lZDtcblxuICBpZiAoQXJyYXkuaXNBcnJheShwcm94eSkpIHtcbiAgICAvLyBDb25zdHJ1Y3QgYW4gb2JqZWN0LWZvcm0gcHJveHkgY29uZmlndXJhdGlvbiBmcm9tIHRoZSBhcnJheVxuICAgIG5vcm1hbGl6ZWRQcm94eSA9IHt9O1xuICAgIGZvciAoY29uc3QgcHJveHlFbnRyeSBvZiBwcm94eSkge1xuICAgICAgaWYgKCEoJ2NvbnRleHQnIGluIHByb3h5RW50cnkpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3h5RW50cnkuY29udGV4dCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFycmF5LWZvcm0gZW50cmllcyBjb250YWluIGEgY29udGV4dCBzdHJpbmcgYXJyYXkgd2l0aCB0aGUgcGF0aChzKVxuICAgICAgLy8gdG8gdXNlIGZvciB0aGUgY29uZmlndXJhdGlvbiBlbnRyeS5cbiAgICAgIGNvbnN0IGNvbnRleHQgPSBwcm94eUVudHJ5LmNvbnRleHQ7XG4gICAgICBkZWxldGUgcHJveHlFbnRyeS5jb250ZXh0O1xuICAgICAgZm9yIChjb25zdCBjb250ZXh0RW50cnkgb2YgY29udGV4dCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbnRleHRFbnRyeSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5vcm1hbGl6ZWRQcm94eVtjb250ZXh0RW50cnldID0gcHJveHlFbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbm9ybWFsaXplZFByb3h5ID0gcHJveHk7XG4gIH1cblxuICAvLyBUT0RPOiBDb25zaWRlciB1cHN0cmVhbWluZyBnbG9iIHN1cHBvcnRcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMobm9ybWFsaXplZFByb3h5KSkge1xuICAgIGlmIChpc0R5bmFtaWNQYXR0ZXJuKGtleSkpIHtcbiAgICAgIGNvbnN0IHsgb3V0cHV0IH0gPSBwYXJzZUdsb2Ioa2V5KTtcbiAgICAgIG5vcm1hbGl6ZWRQcm94eVtgXiR7b3V0cHV0fSRgXSA9IG5vcm1hbGl6ZWRQcm94eVtrZXldO1xuICAgICAgZGVsZXRlIG5vcm1hbGl6ZWRQcm94eVtrZXldO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJlcGxhY2UgYHBhdGhSZXdyaXRlYCBmaWVsZCB3aXRoIGEgYHJld3JpdGVgIGZ1bmN0aW9uXG4gIGZvciAoY29uc3QgcHJveHlFbnRyeSBvZiBPYmplY3QudmFsdWVzKG5vcm1hbGl6ZWRQcm94eSkpIHtcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgcHJveHlFbnRyeSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICdwYXRoUmV3cml0ZScgaW4gcHJveHlFbnRyeSAmJlxuICAgICAgcHJveHlFbnRyeS5wYXRoUmV3cml0ZSAmJlxuICAgICAgdHlwZW9mIHByb3h5RW50cnkucGF0aFJld3JpdGUgPT09ICdvYmplY3QnXG4gICAgKSB7XG4gICAgICAvLyBQcmVwcm9jZXNzIHBhdGggcmV3cml0ZSBlbnRyaWVzXG4gICAgICBjb25zdCBwYXRoUmV3cml0ZUVudHJpZXM6IFtSZWdFeHAsIHN0cmluZ11bXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBbcGF0dGVybiwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKFxuICAgICAgICBwcm94eUVudHJ5LnBhdGhSZXdyaXRlIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gICAgICApKSB7XG4gICAgICAgIHBhdGhSZXdyaXRlRW50cmllcy5wdXNoKFtuZXcgUmVnRXhwKHBhdHRlcm4pLCB2YWx1ZV0pO1xuICAgICAgfVxuXG4gICAgICAocHJveHlFbnRyeSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikucmV3cml0ZSA9IHBhdGhSZXdyaXRlci5iaW5kKFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHBhdGhSZXdyaXRlRW50cmllcyxcbiAgICAgICk7XG5cbiAgICAgIGRlbGV0ZSBwcm94eUVudHJ5LnBhdGhSZXdyaXRlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3JtYWxpemVkUHJveHk7XG59XG5cbmZ1bmN0aW9uIHBhdGhSZXdyaXRlcihwYXRoUmV3cml0ZUVudHJpZXM6IFtSZWdFeHAsIHN0cmluZ11bXSwgcGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgZm9yIChjb25zdCBbcGF0dGVybiwgdmFsdWVdIG9mIHBhdGhSZXdyaXRlRW50cmllcykge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBwYXRoLnJlcGxhY2UocGF0dGVybiwgdmFsdWUpO1xuICAgIGlmIChwYXRoICE9PSB1cGRhdGVkKSB7XG4gICAgICByZXR1cm4gdXBkYXRlZDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBsaW5lIGFuZCBjb2x1bW4gZm9yIGFuIGVycm9yIG9mZnNldCBpbiB0aGUgY29udGVudCBvZiBhIEpTT04gZmlsZS5cbiAqIEBwYXJhbSBsb2NhdGlvbiBUaGUgb2Zmc2V0IGVycm9yIGxvY2F0aW9uIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgY29udGVudC5cbiAqIEBwYXJhbSBjb250ZW50IFRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgZXJyb3IuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgbGluZSBhbmQgY29sdW1uXG4gKi9cbmZ1bmN0aW9uIGdldEpzb25FcnJvckxpbmVDb2x1bW4ob2Zmc2V0OiBudW1iZXIsIGNvbnRlbnQ6IHN0cmluZykge1xuICBpZiAob2Zmc2V0ID09PSAwKSB7XG4gICAgcmV0dXJuIHsgbGluZTogMSwgY29sdW1uOiAxIH07XG4gIH1cblxuICBsZXQgbGluZSA9IDA7XG4gIGxldCBwb3NpdGlvbiA9IDA7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgd2hpbGUgKHRydWUpIHtcbiAgICArK2xpbmU7XG5cbiAgICBjb25zdCBuZXh0TmV3bGluZSA9IGNvbnRlbnQuaW5kZXhPZignXFxuJywgcG9zaXRpb24pO1xuICAgIGlmIChuZXh0TmV3bGluZSA9PT0gLTEgfHwgbmV4dE5ld2xpbmUgPiBvZmZzZXQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHBvc2l0aW9uID0gbmV4dE5ld2xpbmUgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHsgbGluZSwgY29sdW1uOiBvZmZzZXQgLSBwb3NpdGlvbiArIDEgfTtcbn1cbiJdfQ==