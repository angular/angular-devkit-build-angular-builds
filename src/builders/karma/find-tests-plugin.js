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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindTestsPlugin = void 0;
const assert_1 = __importDefault(require("assert"));
const fast_glob_1 = __importStar(require("fast-glob"));
const fs_1 = require("fs");
const mini_css_extract_plugin_1 = require("mini-css-extract-plugin");
const path_1 = require("path");
/**
 * The name of the plugin provided to Webpack when tapping Webpack compiler hooks.
 */
const PLUGIN_NAME = 'angular-find-tests-plugin';
class FindTestsPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        const { include = ['**/*.spec.ts'], exclude = [], projectSourceRoot, workspaceRoot, } = this.options;
        const webpackOptions = compiler.options;
        const entry = typeof webpackOptions.entry === 'function' ? webpackOptions.entry() : webpackOptions.entry;
        let originalImport;
        // Add tests files are part of the entry-point.
        webpackOptions.entry = async () => {
            const specFiles = await findTests(include, exclude, workspaceRoot, projectSourceRoot);
            const entrypoints = await entry;
            const entrypoint = entrypoints['main'];
            if (!entrypoint.import) {
                throw new Error(`Cannot find 'main' entrypoint.`);
            }
            if (specFiles.length) {
                originalImport ?? (originalImport = entrypoint.import);
                entrypoint.import = [...originalImport, ...specFiles];
            }
            else {
                (0, assert_1.default)(this.compilation, 'Compilation cannot be undefined.');
                this.compilation
                    .getLogger(mini_css_extract_plugin_1.pluginName)
                    .error(`Specified patterns: "${include.join(', ')}" did not match any spec files.`);
            }
            return entrypoints;
        };
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            this.compilation = compilation;
            compilation.contextDependencies.add(projectSourceRoot);
        });
    }
}
exports.FindTestsPlugin = FindTestsPlugin;
// go through all patterns and find unique list of files
async function findTests(include, exclude, workspaceRoot, projectSourceRoot) {
    const matchingTestsPromises = include.map((pattern) => findMatchingTests(pattern, exclude, workspaceRoot, projectSourceRoot));
    const files = await Promise.all(matchingTestsPromises);
    // Unique file names
    return [...new Set(files.flat())];
}
const normalizePath = (path) => path.replace(/\\/g, '/');
async function findMatchingTests(pattern, ignore, workspaceRoot, projectSourceRoot) {
    // normalize pattern, glob lib only accepts forward slashes
    let normalizedPattern = normalizePath(pattern);
    if (normalizedPattern.charAt(0) === '/') {
        normalizedPattern = normalizedPattern.substring(1);
    }
    const relativeProjectRoot = normalizePath((0, path_1.relative)(workspaceRoot, projectSourceRoot) + '/');
    // remove relativeProjectRoot to support relative paths from root
    // such paths are easy to get when running scripts via IDEs
    if (normalizedPattern.startsWith(relativeProjectRoot)) {
        normalizedPattern = normalizedPattern.substring(relativeProjectRoot.length);
    }
    // special logic when pattern does not look like a glob
    if (!(0, fast_glob_1.isDynamicPattern)(normalizedPattern)) {
        if (await isDirectory((0, path_1.join)(projectSourceRoot, normalizedPattern))) {
            normalizedPattern = `${normalizedPattern}/**/*.spec.@(ts|tsx)`;
        }
        else {
            // see if matching spec file exists
            const fileExt = (0, path_1.extname)(normalizedPattern);
            // Replace extension to `.spec.ext`. Example: `src/app/app.component.ts`-> `src/app/app.component.spec.ts`
            const potentialSpec = (0, path_1.join)(projectSourceRoot, (0, path_1.dirname)(normalizedPattern), `${(0, path_1.basename)(normalizedPattern, fileExt)}.spec${fileExt}`);
            if (await exists(potentialSpec)) {
                return [potentialSpec];
            }
        }
    }
    return (0, fast_glob_1.default)(normalizedPattern, {
        cwd: projectSourceRoot,
        absolute: true,
        ignore: ['**/node_modules/**', ...ignore],
    });
}
async function isDirectory(path) {
    try {
        const stats = await fs_1.promises.stat(path);
        return stats.isDirectory();
    }
    catch {
        return false;
    }
}
async function exists(path) {
    try {
        await fs_1.promises.access(path, fs_1.constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9maW5kLXRlc3RzLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILG9EQUE0QjtBQUM1Qix1REFBbUQ7QUFDbkQsMkJBQXlEO0FBQ3pELHFFQUFxRDtBQUNyRCwrQkFBa0U7QUFHbEU7O0dBRUc7QUFDSCxNQUFNLFdBQVcsR0FBRywyQkFBMkIsQ0FBQztBQVNoRCxNQUFhLGVBQWU7SUFHMUIsWUFBb0IsT0FBK0I7UUFBL0IsWUFBTyxHQUFQLE9BQU8sQ0FBd0I7SUFBRyxDQUFDO0lBRXZELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixNQUFNLEVBQ0osT0FBTyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQzFCLE9BQU8sR0FBRyxFQUFFLEVBQ1osaUJBQWlCLEVBQ2pCLGFBQWEsR0FDZCxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDakIsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztRQUN4QyxNQUFNLEtBQUssR0FDVCxPQUFPLGNBQWMsQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUM7UUFFN0YsSUFBSSxjQUFvQyxDQUFDO1FBRXpDLCtDQUErQztRQUMvQyxjQUFjLENBQUMsS0FBSyxHQUFHLEtBQUssSUFBSSxFQUFFO1lBQ2hDLE1BQU0sU0FBUyxHQUFHLE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDdEYsTUFBTSxXQUFXLEdB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Q0FBQztLQUNkO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgZ2xvYiwgeyBpc0R5bmFtaWNQYXR0ZXJuIH0gZnJvbSAnZmFzdC1nbG9iJztcbmltcG9ydCB7IFBhdGhMaWtlLCBjb25zdGFudHMsIHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgcGx1Z2luTmFtZSB9IGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIgfSBmcm9tICd3ZWJwYWNrJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgcGx1Z2luIHByb3ZpZGVkIHRvIFdlYnBhY2sgd2hlbiB0YXBwaW5nIFdlYnBhY2sgY29tcGlsZXIgaG9va3MuXG4gKi9cbmNvbnN0IFBMVUdJTl9OQU1FID0gJ2FuZ3VsYXItZmluZC10ZXN0cy1wbHVnaW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbmRUZXN0c1BsdWdpbk9wdGlvbnMge1xuICBpbmNsdWRlPzogc3RyaW5nW107XG4gIGV4Y2x1ZGU/OiBzdHJpbmdbXTtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBwcm9qZWN0U291cmNlUm9vdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRmluZFRlc3RzUGx1Z2luIHtcbiAgcHJpdmF0ZSBjb21waWxhdGlvbjogQ29tcGlsYXRpb24gfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBGaW5kVGVzdHNQbHVnaW5PcHRpb25zKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbnN0IHtcbiAgICAgIGluY2x1ZGUgPSBbJyoqLyouc3BlYy50cyddLFxuICAgICAgZXhjbHVkZSA9IFtdLFxuICAgICAgcHJvamVjdFNvdXJjZVJvb3QsXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgIH0gPSB0aGlzLm9wdGlvbnM7XG4gICAgY29uc3Qgd2VicGFja09wdGlvbnMgPSBjb21waWxlci5vcHRpb25zO1xuICAgIGNvbnN0IGVudHJ5ID1cbiAgICAgIHR5cGVvZiB3ZWJwYWNrT3B0aW9ucy5lbnRyeSA9PT0gJ2Z1bmN0aW9uJyA/IHdlYnBhY2tPcHRpb25zLmVudHJ5KCkgOiB3ZWJwYWNrT3B0aW9ucy5lbnRyeTtcblxuICAgIGxldCBvcmlnaW5hbEltcG9ydDogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBBZGQgdGVzdHMgZmlsZXMgYXJlIHBhcnQgb2YgdGhlIGVudHJ5LXBvaW50LlxuICAgIHdlYnBhY2tPcHRpb25zLmVudHJ5ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3Qgc3BlY0ZpbGVzID0gYXdhaXQgZmluZFRlc3RzKGluY2x1ZGUsIGV4Y2x1ZGUsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RTb3VyY2VSb290KTtcbiAgICAgIGNvbnN0IGVudHJ5cG9pbnRzID0gYXdhaXQgZW50cnk7XG4gICAgICBjb25zdCBlbnRyeXBvaW50ID0gZW50cnlwb2ludHNbJ21haW4nXTtcbiAgICAgIGlmICghZW50cnlwb2ludC5pbXBvcnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgZmluZCAnbWFpbicgZW50cnlwb2ludC5gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNwZWNGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgb3JpZ2luYWxJbXBvcnQgPz89IGVudHJ5cG9pbnQuaW1wb3J0O1xuICAgICAgICBlbnRyeXBvaW50LmltcG9ydCA9IFsuLi5vcmlnaW5hbEltcG9ydCwgLi4uc3BlY0ZpbGVzXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydCh0aGlzLmNvbXBpbGF0aW9uLCAnQ29tcGlsYXRpb24gY2Fubm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICAgICAgdGhpcy5jb21waWxhdGlvblxuICAgICAgICAgIC5nZXRMb2dnZXIocGx1Z2luTmFtZSlcbiAgICAgICAgICAuZXJyb3IoYFNwZWNpZmllZCBwYXR0ZXJuczogXCIke2luY2x1ZGUuam9pbignLCAnKX1cIiBkaWQgbm90IG1hdGNoIGFueSBzcGVjIGZpbGVzLmApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZW50cnlwb2ludHM7XG4gICAgfTtcblxuICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgdGhpcy5jb21waWxhdGlvbiA9IGNvbXBpbGF0aW9uO1xuICAgICAgY29tcGlsYXRpb24uY29udGV4dERlcGVuZGVuY2llcy5hZGQocHJvamVjdFNvdXJjZVJvb3QpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIGdvIHRocm91Z2ggYWxsIHBhdHRlcm5zIGFuZCBmaW5kIHVuaXF1ZSBsaXN0IG9mIGZpbGVzXG5hc3luYyBmdW5jdGlvbiBmaW5kVGVzdHMoXG4gIGluY2x1ZGU6IHN0cmluZ1tdLFxuICBleGNsdWRlOiBzdHJpbmdbXSxcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0U291cmNlUm9vdDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCBtYXRjaGluZ1Rlc3RzUHJvbWlzZXMgPSBpbmNsdWRlLm1hcCgocGF0dGVybikgPT5cbiAgICBmaW5kTWF0Y2hpbmdUZXN0cyhwYXR0ZXJuLCBleGNsdWRlLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCksXG4gICk7XG4gIGNvbnN0IGZpbGVzID0gYXdhaXQgUHJvbWlzZS5hbGwobWF0Y2hpbmdUZXN0c1Byb21pc2VzKTtcblxuICAvLyBVbmlxdWUgZmlsZSBuYW1lc1xuICByZXR1cm4gWy4uLm5ldyBTZXQoZmlsZXMuZmxhdCgpKV07XG59XG5cbmNvbnN0IG5vcm1hbGl6ZVBhdGggPSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+IHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG5hc3luYyBmdW5jdGlvbiBmaW5kTWF0Y2hpbmdUZXN0cyhcbiAgcGF0dGVybjogc3RyaW5nLFxuICBpZ25vcmU6IHN0cmluZ1tdLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIC8vIG5vcm1hbGl6ZSBwYXR0ZXJuLCBnbG9iIGxpYiBvbmx5IGFjY2VwdHMgZm9yd2FyZCBzbGFzaGVzXG4gIGxldCBub3JtYWxpemVkUGF0dGVybiA9IG5vcm1hbGl6ZVBhdGgocGF0dGVybik7XG4gIGlmIChub3JtYWxpemVkUGF0dGVybi5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplZFBhdHRlcm4uc3Vic3RyaW5nKDEpO1xuICB9XG5cbiAgY29uc3QgcmVsYXRpdmVQcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZVBhdGgocmVsYXRpdmUod29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpICsgJy8nKTtcblxuICAvLyByZW1vdmUgcmVsYXRpdmVQcm9qZWN0Um9vdCB0byBzdXBwb3J0IHJlbGF0aXZlIHBhdGhzIGZyb20gcm9vdFxuICAvLyBzdWNoIHBhdGhzIGFyZSBlYXN5IHRvIGdldCB3aGVuIHJ1bm5pbmcgc2NyaXB0cyB2aWEgSURFc1xuICBpZiAobm9ybWFsaXplZFBhdHRlcm4uc3RhcnRzV2l0aChyZWxhdGl2ZVByb2plY3RSb290KSkge1xuICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplZFBhdHRlcm4uc3Vic3RyaW5nKHJlbGF0aXZlUHJvamVjdFJvb3QubGVuZ3RoKTtcbiAgfVxuXG4gIC8vIHNwZWNpYWwgbG9naWMgd2hlbiBwYXR0ZXJuIGRvZXMgbm90IGxvb2sgbGlrZSBhIGdsb2JcbiAgaWYgKCFpc0R5bmFtaWNQYXR0ZXJuKG5vcm1hbGl6ZWRQYXR0ZXJuKSkge1xuICAgIGlmIChhd2FpdCBpc0RpcmVjdG9yeShqb2luKHByb2plY3RTb3VyY2VSb290LCBub3JtYWxpemVkUGF0dGVybikpKSB7XG4gICAgICBub3JtYWxpemVkUGF0dGVybiA9IGAke25vcm1hbGl6ZWRQYXR0ZXJufS8qKi8qLnNwZWMuQCh0c3x0c3gpYDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc2VlIGlmIG1hdGNoaW5nIHNwZWMgZmlsZSBleGlzdHNcbiAgICAgIGNvbnN0IGZpbGVFeHQgPSBleHRuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuKTtcbiAgICAgIC8vIFJlcGxhY2UgZXh0ZW5zaW9uIHRvIGAuc3BlYy5leHRgLiBFeGFtcGxlOiBgc3JjL2FwcC9hcHAuY29tcG9uZW50LnRzYC0+IGBzcmMvYXBwL2FwcC5jb21wb25lbnQuc3BlYy50c2BcbiAgICAgIGNvbnN0IHBvdGVudGlhbFNwZWMgPSBqb2luKFxuICAgICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgICAgZGlybmFtZShub3JtYWxpemVkUGF0dGVybiksXG4gICAgICAgIGAke2Jhc2VuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuLCBmaWxlRXh0KX0uc3BlYyR7ZmlsZUV4dH1gLFxuICAgICAgKTtcblxuICAgICAgaWYgKGF3YWl0IGV4aXN0cyhwb3RlbnRpYWxTcGVjKSkge1xuICAgICAgICByZXR1cm4gW3BvdGVudGlhbFNwZWNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBnbG9iKG5vcm1hbGl6ZWRQYXR0ZXJuLCB7XG4gICAgY3dkOiBwcm9qZWN0U291cmNlUm9vdCxcbiAgICBhYnNvbHV0ZTogdHJ1ZSxcbiAgICBpZ25vcmU6IFsnKiovbm9kZV9tb2R1bGVzLyoqJywgLi4uaWdub3JlXSxcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGlzRGlyZWN0b3J5KHBhdGg6IFBhdGhMaWtlKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KHBhdGgpO1xuXG4gICAgcmV0dXJuIHN0YXRzLmlzRGlyZWN0b3J5KCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGlzdHMocGF0aDogUGF0aExpa2UpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5hY2Nlc3MocGF0aCwgY29uc3RhbnRzLkZfT0spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIl19