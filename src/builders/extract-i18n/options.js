"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOptions = void 0;
const architect_1 = require("@angular-devkit/architect");
const node_assert_1 = require("node:assert");
const node_path_1 = __importDefault(require("node:path"));
const i18n_options_1 = require("../../utils/i18n-options");
const schema_1 = require("./schema");
/**
 * Normalize the user provided options by creating full paths for all path based options
 * and converting multi-form options into a single form that can be directly used
 * by the build process.
 *
 * @param context The context for current builder execution.
 * @param projectName The name of the project for the current execution.
 * @param options An object containing the options to use for the build.
 * @returns An object containing normalized options required to perform the build.
 */
async function normalizeOptions(context, projectName, options) {
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = node_path_1.default.join(workspaceRoot, projectMetadata.root ?? '');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buildTarget = (0, architect_1.targetFromTargetString)(options.buildTarget ?? options.browserTarget);
    const i18nOptions = (0, i18n_options_1.createI18nOptions)(projectMetadata);
    // Normalize xliff format extensions
    let format = options.format;
    switch (format) {
        case undefined:
        // Default format is xliff1
        case schema_1.Format.Xlf:
        case schema_1.Format.Xlif:
        case schema_1.Format.Xliff:
            format = schema_1.Format.Xliff;
            break;
        case schema_1.Format.Xlf2:
        case schema_1.Format.Xliff2:
            format = schema_1.Format.Xliff2;
            break;
    }
    let outFile = options.outFile || getDefaultOutFile(format);
    if (options.outputPath) {
        outFile = node_path_1.default.join(options.outputPath, outFile);
    }
    outFile = node_path_1.default.resolve(context.workspaceRoot, outFile);
    return {
        workspaceRoot,
        projectRoot,
        buildTarget,
        i18nOptions,
        format,
        outFile,
        progress: options.progress ?? true,
    };
}
exports.normalizeOptions = normalizeOptions;
function getDefaultOutFile(format) {
    switch (format) {
        case schema_1.Format.Xmb:
            return 'messages.xmb';
        case schema_1.Format.Xliff:
        case schema_1.Format.Xliff2:
            return 'messages.xlf';
        case schema_1.Format.Json:
        case schema_1.Format.LegacyMigrate:
            return 'messages.json';
        case schema_1.Format.Arb:
            return 'messages.arb';
        default:
            (0, node_assert_1.fail)(`Invalid Format enum value: ${format}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2V4dHJhY3QtaTE4bi9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILHlEQUFtRjtBQUNuRiw2Q0FBbUM7QUFDbkMsMERBQTZCO0FBQzdCLDJEQUE2RDtBQUM3RCxxQ0FBZ0U7QUFJaEU7Ozs7Ozs7OztHQVNHO0FBQ0ksS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxPQUF1QixFQUN2QixXQUFtQixFQUNuQixPQUEyQjtJQUUzQixNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQzVDLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsSUFBMkIsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUVqRyxvRUFBb0U7SUFDcEUsTUFBTSxXQUFXLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsV0FBVyxJQUFJLE9BQU8sQ0FBQyxhQUFjLENBQUMsQ0FBQztJQUUxRixNQUFNLFdBQVcsR0FBRyxJQUFBLGdDQUFpQixFQUFDLGVBQWUsQ0FBQyxDQUFDO0lBRXZELG9DQUFvQztJQUNwQyxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO0lBQzVCLFFBQVEsTUFBTSxFQUFFO1FBQ2QsS0FBSyxTQUFTLENBQUM7UUFDZiwyQkFBMkI7UUFDM0IsS0FBSyxlQUFNLENBQUMsR0FBRyxDQUFDO1FBQ2hCLEtBQUssZUFBTSxDQUFDLElBQUksQ0FBQztRQUNqQixLQUFLLGVBQU0sQ0FBQyxLQUFLO1lBQ2YsTUFBTSxHQUFHLGVBQU0sQ0FBQyxLQUFLLENBQUM7WUFDdEIsTUFBTTtRQUNSLEtBQUssZUFBTSxDQUFDLElBQUksQ0FBQztRQUNqQixLQUFLLGVBQU0sQ0FBQyxNQUFNO1lBQ2hCLE1BQU0sR0FBRyxlQUFNLENBQUMsTUFBTSxDQUFDO1lBQ3ZCLE1BQU07S0FDVDtJQUVELElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLElBQUksaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0QsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQ3RCLE9BQU8sR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ2xEO0lBQ0QsT0FBTyxHQUFHLG1CQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFdkQsT0FBTztRQUNMLGFBQWE7UUFDYixXQUFXO1FBQ1gsV0FBVztRQUNYLFdBQVc7UUFDWCxNQUFNO1FBQ04sT0FBTztRQUNQLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxJQUFJLElBQUk7S0FDbkMsQ0FBQztBQUNKLENBQUM7QUE3Q0QsNENBNkNDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxNQUFjO0lBQ3ZDLFFBQVEsTUFBTSxFQUFFO1FBQ2QsS0FBSyxlQUFNLENBQUMsR0FBRztZQUNiLE9BQU8sY0FBYyxDQUFDO1FBQ3hCLEtBQUssZUFBTSxDQUFDLEtBQUssQ0FBQztRQUNsQixLQUFLLGVBQU0sQ0FBQyxNQUFNO1lBQ2hCLE9BQU8sY0FBYyxDQUFDO1FBQ3hCLEtBQUssZUFBTSxDQUFDLElBQUksQ0FBQztRQUNqQixLQUFLLGVBQU0sQ0FBQyxhQUFhO1lBQ3ZCLE9BQU8sZUFBZSxDQUFDO1FBQ3pCLEtBQUssZUFBTSxDQUFDLEdBQUc7WUFDYixPQUFPLGNBQWMsQ0FBQztRQUN4QjtZQUNFLElBQUEsa0JBQUksRUFBQyw4QkFBOEIsTUFBaUIsRUFBRSxDQUFDLENBQUM7S0FDM0Q7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBmYWlsIH0gZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGNyZWF0ZUkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IFNjaGVtYSBhcyBFeHRyYWN0STE4bk9wdGlvbnMsIEZvcm1hdCB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEV4dHJhY3RJMThuT3B0aW9ucyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2Ygbm9ybWFsaXplT3B0aW9ucz4+O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgdXNlciBwcm92aWRlZCBvcHRpb25zIGJ5IGNyZWF0aW5nIGZ1bGwgcGF0aHMgZm9yIGFsbCBwYXRoIGJhc2VkIG9wdGlvbnNcbiAqIGFuZCBjb252ZXJ0aW5nIG11bHRpLWZvcm0gb3B0aW9ucyBpbnRvIGEgc2luZ2xlIGZvcm0gdGhhdCBjYW4gYmUgZGlyZWN0bHkgdXNlZFxuICogYnkgdGhlIGJ1aWxkIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGNvbnRleHQgZm9yIGN1cnJlbnQgYnVpbGRlciBleGVjdXRpb24uXG4gKiBAcGFyYW0gcHJvamVjdE5hbWUgVGhlIG5hbWUgb2YgdGhlIHByb2plY3QgZm9yIHRoZSBjdXJyZW50IGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvcHRpb25zIHRvIHVzZSBmb3IgdGhlIGJ1aWxkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgbm9ybWFsaXplZCBvcHRpb25zIHJlcXVpcmVkIHRvIHBlcmZvcm0gdGhlIGJ1aWxkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IEV4dHJhY3RJMThuT3B0aW9ucyxcbikge1xuICBjb25zdCB3b3Jrc3BhY2VSb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICBjb25zdCBidWlsZFRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5idWlsZFRhcmdldCA/PyBvcHRpb25zLmJyb3dzZXJUYXJnZXQhKTtcblxuICBjb25zdCBpMThuT3B0aW9ucyA9IGNyZWF0ZUkxOG5PcHRpb25zKHByb2plY3RNZXRhZGF0YSk7XG5cbiAgLy8gTm9ybWFsaXplIHhsaWZmIGZvcm1hdCBleHRlbnNpb25zXG4gIGxldCBmb3JtYXQgPSBvcHRpb25zLmZvcm1hdDtcbiAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAvLyBEZWZhdWx0IGZvcm1hdCBpcyB4bGlmZjFcbiAgICBjYXNlIEZvcm1hdC5YbGY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjpcbiAgICAgIGZvcm1hdCA9IEZvcm1hdC5YbGlmZjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgRm9ybWF0LlhsZjI6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmYyOlxuICAgICAgZm9ybWF0ID0gRm9ybWF0LlhsaWZmMjtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgbGV0IG91dEZpbGUgPSBvcHRpb25zLm91dEZpbGUgfHwgZ2V0RGVmYXVsdE91dEZpbGUoZm9ybWF0KTtcbiAgaWYgKG9wdGlvbnMub3V0cHV0UGF0aCkge1xuICAgIG91dEZpbGUgPSBwYXRoLmpvaW4ob3B0aW9ucy5vdXRwdXRQYXRoLCBvdXRGaWxlKTtcbiAgfVxuICBvdXRGaWxlID0gcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3V0RmlsZSk7XG5cbiAgcmV0dXJuIHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHByb2plY3RSb290LFxuICAgIGJ1aWxkVGFyZ2V0LFxuICAgIGkxOG5PcHRpb25zLFxuICAgIGZvcm1hdCxcbiAgICBvdXRGaWxlLFxuICAgIHByb2dyZXNzOiBvcHRpb25zLnByb2dyZXNzID8/IHRydWUsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRPdXRGaWxlKGZvcm1hdDogRm9ybWF0KSB7XG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBGb3JtYXQuWG1iOlxuICAgICAgcmV0dXJuICdtZXNzYWdlcy54bWInO1xuICAgIGNhc2UgRm9ybWF0LlhsaWZmOlxuICAgIGNhc2UgRm9ybWF0LlhsaWZmMjpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMueGxmJztcbiAgICBjYXNlIEZvcm1hdC5Kc29uOlxuICAgIGNhc2UgRm9ybWF0LkxlZ2FjeU1pZ3JhdGU6XG4gICAgICByZXR1cm4gJ21lc3NhZ2VzLmpzb24nO1xuICAgIGNhc2UgRm9ybWF0LkFyYjpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMuYXJiJztcbiAgICBkZWZhdWx0OlxuICAgICAgZmFpbChgSW52YWxpZCBGb3JtYXQgZW51bSB2YWx1ZTogJHtmb3JtYXQgYXMgdW5rbm93bn1gKTtcbiAgfVxufVxuIl19