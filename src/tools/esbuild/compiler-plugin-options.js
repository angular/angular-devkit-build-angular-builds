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
            incremental: !!options.watch,
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
            publicPath: options.publicPath,
        },
    };
}
exports.createCompilerPluginOptions = createCompilerPluginOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQVFILFNBQWdCLDJCQUEyQixDQUN6QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUtqQyxNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsUUFBUSxFQUNSLFdBQVcsRUFDWCxnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBQ3BCLGdCQUFnQixFQUNoQix3QkFBd0IsRUFDeEIscUJBQXFCLEVBQ3JCLG1CQUFtQixFQUNuQixHQUFHLEVBQ0gscUJBQXFCLEdBQ3RCLEdBQUcsT0FBTyxDQUFDO0lBRVosT0FBTztRQUNMLGdCQUFnQjtRQUNoQixhQUFhLEVBQUU7WUFDYixTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE9BQU87WUFDckMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsTUFBTTtZQUM3QyxRQUFRO1lBQ1IsR0FBRztZQUNILHFCQUFxQjtZQUNyQixnQkFBZ0I7WUFDaEIsZUFBZTtZQUNmLGVBQWUsRUFBRSxlQUFlLEVBQUUsZUFBZTtZQUNqRCxXQUFXLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLO1NBQzdCO1FBQ0QsK0JBQStCO1FBQy9CLFlBQVksRUFBRTtZQUNaLGFBQWE7WUFDYixZQUFZLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxNQUFNO1lBQ2pELFNBQVM7WUFDUCwrRUFBK0U7WUFDL0UsbUZBQW1GO1lBQ25GLDJCQUEyQjtZQUMzQixDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUMzRSxXQUFXO1lBQ1gsWUFBWSxFQUFFLHdCQUF3QixFQUFFLFlBQVk7WUFDcEQsb0JBQW9CO1lBQ3BCLE1BQU07WUFDTixtQkFBbUI7WUFDbkIsZ0JBQWdCO1lBQ2hCLHFCQUFxQjtZQUNyQixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7U0FDL0I7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXhERCxrRUF3REMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luIH0gZnJvbSAnLi9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgdHlwZSB7IFNvdXJjZUZpbGVDYWNoZSB9IGZyb20gJy4vYW5ndWxhci9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbnR5cGUgQ3JlYXRlQ29tcGlsZXJQbHVnaW5QYXJhbWV0ZXJzID0gUGFyYW1ldGVyczx0eXBlb2YgY3JlYXRlQ29tcGlsZXJQbHVnaW4+O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IHtcbiAgcGx1Z2luT3B0aW9uczogQ3JlYXRlQ29tcGlsZXJQbHVnaW5QYXJhbWV0ZXJzWzBdO1xuICBzdHlsZU9wdGlvbnM6IENyZWF0ZUNvbXBpbGVyUGx1Z2luUGFyYW1ldGVyc1sxXTtcbn0ge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9ID0gb3B0aW9ucztcblxuICByZXR1cm4ge1xuICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICBwbHVnaW5PcHRpb25zOiB7XG4gICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgdHNjb25maWcsXG4gICAgICBqaXQsXG4gICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgICAgc291cmNlRmlsZUNhY2hlLFxuICAgICAgbG9hZFJlc3VsdENhY2hlOiBzb3VyY2VGaWxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgIGluY3JlbWVudGFsOiAhIW9wdGlvbnMud2F0Y2gsXG4gICAgfSxcbiAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgc3R5bGVPcHRpb25zOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgLy8gSGlkZGVuIGNvbXBvbmVudCBzdHlsZXNoZWV0IHNvdXJjZW1hcHMgYXJlIGluYWNjZXNzaWJsZSB3aGljaCBpcyBlZmZlY3RpdmVseVxuICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyBmYWxzZSA6ICdpbmxpbmUnKSxcbiAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgdGFyZ2V0LFxuICAgICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgICBwdWJsaWNQYXRoOiBvcHRpb25zLnB1YmxpY1BhdGgsXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==