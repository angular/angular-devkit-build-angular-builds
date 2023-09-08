"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StylesWebpackPlugin = void 0;
const assert_1 = __importDefault(require("assert"));
const error_1 = require("../../../utils/error");
const webpack_diagnostics_1 = require("../../../utils/webpack-diagnostics");
/**
 * The name of the plugin provided to Webpack when tapping Webpack compiler hooks.
 */
const PLUGIN_NAME = 'styles-webpack-plugin';
class StylesWebpackPlugin {
    options;
    compilation;
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        const { entryPoints, preserveSymlinks, root } = this.options;
        const resolver = compiler.resolverFactory.get('global-styles', {
            conditionNames: ['sass', 'less', 'style'],
            mainFields: ['sass', 'less', 'style', 'main', '...'],
            extensions: ['.scss', '.sass', '.less', '.css'],
            restrictions: [/\.((le|sa|sc|c)ss)$/i],
            preferRelative: true,
            useSyncFileSystemCalls: true,
            symlinks: !preserveSymlinks,
            fileSystem: compiler.inputFileSystem,
        });
        const webpackOptions = compiler.options;
        compiler.hooks.environment.tap(PLUGIN_NAME, () => {
            const entry = typeof webpackOptions.entry === 'function' ? webpackOptions.entry() : webpackOptions.entry;
            webpackOptions.entry = async () => {
                const entrypoints = await entry;
                for (const [bundleName, paths] of Object.entries(entryPoints)) {
                    entrypoints[bundleName] ??= {};
                    const entryImport = (entrypoints[bundleName].import ??= []);
                    for (const path of paths) {
                        try {
                            const resolvedPath = resolver.resolveSync({}, root, path);
                            if (resolvedPath) {
                                entryImport.push(`${resolvedPath}?ngGlobalStyle`);
                            }
                            else {
                                (0, assert_1.default)(this.compilation, 'Compilation cannot be undefined.');
                                (0, webpack_diagnostics_1.addError)(this.compilation, `Cannot resolve '${path}'.`);
                            }
                        }
                        catch (error) {
                            (0, assert_1.default)(this.compilation, 'Compilation cannot be undefined.');
                            (0, error_1.assertIsError)(error);
                            (0, webpack_diagnostics_1.addError)(this.compilation, error.message);
                        }
                    }
                }
                return entrypoints;
            };
        });
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            this.compilation = compilation;
        });
    }
}
exports.StylesWebpackPlugin = StylesWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLXdlYnBhY2stcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL3N0eWxlcy13ZWJwYWNrLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxvREFBNEI7QUFFNUIsZ0RBQXFEO0FBQ3JELDRFQUE4RDtBQVE5RDs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUFDO0FBRTVDLE1BQWEsbUJBQW1CO0lBR0Q7SUFGckIsV0FBVyxDQUEwQjtJQUU3QyxZQUE2QixPQUFtQztRQUFuQyxZQUFPLEdBQVAsT0FBTyxDQUE0QjtJQUFHLENBQUM7SUFFcEUsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUM3RCxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUU7WUFDN0QsY0FBYyxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUM7WUFDekMsVUFBVSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQztZQUNwRCxVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7WUFDL0MsWUFBWSxFQUFFLENBQUMsc0JBQXNCLENBQUM7WUFDdEMsY0FBYyxFQUFFLElBQUk7WUFDcEIsc0JBQXNCLEVBQUUsSUFBSTtZQUM1QixRQUFRLEVBQUUsQ0FBQyxnQkFBZ0I7WUFDM0IsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlO1NBQ3JDLENBQUMsQ0FBQztRQUVILE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7UUFDeEMsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUU7WUFDL0MsTUFBTSxLQUFLLEdBQ1QsT0FBTyxjQUFjLENBQUMsS0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO1lBRTdGLGNBQWMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxJQUFJLEVBQUU7Z0JBQ2hDLE1BQU0sV0FBVyxHQUFHLE1BQU0sS0FBSyxDQUFDO2dCQUVoQyxLQUFLLE1BQU0sQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRTtvQkFDN0QsV0FBVyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDL0IsTUFBTSxXQUFXLEdBQUcsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxDQUFDO29CQUU1RCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTt3QkFDeEIsSUFBSTs0QkFDRixNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7NEJBQzFELElBQUksWUFBWSxFQUFFO2dDQUNoQixXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxnQkFBZ0IsQ0FBQyxDQUFDOzZCQUNuRDtpQ0FBTTtnQ0FDTCxJQUFBLGdCQUFNLEVBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO2dDQUM3RCxJQUFBLDhCQUFRLEVBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsSUFBSSxJQUFJLENBQUMsQ0FBQzs2QkFDekQ7eUJBQ0Y7d0JBQUMsT0FBTyxLQUFLLEVBQUU7NEJBQ2QsSUFBQSxnQkFBTSxFQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsa0NBQWtDLENBQUMsQ0FBQzs0QkFDN0QsSUFBQSxxQkFBYSxFQUFDLEtBQUssQ0FBQyxDQUFDOzRCQUNyQixJQUFBLDhCQUFRLEVBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7eUJBQzNDO3FCQUNGO2lCQUNGO2dCQUVELE9BQU8sV0FBVyxDQUFDO1lBQ3JCLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzlELElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdkRELGtEQXVEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7IENvbXBpbGF0aW9uLCBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IGFkZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzV2VicGFja1BsdWdpbk9wdGlvbnMge1xuICBwcmVzZXJ2ZVN5bWxpbmtzPzogYm9vbGVhbjtcbiAgcm9vdDogc3RyaW5nO1xuICBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+O1xufVxuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnc3R5bGVzLXdlYnBhY2stcGx1Z2luJztcblxuZXhwb3J0IGNsYXNzIFN0eWxlc1dlYnBhY2tQbHVnaW4ge1xuICBwcml2YXRlIGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IFN0eWxlc1dlYnBhY2tQbHVnaW5PcHRpb25zKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHMsIHByZXNlcnZlU3ltbGlua3MsIHJvb3QgfSA9IHRoaXMub3B0aW9ucztcbiAgICBjb25zdCByZXNvbHZlciA9IGNvbXBpbGVyLnJlc29sdmVyRmFjdG9yeS5nZXQoJ2dsb2JhbC1zdHlsZXMnLCB7XG4gICAgICBjb25kaXRpb25OYW1lczogWydzYXNzJywgJ2xlc3MnLCAnc3R5bGUnXSxcbiAgICAgIG1haW5GaWVsZHM6IFsnc2FzcycsICdsZXNzJywgJ3N0eWxlJywgJ21haW4nLCAnLi4uJ10sXG4gICAgICBleHRlbnNpb25zOiBbJy5zY3NzJywgJy5zYXNzJywgJy5sZXNzJywgJy5jc3MnXSxcbiAgICAgIHJlc3RyaWN0aW9uczogWy9cXC4oKGxlfHNhfHNjfGMpc3MpJC9pXSxcbiAgICAgIHByZWZlclJlbGF0aXZlOiB0cnVlLFxuICAgICAgdXNlU3luY0ZpbGVTeXN0ZW1DYWxsczogdHJ1ZSxcbiAgICAgIHN5bWxpbmtzOiAhcHJlc2VydmVTeW1saW5rcyxcbiAgICAgIGZpbGVTeXN0ZW06IGNvbXBpbGVyLmlucHV0RmlsZVN5c3RlbSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdlYnBhY2tPcHRpb25zID0gY29tcGlsZXIub3B0aW9ucztcbiAgICBjb21waWxlci5ob29rcy5lbnZpcm9ubWVudC50YXAoUExVR0lOX05BTUUsICgpID0+IHtcbiAgICAgIGNvbnN0IGVudHJ5ID1cbiAgICAgICAgdHlwZW9mIHdlYnBhY2tPcHRpb25zLmVudHJ5ID09PSAnZnVuY3Rpb24nID8gd2VicGFja09wdGlvbnMuZW50cnkoKSA6IHdlYnBhY2tPcHRpb25zLmVudHJ5O1xuXG4gICAgICB3ZWJwYWNrT3B0aW9ucy5lbnRyeSA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBhd2FpdCBlbnRyeTtcblxuICAgICAgICBmb3IgKGNvbnN0IFtidW5kbGVOYW1lLCBwYXRoc10gb2YgT2JqZWN0LmVudHJpZXMoZW50cnlQb2ludHMpKSB7XG4gICAgICAgICAgZW50cnlwb2ludHNbYnVuZGxlTmFtZV0gPz89IHt9O1xuICAgICAgICAgIGNvbnN0IGVudHJ5SW1wb3J0ID0gKGVudHJ5cG9pbnRzW2J1bmRsZU5hbWVdLmltcG9ydCA/Pz0gW10pO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBwYXRoIG9mIHBhdGhzKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSByZXNvbHZlci5yZXNvbHZlU3luYyh7fSwgcm9vdCwgcGF0aCk7XG4gICAgICAgICAgICAgIGlmIChyZXNvbHZlZFBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeUltcG9ydC5wdXNoKGAke3Jlc29sdmVkUGF0aH0/bmdHbG9iYWxTdHlsZWApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2VydCh0aGlzLmNvbXBpbGF0aW9uLCAnQ29tcGlsYXRpb24gY2Fubm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICBhZGRFcnJvcih0aGlzLmNvbXBpbGF0aW9uLCBgQ2Fubm90IHJlc29sdmUgJyR7cGF0aH0nLmApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBhc3NlcnQodGhpcy5jb21waWxhdGlvbiwgJ0NvbXBpbGF0aW9uIGNhbm5vdCBiZSB1bmRlZmluZWQuJyk7XG4gICAgICAgICAgICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICBhZGRFcnJvcih0aGlzLmNvbXBpbGF0aW9uLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZW50cnlwb2ludHM7XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICB0aGlzLmNvbXBpbGF0aW9uID0gY29tcGlsYXRpb247XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==