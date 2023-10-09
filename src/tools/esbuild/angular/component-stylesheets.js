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
exports.ComponentStylesheetBundler = void 0;
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const bundler_context_1 = require("../bundler-context");
const bundle_options_1 = require("../stylesheets/bundle-options");
class BundlerContextCache extends Map {
    getOrCreate(key, creator) {
        let value = this.get(key);
        if (value === undefined) {
            value = creator();
            this.set(key, value);
        }
        return value;
    }
}
/**
 * Bundles component stylesheets. A stylesheet can be either an inline stylesheet that
 * is contained within the Component's metadata definition or an external file referenced
 * from the Component's metadata definition.
 */
class ComponentStylesheetBundler {
    options;
    cache;
    #fileContexts = new BundlerContextCache();
    #inlineContexts = new BundlerContextCache();
    /**
     *
     * @param options An object containing the stylesheet bundling options.
     * @param cache A load result cache to use when bundling.
     */
    constructor(options, cache) {
        this.options = options;
        this.cache = cache;
    }
    async bundleFile(entry) {
        const bundlerContext = this.#fileContexts.getOrCreate(entry, () => {
            const buildOptions = (0, bundle_options_1.createStylesheetBundleOptions)(this.options, this.cache);
            buildOptions.entryPoints = [entry];
            return new bundler_context_1.BundlerContext(this.options.workspaceRoot, true, buildOptions);
        });
        return extractResult(await bundlerContext.bundle(), bundlerContext.watchFiles);
    }
    async bundleInline(data, filename, language) {
        // Use a hash of the inline stylesheet content to ensure a consistent identifier. External stylesheets will resolve
        // to the actual stylesheet file path.
        // TODO: Consider xxhash instead for hashing
        const id = (0, node_crypto_1.createHash)('sha256').update(data).digest('hex');
        const bundlerContext = this.#inlineContexts.getOrCreate(id, () => {
            const namespace = 'angular:styles/component';
            const entry = [language, id, filename].join(';');
            const buildOptions = (0, bundle_options_1.createStylesheetBundleOptions)(this.options, this.cache, {
                [entry]: data,
            });
            buildOptions.entryPoints = [`${namespace};${entry}`];
            buildOptions.plugins.push({
                name: 'angular-component-styles',
                setup(build) {
                    build.onResolve({ filter: /^angular:styles\/component;/ }, (args) => {
                        if (args.kind !== 'entry-point') {
                            return null;
                        }
                        return {
                            path: entry,
                            namespace,
                        };
                    });
                    build.onLoad({ filter: /^css;/, namespace }, async () => {
                        return {
                            contents: data,
                            loader: 'css',
                            resolveDir: node_path_1.default.dirname(filename),
                        };
                    });
                },
            });
            return new bundler_context_1.BundlerContext(this.options.workspaceRoot, true, buildOptions);
        });
        // Extract the result of the bundling from the output files
        return extractResult(await bundlerContext.bundle(), bundlerContext.watchFiles);
    }
    async dispose() {
        const contexts = [...this.#fileContexts.values(), ...this.#inlineContexts.values()];
        this.#fileContexts.clear();
        this.#inlineContexts.clear();
        await Promise.allSettled(contexts.map((context) => context.dispose()));
    }
}
exports.ComponentStylesheetBundler = ComponentStylesheetBundler;
function extractResult(result, referencedFiles) {
    let contents = '';
    let map;
    let outputPath;
    const resourceFiles = [];
    if (!result.errors) {
        for (const outputFile of result.outputFiles) {
            const filename = node_path_1.default.basename(outputFile.path);
            if (outputFile.type === bundler_context_1.BuildOutputFileType.Media) {
                // The output files could also contain resources (images/fonts/etc.) that were referenced
                resourceFiles.push(outputFile);
            }
            else if (filename.endsWith('.css')) {
                outputPath = outputFile.path;
                contents = outputFile.text;
            }
            else if (filename.endsWith('.css.map')) {
                map = outputFile.text;
            }
            else {
                throw new Error(`Unexpected non CSS/Media file "${filename}" outputted during component stylesheet processing.`);
            }
        }
    }
    let metafile;
    if (!result.errors) {
        metafile = result.metafile;
        // Remove entryPoint fields from outputs to prevent the internal component styles from being
        // treated as initial files. Also mark the entry as a component resource for stat reporting.
        Object.values(metafile.outputs).forEach((output) => {
            delete output.entryPoint;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            output['ng-component'] = true;
        });
    }
    return {
        errors: result.errors,
        warnings: result.warnings,
        contents,
        map,
        path: outputPath,
        resourceFiles,
        metafile,
        referencedFiles,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXN0eWxlc2hlZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBvbmVudC1zdHlsZXNoZWV0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw2Q0FBeUM7QUFDekMsMERBQTZCO0FBQzdCLHdEQUE4RjtBQUU5RixrRUFHdUM7QUFFdkMsTUFBTSxtQkFBb0IsU0FBUSxHQUEyQjtJQUMzRCxXQUFXLENBQUMsR0FBVyxFQUFFLE9BQTZCO1FBQ3BELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFMUIsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3ZCLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUN0QjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQWEsMEJBQTBCO0lBVWxCO0lBQ0E7SUFWVixhQUFhLEdBQUcsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO0lBQzFDLGVBQWUsR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7SUFFckQ7Ozs7T0FJRztJQUNILFlBQ21CLE9BQWdDLEVBQ2hDLEtBQXVCO1FBRHZCLFlBQU8sR0FBUCxPQUFPLENBQXlCO1FBQ2hDLFVBQUssR0FBTCxLQUFLLENBQWtCO0lBQ3ZDLENBQUM7SUFFSixLQUFLLENBQUMsVUFBVSxDQUFDLEtBQWE7UUFDNUIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRTtZQUNoRSxNQUFNLFlB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QUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ2xCLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBQzNCLDRGQUE0RjtRQUM1Riw0RkFBNEY7UUFDNUYsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDakQsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3pCLDhEQUE4RDtZQUM3RCxNQUFjLENBQUMsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7UUFDYixRQUFRO1FBQ1IsZUFBZTtLQUNoQixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZVR5cGUsIEJ1bmRsZUNvbnRleHRSZXN1bHQsIEJ1bmRsZXJDb250ZXh0IH0gZnJvbSAnLi4vYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcbmltcG9ydCB7XG4gIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyxcbn0gZnJvbSAnLi4vc3R5bGVzaGVldHMvYnVuZGxlLW9wdGlvbnMnO1xuXG5jbGFzcyBCdW5kbGVyQ29udGV4dENhY2hlIGV4dGVuZHMgTWFwPHN0cmluZywgQnVuZGxlckNvbnRleHQ+IHtcbiAgZ2V0T3JDcmVhdGUoa2V5OiBzdHJpbmcsIGNyZWF0b3I6ICgpID0+IEJ1bmRsZXJDb250ZXh0KTogQnVuZGxlckNvbnRleHQge1xuICAgIGxldCB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSBjcmVhdG9yKCk7XG4gICAgICB0aGlzLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbn1cblxuLyoqXG4gKiBCdW5kbGVzIGNvbXBvbmVudCBzdHlsZXNoZWV0cy4gQSBzdHlsZXNoZWV0IGNhbiBiZSBlaXRoZXIgYW4gaW5saW5lIHN0eWxlc2hlZXQgdGhhdFxuICogaXMgY29udGFpbmVkIHdpdGhpbiB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbiBvciBhbiBleHRlcm5hbCBmaWxlIHJlZmVyZW5jZWRcbiAqIGZyb20gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRTdHlsZXNoZWV0QnVuZGxlciB7XG4gIHJlYWRvbmx5ICNmaWxlQ29udGV4dHMgPSBuZXcgQnVuZGxlckNvbnRleHRDYWNoZSgpO1xuICByZWFkb25seSAjaW5saW5lQ29udGV4dHMgPSBuZXcgQnVuZGxlckNvbnRleHRDYWNoZSgpO1xuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgc3R5bGVzaGVldCBidW5kbGluZyBvcHRpb25zLlxuICAgKiBAcGFyYW0gY2FjaGUgQSBsb2FkIHJlc3VsdCBjYWNoZSB0byB1c2Ugd2hlbiBidW5kbGluZy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgKSB7fVxuXG4gIGFzeW5jIGJ1bmRsZUZpbGUoZW50cnk6IHN0cmluZykge1xuICAgIGNvbnN0IGJ1bmRsZXJDb250ZXh0ID0gdGhpcy4jZmlsZUNvbnRleHRzLmdldE9yQ3JlYXRlKGVudHJ5LCAoKSA9PiB7XG4gICAgICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIHRoaXMuY2FjaGUpO1xuICAgICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2VudHJ5XTtcblxuICAgICAgcmV0dXJuIG5ldyBCdW5kbGVyQ29udGV4dCh0aGlzLm9wdGlvbnMud29ya3NwYWNlUm9vdCwgdHJ1ZSwgYnVpbGRPcHRpb25zKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBleHRyYWN0UmVzdWx0KGF3YWl0IGJ1bmRsZXJDb250ZXh0LmJ1bmRsZSgpLCBidW5kbGVyQ29udGV4dC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIGFzeW5jIGJ1bmRsZUlubGluZShkYXRhOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpIHtcbiAgICAvLyBVc2UgYSBoYXNoIG9mIHRoZSBpbmxpbmUgc3R5bGVzaGVldCBjb250ZW50IHRvIGVuc3VyZSBhIGNvbnNpc3RlbnQgaWRlbnRpZmllci4gRXh0ZXJuYWwgc3R5bGVzaGVldHMgd2lsbCByZXNvbHZlXG4gICAgLy8gdG8gdGhlIGFjdHVhbCBzdHlsZXNoZWV0IGZpbGUgcGF0aC5cbiAgICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2ggaW5zdGVhZCBmb3IgaGFzaGluZ1xuICAgIGNvbnN0IGlkID0gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGRhdGEpLmRpZ2VzdCgnaGV4Jyk7XG5cbiAgICBjb25zdCBidW5kbGVyQ29udGV4dCA9IHRoaXMuI2lubGluZUNvbnRleHRzLmdldE9yQ3JlYXRlKGlkLCAoKSA9PiB7XG4gICAgICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JztcbiAgICAgIGNvbnN0IGVudHJ5ID0gW2xhbmd1YWdlLCBpZCwgZmlsZW5hbWVdLmpvaW4oJzsnKTtcblxuICAgICAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnModGhpcy5vcHRpb25zLCB0aGlzLmNhY2hlLCB7XG4gICAgICAgIFtlbnRyeV06IGRhdGEsXG4gICAgICB9KTtcbiAgICAgIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IFtgJHtuYW1lc3BhY2V9OyR7ZW50cnl9YF07XG4gICAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKHtcbiAgICAgICAgbmFtZTogJ2FuZ3VsYXItY29tcG9uZW50LXN0eWxlcycsXG4gICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c3R5bGVzXFwvY29tcG9uZW50Oy8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHBhdGg6IGVudHJ5LFxuICAgICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15jc3M7LywgbmFtZXNwYWNlIH0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwYXRoLmRpcm5hbWUoZmlsZW5hbWUpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gbmV3IEJ1bmRsZXJDb250ZXh0KHRoaXMub3B0aW9ucy53b3Jrc3BhY2VSb290LCB0cnVlLCBidWlsZE9wdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgLy8gRXh0cmFjdCB0aGUgcmVzdWx0IG9mIHRoZSBidW5kbGluZyBmcm9tIHRoZSBvdXRwdXQgZmlsZXNcbiAgICByZXR1cm4gZXh0cmFjdFJlc3VsdChhd2FpdCBidW5kbGVyQ29udGV4dC5idW5kbGUoKSwgYnVuZGxlckNvbnRleHQud2F0Y2hGaWxlcyk7XG4gIH1cblxuICBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbnRleHRzID0gWy4uLnRoaXMuI2ZpbGVDb250ZXh0cy52YWx1ZXMoKSwgLi4udGhpcy4jaW5saW5lQ29udGV4dHMudmFsdWVzKCldO1xuICAgIHRoaXMuI2ZpbGVDb250ZXh0cy5jbGVhcigpO1xuICAgIHRoaXMuI2lubGluZUNvbnRleHRzLmNsZWFyKCk7XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoY29udGV4dHMubWFwKChjb250ZXh0KSA9PiBjb250ZXh0LmRpc3Bvc2UoKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RSZXN1bHQocmVzdWx0OiBCdW5kbGVDb250ZXh0UmVzdWx0LCByZWZlcmVuY2VkRmlsZXM/OiBTZXQ8c3RyaW5nPikge1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGlmIChvdXRwdXRGaWxlLnR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuTWVkaWEpIHtcbiAgICAgICAgLy8gVGhlIG91dHB1dCBmaWxlcyBjb3VsZCBhbHNvIGNvbnRhaW4gcmVzb3VyY2VzIChpbWFnZXMvZm9udHMvZXRjLikgdGhhdCB3ZXJlIHJlZmVyZW5jZWRcbiAgICAgICAgcmVzb3VyY2VGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIG91dHB1dFBhdGggPSBvdXRwdXRGaWxlLnBhdGg7XG4gICAgICAgIGNvbnRlbnRzID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcy5tYXAnKSkge1xuICAgICAgICBtYXAgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFVuZXhwZWN0ZWQgbm9uIENTUy9NZWRpYSBmaWxlIFwiJHtmaWxlbmFtZX1cIiBvdXRwdXR0ZWQgZHVyaW5nIGNvbXBvbmVudCBzdHlsZXNoZWV0IHByb2Nlc3NpbmcuYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgbWV0YWZpbGU7XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIG1ldGFmaWxlID0gcmVzdWx0Lm1ldGFmaWxlO1xuICAgIC8vIFJlbW92ZSBlbnRyeVBvaW50IGZpZWxkcyBmcm9tIG91dHB1dHMgdG8gcHJldmVudCB0aGUgaW50ZXJuYWwgY29tcG9uZW50IHN0eWxlcyBmcm9tIGJlaW5nXG4gICAgLy8gdHJlYXRlZCBhcyBpbml0aWFsIGZpbGVzLiBBbHNvIG1hcmsgdGhlIGVudHJ5IGFzIGEgY29tcG9uZW50IHJlc291cmNlIGZvciBzdGF0IHJlcG9ydGluZy5cbiAgICBPYmplY3QudmFsdWVzKG1ldGFmaWxlLm91dHB1dHMpLmZvckVhY2goKG91dHB1dCkgPT4ge1xuICAgICAgZGVsZXRlIG91dHB1dC5lbnRyeVBvaW50O1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIChvdXRwdXQgYXMgYW55KVsnbmctY29tcG9uZW50J10gPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICBjb250ZW50cyxcbiAgICBtYXAsXG4gICAgcGF0aDogb3V0cHV0UGF0aCxcbiAgICByZXNvdXJjZUZpbGVzLFxuICAgIG1ldGFmaWxlLFxuICAgIHJlZmVyZW5jZWRGaWxlcyxcbiAgfTtcbn1cbiJdfQ==