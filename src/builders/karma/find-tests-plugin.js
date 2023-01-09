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
const fs_1 = require("fs");
const glob_1 = __importStar(require("glob"));
const path_1 = require("path");
const util_1 = require("util");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const globPromise = (0, util_1.promisify)(glob_1.default);
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
            if (!specFiles.length) {
                (0, assert_1.default)(this.compilation, 'Compilation cannot be undefined.');
                (0, webpack_diagnostics_1.addError)(this.compilation, `Specified patterns: "${include.join(', ')}" did not match any spec files.`);
            }
            const entrypoints = await entry;
            const entrypoint = entrypoints['main'];
            if (!entrypoint.import) {
                throw new Error(`Cannot find 'main' entrypoint.`);
            }
            originalImport !== null && originalImport !== void 0 ? originalImport : (originalImport = entrypoint.import);
            entrypoint.import = [...originalImport, ...specFiles];
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
    if (!(0, glob_1.hasMagic)(normalizedPattern)) {
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
    return globPromise(normalizedPattern, {
        cwd: projectSourceRoot,
        root: projectSourceRoot,
        nomount: true,
        absolute: true,
        ignore: ['**/node_modules/**', ...ignore],
    });
}
async function isDirectory(path) {
    try {
        const stats = await fs_1.promises.stat(path);
        return stats.isDirectory();
    }
    catch (_a) {
        return false;
    }
}
async function exists(path) {
    try {
        await fs_1.promises.access(path, fs_1.constants.F_OK);
        return true;
    }
    catch (_a) {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9maW5kLXRlc3RzLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILG9EQUE0QjtBQUM1QiwyQkFBeUQ7QUFDekQsNkNBQXNDO0FBQ3RDLCtCQUFrRTtBQUNsRSwrQkFBaUM7QUFFakMseUVBQTJEO0FBRTNELE1BQU0sV0FBVyxHQUFHLElBQUEsZ0JBQVMsRUFBQyxjQUFJLENBQUMsQ0FBQztBQUVwQzs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLDJCQUEyQixDQUFDO0FBU2hELE1BQWEsZUFBZTtJQUcxQixZQUFvQixPQUErQjtRQUEvQixZQUFPLEdBQVAsT0FBTyxDQUF3QjtJQUFHLENBQUM7SUFFdkQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFDSixPQUFPLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFDMUIsT0FBTyxHQUFHLEVBQUUsRUFDWixpQkFBaUIsRUFDakIsYUFBYSxHQUNkLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNqQixNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO1FBQ3hDLE1BQU0sS0FBSyxHQUNULE9BQU8sY0FBYyxDQUFDLEtBQUssS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztRQUU3RixJQUFJLGNBQW9DLENBQUM7UUFFekMsK0NBQStDO1FBQy9DLGNBQWMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDaEMsTUFBTSxTQUFTLEdBQUcsTUFBTSxTQUFTLENBQUMs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QUFDLElBQUksRUFBRSxjQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUFDLFdBQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBQYXRoTGlrZSwgY29uc3RhbnRzLCBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCBnbG9iLCB7IGhhc01hZ2ljIH0gZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGFkZEVycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5cbmNvbnN0IGdsb2JQcm9taXNlID0gcHJvbWlzaWZ5KGdsb2IpO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnYW5ndWxhci1maW5kLXRlc3RzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmluZFRlc3RzUGx1Z2luT3B0aW9ucyB7XG4gIGluY2x1ZGU/OiBzdHJpbmdbXTtcbiAgZXhjbHVkZT86IHN0cmluZ1tdO1xuICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBGaW5kVGVzdHNQbHVnaW4ge1xuICBwcml2YXRlIGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG9wdGlvbnM6IEZpbmRUZXN0c1BsdWdpbk9wdGlvbnMpIHt9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB7XG4gICAgY29uc3Qge1xuICAgICAgaW5jbHVkZSA9IFsnKiovKi5zcGVjLnRzJ10sXG4gICAgICBleGNsdWRlID0gW10sXG4gICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgfSA9IHRoaXMub3B0aW9ucztcbiAgICBjb25zdCB3ZWJwYWNrT3B0aW9ucyA9IGNvbXBpbGVyLm9wdGlvbnM7XG4gICAgY29uc3QgZW50cnkgPVxuICAgICAgdHlwZW9mIHdlYnBhY2tPcHRpb25zLmVudHJ5ID09PSAnZnVuY3Rpb24nID8gd2VicGFja09wdGlvbnMuZW50cnkoKSA6IHdlYnBhY2tPcHRpb25zLmVudHJ5O1xuXG4gICAgbGV0IG9yaWdpbmFsSW1wb3J0OiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblxuICAgIC8vIEFkZCB0ZXN0cyBmaWxlcyBhcmUgcGFydCBvZiB0aGUgZW50cnktcG9pbnQuXG4gICAgd2VicGFja09wdGlvbnMuZW50cnkgPSBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBzcGVjRmlsZXMgPSBhd2FpdCBmaW5kVGVzdHMoaW5jbHVkZSwgZXhjbHVkZSwgd29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpO1xuXG4gICAgICBpZiAoIXNwZWNGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuY29tcGlsYXRpb24sICdDb21waWxhdGlvbiBjYW5ub3QgYmUgdW5kZWZpbmVkLicpO1xuICAgICAgICBhZGRFcnJvcihcbiAgICAgICAgICB0aGlzLmNvbXBpbGF0aW9uLFxuICAgICAgICAgIGBTcGVjaWZpZWQgcGF0dGVybnM6IFwiJHtpbmNsdWRlLmpvaW4oJywgJyl9XCIgZGlkIG5vdCBtYXRjaCBhbnkgc3BlYyBmaWxlcy5gLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGF3YWl0IGVudHJ5O1xuICAgICAgY29uc3QgZW50cnlwb2ludCA9IGVudHJ5cG9pbnRzWydtYWluJ107XG4gICAgICBpZiAoIWVudHJ5cG9pbnQuaW1wb3J0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGZpbmQgJ21haW4nIGVudHJ5cG9pbnQuYCk7XG4gICAgICB9XG5cbiAgICAgIG9yaWdpbmFsSW1wb3J0ID8/PSBlbnRyeXBvaW50LmltcG9ydDtcbiAgICAgIGVudHJ5cG9pbnQuaW1wb3J0ID0gWy4uLm9yaWdpbmFsSW1wb3J0LCAuLi5zcGVjRmlsZXNdO1xuXG4gICAgICByZXR1cm4gZW50cnlwb2ludHM7XG4gICAgfTtcblxuICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgdGhpcy5jb21waWxhdGlvbiA9IGNvbXBpbGF0aW9uO1xuICAgICAgY29tcGlsYXRpb24uY29udGV4dERlcGVuZGVuY2llcy5hZGQocHJvamVjdFNvdXJjZVJvb3QpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIGdvIHRocm91Z2ggYWxsIHBhdHRlcm5zIGFuZCBmaW5kIHVuaXF1ZSBsaXN0IG9mIGZpbGVzXG5hc3luYyBmdW5jdGlvbiBmaW5kVGVzdHMoXG4gIGluY2x1ZGU6IHN0cmluZ1tdLFxuICBleGNsdWRlOiBzdHJpbmdbXSxcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0U291cmNlUm9vdDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCBtYXRjaGluZ1Rlc3RzUHJvbWlzZXMgPSBpbmNsdWRlLm1hcCgocGF0dGVybikgPT5cbiAgICBmaW5kTWF0Y2hpbmdUZXN0cyhwYXR0ZXJuLCBleGNsdWRlLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCksXG4gICk7XG4gIGNvbnN0IGZpbGVzID0gYXdhaXQgUHJvbWlzZS5hbGwobWF0Y2hpbmdUZXN0c1Byb21pc2VzKTtcblxuICAvLyBVbmlxdWUgZmlsZSBuYW1lc1xuICByZXR1cm4gWy4uLm5ldyBTZXQoZmlsZXMuZmxhdCgpKV07XG59XG5cbmNvbnN0IG5vcm1hbGl6ZVBhdGggPSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+IHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG5hc3luYyBmdW5jdGlvbiBmaW5kTWF0Y2hpbmdUZXN0cyhcbiAgcGF0dGVybjogc3RyaW5nLFxuICBpZ25vcmU6IHN0cmluZ1tdLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIC8vIG5vcm1hbGl6ZSBwYXR0ZXJuLCBnbG9iIGxpYiBvbmx5IGFjY2VwdHMgZm9yd2FyZCBzbGFzaGVzXG4gIGxldCBub3JtYWxpemVkUGF0dGVybiA9IG5vcm1hbGl6ZVBhdGgocGF0dGVybik7XG4gIGlmIChub3JtYWxpemVkUGF0dGVybi5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplZFBhdHRlcm4uc3Vic3RyaW5nKDEpO1xuICB9XG5cbiAgY29uc3QgcmVsYXRpdmVQcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZVBhdGgocmVsYXRpdmUod29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpICsgJy8nKTtcblxuICAvLyByZW1vdmUgcmVsYXRpdmVQcm9qZWN0Um9vdCB0byBzdXBwb3J0IHJlbGF0aXZlIHBhdGhzIGZyb20gcm9vdFxuICAvLyBzdWNoIHBhdGhzIGFyZSBlYXN5IHRvIGdldCB3aGVuIHJ1bm5pbmcgc2NyaXB0cyB2aWEgSURFc1xuICBpZiAobm9ybWFsaXplZFBhdHRlcm4uc3RhcnRzV2l0aChyZWxhdGl2ZVByb2plY3RSb290KSkge1xuICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplZFBhdHRlcm4uc3Vic3RyaW5nKHJlbGF0aXZlUHJvamVjdFJvb3QubGVuZ3RoKTtcbiAgfVxuXG4gIC8vIHNwZWNpYWwgbG9naWMgd2hlbiBwYXR0ZXJuIGRvZXMgbm90IGxvb2sgbGlrZSBhIGdsb2JcbiAgaWYgKCFoYXNNYWdpYyhub3JtYWxpemVkUGF0dGVybikpIHtcbiAgICBpZiAoYXdhaXQgaXNEaXJlY3Rvcnkoam9pbihwcm9qZWN0U291cmNlUm9vdCwgbm9ybWFsaXplZFBhdHRlcm4pKSkge1xuICAgICAgbm9ybWFsaXplZFBhdHRlcm4gPSBgJHtub3JtYWxpemVkUGF0dGVybn0vKiovKi5zcGVjLkAodHN8dHN4KWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNlZSBpZiBtYXRjaGluZyBzcGVjIGZpbGUgZXhpc3RzXG4gICAgICBjb25zdCBmaWxlRXh0ID0gZXh0bmFtZShub3JtYWxpemVkUGF0dGVybik7XG4gICAgICAvLyBSZXBsYWNlIGV4dGVuc2lvbiB0byBgLnNwZWMuZXh0YC4gRXhhbXBsZTogYHNyYy9hcHAvYXBwLmNvbXBvbmVudC50c2AtPiBgc3JjL2FwcC9hcHAuY29tcG9uZW50LnNwZWMudHNgXG4gICAgICBjb25zdCBwb3RlbnRpYWxTcGVjID0gam9pbihcbiAgICAgICAgcHJvamVjdFNvdXJjZVJvb3QsXG4gICAgICAgIGRpcm5hbWUobm9ybWFsaXplZFBhdHRlcm4pLFxuICAgICAgICBgJHtiYXNlbmFtZShub3JtYWxpemVkUGF0dGVybiwgZmlsZUV4dCl9LnNwZWMke2ZpbGVFeHR9YCxcbiAgICAgICk7XG5cbiAgICAgIGlmIChhd2FpdCBleGlzdHMocG90ZW50aWFsU3BlYykpIHtcbiAgICAgICAgcmV0dXJuIFtwb3RlbnRpYWxTcGVjXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZ2xvYlByb21pc2Uobm9ybWFsaXplZFBhdHRlcm4sIHtcbiAgICBjd2Q6IHByb2plY3RTb3VyY2VSb290LFxuICAgIHJvb3Q6IHByb2plY3RTb3VyY2VSb290LFxuICAgIG5vbW91bnQ6IHRydWUsXG4gICAgYWJzb2x1dGU6IHRydWUsXG4gICAgaWdub3JlOiBbJyoqL25vZGVfbW9kdWxlcy8qKicsIC4uLmlnbm9yZV0sXG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpc0RpcmVjdG9yeShwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChwYXRoKTtcblxuICAgIHJldHVybiBzdGF0cy5pc0RpcmVjdG9yeSgpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhpc3RzKHBhdGg6IFBhdGhMaWtlKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZnMuYWNjZXNzKHBhdGgsIGNvbnN0YW50cy5GX09LKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==