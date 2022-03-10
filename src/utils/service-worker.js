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
exports.augmentAppWithServiceWorker = void 0;
const core_1 = require("@angular-devkit/core");
const crypto = __importStar(require("crypto"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const stream_1 = require("stream");
const load_esm_1 = require("./load-esm");
class CliFilesystem {
    constructor(base) {
        this.base = base;
    }
    list(dir) {
        return this._recursiveList(this._resolve(dir), []);
    }
    read(file) {
        return fs_1.promises.readFile(this._resolve(file), 'utf-8');
    }
    hash(file) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha1').setEncoding('hex');
            (0, stream_1.pipeline)((0, fs_1.createReadStream)(this._resolve(file)), hash, (error) => error ? reject(error) : resolve(hash.read()));
        });
    }
    write(file, content) {
        return fs_1.promises.writeFile(this._resolve(file), content);
    }
    _resolve(file) {
        return path.join(this.base, file);
    }
    async _recursiveList(dir, items) {
        const subdirectories = [];
        for await (const entry of await fs_1.promises.opendir(dir)) {
            if (entry.isFile()) {
                // Uses posix paths since the service worker expects URLs
                items.push('/' + path.relative(this.base, path.join(dir, entry.name)).replace(/\\/g, '/'));
            }
            else if (entry.isDirectory()) {
                subdirectories.push(path.join(dir, entry.name));
            }
        }
        for (const subdirectory of subdirectories) {
            await this._recursiveList(subdirectory, items);
        }
        return items;
    }
}
async function augmentAppWithServiceWorker(appRoot, outputPath, baseHref, ngswConfigPath) {
    const distPath = (0, core_1.getSystemPath)((0, core_1.normalize)(outputPath));
    // Determine the configuration file path
    const configPath = ngswConfigPath
        ? (0, core_1.getSystemPath)((0, core_1.normalize)(ngswConfigPath))
        : path.join((0, core_1.getSystemPath)(appRoot), 'ngsw-config.json');
    // Read the configuration file
    let config;
    try {
        const configurationData = await fs_1.promises.readFile(configPath, 'utf-8');
        config = JSON.parse(configurationData);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('Error: Expected to find an ngsw-config.json configuration file' +
                ` in the ${(0, core_1.getSystemPath)(appRoot)} folder. Either provide one or` +
                ' disable Service Worker in the angular.json configuration file.');
        }
        else {
            throw error;
        }
    }
    // Load ESM `@angular/service-worker/config` using the TypeScript dynamic import workaround.
    // Once TypeScript provides support for keeping the dynamic import this workaround can be
    // changed to a direct dynamic import.
    const GeneratorConstructor = (await (0, load_esm_1.loadEsmModule)('@angular/service-worker/config')).Generator;
    // Generate the manifest
    const generator = new GeneratorConstructor(new CliFilesystem(distPath), baseHref);
    const output = await generator.process(config);
    // Write the manifest
    const manifest = JSON.stringify(output, null, 2);
    await fs_1.promises.writeFile(path.join(distPath, 'ngsw.json'), manifest);
    // Find the service worker package
    const workerPath = require.resolve('@angular/service-worker/ngsw-worker.js');
    // Write the worker code
    await fs_1.promises.copyFile(workerPath, path.join(distPath, 'ngsw-worker.js'), fs_1.constants.COPYFILE_FICLONE);
    // If present, write the safety worker code
    const safetyPath = path.join(path.dirname(workerPath), 'safety-worker.js');
    try {
        await fs_1.promises.copyFile(safetyPath, path.join(distPath, 'worker-basic.min.js'), fs_1.constants.COPYFILE_FICLONE);
        await fs_1.promises.copyFile(safetyPath, path.join(distPath, 'safety-worker.js'), fs_1.constants.COPYFILE_FICLONE);
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}
exports.augmentAppWithServiceWorker = augmentAppWithServiceWorker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2aWNlLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILCtDQUFzRTtBQUV0RSwrQ0FBaUM7QUFDakMsMkJBQWdGO0FBQ2hGLDJDQUE2QjtBQUM3QixtQ0FBa0M7QUFDbEMseUNBQTJDO0FBRTNDLE1BQU0sYUFBYTtJQUNqQixZQUFvQixJQUFZO1FBQVosU0FBSSxHQUFKLElBQUksQ0FBUTtJQUFHLENBQUM7SUFFcEMsSUFBSSxDQUFDLEdBQVc7UUFDZCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixPQUFPLGFBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzFELElBQUEsaUJBQVEsRUFBQyxJQUFBLHFCQUFnQixFQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUM5RCxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENB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Q2QsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtZQUMzQixNQUFNLEtBQUssQ0FBQztTQUNiO0tBQ0Y7QUFDSCxDQUFDO0FBM0VELGtFQTJFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBub3JtYWxpemUgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZywgRmlsZXN5c3RlbSB9IGZyb20gJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IGNyZWF0ZVJlYWRTdHJlYW0sIHByb21pc2VzIGFzIGZzLCBjb25zdGFudHMgYXMgZnNDb25zdGFudHMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcGlwZWxpbmUgfSBmcm9tICdzdHJlYW0nO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG5jbGFzcyBDbGlGaWxlc3lzdGVtIGltcGxlbWVudHMgRmlsZXN5c3RlbSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmFzZTogc3RyaW5nKSB7fVxuXG4gIGxpc3QoZGlyOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgcmV0dXJuIHRoaXMuX3JlY3Vyc2l2ZUxpc3QodGhpcy5fcmVzb2x2ZShkaXIpLCBbXSk7XG4gIH1cblxuICByZWFkKGZpbGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIGZzLnJlYWRGaWxlKHRoaXMuX3Jlc29sdmUoZmlsZSksICd1dGYtOCcpO1xuICB9XG5cbiAgaGFzaChmaWxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTEnKS5zZXRFbmNvZGluZygnaGV4Jyk7XG4gICAgICBwaXBlbGluZShjcmVhdGVSZWFkU3RyZWFtKHRoaXMuX3Jlc29sdmUoZmlsZSkpLCBoYXNoLCAoZXJyb3IpID0+XG4gICAgICAgIGVycm9yID8gcmVqZWN0KGVycm9yKSA6IHJlc29sdmUoaGFzaC5yZWFkKCkpLFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIHdyaXRlKGZpbGU6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIGZzLndyaXRlRmlsZSh0aGlzLl9yZXNvbHZlKGZpbGUpLCBjb250ZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jlc29sdmUoZmlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKHRoaXMuYmFzZSwgZmlsZSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9yZWN1cnNpdmVMaXN0KGRpcjogc3RyaW5nLCBpdGVtczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3Qgc3ViZGlyZWN0b3JpZXMgPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IGZzLm9wZW5kaXIoZGlyKSkge1xuICAgICAgaWYgKGVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgIC8vIFVzZXMgcG9zaXggcGF0aHMgc2luY2UgdGhlIHNlcnZpY2Ugd29ya2VyIGV4cGVjdHMgVVJMc1xuICAgICAgICBpdGVtcy5wdXNoKCcvJyArIHBhdGgucmVsYXRpdmUodGhpcy5iYXNlLCBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKSkucmVwbGFjZSgvXFxcXC9nLCAnLycpKTtcbiAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICBzdWJkaXJlY3Rvcmllcy5wdXNoKHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHN1YmRpcmVjdG9yeSBvZiBzdWJkaXJlY3Rvcmllcykge1xuICAgICAgYXdhaXQgdGhpcy5fcmVjdXJzaXZlTGlzdChzdWJkaXJlY3RvcnksIGl0ZW1zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaXRlbXM7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgYXBwUm9vdDogUGF0aCxcbiAgb3V0cHV0UGF0aDogUGF0aCxcbiAgYmFzZUhyZWY6IHN0cmluZyxcbiAgbmdzd0NvbmZpZ1BhdGg/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZGlzdFBhdGggPSBnZXRTeXN0ZW1QYXRoKG5vcm1hbGl6ZShvdXRwdXRQYXRoKSk7XG5cbiAgLy8gRGV0ZXJtaW5lIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgcGF0aFxuICBjb25zdCBjb25maWdQYXRoID0gbmdzd0NvbmZpZ1BhdGhcbiAgICA/IGdldFN5c3RlbVBhdGgobm9ybWFsaXplKG5nc3dDb25maWdQYXRoKSlcbiAgICA6IHBhdGguam9pbihnZXRTeXN0ZW1QYXRoKGFwcFJvb3QpLCAnbmdzdy1jb25maWcuanNvbicpO1xuXG4gIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZVxuICBsZXQgY29uZmlnOiBDb25maWcgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbkRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShjb25maWdQYXRoLCAndXRmLTgnKTtcbiAgICBjb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ3VyYXRpb25EYXRhKSBhcyBDb25maWc7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdFcnJvcjogRXhwZWN0ZWQgdG8gZmluZCBhbiBuZ3N3LWNvbmZpZy5qc29uIGNvbmZpZ3VyYXRpb24gZmlsZScgK1xuICAgICAgICAgIGAgaW4gdGhlICR7Z2V0U3lzdGVtUGF0aChhcHBSb290KX0gZm9sZGVyLiBFaXRoZXIgcHJvdmlkZSBvbmUgb3JgICtcbiAgICAgICAgICAnIGRpc2FibGUgU2VydmljZSBXb3JrZXIgaW4gdGhlIGFuZ3VsYXIuanNvbiBjb25maWd1cmF0aW9uIGZpbGUuJyxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWdgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IEdlbmVyYXRvckNvbnN0cnVjdG9yID0gKFxuICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJyk+KFxuICAgICAgJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZycsXG4gICAgKVxuICApLkdlbmVyYXRvcjtcblxuICAvLyBHZW5lcmF0ZSB0aGUgbWFuaWZlc3RcbiAgY29uc3QgZ2VuZXJhdG9yID0gbmV3IEdlbmVyYXRvckNvbnN0cnVjdG9yKG5ldyBDbGlGaWxlc3lzdGVtKGRpc3RQYXRoKSwgYmFzZUhyZWYpO1xuICBjb25zdCBvdXRwdXQgPSBhd2FpdCBnZW5lcmF0b3IucHJvY2Vzcyhjb25maWcpO1xuXG4gIC8vIFdyaXRlIHRoZSBtYW5pZmVzdFxuICBjb25zdCBtYW5pZmVzdCA9IEpTT04uc3RyaW5naWZ5KG91dHB1dCwgbnVsbCwgMik7XG4gIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4oZGlzdFBhdGgsICduZ3N3Lmpzb24nKSwgbWFuaWZlc3QpO1xuXG4gIC8vIEZpbmQgdGhlIHNlcnZpY2Ugd29ya2VyIHBhY2thZ2VcbiAgY29uc3Qgd29ya2VyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvbmdzdy13b3JrZXIuanMnKTtcblxuICAvLyBXcml0ZSB0aGUgd29ya2VyIGNvZGVcbiAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgd29ya2VyUGF0aCxcbiAgICBwYXRoLmpvaW4oZGlzdFBhdGgsICduZ3N3LXdvcmtlci5qcycpLFxuICAgIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUsXG4gICk7XG5cbiAgLy8gSWYgcHJlc2VudCwgd3JpdGUgdGhlIHNhZmV0eSB3b3JrZXIgY29kZVxuICBjb25zdCBzYWZldHlQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZSh3b3JrZXJQYXRoKSwgJ3NhZmV0eS13b3JrZXIuanMnKTtcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5jb3B5RmlsZShcbiAgICAgIHNhZmV0eVBhdGgsXG4gICAgICBwYXRoLmpvaW4oZGlzdFBhdGgsICd3b3JrZXItYmFzaWMubWluLmpzJyksXG4gICAgICBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FLFxuICAgICk7XG4gICAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgICBzYWZldHlQYXRoLFxuICAgICAgcGF0aC5qb2luKGRpc3RQYXRoLCAnc2FmZXR5LXdvcmtlci5qcycpLFxuICAgICAgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG59XG4iXX0=