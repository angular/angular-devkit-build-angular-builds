"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferSizePlugin = void 0;
const util_1 = require("util");
const zlib_1 = require("zlib");
const brotliCompressAsync = (0, util_1.promisify)(zlib_1.brotliCompress);
const PLUGIN_NAME = 'angular-transfer-size-estimator';
class TransferSizePlugin {
    constructor() { }
    apply(compiler) {
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
            }, async (compilationAssets) => {
                const actions = [];
                for (const assetName of Object.keys(compilationAssets)) {
                    if (!assetName.endsWith('.js') && !assetName.endsWith('.css')) {
                        continue;
                    }
                    const scriptAsset = compilation.getAsset(assetName);
                    if (!scriptAsset || scriptAsset.source.size() <= 0) {
                        continue;
                    }
                    actions.push(brotliCompressAsync(scriptAsset.source.source())
                        .then((result) => {
                        compilation.updateAsset(assetName, (s) => s, (assetInfo) => ({
                            ...assetInfo,
                            estimatedTransferSize: result.length,
                        }));
                    })
                        .catch((error) => {
                        compilation.warnings.push(new compilation.compiler.webpack.WebpackError(`Unable to calculate estimated transfer size for '${assetName}'. Reason: ${error.message}`));
                    }));
                }
                await Promise.all(actions);
            });
        });
    }
}
exports.TransferSizePlugin = TransferSizePlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmZXItc2l6ZS1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvdHJhbnNmZXItc2l6ZS1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsK0JBQWlDO0FBRWpDLCtCQUFzQztBQUV0QyxNQUFNLG1CQUFtQixHQUFHLElBQUEsZ0JBQVMsRUFBQyxxQkFBYyxDQUFDLENBQUM7QUFFdEQsTUFBTSxXQUFXLEdBQUcsaUNBQWlDLENBQUM7QUFFdEQsTUFBYSxrQkFBa0I7SUFDN0IsZ0JBQWUsQ0FBQztJQUVoQixLQUFLLENBQUMsUUFBa0I7UUFDdEIsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzlELFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDeEM7Z0JBQ0UsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyw0QkFBNEI7YUFDakUsRUFDRCxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNuQixLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsRUFBRTtvQkFDdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO3dCQUM3RCxTQUFTO3FCQUNWO29CQUVELE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3BELElBQUksQ0FBQyxXQUFXLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7d0JBQ2xELFNBQVM7cUJBQ1Y7b0JBRUQsT0FBTyxDQUFDLElBQUksQ0FDVixtQkFBbUIsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO3lCQUM3QyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTt3QkFDZixXQUFXLENBQUMsV0FBVyxDQUNyQixTQUFTLEVBQ1QsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFDUixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQzs0QkFDZCxHQUFHLFNBQVM7NEJBQ1oscUJBQXFCLEVBQUUsTUFBTSxDQUFDLE1BQU07eUJBQ3JDLENBQUMsQ0FDSCxDQUFDO29CQUNKLENBQUMsQ0FBQzt5QkFDRCxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTt3QkFDZixXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FDdkIsSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQzNDLG9EQUFvRCxTQUFTLGNBQWMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUMzRixDQUNGLENBQUM7b0JBQ0osQ0FBQyxDQUFDLENBQ0wsQ0FBQztpQkFDSDtnQkFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0IsQ0FBQyxDQUNGLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWpERCxnREFpREMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgYnJvdGxpQ29tcHJlc3MgfSBmcm9tICd6bGliJztcblxuY29uc3QgYnJvdGxpQ29tcHJlc3NBc3luYyA9IHByb21pc2lmeShicm90bGlDb21wcmVzcyk7XG5cbmNvbnN0IFBMVUdJTl9OQU1FID0gJ2FuZ3VsYXItdHJhbnNmZXItc2l6ZS1lc3RpbWF0b3InO1xuXG5leHBvcnQgY2xhc3MgVHJhbnNmZXJTaXplUGx1Z2luIHtcbiAgY29uc3RydWN0b3IoKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29tcGlsYXRpb24uaG9va3MucHJvY2Vzc0Fzc2V0cy50YXBQcm9taXNlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IGNvbXBpbGVyLndlYnBhY2suQ29tcGlsYXRpb24uUFJPQ0VTU19BU1NFVFNfU1RBR0VfQU5BTFlTRSxcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgKGNvbXBpbGF0aW9uQXNzZXRzKSA9PiB7XG4gICAgICAgICAgY29uc3QgYWN0aW9ucyA9IFtdO1xuICAgICAgICAgIGZvciAoY29uc3QgYXNzZXROYW1lIG9mIE9iamVjdC5rZXlzKGNvbXBpbGF0aW9uQXNzZXRzKSkge1xuICAgICAgICAgICAgaWYgKCFhc3NldE5hbWUuZW5kc1dpdGgoJy5qcycpICYmICFhc3NldE5hbWUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0QXNzZXQgPSBjb21waWxhdGlvbi5nZXRBc3NldChhc3NldE5hbWUpO1xuICAgICAgICAgICAgaWYgKCFzY3JpcHRBc3NldCB8fCBzY3JpcHRBc3NldC5zb3VyY2Uuc2l6ZSgpIDw9IDApIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFjdGlvbnMucHVzaChcbiAgICAgICAgICAgICAgYnJvdGxpQ29tcHJlc3NBc3luYyhzY3JpcHRBc3NldC5zb3VyY2Uuc291cmNlKCkpXG4gICAgICAgICAgICAgICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQoXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgKHMpID0+IHMsXG4gICAgICAgICAgICAgICAgICAgIChhc3NldEluZm8pID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgIGVzdGltYXRlZFRyYW5zZmVyU2l6ZTogcmVzdWx0Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24ud2FybmluZ3MucHVzaChcbiAgICAgICAgICAgICAgICAgICAgbmV3IGNvbXBpbGF0aW9uLmNvbXBpbGVyLndlYnBhY2suV2VicGFja0Vycm9yKFxuICAgICAgICAgICAgICAgICAgICAgIGBVbmFibGUgdG8gY2FsY3VsYXRlIGVzdGltYXRlZCB0cmFuc2ZlciBzaXplIGZvciAnJHthc3NldE5hbWV9Jy4gUmVhc29uOiAke2Vycm9yLm1lc3NhZ2V9YCxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKGFjdGlvbnMpO1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxufVxuIl19