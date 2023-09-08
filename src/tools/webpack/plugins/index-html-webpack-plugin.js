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
const error_1 = require("../../../utils/error");
const index_html_generator_1 = require("../../../utils/index-file/index-html-generator");
const webpack_diagnostics_1 = require("../../../utils/webpack-diagnostics");
const PLUGIN_NAME = 'index-html-webpack-plugin';
class IndexHtmlWebpackPlugin extends index_html_generator_1.IndexHtmlGenerator {
    options;
    _compilation;
    get compilation() {
        if (this._compilation) {
            return this._compilation;
        }
        throw new Error('compilation is undefined.');
    }
    constructor(options) {
        super(options);
        this.options = options;
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
                        // https://github.com/webpack/webpack/blob/1f99ad6367f2b8a6ef17cce0e058f7a67fb7db18/lib/config/defaults.js#L1000
                        if (file.endsWith('.hot-update.js') || file.endsWith('.hot-update.mjs')) {
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
                (0, error_1.assertIsError)(error);
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
                if (err) {
                    reject(err);
                    return;
                }
                this.compilation.fileDependencies.add(path);
                resolve(data?.toString() ?? '');
            });
        });
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL3dlYnBhY2svcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtCQUFrRDtBQUNsRCxxQ0FBeUQ7QUFDekQsZ0RBQXFEO0FBRXJELHlGQUl3RDtBQUN4RCw0RUFBMEU7QUFNMUUsTUFBTSxXQUFXLEdBQUcsMkJBQTJCLENBQUM7QUFDaEQsTUFBYSxzQkFBdUIsU0FBUSx5Q0FBa0I7SUFVOUI7SUFUdEIsWUFBWSxDQUEwQjtJQUM5QyxJQUFJLFdBQVc7UUFDYixJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDckIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO1NBQzFCO1FBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCxZQUE4QixPQUFzQztRQUNsRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFEYSxZQUFPLEdBQVAsT0FBTyxDQUErQjtJQUVwRSxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUM5RCxJQUFJLENBQUMsWUFBWSxHQUFHLFdBQVcsQ0FBQztZQUNoQyxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQ3hDO2dCQUNFLElBQUksRUFBRSxXQUFXO2dCQUNqQixLQUFLLEVBQUUscUJBQVcsQ0FBQyw2QkFBNkIsR0FBRyxDQUFDO2FBQ3JELEVBQ0QsUUFBUSxDQUNULENBQUM7UUFDSixDQUFDLENB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LENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdEZELHdEQXNGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29tcGlsYXRpb24sIENvbXBpbGVyLCBzb3VyY2VzIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQge1xuICBJbmRleEh0bWxHZW5lcmF0b3IsXG4gIEluZGV4SHRtbEdlbmVyYXRvck9wdGlvbnMsXG4gIEluZGV4SHRtbEdlbmVyYXRvclByb2Nlc3NPcHRpb25zLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGFkZEVycm9yLCBhZGRXYXJuaW5nIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kZXhIdG1sV2VicGFja1BsdWdpbk9wdGlvbnNcbiAgZXh0ZW5kcyBJbmRleEh0bWxHZW5lcmF0b3JPcHRpb25zLFxuICAgIE9taXQ8SW5kZXhIdG1sR2VuZXJhdG9yUHJvY2Vzc09wdGlvbnMsICdmaWxlcyc+IHt9XG5cbmNvbnN0IFBMVUdJTl9OQU1FID0gJ2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuZXhwb3J0IGNsYXNzIEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gZXh0ZW5kcyBJbmRleEh0bWxHZW5lcmF0b3Ige1xuICBwcml2YXRlIF9jb21waWxhdGlvbjogQ29tcGlsYXRpb24gfCB1bmRlZmluZWQ7XG4gIGdldCBjb21waWxhdGlvbigpOiBDb21waWxhdGlvbiB7XG4gICAgaWYgKHRoaXMuX2NvbXBpbGF0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY29tcGlsYXRpb247XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb21waWxhdGlvbiBpcyB1bmRlZmluZWQuJyk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihvdmVycmlkZSByZWFkb25seSBvcHRpb25zOiBJbmRleEh0bWxXZWJwYWNrUGx1Z2luT3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICB0aGlzLl9jb21waWxhdGlvbiA9IGNvbXBpbGF0aW9uO1xuICAgICAgY29tcGlsYXRpb24uaG9va3MucHJvY2Vzc0Fzc2V0cy50YXBQcm9taXNlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IENvbXBpbGF0aW9uLlBST0NFU1NfQVNTRVRTX1NUQUdFX09QVElNSVpFICsgMSxcbiAgICAgICAgfSxcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgY29uc3QgY2FsbGJhY2sgPSBhc3luYyAoYXNzZXRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4ge1xuICAgICAgY29uc3QgZmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgZm9yIChjb25zdCBjaHVuayBvZiB0aGlzLmNvbXBpbGF0aW9uLmNodW5rcykge1xuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBjaHVuay5maWxlcykge1xuICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9ibG9iLzFmOTlhZDYzNjdmMmI4YTZlZjE3Y2NlMGUwNThmN2E2N2ZiN2RiMTgvbGliL2NvbmZpZy9kZWZhdWx0cy5qcyNMMTAwMFxuICAgICAgICAgICAgaWYgKGZpbGUuZW5kc1dpdGgoJy5ob3QtdXBkYXRlLmpzJykgfHwgZmlsZS5lbmRzV2l0aCgnLmhvdC11cGRhdGUubWpzJykpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbGVzLnB1c2goe1xuICAgICAgICAgICAgICBuYW1lOiBjaHVuay5uYW1lLFxuICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICBleHRlbnNpb246IGV4dG5hbWUoZmlsZSksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IHRoaXMucHJvY2Vzcyh7XG4gICAgICAgICAgZmlsZXMsXG4gICAgICAgICAgb3V0cHV0UGF0aDogZGlybmFtZSh0aGlzLm9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICAgICAgYmFzZUhyZWY6IHRoaXMub3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICBsYW5nOiB0aGlzLm9wdGlvbnMubGFuZyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXNzZXRzW3RoaXMub3B0aW9ucy5vdXRwdXRQYXRoXSA9IG5ldyBzb3VyY2VzLlJhd1NvdXJjZShjb250ZW50KTtcblxuICAgICAgICB3YXJuaW5ncy5mb3JFYWNoKChtc2cpID0+IGFkZFdhcm5pbmcodGhpcy5jb21waWxhdGlvbiwgbXNnKSk7XG4gICAgICAgIGVycm9ycy5mb3JFYWNoKChtc2cpID0+IGFkZEVycm9yKHRoaXMuY29tcGlsYXRpb24sIG1zZykpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG4gICAgICAgIGFkZEVycm9yKHRoaXMuY29tcGlsYXRpb24sIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyByZWFkQXNzZXQocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5jb21waWxhdGlvbi5hc3NldHNbYmFzZW5hbWUocGF0aCldLnNvdXJjZSgpO1xuXG4gICAgcmV0dXJuIHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkYXRhLnRvU3RyaW5nKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgcmVhZEluZGV4KHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5jb21waWxhdGlvbi5pbnB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoXG4gICAgICAgIHBhdGgsXG4gICAgICAgIChlcnI/OiBFcnJvciB8IG51bGwsIGRhdGE/OiBzdHJpbmcgfCBCdWZmZXIpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY29tcGlsYXRpb24uZmlsZURlcGVuZGVuY2llcy5hZGQocGF0aCk7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhPy50b1N0cmluZygpID8/ICcnKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==