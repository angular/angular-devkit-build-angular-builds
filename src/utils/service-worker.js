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
async function augmentAppWithServiceWorker(appRoot, workspaceRoot, outputPath, baseHref, ngswConfigPath) {
    const distPath = (0, core_1.getSystemPath)((0, core_1.normalize)(outputPath));
    // Determine the configuration file path
    const configPath = ngswConfigPath
        ? path.join(workspaceRoot, (0, core_1.getSystemPath)((0, core_1.normalize)(ngswConfigPath)))
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2aWNlLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILCtDQUFzRTtBQUV0RSwrQ0FBaUM7QUFDakMsMkJBQWdGO0FBQ2hGLDJDQUE2QjtBQUM3QixtQ0FBa0M7QUFDbEMseUNBQTJDO0FBRTNDLE1BQU0sYUFBYTtJQUNqQixZQUFvQixJQUFZO1FBQVosU0FBSSxHQUFKLElBQUksQ0FBUTtJQUFHLENBQUM7SUFFcEMsSUFBSSxDQUFDLEdBQVc7UUFDZCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixPQUFPLGFBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDZixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzFELElBQUEsaUJBQVEsRUFBQyxJQUFBLHFCQUFnQixFQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUM5RCxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENB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QyxnQkFBZ0IsQ0FDN0IsQ0FBQztLQUNIO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzNCLE1BQU0sS0FBSyxDQUFDO1NBQ2I7S0FDRjtBQUNILENBQUM7QUE1RUQsa0VBNEVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIG5vcm1hbGl6ZSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgQ29uZmlnLCBGaWxlc3lzdGVtIH0gZnJvbSAnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJztcbmltcG9ydCAqIGFzIGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgY3JlYXRlUmVhZFN0cmVhbSwgcHJvbWlzZXMgYXMgZnMsIGNvbnN0YW50cyBhcyBmc0NvbnN0YW50cyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBwaXBlbGluZSB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi9sb2FkLWVzbSc7XG5cbmNsYXNzIENsaUZpbGVzeXN0ZW0gaW1wbGVtZW50cyBGaWxlc3lzdGVtIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlOiBzdHJpbmcpIHt9XG5cbiAgbGlzdChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICByZXR1cm4gdGhpcy5fcmVjdXJzaXZlTGlzdCh0aGlzLl9yZXNvbHZlKGRpciksIFtdKTtcbiAgfVxuXG4gIHJlYWQoZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gZnMucmVhZEZpbGUodGhpcy5fcmVzb2x2ZShmaWxlKSwgJ3V0Zi04Jyk7XG4gIH1cblxuICBoYXNoKGZpbGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMScpLnNldEVuY29kaW5nKCdoZXgnKTtcbiAgICAgIHBpcGVsaW5lKGNyZWF0ZVJlYWRTdHJlYW0odGhpcy5fcmVzb2x2ZShmaWxlKSksIGhhc2gsIChlcnJvcikgPT5cbiAgICAgICAgZXJyb3IgPyByZWplY3QoZXJyb3IpIDogcmVzb2x2ZShoYXNoLnJlYWQoKSksXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgd3JpdGUoZmlsZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gZnMud3JpdGVGaWxlKHRoaXMuX3Jlc29sdmUoZmlsZSksIGNvbnRlbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZShmaWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwYXRoLmpvaW4odGhpcy5iYXNlLCBmaWxlKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX3JlY3Vyc2l2ZUxpc3QoZGlyOiBzdHJpbmcsIGl0ZW1zOiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBzdWJkaXJlY3RvcmllcyA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgYXdhaXQgZnMub3BlbmRpcihkaXIpKSB7XG4gICAgICBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgLy8gVXNlcyBwb3NpeCBwYXRocyBzaW5jZSB0aGUgc2VydmljZSB3b3JrZXIgZXhwZWN0cyBVUkxzXG4gICAgICAgIGl0ZW1zLnB1c2goJy8nICsgcGF0aC5yZWxhdGl2ZSh0aGlzLmJhc2UsIHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpKS5yZXBsYWNlKC9cXFxcL2csICcvJykpO1xuICAgICAgfSBlbHNlIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIHN1YmRpcmVjdG9yaWVzLnB1c2gocGF0aC5qb2luKGRpciwgZW50cnkubmFtZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3ViZGlyZWN0b3J5IG9mIHN1YmRpcmVjdG9yaWVzKSB7XG4gICAgICBhd2FpdCB0aGlzLl9yZWN1cnNpdmVMaXN0KHN1YmRpcmVjdG9yeSwgaXRlbXMpO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVtcztcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICBhcHBSb290OiBQYXRoLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG91dHB1dFBhdGg6IFBhdGgsXG4gIGJhc2VIcmVmOiBzdHJpbmcsXG4gIG5nc3dDb25maWdQYXRoPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGRpc3RQYXRoID0gZ2V0U3lzdGVtUGF0aChub3JtYWxpemUob3V0cHV0UGF0aCkpO1xuXG4gIC8vIERldGVybWluZSB0aGUgY29uZmlndXJhdGlvbiBmaWxlIHBhdGhcbiAgY29uc3QgY29uZmlnUGF0aCA9IG5nc3dDb25maWdQYXRoXG4gICAgPyBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZ2V0U3lzdGVtUGF0aChub3JtYWxpemUobmdzd0NvbmZpZ1BhdGgpKSlcbiAgICA6IHBhdGguam9pbihnZXRTeXN0ZW1QYXRoKGFwcFJvb3QpLCAnbmdzdy1jb25maWcuanNvbicpO1xuXG4gIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZVxuICBsZXQgY29uZmlnOiBDb25maWcgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbkRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShjb25maWdQYXRoLCAndXRmLTgnKTtcbiAgICBjb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ3VyYXRpb25EYXRhKSBhcyBDb25maWc7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdFcnJvcjogRXhwZWN0ZWQgdG8gZmluZCBhbiBuZ3N3LWNvbmZpZy5qc29uIGNvbmZpZ3VyYXRpb24gZmlsZScgK1xuICAgICAgICAgIGAgaW4gdGhlICR7Z2V0U3lzdGVtUGF0aChhcHBSb290KX0gZm9sZGVyLiBFaXRoZXIgcHJvdmlkZSBvbmUgb3JgICtcbiAgICAgICAgICAnIGRpc2FibGUgU2VydmljZSBXb3JrZXIgaW4gdGhlIGFuZ3VsYXIuanNvbiBjb25maWd1cmF0aW9uIGZpbGUuJyxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWdgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IEdlbmVyYXRvckNvbnN0cnVjdG9yID0gKFxuICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJyk+KFxuICAgICAgJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZycsXG4gICAgKVxuICApLkdlbmVyYXRvcjtcblxuICAvLyBHZW5lcmF0ZSB0aGUgbWFuaWZlc3RcbiAgY29uc3QgZ2VuZXJhdG9yID0gbmV3IEdlbmVyYXRvckNvbnN0cnVjdG9yKG5ldyBDbGlGaWxlc3lzdGVtKGRpc3RQYXRoKSwgYmFzZUhyZWYpO1xuICBjb25zdCBvdXRwdXQgPSBhd2FpdCBnZW5lcmF0b3IucHJvY2Vzcyhjb25maWcpO1xuXG4gIC8vIFdyaXRlIHRoZSBtYW5pZmVzdFxuICBjb25zdCBtYW5pZmVzdCA9IEpTT04uc3RyaW5naWZ5KG91dHB1dCwgbnVsbCwgMik7XG4gIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4oZGlzdFBhdGgsICduZ3N3Lmpzb24nKSwgbWFuaWZlc3QpO1xuXG4gIC8vIEZpbmQgdGhlIHNlcnZpY2Ugd29ya2VyIHBhY2thZ2VcbiAgY29uc3Qgd29ya2VyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvbmdzdy13b3JrZXIuanMnKTtcblxuICAvLyBXcml0ZSB0aGUgd29ya2VyIGNvZGVcbiAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgd29ya2VyUGF0aCxcbiAgICBwYXRoLmpvaW4oZGlzdFBhdGgsICduZ3N3LXdvcmtlci5qcycpLFxuICAgIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUsXG4gICk7XG5cbiAgLy8gSWYgcHJlc2VudCwgd3JpdGUgdGhlIHNhZmV0eSB3b3JrZXIgY29kZVxuICBjb25zdCBzYWZldHlQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZSh3b3JrZXJQYXRoKSwgJ3NhZmV0eS13b3JrZXIuanMnKTtcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5jb3B5RmlsZShcbiAgICAgIHNhZmV0eVBhdGgsXG4gICAgICBwYXRoLmpvaW4oZGlzdFBhdGgsICd3b3JrZXItYmFzaWMubWluLmpzJyksXG4gICAgICBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FLFxuICAgICk7XG4gICAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgICBzYWZldHlQYXRoLFxuICAgICAgcGF0aC5qb2luKGRpc3RQYXRoLCAnc2FmZXR5LXdvcmtlci5qcycpLFxuICAgICAgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG59XG4iXX0=