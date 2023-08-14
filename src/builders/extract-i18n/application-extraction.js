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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tZXh0cmFjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2V4dHJhY3QtaTE4bi9hcHBsaWNhdGlvbi1leHRyYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUtILDhEQUFpQztBQUNqQywwREFBaUM7QUFDakMsZ0RBQTBEO0FBRTFELHdEQUF5RDtBQUdsRCxLQUFLLFVBQVUsZUFBZSxDQUNuQyxPQUFxQyxFQUNyQyxXQUFtQixFQUNuQixPQUF1QixFQUN2QixvQkFBNkM7SUFPN0MsTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUV2QyxnRkFBZ0Y7SUFDaEYsTUFBTSxZQUFZLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ2pELE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFDckQsV0FBVyxDQUNaLENBQWlELENBQUM7SUFDbkQsWUFBWSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7SUFDbEMsWUFBWSxDQUFDLFNBQVMsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDO0lBRXpELElBQUksS0FBSyxDQUFDO0lBQ1YsSUFBSSxXQUFXLEtBQUssMkNBQTJDLEVBQUU7UUFDL0QsS0FBSyxHQUFHLHNDQUF3QixDQUFDO1FBRWpDLFlBQVksQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLFlBQVksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQzlCLFlBQVksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0tBQ2hDO1NBQU07UUFDTCxLQUFLLEdBQUcscUNBQW1CLENBQUM7S0FDN0I7SUFFRCwrQ0FBK0M7SUFDL0MsSUFBSSxhQUFhLENBQUM7SUFDbEIsSUFBSTtRQUNGLDhEQUE4RDtRQUM5RCxJQUFJLEtBQUssRUFBRSxNQUFNLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFBbUIsRUFBRSxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRTtZQUNoRixhQUFhLEdBQUcsTUFBTSxDQUFDO1lBQ3ZCLE1BQU07U0FDUDtRQUVELElBQUEscUJBQU0sRUFBQyxhQUFhLEtBQUssU0FBUyxFQUFFLCtDQUErQyxDQUFDLENBQUM7S0FDdEY7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLGFBQWEsR0FBRztZQUNkLE9BQU8sRUFBRSxLQUFLO1lBQ2QsS0FBSyxFQUFHLEdBQWEsQ0FBQyxPQUFPO1NBQzlCLENBQUM7S0FDSDtJQUVELHFEQUFxRDtJQUNyRCx1REFBdUQ7SUFDdkQsSUFBSSxhQUFhLENBQUMsV0FBVyxFQUFFO1FBQzdCLDZEQUE2RDtRQUM3RCxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUN4QyxLQUFLLE1BQU0sVUFBVSxJQUFJLGFBQWEsQ0FBQyxXQUFXLEVBQUU7WUFDbEQsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDbkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUM3QztpQkFBTSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUM5QyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzdDO1NBQ0Y7UUFFRCxvRUFBb0U7UUFDcEUsTUFBTSxTQUFTLEdBQUcsc0JBQXNCLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRS9FLDRDQUE0QztRQUM1QyxLQUFLLE1BQU0sUUFBUSxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNuQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDN0IsU0FBUzthQUNWO1lBRUQsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN6RCxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7U0FDaEM7S0FDRjtJQUVELE9BQU87UUFDTCxhQUFhO1FBQ2IsUUFBUSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQy9CLFFBQVE7UUFDUiw2RUFBNkU7UUFDN0UsWUFBWSxFQUFFLEtBQUs7S0FDcEIsQ0FBQztBQUNKLENBQUM7QUFuRkQsMENBbUZDO0FBRUQsU0FBUyxzQkFBc0IsQ0FDN0Isb0JBQTZDLEVBQzdDLEtBQTBCLEVBQzFCLE9BQXVCO0lBRXZCLHlEQUF5RDtJQUN6RCxnRUFBZ0U7SUFDaEUsOEZBQThGO0lBQzlGLE1BQU0sVUFBVSxHQUFHO1FBQ2pCLFFBQVEsQ0FBQyxJQUFZO1lBQ25CLDREQUE0RDtZQUM1RCxNQUFNLGFBQWEsR0FBRyxtQkFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRXJFLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDekMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFO2dCQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixHQUFHLGFBQWEsQ0FBQyxDQUFDO2FBQzdEO1lBRUQsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztRQUNELFFBQVEsQ0FBQyxJQUFZLEVBQUUsRUFBVTtZQUMvQixPQUFPLG1CQUFRLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsT0FBTyxDQUFDLEdBQUcsS0FBZTtZQUN4QixPQUFPLG1CQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUNELE1BQU0sQ0FBQyxJQUFZO1lBQ2pCLDREQUE0RDtZQUM1RCxNQUFNLGFBQWEsR0FBRyxtQkFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRXJFLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNsQyxDQUFDO1FBQ0QsT0FBTyxDQUFDLElBQVk7WUFDbEIsT0FBTyxtQkFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxDQUFDO0tBQ0YsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFHO1FBQ2Isc0JBQXNCO1FBQ3RCLEtBQUssRUFBRSxDQUFDO1FBQ1IsS0FBSyxDQUFDLEdBQUcsSUFBYztZQUNyQixzQ0FBc0M7WUFDdEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ3pCLENBQUM7UUFDRCxJQUFJLENBQUMsR0FBRyxJQUFjO1lBQ3BCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLEdBQUcsSUFBYztZQUNwQixPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMsQ0FBQztRQUNELEtBQUssQ0FBQyxHQUFHLElBQWM7WUFDckIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7S0FDRixDQUFDO0lBRUYsOERBQThEO0lBQzlELE1BQU0sU0FBUyxHQUFHLElBQUksb0JBQW9CLENBQUMsVUFBaUIsRUFBRSxNQUFNLEVBQUU7UUFDcEUsOERBQThEO1FBQzlELFFBQVEsRUFBRSxPQUFPLENBQUMsYUFBb0I7UUFDdEMsYUFBYSxFQUFFLElBQUk7S0FDcEIsQ0FBQyxDQUFDO0lBRUgsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IMm1UGFyc2VkTWVzc2FnZSBhcyBMb2NhbGl6ZU1lc3NhZ2UgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZSc7XG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2VFeHRyYWN0b3IgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZS90b29scyc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCBub2RlUGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgYnVpbGRBcHBsaWNhdGlvbkludGVybmFsIH0gZnJvbSAnLi4vYXBwbGljYXRpb24nO1xuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMgfSBmcm9tICcuLi9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGJ1aWxkRXNidWlsZEJyb3dzZXIgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRXh0cmFjdEkxOG5PcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4dHJhY3RNZXNzYWdlcyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEV4dHJhY3RJMThuT3B0aW9ucyxcbiAgYnVpbGRlck5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGV4dHJhY3RvckNvbnN0cnVjdG9yOiB0eXBlb2YgTWVzc2FnZUV4dHJhY3Rvcixcbik6IFByb21pc2U8e1xuICBidWlsZGVyUmVzdWx0OiBCdWlsZGVyT3V0cHV0O1xuICBiYXNlUGF0aDogc3RyaW5nO1xuICBtZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW107XG4gIHVzZUxlZ2FjeUlkczogYm9vbGVhbjtcbn0+IHtcbiAgY29uc3QgbWVzc2FnZXM6IExvY2FsaXplTWVzc2FnZVtdID0gW107XG5cbiAgLy8gU2V0dXAgdGhlIGJ1aWxkIG9wdGlvbnMgZm9yIHRoZSBhcHBsaWNhdGlvbiBiYXNlZCBvbiB0aGUgYnJvd3NlclRhcmdldCBvcHRpb25cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgIGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyB1bmtub3duIGFzIEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucztcbiAgYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA9IGZhbHNlO1xuICBidWlsZE9wdGlvbnMuc291cmNlTWFwID0geyBzY3JpcHRzOiB0cnVlLCB2ZW5kb3I6IHRydWUgfTtcblxuICBsZXQgYnVpbGQ7XG4gIGlmIChidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmFwcGxpY2F0aW9uJykge1xuICAgIGJ1aWxkID0gYnVpbGRBcHBsaWNhdGlvbkludGVybmFsO1xuXG4gICAgYnVpbGRPcHRpb25zLnNzciA9IGZhbHNlO1xuICAgIGJ1aWxkT3B0aW9ucy5hcHBTaGVsbCA9IGZhbHNlO1xuICAgIGJ1aWxkT3B0aW9ucy5wcmVyZW5kZXIgPSBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICBidWlsZCA9IGJ1aWxkRXNidWlsZEJyb3dzZXI7XG4gIH1cblxuICAvLyBCdWlsZCB0aGUgYXBwbGljYXRpb24gd2l0aCB0aGUgYnVpbGQgb3B0aW9uc1xuICBsZXQgYnVpbGRlclJlc3VsdDtcbiAgdHJ5IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIGJ1aWxkKGJ1aWxkT3B0aW9ucyBhcyBhbnksIGNvbnRleHQsIHsgd3JpdGU6IGZhbHNlIH0pKSB7XG4gICAgICBidWlsZGVyUmVzdWx0ID0gcmVzdWx0O1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGJ1aWxkZXJSZXN1bHQgIT09IHVuZGVmaW5lZCwgJ0FwcGxpY2F0aW9uIGJ1aWxkZXIgZGlkIG5vdCBwcm92aWRlIGEgcmVzdWx0LicpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBidWlsZGVyUmVzdWx0ID0ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogKGVyciBhcyBFcnJvcikubWVzc2FnZSxcbiAgICB9O1xuICB9XG5cbiAgLy8gRXh0cmFjdCBtZXNzYWdlcyBmcm9tIGVhY2ggb3V0cHV0IEphdmFTY3JpcHQgZmlsZS5cbiAgLy8gT3V0cHV0IGZpbGVzIGFyZSBvbmx5IHByZXNlbnQgb24gYSBzdWNjZXNzZnVsIGJ1aWxkLlxuICBpZiAoYnVpbGRlclJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgIC8vIFN0b3JlIHRoZSBKUyBhbmQgSlMgbWFwIGZpbGVzIGZvciBsb29rdXAgZHVyaW5nIGV4dHJhY3Rpb25cbiAgICBjb25zdCBmaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIGJ1aWxkZXJSZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIGlmIChvdXRwdXRGaWxlLnBhdGguZW5kc1dpdGgoJy5qcycpKSB7XG4gICAgICAgIGZpbGVzLnNldChvdXRwdXRGaWxlLnBhdGgsIG91dHB1dEZpbGUudGV4dCk7XG4gICAgICB9IGVsc2UgaWYgKG91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmpzLm1hcCcpKSB7XG4gICAgICAgIGZpbGVzLnNldChvdXRwdXRGaWxlLnBhdGgsIG91dHB1dEZpbGUudGV4dCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2V0dXAgdGhlIGxvY2FsaXplIG1lc3NhZ2UgZXh0cmFjdG9yIGJhc2VkIG9uIHRoZSBpbi1tZW1vcnkgZmlsZXNcbiAgICBjb25zdCBleHRyYWN0b3IgPSBzZXR1cExvY2FsaXplRXh0cmFjdG9yKGV4dHJhY3RvckNvbnN0cnVjdG9yLCBmaWxlcywgY29udGV4dCk7XG5cbiAgICAvLyBBdHRlbXB0IGV4dHJhY3Rpb24gb2YgYWxsIG91dHB1dCBKUyBmaWxlc1xuICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZXMua2V5cygpKSB7XG4gICAgICBpZiAoIWZpbGVQYXRoLmVuZHNXaXRoKCcuanMnKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZU1lc3NhZ2VzID0gZXh0cmFjdG9yLmV4dHJhY3RNZXNzYWdlcyhmaWxlUGF0aCk7XG4gICAgICBtZXNzYWdlcy5wdXNoKC4uLmZpbGVNZXNzYWdlcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBidWlsZGVyUmVzdWx0LFxuICAgIGJhc2VQYXRoOiBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgbWVzc2FnZXMsXG4gICAgLy8gTGVnYWN5IGkxOG4gaWRlbnRpZmllcnMgYXJlIG5vdCBzdXBwb3J0ZWQgd2l0aCB0aGUgbmV3IGFwcGxpY2F0aW9uIGJ1aWxkZXJcbiAgICB1c2VMZWdhY3lJZHM6IGZhbHNlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBzZXR1cExvY2FsaXplRXh0cmFjdG9yKFxuICBleHRyYWN0b3JDb25zdHJ1Y3RvcjogdHlwZW9mIE1lc3NhZ2VFeHRyYWN0b3IsXG4gIGZpbGVzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IE1lc3NhZ2VFeHRyYWN0b3Ige1xuICAvLyBTZXR1cCBhIHZpcnR1YWwgZmlsZSBzeXN0ZW0gaW5zdGFuY2UgZm9yIHRoZSBleHRyYWN0b3JcbiAgLy8gKiBNZXNzYWdlRXh0cmFjdG9yIGl0c2VsZiB1c2VzIHJlYWRGaWxlLCByZWxhdGl2ZSBhbmQgcmVzb2x2ZVxuICAvLyAqIEludGVybmFsIFNvdXJjZUZpbGVMb2FkZXIgKHNvdXJjZW1hcCBzdXBwb3J0KSB1c2VzIGRpcm5hbWUsIGV4aXN0cywgcmVhZEZpbGUsIGFuZCByZXNvbHZlXG4gIGNvbnN0IGZpbGVzeXN0ZW0gPSB7XG4gICAgcmVhZEZpbGUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgIC8vIE91dHB1dCBmaWxlcyBhcmUgc3RvcmVkIGFzIHJlbGF0aXZlIHRvIHRoZSB3b3Jrc3BhY2Ugcm9vdFxuICAgICAgY29uc3QgcmVxdWVzdGVkUGF0aCA9IG5vZGVQYXRoLnJlbGF0aXZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgcGF0aCk7XG5cbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBmaWxlcy5nZXQocmVxdWVzdGVkUGF0aCk7XG4gICAgICBpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBmaWxlIHJlcXVlc3RlZDogJyArIHJlcXVlc3RlZFBhdGgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gY29udGVudDtcbiAgICB9LFxuICAgIHJlbGF0aXZlKGZyb206IHN0cmluZywgdG86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gbm9kZVBhdGgucmVsYXRpdmUoZnJvbSwgdG8pO1xuICAgIH0sXG4gICAgcmVzb2x2ZSguLi5wYXRoczogc3RyaW5nW10pOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIG5vZGVQYXRoLnJlc29sdmUoLi4ucGF0aHMpO1xuICAgIH0sXG4gICAgZXhpc3RzKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgLy8gT3V0cHV0IGZpbGVzIGFyZSBzdG9yZWQgYXMgcmVsYXRpdmUgdG8gdGhlIHdvcmtzcGFjZSByb290XG4gICAgICBjb25zdCByZXF1ZXN0ZWRQYXRoID0gbm9kZVBhdGgucmVsYXRpdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBwYXRoKTtcblxuICAgICAgcmV0dXJuIGZpbGVzLmhhcyhyZXF1ZXN0ZWRQYXRoKTtcbiAgICB9LFxuICAgIGRpcm5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgIHJldHVybiBub2RlUGF0aC5kaXJuYW1lKHBhdGgpO1xuICAgIH0sXG4gIH07XG5cbiAgY29uc3QgbG9nZ2VyID0ge1xuICAgIC8vIGxldmVsIDIgaXMgd2FybmluZ3NcbiAgICBsZXZlbDogMixcbiAgICBkZWJ1ZyguLi5hcmdzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUuZGVidWcoLi4uYXJncyk7XG4gICAgfSxcbiAgICBpbmZvKC4uLmFyZ3M6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGFyZ3Muam9pbignJykpO1xuICAgIH0sXG4gICAgd2FybiguLi5hcmdzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihhcmdzLmpvaW4oJycpKTtcbiAgICB9LFxuICAgIGVycm9yKC4uLmFyZ3M6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihhcmdzLmpvaW4oJycpKTtcbiAgICB9LFxuICB9O1xuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGV4dHJhY3RvciA9IG5ldyBleHRyYWN0b3JDb25zdHJ1Y3RvcihmaWxlc3lzdGVtIGFzIGFueSwgbG9nZ2VyLCB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBiYXNlUGF0aDogY29udGV4dC53b3Jrc3BhY2VSb290IGFzIGFueSxcbiAgICB1c2VTb3VyY2VNYXBzOiB0cnVlLFxuICB9KTtcblxuICByZXR1cm4gZXh0cmFjdG9yO1xufVxuIl19