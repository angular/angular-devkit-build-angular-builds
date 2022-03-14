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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0cy13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwrQ0FBK0M7QUFDL0MsMkNBQTZCO0FBQzdCLHFDQUFrRjtBQUVsRixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQztBQWVyRCxTQUFTLGVBQWUsQ0FBQyxXQUF3QixFQUFFLE9BQWlCO0lBQ2xFLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFO1FBQzVCLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDMUM7QUFDSCxDQUFDO0FBQ0QsTUFBYSxvQkFBb0I7SUFJL0IsWUFBb0IsT0FBb0M7UUFBcEMsWUFBTyxHQUFQLE9BQU8sQ0FBNkI7SUFBRyxDQUFDO0lBRTVELEtBQUssQ0FBQyxVQUFVLENBQUMsV0FBd0IsRUFBRSxPQUFpQjtRQUMxRCxJQUFJLElBQUksQ0FBQyxjQUFjLElBQUksU0FBUyxFQUFFO1lBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRWpDLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRTtZQUM1QixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksT0FBTyxDQUFxQixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDM0UsV0FBVyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7b0JB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QkFDSixDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztnQkFFSCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ2pELE1BQU0sWUFBWSxHQUFHLElBQUksaUJBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDdkQsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO29CQUN6QixZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN6QixZQUFZLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMxQixDQUFDLENBQUMsQ0FBQztnQkFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLGlCQUFjLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUNyRSxNQUFNLFFBQVEsR0FBRyxJQUFBLDhCQUFlLEVBQzlCLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxFQUM5QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQWtCLEVBQy9CO29CQUNFLE9BQU8sRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFO2lCQUNqQyxDQUNGLENBQUM7Z0JBRUYsTUFBTSxNQUFNLEdBQUcsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDeEMsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUM7Z0JBQzVCLGVBQWUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDeEMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXRJRCxvREFzSUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgaW50ZXJwb2xhdGVOYW1lIH0gZnJvbSAnbG9hZGVyLXV0aWxzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDaHVuaywgQ29tcGlsYXRpb24sIENvbXBpbGVyLCBzb3VyY2VzIGFzIHdlYnBhY2tTb3VyY2VzIH0gZnJvbSAnd2VicGFjayc7XG5cbmNvbnN0IEVudHJ5cG9pbnQgPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9FbnRyeXBvaW50Jyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NyaXB0c1dlYnBhY2tQbHVnaW5PcHRpb25zIHtcbiAgbmFtZTogc3RyaW5nO1xuICBzb3VyY2VNYXA/OiBib29sZWFuO1xuICBzY3JpcHRzOiBzdHJpbmdbXTtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgYmFzZVBhdGg6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNjcmlwdE91dHB1dCB7XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIHNvdXJjZTogd2VicGFja1NvdXJjZXMuQ2FjaGVkU291cmNlO1xufVxuXG5mdW5jdGlvbiBhZGREZXBlbmRlbmNpZXMoY29tcGlsYXRpb246IENvbXBpbGF0aW9uLCBzY3JpcHRzOiBzdHJpbmdbXSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IHNjcmlwdCBvZiBzY3JpcHRzKSB7XG4gICAgY29tcGlsYXRpb24uZmlsZURlcGVuZGVuY2llcy5hZGQoc2NyaXB0KTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIFNjcmlwdHNXZWJwYWNrUGx1Z2luIHtcbiAgcHJpdmF0ZSBfbGFzdEJ1aWxkVGltZT86IG51bWJlcjtcbiAgcHJpdmF0ZSBfY2FjaGVkT3V0cHV0PzogU2NyaXB0T3V0cHV0O1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogU2NyaXB0c1dlYnBhY2tQbHVnaW5PcHRpb25zKSB7fVxuXG4gIGFzeW5jIHNob3VsZFNraXAoY29tcGlsYXRpb246IENvbXBpbGF0aW9uLCBzY3JpcHRzOiBzdHJpbmdbXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICh0aGlzLl9sYXN0QnVpbGRUaW1lID09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5fbGFzdEJ1aWxkVGltZSA9IERhdGUubm93KCk7XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHNjcmlwdCBvZiBzY3JpcHRzKSB7XG4gICAgICBjb25zdCBzY3JpcHRUaW1lID0gYXdhaXQgbmV3IFByb21pc2U8bnVtYmVyIHwgdW5kZWZpbmVkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbXBpbGF0aW9uLmZpbGVTeXN0ZW1JbmZvLmdldEZpbGVUaW1lc3RhbXAoc2NyaXB0LCAoZXJyb3IsIGVudHJ5KSA9PiB7XG4gICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzb2x2ZShlbnRyeSAmJiB0eXBlb2YgZW50cnkgIT09ICdzdHJpbmcnID8gZW50cnkuc2FmZVRpbWUgOiB1bmRlZmluZWQpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXNjcmlwdFRpbWUgfHwgc2NyaXB0VGltZSA+IHRoaXMuX2xhc3RCdWlsZFRpbWUpIHtcbiAgICAgICAgdGhpcy5fbGFzdEJ1aWxkVGltZSA9IERhdGUubm93KCk7XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBfaW5zZXJ0T3V0cHV0KFxuICAgIGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbixcbiAgICB7IGZpbGVuYW1lLCBzb3VyY2UgfTogU2NyaXB0T3V0cHV0LFxuICAgIGNhY2hlZCA9IGZhbHNlLFxuICApIHtcbiAgICBjb25zdCBjaHVuayA9IG5ldyBDaHVuayh0aGlzLm9wdGlvbnMubmFtZSk7XG4gICAgY2h1bmsucmVuZGVyZWQgPSAhY2FjaGVkO1xuICAgIGNodW5rLmlkID0gdGhpcy5vcHRpb25zLm5hbWU7XG4gICAgY2h1bmsuaWRzID0gW2NodW5rLmlkXTtcbiAgICBjaHVuay5maWxlcy5hZGQoZmlsZW5hbWUpO1xuXG4gICAgY29uc3QgZW50cnlwb2ludCA9IG5ldyBFbnRyeXBvaW50KHRoaXMub3B0aW9ucy5uYW1lKTtcbiAgICBlbnRyeXBvaW50LnB1c2hDaHVuayhjaHVuayk7XG4gICAgY2h1bmsuYWRkR3JvdXAoZW50cnlwb2ludCk7XG4gICAgY29tcGlsYXRpb24uZW50cnlwb2ludHMuc2V0KHRoaXMub3B0aW9ucy5uYW1lLCBlbnRyeXBvaW50KTtcbiAgICBjb21waWxhdGlvbi5jaHVua3MuYWRkKGNodW5rKTtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29tcGlsYXRpb24uYXNzZXRzW2ZpbGVuYW1lXSA9IHNvdXJjZSBhcyBhbnk7XG4gICAgY29tcGlsYXRpb24uaG9va3MuY2h1bmtBc3NldC5jYWxsKGNodW5rLCBmaWxlbmFtZSk7XG4gIH1cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5zY3JpcHRzIHx8IHRoaXMub3B0aW9ucy5zY3JpcHRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNjcmlwdHMgPSB0aGlzLm9wdGlvbnMuc2NyaXB0c1xuICAgICAgLmZpbHRlcigoc2NyaXB0KSA9PiAhIXNjcmlwdClcbiAgICAgIC5tYXAoKHNjcmlwdCkgPT4gcGF0aC5yZXNvbHZlKHRoaXMub3B0aW9ucy5iYXNlUGF0aCB8fCAnJywgc2NyaXB0KSk7XG5cbiAgICBjb21waWxlci5ob29rcy50aGlzQ29tcGlsYXRpb24udGFwKCdzY3JpcHRzLXdlYnBhY2stcGx1Z2luJywgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICBjb21waWxhdGlvbi5ob29rcy5hZGRpdGlvbmFsQXNzZXRzLnRhcFByb21pc2UoJ3NjcmlwdHMtd2VicGFjay1wbHVnaW4nLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLnNob3VsZFNraXAoY29tcGlsYXRpb24sIHNjcmlwdHMpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2NhY2hlZE91dHB1dCkge1xuICAgICAgICAgICAgdGhpcy5faW5zZXJ0T3V0cHV0KGNvbXBpbGF0aW9uLCB0aGlzLl9jYWNoZWRPdXRwdXQsIHRydWUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGFkZERlcGVuZGVuY2llcyhjb21waWxhdGlvbiwgc2NyaXB0cyk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzb3VyY2VHZXR0ZXJzID0gc2NyaXB0cy5tYXAoKGZ1bGxQYXRoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHdlYnBhY2tTb3VyY2VzLlNvdXJjZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29tcGlsYXRpb24uaW5wdXRGaWxlU3lzdGVtLnJlYWRGaWxlKFxuICAgICAgICAgICAgICBmdWxsUGF0aCxcbiAgICAgICAgICAgICAgKGVycj86IEVycm9yIHwgbnVsbCwgZGF0YT86IHN0cmluZyB8IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGE/LnRvU3RyaW5nKCkgPz8gJyc7XG5cbiAgICAgICAgICAgICAgICBsZXQgc291cmNlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgICAgICAgICAgICAgICAvLyBUT0RPOiBMb29rIGZvciBzb3VyY2UgbWFwIGZpbGUgKGZvciAnLm1pbicgc2NyaXB0cywgZXRjLilcblxuICAgICAgICAgICAgICAgICAgbGV0IGFkanVzdGVkUGF0aCA9IGZ1bGxQYXRoO1xuICAgICAgICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5iYXNlUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBhZGp1c3RlZFBhdGggPSBwYXRoLnJlbGF0aXZlKHRoaXMub3B0aW9ucy5iYXNlUGF0aCwgZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc291cmNlID0gbmV3IHdlYnBhY2tTb3VyY2VzLk9yaWdpbmFsU291cmNlKGNvbnRlbnQsIGFkanVzdGVkUGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNvdXJjZSA9IG5ldyB3ZWJwYWNrU291cmNlcy5SYXdTb3VyY2UoY29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzb3VyY2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc291cmNlcyA9IGF3YWl0IFByb21pc2UuYWxsKHNvdXJjZUdldHRlcnMpO1xuICAgICAgICBjb25zdCBjb25jYXRTb3VyY2UgPSBuZXcgd2VicGFja1NvdXJjZXMuQ29uY2F0U291cmNlKCk7XG4gICAgICAgIHNvdXJjZXMuZm9yRWFjaCgoc291cmNlKSA9PiB7XG4gICAgICAgICAgY29uY2F0U291cmNlLmFkZChzb3VyY2UpO1xuICAgICAgICAgIGNvbmNhdFNvdXJjZS5hZGQoJ1xcbjsnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY29tYmluZWRTb3VyY2UgPSBuZXcgd2VicGFja1NvdXJjZXMuQ2FjaGVkU291cmNlKGNvbmNhdFNvdXJjZSk7XG4gICAgICAgIGNvbnN0IGZpbGVuYW1lID0gaW50ZXJwb2xhdGVOYW1lKFxuICAgICAgICAgIHsgcmVzb3VyY2VQYXRoOiAnc2NyaXB0cy5qcycgfSxcbiAgICAgICAgICB0aGlzLm9wdGlvbnMuZmlsZW5hbWUgYXMgc3RyaW5nLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRlbnQ6IGNvbWJpbmVkU291cmNlLnNvdXJjZSgpLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0ID0geyBmaWxlbmFtZSwgc291cmNlOiBjb21iaW5lZFNvdXJjZSB9O1xuICAgICAgICB0aGlzLl9pbnNlcnRPdXRwdXQoY29tcGlsYXRpb24sIG91dHB1dCk7XG4gICAgICAgIHRoaXMuX2NhY2hlZE91dHB1dCA9IG91dHB1dDtcbiAgICAgICAgYWRkRGVwZW5kZW5jaWVzKGNvbXBpbGF0aW9uLCBzY3JpcHRzKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iXX0=