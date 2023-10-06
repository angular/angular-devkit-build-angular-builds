"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompilerPluginOptions = void 0;
function createCompilerPluginOptions(options, target, sourceFileCache) {
    const { workspaceRoot, optimizationOptions, sourcemapOptions, tsconfig, outputNames, fileReplacements, externalDependencies, preserveSymlinks, stylePreprocessorOptions, advancedOptimizations, inlineStyleLanguage, jit, tailwindConfiguration, } = options;
    return {
        // JS/TS options
        pluginOptions: {
            sourcemap: !!sourcemapOptions.scripts,
            thirdPartySourcemaps: sourcemapOptions.vendor,
            tsconfig,
            jit,
            advancedOptimizations,
            fileReplacements,
            sourceFileCache,
            loadResultCache: sourceFileCache?.loadResultCache,
        },
        // Component stylesheet options
        styleOptions: {
            workspaceRoot,
            optimization: !!optimizationOptions.styles.minify,
            sourcemap: 
            // Hidden component stylesheet sourcemaps are inaccessible which is effectively
            // the same as being disabled. Disabling has the advantage of avoiding the overhead
            // of sourcemap processing.
            !!sourcemapOptions.styles && (sourcemapOptions.hidden ? false : 'inline'),
            outputNames,
            includePaths: stylePreprocessorOptions?.includePaths,
            externalDependencies,
            target,
            inlineStyleLanguage,
            preserveSymlinks,
            tailwindConfiguration,
        },
    };
}
exports.createCompilerPluginOptions = createCompilerPluginOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQVFILFNBQWdCLDJCQUEyQixDQUN6QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUtqQyxNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsUUFBUSxFQUNSLFdBQVcsRUFDWCxnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBQ3BCLGdCQUFnQixFQUNoQix3QkFBd0IsRUFDeEIscUJBQXFCLEVBQ3JCLG1CQUFtQixFQUNuQixHQUFHLEVBQ0gscUJBQXFCLEdBQ3RCLEdBQUcsT0FBTyxDQUFDO0lBRVosT0FBTztRQUNMLGdCQUFnQjtRQUNoQixhQUFhLEVBQUU7WUFDYixTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE9BQU87WUFDckMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsTUFBTTtZQUM3QyxRQUFRO1lBQ1IsR0FBRztZQUNILHFCQUFxQjtZQUNyQixnQkFBZ0I7WUFDaEIsZUFBZTtZQUNmLGVBQWUsRUFBRSxlQUFlLEVBQUUsZUFBZTtTQUNsRDtRQUNELCtCQUErQjtRQUMvQixZQUFZLEVBQUU7WUFDWixhQUFhO1lBQ2IsWUFBWSxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTTtZQUNqRCxTQUFTO1lBQ1AsK0VBQStFO1lBQy9FLG1GQUFtRjtZQUNuRiwyQkFBMkI7WUFDM0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDM0UsV0FBVztZQUNYLFlBQVksRUFBRSx3QkFBd0IsRUFBRSxZQUFZO1lBQ3BELG9CQUFvQjtZQUNwQixNQUFNO1lBQ04sbUJBQW1CO1lBQ25CLGdCQUFnQjtZQUNoQixxQkFBcUI7U0FDdEI7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXRERCxrRUFzREMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luIH0gZnJvbSAnLi9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgdHlwZSB7IFNvdXJjZUZpbGVDYWNoZSB9IGZyb20gJy4vYW5ndWxhci9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbnR5cGUgQ3JlYXRlQ29tcGlsZXJQbHVnaW5QYXJhbWV0ZXJzID0gUGFyYW1ldGVyczx0eXBlb2YgY3JlYXRlQ29tcGlsZXJQbHVnaW4+O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IHtcbiAgcGx1Z2luT3B0aW9uczogQ3JlYXRlQ29tcGlsZXJQbHVnaW5QYXJhbWV0ZXJzWzBdO1xuICBzdHlsZU9wdGlvbnM6IENyZWF0ZUNvbXBpbGVyUGx1Z2luUGFyYW1ldGVyc1sxXTtcbn0ge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9ID0gb3B0aW9ucztcblxuICByZXR1cm4ge1xuICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICBwbHVnaW5PcHRpb25zOiB7XG4gICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgdHNjb25maWcsXG4gICAgICBqaXQsXG4gICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgICAgc291cmNlRmlsZUNhY2hlLFxuICAgICAgbG9hZFJlc3VsdENhY2hlOiBzb3VyY2VGaWxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICB9LFxuICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICBzdHlsZU9wdGlvbnM6IHtcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgc291cmNlbWFwOlxuICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgIC8vIHRoZSBzYW1lIGFzIGJlaW5nIGRpc2FibGVkLiBEaXNhYmxpbmcgaGFzIHRoZSBhZHZhbnRhZ2Ugb2YgYXZvaWRpbmcgdGhlIG92ZXJoZWFkXG4gICAgICAgIC8vIG9mIHNvdXJjZW1hcCBwcm9jZXNzaW5nLlxuICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICB0YXJnZXQsXG4gICAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgICB9LFxuICB9O1xufVxuIl19