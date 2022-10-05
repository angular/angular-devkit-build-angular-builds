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
 * @param optionsOrInvalidate The esbuild options object to use when building or the invalidate object
 * returned from an incremental build to perform an additional incremental build.
 * @returns If output files are generated, the full esbuild BuildResult; if not, the
 * warnings and errors for the attempted build.
 */
async function bundle(optionsOrInvalidate) {
    try {
        if (typeof optionsOrInvalidate === 'function') {
            return (await optionsOrInvalidate());
        }
        else {
            return await (0, esbuild_1.build)({
                ...optionsOrInvalidate,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHFDQVNpQjtBQUVqQjs7OztHQUlHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsS0FBYztJQUM3QyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLEtBQUssQ0FBQztBQUMxRixDQUFDO0FBRkQsNENBRUM7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0ksS0FBSyxVQUFVLE1BQU0sQ0FDMUIsbUJBQW1EO0lBSW5ELElBQUk7UUFDRixJQUFJLE9BQU8sbUJBQW1CLEtBQUssVUFBVSxFQUFFO1lBQzdDLE9BQU8sQ0FBQyxNQUFNLG1CQUFtQixFQUFFLENBQWdELENBQUM7U0FDckY7YUFBTTtZQUNMLE9BQU8sTUFBTSxJQUFBLGVBQUssRUFBQztnQkFDakIsR0FBRyxtQkFBbUI7Z0JBQ3RCLEtBQUssRUFBRSxLQUFLO2FBQ2IsQ0FBQyxDQUFDO1NBQ0o7S0FDRjtJQUFDLE9BQU8sT0FBTyxFQUFFO1FBQ2hCLHdFQUF3RTtRQUN4RSxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzdCLE9BQU8sT0FBTyxDQUFDO1NBQ2hCO2FBQU07WUFDTCxNQUFNLE9BQU8sQ0FBQztTQUNmO0tBQ0Y7QUFDSCxDQUFDO0FBdEJELHdCQXNCQztBQUVNLEtBQUssVUFBVSxXQUFXLENBQy9CLE9BQXVCLEVBQ3ZCLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBOEM7SUFFaEUsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ25CLE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBQSx3QkFBYyxFQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDekYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQ2pEO0lBRUQsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ2pCLE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBQSx3QkFBYyxFQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbkYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQ2hEO0FBQ0gsQ0FBQztBQWJELGtDQWFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge1xuICBCdWlsZEZhaWx1cmUsXG4gIEJ1aWxkSW52YWxpZGF0ZSxcbiAgQnVpbGRPcHRpb25zLFxuICBCdWlsZFJlc3VsdCxcbiAgTWVzc2FnZSxcbiAgT3V0cHV0RmlsZSxcbiAgYnVpbGQsXG4gIGZvcm1hdE1lc3NhZ2VzLFxufSBmcm9tICdlc2J1aWxkJztcblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGFuIHVua25vd24gdmFsdWUgaXMgYW4gZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0IHRocm93biBieSBlc2J1aWxkLlxuICogQHBhcmFtIHZhbHVlIEEgcG90ZW50aWFsIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdC5cbiAqIEByZXR1cm5zIGB0cnVlYCBpZiB0aGUgb2JqZWN0IGlzIGRldGVybWluZWQgdG8gYmUgYSBCdWlsZEZhaWx1cmUgb2JqZWN0OyBvdGhlcndpc2UsIGBmYWxzZWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VzQnVpbGRGYWlsdXJlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgQnVpbGRGYWlsdXJlIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAnZXJyb3JzJyBpbiB2YWx1ZSAmJiAnd2FybmluZ3MnIGluIHZhbHVlO1xufVxuXG4vKipcbiAqIEV4ZWN1dGVzIHRoZSBlc2J1aWxkIGJ1aWxkIGZ1bmN0aW9uIGFuZCBub3JtYWxpemVzIHRoZSBidWlsZCByZXN1bHQgaW4gdGhlIGV2ZW50IG9mIGFcbiAqIGJ1aWxkIGZhaWx1cmUgdGhhdCByZXN1bHRzIGluIG5vIG91dHB1dCBiZWluZyBnZW5lcmF0ZWQuXG4gKiBBbGwgYnVpbGRzIHVzZSB0aGUgYHdyaXRlYCBvcHRpb24gd2l0aCBhIHZhbHVlIG9mIGBmYWxzZWAgdG8gYWxsb3cgZm9yIHRoZSBvdXRwdXQgZmlsZXNcbiAqIGJ1aWxkIHJlc3VsdCBhcnJheSB0byBiZSBwb3B1bGF0ZWQuXG4gKlxuICogQHBhcmFtIG9wdGlvbnNPckludmFsaWRhdGUgVGhlIGVzYnVpbGQgb3B0aW9ucyBvYmplY3QgdG8gdXNlIHdoZW4gYnVpbGRpbmcgb3IgdGhlIGludmFsaWRhdGUgb2JqZWN0XG4gKiByZXR1cm5lZCBmcm9tIGFuIGluY3JlbWVudGFsIGJ1aWxkIHRvIHBlcmZvcm0gYW4gYWRkaXRpb25hbCBpbmNyZW1lbnRhbCBidWlsZC5cbiAqIEByZXR1cm5zIElmIG91dHB1dCBmaWxlcyBhcmUgZ2VuZXJhdGVkLCB0aGUgZnVsbCBlc2J1aWxkIEJ1aWxkUmVzdWx0OyBpZiBub3QsIHRoZVxuICogd2FybmluZ3MgYW5kIGVycm9ycyBmb3IgdGhlIGF0dGVtcHRlZCBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZShcbiAgb3B0aW9uc09ySW52YWxpZGF0ZTogQnVpbGRPcHRpb25zIHwgQnVpbGRJbnZhbGlkYXRlLFxuKTogUHJvbWlzZTxcbiAgKEJ1aWxkUmVzdWx0ICYgeyBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdIH0pIHwgKEJ1aWxkRmFpbHVyZSAmIHsgb3V0cHV0RmlsZXM/OiBuZXZlciB9KVxuPiB7XG4gIHRyeSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zT3JJbnZhbGlkYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gKGF3YWl0IG9wdGlvbnNPckludmFsaWRhdGUoKSkgYXMgQnVpbGRSZXN1bHQgJiB7IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGF3YWl0IGJ1aWxkKHtcbiAgICAgICAgLi4ub3B0aW9uc09ySW52YWxpZGF0ZSxcbiAgICAgICAgd3JpdGU6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgfVxuICB9IGNhdGNoIChmYWlsdXJlKSB7XG4gICAgLy8gQnVpbGQgZmFpbHVyZXMgd2lsbCB0aHJvdyBhbiBleGNlcHRpb24gd2hpY2ggY29udGFpbnMgZXJyb3JzL3dhcm5pbmdzXG4gICAgaWYgKGlzRXNCdWlsZEZhaWx1cmUoZmFpbHVyZSkpIHtcbiAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBmYWlsdXJlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9nTWVzc2FnZXMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB7IGVycm9ycywgd2FybmluZ3MgfTogeyBlcnJvcnM6IE1lc3NhZ2VbXTsgd2FybmluZ3M6IE1lc3NhZ2VbXSB9LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICh3YXJuaW5ncy5sZW5ndGgpIHtcbiAgICBjb25zdCB3YXJuaW5nTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyh3YXJuaW5ncywgeyBraW5kOiAnd2FybmluZycsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZ01lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKGVycm9ycywgeyBraW5kOiAnZXJyb3InLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvck1lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxufVxuIl19