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
    const { writeToFileSystem = true, watch, poll, logger, deleteOutputPath, cacheOptions, outputPath, verbose, projectRoot, workspaceRoot, progress, } = options;
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
                await (0, utils_1.writeResultFiles)(result.outputFiles, result.assetFiles, outputPath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGQtYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYXBwbGljYXRpb24vYnVpbGQtYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUU3QixpRkFBdUY7QUFDdkYscURBQTBGO0FBQzFGLDZDQUFrRDtBQUczQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLHFCQUFxQixDQUMxQyxNQUFtRixFQUNuRixPQWFDO0lBRUQsTUFBTSxFQUNKLGlCQUFpQixHQUFHLElBQUksRUFDeEIsS0FBSyxFQUNMLElBQUksRUFDSixNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLFlBQVksRUFDWixVQUFVLEVBQ1YsT0FBTyxFQUNQLFdBQVcsRUFDWCxhQUFhLEVBQ2IsUUFBUSxHQUNULEdBQUcsT0FBTyxDQUFDO0lBRVosSUFBSSxpQkFBaUIsRUFBRTtRQUNyQiwrQkFBK0I7UUFDL0IsSUFBSSxnQkFBZ0IsRUFBRTtZQUNwQixJQUFJLFVBQVUsS0FBSyxhQUFhLEVBQUU7Z0JBQ2hDLE1BQU0sQ0FBQyxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztnQkFFbEUsT0FBTzthQUNSO1lBRUQsTUFBTSxrQkFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDMUU7UUFFRCxvQ0FBb0M7UUFDcEMsSUFBSTtZQUNGLE1BQU0sa0JBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7U0FDakQ7UUFBQyxP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Q1IseURBQXlEO1FBQ3pELE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTlELElBQUEsc0NBQXNCLEdBQUUsQ0FBQztLQUMxQjtBQUNILENBQUM7QUFoTEQsc0RBZ0xDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJPdXRwdXQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsgbG9nZ2luZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBFeGVjdXRpb25SZXN1bHQsIFJlYnVpbGRTdGF0ZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcbmltcG9ydCB7IHNodXRkb3duU2Fzc1dvcmtlclBvb2wgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL3N0eWxlc2hlZXRzL3Nhc3MtbGFuZ3VhZ2UnO1xuaW1wb3J0IHsgd2l0aE5vUHJvZ3Jlc3MsIHdpdGhTcGlubmVyLCB3cml0ZVJlc3VsdEZpbGVzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgTm9ybWFsaXplZENhY2hlZE9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHJ1bkVzQnVpbGRCdWlsZEFjdGlvbihcbiAgYWN0aW9uOiAocmVidWlsZFN0YXRlPzogUmVidWlsZFN0YXRlKSA9PiBFeGVjdXRpb25SZXN1bHQgfCBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4sXG4gIG9wdGlvbnM6IHtcbiAgICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gICAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gICAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaTtcbiAgICBjYWNoZU9wdGlvbnM6IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zO1xuICAgIHdyaXRlVG9GaWxlU3lzdGVtPzogYm9vbGVhbjtcbiAgICB3YXRjaD86IGJvb2xlYW47XG4gICAgdmVyYm9zZT86IGJvb2xlYW47XG4gICAgcHJvZ3Jlc3M/OiBib29sZWFuO1xuICAgIGRlbGV0ZU91dHB1dFBhdGg/OiBib29sZWFuO1xuICAgIHBvbGw/OiBudW1iZXI7XG4gICAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlPChFeGVjdXRpb25SZXN1bHRbJ291dHB1dFdpdGhGaWxlcyddIHwgRXhlY3V0aW9uUmVzdWx0WydvdXRwdXQnXSkgJiBCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHtcbiAgICB3cml0ZVRvRmlsZVN5c3RlbSA9IHRydWUsXG4gICAgd2F0Y2gsXG4gICAgcG9sbCxcbiAgICBsb2dnZXIsXG4gICAgZGVsZXRlT3V0cHV0UGF0aCxcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICB2ZXJib3NlLFxuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgcHJvZ3Jlc3MsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGlmICh3cml0ZVRvRmlsZVN5c3RlbSkge1xuICAgIC8vIENsZWFuIG91dHB1dCBwYXRoIGlmIGVuYWJsZWRcbiAgICBpZiAoZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgICAgaWYgKG91dHB1dFBhdGggPT09IHdvcmtzcGFjZVJvb3QpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKCdPdXRwdXQgcGF0aCBNVVNUIG5vdCBiZSB3b3Jrc3BhY2Ugcm9vdCBkaXJlY3RvcnkhJyk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBmcy5ybShvdXRwdXRQYXRoLCB7IGZvcmNlOiB0cnVlLCByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKG91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICBsb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBjb25zdCB3aXRoUHJvZ3Jlc3M6IHR5cGVvZiB3aXRoU3Bpbm5lciA9IHByb2dyZXNzID8gd2l0aFNwaW5uZXIgOiB3aXRoTm9Qcm9ncmVzcztcblxuICAvLyBJbml0aWFsIGJ1aWxkXG4gIGxldCByZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0J1aWxkaW5nLi4uJywgKCkgPT4gYWN0aW9uKCkpO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIEVuc3VyZSBTYXNzIHdvcmtlcnMgYXJlIHNodXRkb3duIGlmIG5vdCB3YXRjaGluZ1xuICAgIGlmICghd2F0Y2gpIHtcbiAgICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgICB9XG4gIH1cblxuICAvLyBTZXR1cCB3YXRjaGVyIGlmIHdhdGNoIG1vZGUgZW5hYmxlZFxuICBsZXQgd2F0Y2hlcjogaW1wb3J0KCcuLi8uLi90b29scy9lc2J1aWxkL3dhdGNoZXInKS5CdWlsZFdhdGNoZXIgfCB1bmRlZmluZWQ7XG4gIGlmICh3YXRjaCkge1xuICAgIGlmIChwcm9ncmVzcykge1xuICAgICAgbG9nZ2VyLmluZm8oJ1dhdGNoIG1vZGUgZW5hYmxlZC4gV2F0Y2hpbmcgZm9yIGZpbGUgY2hhbmdlcy4uLicpO1xuICAgIH1cblxuICAgIC8vIFNldHVwIGEgd2F0Y2hlclxuICAgIGNvbnN0IHsgY3JlYXRlV2F0Y2hlciB9ID0gYXdhaXQgaW1wb3J0KCcuLi8uLi90b29scy9lc2J1aWxkL3dhdGNoZXInKTtcbiAgICB3YXRjaGVyID0gY3JlYXRlV2F0Y2hlcih7XG4gICAgICBwb2xsaW5nOiB0eXBlb2YgcG9sbCA9PT0gJ251bWJlcicsXG4gICAgICBpbnRlcnZhbDogcG9sbCxcbiAgICAgIGlnbm9yZWQ6IFtcbiAgICAgICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIGNhY2hlT3B0aW9ucy5iYXNlUGF0aCxcbiAgICAgICAgLy8gSWdub3JlIGFsbCBub2RlIG1vZHVsZXMgZGlyZWN0b3JpZXMgdG8gYXZvaWQgZXhjZXNzaXZlIGZpbGUgd2F0Y2hlcnMuXG4gICAgICAgIC8vIFBhY2thZ2UgY2hhbmdlcyBhcmUgaGFuZGxlZCBiZWxvdyBieSB3YXRjaGluZyBtYW5pZmVzdCBhbmQgbG9jayBmaWxlcy5cbiAgICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgICAgICcqKi8uKi8qKicsXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gU2V0dXAgYWJvcnQgc3VwcG9ydFxuICAgIG9wdGlvbnMuc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHZvaWQgd2F0Y2hlcj8uY2xvc2UoKSk7XG5cbiAgICAvLyBUZW1wb3JhcmlseSB3YXRjaCB0aGUgZW50aXJlIHByb2plY3RcbiAgICB3YXRjaGVyLmFkZChwcm9qZWN0Um9vdCk7XG5cbiAgICAvLyBXYXRjaCB3b3Jrc3BhY2UgZm9yIHBhY2thZ2UgbWFuYWdlciBjaGFuZ2VzXG4gICAgY29uc3QgcGFja2FnZVdhdGNoRmlsZXMgPSBbXG4gICAgICAvLyBtYW5pZmVzdCBjYW4gYWZmZWN0IG1vZHVsZSByZXNvbHV0aW9uXG4gICAgICAncGFja2FnZS5qc29uJyxcbiAgICAgIC8vIG5wbSBsb2NrIGZpbGVcbiAgICAgICdwYWNrYWdlLWxvY2suanNvbicsXG4gICAgICAvLyBwbnBtIGxvY2sgZmlsZVxuICAgICAgJ3BucG0tbG9jay55YW1sJyxcbiAgICAgIC8vIHlhcm4gbG9jayBmaWxlIGluY2x1ZGluZyBZYXJuIFBuUCBtYW5pZmVzdCBmaWxlcyAoaHR0cHM6Ly95YXJucGtnLmNvbS9hZHZhbmNlZC9wbnAtc3BlYy8pXG4gICAgICAneWFybi5sb2NrJyxcbiAgICAgICcucG5wLmNqcycsXG4gICAgICAnLnBucC5kYXRhLmpzb24nLFxuICAgIF07XG5cbiAgICB3YXRjaGVyLmFkZChwYWNrYWdlV2F0Y2hGaWxlcy5tYXAoKGZpbGUpID0+IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBmaWxlKSkpO1xuXG4gICAgLy8gV2F0Y2ggbG9jYXRpb25zIHByb3ZpZGVkIGJ5IHRoZSBpbml0aWFsIGJ1aWxkIHJlc3VsdFxuICAgIHdhdGNoZXIuYWRkKHJlc3VsdC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIC8vIE91dHB1dCB0aGUgZmlyc3QgYnVpbGQgcmVzdWx0cyBhZnRlciBzZXR0aW5nIHVwIHRoZSB3YXRjaGVyIHRvIGVuc3VyZSB0aGF0IGFueSBjb2RlIGV4ZWN1dGVkXG4gIC8vIGhpZ2hlciBpbiB0aGUgaXRlcmF0b3IgY2FsbCBzdGFjayB3aWxsIHRyaWdnZXIgdGhlIHdhdGNoZXIuIFRoaXMgaXMgcGFydGljdWxhcmx5IHJlbGV2YW50IGZvclxuICAvLyB1bml0IHRlc3RzIHdoaWNoIGV4ZWN1dGUgdGhlIGJ1aWxkZXIgYW5kIG1vZGlmeSB0aGUgZmlsZSBzeXN0ZW0gcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKHdyaXRlVG9GaWxlU3lzdGVtKSB7XG4gICAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBvdXRwdXRQYXRoKTtcblxuICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gIH0gZWxzZSB7XG4gICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIHlpZWxkIHJlc3VsdC5vdXRwdXRXaXRoRmlsZXMgYXMgYW55O1xuICB9XG5cbiAgLy8gRmluaXNoIGlmIHdhdGNoIG1vZGUgaXMgbm90IGVuYWJsZWRcbiAgaWYgKCF3YXRjaGVyKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gV2FpdCBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZCBhcyBuZWVkZWRcbiAgbGV0IHByZXZpb3VzV2F0Y2hGaWxlcyA9IG5ldyBTZXQocmVzdWx0LndhdGNoRmlsZXMpO1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2hhbmdlcyBvZiB3YXRjaGVyKSB7XG4gICAgICBpZiAob3B0aW9ucy5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmICh2ZXJib3NlKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgd2l0aFByb2dyZXNzKCdDaGFuZ2VzIGRldGVjdGVkLiBSZWJ1aWxkaW5nLi4uJywgKCkgPT5cbiAgICAgICAgYWN0aW9uKHJlc3VsdC5jcmVhdGVSZWJ1aWxkU3RhdGUoY2hhbmdlcykpLFxuICAgICAgKTtcblxuICAgICAgLy8gVXBkYXRlIHdhdGNoZWQgbG9jYXRpb25zIHByb3ZpZGVkIGJ5IHRoZSBuZXcgYnVpbGQgcmVzdWx0LlxuICAgICAgLy8gQWRkIGFueSBuZXcgbG9jYXRpb25zXG4gICAgICB3YXRjaGVyLmFkZChyZXN1bHQud2F0Y2hGaWxlcy5maWx0ZXIoKHdhdGNoRmlsZSkgPT4gIXByZXZpb3VzV2F0Y2hGaWxlcy5oYXMod2F0Y2hGaWxlKSkpO1xuICAgICAgY29uc3QgbmV3V2F0Y2hGaWxlcyA9IG5ldyBTZXQocmVzdWx0LndhdGNoRmlsZXMpO1xuICAgICAgLy8gUmVtb3ZlIGFueSBvbGQgbG9jYXRpb25zXG4gICAgICB3YXRjaGVyLnJlbW92ZShbLi4ucHJldmlvdXNXYXRjaEZpbGVzXS5maWx0ZXIoKHdhdGNoRmlsZSkgPT4gIW5ld1dhdGNoRmlsZXMuaGFzKHdhdGNoRmlsZSkpKTtcbiAgICAgIHByZXZpb3VzV2F0Y2hGaWxlcyA9IG5ld1dhdGNoRmlsZXM7XG5cbiAgICAgIGlmICh3cml0ZVRvRmlsZVN5c3RlbSkge1xuICAgICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBvdXRwdXRQYXRoKTtcblxuICAgICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIFN0b3AgdGhlIHdhdGNoZXIgYW5kIGNsZWFudXAgaW5jcmVtZW50YWwgcmVidWlsZCBzdGF0ZVxuICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbd2F0Y2hlci5jbG9zZSgpLCByZXN1bHQuZGlzcG9zZSgpXSk7XG5cbiAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gIH1cbn1cbiJdfQ==