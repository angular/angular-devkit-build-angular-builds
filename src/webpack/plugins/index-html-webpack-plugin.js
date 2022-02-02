"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexHtmlWebpackPlugin = void 0;
const path_1 = require("path");
const webpack_1 = require("webpack");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const PLUGIN_NAME = 'index-html-webpack-plugin';
class IndexHtmlWebpackPlugin extends index_html_generator_1.IndexHtmlGenerator {
    constructor(options) {
        super(options);
        this.options = options;
    }
    get compilation() {
        if (this._compilation) {
            return this._compilation;
        }
        throw new Error('compilation is undefined.');
    }
    apply(compiler) {
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            this._compilation = compilation;
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: webpack_1.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE + 1,
            }, callback);
        });
        const callback = async (assets) => {
            const files = [];
            try {
                for (const chunk of this.compilation.chunks) {
                    for (const file of chunk.files) {
                        if (file.endsWith('.hot-update.js')) {
                            continue;
                        }
                        files.push({
                            name: chunk.name,
                            file,
                            extension: (0, path_1.extname)(file),
                        });
                    }
                }
                const { content, warnings, errors } = await this.process({
                    files,
                    outputPath: (0, path_1.dirname)(this.options.outputPath),
                    baseHref: this.options.baseHref,
                    lang: this.options.lang,
                });
                assets[this.options.outputPath] = new webpack_1.sources.RawSource(content);
                warnings.forEach((msg) => (0, webpack_diagnostics_1.addWarning)(this.compilation, msg));
                errors.forEach((msg) => (0, webpack_diagnostics_1.addError)(this.compilation, msg));
            }
            catch (error) {
                (0, webpack_diagnostics_1.addError)(this.compilation, error.message);
            }
        };
    }
    async readAsset(path) {
        const data = this.compilation.assets[(0, path_1.basename)(path)].source();
        return typeof data === 'string' ? data : data.toString();
    }
    async readIndex(path) {
        return new Promise((resolve, reject) => {
            this.compilation.inputFileSystem.readFile(path, (err, data) => {
                var _a;
                if (err) {
                    reject(err);
                    return;
                }
                this.compilation.fileDependencies.add(path);
                resolve((_a = data === null || data === void 0 ? void 0 : data.toString()) !== null && _a !== void 0 ? _a : '');
            });
        });
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtCQUFrRDtBQUNsRCxxQ0FBeUQ7QUFFekQsc0ZBSXFEO0FBQ3JELHlFQUF1RTtBQU12RSxNQUFNLFdBQVcsR0FBRywyQkFBMkIsQ0FBQztBQUNoRCxNQUFhLHNCQUF1QixTQUFRLHlDQUFrQjtJQVU1RCxZQUE4QixPQUFzQztRQUNsRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFEYSxZQUFPLEdBQVAsT0FBTyxDQUErQjtJQUVwRSxDQUFDO0lBVkQsSUFBSSxXQUFXO1FBQ2IsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztTQUMxQjtRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBTUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUM5RCxJQUFJLENBQUMsWUFBWSxHQUFHLFdBQVcsQ0FBQztZQUNoQyxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQ3hDO2dCQUNFLElBQUksRUFBRSxXQUFXO2dCQUNqQixLQUFLLEVBQUUscUJBQVcsQ0FBQyw2QkFBNkIsR0FBRyxDQUFDO2FBQ3JELEVBQ0QsUUFBUSxDQUNULENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sUUFBUSxHQUFHLEtBQUssRUFBRSxNQUErQixF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QWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBleHRuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIHNvdXJjZXMgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHtcbiAgSW5kZXhIdG1sR2VuZXJhdG9yLFxuICBJbmRleEh0bWxHZW5lcmF0b3JPcHRpb25zLFxuICBJbmRleEh0bWxHZW5lcmF0b3JQcm9jZXNzT3B0aW9ucyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBhZGRFcnJvciwgYWRkV2FybmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW5PcHRpb25zXG4gIGV4dGVuZHMgSW5kZXhIdG1sR2VuZXJhdG9yT3B0aW9ucyxcbiAgICBPbWl0PEluZGV4SHRtbEdlbmVyYXRvclByb2Nlc3NPcHRpb25zLCAnZmlsZXMnPiB7fVxuXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdpbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmV4cG9ydCBjbGFzcyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIGV4dGVuZHMgSW5kZXhIdG1sR2VuZXJhdG9yIHtcbiAgcHJpdmF0ZSBfY29tcGlsYXRpb246IENvbXBpbGF0aW9uIHwgdW5kZWZpbmVkO1xuICBnZXQgY29tcGlsYXRpb24oKTogQ29tcGlsYXRpb24ge1xuICAgIGlmICh0aGlzLl9jb21waWxhdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbXBpbGF0aW9uO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcignY29tcGlsYXRpb24gaXMgdW5kZWZpbmVkLicpO1xuICB9XG5cbiAgY29uc3RydWN0b3Iob3ZlcnJpZGUgcmVhZG9ubHkgb3B0aW9uczogSW5kZXhIdG1sV2VicGFja1BsdWdpbk9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgdGhpcy5fY29tcGlsYXRpb24gPSBjb21waWxhdGlvbjtcbiAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLnByb2Nlc3NBc3NldHMudGFwUHJvbWlzZShcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFBMVUdJTl9OQU1FLFxuICAgICAgICAgIHN0YWdlOiBDb21waWxhdGlvbi5QUk9DRVNTX0FTU0VUU19TVEFHRV9PUFRJTUlaRSArIDEsXG4gICAgICAgIH0sXG4gICAgICAgIGNhbGxiYWNrLFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNhbGxiYWNrID0gYXN5bmMgKGFzc2V0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHtcbiAgICAgIGNvbnN0IGZpbGVzOiBGaWxlSW5mb1tdID0gW107XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgY2h1bmsgb2YgdGhpcy5jb21waWxhdGlvbi5jaHVua3MpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgY2h1bmsuZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLmVuZHNXaXRoKCcuaG90LXVwZGF0ZS5qcycpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaWxlcy5wdXNoKHtcbiAgICAgICAgICAgICAgbmFtZTogY2h1bmsubmFtZSxcbiAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgZXh0ZW5zaW9uOiBleHRuYW1lKGZpbGUpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3Moe1xuICAgICAgICAgIGZpbGVzLFxuICAgICAgICAgIG91dHB1dFBhdGg6IGRpcm5hbWUodGhpcy5vcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgICAgIGJhc2VIcmVmOiB0aGlzLm9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgbGFuZzogdGhpcy5vcHRpb25zLmxhbmcsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFzc2V0c1t0aGlzLm9wdGlvbnMub3V0cHV0UGF0aF0gPSBuZXcgc291cmNlcy5SYXdTb3VyY2UoY29udGVudCk7XG5cbiAgICAgICAgd2FybmluZ3MuZm9yRWFjaCgobXNnKSA9PiBhZGRXYXJuaW5nKHRoaXMuY29tcGlsYXRpb24sIG1zZykpO1xuICAgICAgICBlcnJvcnMuZm9yRWFjaCgobXNnKSA9PiBhZGRFcnJvcih0aGlzLmNvbXBpbGF0aW9uLCBtc2cpKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGFkZEVycm9yKHRoaXMuY29tcGlsYXRpb24sIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyByZWFkQXNzZXQocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5jb21waWxhdGlvbi5hc3NldHNbYmFzZW5hbWUocGF0aCldLnNvdXJjZSgpO1xuXG4gICAgcmV0dXJuIHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkYXRhLnRvU3RyaW5nKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgcmVhZEluZGV4KHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5jb21waWxhdGlvbi5pbnB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoXG4gICAgICAgIHBhdGgsXG4gICAgICAgIChlcnI/OiBFcnJvciB8IG51bGwsIGRhdGE/OiBzdHJpbmcgfCBCdWZmZXIpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY29tcGlsYXRpb24uZmlsZURlcGVuZGVuY2llcy5hZGQocGF0aCk7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhPy50b1N0cmluZygpID8/ICcnKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==