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
exports.normalizeProxyConfiguration = exports.loadProxyConfiguration = void 0;
const glob_1 = require("glob");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const picomatch_1 = require("picomatch");
const error_1 = require("../../utils/error");
const load_esm_1 = require("../../utils/load-esm");
async function loadProxyConfiguration(root, proxyConfig) {
    if (!proxyConfig) {
        return undefined;
    }
    const proxyPath = (0, node_path_1.resolve)(root, proxyConfig);
    if (!(0, node_fs_1.existsSync)(proxyPath)) {
        throw new Error(`Proxy configuration file ${proxyPath} does not exist.`);
    }
    switch ((0, node_path_1.extname)(proxyPath)) {
        case '.json': {
            const content = await (0, promises_1.readFile)(proxyPath, 'utf-8');
            const { parse, printParseErrorCode } = await Promise.resolve().then(() => __importStar(require('jsonc-parser')));
            const parseErrors = [];
            const proxyConfiguration = parse(content, parseErrors, { allowTrailingComma: true });
            if (parseErrors.length > 0) {
                let errorMessage = `Proxy configuration file ${proxyPath} contains parse errors:`;
                for (const parseError of parseErrors) {
                    const { line, column } = getJsonErrorLineColumn(parseError.offset, content);
                    errorMessage += `\n[${line}, ${column}] ${printParseErrorCode(parseError.error)}`;
                }
                throw new Error(errorMessage);
            }
            return proxyConfiguration;
        }
        case '.mjs':
            // Load the ESM configuration file using the TypeScript dynamic import workaround.
            // Once TypeScript provides support for keeping the dynamic import this workaround can be
            // changed to a direct dynamic import.
            return (await (0, load_esm_1.loadEsmModule)((0, node_url_1.pathToFileURL)(proxyPath))).default;
        case '.cjs':
            return require(proxyPath);
        default:
            // The file could be either CommonJS or ESM.
            // CommonJS is tried first then ESM if loading fails.
            try {
                return require(proxyPath);
            }
            catch (e) {
                (0, error_1.assertIsError)(e);
                if (e.code === 'ERR_REQUIRE_ESM') {
                    // Load the ESM configuration file using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    return (await (0, load_esm_1.loadEsmModule)((0, node_url_1.pathToFileURL)(proxyPath))).default;
                }
                throw e;
            }
    }
}
exports.loadProxyConfiguration = loadProxyConfiguration;
/**
 * Converts glob patterns to regular expressions to support Vite's proxy option.
 * @param proxy A proxy configuration object.
 */
