"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassPlugin = void 0;
const sass_service_1 = require("../../sass/sass-service");
function createSassPlugin(options) {
    return {
        name: 'angular-sass',
        setup(build) {
            let sass;
            build.onStart(() => {
                sass = new sass_service_1.SassWorkerImplementation();
            });
            build.onEnd(() => {
                sass === null || sass === void 0 ? void 0 : sass.close();
            });
            build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                const result = await new Promise((resolve, reject) => {
                    sass.render({
                        file: args.path,
                        includePaths: options.includePaths,
                        indentedSyntax: args.path.endsWith('.sass'),
                        outputStyle: 'expanded',
                        sourceMap: options.sourcemap,
                        sourceMapContents: options.sourcemap,
                        sourceMapEmbed: options.sourcemap,
                        quietDeps: true,
                    }, (error, result) => {
                        if (error) {
                            reject(error);
                        }
                        if (result) {
                            resolve(result);
                        }
                    });
                });
                return {
                    contents: result.css,
                    loader: 'css',
                    watchFiles: result.stats.includedFiles,
                };
            });
        },
    };
}
exports.createSassPlugin = createSassPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUgsMERBQW1FO0FBRW5FLFNBQWdCLGdCQUFnQixDQUFDLE9BQXdEO0lBQ3ZGLE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIsSUFBSSxJQUE4QixDQUFDO1lBRW5DLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO2dCQUNqQixJQUFJLEdBQUcsSUFBSSx1Q0FBd0IsRUFBRSxDQUFDO1lBQ3hDLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUU7Z0JBQ2YsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLEtBQUssRUFBRSxDQUFDO1lBQ2hCLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3BELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQWUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7b0JBQ2pFLElBQUksQ0FBQyxNQUFNLENBQ1Q7d0JBQ0UsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLFlBQVksRUFBRSxPQUFPLENBQUMsWUFBWTt3QkFDbEMsY0FBYyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQzt3QkFDM0MsV0FBVyxFQUFFLFVBQVU7d0JBQ3ZCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUzt3QkFDNUIsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLFNBQVM7d0JBQ3BDLGNBQWMsRUFBRSxPQUFPLENBQUMsU0FBUzt3QkFDakMsU0FBUyxFQUFFLElBQUk7cUJBQ2hCLEVBQ0QsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUU7d0JBQ2hCLElBQUksS0FBSyxFQUFFOzRCQUNULE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQzt5QkFDZjt3QkFDRCxJQUFJLE1BQU0sRUFBRTs0QkFDVixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7eUJBQ2pCO29CQUNILENBQUMsQ0FDRixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUVILE9BQU87b0JBQ0wsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHO29CQUNwQixNQUFNLEVBQUUsS0FBSztvQkFDYixVQUFVLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhO2lCQUN2QyxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUE5Q0QsNENBOENDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBMZWdhY3lSZXN1bHQgfSBmcm9tICdzYXNzJztcbmltcG9ydCB7IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogeyBzb3VyY2VtYXA6IGJvb2xlYW47IGluY2x1ZGVQYXRocz86IHN0cmluZ1tdIH0pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgbGV0IHNhc3M6IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbjtcblxuICAgICAgYnVpbGQub25TdGFydCgoKSA9PiB7XG4gICAgICAgIHNhc3MgPSBuZXcgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKCk7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25FbmQoKCkgPT4ge1xuICAgICAgICBzYXNzPy5jbG9zZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLnNbYWNdc3MkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZTxMZWdhY3lSZXN1bHQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBzYXNzLnJlbmRlcihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZmlsZTogYXJncy5wYXRoLFxuICAgICAgICAgICAgICBpbmNsdWRlUGF0aHM6IG9wdGlvbnMuaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgICBpbmRlbnRlZFN5bnRheDogYXJncy5wYXRoLmVuZHNXaXRoKCcuc2FzcycpLFxuICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgICAgc291cmNlTWFwQ29udGVudHM6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgICBzb3VyY2VNYXBFbWJlZDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogcmVzdWx0LmNzcyxcbiAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgIHdhdGNoRmlsZXM6IHJlc3VsdC5zdGF0cy5pbmNsdWRlZEZpbGVzLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==