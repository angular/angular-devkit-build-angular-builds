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
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
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
                        contents: sourceMap
                            ? `${css}\n${sourceMapToUrlComment(sourceMap, (0, node_path_1.dirname)(args.path))}`
                            : css,
                        watchFiles: loadedUrls.map((url) => (0, node_url_1.fileURLToPath)(url)),
                        warnings,
                    };
                }
                catch (error) {
                    if (error instanceof sass.Exception) {
                        const file = error.span.url ? (0, node_url_1.fileURLToPath)(error.span.url) : undefined;
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
function sourceMapToUrlComment(sourceMap, root) {
    // Remove `file` protocol from all sourcemap sources and adjust to be relative to the input file.
    // This allows esbuild to correctly process the paths.
    sourceMap.sources = sourceMap.sources.map((source) => (0, node_path_1.relative)(root, (0, node_url_1.fileURLToPath)(source)));
    const urlSourceMap = Buffer.from(JSON.stringify(sourceMap), 'utf-8').toString('base64');
    return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap} */`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCx5Q0FBOEM7QUFDOUMsdUNBQXlDO0FBR3pDLFNBQWdCLGdCQUFnQixDQUFDLE9BQXFEO0lBQ3BGLE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIsSUFBSSxJQUEyQixDQUFDO1lBRWhDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO2dCQUNwRCw2Q0FBNkM7Z0JBQzdDLElBQUksYUFBSixJQUFJLGNBQUosSUFBSSxJQUFKLElBQUksR0FBSyx3REFBYSxNQUFNLEdBQUMsRUFBQztnQkFFOUIsSUFBSTtvQkFDRixNQUFNLFFBQVEsR0FBcUIsRUFBRSxDQUFDO29CQUN0QywrQ0FBK0M7b0JBQy9DLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTt3QkFDN0QsS0FBSyxFQUFFLFVBQVU7d0JBQ2pCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUzt3QkFDNUIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO3dCQUM1Qix1QkFBdUIsRUFBRSxPQUFPLENBQUMsU0FBUzt3QkFDMUMsU0FBUyxFQUFFLElBQUk7d0JBQ2YsTUFBTSxFQUFFOzRCQUNOLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRTtnQ0FDdkIsUUFBUSxDQUFDLElBQUksQ0FBQztvQ0FDWixJQUFJO2lDQUNMLENBQUMsQ0FBQzs0QkFDTCxDQUFDO3lCQUNGO3FCQUNGLENBQUMsQ0FBQztvQkFFSCxPQUFPO3dCQUNMLE1BQU0sRUFBRSxLQUFLO3dCQUNiLFFBQVEsRUFBRSxTQUFTOzRCQUNqQixDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUsscUJBQXFCLENBQUMsU0FBUyxFQUFFLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRTs0QkFDbkUsQ0FBQyxDQUFDLEdBQUc7d0JBQ1AsVUFBVSxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUEsd0JBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQzt3QkFDdkQsUUFBUTtxQkFDVCxDQUFDO2lCQUNIO2dCQUFDLE9BQU8sS0FBSyxFQUFFO29CQUNkLElBQUksS0FBSyxZQUFZLElBQUksQ0FBQyxTQUFTLEVBQUU7d0JBQ25DLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLHdCQUFhLEVBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUV4RSxPQUFPOzRCQUNMLE1BQU0sRUFBRSxLQUFLOzRCQUNiLE1BQU0sRUFBRTtnQ0FDTjtvQ0FDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRTtpQ0FDdkI7NkJBQ0Y7NEJBQ0QsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUzt5QkFDdEMsQ0FBQztxQkFDSDtvQkFFRCxNQUFNLEtBQUssQ0FBQztpQkFDYjtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBeERELDRDQXdEQztBQUVELFNBQVMscUJBQXFCLENBQzVCLFNBQXlELEVBQ3pELElBQVk7SUFFWixpR0FBaUc7SUFDakcsc0RBQXNEO0lBQ3RELFNBQVMsQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUEsb0JBQVEsRUFBQyxJQUFJLEVBQUUsSUFBQSx3QkFBYSxFQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU3RixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhGLE9BQU8sbUVBQW1FLFlBQVksS0FBSyxDQUFDO0FBQzlGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQYXJ0aWFsTWVzc2FnZSwgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgZGlybmFtZSwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCB9IGZyb20gJ3Nhc3MnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2Fzc1BsdWdpbihvcHRpb25zOiB7IHNvdXJjZW1hcDogYm9vbGVhbjsgbG9hZFBhdGhzPzogc3RyaW5nW10gfSk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItc2FzcycsXG4gICAgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogdm9pZCB7XG4gICAgICBsZXQgc2FzczogdHlwZW9mIGltcG9ydCgnc2FzcycpO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5zW2FjXXNzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgLy8gTGF6aWx5IGxvYWQgU2FzcyB3aGVuIGEgU2FzcyBmaWxlIGlzIGZvdW5kXG4gICAgICAgIHNhc3MgPz89IGF3YWl0IGltcG9ydCgnc2FzcycpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3Qgd2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gPSBbXTtcbiAgICAgICAgICAvLyBVc2Ugc3luYyB2ZXJzaW9uIGFzIGFzeW5jIHZlcnNpb24gaXMgc2xvd2VyLlxuICAgICAgICAgIGNvbnN0IHsgY3NzLCBzb3VyY2VNYXAsIGxvYWRlZFVybHMgfSA9IHNhc3MuY29tcGlsZShhcmdzLnBhdGgsIHtcbiAgICAgICAgICAgIHN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgICAgbG9hZFBhdGhzOiBvcHRpb25zLmxvYWRQYXRocyxcbiAgICAgICAgICAgIHNvdXJjZU1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBzb3VyY2VNYXBJbmNsdWRlU291cmNlczogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBxdWlldERlcHM6IHRydWUsXG4gICAgICAgICAgICBsb2dnZXI6IHtcbiAgICAgICAgICAgICAgd2FybjogKHRleHQsIF9vcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgICB0ZXh0LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgICAgY29udGVudHM6IHNvdXJjZU1hcFxuICAgICAgICAgICAgICA/IGAke2Nzc31cXG4ke3NvdXJjZU1hcFRvVXJsQ29tbWVudChzb3VyY2VNYXAsIGRpcm5hbWUoYXJncy5wYXRoKSl9YFxuICAgICAgICAgICAgICA6IGNzcyxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHNhc3MuRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KFxuICBzb3VyY2VNYXA6IEV4Y2x1ZGU8Q29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10sIHVuZGVmaW5lZD4sXG4gIHJvb3Q6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIC8vIFJlbW92ZSBgZmlsZWAgcHJvdG9jb2wgZnJvbSBhbGwgc291cmNlbWFwIHNvdXJjZXMgYW5kIGFkanVzdCB0byBiZSByZWxhdGl2ZSB0byB0aGUgaW5wdXQgZmlsZS5cbiAgLy8gVGhpcyBhbGxvd3MgZXNidWlsZCB0byBjb3JyZWN0bHkgcHJvY2VzcyB0aGUgcGF0aHMuXG4gIHNvdXJjZU1hcC5zb3VyY2VzID0gc291cmNlTWFwLnNvdXJjZXMubWFwKChzb3VyY2UpID0+IHJlbGF0aXZlKHJvb3QsIGZpbGVVUkxUb1BhdGgoc291cmNlKSkpO1xuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19