function normalizeProxyConfiguration(proxy) {
    // TODO: Consider upstreaming glob support
    for (const key of Object.keys(proxy)) {
        if ((0, glob_1.hasMagic)(key)) {
            const { output } = (0, picomatch_1.parse)(key);
            proxy[`^${output}$`] = proxy[key];
            delete proxy[key];
        }
    }
}
exports.normalizeProxyConfiguration = normalizeProxyConfiguration;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1wcm94eS1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2xvYWQtcHJveHktY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0JBQW9EO0FBQ3BELHFDQUFxQztBQUNyQywrQ0FBNEM7QUFDNUMseUNBQTZDO0FBQzdDLHVDQUF5QztBQUN6Qyx5Q0FBK0M7QUFDL0MsNkNBQWtEO0FBQ2xELG1EQUFxRDtBQUU5QyxLQUFLLFVBQVUsc0JBQXNCLENBQUMsSUFBWSxFQUFFLFdBQStCO0lBQ3hGLElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsT0FBTyxTQUFTLENBQUM7S0FDbEI7SUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFBLG1CQUFPLEVBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBRTdDLElBQUksQ0FBQyxJQUFBLG9CQUFVLEVBQUMsU0FBUyxDQUFDLEVBQUU7UUFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw0QkFBNEIsU0FBUyxrQkFBa0IsQ0FBQyxDQUFDO0tBQzFFO0lBRUQsUUFBUSxJQUFBLG1CQUFPLEVBQUMsU0FBUyxDQUFDLEVBQUU7UUFDMUIsS0FBSyxPQUFPLENBQUMsQ0FBQztZQUNaLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUVuRCxNQUFNLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLEdBQUcsd0RBQWEsY0FBYyxHQUFDLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQXdDLEVBQUUsQ0FBQztZQUM1RCxNQUFNLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUVyRixJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMxQixJQUFJLFlBQVksR0FBRyw0QkFBNEIsU0FBUyx5QkFBeUIsQ0FBQztnQkFDbEYsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUU7b0JBQ3BDLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsc0JBQXNCLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztvQkFDNUUsWUFBWSxJQUFJLE1BQU0sSUFBSSxLQUFLLE1BQU0sS0FBSyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztpQkFDbkY7Z0JBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUMvQjtZQUVELE9BQU8sa0JBQWtCLENBQUM7U0FDM0I7UUFDRCxLQUFLLE1BQU07WUFDVCxrRkFBa0Y7WUFDbEYseUZBQXlGO1lBQ3pGLHNDQUFzQztZQUN0QyxPQUFPLENBQUMsTUFBTSxJQUFBLHdCQUFhLEVBQXVCLElBQUEsd0JBQWEsRUFBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQ3ZGLEtBQUssTUFBTTtZQUNULE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzVCO1lBQ0UsNENBQTRDO1lBQzVDLHFEQUFxRDtZQUNyRCxJQUFJO2dCQUNGLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzNCO1lBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ1YsSUFBQSxxQkFBYSxFQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssaUJBQWlCLEVBQUU7b0JBQ2hDLGtGQUFrRjtvQkFDbEYseUZBQXlGO29CQUN6RixzQ0FBc0M7b0JBQ3RDLE9BQU8sQ0FBQyxNQUFNLElBQUEsd0JBQWEsRUFBdUIsSUFBQSx3QkFBYSxFQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7aUJBQ3RGO2dCQUVELE1BQU0sQ0FBQyxDQUFDO2FBQ1Q7S0FDSjtBQUNILENBQUM7QUF0REQsd0RBc0RDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0IsMkJBQTJCLENBQUMsS0FBOEI7SUFDeEUsMENBQTBDO0lBQzFDLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNwQyxJQUFJLElBQUEsZUFBZ0IsRUFBQyxHQUFHLENBQUMsRUFBRTtZQUN6QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBQSxpQkFBUyxFQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2xDLEtBQUssQ0FBQyxJQUFJLE1BQU0sR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2xDLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ25CO0tBQ0Y7QUFDSCxDQUFDO0FBVEQsa0VBU0M7QUFFRDs7Ozs7R0FLRztBQUNILFNBQVMsc0JBQXNCLENBQUMsTUFBYyxFQUFFLE9BQWU7SUFDN0QsSUFBSSxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2hCLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztLQUMvQjtJQUVELElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztJQUNiLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztJQUNqQixpREFBaUQ7SUFDakQsT0FBTyxJQUFJLEVBQUU7UUFDWCxFQUFFLElBQUksQ0FBQztRQUVQLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3BELElBQUksV0FBVyxLQUFLLENBQUMsQ0FBQyxJQUFJLFdBQVcsR0FBRyxNQUFNLEVBQUU7WUFDOUMsTUFBTTtTQUNQO1FBRUQsUUFBUSxHQUFHLFdBQVcsR0FBRyxDQUFDLENBQUM7S0FDNUI7SUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEdBQUcsUUFBUSxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgaGFzTWFnaWMgYXMgaXNEeW5hbWljUGF0dGVybiB9IGZyb20gJ2dsb2InO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUsIHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IHBhcnNlIGFzIHBhcnNlR2xvYiB9IGZyb20gJ3BpY29tYXRjaCc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRQcm94eUNvbmZpZ3VyYXRpb24ocm9vdDogc3RyaW5nLCBwcm94eUNvbmZpZzogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gIGlmICghcHJveHlDb25maWcpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgcHJveHlQYXRoID0gcmVzb2x2ZShyb290LCBwcm94eUNvbmZpZyk7XG5cbiAgaWYgKCFleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3h5IGNvbmZpZ3VyYXRpb24gZmlsZSAke3Byb3h5UGF0aH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gIH1cblxuICBzd2l0Y2ggKGV4dG5hbWUocHJveHlQYXRoKSkge1xuICAgIGNhc2UgJy5qc29uJzoge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHByb3h5UGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgIGNvbnN0IHsgcGFyc2UsIHByaW50UGFyc2VFcnJvckNvZGUgfSA9IGF3YWl0IGltcG9ydCgnanNvbmMtcGFyc2VyJyk7XG4gICAgICBjb25zdCBwYXJzZUVycm9yczogaW1wb3J0KCdqc29uYy1wYXJzZXInKS5QYXJzZUVycm9yW10gPSBbXTtcbiAgICAgIGNvbnN0IHByb3h5Q29uZmlndXJhdGlvbiA9IHBhcnNlKGNvbnRlbnQsIHBhcnNlRXJyb3JzLCB7IGFsbG93VHJhaWxpbmdDb21tYTogdHJ1ZSB9KTtcblxuICAgICAgaWYgKHBhcnNlRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGNvbnRhaW5zIHBhcnNlIGVycm9yczpgO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcnNlRXJyb3Igb2YgcGFyc2VFcnJvcnMpIHtcbiAgICAgICAgICBjb25zdCB7IGxpbmUsIGNvbHVtbiB9ID0gZ2V0SnNvbkVycm9yTGluZUNvbHVtbihwYXJzZUVycm9yLm9mZnNldCwgY29udGVudCk7XG4gICAgICAgICAgZXJyb3JNZXNzYWdlICs9IGBcXG5bJHtsaW5lfSwgJHtjb2x1bW59XSAke3ByaW50UGFyc2VFcnJvckNvZGUocGFyc2VFcnJvci5lcnJvcil9YDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByb3h5Q29uZmlndXJhdGlvbjtcbiAgICB9XG4gICAgY2FzZSAnLm1qcyc6XG4gICAgICAvLyBMb2FkIHRoZSBFU00gY29uZmlndXJhdGlvbiBmaWxlIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgIHJldHVybiAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSkuZGVmYXVsdDtcbiAgICBjYXNlICcuY2pzJzpcbiAgICAgIHJldHVybiByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIFRoZSBmaWxlIGNvdWxkIGJlIGVpdGhlciBDb21tb25KUyBvciBFU00uXG4gICAgICAvLyBDb21tb25KUyBpcyB0cmllZCBmaXJzdCB0aGVuIEVTTSBpZiBsb2FkaW5nIGZhaWxzLlxuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgYXNzZXJ0SXNFcnJvcihlKTtcbiAgICAgICAgaWYgKGUuY29kZSA9PT0gJ0VSUl9SRVFVSVJFX0VTTScpIHtcbiAgICAgICAgICAvLyBMb2FkIHRoZSBFU00gY29uZmlndXJhdGlvbiBmaWxlIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICAgIHJldHVybiAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSkuZGVmYXVsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBnbG9iIHBhdHRlcm5zIHRvIHJlZ3VsYXIgZXhwcmVzc2lvbnMgdG8gc3VwcG9ydCBWaXRlJ3MgcHJveHkgb3B0aW9uLlxuICogQHBhcmFtIHByb3h5IEEgcHJveHkgY29uZmlndXJhdGlvbiBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVQcm94eUNvbmZpZ3VyYXRpb24ocHJveHk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB7XG4gIC8vIFRPRE86IENvbnNpZGVyIHVwc3RyZWFtaW5nIGdsb2Igc3VwcG9ydFxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhwcm94eSkpIHtcbiAgICBpZiAoaXNEeW5hbWljUGF0dGVybihrZXkpKSB7XG4gICAgICBjb25zdCB7IG91dHB1dCB9ID0gcGFyc2VHbG9iKGtleSk7XG4gICAgICBwcm94eVtgXiR7b3V0cHV0fSRgXSA9IHByb3h5W2tleV07XG4gICAgICBkZWxldGUgcHJveHlba2V5XTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBsaW5lIGFuZCBjb2x1bW4gZm9yIGFuIGVycm9yIG9mZnNldCBpbiB0aGUgY29udGVudCBvZiBhIEpTT04gZmlsZS5cbiAqIEBwYXJhbSBsb2NhdGlvbiBUaGUgb2Zmc2V0IGVycm9yIGxvY2F0aW9uIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgY29udGVudC5cbiAqIEBwYXJhbSBjb250ZW50IFRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgZXJyb3IuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgbGluZSBhbmQgY29sdW1uXG4gKi9cbmZ1bmN0aW9uIGdldEpzb25FcnJvckxpbmVDb2x1bW4ob2Zmc2V0OiBudW1iZXIsIGNvbnRlbnQ6IHN0cmluZykge1xuICBpZiAob2Zmc2V0ID09PSAwKSB7XG4gICAgcmV0dXJuIHsgbGluZTogMSwgY29sdW1uOiAxIH07XG4gIH1cblxuICBsZXQgbGluZSA9IDA7XG4gIGxldCBwb3NpdGlvbiA9IDA7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgd2hpbGUgKHRydWUpIHtcbiAgICArK2xpbmU7XG5cbiAgICBjb25zdCBuZXh0TmV3bGluZSA9IGNvbnRlbnQuaW5kZXhPZignXFxuJywgcG9zaXRpb24pO1xuICAgIGlmIChuZXh0TmV3bGluZSA9PT0gLTEgfHwgbmV4dE5ld2xpbmUgPiBvZmZzZXQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHBvc2l0aW9uID0gbmV4dE5ld2xpbmUgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHsgbGluZSwgY29sdW1uOiBvZmZzZXQgLSBwb3NpdGlvbiArIDEgfTtcbn1cbiJdfQ==