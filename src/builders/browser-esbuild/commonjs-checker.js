"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCommonJSModules = void 0;
/**
 * Checks the input files of a build to determine if any of the files included
 * in the build are not ESM. ESM files can be tree-shaken and otherwise optimized
 * in ways that CommonJS and other module formats cannot. The esbuild metafile
 * information is used as the basis for the analysis as it contains information
 * for each input file including its respective format.
 *
 * If any allowed dependencies are provided via the `allowedCommonJsDependencies`
 * parameter, both the direct import and any deep imports will be ignored and no
 * diagnostic will be generated.
 *
 * If a module has been issued a diagnostic message, then all descendant modules
 * will not be checked. This prevents a potential massive amount of inactionable
 * messages since the initial module import is the cause of the problem.
 *
 * @param metafile An esbuild metafile object to check.
 * @param allowedCommonJsDependencies An optional list of allowed dependencies.
 * @returns Zero or more diagnostic messages for any non-ESM modules.
 */
function checkCommonJSModules(metafile, allowedCommonJsDependencies) {
    const messages = [];
    const allowedRequests = new Set(allowedCommonJsDependencies);
    // Ignore Angular locale definitions which are currently UMD
    allowedRequests.add('@angular/common/locales');
    // Find all entry points that contain code (JS/TS)
    const files = [];
    for (const { entryPoint } of Object.values(metafile.outputs)) {
        if (!entryPoint) {
            continue;
        }
        if (!isPathCode(entryPoint)) {
            continue;
        }
        files.push(entryPoint);
    }
    // Track seen files so they are only analyzed once.
    // Bundler runtime code is also ignored since it cannot be actionable.
    const seenFiles = new Set(['<runtime>']);
    // Analyze the files present by walking the import graph
    let currentFile;
    while ((currentFile = files.shift())) {
        const input = metafile.inputs[currentFile];
        for (const imported of input.imports) {
            // Ignore imports that were already seen or not originally in the code (bundler injected)
            if (!imported.original || seenFiles.has(imported.path)) {
                continue;
            }
            seenFiles.add(imported.path);
            // Only check actual code files
            if (!isPathCode(imported.path)) {
                continue;
            }
            // Check if the import is ESM format and issue a diagnostic if the file is not allowed
            if (metafile.inputs[imported.path].format !== 'esm') {
                const request = imported.original;
                let notAllowed = true;
                if (allowedRequests.has(request)) {
                    notAllowed = false;
                }
                else {
                    // Check for deep imports of allowed requests
                    for (const allowed of allowedRequests) {
                        if (request.startsWith(allowed + '/')) {
                            notAllowed = false;
                            break;
                        }
                    }
                }
                if (notAllowed) {
                    // Issue a diagnostic message and skip all descendants since they are also most
                    // likely not ESM but solved by addressing this import.
                    messages.push(createCommonJSModuleError(request, currentFile));
                    continue;
                }
            }
            // Add the path so that its imports can be checked
            files.push(imported.path);
        }
    }
    return messages;
}
exports.checkCommonJSModules = checkCommonJSModules;
/**
 * Determines if a file path has an extension that is a JavaScript or TypeScript
 * code file.
 *
 * @param name A path to check for code file extensions.
 * @returns True, if a code file path; false, otherwise.
 */
function isPathCode(name) {
    return /\.[cm]?[jt]sx?$/.test(name);
}
/**
 * Creates an esbuild diagnostic message for a given non-ESM module request.
 *
 * @param request The requested non-ESM module name.
 * @param importer The path of the file containing the import.
 * @returns A message representing the diagnostic.
 */
