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
 * @param options The esbuild options object to use when building.
 * @returns If output files are generated, the full esbuild BuildResult; if not, the
 * warnings and errors for the attempted build.
 */
async function bundle(options) {
    try {
        return await (0, esbuild_1.build)({
            ...options,
            write: false,
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHFDQVFpQjtBQUVqQjs7OztHQUlHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsS0FBYztJQUM3QyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLEtBQUssQ0FBQztBQUMxRixDQUFDO0FBRkQsNENBRUM7QUFFRDs7Ozs7Ozs7O0dBU0c7QUFDSSxLQUFLLFVBQVUsTUFBTSxDQUMxQixPQUFxQjtJQUlyQixJQUFJO1FBQ0YsT0FBTyxNQUFNLElBQUEsZUFBSyxFQUFDO1lBQ2pCLEdBQUcsT0FBTztZQUNWLEtBQUssRUFBRSxLQUFLO1NBQ2IsQ0FBQyxDQUFDO0tBQ0o7SUFBQyxPQUFPLE9BQU8sRUFBRTtRQUNoQix3RUFBd0U7UUFDeEUsSUFBSSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUM3QixPQUFPLE9BQU8sQ0FBQztTQUNoQjthQUFNO1lBQ0wsTUFBTSxPQUFPLENBQUM7U0FDZjtLQUNGO0FBQ0gsQ0FBQztBQWxCRCx3QkFrQkM7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUMvQixPQUF1QixFQUN2QixFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQThDO0lBRWhFLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRTtRQUNuQixNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNqRDtJQUVELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNqQixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUEsd0JBQWMsRUFBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ25GLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUNoRDtBQUNILENBQUM7QUFiRCxrQ0FhQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgQnVpbGRGYWlsdXJlLFxuICBCdWlsZE9wdGlvbnMsXG4gIEJ1aWxkUmVzdWx0LFxuICBNZXNzYWdlLFxuICBPdXRwdXRGaWxlLFxuICBidWlsZCxcbiAgZm9ybWF0TWVzc2FnZXMsXG59IGZyb20gJ2VzYnVpbGQnO1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgYW4gdW5rbm93biB2YWx1ZSBpcyBhbiBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QgdGhyb3duIGJ5IGVzYnVpbGQuXG4gKiBAcGFyYW0gdmFsdWUgQSBwb3RlbnRpYWwgZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0LlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSBvYmplY3QgaXMgZGV0ZXJtaW5lZCB0byBiZSBhIEJ1aWxkRmFpbHVyZSBvYmplY3Q7IG90aGVyd2lzZSwgYGZhbHNlYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRXNCdWlsZEZhaWx1cmUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBCdWlsZEZhaWx1cmUge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICdlcnJvcnMnIGluIHZhbHVlICYmICd3YXJuaW5ncycgaW4gdmFsdWU7XG59XG5cbi8qKlxuICogRXhlY3V0ZXMgdGhlIGVzYnVpbGQgYnVpbGQgZnVuY3Rpb24gYW5kIG5vcm1hbGl6ZXMgdGhlIGJ1aWxkIHJlc3VsdCBpbiB0aGUgZXZlbnQgb2YgYVxuICogYnVpbGQgZmFpbHVyZSB0aGF0IHJlc3VsdHMgaW4gbm8gb3V0cHV0IGJlaW5nIGdlbmVyYXRlZC5cbiAqIEFsbCBidWlsZHMgdXNlIHRoZSBgd3JpdGVgIG9wdGlvbiB3aXRoIGEgdmFsdWUgb2YgYGZhbHNlYCB0byBhbGxvdyBmb3IgdGhlIG91dHB1dCBmaWxlc1xuICogYnVpbGQgcmVzdWx0IGFycmF5IHRvIGJlIHBvcHVsYXRlZC5cbiAqXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgZXNidWlsZCBvcHRpb25zIG9iamVjdCB0byB1c2Ugd2hlbiBidWlsZGluZy5cbiAqIEByZXR1cm5zIElmIG91dHB1dCBmaWxlcyBhcmUgZ2VuZXJhdGVkLCB0aGUgZnVsbCBlc2J1aWxkIEJ1aWxkUmVzdWx0OyBpZiBub3QsIHRoZVxuICogd2FybmluZ3MgYW5kIGVycm9ycyBmb3IgdGhlIGF0dGVtcHRlZCBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZShcbiAgb3B0aW9uczogQnVpbGRPcHRpb25zLFxuKTogUHJvbWlzZTxcbiAgKEJ1aWxkUmVzdWx0ICYgeyBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdIH0pIHwgKEJ1aWxkRmFpbHVyZSAmIHsgb3V0cHV0RmlsZXM/OiBuZXZlciB9KVxuPiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGJ1aWxkKHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGZhaWx1cmUpIHtcbiAgICAvLyBCdWlsZCBmYWlsdXJlcyB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbiB3aGljaCBjb250YWlucyBlcnJvcnMvd2FybmluZ3NcbiAgICBpZiAoaXNFc0J1aWxkRmFpbHVyZShmYWlsdXJlKSkge1xuICAgICAgcmV0dXJuIGZhaWx1cmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGZhaWx1cmU7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dNZXNzYWdlcyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHsgZXJyb3JzLCB3YXJuaW5ncyB9OiB7IGVycm9yczogTWVzc2FnZVtdOyB3YXJuaW5nczogTWVzc2FnZVtdIH0sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHdhcm5pbmdzLmxlbmd0aCkge1xuICAgIGNvbnN0IHdhcm5pbmdNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKHdhcm5pbmdzLCB7IGtpbmQ6ICd3YXJuaW5nJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG5cbiAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zdCBlcnJvck1lc3NhZ2VzID0gYXdhaXQgZm9ybWF0TWVzc2FnZXMoZXJyb3JzLCB7IGtpbmQ6ICdlcnJvcicsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG59XG4iXX0=