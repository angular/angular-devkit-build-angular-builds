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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2aWNlLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXNFO0FBRXRFLCtDQUFpQztBQUNqQywyQkFBZ0Y7QUFDaEYsMkNBQTZCO0FBQzdCLG1DQUFrQztBQUNsQyx5Q0FBMkM7QUFFM0MsTUFBTSxhQUFhO0lBQ2pCLFlBQW9CLElBQVk7UUFBWixTQUFJLEdBQUosSUFBSSxDQUFRO0lBQUcsQ0FBQztJQUVwQyxJQUFJLENBQUMsR0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCxJQUFJLENBQUMsSUFBWTtRQUNmLE9BQU8sYUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxJQUFJLENBQUMsSUFBWTtRQUNmLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDckMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUQsSUFBQSxpQkFBUSxFQUFDLElBQUEscUJBQWdCLEVBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQzlELEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxD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QUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzNCLE1BQU0sS0FBSyxDQUFDO1NBQ2I7S0FDRjtBQUNILENBQUM7QUEzRUQsa0VBMkVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIG5vcm1hbGl6ZSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgQ29uZmlnLCBGaWxlc3lzdGVtIH0gZnJvbSAnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJztcbmltcG9ydCAqIGFzIGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgY3JlYXRlUmVhZFN0cmVhbSwgcHJvbWlzZXMgYXMgZnMsIGNvbnN0YW50cyBhcyBmc0NvbnN0YW50cyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBwaXBlbGluZSB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi9sb2FkLWVzbSc7XG5cbmNsYXNzIENsaUZpbGVzeXN0ZW0gaW1wbGVtZW50cyBGaWxlc3lzdGVtIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiYXNlOiBzdHJpbmcpIHt9XG5cbiAgbGlzdChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICByZXR1cm4gdGhpcy5fcmVjdXJzaXZlTGlzdCh0aGlzLl9yZXNvbHZlKGRpciksIFtdKTtcbiAgfVxuXG4gIHJlYWQoZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gZnMucmVhZEZpbGUodGhpcy5fcmVzb2x2ZShmaWxlKSwgJ3V0Zi04Jyk7XG4gIH1cblxuICBoYXNoKGZpbGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMScpLnNldEVuY29kaW5nKCdoZXgnKTtcbiAgICAgIHBpcGVsaW5lKGNyZWF0ZVJlYWRTdHJlYW0odGhpcy5fcmVzb2x2ZShmaWxlKSksIGhhc2gsIChlcnJvcikgPT5cbiAgICAgICAgZXJyb3IgPyByZWplY3QoZXJyb3IpIDogcmVzb2x2ZShoYXNoLnJlYWQoKSksXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgd3JpdGUoZmlsZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gZnMud3JpdGVGaWxlKHRoaXMuX3Jlc29sdmUoZmlsZSksIGNvbnRlbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZShmaWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwYXRoLmpvaW4odGhpcy5iYXNlLCBmaWxlKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX3JlY3Vyc2l2ZUxpc3QoZGlyOiBzdHJpbmcsIGl0ZW1zOiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBzdWJkaXJlY3RvcmllcyA9IFtdO1xuICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgYXdhaXQgZnMub3BlbmRpcihkaXIpKSB7XG4gICAgICBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgLy8gVXNlcyBwb3NpeCBwYXRocyBzaW5jZSB0aGUgc2VydmljZSB3b3JrZXIgZXhwZWN0cyBVUkxzXG4gICAgICAgIGl0ZW1zLnB1c2goJy8nICsgcGF0aC5yZWxhdGl2ZSh0aGlzLmJhc2UsIHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpKS5yZXBsYWNlKC9cXFxcL2csICcvJykpO1xuICAgICAgfSBlbHNlIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIHN1YmRpcmVjdG9yaWVzLnB1c2gocGF0aC5qb2luKGRpciwgZW50cnkubmFtZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3ViZGlyZWN0b3J5IG9mIHN1YmRpcmVjdG9yaWVzKSB7XG4gICAgICBhd2FpdCB0aGlzLl9yZWN1cnNpdmVMaXN0KHN1YmRpcmVjdG9yeSwgaXRlbXMpO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVtcztcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICBhcHBSb290OiBQYXRoLFxuICBvdXRwdXRQYXRoOiBQYXRoLFxuICBiYXNlSHJlZjogc3RyaW5nLFxuICBuZ3N3Q29uZmlnUGF0aD86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBkaXN0UGF0aCA9IGdldFN5c3RlbVBhdGgobm9ybWFsaXplKG91dHB1dFBhdGgpKTtcblxuICAvLyBEZXRlcm1pbmUgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZSBwYXRoXG4gIGNvbnN0IGNvbmZpZ1BhdGggPSBuZ3N3Q29uZmlnUGF0aFxuICAgID8gZ2V0U3lzdGVtUGF0aChub3JtYWxpemUobmdzd0NvbmZpZ1BhdGgpKVxuICAgIDogcGF0aC5qb2luKGdldFN5c3RlbVBhdGgoYXBwUm9vdCksICduZ3N3LWNvbmZpZy5qc29uJyk7XG5cbiAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvbiBmaWxlXG4gIGxldCBjb25maWc6IENvbmZpZyB8IHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb25maWd1cmF0aW9uRGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGNvbmZpZ1BhdGgsICd1dGYtOCcpO1xuICAgIGNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlndXJhdGlvbkRhdGEpIGFzIENvbmZpZztcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0Vycm9yOiBFeHBlY3RlZCB0byBmaW5kIGFuIG5nc3ctY29uZmlnLmpzb24gY29uZmlndXJhdGlvbiBmaWxlJyArXG4gICAgICAgICAgYCBpbiB0aGUgJHtnZXRTeXN0ZW1QYXRoKGFwcFJvb3QpfSBmb2xkZXIuIEVpdGhlciBwcm92aWRlIG9uZSBvcmAgK1xuICAgICAgICAgICcgZGlzYWJsZSBTZXJ2aWNlIFdvcmtlciBpbiB0aGUgYW5ndWxhci5qc29uIGNvbmZpZ3VyYXRpb24gZmlsZS4nLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZ2AgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgY29uc3QgR2VuZXJhdG9yQ29uc3RydWN0b3IgPSAoXG4gICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWcnKT4oXG4gICAgICAnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJyxcbiAgICApXG4gICkuR2VuZXJhdG9yO1xuXG4gIC8vIEdlbmVyYXRlIHRoZSBtYW5pZmVzdFxuICBjb25zdCBnZW5lcmF0b3IgPSBuZXcgR2VuZXJhdG9yQ29uc3RydWN0b3IobmV3IENsaUZpbGVzeXN0ZW0oZGlzdFBhdGgpLCBiYXNlSHJlZik7XG4gIGNvbnN0IG91dHB1dCA9IGF3YWl0IGdlbmVyYXRvci5wcm9jZXNzKGNvbmZpZyk7XG5cbiAgLy8gV3JpdGUgdGhlIG1hbmlmZXN0XG4gIGNvbnN0IG1hbmlmZXN0ID0gSlNPTi5zdHJpbmdpZnkob3V0cHV0LCBudWxsLCAyKTtcbiAgYXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihkaXN0UGF0aCwgJ25nc3cuanNvbicpLCBtYW5pZmVzdCk7XG5cbiAgLy8gRmluZCB0aGUgc2VydmljZSB3b3JrZXIgcGFja2FnZVxuICBjb25zdCB3b3JrZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9uZ3N3LXdvcmtlci5qcycpO1xuXG4gIC8vIFdyaXRlIHRoZSB3b3JrZXIgY29kZVxuICBhd2FpdCBmcy5jb3B5RmlsZShcbiAgICB3b3JrZXJQYXRoLFxuICAgIHBhdGguam9pbihkaXN0UGF0aCwgJ25nc3ctd29ya2VyLmpzJyksXG4gICAgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSxcbiAgKTtcblxuICAvLyBJZiBwcmVzZW50LCB3cml0ZSB0aGUgc2FmZXR5IHdvcmtlciBjb2RlXG4gIGNvbnN0IHNhZmV0eVBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKHdvcmtlclBhdGgpLCAnc2FmZXR5LXdvcmtlci5qcycpO1xuICB0cnkge1xuICAgIGF3YWl0IGZzLmNvcHlGaWxlKFxuICAgICAgc2FmZXR5UGF0aCxcbiAgICAgIHBhdGguam9pbihkaXN0UGF0aCwgJ3dvcmtlci1iYXNpYy5taW4uanMnKSxcbiAgICAgIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUsXG4gICAgKTtcbiAgICBhd2FpdCBmcy5jb3B5RmlsZShcbiAgICAgIHNhZmV0eVBhdGgsXG4gICAgICBwYXRoLmpvaW4oZGlzdFBhdGgsICdzYWZldHktd29ya2VyLmpzJyksXG4gICAgICBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FLFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cbiJdfQ==