"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessages = exports.bundle = exports.isEsBuildFailure = void 0;
const esbuild_1 = require("esbuild");
const node_path_1 = require("node:path");
/**
 * Determines if an unknown value is an esbuild BuildFailure error object thrown by esbuild.
 * @param value A potential esbuild BuildFailure error object.
 * @returns `true` if the object is determined to be a BuildFailure object; otherwise, `false`.
 */
function isEsBuildFailure(value) {
    return !!value && typeof value === 'object' && 'errors' in value && 'warnings' in value;
}
exports.isEsBuildFailure = isEsBuildFailure;
/**
 * Executes the esbuild build function and normalizes the build result in the event of a
 * build failure that results in no output being generated.
 * All builds use the `write` option with a value of `false` to allow for the output files
 * build result array to be populated.
 *
 * @param optionsOrInvalidate The esbuild options object to use when building or the invalidate object
 * returned from an incremental build to perform an additional incremental build.
 * @returns If output files are generated, the full esbuild BuildResult; if not, the
 * warnings and errors for the attempted build.
 */
async function bundle(workspaceRoot, optionsOrInvalidate) {
    var _a, _b;
    let result;
    try {
        if (typeof optionsOrInvalidate === 'function') {
            result = (await optionsOrInvalidate());
        }
        else {
            result = await (0, esbuild_1.build)({
                ...optionsOrInvalidate,
                metafile: true,
                write: false,
            });
        }
    }
    catch (failure) {
        // Build failures will throw an exception which contains errors/warnings
        if (isEsBuildFailure(failure)) {
            return failure;
        }
        else {
            throw failure;
        }
    }
    const initialFiles = [];
    for (const outputFile of result.outputFiles) {
        // Entries in the metafile are relative to the `absWorkingDir` option which is set to the workspaceRoot
        const relativeFilePath = (0, node_path_1.relative)(workspaceRoot, outputFile.path);
        const entryPoint = (_b = (_a = result.metafile) === null || _a === void 0 ? void 0 : _a.outputs[relativeFilePath]) === null || _b === void 0 ? void 0 : _b.entryPoint;
        outputFile.path = relativeFilePath;
        if (entryPoint) {
            // An entryPoint value indicates an initial file
            initialFiles.push({
                file: outputFile.path,
                // The first part of the filename is the name of file (e.g., "polyfills" for "polyfills.7S5G3MDY.js")
                name: (0, node_path_1.basename)(outputFile.path).split('.')[0],
                extension: (0, node_path_1.extname)(outputFile.path),
            });
        }
    }
    return { ...result, initialFiles };
}
exports.bundle = bundle;
async function logMessages(context, { errors, warnings }) {
    if (warnings.length) {
        const warningMessages = await (0, esbuild_1.formatMessages)(warnings, { kind: 'warning', color: true });
        context.logger.warn(warningMessages.join('\n'));
    }
    if (errors.length) {
        const errorMessages = await (0, esbuild_1.formatMessages)(errors, { kind: 'error', color: true });
        context.logger.error(errorMessages.join('\n'));
    }
}
exports.logMessages = logMessages;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHFDQVNpQjtBQUNqQix5Q0FBd0Q7QUFHeEQ7Ozs7R0FJRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWM7SUFDN0MsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUZELDRDQUVDO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNJLEtBQUssVUFBVSxNQUFNLENBQzFCLGFBQXFCLEVBQ3JCLG1CQUFtRDs7SUFLbkQsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJO1FBQ0YsSUFBSSxPQUFPLG1CQUFtQixLQUFLLFVBQVUsRUFBRTtZQUM3QyxNQUFNLEdBQUcsQ0FBQyxNQUFNLG1CQUFtQixFQUFFLENBQWdELENBQUM7U0FDdkY7YUFBTTtZQUNMLE1BQU0sR0FBRyxNQUFNLElBQUEsZUFBSyxFQUFDO2dCQUNuQixHQUFHLG1CQUFtQjtnQkFDdEIsUUFBUSxFQUFFLElBQUk7Z0JBQ2QsS0FBSyxFQUFFLEtBQUs7YUFDYixDQUFDLENBQUM7U0FDSjtLQUNGO0lBQUMsT0FBTyxPQUFPLEVBQUU7UUFDaEIsd0VBQXdFO1FBQ3hFLElBQUksZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDN0IsT0FBTyxPQUFPLENBQUM7U0FDaEI7YUFBTTtZQUNMLE1BQU0sT0FBTyxDQUFDO1NBQ2Y7S0FDRjtJQUVELE1BQU0sWUFBWSxHQUFlLEVBQUUsQ0FBQztJQUNwQyxLQUFLLE1BQU0sVUFBVSxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7UUFDM0MsdUdBQXVHO1FBQ3ZHLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSxvQkFBUSxFQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEUsTUFBTSxVQUFVLEdBQUcsTUFBQSxNQUFBLE1BQU0sQ0FBQyxRQUFRLDBDQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQywwQ0FBRSxVQUFVLENBQUM7UUFFMUUsVUFBVSxDQUFDLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztRQUVuQyxJQUFJLFVBQVUsRUFBRTtZQUNkLGdEQUFnRDtZQUNoRCxZQUFZLENBQUMsSUFBSSxDQUFDO2dCQUNoQixJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUk7Z0JBQ3JCLHFHQUFxRztnQkFDckcsSUFBSSxFQUFFLElBQUEsb0JBQVEsRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0MsU0FBUyxFQUFFLElBQUEsbUJBQU8sRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQ3BDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7SUFFRCxPQUFPLEVBQUUsR0FBRyxNQUFNLEVBQUUsWUFBWSxFQUFFLENBQUM7QUFDckMsQ0FBQztBQS9DRCx3QkErQ0M7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUMvQixPQUF1QixFQUN2QixFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQThDO0lBRWhFLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRTtRQUNuQixNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNqRDtJQUVELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNqQixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ25GLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNoRDtBQUNILENBQUM7QUFiRCxrQ0FhQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgQnVpbGRGYWlsdXJlLFxuICBCdWlsZEludmFsaWRhdGUsXG4gIEJ1aWxkT3B0aW9ucyxcbiAgQnVpbGRSZXN1bHQsXG4gIE1lc3NhZ2UsXG4gIE91dHB1dEZpbGUsXG4gIGJ1aWxkLFxuICBmb3JtYXRNZXNzYWdlcyxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZXh0bmFtZSwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiBhbiB1bmtub3duIHZhbHVlIGlzIGFuIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdCB0aHJvd24gYnkgZXNidWlsZC5cbiAqIEBwYXJhbSB2YWx1ZSBBIHBvdGVudGlhbCBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QuXG4gKiBAcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIG9iamVjdCBpcyBkZXRlcm1pbmVkIHRvIGJlIGEgQnVpbGRGYWlsdXJlIG9iamVjdDsgb3RoZXJ3aXNlLCBgZmFsc2VgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFc0J1aWxkRmFpbHVyZSh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEJ1aWxkRmFpbHVyZSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ2Vycm9ycycgaW4gdmFsdWUgJiYgJ3dhcm5pbmdzJyBpbiB2YWx1ZTtcbn1cblxuLyoqXG4gKiBFeGVjdXRlcyB0aGUgZXNidWlsZCBidWlsZCBmdW5jdGlvbiBhbmQgbm9ybWFsaXplcyB0aGUgYnVpbGQgcmVzdWx0IGluIHRoZSBldmVudCBvZiBhXG4gKiBidWlsZCBmYWlsdXJlIHRoYXQgcmVzdWx0cyBpbiBubyBvdXRwdXQgYmVpbmcgZ2VuZXJhdGVkLlxuICogQWxsIGJ1aWxkcyB1c2UgdGhlIGB3cml0ZWAgb3B0aW9uIHdpdGggYSB2YWx1ZSBvZiBgZmFsc2VgIHRvIGFsbG93IGZvciB0aGUgb3V0cHV0IGZpbGVzXG4gKiBidWlsZCByZXN1bHQgYXJyYXkgdG8gYmUgcG9wdWxhdGVkLlxuICpcbiAqIEBwYXJhbSBvcHRpb25zT3JJbnZhbGlkYXRlIFRoZSBlc2J1aWxkIG9wdGlvbnMgb2JqZWN0IHRvIHVzZSB3aGVuIGJ1aWxkaW5nIG9yIHRoZSBpbnZhbGlkYXRlIG9iamVjdFxuICogcmV0dXJuZWQgZnJvbSBhbiBpbmNyZW1lbnRhbCBidWlsZCB0byBwZXJmb3JtIGFuIGFkZGl0aW9uYWwgaW5jcmVtZW50YWwgYnVpbGQuXG4gKiBAcmV0dXJucyBJZiBvdXRwdXQgZmlsZXMgYXJlIGdlbmVyYXRlZCwgdGhlIGZ1bGwgZXNidWlsZCBCdWlsZFJlc3VsdDsgaWYgbm90LCB0aGVcbiAqIHdhcm5pbmdzIGFuZCBlcnJvcnMgZm9yIHRoZSBhdHRlbXB0ZWQgYnVpbGQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGUoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgb3B0aW9uc09ySW52YWxpZGF0ZTogQnVpbGRPcHRpb25zIHwgQnVpbGRJbnZhbGlkYXRlLFxuKTogUHJvbWlzZTxcbiAgfCAoQnVpbGRSZXN1bHQgJiB7IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW107IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSB9KVxuICB8IChCdWlsZEZhaWx1cmUgJiB7IG91dHB1dEZpbGVzPzogbmV2ZXIgfSlcbj4ge1xuICBsZXQgcmVzdWx0O1xuICB0cnkge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9uc09ySW52YWxpZGF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmVzdWx0ID0gKGF3YWl0IG9wdGlvbnNPckludmFsaWRhdGUoKSkgYXMgQnVpbGRSZXN1bHQgJiB7IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgYnVpbGQoe1xuICAgICAgICAuLi5vcHRpb25zT3JJbnZhbGlkYXRlLFxuICAgICAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICAgICAgd3JpdGU6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuICB9IGNhdGNoIChmYWlsdXJlKSB7XG4gICAgLy8gQnVpbGQgZmFpbHVyZXMgd2lsbCB0aHJvdyBhbiBleGNlcHRpb24gd2hpY2ggY29udGFpbnMgZXJyb3JzL3dhcm5pbmdzXG4gICAgaWYgKGlzRXNCdWlsZEZhaWx1cmUoZmFpbHVyZSkpIHtcbiAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBmYWlsdXJlO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgLy8gRW50cmllcyBpbiB0aGUgbWV0YWZpbGUgYXJlIHJlbGF0aXZlIHRvIHRoZSBgYWJzV29ya2luZ0RpcmAgb3B0aW9uIHdoaWNoIGlzIHNldCB0byB0aGUgd29ya3NwYWNlUm9vdFxuICAgIGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSByZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgIGNvbnN0IGVudHJ5UG9pbnQgPSByZXN1bHQubWV0YWZpbGU/Lm91dHB1dHNbcmVsYXRpdmVGaWxlUGF0aF0/LmVudHJ5UG9pbnQ7XG5cbiAgICBvdXRwdXRGaWxlLnBhdGggPSByZWxhdGl2ZUZpbGVQYXRoO1xuXG4gICAgaWYgKGVudHJ5UG9pbnQpIHtcbiAgICAgIC8vIEFuIGVudHJ5UG9pbnQgdmFsdWUgaW5kaWNhdGVzIGFuIGluaXRpYWwgZmlsZVxuICAgICAgaW5pdGlhbEZpbGVzLnB1c2goe1xuICAgICAgICBmaWxlOiBvdXRwdXRGaWxlLnBhdGgsXG4gICAgICAgIC8vIFRoZSBmaXJzdCBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBpcyB0aGUgbmFtZSBvZiBmaWxlIChlLmcuLCBcInBvbHlmaWxsc1wiIGZvciBcInBvbHlmaWxscy43UzVHM01EWS5qc1wiKVxuICAgICAgICBuYW1lOiBiYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpLnNwbGl0KCcuJylbMF0sXG4gICAgICAgIGV4dGVuc2lvbjogZXh0bmFtZShvdXRwdXRGaWxlLnBhdGgpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBpbml0aWFsRmlsZXMgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ01lc3NhZ2VzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgeyBlcnJvcnMsIHdhcm5pbmdzIH06IHsgZXJyb3JzOiBNZXNzYWdlW107IHdhcm5pbmdzOiBNZXNzYWdlW10gfSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAod2FybmluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3Qgd2FybmluZ01lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMod2FybmluZ3MsIHsga2luZDogJ3dhcm5pbmcnLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmdNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnN0IGVycm9yTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyhlcnJvcnMsIHsga2luZDogJ2Vycm9yJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3JNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cbn1cbiJdfQ==