function createCommonJSModuleError(request, importer) {
    const error = {
        text: `Module '${request}' used by '${importer}' is not ESM`,
        notes: [
            {
                text: 'CommonJS or AMD dependencies can cause optimization bailouts.\n' +
                    'For more information see: https://angular.io/guide/build#configuring-commonjs-dependencies',
            },
        ],
    };
    return error;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uanMtY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9jb21tb25qcy1jaGVja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUlIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxTQUFnQixvQkFBb0IsQ0FDbEMsUUFBa0IsRUFDbEIsMkJBQXNDO0lBRXRDLE1BQU0sUUFBUSxHQUFxQixFQUFFLENBQUM7SUFDdEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUU3RCw0REFBNEQ7SUFDNUQsZUFBZSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBRS9DLGtEQUFrRDtJQUNsRCxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFDM0IsS0FBSyxNQUFNLEVBQUUsVUFBVSxFQUFFLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDNUQsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLFNBQVM7U0FDVjtRQUNELElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDM0IsU0FBUztTQUNWO1FBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUN4QjtJQUVELG1EQUFtRDtJQUNuRCxzRUFBc0U7SUFDdEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBRWpELHdEQUF3RDtJQUN4RCxJQUFJLFdBQStCLENBQUM7SUFDcEMsT0FBTyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRTtRQUNwQyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTNDLEtBQUssTUFBTSxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUNwQyx5RkFBeUY7WUFDekYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3RELFNBQVM7YUFDVjtZQUNELFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTdCLCtCQUErQjtZQUMvQixJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDOUIsU0FBUzthQUNWO1lBRUQsc0ZBQXNGO1lBQ3RGLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRTtnQkFDbkQsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQztnQkFFbEMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO2dCQUN0QixJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ2hDLFVBQVUsR0FBRyxLQUFLLENBQUM7aUJBQ3BCO3FCQUFNO29CQUNMLDZDQUE2QztvQkFDN0MsS0FBSyxNQUFNLE9BQU8sSUFBSSxlQUFlLEVBQUU7d0JBQ3JDLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLEVBQUU7NEJBQ3JDLFVBQVUsR0FBRyxLQUFLLENBQUM7NEJBQ25CLE1BQU07eUJBQ1A7cUJBQ0Y7aUJBQ0Y7Z0JBRUQsSUFBSSxVQUFVLEVBQUU7b0JBQ2QsK0VBQStFO29CQUMvRSx1REFBdUQ7b0JBQ3ZELFFBQVEsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7b0JBQy9ELFNBQVM7aUJBQ1Y7YUFDRjtZQUVELGtEQUFrRDtZQUNsRCxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMzQjtLQUNGO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQTNFRCxvREEyRUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLFVBQVUsQ0FBQyxJQUFZO0lBQzlCLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHlCQUF5QixDQUFDLE9BQWUsRUFBRSxRQUFnQjtJQUNsRSxNQUFNLEtBQUssR0FBRztRQUNaLElBQUksRUFBRSxXQUFXLE9BQU8sY0FBYyxRQUFRLGNBQWM7UUFDNUQsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUNGLGlFQUFpRTtvQkFDakUsNEZBQTRGO2FBQy9GO1NBQ0Y7S0FDRixDQUFDO0lBRUYsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgTWV0YWZpbGUsIFBhcnRpYWxNZXNzYWdlIH0gZnJvbSAnZXNidWlsZCc7XG5cbi8qKlxuICogQ2hlY2tzIHRoZSBpbnB1dCBmaWxlcyBvZiBhIGJ1aWxkIHRvIGRldGVybWluZSBpZiBhbnkgb2YgdGhlIGZpbGVzIGluY2x1ZGVkXG4gKiBpbiB0aGUgYnVpbGQgYXJlIG5vdCBFU00uIEVTTSBmaWxlcyBjYW4gYmUgdHJlZS1zaGFrZW4gYW5kIG90aGVyd2lzZSBvcHRpbWl6ZWRcbiAqIGluIHdheXMgdGhhdCBDb21tb25KUyBhbmQgb3RoZXIgbW9kdWxlIGZvcm1hdHMgY2Fubm90LiBUaGUgZXNidWlsZCBtZXRhZmlsZVxuICogaW5mb3JtYXRpb24gaXMgdXNlZCBhcyB0aGUgYmFzaXMgZm9yIHRoZSBhbmFseXNpcyBhcyBpdCBjb250YWlucyBpbmZvcm1hdGlvblxuICogZm9yIGVhY2ggaW5wdXQgZmlsZSBpbmNsdWRpbmcgaXRzIHJlc3BlY3RpdmUgZm9ybWF0LlxuICpcbiAqIElmIGFueSBhbGxvd2VkIGRlcGVuZGVuY2llcyBhcmUgcHJvdmlkZWQgdmlhIHRoZSBgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzYFxuICogcGFyYW1ldGVyLCBib3RoIHRoZSBkaXJlY3QgaW1wb3J0IGFuZCBhbnkgZGVlcCBpbXBvcnRzIHdpbGwgYmUgaWdub3JlZCBhbmQgbm9cbiAqIGRpYWdub3N0aWMgd2lsbCBiZSBnZW5lcmF0ZWQuXG4gKlxuICogSWYgYSBtb2R1bGUgaGFzIGJlZW4gaXNzdWVkIGEgZGlhZ25vc3RpYyBtZXNzYWdlLCB0aGVuIGFsbCBkZXNjZW5kYW50IG1vZHVsZXNcbiAqIHdpbGwgbm90IGJlIGNoZWNrZWQuIFRoaXMgcHJldmVudHMgYSBwb3RlbnRpYWwgbWFzc2l2ZSBhbW91bnQgb2YgaW5hY3Rpb25hYmxlXG4gKiBtZXNzYWdlcyBzaW5jZSB0aGUgaW5pdGlhbCBtb2R1bGUgaW1wb3J0IGlzIHRoZSBjYXVzZSBvZiB0aGUgcHJvYmxlbS5cbiAqXG4gKiBAcGFyYW0gbWV0YWZpbGUgQW4gZXNidWlsZCBtZXRhZmlsZSBvYmplY3QgdG8gY2hlY2suXG4gKiBAcGFyYW0gYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzIEFuIG9wdGlvbmFsIGxpc3Qgb2YgYWxsb3dlZCBkZXBlbmRlbmNpZXMuXG4gKiBAcmV0dXJucyBaZXJvIG9yIG1vcmUgZGlhZ25vc3RpYyBtZXNzYWdlcyBmb3IgYW55IG5vbi1FU00gbW9kdWxlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrQ29tbW9uSlNNb2R1bGVzKFxuICBtZXRhZmlsZTogTWV0YWZpbGUsXG4gIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcz86IHN0cmluZ1tdLFxuKTogUGFydGlhbE1lc3NhZ2VbXSB7XG4gIGNvbnN0IG1lc3NhZ2VzOiBQYXJ0aWFsTWVzc2FnZVtdID0gW107XG4gIGNvbnN0IGFsbG93ZWRSZXF1ZXN0cyA9IG5ldyBTZXQoYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKTtcblxuICAvLyBJZ25vcmUgQW5ndWxhciBsb2NhbGUgZGVmaW5pdGlvbnMgd2hpY2ggYXJlIGN1cnJlbnRseSBVTURcbiAgYWxsb3dlZFJlcXVlc3RzLmFkZCgnQGFuZ3VsYXIvY29tbW9uL2xvY2FsZXMnKTtcblxuICAvLyBGaW5kIGFsbCBlbnRyeSBwb2ludHMgdGhhdCBjb250YWluIGNvZGUgKEpTL1RTKVxuICBjb25zdCBmaWxlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCB7IGVudHJ5UG9pbnQgfSBvZiBPYmplY3QudmFsdWVzKG1ldGFmaWxlLm91dHB1dHMpKSB7XG4gICAgaWYgKCFlbnRyeVBvaW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFpc1BhdGhDb2RlKGVudHJ5UG9pbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBmaWxlcy5wdXNoKGVudHJ5UG9pbnQpO1xuICB9XG5cbiAgLy8gVHJhY2sgc2VlbiBmaWxlcyBzbyB0aGV5IGFyZSBvbmx5IGFuYWx5emVkIG9uY2UuXG4gIC8vIEJ1bmRsZXIgcnVudGltZSBjb2RlIGlzIGFsc28gaWdub3JlZCBzaW5jZSBpdCBjYW5ub3QgYmUgYWN0aW9uYWJsZS5cbiAgY29uc3Qgc2VlbkZpbGVzID0gbmV3IFNldDxzdHJpbmc+KFsnPHJ1bnRpbWU+J10pO1xuXG4gIC8vIEFuYWx5emUgdGhlIGZpbGVzIHByZXNlbnQgYnkgd2Fsa2luZyB0aGUgaW1wb3J0IGdyYXBoXG4gIGxldCBjdXJyZW50RmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICB3aGlsZSAoKGN1cnJlbnRGaWxlID0gZmlsZXMuc2hpZnQoKSkpIHtcbiAgICBjb25zdCBpbnB1dCA9IG1ldGFmaWxlLmlucHV0c1tjdXJyZW50RmlsZV07XG5cbiAgICBmb3IgKGNvbnN0IGltcG9ydGVkIG9mIGlucHV0LmltcG9ydHMpIHtcbiAgICAgIC8vIElnbm9yZSBpbXBvcnRzIHRoYXQgd2VyZSBhbHJlYWR5IHNlZW4gb3Igbm90IG9yaWdpbmFsbHkgaW4gdGhlIGNvZGUgKGJ1bmRsZXIgaW5qZWN0ZWQpXG4gICAgICBpZiAoIWltcG9ydGVkLm9yaWdpbmFsIHx8IHNlZW5GaWxlcy5oYXMoaW1wb3J0ZWQucGF0aCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBzZWVuRmlsZXMuYWRkKGltcG9ydGVkLnBhdGgpO1xuXG4gICAgICAvLyBPbmx5IGNoZWNrIGFjdHVhbCBjb2RlIGZpbGVzXG4gICAgICBpZiAoIWlzUGF0aENvZGUoaW1wb3J0ZWQucGF0aCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGlmIHRoZSBpbXBvcnQgaXMgRVNNIGZvcm1hdCBhbmQgaXNzdWUgYSBkaWFnbm9zdGljIGlmIHRoZSBmaWxlIGlzIG5vdCBhbGxvd2VkXG4gICAgICBpZiAobWV0YWZpbGUuaW5wdXRzW2ltcG9ydGVkLnBhdGhdLmZvcm1hdCAhPT0gJ2VzbScpIHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IGltcG9ydGVkLm9yaWdpbmFsO1xuXG4gICAgICAgIGxldCBub3RBbGxvd2VkID0gdHJ1ZTtcbiAgICAgICAgaWYgKGFsbG93ZWRSZXF1ZXN0cy5oYXMocmVxdWVzdCkpIHtcbiAgICAgICAgICBub3RBbGxvd2VkID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIGRlZXAgaW1wb3J0cyBvZiBhbGxvd2VkIHJlcXVlc3RzXG4gICAgICAgICAgZm9yIChjb25zdCBhbGxvd2VkIG9mIGFsbG93ZWRSZXF1ZXN0cykge1xuICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhcnRzV2l0aChhbGxvd2VkICsgJy8nKSkge1xuICAgICAgICAgICAgICBub3RBbGxvd2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub3RBbGxvd2VkKSB7XG4gICAgICAgICAgLy8gSXNzdWUgYSBkaWFnbm9zdGljIG1lc3NhZ2UgYW5kIHNraXAgYWxsIGRlc2NlbmRhbnRzIHNpbmNlIHRoZXkgYXJlIGFsc28gbW9zdFxuICAgICAgICAgIC8vIGxpa2VseSBub3QgRVNNIGJ1dCBzb2x2ZWQgYnkgYWRkcmVzc2luZyB0aGlzIGltcG9ydC5cbiAgICAgICAgICBtZXNzYWdlcy5wdXNoKGNyZWF0ZUNvbW1vbkpTTW9kdWxlRXJyb3IocmVxdWVzdCwgY3VycmVudEZpbGUpKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIHBhdGggc28gdGhhdCBpdHMgaW1wb3J0cyBjYW4gYmUgY2hlY2tlZFxuICAgICAgZmlsZXMucHVzaChpbXBvcnRlZC5wYXRoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWVzc2FnZXM7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiBhIGZpbGUgcGF0aCBoYXMgYW4gZXh0ZW5zaW9uIHRoYXQgaXMgYSBKYXZhU2NyaXB0IG9yIFR5cGVTY3JpcHRcbiAqIGNvZGUgZmlsZS5cbiAqXG4gKiBAcGFyYW0gbmFtZSBBIHBhdGggdG8gY2hlY2sgZm9yIGNvZGUgZmlsZSBleHRlbnNpb25zLlxuICogQHJldHVybnMgVHJ1ZSwgaWYgYSBjb2RlIGZpbGUgcGF0aDsgZmFsc2UsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaXNQYXRoQ29kZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9cXC5bY21dP1tqdF1zeD8kLy50ZXN0KG5hbWUpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgZm9yIGEgZ2l2ZW4gbm9uLUVTTSBtb2R1bGUgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdGVkIG5vbi1FU00gbW9kdWxlIG5hbWUuXG4gKiBAcGFyYW0gaW1wb3J0ZXIgVGhlIHBhdGggb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW1wb3J0LlxuICogQHJldHVybnMgQSBtZXNzYWdlIHJlcHJlc2VudGluZyB0aGUgZGlhZ25vc3RpYy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ29tbW9uSlNNb2R1bGVFcnJvcihyZXF1ZXN0OiBzdHJpbmcsIGltcG9ydGVyOiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBNb2R1bGUgJyR7cmVxdWVzdH0nIHVzZWQgYnkgJyR7aW1wb3J0ZXJ9JyBpcyBub3QgRVNNYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OlxuICAgICAgICAgICdDb21tb25KUyBvciBBTUQgZGVwZW5kZW5jaWVzIGNhbiBjYXVzZSBvcHRpbWl6YXRpb24gYmFpbG91dHMuXFxuJyArXG4gICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uIHNlZTogaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWNvbW1vbmpzLWRlcGVuZGVuY2llcycsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19