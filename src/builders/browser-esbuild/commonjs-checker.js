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
    // Ignore zone.js due to it currently being built with a UMD like structure.
    // Once the build output is updated to be fully ESM, this can be removed.
    allowedRequests.add('zone.js');
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
            // Check if non-relative import is ESM format and issue a diagnostic if the file is not allowed
            if (!isPotentialRelative(imported.original) &&
                metafile.inputs[imported.path].format !== 'esm') {
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
 * Test an import module specifier to determine if the string potentially references a relative file.
 * npm packages should not start with a period so if the first character is a period than it is not a
 * package. While this is sufficient for the use case in the CommmonJS checker, only checking the
 * first character does not definitely indicate the specifier is a relative path.
 *
 * @param specifier An import module specifier.
 * @returns True, if specifier is potentially relative; false, otherwise.
 */
function isPotentialRelative(specifier) {
    if (specifier[0] === '.') {
        return true;
    }
    return false;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uanMtY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9jb21tb25qcy1jaGVja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUlIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxTQUFnQixvQkFBb0IsQ0FDbEMsUUFBa0IsRUFDbEIsMkJBQXNDO0lBRXRDLE1BQU0sUUFBUSxHQUFxQixFQUFFLENBQUM7SUFDdEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUU3RCw0REFBNEQ7SUFDNUQsZUFBZSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBRS9DLDRFQUE0RTtJQUM1RSx5RUFBeUU7SUFDekUsZUFBZSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUUvQixrREFBa0Q7SUFDbEQsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO0lBQzNCLEtBQUssTUFBTSxFQUFFLFVBQVUsRUFBRSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzVELElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixTQUFTO1NBQ1Y7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQzNCLFNBQVM7U0FDVjtRQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDeEI7SUFFRCxtREFBbUQ7SUFDbkQsc0VBQXNFO0lBQ3RFLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUVqRCx3REFBd0Q7SUFDeEQsSUFBSSxXQUErQixDQUFDO0lBQ3BDLE9BQU8sQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUU7UUFDcEMsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUzQyxLQUFLLE1BQU0sUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUU7WUFDcEMseUZBQXlGO1lBQ3pGLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN0RCxTQUFTO2FBQ1Y7WUFDRCxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3QiwrQkFBK0I7WUFDL0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlCLFNBQVM7YUFDVjtZQUVELCtGQUErRjtZQUMvRixJQUNFLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztnQkFDdkMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLEtBQUssRUFDL0M7Z0JBQ0EsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQztnQkFFbEMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO2dCQUN0QixJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ2hDLFVBQVUsR0FBRyxLQUFLLENBQUM7aUJBQ3BCO3FCQUFNO29CQUNMLDZDQUE2QztvQkFDN0MsS0FBSyxNQUFNLE9BQU8sSUFBSSxlQUFlLEVBQUU7d0JBQ3JDLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLEVBQUU7NEJBQ3JDLFVBQVUsR0FBRyxLQUFLLENBQUM7NEJBQ25CLE1BQU07eUJBQ1A7cUJBQ0Y7aUJBQ0Y7Z0JBRUQsSUFBSSxVQUFVLEVBQUU7b0JBQ2QsK0VBQStFO29CQUMvRSx1REFBdUQ7b0JBQ3ZELFFBQVEsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7b0JBQy9ELFNBQVM7aUJBQ1Y7YUFDRjtZQUVELGtEQUFrRDtZQUNsRCxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMzQjtLQUNGO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQWxGRCxvREFrRkM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLFVBQVUsQ0FBQyxJQUFZO0lBQzlCLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILFNBQVMsbUJBQW1CLENBQUMsU0FBaUI7SUFDNUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQ3hCLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFTLHlCQUF5QixDQUFDLE9BQWUsRUFBRSxRQUFnQjtJQUNsRSxNQUFNLEtBQUssR0FBRztRQUNaLElBQUksRUFBRSxXQUFXLE9BQU8sY0FBYyxRQUFRLGNBQWM7UUFDNUQsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUNGLGlFQUFpRTtvQkFDakUsNEZBQTRGO2FBQy9GO1NBQ0Y7S0FDRixDQUFDO0lBRUYsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgTWV0YWZpbGUsIFBhcnRpYWxNZXNzYWdlIH0gZnJvbSAnZXNidWlsZCc7XG5cbi8qKlxuICogQ2hlY2tzIHRoZSBpbnB1dCBmaWxlcyBvZiBhIGJ1aWxkIHRvIGRldGVybWluZSBpZiBhbnkgb2YgdGhlIGZpbGVzIGluY2x1ZGVkXG4gKiBpbiB0aGUgYnVpbGQgYXJlIG5vdCBFU00uIEVTTSBmaWxlcyBjYW4gYmUgdHJlZS1zaGFrZW4gYW5kIG90aGVyd2lzZSBvcHRpbWl6ZWRcbiAqIGluIHdheXMgdGhhdCBDb21tb25KUyBhbmQgb3RoZXIgbW9kdWxlIGZvcm1hdHMgY2Fubm90LiBUaGUgZXNidWlsZCBtZXRhZmlsZVxuICogaW5mb3JtYXRpb24gaXMgdXNlZCBhcyB0aGUgYmFzaXMgZm9yIHRoZSBhbmFseXNpcyBhcyBpdCBjb250YWlucyBpbmZvcm1hdGlvblxuICogZm9yIGVhY2ggaW5wdXQgZmlsZSBpbmNsdWRpbmcgaXRzIHJlc3BlY3RpdmUgZm9ybWF0LlxuICpcbiAqIElmIGFueSBhbGxvd2VkIGRlcGVuZGVuY2llcyBhcmUgcHJvdmlkZWQgdmlhIHRoZSBgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzYFxuICogcGFyYW1ldGVyLCBib3RoIHRoZSBkaXJlY3QgaW1wb3J0IGFuZCBhbnkgZGVlcCBpbXBvcnRzIHdpbGwgYmUgaWdub3JlZCBhbmQgbm9cbiAqIGRpYWdub3N0aWMgd2lsbCBiZSBnZW5lcmF0ZWQuXG4gKlxuICogSWYgYSBtb2R1bGUgaGFzIGJlZW4gaXNzdWVkIGEgZGlhZ25vc3RpYyBtZXNzYWdlLCB0aGVuIGFsbCBkZXNjZW5kYW50IG1vZHVsZXNcbiAqIHdpbGwgbm90IGJlIGNoZWNrZWQuIFRoaXMgcHJldmVudHMgYSBwb3RlbnRpYWwgbWFzc2l2ZSBhbW91bnQgb2YgaW5hY3Rpb25hYmxlXG4gKiBtZXNzYWdlcyBzaW5jZSB0aGUgaW5pdGlhbCBtb2R1bGUgaW1wb3J0IGlzIHRoZSBjYXVzZSBvZiB0aGUgcHJvYmxlbS5cbiAqXG4gKiBAcGFyYW0gbWV0YWZpbGUgQW4gZXNidWlsZCBtZXRhZmlsZSBvYmplY3QgdG8gY2hlY2suXG4gKiBAcGFyYW0gYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzIEFuIG9wdGlvbmFsIGxpc3Qgb2YgYWxsb3dlZCBkZXBlbmRlbmNpZXMuXG4gKiBAcmV0dXJucyBaZXJvIG9yIG1vcmUgZGlhZ25vc3RpYyBtZXNzYWdlcyBmb3IgYW55IG5vbi1FU00gbW9kdWxlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrQ29tbW9uSlNNb2R1bGVzKFxuICBtZXRhZmlsZTogTWV0YWZpbGUsXG4gIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcz86IHN0cmluZ1tdLFxuKTogUGFydGlhbE1lc3NhZ2VbXSB7XG4gIGNvbnN0IG1lc3NhZ2VzOiBQYXJ0aWFsTWVzc2FnZVtdID0gW107XG4gIGNvbnN0IGFsbG93ZWRSZXF1ZXN0cyA9IG5ldyBTZXQoYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKTtcblxuICAvLyBJZ25vcmUgQW5ndWxhciBsb2NhbGUgZGVmaW5pdGlvbnMgd2hpY2ggYXJlIGN1cnJlbnRseSBVTURcbiAgYWxsb3dlZFJlcXVlc3RzLmFkZCgnQGFuZ3VsYXIvY29tbW9uL2xvY2FsZXMnKTtcblxuICAvLyBJZ25vcmUgem9uZS5qcyBkdWUgdG8gaXQgY3VycmVudGx5IGJlaW5nIGJ1aWx0IHdpdGggYSBVTUQgbGlrZSBzdHJ1Y3R1cmUuXG4gIC8vIE9uY2UgdGhlIGJ1aWxkIG91dHB1dCBpcyB1cGRhdGVkIHRvIGJlIGZ1bGx5IEVTTSwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgYWxsb3dlZFJlcXVlc3RzLmFkZCgnem9uZS5qcycpO1xuXG4gIC8vIEZpbmQgYWxsIGVudHJ5IHBvaW50cyB0aGF0IGNvbnRhaW4gY29kZSAoSlMvVFMpXG4gIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHsgZW50cnlQb2ludCB9IG9mIE9iamVjdC52YWx1ZXMobWV0YWZpbGUub3V0cHV0cykpIHtcbiAgICBpZiAoIWVudHJ5UG9pbnQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoIWlzUGF0aENvZGUoZW50cnlQb2ludCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGZpbGVzLnB1c2goZW50cnlQb2ludCk7XG4gIH1cblxuICAvLyBUcmFjayBzZWVuIGZpbGVzIHNvIHRoZXkgYXJlIG9ubHkgYW5hbHl6ZWQgb25jZS5cbiAgLy8gQnVuZGxlciBydW50aW1lIGNvZGUgaXMgYWxzbyBpZ25vcmVkIHNpbmNlIGl0IGNhbm5vdCBiZSBhY3Rpb25hYmxlLlxuICBjb25zdCBzZWVuRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oWyc8cnVudGltZT4nXSk7XG5cbiAgLy8gQW5hbHl6ZSB0aGUgZmlsZXMgcHJlc2VudCBieSB3YWxraW5nIHRoZSBpbXBvcnQgZ3JhcGhcbiAgbGV0IGN1cnJlbnRGaWxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIHdoaWxlICgoY3VycmVudEZpbGUgPSBmaWxlcy5zaGlmdCgpKSkge1xuICAgIGNvbnN0IGlucHV0ID0gbWV0YWZpbGUuaW5wdXRzW2N1cnJlbnRGaWxlXTtcblxuICAgIGZvciAoY29uc3QgaW1wb3J0ZWQgb2YgaW5wdXQuaW1wb3J0cykge1xuICAgICAgLy8gSWdub3JlIGltcG9ydHMgdGhhdCB3ZXJlIGFscmVhZHkgc2VlbiBvciBub3Qgb3JpZ2luYWxseSBpbiB0aGUgY29kZSAoYnVuZGxlciBpbmplY3RlZClcbiAgICAgIGlmICghaW1wb3J0ZWQub3JpZ2luYWwgfHwgc2VlbkZpbGVzLmhhcyhpbXBvcnRlZC5wYXRoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHNlZW5GaWxlcy5hZGQoaW1wb3J0ZWQucGF0aCk7XG5cbiAgICAgIC8vIE9ubHkgY2hlY2sgYWN0dWFsIGNvZGUgZmlsZXNcbiAgICAgIGlmICghaXNQYXRoQ29kZShpbXBvcnRlZC5wYXRoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgbm9uLXJlbGF0aXZlIGltcG9ydCBpcyBFU00gZm9ybWF0IGFuZCBpc3N1ZSBhIGRpYWdub3N0aWMgaWYgdGhlIGZpbGUgaXMgbm90IGFsbG93ZWRcbiAgICAgIGlmIChcbiAgICAgICAgIWlzUG90ZW50aWFsUmVsYXRpdmUoaW1wb3J0ZWQub3JpZ2luYWwpICYmXG4gICAgICAgIG1ldGFmaWxlLmlucHV0c1tpbXBvcnRlZC5wYXRoXS5mb3JtYXQgIT09ICdlc20nXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IGltcG9ydGVkLm9yaWdpbmFsO1xuXG4gICAgICAgIGxldCBub3RBbGxvd2VkID0gdHJ1ZTtcbiAgICAgICAgaWYgKGFsbG93ZWRSZXF1ZXN0cy5oYXMocmVxdWVzdCkpIHtcbiAgICAgICAgICBub3RBbGxvd2VkID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIGRlZXAgaW1wb3J0cyBvZiBhbGxvd2VkIHJlcXVlc3RzXG4gICAgICAgICAgZm9yIChjb25zdCBhbGxvd2VkIG9mIGFsbG93ZWRSZXF1ZXN0cykge1xuICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhcnRzV2l0aChhbGxvd2VkICsgJy8nKSkge1xuICAgICAgICAgICAgICBub3RBbGxvd2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub3RBbGxvd2VkKSB7XG4gICAgICAgICAgLy8gSXNzdWUgYSBkaWFnbm9zdGljIG1lc3NhZ2UgYW5kIHNraXAgYWxsIGRlc2NlbmRhbnRzIHNpbmNlIHRoZXkgYXJlIGFsc28gbW9zdFxuICAgICAgICAgIC8vIGxpa2VseSBub3QgRVNNIGJ1dCBzb2x2ZWQgYnkgYWRkcmVzc2luZyB0aGlzIGltcG9ydC5cbiAgICAgICAgICBtZXNzYWdlcy5wdXNoKGNyZWF0ZUNvbW1vbkpTTW9kdWxlRXJyb3IocmVxdWVzdCwgY3VycmVudEZpbGUpKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIHBhdGggc28gdGhhdCBpdHMgaW1wb3J0cyBjYW4gYmUgY2hlY2tlZFxuICAgICAgZmlsZXMucHVzaChpbXBvcnRlZC5wYXRoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWVzc2FnZXM7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiBhIGZpbGUgcGF0aCBoYXMgYW4gZXh0ZW5zaW9uIHRoYXQgaXMgYSBKYXZhU2NyaXB0IG9yIFR5cGVTY3JpcHRcbiAqIGNvZGUgZmlsZS5cbiAqXG4gKiBAcGFyYW0gbmFtZSBBIHBhdGggdG8gY2hlY2sgZm9yIGNvZGUgZmlsZSBleHRlbnNpb25zLlxuICogQHJldHVybnMgVHJ1ZSwgaWYgYSBjb2RlIGZpbGUgcGF0aDsgZmFsc2UsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaXNQYXRoQ29kZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9cXC5bY21dP1tqdF1zeD8kLy50ZXN0KG5hbWUpO1xufVxuXG4vKipcbiAqIFRlc3QgYW4gaW1wb3J0IG1vZHVsZSBzcGVjaWZpZXIgdG8gZGV0ZXJtaW5lIGlmIHRoZSBzdHJpbmcgcG90ZW50aWFsbHkgcmVmZXJlbmNlcyBhIHJlbGF0aXZlIGZpbGUuXG4gKiBucG0gcGFja2FnZXMgc2hvdWxkIG5vdCBzdGFydCB3aXRoIGEgcGVyaW9kIHNvIGlmIHRoZSBmaXJzdCBjaGFyYWN0ZXIgaXMgYSBwZXJpb2QgdGhhbiBpdCBpcyBub3QgYVxuICogcGFja2FnZS4gV2hpbGUgdGhpcyBpcyBzdWZmaWNpZW50IGZvciB0aGUgdXNlIGNhc2UgaW4gdGhlIENvbW1tb25KUyBjaGVja2VyLCBvbmx5IGNoZWNraW5nIHRoZVxuICogZmlyc3QgY2hhcmFjdGVyIGRvZXMgbm90IGRlZmluaXRlbHkgaW5kaWNhdGUgdGhlIHNwZWNpZmllciBpcyBhIHJlbGF0aXZlIHBhdGguXG4gKlxuICogQHBhcmFtIHNwZWNpZmllciBBbiBpbXBvcnQgbW9kdWxlIHNwZWNpZmllci5cbiAqIEByZXR1cm5zIFRydWUsIGlmIHNwZWNpZmllciBpcyBwb3RlbnRpYWxseSByZWxhdGl2ZTsgZmFsc2UsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaXNQb3RlbnRpYWxSZWxhdGl2ZShzcGVjaWZpZXI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoc3BlY2lmaWVyWzBdID09PSAnLicpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGZvciBhIGdpdmVuIG5vbi1FU00gbW9kdWxlIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHJlcXVlc3QgVGhlIHJlcXVlc3RlZCBub24tRVNNIG1vZHVsZSBuYW1lLlxuICogQHBhcmFtIGltcG9ydGVyIFRoZSBwYXRoIG9mIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGltcG9ydC5cbiAqIEByZXR1cm5zIEEgbWVzc2FnZSByZXByZXNlbnRpbmcgdGhlIGRpYWdub3N0aWMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNvbW1vbkpTTW9kdWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBpbXBvcnRlcjogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgTW9kdWxlICcke3JlcXVlc3R9JyB1c2VkIGJ5ICcke2ltcG9ydGVyfScgaXMgbm90IEVTTWAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDpcbiAgICAgICAgICAnQ29tbW9uSlMgb3IgQU1EIGRlcGVuZGVuY2llcyBjYW4gY2F1c2Ugb3B0aW1pemF0aW9uIGJhaWxvdXRzLlxcbicgK1xuICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiBzZWU6IGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1jb21tb25qcy1kZXBlbmRlbmNpZXMnLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==