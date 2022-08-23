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
exports.createSassPlugin = void 0;
const url_1 = require("url");
function createSassPlugin(options) {
    return {
        name: 'angular-sass',
        setup(build) {
            let sass;
            build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                // Lazily load Sass when a Sass file is found
                sass !== null && sass !== void 0 ? sass : (sass = await Promise.resolve().then(() => __importStar(require('sass'))));
                try {
                    const warnings = [];
                    // Use sync version as async version is slower.
                    const { css, sourceMap, loadedUrls } = sass.compile(args.path, {
                        style: 'expanded',
                        loadPaths: options.loadPaths,
                        sourceMap: options.sourcemap,
                        sourceMapIncludeSources: options.sourcemap,
                        quietDeps: true,
                        logger: {
                            warn: (text, _options) => {
                                warnings.push({
                                    text,
                                });
                            },
                        },
                    });
                    return {
                        loader: 'css',
                        contents: sourceMap ? `${css}\n${sourceMapToUrlComment(sourceMap)}` : css,
                        watchFiles: loadedUrls.map((url) => (0, url_1.fileURLToPath)(url)),
                        warnings,
                    };
                }
                catch (error) {
                    if (error instanceof sass.Exception) {
                        const file = error.span.url ? (0, url_1.fileURLToPath)(error.span.url) : undefined;
                        return {
                            loader: 'css',
                            errors: [
                                {
                                    text: error.toString(),
                                },
                            ],
                            watchFiles: file ? [file] : undefined,
                        };
                    }
                    throw error;
                }
            });
        },
    };
}
exports.createSassPlugin = createSassPlugin;
function sourceMapToUrlComment(sourceMap) {
    const urlSourceMap = Buffer.from(JSON.stringify(sourceMap), 'utf-8').toString('base64');
    return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap} */`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw2QkFBb0M7QUFFcEMsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBcUQ7SUFDcEYsT0FBTztRQUNMLElBQUksRUFBRSxjQUFjO1FBQ3BCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixJQUFJLElBQTJCLENBQUM7WUFFaEMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3BELDZDQUE2QztnQkFDN0MsSUFBSSxhQUFKLElBQUksY0FBSixJQUFJLElBQUosSUFBSSxHQUFLLHdEQUFhLE1BQU0sR0FBQyxFQUFDO2dCQUU5QixJQUFJO29CQUNGLE1BQU0sUUFBUSxHQUFxQixFQUFFLENBQUM7b0JBQ3RDLCtDQUErQztvQkFDL0MsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO3dCQUM3RCxLQUFLLEVBQUUsVUFBVTt3QkFDakIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO3dCQUM1QixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7d0JBQzVCLHVCQUF1QixFQUFFLE9BQU8sQ0FBQyxTQUFTO3dCQUMxQyxTQUFTLEVBQUUsSUFBSTt3QkFDZixNQUFNLEVBQUU7NEJBQ04sSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFO2dDQUN2QixRQUFRLENBQUMsSUFBSSxDQUFDO29DQUNaLElBQUk7aUNBQ0wsQ0FBQyxDQUFDOzRCQUNMLENBQUM7eUJBQ0Y7cUJBQ0YsQ0FBQyxDQUFDO29CQUVILE9BQU87d0JBQ0wsTUFBTSxFQUFFLEtBQUs7d0JBQ2IsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUsscUJBQXFCLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRzt3QkFDekUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUEsbUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQzt3QkFDdkQsUUFBUTtxQkFDVCxDQUFDO2lCQUNIO2dCQUFDLE9BQU8sS0FBSyxFQUFFO29CQUNkLElBQUksS0FBSyxZQUFZLElBQUksQ0FBQyxTQUFTLEVBQUU7d0JBQ25DLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUV4RSxPQUFPOzRCQUNMLE1BQU0sRUFBRSxLQUFLOzRCQUNiLE1BQU0sRUFBRTtnQ0FDTjtvQ0FDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRTtpQ0FDdkI7NkJBQ0Y7NEJBQ0QsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUzt5QkFDdEMsQ0FBQztxQkFDSDtvQkFFRCxNQUFNLEtBQUssQ0FBQztpQkFDYjtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBdERELDRDQXNEQztBQUVELFNBQVMscUJBQXFCLENBQUMsU0FBeUQ7SUFDdEYsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV4RixPQUFPLG1FQUFtRSxZQUFZLEtBQUssQ0FBQztBQUM5RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgUGFydGlhbE1lc3NhZ2UsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTYXNzUGx1Z2luKG9wdGlvbnM6IHsgc291cmNlbWFwOiBib29sZWFuOyBsb2FkUGF0aHM/OiBzdHJpbmdbXSB9KTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1zYXNzJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGxldCBzYXNzOiB0eXBlb2YgaW1wb3J0KCdzYXNzJyk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLnNbYWNdc3MkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAvLyBMYXppbHkgbG9hZCBTYXNzIHdoZW4gYSBTYXNzIGZpbGUgaXMgZm91bmRcbiAgICAgICAgc2FzcyA/Pz0gYXdhaXQgaW1wb3J0KCdzYXNzJyk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICAgICAgICAgIC8vIFVzZSBzeW5jIHZlcnNpb24gYXMgYXN5bmMgdmVyc2lvbiBpcyBzbG93ZXIuXG4gICAgICAgICAgY29uc3QgeyBjc3MsIHNvdXJjZU1hcCwgbG9hZGVkVXJscyB9ID0gc2Fzcy5jb21waWxlKGFyZ3MucGF0aCwge1xuICAgICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgICAgICAgIGxvZ2dlcjoge1xuICAgICAgICAgICAgICB3YXJuOiAodGV4dCwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIHRleHQsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICBjb250ZW50czogc291cmNlTWFwID8gYCR7Y3NzfVxcbiR7c291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcCl9YCA6IGNzcyxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHNhc3MuRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcDogRXhjbHVkZTxDb21waWxlUmVzdWx0Wydzb3VyY2VNYXAnXSwgdW5kZWZpbmVkPik6IHN0cmluZyB7XG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19