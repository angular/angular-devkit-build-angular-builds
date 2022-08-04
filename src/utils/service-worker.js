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
const error_1 = require("./error");
const load_esm_1 = require("./load-esm");
class CliFilesystem {
    constructor(fs, base) {
        this.fs = fs;
        this.base = base;
    }
    list(dir) {
        return this._recursiveList(this._resolve(dir), []);
    }
    read(file) {
        return this.fs.readFile(this._resolve(file), 'utf-8');
    }
    async hash(file) {
        return crypto
            .createHash('sha1')
            .update(await this.fs.readFile(this._resolve(file)))
            .digest('hex');
    }
    write(_file, _content) {
        throw new Error('This should never happen.');
    }
    _resolve(file) {
        return path.join(this.base, file);
    }
    async _recursiveList(dir, items) {
        const subdirectories = [];
        for (const entry of await this.fs.readdir(dir)) {
            const entryPath = path.join(dir, entry);
            const stats = await this.fs.stat(entryPath);
            if (stats.isFile()) {
                // Uses posix paths since the service worker expects URLs
                items.push('/' + path.relative(this.base, entryPath).replace(/\\/g, '/'));
            }
            else if (stats.isDirectory()) {
                subdirectories.push(entryPath);
            }
        }
        for (const subdirectory of subdirectories) {
            await this._recursiveList(subdirectory, items);
        }
        return items;
    }
}
async function augmentAppWithServiceWorker(appRoot, workspaceRoot, outputPath, baseHref, ngswConfigPath, inputputFileSystem = fs_1.promises, outputFileSystem = fs_1.promises) {
    // Determine the configuration file path
    const configPath = ngswConfigPath
        ? path.join(workspaceRoot, ngswConfigPath)
        : path.join(appRoot, 'ngsw-config.json');
    // Read the configuration file
    let config;
    try {
        const configurationData = await inputputFileSystem.readFile(configPath, 'utf-8');
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
    const generator = new GeneratorConstructor(new CliFilesystem(outputFileSystem, outputPath), baseHref);
    const output = await generator.process(config);
    // Write the manifest
    const manifest = JSON.stringify(output, null, 2);
    await outputFileSystem.writeFile(path.join(outputPath, 'ngsw.json'), manifest);
    // Find the service worker package
    const workerPath = require.resolve('@angular/service-worker/ngsw-worker.js');
    const copy = async (src, dest) => {
        const resolvedDest = path.join(outputPath, dest);
        return inputputFileSystem === outputFileSystem
            ? // Native FS (Builder).
                inputputFileSystem.copyFile(workerPath, resolvedDest, fs_1.constants.COPYFILE_FICLONE)
            : // memfs (Webpack): Read the file from the input FS (disk) and write it to the output FS (memory).
                outputFileSystem.writeFile(resolvedDest, await inputputFileSystem.readFile(src));
    };
    // Write the worker code
    await copy(workerPath, 'ngsw-worker.js');
    // If present, write the safety worker code
    try {
        const safetyPath = path.join(path.dirname(workerPath), 'safety-worker.js');
        await copy(safetyPath, 'worker-basic.min.js');
        await copy(safetyPath, 'safety-worker.js');
    }
    catch (error) {
        (0, error_1.assertIsError)(error);
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}
exports.augmentAppWithServiceWorker = augmentAppWithServiceWorker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2aWNlLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUFpQztBQUNqQywyQkFBc0U7QUFDdEUsMkNBQTZCO0FBQzdCLG1DQUF3QztBQUN4Qyx5Q0FBMkM7QUFFM0MsTUFBTSxhQUFhO0lBQ2pCLFlBQW9CLEVBQXFCLEVBQVUsSUFBWTtRQUEzQyxPQUFFLEdBQUYsRUFBRSxDQUFtQjtRQUFVLFNBQUksR0FBSixJQUFJLENBQVE7SUFBRyxDQUFDO0lBRW5FLElBQUksQ0FBQyxHQUFXO1FBQ2QsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFZO1FBQ2YsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQVk7UUFDckIsT0FBTyxNQUFNO2FBQ1YsVUFBVSxDQUFDLE1BQU0sQ0FBQzthQUNsQixNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDbkQsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25CLENBQUM7SUFFRCxLQUFLLENBQUMsS0FBYSxFQUFFLFFBQWdCO1FBQ25DLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUMs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RTtRQUNkLElBQUEscUJBQWEsRUFBQyxLQUFLLENBQUMsQ0FBQztRQUNyQixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzNCLE1BQU0sS0FBSyxDQUFDO1NBQ2I7S0FDRjtBQUNILENBQUM7QUEvRUQsa0VBK0VDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29uZmlnLCBGaWxlc3lzdGVtIH0gZnJvbSAnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJztcbmltcG9ydCAqIGFzIGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzLCBwcm9taXNlcyBhcyBmc1Byb21pc2VzIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuL2xvYWQtZXNtJztcblxuY2xhc3MgQ2xpRmlsZXN5c3RlbSBpbXBsZW1lbnRzIEZpbGVzeXN0ZW0ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGZzOiB0eXBlb2YgZnNQcm9taXNlcywgcHJpdmF0ZSBiYXNlOiBzdHJpbmcpIHt9XG5cbiAgbGlzdChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICByZXR1cm4gdGhpcy5fcmVjdXJzaXZlTGlzdCh0aGlzLl9yZXNvbHZlKGRpciksIFtdKTtcbiAgfVxuXG4gIHJlYWQoZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy5mcy5yZWFkRmlsZSh0aGlzLl9yZXNvbHZlKGZpbGUpLCAndXRmLTgnKTtcbiAgfVxuXG4gIGFzeW5jIGhhc2goZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gY3J5cHRvXG4gICAgICAuY3JlYXRlSGFzaCgnc2hhMScpXG4gICAgICAudXBkYXRlKGF3YWl0IHRoaXMuZnMucmVhZEZpbGUodGhpcy5fcmVzb2x2ZShmaWxlKSkpXG4gICAgICAuZGlnZXN0KCdoZXgnKTtcbiAgfVxuXG4gIHdyaXRlKF9maWxlOiBzdHJpbmcsIF9jb250ZW50OiBzdHJpbmcpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uJyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXNvbHZlKGZpbGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLmJhc2UsIGZpbGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfcmVjdXJzaXZlTGlzdChkaXI6IHN0cmluZywgaXRlbXM6IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHN1YmRpcmVjdG9yaWVzID0gW107XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBhd2FpdCB0aGlzLmZzLnJlYWRkaXIoZGlyKSkge1xuICAgICAgY29uc3QgZW50cnlQYXRoID0gcGF0aC5qb2luKGRpciwgZW50cnkpO1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmZzLnN0YXQoZW50cnlQYXRoKTtcblxuICAgICAgaWYgKHN0YXRzLmlzRmlsZSgpKSB7XG4gICAgICAgIC8vIFVzZXMgcG9zaXggcGF0aHMgc2luY2UgdGhlIHNlcnZpY2Ugd29ya2VyIGV4cGVjdHMgVVJMc1xuICAgICAgICBpdGVtcy5wdXNoKCcvJyArIHBhdGgucmVsYXRpdmUodGhpcy5iYXNlLCBlbnRyeVBhdGgpLnJlcGxhY2UoL1xcXFwvZywgJy8nKSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgc3ViZGlyZWN0b3JpZXMucHVzaChlbnRyeVBhdGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3ViZGlyZWN0b3J5IG9mIHN1YmRpcmVjdG9yaWVzKSB7XG4gICAgICBhd2FpdCB0aGlzLl9yZWN1cnNpdmVMaXN0KHN1YmRpcmVjdG9yeSwgaXRlbXMpO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVtcztcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICBhcHBSb290OiBzdHJpbmcsXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgb3V0cHV0UGF0aDogc3RyaW5nLFxuICBiYXNlSHJlZjogc3RyaW5nLFxuICBuZ3N3Q29uZmlnUGF0aD86IHN0cmluZyxcbiAgaW5wdXRwdXRGaWxlU3lzdGVtID0gZnNQcm9taXNlcyxcbiAgb3V0cHV0RmlsZVN5c3RlbSA9IGZzUHJvbWlzZXMsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgcGF0aFxuICBjb25zdCBjb25maWdQYXRoID0gbmdzd0NvbmZpZ1BhdGhcbiAgICA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBuZ3N3Q29uZmlnUGF0aClcbiAgICA6IHBhdGguam9pbihhcHBSb290LCAnbmdzdy1jb25maWcuanNvbicpO1xuXG4gIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZVxuICBsZXQgY29uZmlnOiBDb25maWcgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbkRhdGEgPSBhd2FpdCBpbnB1dHB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoY29uZmlnUGF0aCwgJ3V0Zi04Jyk7XG4gICAgY29uZmlnID0gSlNPTi5wYXJzZShjb25maWd1cmF0aW9uRGF0YSkgYXMgQ29uZmlnO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuICAgIGlmIChlcnJvci5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnRXJyb3I6IEV4cGVjdGVkIHRvIGZpbmQgYW4gbmdzdy1jb25maWcuanNvbiBjb25maWd1cmF0aW9uIGZpbGUnICtcbiAgICAgICAgICBgIGluIHRoZSAke2FwcFJvb3R9IGZvbGRlci4gRWl0aGVyIHByb3ZpZGUgb25lIG9yYCArXG4gICAgICAgICAgJyBkaXNhYmxlIFNlcnZpY2UgV29ya2VyIGluIHRoZSBhbmd1bGFyLmpzb24gY29uZmlndXJhdGlvbiBmaWxlLicsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICBjb25zdCBHZW5lcmF0b3JDb25zdHJ1Y3RvciA9IChcbiAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZycpPihcbiAgICAgICdAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWcnLFxuICAgIClcbiAgKS5HZW5lcmF0b3I7XG5cbiAgLy8gR2VuZXJhdGUgdGhlIG1hbmlmZXN0XG4gIGNvbnN0IGdlbmVyYXRvciA9IG5ldyBHZW5lcmF0b3JDb25zdHJ1Y3RvcihcbiAgICBuZXcgQ2xpRmlsZXN5c3RlbShvdXRwdXRGaWxlU3lzdGVtLCBvdXRwdXRQYXRoKSxcbiAgICBiYXNlSHJlZixcbiAgKTtcbiAgY29uc3Qgb3V0cHV0ID0gYXdhaXQgZ2VuZXJhdG9yLnByb2Nlc3MoY29uZmlnKTtcblxuICAvLyBXcml0ZSB0aGUgbWFuaWZlc3RcbiAgY29uc3QgbWFuaWZlc3QgPSBKU09OLnN0cmluZ2lmeShvdXRwdXQsIG51bGwsIDIpO1xuICBhd2FpdCBvdXRwdXRGaWxlU3lzdGVtLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ25nc3cuanNvbicpLCBtYW5pZmVzdCk7XG5cbiAgLy8gRmluZCB0aGUgc2VydmljZSB3b3JrZXIgcGFja2FnZVxuICBjb25zdCB3b3JrZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9uZ3N3LXdvcmtlci5qcycpO1xuXG4gIGNvbnN0IGNvcHkgPSBhc3luYyAoc3JjOiBzdHJpbmcsIGRlc3Q6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgIGNvbnN0IHJlc29sdmVkRGVzdCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBkZXN0KTtcblxuICAgIHJldHVybiBpbnB1dHB1dEZpbGVTeXN0ZW0gPT09IG91dHB1dEZpbGVTeXN0ZW1cbiAgICAgID8gLy8gTmF0aXZlIEZTIChCdWlsZGVyKS5cbiAgICAgICAgaW5wdXRwdXRGaWxlU3lzdGVtLmNvcHlGaWxlKHdvcmtlclBhdGgsIHJlc29sdmVkRGVzdCwgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSlcbiAgICAgIDogLy8gbWVtZnMgKFdlYnBhY2spOiBSZWFkIHRoZSBmaWxlIGZyb20gdGhlIGlucHV0IEZTIChkaXNrKSBhbmQgd3JpdGUgaXQgdG8gdGhlIG91dHB1dCBGUyAobWVtb3J5KS5cbiAgICAgICAgb3V0cHV0RmlsZVN5c3RlbS53cml0ZUZpbGUocmVzb2x2ZWREZXN0LCBhd2FpdCBpbnB1dHB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoc3JjKSk7XG4gIH07XG5cbiAgLy8gV3JpdGUgdGhlIHdvcmtlciBjb2RlXG4gIGF3YWl0IGNvcHkod29ya2VyUGF0aCwgJ25nc3ctd29ya2VyLmpzJyk7XG5cbiAgLy8gSWYgcHJlc2VudCwgd3JpdGUgdGhlIHNhZmV0eSB3b3JrZXIgY29kZVxuICB0cnkge1xuICAgIGNvbnN0IHNhZmV0eVBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKHdvcmtlclBhdGgpLCAnc2FmZXR5LXdvcmtlci5qcycpO1xuICAgIGF3YWl0IGNvcHkoc2FmZXR5UGF0aCwgJ3dvcmtlci1iYXNpYy5taW4uanMnKTtcbiAgICBhd2FpdCBjb3B5KHNhZmV0eVBhdGgsICdzYWZldHktd29ya2VyLmpzJyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG4gICAgaWYgKGVycm9yLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cbiJdfQ==