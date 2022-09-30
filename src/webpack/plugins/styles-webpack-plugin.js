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
const error_1 = require("../../utils/error");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
/**
 * The name of the plugin provided to Webpack when tapping Webpack compiler hooks.
 */
const PLUGIN_NAME = 'styles-webpack-plugin';
class StylesWebpackPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        const { entryPoints, preserveSymlinks, root } = this.options;
        const webpackOptions = compiler.options;
        const entry = typeof webpackOptions.entry === 'function' ? webpackOptions.entry() : webpackOptions.entry;
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
        webpackOptions.entry = async () => {
            var _a, _b;
            var _c;
            const entrypoints = await entry;
            for (const [bundleName, paths] of Object.entries(entryPoints)) {
                (_a = entrypoints[bundleName]) !== null && _a !== void 0 ? _a : (entrypoints[bundleName] = {});
                const entryImport = ((_b = (_c = entrypoints[bundleName]).import) !== null && _b !== void 0 ? _b : (_c.import = []));
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
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            this.compilation = compilation;
        });
    }
}
exports.StylesWebpackPlugin = StylesWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLXdlYnBhY2stcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3N0eWxlcy13ZWJwYWNrLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxvREFBNEI7QUFHNUIsNkNBQWtEO0FBQ2xELHlFQUEyRDtBQVEzRDs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUFDO0FBRTVDLE1BQWEsbUJBQW1CO0lBRzlCLFlBQTZCLE9BQW1DO1FBQW5DLFlBQU8sR0FBUCxPQUFPLENBQTRCO0lBQUcsQ0FBQztJQUVwRSxLQUFLLENBQUMsUUFBa0I7UUFDdEIsTUFBTSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQzdELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7UUFDeEMsTUFBTSxLQUFLLEdBQ1QsT0FBTyxjQUFjLENBQUMsS0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO1FBRTdGLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRTtZQUM3RCxjQUFjLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQztZQUN6QyxVQUFVLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDO1lBQ3BELFVBQVUsRUFBRSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztZQUMvQyxZQUFZLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQztZQUN0QyxjQUFjLEVBQUUsSUFBSTtZQUNwQixzQkFBc0IsRUFBRSxJQUFJO1lBQzVCLFFBQVEsRUFBRSxDQUFDLGdCQUFnQjtZQUMzQixVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsY0FBYyxDQUFDLEtBQUssR0FBRyxLQUFLLElBQUksRUFBRTs7O1lBQ2hDLE1BQU0sV0FBVyxHQUFHLE1BQU0sS0FBSyxDQUFDO1lBRWhDLEtBQUssTUFBTSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3RCxNQUFBLFdBQVcsQ0FBQyxVQUFVLHFDQUF0QixXQUFXLENBQUMsVUFBVSxJQUFNLEVBQUUsRUFBQztnQkFDL0IsTUFBTSxXQUFXLEdBQUcsYUFBQyxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUMsTUFBTSx1Q0FBTixNQUFNLEdBQUssRUFBRSxFQUFDLENBQUM7Z0JBRTVELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO29CQUN4QixJQUFJO3dCQUNGLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDMUQsSUFBSSxZQUFZLEVBQUU7NEJBQ2hCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLGdCQUFnQixDQUFDLENBQUM7eUJBQ25EOzZCQUFNOzRCQUNMLElBQUEsZ0JBQU0sRUFBQyxJQUFJLENBQUMsV0FBVyxFQUFFLGtDQUFrQyxDQUFDLENBQUM7NEJBQzdELElBQUEsOEJBQVEsRUFBQyxJQUFJLENBQUMsV0FBVyxFQUFFLG1CQUFtQixJQUFJLElBQUksQ0FBQyxDQUFDO3lCQUN6RDtxQkFDRjtvQkFBQyxPQUFPLEtBQUssRUFBRTt3QkFDZCxJQUFBLGdCQUFNLEVBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO3dCQUM3RCxJQUFBLHFCQUFhLEVBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3JCLElBQUEsOEJBQVEsRUFBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztxQkFDM0M7aUJBQ0Y7YUFDRjtZQUVELE9BQU8sV0FBVyxDQUFDO1FBQ3JCLENBQUMsQ0FBQztRQUVGLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUM5RCxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNqQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXJERCxrREFxREMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgcGx1Z2luTmFtZSB9IGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsYXRpb24sIENvbXBpbGVyIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgYWRkRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcblxuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNXZWJwYWNrUGx1Z2luT3B0aW9ucyB7XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICByb290OiBzdHJpbmc7XG4gIGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT47XG59XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIHBsdWdpbiBwcm92aWRlZCB0byBXZWJwYWNrIHdoZW4gdGFwcGluZyBXZWJwYWNrIGNvbXBpbGVyIGhvb2tzLlxuICovXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdzdHlsZXMtd2VicGFjay1wbHVnaW4nO1xuXG5leHBvcnQgY2xhc3MgU3R5bGVzV2VicGFja1BsdWdpbiB7XG4gIHByaXZhdGUgY29tcGlsYXRpb246IENvbXBpbGF0aW9uIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogU3R5bGVzV2VicGFja1BsdWdpbk9wdGlvbnMpIHt9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB7XG4gICAgY29uc3QgeyBlbnRyeVBvaW50cywgcHJlc2VydmVTeW1saW5rcywgcm9vdCB9ID0gdGhpcy5vcHRpb25zO1xuICAgIGNvbnN0IHdlYnBhY2tPcHRpb25zID0gY29tcGlsZXIub3B0aW9ucztcbiAgICBjb25zdCBlbnRyeSA9XG4gICAgICB0eXBlb2Ygd2VicGFja09wdGlvbnMuZW50cnkgPT09ICdmdW5jdGlvbicgPyB3ZWJwYWNrT3B0aW9ucy5lbnRyeSgpIDogd2VicGFja09wdGlvbnMuZW50cnk7XG5cbiAgICBjb25zdCByZXNvbHZlciA9IGNvbXBpbGVyLnJlc29sdmVyRmFjdG9yeS5nZXQoJ2dsb2JhbC1zdHlsZXMnLCB7XG4gICAgICBjb25kaXRpb25OYW1lczogWydzYXNzJywgJ2xlc3MnLCAnc3R5bGUnXSxcbiAgICAgIG1haW5GaWVsZHM6IFsnc2FzcycsICdsZXNzJywgJ3N0eWxlJywgJ21haW4nLCAnLi4uJ10sXG4gICAgICBleHRlbnNpb25zOiBbJy5zY3NzJywgJy5zYXNzJywgJy5sZXNzJywgJy5jc3MnXSxcbiAgICAgIHJlc3RyaWN0aW9uczogWy9cXC4oKGxlfHNhfHNjfGMpc3MpJC9pXSxcbiAgICAgIHByZWZlclJlbGF0aXZlOiB0cnVlLFxuICAgICAgdXNlU3luY0ZpbGVTeXN0ZW1DYWxsczogdHJ1ZSxcbiAgICAgIHN5bWxpbmtzOiAhcHJlc2VydmVTeW1saW5rcyxcbiAgICAgIGZpbGVTeXN0ZW06IGNvbXBpbGVyLmlucHV0RmlsZVN5c3RlbSxcbiAgICB9KTtcblxuICAgIHdlYnBhY2tPcHRpb25zLmVudHJ5ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBhd2FpdCBlbnRyeTtcblxuICAgICAgZm9yIChjb25zdCBbYnVuZGxlTmFtZSwgcGF0aHNdIG9mIE9iamVjdC5lbnRyaWVzKGVudHJ5UG9pbnRzKSkge1xuICAgICAgICBlbnRyeXBvaW50c1tidW5kbGVOYW1lXSA/Pz0ge307XG4gICAgICAgIGNvbnN0IGVudHJ5SW1wb3J0ID0gKGVudHJ5cG9pbnRzW2J1bmRsZU5hbWVdLmltcG9ydCA/Pz0gW10pO1xuXG4gICAgICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSByZXNvbHZlci5yZXNvbHZlU3luYyh7fSwgcm9vdCwgcGF0aCk7XG4gICAgICAgICAgICBpZiAocmVzb2x2ZWRQYXRoKSB7XG4gICAgICAgICAgICAgIGVudHJ5SW1wb3J0LnB1c2goYCR7cmVzb2x2ZWRQYXRofT9uZ0dsb2JhbFN0eWxlYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhc3NlcnQodGhpcy5jb21waWxhdGlvbiwgJ0NvbXBpbGF0aW9uIGNhbm5vdCBiZSB1bmRlZmluZWQuJyk7XG4gICAgICAgICAgICAgIGFkZEVycm9yKHRoaXMuY29tcGlsYXRpb24sIGBDYW5ub3QgcmVzb2x2ZSAnJHtwYXRofScuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGFzc2VydCh0aGlzLmNvbXBpbGF0aW9uLCAnQ29tcGlsYXRpb24gY2Fubm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICAgICAgICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgYWRkRXJyb3IodGhpcy5jb21waWxhdGlvbiwgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBlbnRyeXBvaW50cztcbiAgICB9O1xuXG4gICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICB0aGlzLmNvbXBpbGF0aW9uID0gY29tcGlsYXRpb247XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==