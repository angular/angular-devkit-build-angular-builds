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
exports.ScriptsWebpackPlugin = void 0;
const loader_utils_1 = require("loader-utils");
const path = __importStar(require("path"));
const webpack_1 = require("webpack");
const Entrypoint = require('webpack/lib/Entrypoint');
function addDependencies(compilation, scripts) {
    for (const script of scripts) {
        compilation.fileDependencies.add(script);
    }
}
class ScriptsWebpackPlugin {
    constructor(options) {
        this.options = options;
    }
    async shouldSkip(compilation, scripts) {
        if (this._lastBuildTime == undefined) {
            this._lastBuildTime = Date.now();
            return false;
        }
        for (const script of scripts) {
            const scriptTime = await new Promise((resolve, reject) => {
                compilation.fileSystemInfo.getFileTimestamp(script, (error, entry) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(entry && typeof entry !== 'string' ? entry.safeTime : undefined);
                });
            });
            if (!scriptTime || scriptTime > this._lastBuildTime) {
                this._lastBuildTime = Date.now();
                return false;
            }
        }
        return true;
    }
    _insertOutput(compilation, { filename, source }, cached = false) {
        const chunk = new webpack_1.Chunk(this.options.name);
        chunk.rendered = !cached;
        chunk.id = this.options.name;
        chunk.ids = [chunk.id];
        chunk.files.add(filename);
        const entrypoint = new Entrypoint(this.options.name);
        entrypoint.pushChunk(chunk);
        chunk.addGroup(entrypoint);
        compilation.entrypoints.set(this.options.name, entrypoint);
        compilation.chunks.add(chunk);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        compilation.assets[filename] = source;
        compilation.hooks.chunkAsset.call(chunk, filename);
    }
    apply(compiler) {
        if (!this.options.scripts || this.options.scripts.length === 0) {
            return;
        }
        const scripts = this.options.scripts
            .filter((script) => !!script)
            .map((script) => path.resolve(this.options.basePath || '', script));
        compiler.hooks.thisCompilation.tap('scripts-webpack-plugin', (compilation) => {
            compilation.hooks.additionalAssets.tapPromise('scripts-webpack-plugin', async () => {
                if (await this.shouldSkip(compilation, scripts)) {
                    if (this._cachedOutput) {
                        this._insertOutput(compilation, this._cachedOutput, true);
                    }
                    addDependencies(compilation, scripts);
                    return;
                }
                const sourceGetters = scripts.map((fullPath) => {
                    return new Promise((resolve, reject) => {
                        compilation.inputFileSystem.readFile(fullPath, (err, data) => {
                            var _a;
                            if (err) {
                                reject(err);
                                return;
                            }
                            const content = (_a = data === null || data === void 0 ? void 0 : data.toString()) !== null && _a !== void 0 ? _a : '';
                            let source;
                            if (this.options.sourceMap) {
                                // TODO: Look for source map file (for '.min' scripts, etc.)
                                let adjustedPath = fullPath;
                                if (this.options.basePath) {
                                    adjustedPath = path.relative(this.options.basePath, fullPath);
                                }
                                source = new webpack_1.sources.OriginalSource(content, adjustedPath);
                            }
                            else {
                                source = new webpack_1.sources.RawSource(content);
                            }
                            resolve(source);
                        });
                    });
                });
                const sources = await Promise.all(sourceGetters);
                const concatSource = new webpack_1.sources.ConcatSource();
                sources.forEach((source) => {
                    concatSource.add(source);
                    concatSource.add('\n;');
                });
                const combinedSource = new webpack_1.sources.CachedSource(concatSource);
                const filename = (0, loader_utils_1.interpolateName)({ resourcePath: 'scripts.js' }, this.options.filename, {
                    content: combinedSource.source(),
                });
                const output = { filename, source: combinedSource };
                this._insertOutput(compilation, output);
                this._cachedOutput = output;
                addDependencies(compilation, scripts);
            });
        });
    }
}
exports.ScriptsWebpackPlugin = ScriptsWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0cy13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQStDO0FBQy9DLDJDQUE2QjtBQUM3QixxQ0FBa0Y7QUFFbEYsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFlckQsU0FBUyxlQUFlLENBQUMsV0FBd0IsRUFBRSxPQUFpQjtJQUNsRSxLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRTtRQUM1QixXQUFXLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQzFDO0FBQ0gsQ0FBQztBQUNELE1BQWEsb0JBQW9CO0lBSS9CLFlBQW9CLE9BQW9DO1FBQXBDLFlBQU8sR0FBUCxPQUFPLENBQTZCO0lBQUcsQ0FBQztJQUU1RCxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQXdCLEVBQUUsT0FBaUI7UUFDMUQsSUFBSSxJQUFJLENBQUMsY0FBYyxJQUFJLFNBQVMsRUFBRTtZQUNwQyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUVqQyxPQUFPLEtBQUssQ0FBQztTQUNkO1FBRUQsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUU7WUFDNUIsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FBcUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQzNFLFdBQVcsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFF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QUM7b0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNqRCxNQUFNLFlBQVksR0FBRyxJQUFJLGlCQUFjLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ3ZELE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtvQkFDekIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDekIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDMUIsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxpQkFBYyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDckUsTUFBTSxRQUFRLEdBQUcsSUFBQSw4QkFBZSxFQUM5QixFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsRUFDOUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFrQixFQUMvQjtvQkFDRSxPQUFPLEVBQUUsY0FBYyxDQUFDLE1BQU0sRUFBRTtpQkFDakMsQ0FDRixDQUFDO2dCQUVGLE1BQU0sTUFBTSxHQUFHLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsQ0FBQztnQkFDcEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3hDLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDO2dCQUM1QixlQUFlLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3hDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0SUQsb0RBc0lDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGludGVycG9sYXRlTmFtZSB9IGZyb20gJ2xvYWRlci11dGlscyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ2h1bmssIENvbXBpbGF0aW9uLCBDb21waWxlciwgc291cmNlcyBhcyB3ZWJwYWNrU291cmNlcyB9IGZyb20gJ3dlYnBhY2snO1xuXG5jb25zdCBFbnRyeXBvaW50ID0gcmVxdWlyZSgnd2VicGFjay9saWIvRW50cnlwb2ludCcpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjcmlwdHNXZWJwYWNrUGx1Z2luT3B0aW9ucyB7XG4gIG5hbWU6IHN0cmluZztcbiAgc291cmNlTWFwPzogYm9vbGVhbjtcbiAgc2NyaXB0czogc3RyaW5nW107XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIGJhc2VQYXRoOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTY3JpcHRPdXRwdXQge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBzb3VyY2U6IHdlYnBhY2tTb3VyY2VzLkNhY2hlZFNvdXJjZTtcbn1cblxuZnVuY3Rpb24gYWRkRGVwZW5kZW5jaWVzKGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiwgc2NyaXB0czogc3RyaW5nW10pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBzY3JpcHQgb2Ygc2NyaXB0cykge1xuICAgIGNvbXBpbGF0aW9uLmZpbGVEZXBlbmRlbmNpZXMuYWRkKHNjcmlwdCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBTY3JpcHRzV2VicGFja1BsdWdpbiB7XG4gIHByaXZhdGUgX2xhc3RCdWlsZFRpbWU/OiBudW1iZXI7XG4gIHByaXZhdGUgX2NhY2hlZE91dHB1dD86IFNjcmlwdE91dHB1dDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG9wdGlvbnM6IFNjcmlwdHNXZWJwYWNrUGx1Z2luT3B0aW9ucykge31cblxuICBhc3luYyBzaG91bGRTa2lwKGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiwgc2NyaXB0czogc3RyaW5nW10pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBpZiAodGhpcy5fbGFzdEJ1aWxkVGltZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuX2xhc3RCdWlsZFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBzY3JpcHQgb2Ygc2NyaXB0cykge1xuICAgICAgY29uc3Qgc2NyaXB0VGltZSA9IGF3YWl0IG5ldyBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb21waWxhdGlvbi5maWxlU3lzdGVtSW5mby5nZXRGaWxlVGltZXN0YW1wKHNjcmlwdCwgKGVycm9yLCBlbnRyeSkgPT4ge1xuICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlc29sdmUoZW50cnkgJiYgdHlwZW9mIGVudHJ5ICE9PSAnc3RyaW5nJyA/IGVudHJ5LnNhZmVUaW1lIDogdW5kZWZpbmVkKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgaWYgKCFzY3JpcHRUaW1lIHx8IHNjcmlwdFRpbWUgPiB0aGlzLl9sYXN0QnVpbGRUaW1lKSB7XG4gICAgICAgIHRoaXMuX2xhc3RCdWlsZFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgX2luc2VydE91dHB1dChcbiAgICBjb21waWxhdGlvbjogQ29tcGlsYXRpb24sXG4gICAgeyBmaWxlbmFtZSwgc291cmNlIH06IFNjcmlwdE91dHB1dCxcbiAgICBjYWNoZWQgPSBmYWxzZSxcbiAgKSB7XG4gICAgY29uc3QgY2h1bmsgPSBuZXcgQ2h1bmsodGhpcy5vcHRpb25zLm5hbWUpO1xuICAgIGNodW5rLnJlbmRlcmVkID0gIWNhY2hlZDtcbiAgICBjaHVuay5pZCA9IHRoaXMub3B0aW9ucy5uYW1lO1xuICAgIGNodW5rLmlkcyA9IFtjaHVuay5pZF07XG4gICAgY2h1bmsuZmlsZXMuYWRkKGZpbGVuYW1lKTtcblxuICAgIGNvbnN0IGVudHJ5cG9pbnQgPSBuZXcgRW50cnlwb2ludCh0aGlzLm9wdGlvbnMubmFtZSk7XG4gICAgZW50cnlwb2ludC5wdXNoQ2h1bmsoY2h1bmspO1xuICAgIGNodW5rLmFkZEdyb3VwKGVudHJ5cG9pbnQpO1xuICAgIGNvbXBpbGF0aW9uLmVudHJ5cG9pbnRzLnNldCh0aGlzLm9wdGlvbnMubmFtZSwgZW50cnlwb2ludCk7XG4gICAgY29tcGlsYXRpb24uY2h1bmtzLmFkZChjaHVuayk7XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbXBpbGF0aW9uLmFzc2V0c1tmaWxlbmFtZV0gPSBzb3VyY2UgYXMgYW55O1xuICAgIGNvbXBpbGF0aW9uLmhvb2tzLmNodW5rQXNzZXQuY2FsbChjaHVuaywgZmlsZW5hbWUpO1xuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuc2NyaXB0cyB8fCB0aGlzLm9wdGlvbnMuc2NyaXB0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5vcHRpb25zLnNjcmlwdHNcbiAgICAgIC5maWx0ZXIoKHNjcmlwdCkgPT4gISFzY3JpcHQpXG4gICAgICAubWFwKChzY3JpcHQpID0+IHBhdGgucmVzb2x2ZSh0aGlzLm9wdGlvbnMuYmFzZVBhdGggfHwgJycsIHNjcmlwdCkpO1xuXG4gICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcCgnc2NyaXB0cy13ZWJwYWNrLXBsdWdpbicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29tcGlsYXRpb24uaG9va3MuYWRkaXRpb25hbEFzc2V0cy50YXBQcm9taXNlKCdzY3JpcHRzLXdlYnBhY2stcGx1Z2luJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5zaG91bGRTa2lwKGNvbXBpbGF0aW9uLCBzY3JpcHRzKSkge1xuICAgICAgICAgIGlmICh0aGlzLl9jYWNoZWRPdXRwdXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2luc2VydE91dHB1dChjb21waWxhdGlvbiwgdGhpcy5fY2FjaGVkT3V0cHV0LCB0cnVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGREZXBlbmRlbmNpZXMoY29tcGlsYXRpb24sIHNjcmlwdHMpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc291cmNlR2V0dGVycyA9IHNjcmlwdHMubWFwKChmdWxsUGF0aCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx3ZWJwYWNrU291cmNlcy5Tb3VyY2U+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbXBpbGF0aW9uLmlucHV0RmlsZVN5c3RlbS5yZWFkRmlsZShcbiAgICAgICAgICAgICAgZnVsbFBhdGgsXG4gICAgICAgICAgICAgIChlcnI/OiBFcnJvciB8IG51bGwsIGRhdGE/OiBzdHJpbmcgfCBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhPy50b1N0cmluZygpID8/ICcnO1xuXG4gICAgICAgICAgICAgICAgbGV0IHNvdXJjZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnNvdXJjZU1hcCkge1xuICAgICAgICAgICAgICAgICAgLy8gVE9ETzogTG9vayBmb3Igc291cmNlIG1hcCBmaWxlIChmb3IgJy5taW4nIHNjcmlwdHMsIGV0Yy4pXG5cbiAgICAgICAgICAgICAgICAgIGxldCBhZGp1c3RlZFBhdGggPSBmdWxsUGF0aDtcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYmFzZVBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRqdXN0ZWRQYXRoID0gcGF0aC5yZWxhdGl2ZSh0aGlzLm9wdGlvbnMuYmFzZVBhdGgsIGZ1bGxQYXRoKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHNvdXJjZSA9IG5ldyB3ZWJwYWNrU291cmNlcy5PcmlnaW5hbFNvdXJjZShjb250ZW50LCBhZGp1c3RlZFBhdGgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzb3VyY2UgPSBuZXcgd2VicGFja1NvdXJjZXMuUmF3U291cmNlKGNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUoc291cmNlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBhd2FpdCBQcm9taXNlLmFsbChzb3VyY2VHZXR0ZXJzKTtcbiAgICAgICAgY29uc3QgY29uY2F0U291cmNlID0gbmV3IHdlYnBhY2tTb3VyY2VzLkNvbmNhdFNvdXJjZSgpO1xuICAgICAgICBzb3VyY2VzLmZvckVhY2goKHNvdXJjZSkgPT4ge1xuICAgICAgICAgIGNvbmNhdFNvdXJjZS5hZGQoc291cmNlKTtcbiAgICAgICAgICBjb25jYXRTb3VyY2UuYWRkKCdcXG47Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNvbWJpbmVkU291cmNlID0gbmV3IHdlYnBhY2tTb3VyY2VzLkNhY2hlZFNvdXJjZShjb25jYXRTb3VyY2UpO1xuICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGludGVycG9sYXRlTmFtZShcbiAgICAgICAgICB7IHJlc291cmNlUGF0aDogJ3NjcmlwdHMuanMnIH0sXG4gICAgICAgICAgdGhpcy5vcHRpb25zLmZpbGVuYW1lIGFzIHN0cmluZyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb250ZW50OiBjb21iaW5lZFNvdXJjZS5zb3VyY2UoKSxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IG91dHB1dCA9IHsgZmlsZW5hbWUsIHNvdXJjZTogY29tYmluZWRTb3VyY2UgfTtcbiAgICAgICAgdGhpcy5faW5zZXJ0T3V0cHV0KGNvbXBpbGF0aW9uLCBvdXRwdXQpO1xuICAgICAgICB0aGlzLl9jYWNoZWRPdXRwdXQgPSBvdXRwdXQ7XG4gICAgICAgIGFkZERlcGVuZGVuY2llcyhjb21waWxhdGlvbiwgc2NyaXB0cyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuIl19