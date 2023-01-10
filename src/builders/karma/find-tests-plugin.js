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
        const { include = ['**/*.spec.ts'], projectSourceRoot, workspaceRoot } = this.options;
        const webpackOptions = compiler.options;
        const entry = typeof webpackOptions.entry === 'function' ? webpackOptions.entry() : webpackOptions.entry;
        let originalImport;
        // Add tests files are part of the entry-point.
        webpackOptions.entry = async () => {
            const specFiles = await findTests(include, workspaceRoot, projectSourceRoot);
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
async function findTests(patterns, workspaceRoot, projectSourceRoot) {
    const matchingTestsPromises = patterns.map((pattern) => findMatchingTests(pattern, workspaceRoot, projectSourceRoot));
    const files = await Promise.all(matchingTestsPromises);
    // Unique file names
    return [...new Set(files.flat())];
}
const normalizePath = (path) => path.replace(/\\/g, '/');
async function findMatchingTests(pattern, workspaceRoot, projectSourceRoot) {
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
        ignore: ['**/node_modules/**'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9maW5kLXRlc3RzLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILG9EQUE0QjtBQUM1QiwyQkFBeUQ7QUFDekQsNkNBQXNDO0FBQ3RDLCtCQUFrRTtBQUNsRSwrQkFBaUM7QUFFakMseUVBQTJEO0FBRTNELE1BQU0sV0FBVyxHQUFHLElBQUEsZ0JBQVMsRUFBQyxjQUFJLENBQUMsQ0FBQztBQUVwQzs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLDJCQUEyQixDQUFDO0FBUWhELE1BQWEsZUFBZTtJQUcxQixZQUFvQixPQUErQjtRQUEvQixZQUFPLEdBQVAsT0FBTyxDQUF3QjtJQUFHLENBQUM7SUFFdkQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFBRSxPQUFPLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQ3RGLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7UUFDeEMsTUFBTSxLQUFLLEdBQ1QsT0FBTyxjQUFjLENBQUMsS0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO1FBRTdGLElBQUksY0FBb0MsQ0FBQztRQUV6QywrQ0FBK0M7UUFDL0MsY0FBYyxDQUFDLEtBQUssR0FBRyxLQUFLLElBQUksRUFBRTtZQUNoQyxNQUFNLFNBQVMsR0FBRyxNQUFNLFNBQVMsQ0FBQyxPQUFPLEVBQUUsYUFBYSxFQUFFLGlC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QUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBQYXRoTGlrZSwgY29uc3RhbnRzLCBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCBnbG9iLCB7IGhhc01hZ2ljIH0gZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGFkZEVycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5cbmNvbnN0IGdsb2JQcm9taXNlID0gcHJvbWlzaWZ5KGdsb2IpO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnYW5ndWxhci1maW5kLXRlc3RzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmluZFRlc3RzUGx1Z2luT3B0aW9ucyB7XG4gIGluY2x1ZGU/OiBzdHJpbmdbXTtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBwcm9qZWN0U291cmNlUm9vdDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRmluZFRlc3RzUGx1Z2luIHtcbiAgcHJpdmF0ZSBjb21waWxhdGlvbjogQ29tcGlsYXRpb24gfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBGaW5kVGVzdHNQbHVnaW5PcHRpb25zKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgaW5jbHVkZSA9IFsnKiovKi5zcGVjLnRzJ10sIHByb2plY3RTb3VyY2VSb290LCB3b3Jrc3BhY2VSb290IH0gPSB0aGlzLm9wdGlvbnM7XG4gICAgY29uc3Qgd2VicGFja09wdGlvbnMgPSBjb21waWxlci5vcHRpb25zO1xuICAgIGNvbnN0IGVudHJ5ID1cbiAgICAgIHR5cGVvZiB3ZWJwYWNrT3B0aW9ucy5lbnRyeSA9PT0gJ2Z1bmN0aW9uJyA/IHdlYnBhY2tPcHRpb25zLmVudHJ5KCkgOiB3ZWJwYWNrT3B0aW9ucy5lbnRyeTtcblxuICAgIGxldCBvcmlnaW5hbEltcG9ydDogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBBZGQgdGVzdHMgZmlsZXMgYXJlIHBhcnQgb2YgdGhlIGVudHJ5LXBvaW50LlxuICAgIHdlYnBhY2tPcHRpb25zLmVudHJ5ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3Qgc3BlY0ZpbGVzID0gYXdhaXQgZmluZFRlc3RzKGluY2x1ZGUsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RTb3VyY2VSb290KTtcblxuICAgICAgaWYgKCFzcGVjRmlsZXMubGVuZ3RoKSB7XG4gICAgICAgIGFzc2VydCh0aGlzLmNvbXBpbGF0aW9uLCAnQ29tcGlsYXRpb24gY2Fubm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICAgICAgYWRkRXJyb3IoXG4gICAgICAgICAgdGhpcy5jb21waWxhdGlvbixcbiAgICAgICAgICBgU3BlY2lmaWVkIHBhdHRlcm5zOiBcIiR7aW5jbHVkZS5qb2luKCcsICcpfVwiIGRpZCBub3QgbWF0Y2ggYW55IHNwZWMgZmlsZXMuYCxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBhd2FpdCBlbnRyeTtcbiAgICAgIGNvbnN0IGVudHJ5cG9pbnQgPSBlbnRyeXBvaW50c1snbWFpbiddO1xuICAgICAgaWYgKCFlbnRyeXBvaW50LmltcG9ydCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kICdtYWluJyBlbnRyeXBvaW50LmApO1xuICAgICAgfVxuXG4gICAgICBvcmlnaW5hbEltcG9ydCA/Pz0gZW50cnlwb2ludC5pbXBvcnQ7XG4gICAgICBlbnRyeXBvaW50LmltcG9ydCA9IFsuLi5vcmlnaW5hbEltcG9ydCwgLi4uc3BlY0ZpbGVzXTtcblxuICAgICAgcmV0dXJuIGVudHJ5cG9pbnRzO1xuICAgIH07XG5cbiAgICBjb21waWxlci5ob29rcy50aGlzQ29tcGlsYXRpb24udGFwKFBMVUdJTl9OQU1FLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIHRoaXMuY29tcGlsYXRpb24gPSBjb21waWxhdGlvbjtcbiAgICAgIGNvbXBpbGF0aW9uLmNvbnRleHREZXBlbmRlbmNpZXMuYWRkKHByb2plY3RTb3VyY2VSb290KTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBnbyB0aHJvdWdoIGFsbCBwYXR0ZXJucyBhbmQgZmluZCB1bmlxdWUgbGlzdCBvZiBmaWxlc1xuYXN5bmMgZnVuY3Rpb24gZmluZFRlc3RzKFxuICBwYXR0ZXJuczogc3RyaW5nW10sXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFNvdXJjZVJvb3Q6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3QgbWF0Y2hpbmdUZXN0c1Byb21pc2VzID0gcGF0dGVybnMubWFwKChwYXR0ZXJuKSA9PlxuICAgIGZpbmRNYXRjaGluZ1Rlc3RzKHBhdHRlcm4sIHdvcmtzcGFjZVJvb3QsIHByb2plY3RTb3VyY2VSb290KSxcbiAgKTtcbiAgY29uc3QgZmlsZXMgPSBhd2FpdCBQcm9taXNlLmFsbChtYXRjaGluZ1Rlc3RzUHJvbWlzZXMpO1xuXG4gIC8vIFVuaXF1ZSBmaWxlIG5hbWVzXG4gIHJldHVybiBbLi4ubmV3IFNldChmaWxlcy5mbGF0KCkpXTtcbn1cblxuY29uc3Qgbm9ybWFsaXplUGF0aCA9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4gcGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbmRNYXRjaGluZ1Rlc3RzKFxuICBwYXR0ZXJuOiBzdHJpbmcsXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFNvdXJjZVJvb3Q6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgLy8gbm9ybWFsaXplIHBhdHRlcm4sIGdsb2IgbGliIG9ubHkgYWNjZXB0cyBmb3J3YXJkIHNsYXNoZXNcbiAgbGV0IG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplUGF0aChwYXR0ZXJuKTtcbiAgaWYgKG5vcm1hbGl6ZWRQYXR0ZXJuLmNoYXJBdCgwKSA9PT0gJy8nKSB7XG4gICAgbm9ybWFsaXplZFBhdHRlcm4gPSBub3JtYWxpemVkUGF0dGVybi5zdWJzdHJpbmcoMSk7XG4gIH1cblxuICBjb25zdCByZWxhdGl2ZVByb2plY3RSb290ID0gbm9ybWFsaXplUGF0aChyZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCkgKyAnLycpO1xuXG4gIC8vIHJlbW92ZSByZWxhdGl2ZVByb2plY3RSb290IHRvIHN1cHBvcnQgcmVsYXRpdmUgcGF0aHMgZnJvbSByb290XG4gIC8vIHN1Y2ggcGF0aHMgYXJlIGVhc3kgdG8gZ2V0IHdoZW4gcnVubmluZyBzY3JpcHRzIHZpYSBJREVzXG4gIGlmIChub3JtYWxpemVkUGF0dGVybi5zdGFydHNXaXRoKHJlbGF0aXZlUHJvamVjdFJvb3QpKSB7XG4gICAgbm9ybWFsaXplZFBhdHRlcm4gPSBub3JtYWxpemVkUGF0dGVybi5zdWJzdHJpbmcocmVsYXRpdmVQcm9qZWN0Um9vdC5sZW5ndGgpO1xuICB9XG5cbiAgLy8gc3BlY2lhbCBsb2dpYyB3aGVuIHBhdHRlcm4gZG9lcyBub3QgbG9vayBsaWtlIGEgZ2xvYlxuICBpZiAoIWhhc01hZ2ljKG5vcm1hbGl6ZWRQYXR0ZXJuKSkge1xuICAgIGlmIChhd2FpdCBpc0RpcmVjdG9yeShqb2luKHByb2plY3RTb3VyY2VSb290LCBub3JtYWxpemVkUGF0dGVybikpKSB7XG4gICAgICBub3JtYWxpemVkUGF0dGVybiA9IGAke25vcm1hbGl6ZWRQYXR0ZXJufS8qKi8qLnNwZWMuQCh0c3x0c3gpYDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc2VlIGlmIG1hdGNoaW5nIHNwZWMgZmlsZSBleGlzdHNcbiAgICAgIGNvbnN0IGZpbGVFeHQgPSBleHRuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuKTtcbiAgICAgIC8vIFJlcGxhY2UgZXh0ZW5zaW9uIHRvIGAuc3BlYy5leHRgLiBFeGFtcGxlOiBgc3JjL2FwcC9hcHAuY29tcG9uZW50LnRzYC0+IGBzcmMvYXBwL2FwcC5jb21wb25lbnQuc3BlYy50c2BcbiAgICAgIGNvbnN0IHBvdGVudGlhbFNwZWMgPSBqb2luKFxuICAgICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgICAgZGlybmFtZShub3JtYWxpemVkUGF0dGVybiksXG4gICAgICAgIGAke2Jhc2VuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuLCBmaWxlRXh0KX0uc3BlYyR7ZmlsZUV4dH1gLFxuICAgICAgKTtcblxuICAgICAgaWYgKGF3YWl0IGV4aXN0cyhwb3RlbnRpYWxTcGVjKSkge1xuICAgICAgICByZXR1cm4gW3BvdGVudGlhbFNwZWNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBnbG9iUHJvbWlzZShub3JtYWxpemVkUGF0dGVybiwge1xuICAgIGN3ZDogcHJvamVjdFNvdXJjZVJvb3QsXG4gICAgcm9vdDogcHJvamVjdFNvdXJjZVJvb3QsXG4gICAgbm9tb3VudDogdHJ1ZSxcbiAgICBhYnNvbHV0ZTogdHJ1ZSxcbiAgICBpZ25vcmU6IFsnKiovbm9kZV9tb2R1bGVzLyoqJ10sXG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpc0RpcmVjdG9yeShwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChwYXRoKTtcblxuICAgIHJldHVybiBzdGF0cy5pc0RpcmVjdG9yeSgpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhpc3RzKHBhdGg6IFBhdGhMaWtlKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZnMuYWNjZXNzKHBhdGgsIGNvbnN0YW50cy5GX09LKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==