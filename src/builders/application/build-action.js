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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEsBuildBuildAction = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const sass_language_1 = require("../../tools/esbuild/stylesheets/sass-language");
const utils_1 = require("../../tools/esbuild/utils");
const error_1 = require("../../utils/error");
async function* runEsBuildBuildAction(action, options) {
    const { writeToFileSystemFilter, writeToFileSystem = true, watch, poll, logger, deleteOutputPath, cacheOptions, outputPath, verbose, projectRoot, workspaceRoot, progress, } = options;
    if (writeToFileSystem) {
        // Clean output path if enabled
        if (deleteOutputPath) {
            if (outputPath === workspaceRoot) {
                logger.error('Output path MUST not be workspace root directory!');
                return;
            }
            await promises_1.default.rm(outputPath, { force: true, recursive: true, maxRetries: 3 });
        }
        // Create output directory if needed
        try {
            await promises_1.default.mkdir(outputPath, { recursive: true });
        }
        catch (e) {
            (0, error_1.assertIsError)(e);
            logger.error('Unable to create output directory: ' + e.message);
            return;
        }
    }
    const withProgress = progress ? utils_1.withSpinner : utils_1.withNoProgress;
    // Initial build
    let result;
    try {
        result = await withProgress('Building...', () => action());
    }
    finally {
        // Ensure Sass workers are shutdown if not watching
        if (!watch) {
            (0, sass_language_1.shutdownSassWorkerPool)();
        }
    }
    // Setup watcher if watch mode enabled
    let watcher;
    if (watch) {
        if (progress) {
            logger.info('Watch mode enabled. Watching for file changes...');
        }
        // Setup a watcher
        const { createWatcher } = await Promise.resolve().then(() => __importStar(require('../../tools/esbuild/watcher')));
        watcher = createWatcher({
            polling: typeof poll === 'number',
            interval: poll,
            ignored: [
                // Ignore the output and cache paths to avoid infinite rebuild cycles
                outputPath,
                cacheOptions.basePath,
                // Ignore all node modules directories to avoid excessive file watchers.
                // Package changes are handled below by watching manifest and lock files.
                '**/node_modules/**',
                '**/.*/**',
            ],
        });
        // Setup abort support
        options.signal?.addEventListener('abort', () => void watcher?.close());
        // Temporarily watch the entire project
        watcher.add(projectRoot);
        // Watch workspace for package manager changes
        const packageWatchFiles = [
            // manifest can affect module resolution
            'package.json',
            // npm lock file
            'package-lock.json',
            // pnpm lock file
            'pnpm-lock.yaml',
            // yarn lock file including Yarn PnP manifest files (https://yarnpkg.com/advanced/pnp-spec/)
            'yarn.lock',
            '.pnp.cjs',
            '.pnp.data.json',
        ];
        watcher.add(packageWatchFiles.map((file) => node_path_1.default.join(workspaceRoot, file)));
        // Watch locations provided by the initial build result
        watcher.add(result.watchFiles);
    }
    // Output the first build results after setting up the watcher to ensure that any code executed
    // higher in the iterator call stack will trigger the watcher. This is particularly relevant for
    // unit tests which execute the builder and modify the file system programmatically.
    if (writeToFileSystem) {
        // Write output files
        await (0, utils_1.writeResultFiles)(result.outputFiles, result.assetFiles, outputPath);
        yield result.output;
    }
    else {
        // Requires casting due to unneeded `JsonObject` requirement. Remove once fixed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yield result.outputWithFiles;
    }
    // Finish if watch mode is not enabled
    if (!watcher) {
        return;
    }
    // Wait for changes and rebuild as needed
    let previousWatchFiles = new Set(result.watchFiles);
    try {
        for await (const changes of watcher) {
            if (options.signal?.aborted) {
                break;
            }
            if (verbose) {
                logger.info(changes.toDebugString());
            }
            result = await withProgress('Changes detected. Rebuilding...', () => action(result.createRebuildState(changes)));
            // Update watched locations provided by the new build result.
            // Add any new locations
            watcher.add(result.watchFiles.filter((watchFile) => !previousWatchFiles.has(watchFile)));
            const newWatchFiles = new Set(result.watchFiles);
            // Remove any old locations
            watcher.remove([...previousWatchFiles].filter((watchFile) => !newWatchFiles.has(watchFile)));
            previousWatchFiles = newWatchFiles;
            if (writeToFileSystem) {
                // Write output files
                const filesToWrite = writeToFileSystemFilter
                    ? result.outputFiles.filter(writeToFileSystemFilter)
                    : result.outputFiles;
                await (0, utils_1.writeResultFiles)(filesToWrite, result.assetFiles, outputPath);
                yield result.output;
            }
            else {
                // Requires casting due to unneeded `JsonObject` requirement. Remove once fixed.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                yield result.outputWithFiles;
            }
        }
    }
    finally {
        // Stop the watcher and cleanup incremental rebuild state
        await Promise.allSettled([watcher.close(), result.dispose()]);
        (0, sass_language_1.shutdownSassWorkerPool)();
    }
}
exports.runEsBuildBuildAction = runEsBuildBuildAction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGQtYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYXBwbGljYXRpb24vYnVpbGQtYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUc3QixpRkFBdUY7QUFDdkYscURBQTBGO0FBQzFGLDZDQUFrRDtBQUczQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLHFCQUFxQixDQUMxQyxNQUFtRixFQUNuRixPQWNDO0lBRUQsTUFBTSxFQUNKLHVCQUF1QixFQUN2QixpQkFBaUIsR0FBRyxJQUFJLEVBQ3hCLEtBQUssRUFDTCxJQUFJLEVBQ0osTUFBTSxFQUNOLGdCQUFnQixFQUNoQixZQUFZLEVBQ1osVUFBVSxFQUNWLE9BQU8sRUFDUCxXQUFXLEVBQ1gsYUFBYSxFQUNiLFFBQVEsR0FDVCxHQUFHLE9BQU8sQ0FBQztJQUVaLElBQUksaUJBQWlCLEVBQUU7UUFDckIsK0JBQStCO1FBQy9CLElBQUksZ0JBQWdCLEVBQUU7WUFDcEIsSUFBSSxVQUFVLEtBQUssYUFBYSxFQUFFO2dCQUNoQyxNQUFNLENBQUMsS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7Z0JBRWxFLE9BQU87YUFDUjtZQUVELE1BQU0sa0JBQUUsQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQzFFO1FBRUQsb0NBQW9DO1FBQ3BDLElBQUk7WUFDRixNQUFNLGtCQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFD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O2dCQUVwRSxNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUM7YUFDckI7aUJBQU07Z0JBQ0wsZ0ZBQWdGO2dCQUNoRiw4REFBOEQ7Z0JBQzlELE1BQU0sTUFBTSxDQUFDLGVBQXNCLENBQUM7YUFDckM7U0FDRjtLQUNGO1lBQVM7UUFDUix5REFBeUQ7UUFDekQsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFOUQsSUFBQSxzQ0FBc0IsR0FBRSxDQUFDO0tBQzFCO0FBQ0gsQ0FBQztBQXJMRCxzREFxTEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlck91dHB1dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IEV4ZWN1dGlvblJlc3VsdCwgUmVidWlsZFN0YXRlIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQnO1xuaW1wb3J0IHsgc2h1dGRvd25TYXNzV29ya2VyUG9vbCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc2Fzcy1sYW5ndWFnZSc7XG5pbXBvcnQgeyB3aXRoTm9Qcm9ncmVzcywgd2l0aFNwaW5uZXIsIHdyaXRlUmVzdWx0RmlsZXMgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL3V0aWxzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogcnVuRXNCdWlsZEJ1aWxkQWN0aW9uKFxuICBhY3Rpb246IChyZWJ1aWxkU3RhdGU/OiBSZWJ1aWxkU3RhdGUpID0+IEV4ZWN1dGlvblJlc3VsdCB8IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PixcbiAgb3B0aW9uczoge1xuICAgIHdvcmtzcGFjZVJvb3Q6IHN0cmluZztcbiAgICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICAgIG91dHB1dFBhdGg6IHN0cmluZztcbiAgICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpO1xuICAgIGNhY2hlT3B0aW9uczogTm9ybWFsaXplZENhY2hlZE9wdGlvbnM7XG4gICAgd3JpdGVUb0ZpbGVTeXN0ZW0/OiBib29sZWFuO1xuICAgIHdyaXRlVG9GaWxlU3lzdGVtRmlsdGVyPzogKGZpbGU6IEJ1aWxkT3V0cHV0RmlsZSkgPT4gYm9vbGVhbjtcbiAgICB3YXRjaD86IGJvb2xlYW47XG4gICAgdmVyYm9zZT86IGJvb2xlYW47XG4gICAgcHJvZ3Jlc3M/OiBib29sZWFuO1xuICAgIGRlbGV0ZU91dHB1dFBhdGg/OiBib29sZWFuO1xuICAgIHBvbGw/OiBudW1iZXI7XG4gICAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlPChFeGVjdXRpb25SZXN1bHRbJ291dHB1dFdpdGhGaWxlcyddIHwgRXhlY3V0aW9uUmVzdWx0WydvdXRwdXQnXSkgJiBCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHtcbiAgICB3cml0ZVRvRmlsZVN5c3RlbUZpbHRlcixcbiAgICB3cml0ZVRvRmlsZVN5c3RlbSA9IHRydWUsXG4gICAgd2F0Y2gsXG4gICAgcG9sbCxcbiAgICBsb2dnZXIsXG4gICAgZGVsZXRlT3V0cHV0UGF0aCxcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICB2ZXJib3NlLFxuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgcHJvZ3Jlc3MsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGlmICh3cml0ZVRvRmlsZVN5c3RlbSkge1xuICAgIC8vIENsZWFuIG91dHB1dCBwYXRoIGlmIGVuYWJsZWRcbiAgICBpZiAoZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgICAgaWYgKG91dHB1dFBhdGggPT09IHdvcmtzcGFjZVJvb3QpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKCdPdXRwdXQgcGF0aCBNVVNUIG5vdCBiZSB3b3Jrc3BhY2Ugcm9vdCBkaXJlY3RvcnkhJyk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBmcy5ybShvdXRwdXRQYXRoLCB7IGZvcmNlOiB0cnVlLCByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKG91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICBsb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBjb25zdCB3aXRoUHJvZ3Jlc3M6IHR5cGVvZiB3aXRoU3Bpbm5lciA9IHByb2dyZXNzID8gd2l0aFNwaW5uZXIgOiB3aXRoTm9Qcm9ncmVzcztcblxuICAvLyBJbml0aWFsIGJ1aWxkXG4gIGxldCByZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0J1aWxkaW5nLi4uJywgKCkgPT4gYWN0aW9uKCkpO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIEVuc3VyZSBTYXNzIHdvcmtlcnMgYXJlIHNodXRkb3duIGlmIG5vdCB3YXRjaGluZ1xuICAgIGlmICghd2F0Y2gpIHtcbiAgICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgICB9XG4gIH1cblxuICAvLyBTZXR1cCB3YXRjaGVyIGlmIHdhdGNoIG1vZGUgZW5hYmxlZFxuICBsZXQgd2F0Y2hlcjogaW1wb3J0KCcuLi8uLi90b29scy9lc2J1aWxkL3dhdGNoZXInKS5CdWlsZFdhdGNoZXIgfCB1bmRlZmluZWQ7XG4gIGlmICh3YXRjaCkge1xuICAgIGlmIChwcm9ncmVzcykge1xuICAgICAgbG9nZ2VyLmluZm8oJ1dhdGNoIG1vZGUgZW5hYmxlZC4gV2F0Y2hpbmcgZm9yIGZpbGUgY2hhbmdlcy4uLicpO1xuICAgIH1cblxuICAgIC8vIFNldHVwIGEgd2F0Y2hlclxuICAgIGNvbnN0IHsgY3JlYXRlV2F0Y2hlciB9ID0gYXdhaXQgaW1wb3J0KCcuLi8uLi90b29scy9lc2J1aWxkL3dhdGNoZXInKTtcbiAgICB3YXRjaGVyID0gY3JlYXRlV2F0Y2hlcih7XG4gICAgICBwb2xsaW5nOiB0eXBlb2YgcG9sbCA9PT0gJ251bWJlcicsXG4gICAgICBpbnRlcnZhbDogcG9sbCxcbiAgICAgIGlnbm9yZWQ6IFtcbiAgICAgICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIGNhY2hlT3B0aW9ucy5iYXNlUGF0aCxcbiAgICAgICAgLy8gSWdub3JlIGFsbCBub2RlIG1vZHVsZXMgZGlyZWN0b3JpZXMgdG8gYXZvaWQgZXhjZXNzaXZlIGZpbGUgd2F0Y2hlcnMuXG4gICAgICAgIC8vIFBhY2thZ2UgY2hhbmdlcyBhcmUgaGFuZGxlZCBiZWxvdyBieSB3YXRjaGluZyBtYW5pZmVzdCBhbmQgbG9jayBmaWxlcy5cbiAgICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgICAgICcqKi8uKi8qKicsXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gU2V0dXAgYWJvcnQgc3VwcG9ydFxuICAgIG9wdGlvbnMuc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHZvaWQgd2F0Y2hlcj8uY2xvc2UoKSk7XG5cbiAgICAvLyBUZW1wb3JhcmlseSB3YXRjaCB0aGUgZW50aXJlIHByb2plY3RcbiAgICB3YXRjaGVyLmFkZChwcm9qZWN0Um9vdCk7XG5cbiAgICAvLyBXYXRjaCB3b3Jrc3BhY2UgZm9yIHBhY2thZ2UgbWFuYWdlciBjaGFuZ2VzXG4gICAgY29uc3QgcGFja2FnZVdhdGNoRmlsZXMgPSBbXG4gICAgICAvLyBtYW5pZmVzdCBjYW4gYWZmZWN0IG1vZHVsZSByZXNvbHV0aW9uXG4gICAgICAncGFja2FnZS5qc29uJyxcbiAgICAgIC8vIG5wbSBsb2NrIGZpbGVcbiAgICAgICdwYWNrYWdlLWxvY2suanNvbicsXG4gICAgICAvLyBwbnBtIGxvY2sgZmlsZVxuICAgICAgJ3BucG0tbG9jay55YW1sJyxcbiAgICAgIC8vIHlhcm4gbG9jayBmaWxlIGluY2x1ZGluZyBZYXJuIFBuUCBtYW5pZmVzdCBmaWxlcyAoaHR0cHM6Ly95YXJucGtnLmNvbS9hZHZhbmNlZC9wbnAtc3BlYy8pXG4gICAgICAneWFybi5sb2NrJyxcbiAgICAgICcucG5wLmNqcycsXG4gICAgICAnLnBucC5kYXRhLmpzb24nLFxuICAgIF07XG5cbiAgICB3YXRjaGVyLmFkZChwYWNrYWdlV2F0Y2hGaWxlcy5tYXAoKGZpbGUpID0+IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBmaWxlKSkpO1xuXG4gICAgLy8gV2F0Y2ggbG9jYXRpb25zIHByb3ZpZGVkIGJ5IHRoZSBpbml0aWFsIGJ1aWxkIHJlc3VsdFxuICAgIHdhdGNoZXIuYWRkKHJlc3VsdC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIC8vIE91dHB1dCB0aGUgZmlyc3QgYnVpbGQgcmVzdWx0cyBhZnRlciBzZXR0aW5nIHVwIHRoZSB3YXRjaGVyIHRvIGVuc3VyZSB0aGF0IGFueSBjb2RlIGV4ZWN1dGVkXG4gIC8vIGhpZ2hlciBpbiB0aGUgaXRlcmF0b3IgY2FsbCBzdGFjayB3aWxsIHRyaWdnZXIgdGhlIHdhdGNoZXIuIFRoaXMgaXMgcGFydGljdWxhcmx5IHJlbGV2YW50IGZvclxuICAvLyB1bml0IHRlc3RzIHdoaWNoIGV4ZWN1dGUgdGhlIGJ1aWxkZXIgYW5kIG1vZGlmeSB0aGUgZmlsZSBzeXN0ZW0gcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKHdyaXRlVG9GaWxlU3lzdGVtKSB7XG4gICAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBvdXRwdXRQYXRoKTtcblxuICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gIH0gZWxzZSB7XG4gICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIHlpZWxkIHJlc3VsdC5vdXRwdXRXaXRoRmlsZXMgYXMgYW55O1xuICB9XG5cbiAgLy8gRmluaXNoIGlmIHdhdGNoIG1vZGUgaXMgbm90IGVuYWJsZWRcbiAgaWYgKCF3YXRjaGVyKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gV2FpdCBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZCBhcyBuZWVkZWRcbiAgbGV0IHByZXZpb3VzV2F0Y2hGaWxlcyA9IG5ldyBTZXQocmVzdWx0LndhdGNoRmlsZXMpO1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2hhbmdlcyBvZiB3YXRjaGVyKSB7XG4gICAgICBpZiAob3B0aW9ucy5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmICh2ZXJib3NlKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgd2l0aFByb2dyZXNzKCdDaGFuZ2VzIGRldGVjdGVkLiBSZWJ1aWxkaW5nLi4uJywgKCkgPT5cbiAgICAgICAgYWN0aW9uKHJlc3VsdC5jcmVhdGVSZWJ1aWxkU3RhdGUoY2hhbmdlcykpLFxuICAgICAgKTtcblxuICAgICAgLy8gVXBkYXRlIHdhdGNoZWQgbG9jYXRpb25zIHByb3ZpZGVkIGJ5IHRoZSBuZXcgYnVpbGQgcmVzdWx0LlxuICAgICAgLy8gQWRkIGFueSBuZXcgbG9jYXRpb25zXG4gICAgICB3YXRjaGVyLmFkZChyZXN1bHQud2F0Y2hGaWxlcy5maWx0ZXIoKHdhdGNoRmlsZSkgPT4gIXByZXZpb3VzV2F0Y2hGaWxlcy5oYXMod2F0Y2hGaWxlKSkpO1xuICAgICAgY29uc3QgbmV3V2F0Y2hGaWxlcyA9IG5ldyBTZXQocmVzdWx0LndhdGNoRmlsZXMpO1xuICAgICAgLy8gUmVtb3ZlIGFueSBvbGQgbG9jYXRpb25zXG4gICAgICB3YXRjaGVyLnJlbW92ZShbLi4ucHJldmlvdXNXYXRjaEZpbGVzXS5maWx0ZXIoKHdhdGNoRmlsZSkgPT4gIW5ld1dhdGNoRmlsZXMuaGFzKHdhdGNoRmlsZSkpKTtcbiAgICAgIHByZXZpb3VzV2F0Y2hGaWxlcyA9IG5ld1dhdGNoRmlsZXM7XG5cbiAgICAgIGlmICh3cml0ZVRvRmlsZVN5c3RlbSkge1xuICAgICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgY29uc3QgZmlsZXNUb1dyaXRlID0gd3JpdGVUb0ZpbGVTeXN0ZW1GaWx0ZXJcbiAgICAgICAgICA/IHJlc3VsdC5vdXRwdXRGaWxlcy5maWx0ZXIod3JpdGVUb0ZpbGVTeXN0ZW1GaWx0ZXIpXG4gICAgICAgICAgOiByZXN1bHQub3V0cHV0RmlsZXM7XG4gICAgICAgIGF3YWl0IHdyaXRlUmVzdWx0RmlsZXMoZmlsZXNUb1dyaXRlLCByZXN1bHQuYXNzZXRGaWxlcywgb3V0cHV0UGF0aCk7XG5cbiAgICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFJlcXVpcmVzIGNhc3RpbmcgZHVlIHRvIHVubmVlZGVkIGBKc29uT2JqZWN0YCByZXF1aXJlbWVudC4gUmVtb3ZlIG9uY2UgZml4ZWQuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXRXaXRoRmlsZXMgYXMgYW55O1xuICAgICAgfVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBTdG9wIHRoZSB3YXRjaGVyIGFuZCBjbGVhbnVwIGluY3JlbWVudGFsIHJlYnVpbGQgc3RhdGVcbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW3dhdGNoZXIuY2xvc2UoKSwgcmVzdWx0LmRpc3Bvc2UoKV0pO1xuXG4gICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuICB9XG59XG4iXX0=