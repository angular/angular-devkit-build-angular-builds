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
                        contents: `${css}\n${sourceMapToUrlComment(sourceMap)}`,
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
    return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap} */`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw2QkFBb0M7QUFFcEMsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBcUQ7SUFDcEYsT0FBTztRQUNMLElBQUksRUFBRSxjQUFjO1FBQ3BCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixJQUFJLElBQTJCLENBQUM7WUFFaEMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDdkIsbUJBQW1CO2dCQUNuQixJQUFJLEdBQUcsd0RBQWEsTUFBTSxHQUFDLENBQUM7WUFDOUIsQ0FBQyxDQUFDLENBQUM7WUFFSCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQzlDLElBQUk7b0JBQ0YsTUFBTSxRQUFRLEdBQXFCLEVBQUUsQ0FBQztvQkFDdEMsK0NBQStDO29CQUMvQyxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7d0JBQzdELEtBQUssRUFBRSxVQUFVO3dCQUNqQixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7d0JBQzVCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUzt3QkFDNUIsdUJBQXVCLEVBQUUsT0FBTyxDQUFDLFNBQVM7d0JBQzFDLFNBQVMsRUFBRSxJQUFJO3dCQUNmLE1BQU0sRUFBRTs0QkFDTixJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUU7Z0NBQ3ZCLFFBQVEsQ0FBQyxJQUFJLENBQUM7b0NBQ1osSUFBSTtpQ0FDTCxDQUFDLENBQUM7NEJBQ0wsQ0FBQzt5QkFDRjtxQkFDRixDQUFDLENBQUM7b0JBRUgsT0FBTzt3QkFDTCxNQUFNLEVBQUUsS0FBSzt3QkFDYixRQUFRLEVBQUUsR0FBRyxHQUFHLEtBQUsscUJBQXFCLENBQUMsU0FBUyxDQUFDLEVBQUU7d0JBQ3ZELFVBQVUsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ3ZELFFBQVE7cUJBQ1QsQ0FBQztpQkFDSDtnQkFBQyxPQUFPLEtBQUssRUFBRTtvQkFDZCxJQUFJLEtBQUssWUFBWSxJQUFJLENBQUMsU0FBUyxFQUFFO3dCQUNuQyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBQSxtQkFBYSxFQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQzt3QkFFeEUsT0FBTzs0QkFDTCxNQUFNLEVBQUUsS0FBSzs0QkFDYixNQUFNLEVBQUU7Z0NBQ047b0NBQ0UsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRLEVBQUU7aUNBQ3ZCOzZCQUNGOzRCQUNELFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7eUJBQ3RDLENBQUM7cUJBQ0g7b0JBRUQsTUFBTSxLQUFLLENBQUM7aUJBQ2I7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXhERCw0Q0F3REM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLFNBQXFDO0lBQ2xFLElBQUksQ0FBQyxTQUFTLEVBQUU7UUFDZCxPQUFPLEVBQUUsQ0FBQztLQUNYO0lBRUQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV4RixPQUFPLG1FQUFtRSxZQUFZLEtBQUssQ0FBQztBQUM5RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgUGFydGlhbE1lc3NhZ2UsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTYXNzUGx1Z2luKG9wdGlvbnM6IHsgc291cmNlbWFwOiBib29sZWFuOyBsb2FkUGF0aHM/OiBzdHJpbmdbXSB9KTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1zYXNzJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGxldCBzYXNzOiB0eXBlb2YgaW1wb3J0KCdzYXNzJyk7XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBMYXppbHkgbG9hZCBTYXNzXG4gICAgICAgIHNhc3MgPSBhd2FpdCBpbXBvcnQoJ3Nhc3MnKTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5zW2FjXXNzJC8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICAgICAgICAgIC8vIFVzZSBzeW5jIHZlcnNpb24gYXMgYXN5bmMgdmVyc2lvbiBpcyBzbG93ZXIuXG4gICAgICAgICAgY29uc3QgeyBjc3MsIHNvdXJjZU1hcCwgbG9hZGVkVXJscyB9ID0gc2Fzcy5jb21waWxlKGFyZ3MucGF0aCwge1xuICAgICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgICAgICAgIGxvZ2dlcjoge1xuICAgICAgICAgICAgICB3YXJuOiAodGV4dCwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIHRleHQsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICBjb250ZW50czogYCR7Y3NzfVxcbiR7c291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcCl9YCxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHNhc3MuRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcDogQ29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10pOiBzdHJpbmcge1xuICBpZiAoIXNvdXJjZU1hcCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19