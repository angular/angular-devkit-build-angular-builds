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
/**
 * The name of the plugin provided to Webpack when tapping Webpack compiler hooks.
 */
const PLUGIN_NAME = 'scripts-webpack-plugin';
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
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.additionalAssets.tapPromise(PLUGIN_NAME, async () => {
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
                const output = { filename: this.options.filename, source: combinedSource };
                this._insertOutput(compilation, output);
                this._cachedOutput = output;
                addDependencies(compilation, scripts);
            });
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING,
            }, async () => {
                const assetName = this.options.filename;
                const asset = compilation.getAsset(assetName);
                if (asset) {
                    const interpolatedFilename = (0, loader_utils_1.interpolateName)({ resourcePath: 'scripts.js' }, assetName, { content: asset.source.source() });
                    if (assetName !== interpolatedFilename) {
                        compilation.renameAsset(assetName, interpolatedFilename);
                    }
                }
            });
        });
    }
}
exports.ScriptsWebpackPlugin = ScriptsWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0cy13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQStDO0FBQy9DLDJDQUE2QjtBQUM3QixxQ0FBa0Y7QUFFbEYsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFFckQ7O0dBRUc7QUFDSCxNQUFNLFdBQVcsR0FBRyx3QkFBd0IsQ0FBQztBQWU3QyxTQUFTLGVBQWUsQ0FBQyxXQUF3QixFQUFFLE9BQWlCO0lBQ2xFLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFO1FBQzVCLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDMUM7QUFDSCxDQUFDO0FBQ0QsTUFBYSxvQkFBb0I7SUFJL0IsWUFBb0IsT0FBb0M7UUFBcEMsWUFBTyxHQUFQLE9BQU8sQ0FBNkI7SUFBRyxDQUFDO0lBRTVELEtBQUssQ0FBQyxVQUFVLENBQUMsV0FBd0IsRUFBRSxPQUFpQjtRQUMxRCxJQUFJLElBQUksQ0FBQyxjQUFjLElBQUksU0FBUyxFQUFFO1lBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRWpDLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRTtZQUM1QixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksT0FBTyxDQUFxQixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDM0UsV0FBVyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0Is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QVMsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLEtBQUssRUFBRTtvQkFDVCxNQUFNLG9CQUFvQixHQUFHLElBQUEsOEJBQWUsRUFDMUMsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLEVBQzlCLFNBQVMsRUFDVCxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQ25DLENBQUM7b0JBQ0YsSUFBSSxTQUFTLEtBQUssb0JBQW9CLEVBQUU7d0JBQ3RDLFdBQVcsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7cUJBQzFEO2lCQUNGO1lBQ0gsQ0FBQyxDQUNGLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQW5KRCxvREFtSkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgaW50ZXJwb2xhdGVOYW1lIH0gZnJvbSAnbG9hZGVyLXV0aWxzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDaHVuaywgQ29tcGlsYXRpb24sIENvbXBpbGVyLCBzb3VyY2VzIGFzIHdlYnBhY2tTb3VyY2VzIH0gZnJvbSAnd2VicGFjayc7XG5cbmNvbnN0IEVudHJ5cG9pbnQgPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9FbnRyeXBvaW50Jyk7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIHBsdWdpbiBwcm92aWRlZCB0byBXZWJwYWNrIHdoZW4gdGFwcGluZyBXZWJwYWNrIGNvbXBpbGVyIGhvb2tzLlxuICovXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdzY3JpcHRzLXdlYnBhY2stcGx1Z2luJztcblxuZXhwb3J0IGludGVyZmFjZSBTY3JpcHRzV2VicGFja1BsdWdpbk9wdGlvbnMge1xuICBuYW1lOiBzdHJpbmc7XG4gIHNvdXJjZU1hcD86IGJvb2xlYW47XG4gIHNjcmlwdHM6IHN0cmluZ1tdO1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBiYXNlUGF0aDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2NyaXB0T3V0cHV0IHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgc291cmNlOiB3ZWJwYWNrU291cmNlcy5DYWNoZWRTb3VyY2U7XG59XG5cbmZ1bmN0aW9uIGFkZERlcGVuZGVuY2llcyhjb21waWxhdGlvbjogQ29tcGlsYXRpb24sIHNjcmlwdHM6IHN0cmluZ1tdKTogdm9pZCB7XG4gIGZvciAoY29uc3Qgc2NyaXB0IG9mIHNjcmlwdHMpIHtcbiAgICBjb21waWxhdGlvbi5maWxlRGVwZW5kZW5jaWVzLmFkZChzY3JpcHQpO1xuICB9XG59XG5leHBvcnQgY2xhc3MgU2NyaXB0c1dlYnBhY2tQbHVnaW4ge1xuICBwcml2YXRlIF9sYXN0QnVpbGRUaW1lPzogbnVtYmVyO1xuICBwcml2YXRlIF9jYWNoZWRPdXRwdXQ/OiBTY3JpcHRPdXRwdXQ7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBTY3JpcHRzV2VicGFja1BsdWdpbk9wdGlvbnMpIHt9XG5cbiAgYXN5bmMgc2hvdWxkU2tpcChjb21waWxhdGlvbjogQ29tcGlsYXRpb24sIHNjcmlwdHM6IHN0cmluZ1tdKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgaWYgKHRoaXMuX2xhc3RCdWlsZFRpbWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLl9sYXN0QnVpbGRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc2NyaXB0IG9mIHNjcmlwdHMpIHtcbiAgICAgIGNvbnN0IHNjcmlwdFRpbWUgPSBhd2FpdCBuZXcgUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29tcGlsYXRpb24uZmlsZVN5c3RlbUluZm8uZ2V0RmlsZVRpbWVzdGFtcChzY3JpcHQsIChlcnJvciwgZW50cnkpID0+IHtcbiAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXNvbHZlKGVudHJ5ICYmIHR5cGVvZiBlbnRyeSAhPT0gJ3N0cmluZycgPyBlbnRyeS5zYWZlVGltZSA6IHVuZGVmaW5lZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGlmICghc2NyaXB0VGltZSB8fCBzY3JpcHRUaW1lID4gdGhpcy5fbGFzdEJ1aWxkVGltZSkge1xuICAgICAgICB0aGlzLl9sYXN0QnVpbGRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwcml2YXRlIF9pbnNlcnRPdXRwdXQoXG4gICAgY29tcGlsYXRpb246IENvbXBpbGF0aW9uLFxuICAgIHsgZmlsZW5hbWUsIHNvdXJjZSB9OiBTY3JpcHRPdXRwdXQsXG4gICAgY2FjaGVkID0gZmFsc2UsXG4gICkge1xuICAgIGNvbnN0IGNodW5rID0gbmV3IENodW5rKHRoaXMub3B0aW9ucy5uYW1lKTtcbiAgICBjaHVuay5yZW5kZXJlZCA9ICFjYWNoZWQ7XG4gICAgY2h1bmsuaWQgPSB0aGlzLm9wdGlvbnMubmFtZTtcbiAgICBjaHVuay5pZHMgPSBbY2h1bmsuaWRdO1xuICAgIGNodW5rLmZpbGVzLmFkZChmaWxlbmFtZSk7XG5cbiAgICBjb25zdCBlbnRyeXBvaW50ID0gbmV3IEVudHJ5cG9pbnQodGhpcy5vcHRpb25zLm5hbWUpO1xuICAgIGVudHJ5cG9pbnQucHVzaENodW5rKGNodW5rKTtcbiAgICBjaHVuay5hZGRHcm91cChlbnRyeXBvaW50KTtcbiAgICBjb21waWxhdGlvbi5lbnRyeXBvaW50cy5zZXQodGhpcy5vcHRpb25zLm5hbWUsIGVudHJ5cG9pbnQpO1xuICAgIGNvbXBpbGF0aW9uLmNodW5rcy5hZGQoY2h1bmspO1xuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb21waWxhdGlvbi5hc3NldHNbZmlsZW5hbWVdID0gc291cmNlIGFzIGFueTtcbiAgICBjb21waWxhdGlvbi5ob29rcy5jaHVua0Fzc2V0LmNhbGwoY2h1bmssIGZpbGVuYW1lKTtcbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGlmICghdGhpcy5vcHRpb25zLnNjcmlwdHMgfHwgdGhpcy5vcHRpb25zLnNjcmlwdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2NyaXB0cyA9IHRoaXMub3B0aW9ucy5zY3JpcHRzXG4gICAgICAuZmlsdGVyKChzY3JpcHQpID0+ICEhc2NyaXB0KVxuICAgICAgLm1hcCgoc2NyaXB0KSA9PiBwYXRoLnJlc29sdmUodGhpcy5vcHRpb25zLmJhc2VQYXRoIHx8ICcnLCBzY3JpcHQpKTtcblxuICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29tcGlsYXRpb24uaG9va3MuYWRkaXRpb25hbEFzc2V0cy50YXBQcm9taXNlKFBMVUdJTl9OQU1FLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLnNob3VsZFNraXAoY29tcGlsYXRpb24sIHNjcmlwdHMpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX2NhY2hlZE91dHB1dCkge1xuICAgICAgICAgICAgdGhpcy5faW5zZXJ0T3V0cHV0KGNvbXBpbGF0aW9uLCB0aGlzLl9jYWNoZWRPdXRwdXQsIHRydWUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGFkZERlcGVuZGVuY2llcyhjb21waWxhdGlvbiwgc2NyaXB0cyk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzb3VyY2VHZXR0ZXJzID0gc2NyaXB0cy5tYXAoKGZ1bGxQYXRoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHdlYnBhY2tTb3VyY2VzLlNvdXJjZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29tcGlsYXRpb24uaW5wdXRGaWxlU3lzdGVtLnJlYWRGaWxlKFxuICAgICAgICAgICAgICBmdWxsUGF0aCxcbiAgICAgICAgICAgICAgKGVycj86IEVycm9yIHwgbnVsbCwgZGF0YT86IHN0cmluZyB8IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGE/LnRvU3RyaW5nKCkgPz8gJyc7XG5cbiAgICAgICAgICAgICAgICBsZXQgc291cmNlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgICAgICAgICAgICAgICAvLyBUT0RPOiBMb29rIGZvciBzb3VyY2UgbWFwIGZpbGUgKGZvciAnLm1pbicgc2NyaXB0cywgZXRjLilcblxuICAgICAgICAgICAgICAgICAgbGV0IGFkanVzdGVkUGF0aCA9IGZ1bGxQYXRoO1xuICAgICAgICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5iYXNlUGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBhZGp1c3RlZFBhdGggPSBwYXRoLnJlbGF0aXZlKHRoaXMub3B0aW9ucy5iYXNlUGF0aCwgZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc291cmNlID0gbmV3IHdlYnBhY2tTb3VyY2VzLk9yaWdpbmFsU291cmNlKGNvbnRlbnQsIGFkanVzdGVkUGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNvdXJjZSA9IG5ldyB3ZWJwYWNrU291cmNlcy5SYXdTb3VyY2UoY29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzb3VyY2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc291cmNlcyA9IGF3YWl0IFByb21pc2UuYWxsKHNvdXJjZUdldHRlcnMpO1xuICAgICAgICBjb25zdCBjb25jYXRTb3VyY2UgPSBuZXcgd2VicGFja1NvdXJjZXMuQ29uY2F0U291cmNlKCk7XG4gICAgICAgIHNvdXJjZXMuZm9yRWFjaCgoc291cmNlKSA9PiB7XG4gICAgICAgICAgY29uY2F0U291cmNlLmFkZChzb3VyY2UpO1xuICAgICAgICAgIGNvbmNhdFNvdXJjZS5hZGQoJ1xcbjsnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY29tYmluZWRTb3VyY2UgPSBuZXcgd2VicGFja1NvdXJjZXMuQ2FjaGVkU291cmNlKGNvbmNhdFNvdXJjZSk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0ID0geyBmaWxlbmFtZTogdGhpcy5vcHRpb25zLmZpbGVuYW1lLCBzb3VyY2U6IGNvbWJpbmVkU291cmNlIH07XG4gICAgICAgIHRoaXMuX2luc2VydE91dHB1dChjb21waWxhdGlvbiwgb3V0cHV0KTtcbiAgICAgICAgdGhpcy5fY2FjaGVkT3V0cHV0ID0gb3V0cHV0O1xuICAgICAgICBhZGREZXBlbmRlbmNpZXMoY29tcGlsYXRpb24sIHNjcmlwdHMpO1xuICAgICAgfSk7XG4gICAgICBjb21waWxhdGlvbi5ob29rcy5wcm9jZXNzQXNzZXRzLnRhcFByb21pc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBQTFVHSU5fTkFNRSxcbiAgICAgICAgICBzdGFnZTogY29tcGlsZXIud2VicGFjay5Db21waWxhdGlvbi5QUk9DRVNTX0FTU0VUU19TVEFHRV9ERVZfVE9PTElORyxcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFzc2V0TmFtZSA9IHRoaXMub3B0aW9ucy5maWxlbmFtZTtcbiAgICAgICAgICBjb25zdCBhc3NldCA9IGNvbXBpbGF0aW9uLmdldEFzc2V0KGFzc2V0TmFtZSk7XG4gICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRGaWxlbmFtZSA9IGludGVycG9sYXRlTmFtZShcbiAgICAgICAgICAgICAgeyByZXNvdXJjZVBhdGg6ICdzY3JpcHRzLmpzJyB9LFxuICAgICAgICAgICAgICBhc3NldE5hbWUsXG4gICAgICAgICAgICAgIHsgY29udGVudDogYXNzZXQuc291cmNlLnNvdXJjZSgpIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGFzc2V0TmFtZSAhPT0gaW50ZXJwb2xhdGVkRmlsZW5hbWUpIHtcbiAgICAgICAgICAgICAgY29tcGlsYXRpb24ucmVuYW1lQXNzZXQoYXNzZXROYW1lLCBpbnRlcnBvbGF0ZWRGaWxlbmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxufVxuIl19