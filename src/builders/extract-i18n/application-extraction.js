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
exports.extractMessages = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_path_1 = __importDefault(require("node:path"));
const application_1 = require("../application");
const browser_esbuild_1 = require("../browser-esbuild");
async function extractMessages(options, builderName, context, extractorConstructor) {
    const messages = [];
    // Setup the build options for the application based on the browserTarget option
    const buildOptions = (await context.validateOptions(await context.getTargetOptions(options.browserTarget), builderName));
    buildOptions.optimization = false;
    buildOptions.sourceMap = { scripts: true, vendor: true };
    buildOptions.localize = false;
    let build;
    if (builderName === '@angular-devkit/build-angular:application') {
        build = application_1.buildApplicationInternal;
        buildOptions.ssr = false;
        buildOptions.appShell = false;
        buildOptions.prerender = false;
    }
    else {
        build = browser_esbuild_1.buildEsbuildBrowser;
    }
    // Build the application with the build options
    let builderResult;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const result of build(buildOptions, context, { write: false })) {
            builderResult = result;
            break;
        }
        (0, node_assert_1.default)(builderResult !== undefined, 'Application builder did not provide a result.');
    }
    catch (err) {
        builderResult = {
            success: false,
            error: err.message,
        };
    }
    // Extract messages from each output JavaScript file.
    // Output files are only present on a successful build.
    if (builderResult.outputFiles) {
        // Store the JS and JS map files for lookup during extraction
        const files = new Map();
        for (const outputFile of builderResult.outputFiles) {
            if (outputFile.path.endsWith('.js')) {
                files.set(outputFile.path, outputFile.text);
            }
            else if (outputFile.path.endsWith('.js.map')) {
                files.set(outputFile.path, outputFile.text);
            }
        }
        // Setup the localize message extractor based on the in-memory files
        const extractor = setupLocalizeExtractor(extractorConstructor, files, context);
        // Attempt extraction of all output JS files
        for (const filePath of files.keys()) {
            if (!filePath.endsWith('.js')) {
                continue;
            }
            const fileMessages = extractor.extractMessages(filePath);
            messages.push(...fileMessages);
        }
    }
    return {
        builderResult,
        basePath: context.workspaceRoot,
        messages,
        // Legacy i18n identifiers are not supported with the new application builder
        useLegacyIds: false,
    };
}
exports.extractMessages = extractMessages;
function setupLocalizeExtractor(extractorConstructor, files, context) {
    // Setup a virtual file system instance for the extractor
    // * MessageExtractor itself uses readFile, relative and resolve
    // * Internal SourceFileLoader (sourcemap support) uses dirname, exists, readFile, and resolve
    const filesystem = {
        readFile(path) {
            // Output files are stored as relative to the workspace root
            const requestedPath = node_path_1.default.relative(context.workspaceRoot, path);
            const content = files.get(requestedPath);
            if (content === undefined) {
                throw new Error('Unknown file requested: ' + requestedPath);
            }
            return content;
        },
        relative(from, to) {
            return node_path_1.default.relative(from, to);
        },
        resolve(...paths) {
            return node_path_1.default.resolve(...paths);
        },
        exists(path) {
            // Output files are stored as relative to the workspace root
            const requestedPath = node_path_1.default.relative(context.workspaceRoot, path);
            return files.has(requestedPath);
        },
        dirname(path) {
            return node_path_1.default.dirname(path);
        },
    };
    const logger = {
        // level 2 is warnings
        level: 2,
        debug(...args) {
            // eslint-disable-next-line no-console
            console.debug(...args);
        },
        info(...args) {
            context.logger.info(args.join(''));
        },
        warn(...args) {
            context.logger.warn(args.join(''));
        },
        error(...args) {
            context.logger.error(args.join(''));
        },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractor = new extractorConstructor(filesystem, logger, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        basePath: context.workspaceRoot,
        useSourceMaps: true,
    });
    return extractor;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tZXh0cmFjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2V4dHJhY3QtaTE4bi9hcHBsaWNhdGlvbi1leHRyYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUtILDhEQUFpQztBQUNqQywwREFBaUM7QUFDakMsZ0RBQTBEO0FBRTFELHdEQUF5RDtBQUdsRCxLQUFLLFVBQVUsZUFBZSxDQUNuQyxPQUFxQyxFQUNyQyxXQUFtQixFQUNuQixPQUF1QixFQUN2QixvQkFBNkM7SUFPN0MsTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUV2QyxnRkFBZ0Y7SUFDaEYsTUFBTSxZQUFZLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ2pELE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFDckQsV0FBVyxDQUNaLENBQWlELENBQUM7SUFDbkQsWUFBWSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7SUFDbEMsWUFBWSxDQUFDLFNBQVMsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3pELFlBQVksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO0lBRTlCLElBQUksS0FBSyxDQUFDO0lBQ1YsSUFBSSxXQUFXLEtBQUssMkNBQTJDLEVBQUU7UUFDL0QsS0FBSyxHQUFHLHNDQUF3QixDQUFDO1FBRWpDLFlBQVksQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLFlBQVksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQzlCLFlBQVksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0tBQ2hDO1NBQU07UUFDTCxLQUFLLEdBQUcscUNBQW1C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QUFPLENBQUMsYUFBb0I7UUFDdEMsYUFBYSxFQUFFLElBQUk7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IMm1UGFyc2VkTWVzc2FnZSBhcyBMb2NhbGl6ZU1lc3NhZ2UgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZSc7XG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2VFeHRyYWN0b3IgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZS90b29scyc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCBub2RlUGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgYnVpbGRBcHBsaWNhdGlvbkludGVybmFsIH0gZnJvbSAnLi4vYXBwbGljYXRpb24nO1xuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMgfSBmcm9tICcuLi9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGJ1aWxkRXNidWlsZEJyb3dzZXIgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRXh0cmFjdEkxOG5PcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4dHJhY3RNZXNzYWdlcyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEV4dHJhY3RJMThuT3B0aW9ucyxcbiAgYnVpbGRlck5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGV4dHJhY3RvckNvbnN0cnVjdG9yOiB0eXBlb2YgTWVzc2FnZUV4dHJhY3Rvcixcbik6IFByb21pc2U8e1xuICBidWlsZGVyUmVzdWx0OiBCdWlsZGVyT3V0cHV0O1xuICBiYXNlUGF0aDogc3RyaW5nO1xuICBtZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW107XG4gIHVzZUxlZ2FjeUlkczogYm9vbGVhbjtcbn0+IHtcbiAgY29uc3QgbWVzc2FnZXM6IExvY2FsaXplTWVzc2FnZVtdID0gW107XG5cbiAgLy8gU2V0dXAgdGhlIGJ1aWxkIG9wdGlvbnMgZm9yIHRoZSBhcHBsaWNhdGlvbiBiYXNlZCBvbiB0aGUgYnJvd3NlclRhcmdldCBvcHRpb25cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgIGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyB1bmtub3duIGFzIEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucztcbiAgYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA9IGZhbHNlO1xuICBidWlsZE9wdGlvbnMuc291cmNlTWFwID0geyBzY3JpcHRzOiB0cnVlLCB2ZW5kb3I6IHRydWUgfTtcbiAgYnVpbGRPcHRpb25zLmxvY2FsaXplID0gZmFsc2U7XG5cbiAgbGV0IGJ1aWxkO1xuICBpZiAoYnVpbGRlck5hbWUgPT09ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjphcHBsaWNhdGlvbicpIHtcbiAgICBidWlsZCA9IGJ1aWxkQXBwbGljYXRpb25JbnRlcm5hbDtcblxuICAgIGJ1aWxkT3B0aW9ucy5zc3IgPSBmYWxzZTtcbiAgICBidWlsZE9wdGlvbnMuYXBwU2hlbGwgPSBmYWxzZTtcbiAgICBidWlsZE9wdGlvbnMucHJlcmVuZGVyID0gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgYnVpbGQgPSBidWlsZEVzYnVpbGRCcm93c2VyO1xuICB9XG5cbiAgLy8gQnVpbGQgdGhlIGFwcGxpY2F0aW9uIHdpdGggdGhlIGJ1aWxkIG9wdGlvbnNcbiAgbGV0IGJ1aWxkZXJSZXN1bHQ7XG4gIHRyeSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBidWlsZChidWlsZE9wdGlvbnMgYXMgYW55LCBjb250ZXh0LCB7IHdyaXRlOiBmYWxzZSB9KSkge1xuICAgICAgYnVpbGRlclJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGFzc2VydChidWlsZGVyUmVzdWx0ICE9PSB1bmRlZmluZWQsICdBcHBsaWNhdGlvbiBidWlsZGVyIGRpZCBub3QgcHJvdmlkZSBhIHJlc3VsdC4nKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgYnVpbGRlclJlc3VsdCA9IHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4dHJhY3QgbWVzc2FnZXMgZnJvbSBlYWNoIG91dHB1dCBKYXZhU2NyaXB0IGZpbGUuXG4gIC8vIE91dHB1dCBmaWxlcyBhcmUgb25seSBwcmVzZW50IG9uIGEgc3VjY2Vzc2Z1bCBidWlsZC5cbiAgaWYgKGJ1aWxkZXJSZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAvLyBTdG9yZSB0aGUgSlMgYW5kIEpTIG1hcCBmaWxlcyBmb3IgbG9va3VwIGR1cmluZyBleHRyYWN0aW9uXG4gICAgY29uc3QgZmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiBidWlsZGVyUmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBpZiAob3V0cHV0RmlsZS5wYXRoLmVuZHNXaXRoKCcuanMnKSkge1xuICAgICAgICBmaWxlcy5zZXQob3V0cHV0RmlsZS5wYXRoLCBvdXRwdXRGaWxlLnRleHQpO1xuICAgICAgfSBlbHNlIGlmIChvdXRwdXRGaWxlLnBhdGguZW5kc1dpdGgoJy5qcy5tYXAnKSkge1xuICAgICAgICBmaWxlcy5zZXQob3V0cHV0RmlsZS5wYXRoLCBvdXRwdXRGaWxlLnRleHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldHVwIHRoZSBsb2NhbGl6ZSBtZXNzYWdlIGV4dHJhY3RvciBiYXNlZCBvbiB0aGUgaW4tbWVtb3J5IGZpbGVzXG4gICAgY29uc3QgZXh0cmFjdG9yID0gc2V0dXBMb2NhbGl6ZUV4dHJhY3RvcihleHRyYWN0b3JDb25zdHJ1Y3RvciwgZmlsZXMsIGNvbnRleHQpO1xuXG4gICAgLy8gQXR0ZW1wdCBleHRyYWN0aW9uIG9mIGFsbCBvdXRwdXQgSlMgZmlsZXNcbiAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGZpbGVzLmtleXMoKSkge1xuICAgICAgaWYgKCFmaWxlUGF0aC5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVNZXNzYWdlcyA9IGV4dHJhY3Rvci5leHRyYWN0TWVzc2FnZXMoZmlsZVBhdGgpO1xuICAgICAgbWVzc2FnZXMucHVzaCguLi5maWxlTWVzc2FnZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYnVpbGRlclJlc3VsdCxcbiAgICBiYXNlUGF0aDogY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgIG1lc3NhZ2VzLFxuICAgIC8vIExlZ2FjeSBpMThuIGlkZW50aWZpZXJzIGFyZSBub3Qgc3VwcG9ydGVkIHdpdGggdGhlIG5ldyBhcHBsaWNhdGlvbiBidWlsZGVyXG4gICAgdXNlTGVnYWN5SWRzOiBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc2V0dXBMb2NhbGl6ZUV4dHJhY3RvcihcbiAgZXh0cmFjdG9yQ29uc3RydWN0b3I6IHR5cGVvZiBNZXNzYWdlRXh0cmFjdG9yLFxuICBmaWxlczogTWFwPHN0cmluZywgc3RyaW5nPixcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBNZXNzYWdlRXh0cmFjdG9yIHtcbiAgLy8gU2V0dXAgYSB2aXJ0dWFsIGZpbGUgc3lzdGVtIGluc3RhbmNlIGZvciB0aGUgZXh0cmFjdG9yXG4gIC8vICogTWVzc2FnZUV4dHJhY3RvciBpdHNlbGYgdXNlcyByZWFkRmlsZSwgcmVsYXRpdmUgYW5kIHJlc29sdmVcbiAgLy8gKiBJbnRlcm5hbCBTb3VyY2VGaWxlTG9hZGVyIChzb3VyY2VtYXAgc3VwcG9ydCkgdXNlcyBkaXJuYW1lLCBleGlzdHMsIHJlYWRGaWxlLCBhbmQgcmVzb2x2ZVxuICBjb25zdCBmaWxlc3lzdGVtID0ge1xuICAgIHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAvLyBPdXRwdXQgZmlsZXMgYXJlIHN0b3JlZCBhcyByZWxhdGl2ZSB0byB0aGUgd29ya3NwYWNlIHJvb3RcbiAgICAgIGNvbnN0IHJlcXVlc3RlZFBhdGggPSBub2RlUGF0aC5yZWxhdGl2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIHBhdGgpO1xuXG4gICAgICBjb25zdCBjb250ZW50ID0gZmlsZXMuZ2V0KHJlcXVlc3RlZFBhdGgpO1xuICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZmlsZSByZXF1ZXN0ZWQ6ICcgKyByZXF1ZXN0ZWRQYXRoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfSxcbiAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIG5vZGVQYXRoLnJlbGF0aXZlKGZyb20sIHRvKTtcbiAgICB9LFxuICAgIHJlc29sdmUoLi4ucGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgICAgIHJldHVybiBub2RlUGF0aC5yZXNvbHZlKC4uLnBhdGhzKTtcbiAgICB9LFxuICAgIGV4aXN0cyhwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgIC8vIE91dHB1dCBmaWxlcyBhcmUgc3RvcmVkIGFzIHJlbGF0aXZlIHRvIHRoZSB3b3Jrc3BhY2Ugcm9vdFxuICAgICAgY29uc3QgcmVxdWVzdGVkUGF0aCA9IG5vZGVQYXRoLnJlbGF0aXZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgcGF0aCk7XG5cbiAgICAgIHJldHVybiBmaWxlcy5oYXMocmVxdWVzdGVkUGF0aCk7XG4gICAgfSxcbiAgICBkaXJuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gbm9kZVBhdGguZGlybmFtZShwYXRoKTtcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IGxvZ2dlciA9IHtcbiAgICAvLyBsZXZlbCAyIGlzIHdhcm5pbmdzXG4gICAgbGV2ZWw6IDIsXG4gICAgZGVidWcoLi4uYXJnczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLmRlYnVnKC4uLmFyZ3MpO1xuICAgIH0sXG4gICAgaW5mbyguLi5hcmdzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhhcmdzLmpvaW4oJycpKTtcbiAgICB9LFxuICAgIHdhcm4oLi4uYXJnczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oYXJncy5qb2luKCcnKSk7XG4gICAgfSxcbiAgICBlcnJvciguLi5hcmdzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYXJncy5qb2luKCcnKSk7XG4gICAgfSxcbiAgfTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBjb25zdCBleHRyYWN0b3IgPSBuZXcgZXh0cmFjdG9yQ29uc3RydWN0b3IoZmlsZXN5c3RlbSBhcyBhbnksIGxvZ2dlciwge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgYmFzZVBhdGg6IGNvbnRleHQud29ya3NwYWNlUm9vdCBhcyBhbnksXG4gICAgdXNlU291cmNlTWFwczogdHJ1ZSxcbiAgfSk7XG5cbiAgcmV0dXJuIGV4dHJhY3Rvcjtcbn1cbiJdfQ==