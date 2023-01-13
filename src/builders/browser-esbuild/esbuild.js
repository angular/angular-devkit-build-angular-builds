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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHFDQVNpQjtBQUNqQix5Q0FBd0Q7QUFHeEQ7Ozs7R0FJRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWM7SUFDN0MsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUZELDRDQUVDO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNJLEtBQUssVUFBVSxNQUFNLENBQzFCLGFBQXFCLEVBQ3JCLG1CQUFtRDs7SUFLbkQsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJO1FBQ0YsSUFBSSxPQUFPLG1CQUFtQixLQUFLLFVBQVUsRUFBRTtZQUM3QyxNQUFNLEdBQUcsQ0FBQyxNQUFNLG1CQUFtQixFQUFFLENBQWdELENBQUM7U0FDdkY7YUFBTTtZQUNMLE1BQU0sR0FBRyxNQUFNLElBQUEsZUFBSyxFQUFDO2dCQUNuQixHQUFHLG1CQUFtQjtnQkFDdEIsUUFBUSxFQUFFLElBQUk7Z0JBQ2QsS0FBSyxFQUFFLEtBQUs7YUFDYixDQUFDLENBQUM7U0FDSjtLQUNGO0lBQUMsT0FBTyxPQUFPLEVBQUU7UUFDaEIsd0VBQXdFO1FBQ3hFLElBQUksZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDN0IsT0FBTyxPQUFPLENBQUM7U0FDaEI7YUFBTTtZQUNMLE1BQU0sT0FBTyxDQUFDO1NBQ2Y7S0FDRjtJQUVELE1BQU0sWUFBWSxHQUFlLEVBQUUsQ0FBQztJQUNwQyxLQUFLLE1BQU0sVUFBVSxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7UUFDM0MsdUdBQXVHO1FBQ3ZHLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSxvQkFBUSxFQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEUsTUFBTSxVQUFVLEdBQUcsTUFBQSxNQUFBLE1BQU0sQ0FBQyxRQUFRLDBDQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQywwQ0FBRSxVQUFVLENBQUM7UUFFMUUsVUFBVSxDQUFDLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztRQUVuQyxJQUFJLFVBQVUsRUFBRTtZQUNkLGdEQUFnRDtZQUNoRCxZQUFZLENBQUMsSUFBSSxDQUFDO2dCQUNoQixJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUk7Z0JBQ3JCLHFHQUFxRztnQkFDckcsSUFBSSxFQUFFLElBQUEsb0JBQVEsRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0MsU0FBUyxFQUFFLElBQUEsbUJBQU8sRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQ3BDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7SUFFRCxPQUFPLEVBQUUsR0FBRyxNQUFNLEVBQUUsWUFBWSxFQUFFLENBQUM7QUFDckMsQ0FBQztBQS9DRCx3QkErQ0M7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUMvQixPQUF1QixFQUN2QixFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQTREO0lBRTlFLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRTtRQUNuQixNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNqRDtJQUVELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNqQixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ25GLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNoRDtBQUNILENBQUM7QUFiRCxrQ0FhQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgQnVpbGRGYWlsdXJlLFxuICBCdWlsZEludmFsaWRhdGUsXG4gIEJ1aWxkT3B0aW9ucyxcbiAgQnVpbGRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBidWlsZCxcbiAgZm9ybWF0TWVzc2FnZXMsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGV4dG5hbWUsIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgYW4gdW5rbm93biB2YWx1ZSBpcyBhbiBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QgdGhyb3duIGJ5IGVzYnVpbGQuXG4gKiBAcGFyYW0gdmFsdWUgQSBwb3RlbnRpYWwgZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0LlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSBvYmplY3QgaXMgZGV0ZXJtaW5lZCB0byBiZSBhIEJ1aWxkRmFpbHVyZSBvYmplY3Q7IG90aGVyd2lzZSwgYGZhbHNlYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRXNCdWlsZEZhaWx1cmUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBCdWlsZEZhaWx1cmUge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICdlcnJvcnMnIGluIHZhbHVlICYmICd3YXJuaW5ncycgaW4gdmFsdWU7XG59XG5cbi8qKlxuICogRXhlY3V0ZXMgdGhlIGVzYnVpbGQgYnVpbGQgZnVuY3Rpb24gYW5kIG5vcm1hbGl6ZXMgdGhlIGJ1aWxkIHJlc3VsdCBpbiB0aGUgZXZlbnQgb2YgYVxuICogYnVpbGQgZmFpbHVyZSB0aGF0IHJlc3VsdHMgaW4gbm8gb3V0cHV0IGJlaW5nIGdlbmVyYXRlZC5cbiAqIEFsbCBidWlsZHMgdXNlIHRoZSBgd3JpdGVgIG9wdGlvbiB3aXRoIGEgdmFsdWUgb2YgYGZhbHNlYCB0byBhbGxvdyBmb3IgdGhlIG91dHB1dCBmaWxlc1xuICogYnVpbGQgcmVzdWx0IGFycmF5IHRvIGJlIHBvcHVsYXRlZC5cbiAqXG4gKiBAcGFyYW0gb3B0aW9uc09ySW52YWxpZGF0ZSBUaGUgZXNidWlsZCBvcHRpb25zIG9iamVjdCB0byB1c2Ugd2hlbiBidWlsZGluZyBvciB0aGUgaW52YWxpZGF0ZSBvYmplY3RcbiAqIHJldHVybmVkIGZyb20gYW4gaW5jcmVtZW50YWwgYnVpbGQgdG8gcGVyZm9ybSBhbiBhZGRpdGlvbmFsIGluY3JlbWVudGFsIGJ1aWxkLlxuICogQHJldHVybnMgSWYgb3V0cHV0IGZpbGVzIGFyZSBnZW5lcmF0ZWQsIHRoZSBmdWxsIGVzYnVpbGQgQnVpbGRSZXN1bHQ7IGlmIG5vdCwgdGhlXG4gKiB3YXJuaW5ncyBhbmQgZXJyb3JzIGZvciB0aGUgYXR0ZW1wdGVkIGJ1aWxkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG9wdGlvbnNPckludmFsaWRhdGU6IEJ1aWxkT3B0aW9ucyB8IEJ1aWxkSW52YWxpZGF0ZSxcbik6IFByb21pc2U8XG4gIHwgKEJ1aWxkUmVzdWx0ICYgeyBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdOyBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gfSlcbiAgfCAoQnVpbGRGYWlsdXJlICYgeyBvdXRwdXRGaWxlcz86IG5ldmVyIH0pXG4+IHtcbiAgbGV0IHJlc3VsdDtcbiAgdHJ5IHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnNPckludmFsaWRhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJlc3VsdCA9IChhd2FpdCBvcHRpb25zT3JJbnZhbGlkYXRlKCkpIGFzIEJ1aWxkUmVzdWx0ICYgeyBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGJ1aWxkKHtcbiAgICAgICAgLi4ub3B0aW9uc09ySW52YWxpZGF0ZSxcbiAgICAgICAgbWV0YWZpbGU6IHRydWUsXG4gICAgICAgIHdyaXRlOiBmYWxzZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZmFpbHVyZSkge1xuICAgIC8vIEJ1aWxkIGZhaWx1cmVzIHdpbGwgdGhyb3cgYW4gZXhjZXB0aW9uIHdoaWNoIGNvbnRhaW5zIGVycm9ycy93YXJuaW5nc1xuICAgIGlmIChpc0VzQnVpbGRGYWlsdXJlKGZhaWx1cmUpKSB7XG4gICAgICByZXR1cm4gZmFpbHVyZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZmFpbHVyZTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgIC8vIEVudHJpZXMgaW4gdGhlIG1ldGFmaWxlIGFyZSByZWxhdGl2ZSB0byB0aGUgYGFic1dvcmtpbmdEaXJgIG9wdGlvbiB3aGljaCBpcyBzZXQgdG8gdGhlIHdvcmtzcGFjZVJvb3RcbiAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gcmVsYXRpdmUod29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICBjb25zdCBlbnRyeVBvaW50ID0gcmVzdWx0Lm1ldGFmaWxlPy5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgb3V0cHV0RmlsZS5wYXRoID0gcmVsYXRpdmVGaWxlUGF0aDtcblxuICAgIGlmIChlbnRyeVBvaW50KSB7XG4gICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgIGluaXRpYWxGaWxlcy5wdXNoKHtcbiAgICAgICAgZmlsZTogb3V0cHV0RmlsZS5wYXRoLFxuICAgICAgICAvLyBUaGUgZmlyc3QgcGFydCBvZiB0aGUgZmlsZW5hbWUgaXMgdGhlIG5hbWUgb2YgZmlsZSAoZS5nLiwgXCJwb2x5ZmlsbHNcIiBmb3IgXCJwb2x5ZmlsbHMuN1M1RzNNRFkuanNcIilcbiAgICAgICAgbmFtZTogYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKS5zcGxpdCgnLicpWzBdLFxuICAgICAgICBleHRlbnNpb246IGV4dG5hbWUob3V0cHV0RmlsZS5wYXRoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IC4uLnJlc3VsdCwgaW5pdGlhbEZpbGVzIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dNZXNzYWdlcyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHsgZXJyb3JzLCB3YXJuaW5ncyB9OiB7IGVycm9yczogUGFydGlhbE1lc3NhZ2VbXTsgd2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAod2FybmluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3Qgd2FybmluZ01lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMod2FybmluZ3MsIHsga2luZDogJ3dhcm5pbmcnLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmdNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnN0IGVycm9yTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyhlcnJvcnMsIHsga2luZDogJ2Vycm9yJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3JNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cbn1cbiJdfQ==