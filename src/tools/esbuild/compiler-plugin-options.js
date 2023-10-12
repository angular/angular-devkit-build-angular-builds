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
            publicPath: options.publicPath,
        },
    };
}
exports.createCompilerPluginOptions = createCompilerPluginOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQVFILFNBQWdCLDJCQUEyQixDQUN6QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUtqQyxNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsUUFBUSxFQUNSLFdBQVcsRUFDWCxnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBQ3BCLGdCQUFnQixFQUNoQix3QkFBd0IsRUFDeEIscUJBQXFCLEVBQ3JCLG1CQUFtQixFQUNuQixHQUFHLEVBQ0gscUJBQXFCLEdBQ3RCLEdBQUcsT0FBTyxDQUFDO0lBRVosT0FBTztRQUNMLGdCQUFnQjtRQUNoQixhQUFhLEVBQUU7WUFDYixTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE9BQU87WUFDckMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsTUFBTTtZQUM3QyxRQUFRO1lBQ1IsR0FBRztZQUNILHFCQUFxQjtZQUNyQixnQkFBZ0I7WUFDaEIsZUFBZTtZQUNmLGVBQWUsRUFBRSxlQUFlLEVBQUUsZUFBZTtTQUNsRDtRQUNELCtCQUErQjtRQUMvQixZQUFZLEVBQUU7WUFDWixhQUFhO1lBQ2IsWUFBWSxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTTtZQUNqRCxTQUFTO1lBQ1AsK0VBQStFO1lBQy9FLG1GQUFtRjtZQUNuRiwyQkFBMkI7WUFDM0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDM0UsV0FBVztZQUNYLFlBQVksRUFBRSx3QkFBd0IsRUFBRSxZQUFZO1lBQ3BELG9CQUFvQjtZQUNwQixNQUFNO1lBQ04sbUJBQW1CO1lBQ25CLGdCQUFnQjtZQUNoQixxQkFBcUI7WUFDckIsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVO1NBQy9CO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUF2REQsa0VBdURDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyB9IGZyb20gJy4uLy4uL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMnO1xuaW1wb3J0IHR5cGUgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHR5cGUgeyBTb3VyY2VGaWxlQ2FjaGUgfSBmcm9tICcuL2FuZ3VsYXIvc291cmNlLWZpbGUtY2FjaGUnO1xuXG50eXBlIENyZWF0ZUNvbXBpbGVyUGx1Z2luUGFyYW1ldGVycyA9IFBhcmFtZXRlcnM8dHlwZW9mIGNyZWF0ZUNvbXBpbGVyUGx1Z2luPjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiB7XG4gIHBsdWdpbk9wdGlvbnM6IENyZWF0ZUNvbXBpbGVyUGx1Z2luUGFyYW1ldGVyc1swXTtcbiAgc3R5bGVPcHRpb25zOiBDcmVhdGVDb21waWxlclBsdWdpblBhcmFtZXRlcnNbMV07XG59IHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgaml0LFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIHtcbiAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgcGx1Z2luT3B0aW9uczoge1xuICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzOiBzb3VyY2VtYXBPcHRpb25zLnZlbmRvcixcbiAgICAgIHRzY29uZmlnLFxuICAgICAgaml0LFxuICAgICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgICAgIGxvYWRSZXN1bHRDYWNoZTogc291cmNlRmlsZUNhY2hlPy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgfSxcbiAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgc3R5bGVPcHRpb25zOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgLy8gSGlkZGVuIGNvbXBvbmVudCBzdHlsZXNoZWV0IHNvdXJjZW1hcHMgYXJlIGluYWNjZXNzaWJsZSB3aGljaCBpcyBlZmZlY3RpdmVseVxuICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyBmYWxzZSA6ICdpbmxpbmUnKSxcbiAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgdGFyZ2V0LFxuICAgICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgICBwdWJsaWNQYXRoOiBvcHRpb25zLnB1YmxpY1BhdGgsXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==