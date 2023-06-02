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
exports.createGlobalStylesBundleOptions = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const bundle_options_1 = require("./stylesheets/bundle-options");
const virtual_module_plugin_1 = require("./virtual-module-plugin");
function createGlobalStylesBundleOptions(options, target, browsers, initial, cache) {
    const { workspaceRoot, optimizationOptions, sourcemapOptions, outputNames, globalStyles, preserveSymlinks, externalDependencies, stylePreprocessorOptions, tailwindConfiguration, } = options;
    const namespace = 'angular:styles/global';
    const entryPoints = {};
    let found = false;
    for (const style of globalStyles) {
        if (style.initial === initial) {
            found = true;
            entryPoints[style.name] = `${namespace};${style.name}`;
        }
    }
    // Skip if there are no entry points for the style loading type
    if (found === false) {
        return;
    }
    const buildOptions = (0, bundle_options_1.createStylesheetBundleOptions)({
        workspaceRoot,
        optimization: !!optimizationOptions.styles.minify,
        sourcemap: !!sourcemapOptions.styles,
        preserveSymlinks,
        target,
        externalDependencies,
        outputNames: initial
            ? outputNames
            : {
                ...outputNames,
                bundles: '[name]',
            },
        includePaths: stylePreprocessorOptions?.includePaths,
        browsers,
        tailwindConfiguration,
    }, cache);
    buildOptions.legalComments = options.extractLicenses ? 'none' : 'eof';
    buildOptions.entryPoints = entryPoints;
    buildOptions.plugins.unshift((0, virtual_module_plugin_1.createVirtualModulePlugin)({
        namespace,
        transformPath: (path) => path.split(';', 2)[1],
        loadContent: (args) => {
            const files = globalStyles.find(({ name }) => name === args.path)?.files;
            (0, node_assert_1.default)(files, `global style name should always be found [${args.path}]`);
            return {
                contents: files.map((file) => `@import '${file.replace(/\\/g, '/')}';`).join('\n'),
                loader: 'css',
                resolveDir: workspaceRoot,
            };
        },
    }));
    return buildOptions;
}
exports.createGlobalStylesBundleOptions = createGlobalStylesBundleOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXN0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9nbG9iYWwtc3R5bGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUdqQyxpRUFBNkU7QUFDN0UsbUVBQW9FO0FBRXBFLFNBQWdCLCtCQUErQixDQUM3QyxPQUFpQyxFQUNqQyxNQUFnQixFQUNoQixRQUFrQixFQUNsQixPQUFnQixFQUNoQixLQUF1QjtJQUV2QixNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsV0FBVyxFQUNYLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBQ3BCLHdCQUF3QixFQUN4QixxQkFBcUIsR0FDdEIsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztJQUMxQyxNQUFNLFdBQVcsR0FBMkIsRUFBRSxDQUFDO0lBQy9DLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNsQixLQUFLLE1BQU0sS0FBSyxJQUFJLFlBQVksRUFBRTtRQUNoQyxJQUFJLEtBQUssQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFO1lBQzdCLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUN4RDtLQUNGO0lBRUQsK0RBQStEO0lBQy9ELElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtRQUNuQixPQUFPO0tBQ1I7SUFFRCxNQUFNLFlBQVksR0FBRyxJQUFBLDhDQUE2QixFQUNoRDtRQUNFLGFBQWE7UUFDYixZQUFZLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxNQUFNO1FBQ2pELFNBQVMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTTtRQUNwQyxnQkFBZ0I7UUFDaEIsTUFBTTtRQUNOLG9CQUFvQjtRQUNwQixXQUFXLEVBQUUsT0FBTztZQUNsQixDQUFDLENBQUMsV0FBVztZQUNiLENBQUMsQ0FBQztnQkFDRSxHQUFHLFdBQVc7Z0JBQ2QsT0FBTyxFQUFFLFFBQVE7YUFDbEI7UUFDTCxZQUFZLEVBQUUsd0JBQXdCLEVBQUUsWUFBWTtRQUNwRCxRQUFRO1FBQ1IscUJBQXFCO0tBQ3RCLEVBQ0QsS0FBSyxDQUNOLENBQUM7SUFDRixZQUFZLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ3RFLFlBQVksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0lBRXZDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUMxQixJQUFBLGlEQUF5QixFQUFDO1FBQ3hCLFNBQVM7UUFDVCxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNwQixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUM7WUFDekUsSUFBQSxxQkFBTSxFQUFDLEtBQUssRUFBRSw2Q0FBNkMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7WUFFekUsT0FBTztnQkFDTCxRQUFRLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDbEYsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsVUFBVSxFQUFFLGFBQWE7YUFDMUIsQ0FBQztRQUNKLENBQUM7S0FDRixDQUFDLENBQ0gsQ0FBQztJQUVGLE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUEzRUQsMEVBMkVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi9zdHlsZXNoZWV0cy9idW5kbGUtb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luIH0gZnJvbSAnLi92aXJ0dWFsLW1vZHVsZS1wbHVnaW4nO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2xvYmFsU3R5bGVzQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBicm93c2Vyczogc3RyaW5nW10sXG4gIGluaXRpYWw6IGJvb2xlYW4sXG4gIGNhY2hlPzogTG9hZFJlc3VsdENhY2hlLFxuKTogQnVpbGRPcHRpb25zIHwgdW5kZWZpbmVkIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnN0eWxlcy9nbG9iYWwnO1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBzdHlsZSBvZiBnbG9iYWxTdHlsZXMpIHtcbiAgICBpZiAoc3R5bGUuaW5pdGlhbCA9PT0gaW5pdGlhbCkge1xuICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgZW50cnlQb2ludHNbc3R5bGUubmFtZV0gPSBgJHtuYW1lc3BhY2V9OyR7c3R5bGUubmFtZX1gO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNraXAgaWYgdGhlcmUgYXJlIG5vIGVudHJ5IHBvaW50cyBmb3IgdGhlIHN0eWxlIGxvYWRpbmcgdHlwZVxuICBpZiAoZm91bmQgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMoXG4gICAge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMsXG4gICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgdGFyZ2V0LFxuICAgICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICBvdXRwdXROYW1lczogaW5pdGlhbFxuICAgICAgICA/IG91dHB1dE5hbWVzXG4gICAgICAgIDoge1xuICAgICAgICAgICAgLi4ub3V0cHV0TmFtZXMsXG4gICAgICAgICAgICBidW5kbGVzOiAnW25hbWVdJyxcbiAgICAgICAgICB9LFxuICAgICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgIGJyb3dzZXJzLFxuICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgIH0sXG4gICAgY2FjaGUsXG4gICk7XG4gIGJ1aWxkT3B0aW9ucy5sZWdhbENvbW1lbnRzID0gb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJztcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gZW50cnlQb2ludHM7XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMudW5zaGlmdChcbiAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgIG5hbWVzcGFjZSxcbiAgICAgIHRyYW5zZm9ybVBhdGg6IChwYXRoKSA9PiBwYXRoLnNwbGl0KCc7JywgMilbMV0sXG4gICAgICBsb2FkQ29udGVudDogKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iYWxTdHlsZXMuZmluZCgoeyBuYW1lIH0pID0+IG5hbWUgPT09IGFyZ3MucGF0aCk/LmZpbGVzO1xuICAgICAgICBhc3NlcnQoZmlsZXMsIGBnbG9iYWwgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogZmlsZXMubWFwKChmaWxlKSA9PiBgQGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cbiJdfQ==