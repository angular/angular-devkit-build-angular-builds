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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXN0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvZ2xvYmFsLXN0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw4REFBaUM7QUFHakMsaUVBQTZFO0FBQzdFLG1FQUFvRTtBQUVwRSxTQUFnQiwrQkFBK0IsQ0FDN0MsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsUUFBa0IsRUFDbEIsT0FBZ0IsRUFDaEIsS0FBdUI7SUFFdkIsTUFBTSxFQUNKLGFBQWEsRUFDYixtQkFBbUIsRUFDbkIsZ0JBQWdCLEVBQ2hCLFdBQVcsRUFDWCxZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLG9CQUFvQixFQUNwQix3QkFBd0IsRUFDeEIscUJBQXFCLEdBQ3RCLEdBQUcsT0FBTyxDQUFDO0lBRVosTUFBTSxTQUFTLEdBQUcsdUJBQXVCLENBQUM7SUFDMUMsTUFBTSxXQUFXLEdBQTJCLEVBQUUsQ0FBQztJQUMvQyxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDbEIsS0FBSyxNQUFNLEtBQUssSUFBSSxZQUFZLEVBQUU7UUFDaEMsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFLLE9BQU8sRUFBRTtZQUM3QixLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLFNBQVMsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDeEQ7S0FDRjtJQUVELCtEQUErRDtJQUMvRCxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7UUFDbkIsT0FBTztLQUNSO0lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBQSw4Q0FBNkIsRUFDaEQ7UUFDRSxhQUFhO1FBQ2IsWUFBWSxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTTtRQUNqRCxTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU07UUFDcEMsZ0JBQWdCO1FBQ2hCLE1BQU07UUFDTixvQkFBb0I7UUFDcEIsV0FBVyxFQUFFLE9BQU87WUFDbEIsQ0FBQyxDQUFDLFdBQVc7WUFDYixDQUFDLENBQUM7Z0JBQ0UsR0FBRyxXQUFXO2dCQUNkLE9BQU8sRUFBRSxRQUFRO2FBQ2xCO1FBQ0wsWUFBWSxFQUFFLHdCQUF3QixFQUFFLFlBQVk7UUFDcEQsUUFBUTtRQUNSLHFCQUFxQjtLQUN0QixFQUNELEtBQUssQ0FDTixDQUFDO0lBQ0YsWUFBWSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUN0RSxZQUFZLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUV2QyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDMUIsSUFBQSxpREFBeUIsRUFBQztRQUN4QixTQUFTO1FBQ1QsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDcEIsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDO1lBQ3pFLElBQUEscUJBQU0sRUFBQyxLQUFLLEVBQUUsNkNBQTZDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO1lBRXpFLE9BQU87Z0JBQ0wsUUFBUSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQ2xGLE1BQU0sRUFBRSxLQUFLO2dCQUNiLFVBQVUsRUFBRSxhQUFhO2FBQzFCLENBQUM7UUFDSixDQUFDO0tBQ0YsQ0FBQyxDQUNILENBQUM7SUFFRixPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBM0VELDBFQTJFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucyB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMgfSBmcm9tICcuL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4gfSBmcm9tICcuL3ZpcnR1YWwtbW9kdWxlLXBsdWdpbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIGJyb3dzZXJzOiBzdHJpbmdbXSxcbiAgaW5pdGlhbDogYm9vbGVhbixcbiAgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZ2xvYmFsU3R5bGVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2dsb2JhbCc7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGxldCBmb3VuZCA9IGZhbHNlO1xuICBmb3IgKGNvbnN0IHN0eWxlIG9mIGdsb2JhbFN0eWxlcykge1xuICAgIGlmIChzdHlsZS5pbml0aWFsID09PSBpbml0aWFsKSB7XG4gICAgICBmb3VuZCA9IHRydWU7XG4gICAgICBlbnRyeVBvaW50c1tzdHlsZS5uYW1lXSA9IGAke25hbWVzcGFjZX07JHtzdHlsZS5uYW1lfWA7XG4gICAgfVxuICB9XG5cbiAgLy8gU2tpcCBpZiB0aGVyZSBhcmUgbm8gZW50cnkgcG9pbnRzIGZvciB0aGUgc3R5bGUgbG9hZGluZyB0eXBlXG4gIGlmIChmb3VuZCA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhcbiAgICB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICB0YXJnZXQsXG4gICAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgIG91dHB1dE5hbWVzOiBpbml0aWFsXG4gICAgICAgID8gb3V0cHV0TmFtZXNcbiAgICAgICAgOiB7XG4gICAgICAgICAgICAuLi5vdXRwdXROYW1lcyxcbiAgICAgICAgICAgIGJ1bmRsZXM6ICdbbmFtZV0nLFxuICAgICAgICAgIH0sXG4gICAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgYnJvd3NlcnMsXG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgfSxcbiAgICBjYWNoZSxcbiAgKTtcbiAgYnVpbGRPcHRpb25zLmxlZ2FsQ29tbWVudHMgPSBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnO1xuICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSBlbnRyeVBvaW50cztcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucy51bnNoaWZ0KFxuICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgbmFtZXNwYWNlLFxuICAgICAgdHJhbnNmb3JtUGF0aDogKHBhdGgpID0+IHBhdGguc3BsaXQoJzsnLCAyKVsxXSxcbiAgICAgIGxvYWRDb250ZW50OiAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFN0eWxlcy5maW5kKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gYXJncy5wYXRoKT8uZmlsZXM7XG4gICAgICAgIGFzc2VydChmaWxlcywgYGdsb2JhbCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBmaWxlcy5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9KSxcbiAgKTtcblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuIl19