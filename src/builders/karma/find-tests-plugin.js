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
    options;
    compilation;
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
                originalImport ??= entrypoint.import;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9maW5kLXRlc3RzLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILG9EQUE0QjtBQUM1Qix1REFBbUQ7QUFDbkQsMkJBQXlEO0FBQ3pELHFFQUFxRDtBQUNyRCwrQkFBa0U7QUFHbEU7O0dBRUc7QUFDSCxNQUFNLFdBQVcsR0FBRywyQkFBMkIsQ0FBQztBQVNoRCxNQUFhLGVBQWU7SUFHTjtJQUZaLFdBQVcsQ0FBMEI7SUFFN0MsWUFBb0IsT0FBK0I7UUFBL0IsWUFBTyxHQUFQLE9BQU8sQ0FBd0I7SUFBRyxDQUFDO0lBRXZELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixNQUFNLEVBQ0osT0FBTyxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQzFCLE9BQU8sR0FBRyxFQUFFLEVBQ1osaUJBQWlCLEVBQ2pCLGFBQWEsR0FDZCxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDakIsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztRQUN4QyxNQUFNLEtBQUssR0FDVCxPQUFPLGNBQWMsQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUM7UUFFN0YsSUFBSSxjQUFvQyxDQUFDO1FBRXpDLCtDQUErQztRQUMvQyxjQUFjLENBQUMsS0FBSyxHQUFHLEtBQUssSUFBSSxFQUFFO1lBQ2hDLE1BQU0sU0FBUyxHQUFHLE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDdEYsTUFBTSxXQUFXLEdBQUcsTUFBTSxLQUFLLENBQUM7WUFDaEMsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFO2dCQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7YUFDbkQ7WUFFRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3BCLGNBQWMsS0FBSyxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUNyQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxjQUFjLEVBQUUsR0FBRyxTQUFTLENBQUMsQ0FBQzthQUN2RDtpQkFBTTtnQkFDTCxJQUFBLGdCQUFNLEVBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLENBQUMsV0FBVztxQkFDYixTQUFTLENBQUMsb0NBQVUsQ0FBQztxQkFDckIsS0FBSyxDQUFDLHdCQUF3QixPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO2FBQ3ZGO1lBRUQsT0FBTyxXQUFXLENBQUM7UUFDckIsQ0FBQyxDQUFDO1FBRUYsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzlELElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1lBQy9CLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTdDRCwwQ0E2Q0M7QUFFRCx3REFBd0Q7QUFDeEQsS0FBSyxVQUFVLFNBQVMsQ0FDdEIsT0FBaUIsRUFDakIsT0FBaUIsRUFDakIsYUFBcUIsRUFDckIsaUJBQXlCO0lBRXpCLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQ3BELGlCQUFpQixDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQ3RFLENBQUM7SUFDRixNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUV2RCxvQkFBb0I7SUFDcEIsT0FBTyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBRUQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxJQUFZLEVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRXpFLEtBQUssVUFBVSxpQkFBaUIsQ0FDOUIsT0FBZSxFQUNmLE1BQWdCLEVBQ2hCLGFBQXFCLEVBQ3JCLGlCQUF5QjtJQUV6QiwyREFBMkQ7SUFDM0QsSUFBSSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0MsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQ3ZDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNwRDtJQUVELE1BQU0sbUJBQW1CLEdBQUcsYUFBYSxDQUFDLElBQUEsZUFBUSxFQUFDLGFBQWEsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBRTVGLGlFQUFpRTtJQUNqRSwyREFBMkQ7SUFDM0QsSUFBSSxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsRUFBRTtRQUNyRCxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDN0U7SUFFRCx1REFBdUQ7SUFDdkQsSUFBSSxDQUFDLElBQUEsNEJBQWdCLEVBQUMsaUJBQWlCLENBQUMsRUFBRTtRQUN4QyxJQUFJLE1BQU0sV0FBVyxDQUFDLElBQUEsV0FBSSxFQUFDLGlCQUFpQixFQUFFLGlCQUFpQixDQUFDLENBQUMsRUFBRTtZQUNqRSxpQkFBaUIsR0FBRyxHQUFHLGlCQUFpQixzQkFBc0IsQ0FBQztTQUNoRTthQUFNO1lBQ0wsbUNBQW1DO1lBQ25DLE1BQU0sT0FBTyxHQUFHLElBQUEsY0FBTyxFQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDM0MsMEdBQTBHO1lBQzFHLE1BQU0sYUFBYSxHQUFHLElBQUEsV0FBSSxFQUN4QixpQkFBaUIsRUFDakIsSUFBQSxjQUFPLEVBQUMsaUJBQWlCLENBQUMsRUFDMUIsR0FBRyxJQUFBLGVBQVEsRUFBQyxpQkFBaUIsRUFBRSxPQUFPLENBQUMsUUFBUSxPQUFPLEVBQUUsQ0FDekQsQ0FBQztZQUVGLElBQUksTUFBTSxNQUFNLENBQUMsYUFBYSxDQUFDLEVBQUU7Z0JBQy9CLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQzthQUN4QjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLElBQUEsbUJBQUksRUFBQyxpQkFBaUIsRUFBRTtRQUM3QixHQUFHLEVBQUUsaUJBQWlCO1FBQ3RCLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxNQUFNLENBQUM7S0FDMUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELEtBQUssVUFBVSxXQUFXLENBQUMsSUFBYztJQUN2QyxJQUFJO1FBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxhQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWxDLE9BQU8sS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQzVCO0lBQUMsTUFBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBRUQsS0FBSyxVQUFVLE1BQU0sQ0FBQyxJQUFjO0lBQ2xDLElBQUk7UUFDRixNQUFNLGFBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV0QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsTUFBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCBnbG9iLCB7IGlzRHluYW1pY1BhdHRlcm4gfSBmcm9tICdmYXN0LWdsb2InO1xuaW1wb3J0IHsgUGF0aExpa2UsIGNvbnN0YW50cywgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBwbHVnaW5OYW1lIH0gZnJvbSAnbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4nO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IENvbXBpbGF0aW9uLCBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnYW5ndWxhci1maW5kLXRlc3RzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmluZFRlc3RzUGx1Z2luT3B0aW9ucyB7XG4gIGluY2x1ZGU/OiBzdHJpbmdbXTtcbiAgZXhjbHVkZT86IHN0cmluZ1tdO1xuICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBGaW5kVGVzdHNQbHVnaW4ge1xuICBwcml2YXRlIGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG9wdGlvbnM6IEZpbmRUZXN0c1BsdWdpbk9wdGlvbnMpIHt9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB7XG4gICAgY29uc3Qge1xuICAgICAgaW5jbHVkZSA9IFsnKiovKi5zcGVjLnRzJ10sXG4gICAgICBleGNsdWRlID0gW10sXG4gICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgfSA9IHRoaXMub3B0aW9ucztcbiAgICBjb25zdCB3ZWJwYWNrT3B0aW9ucyA9IGNvbXBpbGVyLm9wdGlvbnM7XG4gICAgY29uc3QgZW50cnkgPVxuICAgICAgdHlwZW9mIHdlYnBhY2tPcHRpb25zLmVudHJ5ID09PSAnZnVuY3Rpb24nID8gd2VicGFja09wdGlvbnMuZW50cnkoKSA6IHdlYnBhY2tPcHRpb25zLmVudHJ5O1xuXG4gICAgbGV0IG9yaWdpbmFsSW1wb3J0OiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblxuICAgIC8vIEFkZCB0ZXN0cyBmaWxlcyBhcmUgcGFydCBvZiB0aGUgZW50cnktcG9pbnQuXG4gICAgd2VicGFja09wdGlvbnMuZW50cnkgPSBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBzcGVjRmlsZXMgPSBhd2FpdCBmaW5kVGVzdHMoaW5jbHVkZSwgZXhjbHVkZSwgd29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpO1xuICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBhd2FpdCBlbnRyeTtcbiAgICAgIGNvbnN0IGVudHJ5cG9pbnQgPSBlbnRyeXBvaW50c1snbWFpbiddO1xuICAgICAgaWYgKCFlbnRyeXBvaW50LmltcG9ydCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kICdtYWluJyBlbnRyeXBvaW50LmApO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3BlY0ZpbGVzLmxlbmd0aCkge1xuICAgICAgICBvcmlnaW5hbEltcG9ydCA/Pz0gZW50cnlwb2ludC5pbXBvcnQ7XG4gICAgICAgIGVudHJ5cG9pbnQuaW1wb3J0ID0gWy4uLm9yaWdpbmFsSW1wb3J0LCAuLi5zcGVjRmlsZXNdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuY29tcGlsYXRpb24sICdDb21waWxhdGlvbiBjYW5ub3QgYmUgdW5kZWZpbmVkLicpO1xuICAgICAgICB0aGlzLmNvbXBpbGF0aW9uXG4gICAgICAgICAgLmdldExvZ2dlcihwbHVnaW5OYW1lKVxuICAgICAgICAgIC5lcnJvcihgU3BlY2lmaWVkIHBhdHRlcm5zOiBcIiR7aW5jbHVkZS5qb2luKCcsICcpfVwiIGRpZCBub3QgbWF0Y2ggYW55IHNwZWMgZmlsZXMuYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBlbnRyeXBvaW50cztcbiAgICB9O1xuXG4gICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICB0aGlzLmNvbXBpbGF0aW9uID0gY29tcGlsYXRpb247XG4gICAgICBjb21waWxhdGlvbi5jb250ZXh0RGVwZW5kZW5jaWVzLmFkZChwcm9qZWN0U291cmNlUm9vdCk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gZ28gdGhyb3VnaCBhbGwgcGF0dGVybnMgYW5kIGZpbmQgdW5pcXVlIGxpc3Qgb2YgZmlsZXNcbmFzeW5jIGZ1bmN0aW9uIGZpbmRUZXN0cyhcbiAgaW5jbHVkZTogc3RyaW5nW10sXG4gIGV4Y2x1ZGU6IHN0cmluZ1tdLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIGNvbnN0IG1hdGNoaW5nVGVzdHNQcm9taXNlcyA9IGluY2x1ZGUubWFwKChwYXR0ZXJuKSA9PlxuICAgIGZpbmRNYXRjaGluZ1Rlc3RzKHBhdHRlcm4sIGV4Y2x1ZGUsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RTb3VyY2VSb290KSxcbiAgKTtcbiAgY29uc3QgZmlsZXMgPSBhd2FpdCBQcm9taXNlLmFsbChtYXRjaGluZ1Rlc3RzUHJvbWlzZXMpO1xuXG4gIC8vIFVuaXF1ZSBmaWxlIG5hbWVzXG4gIHJldHVybiBbLi4ubmV3IFNldChmaWxlcy5mbGF0KCkpXTtcbn1cblxuY29uc3Qgbm9ybWFsaXplUGF0aCA9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4gcGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbmRNYXRjaGluZ1Rlc3RzKFxuICBwYXR0ZXJuOiBzdHJpbmcsXG4gIGlnbm9yZTogc3RyaW5nW10sXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFNvdXJjZVJvb3Q6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgLy8gbm9ybWFsaXplIHBhdHRlcm4sIGdsb2IgbGliIG9ubHkgYWNjZXB0cyBmb3J3YXJkIHNsYXNoZXNcbiAgbGV0IG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplUGF0aChwYXR0ZXJuKTtcbiAgaWYgKG5vcm1hbGl6ZWRQYXR0ZXJuLmNoYXJBdCgwKSA9PT0gJy8nKSB7XG4gICAgbm9ybWFsaXplZFBhdHRlcm4gPSBub3JtYWxpemVkUGF0dGVybi5zdWJzdHJpbmcoMSk7XG4gIH1cblxuICBjb25zdCByZWxhdGl2ZVByb2plY3RSb290ID0gbm9ybWFsaXplUGF0aChyZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCkgKyAnLycpO1xuXG4gIC8vIHJlbW92ZSByZWxhdGl2ZVByb2plY3RSb290IHRvIHN1cHBvcnQgcmVsYXRpdmUgcGF0aHMgZnJvbSByb290XG4gIC8vIHN1Y2ggcGF0aHMgYXJlIGVhc3kgdG8gZ2V0IHdoZW4gcnVubmluZyBzY3JpcHRzIHZpYSBJREVzXG4gIGlmIChub3JtYWxpemVkUGF0dGVybi5zdGFydHNXaXRoKHJlbGF0aXZlUHJvamVjdFJvb3QpKSB7XG4gICAgbm9ybWFsaXplZFBhdHRlcm4gPSBub3JtYWxpemVkUGF0dGVybi5zdWJzdHJpbmcocmVsYXRpdmVQcm9qZWN0Um9vdC5sZW5ndGgpO1xuICB9XG5cbiAgLy8gc3BlY2lhbCBsb2dpYyB3aGVuIHBhdHRlcm4gZG9lcyBub3QgbG9vayBsaWtlIGEgZ2xvYlxuICBpZiAoIWlzRHluYW1pY1BhdHRlcm4obm9ybWFsaXplZFBhdHRlcm4pKSB7XG4gICAgaWYgKGF3YWl0IGlzRGlyZWN0b3J5KGpvaW4ocHJvamVjdFNvdXJjZVJvb3QsIG5vcm1hbGl6ZWRQYXR0ZXJuKSkpIHtcbiAgICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gYCR7bm9ybWFsaXplZFBhdHRlcm59LyoqLyouc3BlYy5AKHRzfHRzeClgO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBzZWUgaWYgbWF0Y2hpbmcgc3BlYyBmaWxlIGV4aXN0c1xuICAgICAgY29uc3QgZmlsZUV4dCA9IGV4dG5hbWUobm9ybWFsaXplZFBhdHRlcm4pO1xuICAgICAgLy8gUmVwbGFjZSBleHRlbnNpb24gdG8gYC5zcGVjLmV4dGAuIEV4YW1wbGU6IGBzcmMvYXBwL2FwcC5jb21wb25lbnQudHNgLT4gYHNyYy9hcHAvYXBwLmNvbXBvbmVudC5zcGVjLnRzYFxuICAgICAgY29uc3QgcG90ZW50aWFsU3BlYyA9IGpvaW4oXG4gICAgICAgIHByb2plY3RTb3VyY2VSb290LFxuICAgICAgICBkaXJuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuKSxcbiAgICAgICAgYCR7YmFzZW5hbWUobm9ybWFsaXplZFBhdHRlcm4sIGZpbGVFeHQpfS5zcGVjJHtmaWxlRXh0fWAsXG4gICAgICApO1xuXG4gICAgICBpZiAoYXdhaXQgZXhpc3RzKHBvdGVudGlhbFNwZWMpKSB7XG4gICAgICAgIHJldHVybiBbcG90ZW50aWFsU3BlY107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGdsb2Iobm9ybWFsaXplZFBhdHRlcm4sIHtcbiAgICBjd2Q6IHByb2plY3RTb3VyY2VSb290LFxuICAgIGFic29sdXRlOiB0cnVlLFxuICAgIGlnbm9yZTogWycqKi9ub2RlX21vZHVsZXMvKionLCAuLi5pZ25vcmVdLFxuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaXNEaXJlY3RvcnkocGF0aDogUGF0aExpa2UpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQocGF0aCk7XG5cbiAgICByZXR1cm4gc3RhdHMuaXNEaXJlY3RvcnkoKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4aXN0cyhwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGF3YWl0IGZzLmFjY2VzcyhwYXRoLCBjb25zdGFudHMuRl9PSyk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=