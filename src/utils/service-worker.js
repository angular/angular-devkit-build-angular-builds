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
exports.augmentAppWithServiceWorkerCore = exports.augmentAppWithServiceWorkerEsbuild = exports.augmentAppWithServiceWorker = void 0;
const crypto = __importStar(require("crypto"));
const node_fs_1 = require("node:fs");
const path = __importStar(require("path"));
const bundler_context_1 = require("../tools/esbuild/bundler-context");
const error_1 = require("./error");
const load_esm_1 = require("./load-esm");
class CliFilesystem {
    fs;
    base;
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
class ResultFilesystem {
    fileReaders = new Map();
    constructor(outputFiles, assetFiles) {
        for (const file of outputFiles) {
            if (file.type === bundler_context_1.BuildOutputFileType.Media || file.type === bundler_context_1.BuildOutputFileType.Browser) {
                this.fileReaders.set('/' + file.path.replace(/\\/g, '/'), async () => file.contents);
            }
        }
        for (const file of assetFiles) {
            this.fileReaders.set('/' + file.destination.replace(/\\/g, '/'), () => node_fs_1.promises.readFile(file.source));
        }
    }
    async list(dir) {
        if (dir !== '/') {
            throw new Error('Serviceworker manifest generator should only list files from root.');
        }
        return [...this.fileReaders.keys()];
    }
    async read(file) {
        const reader = this.fileReaders.get(file);
        if (reader === undefined) {
            throw new Error('File does not exist.');
        }
        const contents = await reader();
        return Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength).toString('utf-8');
    }
    async hash(file) {
        const reader = this.fileReaders.get(file);
        if (reader === undefined) {
            throw new Error('File does not exist.');
        }
        return crypto
            .createHash('sha1')
            .update(await reader())
            .digest('hex');
    }
    write() {
        throw new Error('Serviceworker manifest generator should not attempted to write.');
    }
}
async function augmentAppWithServiceWorker(appRoot, workspaceRoot, outputPath, baseHref, ngswConfigPath, inputputFileSystem = node_fs_1.promises, outputFileSystem = node_fs_1.promises) {
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
    const result = await augmentAppWithServiceWorkerCore(config, new CliFilesystem(outputFileSystem, outputPath), baseHref);
    const copy = async (src, dest) => {
        const resolvedDest = path.join(outputPath, dest);
        return inputputFileSystem === outputFileSystem
            ? // Native FS (Builder).
                inputputFileSystem.copyFile(src, resolvedDest, node_fs_1.constants.COPYFILE_FICLONE)
            : // memfs (Webpack): Read the file from the input FS (disk) and write it to the output FS (memory).
                outputFileSystem.writeFile(resolvedDest, await inputputFileSystem.readFile(src));
    };
    await outputFileSystem.writeFile(path.join(outputPath, 'ngsw.json'), result.manifest);
    for (const { source, destination } of result.assetFiles) {
        await copy(source, destination);
    }
}
exports.augmentAppWithServiceWorker = augmentAppWithServiceWorker;
// This is currently used by the esbuild-based builder
async function augmentAppWithServiceWorkerEsbuild(workspaceRoot, configPath, baseHref, outputFiles, assetFiles) {
    // Read the configuration file
    let config;
    try {
        const configurationData = await node_fs_1.promises.readFile(configPath, 'utf-8');
        config = JSON.parse(configurationData);
    }
    catch (error) {
        (0, error_1.assertIsError)(error);
        if (error.code === 'ENOENT') {
            // TODO: Generate an error object that can be consumed by the esbuild-based builder
            const message = `Service worker configuration file "${path.relative(workspaceRoot, configPath)}" could not be found.`;
            throw new Error(message);
        }
        else {
            throw error;
        }
    }
    return augmentAppWithServiceWorkerCore(config, new ResultFilesystem(outputFiles, assetFiles), baseHref);
}
exports.augmentAppWithServiceWorkerEsbuild = augmentAppWithServiceWorkerEsbuild;
async function augmentAppWithServiceWorkerCore(config, serviceWorkerFilesystem, baseHref) {
    // Load ESM `@angular/service-worker/config` using the TypeScript dynamic import workaround.
    // Once TypeScript provides support for keeping the dynamic import this workaround can be
    // changed to a direct dynamic import.
    const GeneratorConstructor = (await (0, load_esm_1.loadEsmModule)('@angular/service-worker/config')).Generator;
    // Generate the manifest
    const generator = new GeneratorConstructor(serviceWorkerFilesystem, baseHref);
    const output = await generator.process(config);
    // Write the manifest
    const manifest = JSON.stringify(output, null, 2);
    // Find the service worker package
    const workerPath = require.resolve('@angular/service-worker/ngsw-worker.js');
    const result = {
        manifest,
        // Main worker code
        assetFiles: [{ source: workerPath, destination: 'ngsw-worker.js' }],
    };
    // If present, write the safety worker code
    const safetyPath = path.join(path.dirname(workerPath), 'safety-worker.js');
    if ((0, node_fs_1.existsSync)(safetyPath)) {
        result.assetFiles.push({ source: safetyPath, destination: 'worker-basic.min.js' });
        result.assetFiles.push({ source: safetyPath, destination: 'safety-worker.js' });
    }
    return result;
}
exports.augmentAppWithServiceWorkerCore = augmentAppWithServiceWorkerCore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2aWNlLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUFpQztBQUNqQyxxQ0FBdUY7QUFDdkYsMkNBQTZCO0FBQzdCLHNFQUF3RjtBQUV4RixtQ0FBd0M7QUFDeEMseUNBQTJDO0FBRTNDLE1BQU0sYUFBYTtJQUVQO0lBQ0E7SUFGVixZQUNVLEVBQXFCLEVBQ3JCLElBQVk7UUFEWixPQUFFLEdBQUYsRUFBRSxDQUFtQjtRQUNyQixTQUFJLEdBQUosSUFBSSxDQUFRO0lBQ25CLENBQUM7SUFFSixJQUFJLENBQUMsR0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCxJQUFJLENBQUMsSUFBWTtRQUNmLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFZO1FBQ3JCLE9BQU8sTUFBTTthQUNWLFVBQVUsQ0FBQyxNQUFNLENBQUM7YUFDbEIsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2FBQ25ELE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuQixDQUFDO0lBRUQsS0FBSyxDQUFDLEtBQWEsRUFBRSxRQUFnQjtRQUNuQyxNQUFNLElBQUks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KiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb25maWcsIEZpbGVzeXN0ZW0gfSBmcm9tICdAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWcnO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCBjb25zdGFudHMgYXMgZnNDb25zdGFudHMsIHByb21pc2VzIGFzIGZzUHJvbWlzZXMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEFzc2V0IH0gZnJvbSAnLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG5jbGFzcyBDbGlGaWxlc3lzdGVtIGltcGxlbWVudHMgRmlsZXN5c3RlbSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgZnM6IHR5cGVvZiBmc1Byb21pc2VzLFxuICAgIHByaXZhdGUgYmFzZTogc3RyaW5nLFxuICApIHt9XG5cbiAgbGlzdChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICByZXR1cm4gdGhpcy5fcmVjdXJzaXZlTGlzdCh0aGlzLl9yZXNvbHZlKGRpciksIFtdKTtcbiAgfVxuXG4gIHJlYWQoZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gdGhpcy5mcy5yZWFkRmlsZSh0aGlzLl9yZXNvbHZlKGZpbGUpLCAndXRmLTgnKTtcbiAgfVxuXG4gIGFzeW5jIGhhc2goZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gY3J5cHRvXG4gICAgICAuY3JlYXRlSGFzaCgnc2hhMScpXG4gICAgICAudXBkYXRlKGF3YWl0IHRoaXMuZnMucmVhZEZpbGUodGhpcy5fcmVzb2x2ZShmaWxlKSkpXG4gICAgICAuZGlnZXN0KCdoZXgnKTtcbiAgfVxuXG4gIHdyaXRlKF9maWxlOiBzdHJpbmcsIF9jb250ZW50OiBzdHJpbmcpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uJyk7XG4gIH1cblxuICBwcml2YXRlIF9yZXNvbHZlKGZpbGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLmJhc2UsIGZpbGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfcmVjdXJzaXZlTGlzdChkaXI6IHN0cmluZywgaXRlbXM6IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHN1YmRpcmVjdG9yaWVzID0gW107XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBhd2FpdCB0aGlzLmZzLnJlYWRkaXIoZGlyKSkge1xuICAgICAgY29uc3QgZW50cnlQYXRoID0gcGF0aC5qb2luKGRpciwgZW50cnkpO1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmZzLnN0YXQoZW50cnlQYXRoKTtcblxuICAgICAgaWYgKHN0YXRzLmlzRmlsZSgpKSB7XG4gICAgICAgIC8vIFVzZXMgcG9zaXggcGF0aHMgc2luY2UgdGhlIHNlcnZpY2Ugd29ya2VyIGV4cGVjdHMgVVJMc1xuICAgICAgICBpdGVtcy5wdXNoKCcvJyArIHBhdGgucmVsYXRpdmUodGhpcy5iYXNlLCBlbnRyeVBhdGgpLnJlcGxhY2UoL1xcXFwvZywgJy8nKSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgc3ViZGlyZWN0b3JpZXMucHVzaChlbnRyeVBhdGgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3ViZGlyZWN0b3J5IG9mIHN1YmRpcmVjdG9yaWVzKSB7XG4gICAgICBhd2FpdCB0aGlzLl9yZWN1cnNpdmVMaXN0KHN1YmRpcmVjdG9yeSwgaXRlbXMpO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVtcztcbiAgfVxufVxuXG5jbGFzcyBSZXN1bHRGaWxlc3lzdGVtIGltcGxlbWVudHMgRmlsZXN5c3RlbSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgZmlsZVJlYWRlcnMgPSBuZXcgTWFwPHN0cmluZywgKCkgPT4gUHJvbWlzZTxVaW50OEFycmF5Pj4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBvdXRwdXRGaWxlczogQnVpbGRPdXRwdXRGaWxlW10sXG4gICAgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10sXG4gICkge1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBvdXRwdXRGaWxlcykge1xuICAgICAgaWYgKGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSB8fCBmaWxlLnR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3Nlcikge1xuICAgICAgICB0aGlzLmZpbGVSZWFkZXJzLnNldCgnLycgKyBmaWxlLnBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpLCBhc3luYyAoKSA9PiBmaWxlLmNvbnRlbnRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGFzc2V0RmlsZXMpIHtcbiAgICAgIHRoaXMuZmlsZVJlYWRlcnMuc2V0KCcvJyArIGZpbGUuZGVzdGluYXRpb24ucmVwbGFjZSgvXFxcXC9nLCAnLycpLCAoKSA9PlxuICAgICAgICBmc1Byb21pc2VzLnJlYWRGaWxlKGZpbGUuc291cmNlKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbGlzdChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBpZiAoZGlyICE9PSAnLycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU2VydmljZXdvcmtlciBtYW5pZmVzdCBnZW5lcmF0b3Igc2hvdWxkIG9ubHkgbGlzdCBmaWxlcyBmcm9tIHJvb3QuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFsuLi50aGlzLmZpbGVSZWFkZXJzLmtleXMoKV07XG4gIH1cblxuICBhc3luYyByZWFkKGZpbGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVhZGVyID0gdGhpcy5maWxlUmVhZGVycy5nZXQoZmlsZSk7XG4gICAgaWYgKHJlYWRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpbGUgZG9lcyBub3QgZXhpc3QuJyk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgcmVhZGVyKCk7XG5cbiAgICByZXR1cm4gQnVmZmVyLmZyb20oY29udGVudHMuYnVmZmVyLCBjb250ZW50cy5ieXRlT2Zmc2V0LCBjb250ZW50cy5ieXRlTGVuZ3RoKS50b1N0cmluZygndXRmLTgnKTtcbiAgfVxuXG4gIGFzeW5jIGhhc2goZmlsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZWFkZXIgPSB0aGlzLmZpbGVSZWFkZXJzLmdldChmaWxlKTtcbiAgICBpZiAocmVhZGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmlsZSBkb2VzIG5vdCBleGlzdC4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3J5cHRvXG4gICAgICAuY3JlYXRlSGFzaCgnc2hhMScpXG4gICAgICAudXBkYXRlKGF3YWl0IHJlYWRlcigpKVxuICAgICAgLmRpZ2VzdCgnaGV4Jyk7XG4gIH1cblxuICB3cml0ZSgpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2aWNld29ya2VyIG1hbmlmZXN0IGdlbmVyYXRvciBzaG91bGQgbm90IGF0dGVtcHRlZCB0byB3cml0ZS4nKTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICBhcHBSb290OiBzdHJpbmcsXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgb3V0cHV0UGF0aDogc3RyaW5nLFxuICBiYXNlSHJlZjogc3RyaW5nLFxuICBuZ3N3Q29uZmlnUGF0aD86IHN0cmluZyxcbiAgaW5wdXRwdXRGaWxlU3lzdGVtID0gZnNQcm9taXNlcyxcbiAgb3V0cHV0RmlsZVN5c3RlbSA9IGZzUHJvbWlzZXMsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgcGF0aFxuICBjb25zdCBjb25maWdQYXRoID0gbmdzd0NvbmZpZ1BhdGhcbiAgICA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBuZ3N3Q29uZmlnUGF0aClcbiAgICA6IHBhdGguam9pbihhcHBSb290LCAnbmdzdy1jb25maWcuanNvbicpO1xuXG4gIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZVxuICBsZXQgY29uZmlnOiBDb25maWcgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbkRhdGEgPSBhd2FpdCBpbnB1dHB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoY29uZmlnUGF0aCwgJ3V0Zi04Jyk7XG4gICAgY29uZmlnID0gSlNPTi5wYXJzZShjb25maWd1cmF0aW9uRGF0YSkgYXMgQ29uZmlnO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuICAgIGlmIChlcnJvci5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnRXJyb3I6IEV4cGVjdGVkIHRvIGZpbmQgYW4gbmdzdy1jb25maWcuanNvbiBjb25maWd1cmF0aW9uIGZpbGUnICtcbiAgICAgICAgICBgIGluIHRoZSAke2FwcFJvb3R9IGZvbGRlci4gRWl0aGVyIHByb3ZpZGUgb25lIG9yYCArXG4gICAgICAgICAgJyBkaXNhYmxlIFNlcnZpY2UgV29ya2VyIGluIHRoZSBhbmd1bGFyLmpzb24gY29uZmlndXJhdGlvbiBmaWxlLicsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJDb3JlKFxuICAgIGNvbmZpZyxcbiAgICBuZXcgQ2xpRmlsZXN5c3RlbShvdXRwdXRGaWxlU3lzdGVtLCBvdXRwdXRQYXRoKSxcbiAgICBiYXNlSHJlZixcbiAgKTtcblxuICBjb25zdCBjb3B5ID0gYXN5bmMgKHNyYzogc3RyaW5nLCBkZXN0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBjb25zdCByZXNvbHZlZERlc3QgPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZGVzdCk7XG5cbiAgICByZXR1cm4gaW5wdXRwdXRGaWxlU3lzdGVtID09PSBvdXRwdXRGaWxlU3lzdGVtXG4gICAgICA/IC8vIE5hdGl2ZSBGUyAoQnVpbGRlcikuXG4gICAgICAgIGlucHV0cHV0RmlsZVN5c3RlbS5jb3B5RmlsZShzcmMsIHJlc29sdmVkRGVzdCwgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSlcbiAgICAgIDogLy8gbWVtZnMgKFdlYnBhY2spOiBSZWFkIHRoZSBmaWxlIGZyb20gdGhlIGlucHV0IEZTIChkaXNrKSBhbmQgd3JpdGUgaXQgdG8gdGhlIG91dHB1dCBGUyAobWVtb3J5KS5cbiAgICAgICAgb3V0cHV0RmlsZVN5c3RlbS53cml0ZUZpbGUocmVzb2x2ZWREZXN0LCBhd2FpdCBpbnB1dHB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoc3JjKSk7XG4gIH07XG5cbiAgYXdhaXQgb3V0cHV0RmlsZVN5c3RlbS53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsICduZ3N3Lmpzb24nKSwgcmVzdWx0Lm1hbmlmZXN0KTtcblxuICBmb3IgKGNvbnN0IHsgc291cmNlLCBkZXN0aW5hdGlvbiB9IG9mIHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgYXdhaXQgY29weShzb3VyY2UsIGRlc3RpbmF0aW9uKTtcbiAgfVxufVxuXG4vLyBUaGlzIGlzIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBlc2J1aWxkLWJhc2VkIGJ1aWxkZXJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGNvbmZpZ1BhdGg6IHN0cmluZyxcbiAgYmFzZUhyZWY6IHN0cmluZyxcbiAgb3V0cHV0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiBCdWlsZE91dHB1dEFzc2V0W10sXG4pOiBQcm9taXNlPHsgbWFuaWZlc3Q6IHN0cmluZzsgYXNzZXRGaWxlczogQnVpbGRPdXRwdXRBc3NldFtdIH0+IHtcbiAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvbiBmaWxlXG4gIGxldCBjb25maWc6IENvbmZpZyB8IHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb25maWd1cmF0aW9uRGF0YSA9IGF3YWl0IGZzUHJvbWlzZXMucmVhZEZpbGUoY29uZmlnUGF0aCwgJ3V0Zi04Jyk7XG4gICAgY29uZmlnID0gSlNPTi5wYXJzZShjb25maWd1cmF0aW9uRGF0YSkgYXMgQ29uZmlnO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuICAgIGlmIChlcnJvci5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgLy8gVE9ETzogR2VuZXJhdGUgYW4gZXJyb3Igb2JqZWN0IHRoYXQgY2FuIGJlIGNvbnN1bWVkIGJ5IHRoZSBlc2J1aWxkLWJhc2VkIGJ1aWxkZXJcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgU2VydmljZSB3b3JrZXIgY29uZmlndXJhdGlvbiBmaWxlIFwiJHtwYXRoLnJlbGF0aXZlKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBjb25maWdQYXRoLFxuICAgICAgKX1cIiBjb3VsZCBub3QgYmUgZm91bmQuYDtcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckNvcmUoXG4gICAgY29uZmlnLFxuICAgIG5ldyBSZXN1bHRGaWxlc3lzdGVtKG91dHB1dEZpbGVzLCBhc3NldEZpbGVzKSxcbiAgICBiYXNlSHJlZixcbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckNvcmUoXG4gIGNvbmZpZzogQ29uZmlnLFxuICBzZXJ2aWNlV29ya2VyRmlsZXN5c3RlbTogRmlsZXN5c3RlbSxcbiAgYmFzZUhyZWY6IHN0cmluZyxcbik6IFByb21pc2U8eyBtYW5pZmVzdDogc3RyaW5nOyBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSB9PiB7XG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9zZXJ2aWNlLXdvcmtlci9jb25maWdgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IEdlbmVyYXRvckNvbnN0cnVjdG9yID0gKFxuICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvc2VydmljZS13b3JrZXIvY29uZmlnJyk+KFxuICAgICAgJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL2NvbmZpZycsXG4gICAgKVxuICApLkdlbmVyYXRvcjtcblxuICAvLyBHZW5lcmF0ZSB0aGUgbWFuaWZlc3RcbiAgY29uc3QgZ2VuZXJhdG9yID0gbmV3IEdlbmVyYXRvckNvbnN0cnVjdG9yKHNlcnZpY2VXb3JrZXJGaWxlc3lzdGVtLCBiYXNlSHJlZik7XG4gIGNvbnN0IG91dHB1dCA9IGF3YWl0IGdlbmVyYXRvci5wcm9jZXNzKGNvbmZpZyk7XG5cbiAgLy8gV3JpdGUgdGhlIG1hbmlmZXN0XG4gIGNvbnN0IG1hbmlmZXN0ID0gSlNPTi5zdHJpbmdpZnkob3V0cHV0LCBudWxsLCAyKTtcblxuICAvLyBGaW5kIHRoZSBzZXJ2aWNlIHdvcmtlciBwYWNrYWdlXG4gIGNvbnN0IHdvcmtlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL3NlcnZpY2Utd29ya2VyL25nc3ctd29ya2VyLmpzJyk7XG5cbiAgY29uc3QgcmVzdWx0ID0ge1xuICAgIG1hbmlmZXN0LFxuICAgIC8vIE1haW4gd29ya2VyIGNvZGVcbiAgICBhc3NldEZpbGVzOiBbeyBzb3VyY2U6IHdvcmtlclBhdGgsIGRlc3RpbmF0aW9uOiAnbmdzdy13b3JrZXIuanMnIH1dLFxuICB9O1xuXG4gIC8vIElmIHByZXNlbnQsIHdyaXRlIHRoZSBzYWZldHkgd29ya2VyIGNvZGVcbiAgY29uc3Qgc2FmZXR5UGF0aCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUod29ya2VyUGF0aCksICdzYWZldHktd29ya2VyLmpzJyk7XG4gIGlmIChleGlzdHNTeW5jKHNhZmV0eVBhdGgpKSB7XG4gICAgcmVzdWx0LmFzc2V0RmlsZXMucHVzaCh7IHNvdXJjZTogc2FmZXR5UGF0aCwgZGVzdGluYXRpb246ICd3b3JrZXItYmFzaWMubWluLmpzJyB9KTtcbiAgICByZXN1bHQuYXNzZXRGaWxlcy5wdXNoKHsgc291cmNlOiBzYWZldHlQYXRoLCBkZXN0aW5hdGlvbjogJ3NhZmV0eS13b3JrZXIuanMnIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==