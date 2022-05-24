"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessages = exports.bundle = exports.isEsBuildFailure = exports.DEFAULT_OUTDIR = void 0;
const esbuild_1 = require("esbuild");
const path_1 = require("path");
/** Default outdir setting for esbuild. */
exports.DEFAULT_OUTDIR = (0, path_1.resolve)('/virtual-output');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHFDQVFpQjtBQUNqQiwrQkFBK0I7QUFFL0IsMENBQTBDO0FBQzdCLFFBQUEsY0FBYyxHQUFHLElBQUEsY0FBTyxFQUFDLGlCQUFpQixDQUFDLENBQUM7QUFFekQ7Ozs7R0FJRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWM7SUFDN0MsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUZELDRDQUVDO0FBRUQ7Ozs7Ozs7OztHQVNHO0FBQ0ksS0FBSyxVQUFVLE1BQU0sQ0FDMUIsT0FBcUI7SUFJckIsSUFBSTtRQUNGLE9BQU8sTUFBTSxJQUFBLGVBQUssRUFBQztZQUNqQixHQUFHLE9BQU87WUFDVixLQUFLLEVBQUUsS0FBSztTQUNiLENBQUMsQ0FBQztLQUNKO0lBQUMsT0FBTyxPQUFPLEVBQUU7UUFDaEIsd0VBQXdFO1FBQ3hFLElBQUksZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDN0IsT0FBTyxPQUFPLENBQUM7U0FDaEI7YUFBTTtZQUNMLE1BQU0sT0FBTyxDQUFDO1NBQ2Y7S0FDRjtBQUNILENBQUM7QUFsQkQsd0JBa0JDO0FBRU0sS0FBSyxVQUFVLFdBQVcsQ0FDL0IsT0FBdUIsRUFDdkIsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUE4QztJQUVoRSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7UUFDbkIsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFBLHdCQUFjLEVBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN6RixPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDakQ7SUFFRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDakIsTUFBTSxhQUFhLEdBQUcsTUFBTSxJQUFBLHdCQUFjLEVBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNuRixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDaEQ7QUFDSCxDQUFDO0FBYkQsa0NBYUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7XG4gIEJ1aWxkRmFpbHVyZSxcbiAgQnVpbGRPcHRpb25zLFxuICBCdWlsZFJlc3VsdCxcbiAgTWVzc2FnZSxcbiAgT3V0cHV0RmlsZSxcbiAgYnVpbGQsXG4gIGZvcm1hdE1lc3NhZ2VzLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcblxuLyoqIERlZmF1bHQgb3V0ZGlyIHNldHRpbmcgZm9yIGVzYnVpbGQuICovXG5leHBvcnQgY29uc3QgREVGQVVMVF9PVVRESVIgPSByZXNvbHZlKCcvdmlydHVhbC1vdXRwdXQnKTtcblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGFuIHVua25vd24gdmFsdWUgaXMgYW4gZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0IHRocm93biBieSBlc2J1aWxkLlxuICogQHBhcmFtIHZhbHVlIEEgcG90ZW50aWFsIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdC5cbiAqIEByZXR1cm5zIGB0cnVlYCBpZiB0aGUgb2JqZWN0IGlzIGRldGVybWluZWQgdG8gYmUgYSBCdWlsZEZhaWx1cmUgb2JqZWN0OyBvdGhlcndpc2UsIGBmYWxzZWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VzQnVpbGRGYWlsdXJlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgQnVpbGRGYWlsdXJlIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAnZXJyb3JzJyBpbiB2YWx1ZSAmJiAnd2FybmluZ3MnIGluIHZhbHVlO1xufVxuXG4vKipcbiAqIEV4ZWN1dGVzIHRoZSBlc2J1aWxkIGJ1aWxkIGZ1bmN0aW9uIGFuZCBub3JtYWxpemVzIHRoZSBidWlsZCByZXN1bHQgaW4gdGhlIGV2ZW50IG9mIGFcbiAqIGJ1aWxkIGZhaWx1cmUgdGhhdCByZXN1bHRzIGluIG5vIG91dHB1dCBiZWluZyBnZW5lcmF0ZWQuXG4gKiBBbGwgYnVpbGRzIHVzZSB0aGUgYHdyaXRlYCBvcHRpb24gd2l0aCBhIHZhbHVlIG9mIGBmYWxzZWAgdG8gYWxsb3cgZm9yIHRoZSBvdXRwdXQgZmlsZXNcbiAqIGJ1aWxkIHJlc3VsdCBhcnJheSB0byBiZSBwb3B1bGF0ZWQuXG4gKlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGVzYnVpbGQgb3B0aW9ucyBvYmplY3QgdG8gdXNlIHdoZW4gYnVpbGRpbmcuXG4gKiBAcmV0dXJucyBJZiBvdXRwdXQgZmlsZXMgYXJlIGdlbmVyYXRlZCwgdGhlIGZ1bGwgZXNidWlsZCBCdWlsZFJlc3VsdDsgaWYgbm90LCB0aGVcbiAqIHdhcm5pbmdzIGFuZCBlcnJvcnMgZm9yIHRoZSBhdHRlbXB0ZWQgYnVpbGQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGUoXG4gIG9wdGlvbnM6IEJ1aWxkT3B0aW9ucyxcbik6IFByb21pc2U8XG4gIChCdWlsZFJlc3VsdCAmIHsgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSB9KSB8IChCdWlsZEZhaWx1cmUgJiB7IG91dHB1dEZpbGVzPzogbmV2ZXIgfSlcbj4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBidWlsZCh7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgd3JpdGU6IGZhbHNlLFxuICAgIH0pO1xuICB9IGNhdGNoIChmYWlsdXJlKSB7XG4gICAgLy8gQnVpbGQgZmFpbHVyZXMgd2lsbCB0aHJvdyBhbiBleGNlcHRpb24gd2hpY2ggY29udGFpbnMgZXJyb3JzL3dhcm5pbmdzXG4gICAgaWYgKGlzRXNCdWlsZEZhaWx1cmUoZmFpbHVyZSkpIHtcbiAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBmYWlsdXJlO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9nTWVzc2FnZXMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB7IGVycm9ycywgd2FybmluZ3MgfTogeyBlcnJvcnM6IE1lc3NhZ2VbXTsgd2FybmluZ3M6IE1lc3NhZ2VbXSB9LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICh3YXJuaW5ncy5sZW5ndGgpIHtcbiAgICBjb25zdCB3YXJuaW5nTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyh3YXJuaW5ncywgeyBraW5kOiAnd2FybmluZycsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZ01lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKGVycm9ycywgeyBraW5kOiAnZXJyb3InLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvck1lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxufVxuIl19