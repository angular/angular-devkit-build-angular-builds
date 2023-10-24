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
 * diagnostic will be generated. Use `'*'` as entry to skip the check.
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
    if (allowedRequests.has('*')) {
        return messages;
    }
    // Ignore Angular locale definitions which are currently UMD
    allowedRequests.add('@angular/common/locales');
    // Ignore zone.js due to it currently being built with a UMD like structure.
    // Once the build output is updated to be fully ESM, this can be removed.
    allowedRequests.add('zone.js');
    // Used by '@angular/platform-server' and is in a seperate chunk that is unused when
    // using `provideHttpClient(withFetch())`.
    allowedRequests.add('xhr2');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uanMtY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvY29tbW9uanMtY2hlY2tlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFJSDs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0JHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQ2xDLFFBQWtCLEVBQ2xCLDJCQUFzQztJQUV0QyxNQUFNLFFBQVEsR0FBcUIsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7SUFFN0QsSUFBSSxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzVCLE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBRUQsNERBQTREO0lBQzVELGVBQWUsQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUUvQyw0RUFBNEU7SUFDNUUseUVBQXlFO0lBQ3pFLGVBQWUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFL0Isb0ZBQW9GO0lBQ3BGLDBDQUEwQztJQUMxQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRTVCLGtEQUFrRDtJQUNsRCxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFDM0IsS0FBSyxNQUFNLEVBQUUsVUFBVSxFQUFFLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDNUQsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLFNBQVM7U0FDVjtRQUNELElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDM0IsU0FBUztTQUNWO1FBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUN4QjtJQUVELG1EQUFtRDtJQUNuRCxzRUFBc0U7SUFDdEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBRWpELHdEQUF3RDtJQUN4RCxJQUFJLFdBQStCLENBQUM7SUFDcEMsT0FBTyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRTtRQUNwQyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTNDLEtBQUssTUFBTSxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUNwQyx5RkFBeUY7WUFDekYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3RELFNBQVM7YUFDVjtZQUNELFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTdCLCtCQUErQjtZQUMvQixJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDOUIsU0FBUzthQUNWO1lBRUQsK0ZBQStGO1lBQy9GLElBQ0UsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO2dCQUN2QyxRQUFRLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssS0FBSyxFQUMvQztnQkFDQSxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDO2dCQUVsQyxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUM7Z0JBQ3RCLElBQUksZUFBZSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRTtvQkFDaEMsVUFBVSxHQUFHLEtBQUssQ0FBQztpQkFDcEI7cUJBQU07b0JBQ0wsNkNBQTZDO29CQUM3QyxLQUFLLE1BQU0sT0FBTyxJQUFJLGVBQWUsRUFBRTt3QkFDckMsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsRUFBRTs0QkFDckMsVUFBVSxHQUFHLEtBQUssQ0FBQzs0QkFDbkIsTUFBTTt5QkFDUDtxQkFDRjtpQkFDRjtnQkFFRCxJQUFJLFVBQVUsRUFBRTtvQkFDZCwrRUFBK0U7b0JBQy9FLHVEQUF1RDtvQkFDdkQsUUFBUSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztvQkFDL0QsU0FBUztpQkFDVjthQUNGO1lBRUQsa0RBQWtEO1lBQ2xELEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzNCO0tBQ0Y7SUFFRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDO0FBMUZELG9EQTBGQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQVMsVUFBVSxDQUFDLElBQVk7SUFDOUIsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUyxtQkFBbUIsQ0FBQyxTQUFpQjtJQUM1QyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7UUFDeEIsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQVMseUJBQXlCLENBQUMsT0FBZSxFQUFFLFFBQWdCO0lBQ2xFLE1BQU0sS0FBSyxHQUFHO1FBQ1osSUFBSSxFQUFFLFdBQVcsT0FBTyxjQUFjLFFBQVEsY0FBYztRQUM1RCxLQUFLLEVBQUU7WUFDTDtnQkFDRSxJQUFJLEVBQ0YsaUVBQWlFO29CQUNqRSw0RkFBNEY7YUFDL0Y7U0FDRjtLQUNGLENBQUM7SUFFRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBNZXRhZmlsZSwgUGFydGlhbE1lc3NhZ2UgfSBmcm9tICdlc2J1aWxkJztcblxuLyoqXG4gKiBDaGVja3MgdGhlIGlucHV0IGZpbGVzIG9mIGEgYnVpbGQgdG8gZGV0ZXJtaW5lIGlmIGFueSBvZiB0aGUgZmlsZXMgaW5jbHVkZWRcbiAqIGluIHRoZSBidWlsZCBhcmUgbm90IEVTTS4gRVNNIGZpbGVzIGNhbiBiZSB0cmVlLXNoYWtlbiBhbmQgb3RoZXJ3aXNlIG9wdGltaXplZFxuICogaW4gd2F5cyB0aGF0IENvbW1vbkpTIGFuZCBvdGhlciBtb2R1bGUgZm9ybWF0cyBjYW5ub3QuIFRoZSBlc2J1aWxkIG1ldGFmaWxlXG4gKiBpbmZvcm1hdGlvbiBpcyB1c2VkIGFzIHRoZSBiYXNpcyBmb3IgdGhlIGFuYWx5c2lzIGFzIGl0IGNvbnRhaW5zIGluZm9ybWF0aW9uXG4gKiBmb3IgZWFjaCBpbnB1dCBmaWxlIGluY2x1ZGluZyBpdHMgcmVzcGVjdGl2ZSBmb3JtYXQuXG4gKlxuICogSWYgYW55IGFsbG93ZWQgZGVwZW5kZW5jaWVzIGFyZSBwcm92aWRlZCB2aWEgdGhlIGBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXNgXG4gKiBwYXJhbWV0ZXIsIGJvdGggdGhlIGRpcmVjdCBpbXBvcnQgYW5kIGFueSBkZWVwIGltcG9ydHMgd2lsbCBiZSBpZ25vcmVkIGFuZCBub1xuICogZGlhZ25vc3RpYyB3aWxsIGJlIGdlbmVyYXRlZC4gVXNlIGAnKidgIGFzIGVudHJ5IHRvIHNraXAgdGhlIGNoZWNrLlxuICpcbiAqIElmIGEgbW9kdWxlIGhhcyBiZWVuIGlzc3VlZCBhIGRpYWdub3N0aWMgbWVzc2FnZSwgdGhlbiBhbGwgZGVzY2VuZGFudCBtb2R1bGVzXG4gKiB3aWxsIG5vdCBiZSBjaGVja2VkLiBUaGlzIHByZXZlbnRzIGEgcG90ZW50aWFsIG1hc3NpdmUgYW1vdW50IG9mIGluYWN0aW9uYWJsZVxuICogbWVzc2FnZXMgc2luY2UgdGhlIGluaXRpYWwgbW9kdWxlIGltcG9ydCBpcyB0aGUgY2F1c2Ugb2YgdGhlIHByb2JsZW0uXG4gKlxuICogQHBhcmFtIG1ldGFmaWxlIEFuIGVzYnVpbGQgbWV0YWZpbGUgb2JqZWN0IHRvIGNoZWNrLlxuICogQHBhcmFtIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyBBbiBvcHRpb25hbCBsaXN0IG9mIGFsbG93ZWQgZGVwZW5kZW5jaWVzLlxuICogQHJldHVybnMgWmVybyBvciBtb3JlIGRpYWdub3N0aWMgbWVzc2FnZXMgZm9yIGFueSBub24tRVNNIG1vZHVsZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0NvbW1vbkpTTW9kdWxlcyhcbiAgbWV0YWZpbGU6IE1ldGFmaWxlLFxuICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXSxcbik6IFBhcnRpYWxNZXNzYWdlW10ge1xuICBjb25zdCBtZXNzYWdlczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICBjb25zdCBhbGxvd2VkUmVxdWVzdHMgPSBuZXcgU2V0KGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyk7XG5cbiAgaWYgKGFsbG93ZWRSZXF1ZXN0cy5oYXMoJyonKSkge1xuICAgIHJldHVybiBtZXNzYWdlcztcbiAgfVxuXG4gIC8vIElnbm9yZSBBbmd1bGFyIGxvY2FsZSBkZWZpbml0aW9ucyB3aGljaCBhcmUgY3VycmVudGx5IFVNRFxuICBhbGxvd2VkUmVxdWVzdHMuYWRkKCdAYW5ndWxhci9jb21tb24vbG9jYWxlcycpO1xuXG4gIC8vIElnbm9yZSB6b25lLmpzIGR1ZSB0byBpdCBjdXJyZW50bHkgYmVpbmcgYnVpbHQgd2l0aCBhIFVNRCBsaWtlIHN0cnVjdHVyZS5cbiAgLy8gT25jZSB0aGUgYnVpbGQgb3V0cHV0IGlzIHVwZGF0ZWQgdG8gYmUgZnVsbHkgRVNNLCB0aGlzIGNhbiBiZSByZW1vdmVkLlxuICBhbGxvd2VkUmVxdWVzdHMuYWRkKCd6b25lLmpzJyk7XG5cbiAgLy8gVXNlZCBieSAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJyBhbmQgaXMgaW4gYSBzZXBlcmF0ZSBjaHVuayB0aGF0IGlzIHVudXNlZCB3aGVuXG4gIC8vIHVzaW5nIGBwcm92aWRlSHR0cENsaWVudCh3aXRoRmV0Y2goKSlgLlxuICBhbGxvd2VkUmVxdWVzdHMuYWRkKCd4aHIyJyk7XG5cbiAgLy8gRmluZCBhbGwgZW50cnkgcG9pbnRzIHRoYXQgY29udGFpbiBjb2RlIChKUy9UUylcbiAgY29uc3QgZmlsZXM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgeyBlbnRyeVBvaW50IH0gb2YgT2JqZWN0LnZhbHVlcyhtZXRhZmlsZS5vdXRwdXRzKSkge1xuICAgIGlmICghZW50cnlQb2ludCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICghaXNQYXRoQ29kZShlbnRyeVBvaW50KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgZmlsZXMucHVzaChlbnRyeVBvaW50KTtcbiAgfVxuXG4gIC8vIFRyYWNrIHNlZW4gZmlsZXMgc28gdGhleSBhcmUgb25seSBhbmFseXplZCBvbmNlLlxuICAvLyBCdW5kbGVyIHJ1bnRpbWUgY29kZSBpcyBhbHNvIGlnbm9yZWQgc2luY2UgaXQgY2Fubm90IGJlIGFjdGlvbmFibGUuXG4gIGNvbnN0IHNlZW5GaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPihbJzxydW50aW1lPiddKTtcblxuICAvLyBBbmFseXplIHRoZSBmaWxlcyBwcmVzZW50IGJ5IHdhbGtpbmcgdGhlIGltcG9ydCBncmFwaFxuICBsZXQgY3VycmVudEZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgd2hpbGUgKChjdXJyZW50RmlsZSA9IGZpbGVzLnNoaWZ0KCkpKSB7XG4gICAgY29uc3QgaW5wdXQgPSBtZXRhZmlsZS5pbnB1dHNbY3VycmVudEZpbGVdO1xuXG4gICAgZm9yIChjb25zdCBpbXBvcnRlZCBvZiBpbnB1dC5pbXBvcnRzKSB7XG4gICAgICAvLyBJZ25vcmUgaW1wb3J0cyB0aGF0IHdlcmUgYWxyZWFkeSBzZWVuIG9yIG5vdCBvcmlnaW5hbGx5IGluIHRoZSBjb2RlIChidW5kbGVyIGluamVjdGVkKVxuICAgICAgaWYgKCFpbXBvcnRlZC5vcmlnaW5hbCB8fCBzZWVuRmlsZXMuaGFzKGltcG9ydGVkLnBhdGgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgc2VlbkZpbGVzLmFkZChpbXBvcnRlZC5wYXRoKTtcblxuICAgICAgLy8gT25seSBjaGVjayBhY3R1YWwgY29kZSBmaWxlc1xuICAgICAgaWYgKCFpc1BhdGhDb2RlKGltcG9ydGVkLnBhdGgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayBpZiBub24tcmVsYXRpdmUgaW1wb3J0IGlzIEVTTSBmb3JtYXQgYW5kIGlzc3VlIGEgZGlhZ25vc3RpYyBpZiB0aGUgZmlsZSBpcyBub3QgYWxsb3dlZFxuICAgICAgaWYgKFxuICAgICAgICAhaXNQb3RlbnRpYWxSZWxhdGl2ZShpbXBvcnRlZC5vcmlnaW5hbCkgJiZcbiAgICAgICAgbWV0YWZpbGUuaW5wdXRzW2ltcG9ydGVkLnBhdGhdLmZvcm1hdCAhPT0gJ2VzbSdcbiAgICAgICkge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW1wb3J0ZWQub3JpZ2luYWw7XG5cbiAgICAgICAgbGV0IG5vdEFsbG93ZWQgPSB0cnVlO1xuICAgICAgICBpZiAoYWxsb3dlZFJlcXVlc3RzLmhhcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIG5vdEFsbG93ZWQgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBDaGVjayBmb3IgZGVlcCBpbXBvcnRzIG9mIGFsbG93ZWQgcmVxdWVzdHNcbiAgICAgICAgICBmb3IgKGNvbnN0IGFsbG93ZWQgb2YgYWxsb3dlZFJlcXVlc3RzKSB7XG4gICAgICAgICAgICBpZiAocmVxdWVzdC5zdGFydHNXaXRoKGFsbG93ZWQgKyAnLycpKSB7XG4gICAgICAgICAgICAgIG5vdEFsbG93ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vdEFsbG93ZWQpIHtcbiAgICAgICAgICAvLyBJc3N1ZSBhIGRpYWdub3N0aWMgbWVzc2FnZSBhbmQgc2tpcCBhbGwgZGVzY2VuZGFudHMgc2luY2UgdGhleSBhcmUgYWxzbyBtb3N0XG4gICAgICAgICAgLy8gbGlrZWx5IG5vdCBFU00gYnV0IHNvbHZlZCBieSBhZGRyZXNzaW5nIHRoaXMgaW1wb3J0LlxuICAgICAgICAgIG1lc3NhZ2VzLnB1c2goY3JlYXRlQ29tbW9uSlNNb2R1bGVFcnJvcihyZXF1ZXN0LCBjdXJyZW50RmlsZSkpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0aGUgcGF0aCBzbyB0aGF0IGl0cyBpbXBvcnRzIGNhbiBiZSBjaGVja2VkXG4gICAgICBmaWxlcy5wdXNoKGltcG9ydGVkLnBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlcztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGEgZmlsZSBwYXRoIGhhcyBhbiBleHRlbnNpb24gdGhhdCBpcyBhIEphdmFTY3JpcHQgb3IgVHlwZVNjcmlwdFxuICogY29kZSBmaWxlLlxuICpcbiAqIEBwYXJhbSBuYW1lIEEgcGF0aCB0byBjaGVjayBmb3IgY29kZSBmaWxlIGV4dGVuc2lvbnMuXG4gKiBAcmV0dXJucyBUcnVlLCBpZiBhIGNvZGUgZmlsZSBwYXRoOyBmYWxzZSwgb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBpc1BhdGhDb2RlKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL1xcLltjbV0/W2p0XXN4PyQvLnRlc3QobmFtZSk7XG59XG5cbi8qKlxuICogVGVzdCBhbiBpbXBvcnQgbW9kdWxlIHNwZWNpZmllciB0byBkZXRlcm1pbmUgaWYgdGhlIHN0cmluZyBwb3RlbnRpYWxseSByZWZlcmVuY2VzIGEgcmVsYXRpdmUgZmlsZS5cbiAqIG5wbSBwYWNrYWdlcyBzaG91bGQgbm90IHN0YXJ0IHdpdGggYSBwZXJpb2Qgc28gaWYgdGhlIGZpcnN0IGNoYXJhY3RlciBpcyBhIHBlcmlvZCB0aGFuIGl0IGlzIG5vdCBhXG4gKiBwYWNrYWdlLiBXaGlsZSB0aGlzIGlzIHN1ZmZpY2llbnQgZm9yIHRoZSB1c2UgY2FzZSBpbiB0aGUgQ29tbW1vbkpTIGNoZWNrZXIsIG9ubHkgY2hlY2tpbmcgdGhlXG4gKiBmaXJzdCBjaGFyYWN0ZXIgZG9lcyBub3QgZGVmaW5pdGVseSBpbmRpY2F0ZSB0aGUgc3BlY2lmaWVyIGlzIGEgcmVsYXRpdmUgcGF0aC5cbiAqXG4gKiBAcGFyYW0gc3BlY2lmaWVyIEFuIGltcG9ydCBtb2R1bGUgc3BlY2lmaWVyLlxuICogQHJldHVybnMgVHJ1ZSwgaWYgc3BlY2lmaWVyIGlzIHBvdGVudGlhbGx5IHJlbGF0aXZlOyBmYWxzZSwgb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBpc1BvdGVudGlhbFJlbGF0aXZlKHNwZWNpZmllcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChzcGVjaWZpZXJbMF0gPT09ICcuJykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgZm9yIGEgZ2l2ZW4gbm9uLUVTTSBtb2R1bGUgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdGVkIG5vbi1FU00gbW9kdWxlIG5hbWUuXG4gKiBAcGFyYW0gaW1wb3J0ZXIgVGhlIHBhdGggb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW1wb3J0LlxuICogQHJldHVybnMgQSBtZXNzYWdlIHJlcHJlc2VudGluZyB0aGUgZGlhZ25vc3RpYy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ29tbW9uSlNNb2R1bGVFcnJvcihyZXF1ZXN0OiBzdHJpbmcsIGltcG9ydGVyOiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBNb2R1bGUgJyR7cmVxdWVzdH0nIHVzZWQgYnkgJyR7aW1wb3J0ZXJ9JyBpcyBub3QgRVNNYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OlxuICAgICAgICAgICdDb21tb25KUyBvciBBTUQgZGVwZW5kZW5jaWVzIGNhbiBjYXVzZSBvcHRpbWl6YXRpb24gYmFpbG91dHMuXFxuJyArXG4gICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uIHNlZTogaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWNvbW1vbmpzLWRlcGVuZGVuY2llcycsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19