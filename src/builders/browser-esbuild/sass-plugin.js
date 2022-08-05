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
            build.onStart(async () => {
                // Lazily load Sass
                sass = await Promise.resolve().then(() => __importStar(require('sass')));
            });
            build.onLoad({ filter: /\.s[ac]ss$/ }, (args) => {
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
                        contents: css + sourceMapToUrlComment(sourceMap),
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
    if (!sourceMap) {
        return '';
    }
    const urlSourceMap = Buffer.from(JSON.stringify(sourceMap), 'utf-8').toString('base64');
    return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw2QkFBb0M7QUFFcEMsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBcUQ7SUFDcEYsT0FBTztRQUNMLElBQUksRUFBRSxjQUFjO1FBQ3BCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixJQUFJLElBQTJCLENBQUM7WUFFaEMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDdkIsbUJBQW1CO2dCQUNuQixJQUFJLEdBQUcsd0RBQWEsTUFBTSxHQUFDLENBQUM7WUFDOUIsQ0FBQyxDQUFDLENBQUM7WUFFSCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQzlDLElBQUk7b0JBQ0YsTUFBTSxRQUFRLEdBQXFCLEVBQUUsQ0FBQztvQkFDdEMsK0NBQStDO29CQUMvQyxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7d0JBQzdELEtBQUssRUFBRSxVQUFVO3dCQUNqQixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7d0JBQzVCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUzt3QkFDNUIsdUJBQXVCLEVBQUUsT0FBTyxDQUFDLFNBQVM7d0JBQzFDLFNBQVMsRUFBRSxJQUFJO3dCQUNmLE1BQU0sRUFBRTs0QkFDTixJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUU7Z0NBQ3ZCLFFBQVEsQ0FBQyxJQUFJLENBQUM7b0NBQ1osSUFBSTtpQ0FDTCxDQUFDLENBQUM7NEJBQ0wsQ0FBQzt5QkFDRjtxQkFDRixDQUFDLENBQUM7b0JBRUgsT0FBTzt3QkFDTCxNQUFNLEVBQUUsS0FBSzt3QkFDYixRQUFRLEVBQUUsR0FBRyxHQUFHLHFCQUFxQixDQUFDLFNBQVMsQ0FBQzt3QkFDaEQsVUFBVSxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUEsbUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQzt3QkFDdkQsUUFBUTtxQkFDVCxDQUFDO2lCQUNIO2dCQUFDLE9BQU8sS0FBSyxFQUFFO29CQUNkLElBQUksS0FBSyxZQUFZLElBQUksQ0FBQyxTQUFTLEVBQUU7d0JBQ25DLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUV4RSxPQUFPOzRCQUNMLE1BQU0sRUFBRSxLQUFLOzRCQUNiLE1BQU0sRUFBRTtnQ0FDTjtvQ0FDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRTtpQ0FDdkI7NkJBQ0Y7NEJBQ0QsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUzt5QkFDdEMsQ0FBQztxQkFDSDtvQkFFRCxNQUFNLEtBQUssQ0FBQztpQkFDYjtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBeERELDRDQXdEQztBQUVELFNBQVMscUJBQXFCLENBQUMsU0FBcUM7SUFDbEUsSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNkLE9BQU8sRUFBRSxDQUFDO0tBQ1g7SUFFRCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhGLE9BQU8sbUVBQW1FLFlBQVksRUFBRSxDQUFDO0FBQzNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQYXJ0aWFsTWVzc2FnZSwgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlUmVzdWx0IH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAndXJsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogeyBzb3VyY2VtYXA6IGJvb2xlYW47IGxvYWRQYXRocz86IHN0cmluZ1tdIH0pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgbGV0IHNhc3M6IHR5cGVvZiBpbXBvcnQoJ3Nhc3MnKTtcblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIExhemlseSBsb2FkIFNhc3NcbiAgICAgICAgc2FzcyA9IGF3YWl0IGltcG9ydCgnc2FzcycpO1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLnNbYWNdc3MkLyB9LCAoYXJncykgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdID0gW107XG4gICAgICAgICAgLy8gVXNlIHN5bmMgdmVyc2lvbiBhcyBhc3luYyB2ZXJzaW9uIGlzIHNsb3dlci5cbiAgICAgICAgICBjb25zdCB7IGNzcywgc291cmNlTWFwLCBsb2FkZWRVcmxzIH0gPSBzYXNzLmNvbXBpbGUoYXJncy5wYXRoLCB7XG4gICAgICAgICAgICBzdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgIGxvYWRQYXRoczogb3B0aW9ucy5sb2FkUGF0aHMsXG4gICAgICAgICAgICBzb3VyY2VNYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgc291cmNlTWFwSW5jbHVkZVNvdXJjZXM6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgcXVpZXREZXBzOiB0cnVlLFxuICAgICAgICAgICAgbG9nZ2VyOiB7XG4gICAgICAgICAgICAgIHdhcm46ICh0ZXh0LCBfb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgdGV4dCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgIGNvbnRlbnRzOiBjc3MgKyBzb3VyY2VNYXBUb1VybENvbW1lbnQoc291cmNlTWFwKSxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHNhc3MuRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcDogQ29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10pOiBzdHJpbmcge1xuICBpZiAoIXNvdXJjZU1hcCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH1gO1xufVxuIl19