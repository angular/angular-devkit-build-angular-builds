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
const crypto = __importStar(require("crypto"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const stream_1 = require("stream");
const error_1 = require("./error");
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
async function augmentAppWithServiceWorker(appRoot, workspaceRoot, outputPath, baseHref, ngswConfigPath) {
    // Determine the configuration file path
    const configPath = ngswConfigPath
        ? path.join(workspaceRoot, ngswConfigPath)
        : path.join(appRoot, 'ngsw-config.json');
    // Read the configuration file
    let config;
    try {
        const configurationData = await fs_1.promises.readFile(configPath, 'utf-8');
        config = JSON.parse(configurationData);
    }
    catch (error) {
        (0, error_1.assertIsError)(error);
        if (error.code === 'ENOENT') {
            throw new Error('Error: Expected to find an ngsw-config.json configuration file' +
                ` in the ${appRoot} folder. Either provide one or` +
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
    const generator = new GeneratorConstructor(new CliFilesystem(outputPath), baseHref);
    const output = await generator.process(config);
    // Write the manifest
    const manifest = JSON.stringify(output, null, 2);
    await fs_1.promises.writeFile(path.join(outputPath, 'ngsw.json'), manifest);
    // Find the service worker package
    const workerPath = require.resolve('@angular/service-worker/ngsw-worker.js');
    // Write the worker code
    await fs_1.promises.copyFile(workerPath, path.join(outputPath, 'ngsw-worker.js'), fs_1.constants.COPYFILE_FICLONE);
    // If present, write the safety worker code
    const safetyPath = path.join(path.dirname(workerPath), 'safety-worker.js');
    try {
        await fs_1.promises.copyFile(safetyPath, path.join(outputPath, 'worker-basic.min.js'), fs_1.constants.COPYFILE_FICLONE);
        await fs_1.promises.copyFile(safetyPath, path.join(outputPath, 'safety-worker.js'), fs_1.constants.COPYFILE_FICLONE);
    }
    catch (error) {
        (0, error_1.assertIsError)(error);
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}
exports.augmentAppWithServiceWorker = augmentAppWithServiceWorker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2aWNlLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUFpQztBQUNqQywyQkFBZ0Y7QUFDaEYsMkNBQTZCO0FBQzdCLG1DQUFrQztBQUNsQyxtQ0FBd0M7QUFDeEMseUNBQTJDO0FBRTNDLE1BQU0sYUFBYTtJQUNqQixZQUFvQixJQUFZO1FBQVosU0FBSSxHQUFKLElBQUksQ0FBUTtJQUFHLENBQUM7SUFFcEMsSUFBSSxDQUFDLEdBQVc7UUFDZCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixPQUFPLGFBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzFELElBQUEsaUJBQVEsRUFBQyxJQUFBLHFCQUFnQixFQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUM5RCxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUM3QyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQVksRUFBRSxPQUFlO1FBQ2pDLE9BQU8sYUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFTyxRQUFRLENBQUMsSUFBWTtRQUMzQixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRU8sS0FBSyxDQUFDLGNBQWMsQ0FBQyxHQUFXLEVBQUUsS0FBZTtRQUN2RCxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUM7UUFDMUIsSUFBSSxLQUFLLEVBQUUsTUFBTSxLQUFLLElBQUksTUFBTSxhQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQy9DLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFO2dCQUNsQix5REFBeUQ7Z0JBQ3pELEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7YUFDNUY7aUJBQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUU7Z0JBQzlCLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDakQ7U0FDRjtRQUVELEtBQUssTUFBTSxZQUFZLElBQUksY0FBYyxFQUFFO1lBQ3pDLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDaEQ7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7Q0FDRjtBQUVNLEtBQUssVUFBVSwyQkFBMkIsQ0FDL0MsT0FBZSxFQUNmLGFBQXFCLEVBQ3JCLFVBQWtCLEVBQ2xCLFFBQWdCLEVBQ2hCLGNBQXVCO0lBRXZCLHdDQUF3QztJQUN4QyxNQUFNLFVBQVUsR0FBRyxjQUFjO1FBQy9CLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxjQUFjLENBQUM7UUFDMUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFFM0MsOEJBQThCO0lBQzlCLElBQUksTUFBMEIsQ0FBQztJQUMvQixJQUFJO1FBQ0YsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLGFBQUUsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFXLENBQUM7S0FDbEQ7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLElBQUEscUJBQWEsRUFBQyxLQUFLLENBQUMsQ0FBQztRQUNyQixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQ2IsZ0VBQWdFO2dCQUM5RCxXQUFXLE9BQU8sZ0NBQWdDO2dCQUNsRCxpRUFBaUUsQ0FDcEUsQ0FBQztTQUNIO2FBQU07WUFDTCxNQUFNLEtBQUssQ0FBQztTQUNiO0tBQ0Y7SUFFRCw0RkFBNEY7SUFDNUYseUZBQXlGO0lBQ3pGLHNDQUFzQztJQUN0QyxNQUFNLG9CQUFvQixHQUFHLENBQzNCLE1BQU0sSUFBQSx3QkFBYSxFQUNqQixnQ0FBZ0MsQ0FDakMsQ0FDRixDQUFDLFNBQVMsQ0FBQztJQUVaLHdCQUF3QjtJQUN4QixNQUFNLFNBQVMsR0FBRyxJQUFJLG9CQUFvQixDQUFDLElBQUksYUFBYSxDQUFDLFVBQVUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3BGLE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUUvQyxxQkFBcUI7SUFDckIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pELE1BQU0sYUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUVqRSxrQ0FBa0M7SUFDbEMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO0lBRTdFLHdCQUF3QjtJQUN4QixNQUFNLGFBQUUsQ0FBQyxRQUFRLENBQ2YsVUFBVSxFQUNWLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLGdCQUFnQixDQUFDLEVBQ3ZDLGNBQVcsQ0FBQyxnQkFBZ0IsQ0FDN0IsQ0FBQztJQUVGLDJDQUEyQztJQUMzQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUMzRSxJQUFJO1FBQ0YsTUFBTSxhQUFFLENBQUMsUUFBUSxDQUNmLFVBQVUsRUFDVixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxxQkFBcUIsQ0FBQyxFQUM1QyxjQUFXLENBQUMsZ0JBQWdCLENBQzdCLENBQUM7UUFDRixNQUFNLGFBQUUsQ0FBQyxRQUFRLENBQ2YsVUFBVSxFQUNWLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLGtCQUFrQixDQUFDLEVBQ3pDLGNBQVcsQ0FBQyxnQkFBZ0IsQ0FDN0IsQ0FBQztLQUNIO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxJQUFBLHFCQUFhLEVBQUMsS0FBSyxDQUFDLENBQUM7UUFDckIsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtZQUMzQixNQUFNLEtBQUssQ0FBQztTQUNiO0tBQ0Y7QUFDSCxDQUFDO0FBNUVELGtFQTRFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbmZpZywgRmlsZXN5c3RlbSB9IGZyb20gJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IGNyZWF0ZVJlYWRTdHJlYW0sIHByb21pc2VzIGFzIGZzLCBjb25zdGFudHMgYXMgZnNDb25zdGFudHMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcGlwZWxpbmUgfSBmcm9tICdzdHJlYW0nO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG5jbGFzcyBDbGlGaWxlc3lzdGVtIGltcGxlbWVudHMgRmlsZXN5c3RlbSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmFzZTogc3RyaW5nKSB7fVxuXG4gIGxpc3QoZGlyOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgcmV0dXJuIHRoaXMuX3JlY3Vyc2l2ZUxpc3QodGhpcy5fcmVzb2x2ZShkaXIpLCBbXSk7XG4gIH1cblxuICByZWFkKGZpbGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIGZzLnJlYWRGaWxlKHRoaXMuX3Jlc29sdmUoZmlsZSksICd1dGYtOCcpO1xuICB9XG5cbiAgaGFzaChmaWxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTEnKS5zZXRFbmNvZGluZygnaGV4Jyk7XG4gICAgICBwaXBlbGluZShjcmVhdGVSZWFkU3RyZWFtKHRoaXMuX3Jlc29sdmUoZmlsZSkpLCBoYXNoLCAoZXJyb3IpID0+XG4gICAgICAgIGVycm9yID8gcmVqZWN0KGVycm9yKSA6IHJlc29sdmUoaGFzaC5yZWFkKCkpLFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIHdyaXRlKGZpbGU6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIGZzLndyaXRlRmlsZSh0aGlzLl9yZXNvbHZlKGZpbGUpLCBjb250ZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jlc29sdmUoZmlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKHRoaXMuYmFzZSwgZmlsZSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9yZWN1cnNpdmVMaXN0KGRpcjogc3RyaW5nLCBpdGVtczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3Qgc3ViZGlyZWN0b3JpZXMgPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IGZzLm9wZW5kaXIoZGlyKSkge1xuICAgICAgaWYgKGVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgIC8vIFVzZXMgcG9zaXggcGF0aHMgc2luY2UgdGhlIHNlcnZpY2Ugd29ya2VyIGV4cGVjdHMgVVJMc1xuICAgICAgICBpdGVtcy5wdXNoKCcvJyArIHBhdGgucmVsYXRpdmUodGhpcy5iYXNlLCBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKSkucmVwbGFjZSgvXFxcXC9nLCAnLycpKTtcbiAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICBzdWJkaXJlY3Rvcmllcy5wdXNoKHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHN1YmRpcmVjdG9yeSBvZiBzdWJkaXJlY3Rvcmllcykge1xuICAgICAgYXdhaXQgdGhpcy5fcmVjdXJzaXZlTGlzdChzdWJkaXJlY3RvcnksIGl0ZW1zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaXRlbXM7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgYXBwUm9vdDogc3RyaW5nLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbiAgYmFzZUhyZWY6IHN0cmluZyxcbiAgbmdzd0NvbmZpZ1BhdGg/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgcGF0aFxuICBjb25zdCBjb25maWdQYXRoID0gbmdzd0NvbmZpZ1BhdGhcbiAgICA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBuZ3N3Q29uZmlnUGF0aClcbiAgICA6IHBhdGguam9pbihhcHBSb290LCAnbmdzdy1jb25maWcuanNvbicpO1xuXG4gIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZVxuICBsZXQgY29uZmlnOiBDb25maWcgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbkRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShjb25maWdQYXRoLCAndXRmLTgnKTtcbiAgICBjb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ3VyYXRpb25EYXRhKSBhcyBDb25maWc7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdFcnJvcjogRXhwZWN0ZWQgdG8gZmluZCBhbiBuZ3N3LWNvbmZpZy5qc29uIGNvbmZpZ3VyYXRpb24gZmlsZScgK1xuICAgICAgICAgIGAgaW4gdGhlICR7YXBwUm9vdH0gZm9sZGVyLiBFaXRoZXIgcHJvdmlkZSBvbmUgb3JgICtcbiAgICAgICAgICAnIGRpc2FibGUgU2VydmljZSBXb3JrZXIgaW4gdGhlIGFuZ3VsYXIuanNvbiBjb25maWd1cmF0aW9uIGZpbGUuJyxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWdgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IEdlbmVyYXRvckNvbnN0cnVjdG9yID0gKFxuICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJyk+KFxuICAgICAgJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZycsXG4gICAgKVxuICApLkdlbmVyYXRvcjtcblxuICAvLyBHZW5lcmF0ZSB0aGUgbWFuaWZlc3RcbiAgY29uc3QgZ2VuZXJhdG9yID0gbmV3IEdlbmVyYXRvckNvbnN0cnVjdG9yKG5ldyBDbGlGaWxlc3lzdGVtKG91dHB1dFBhdGgpLCBiYXNlSHJlZik7XG4gIGNvbnN0IG91dHB1dCA9IGF3YWl0IGdlbmVyYXRvci5wcm9jZXNzKGNvbmZpZyk7XG5cbiAgLy8gV3JpdGUgdGhlIG1hbmlmZXN0XG4gIGNvbnN0IG1hbmlmZXN0ID0gSlNPTi5zdHJpbmdpZnkob3V0cHV0LCBudWxsLCAyKTtcbiAgYXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihvdXRwdXRQYXRoLCAnbmdzdy5qc29uJyksIG1hbmlmZXN0KTtcblxuICAvLyBGaW5kIHRoZSBzZXJ2aWNlIHdvcmtlciBwYWNrYWdlXG4gIGNvbnN0IHdvcmtlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL25nc3ctd29ya2VyLmpzJyk7XG5cbiAgLy8gV3JpdGUgdGhlIHdvcmtlciBjb2RlXG4gIGF3YWl0IGZzLmNvcHlGaWxlKFxuICAgIHdvcmtlclBhdGgsXG4gICAgcGF0aC5qb2luKG91dHB1dFBhdGgsICduZ3N3LXdvcmtlci5qcycpLFxuICAgIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUsXG4gICk7XG5cbiAgLy8gSWYgcHJlc2VudCwgd3JpdGUgdGhlIHNhZmV0eSB3b3JrZXIgY29kZVxuICBjb25zdCBzYWZldHlQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZSh3b3JrZXJQYXRoKSwgJ3NhZmV0eS13b3JrZXIuanMnKTtcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5jb3B5RmlsZShcbiAgICAgIHNhZmV0eVBhdGgsXG4gICAgICBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ3dvcmtlci1iYXNpYy5taW4uanMnKSxcbiAgICAgIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUsXG4gICAgKTtcbiAgICBhd2FpdCBmcy5jb3B5RmlsZShcbiAgICAgIHNhZmV0eVBhdGgsXG4gICAgICBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ3NhZmV0eS13b3JrZXIuanMnKSxcbiAgICAgIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUsXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGVycm9yKTtcbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufVxuIl19