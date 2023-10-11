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
        const entry = [language, id, filename].join(';');
        const bundlerContext = this.#inlineContexts.getOrCreate(entry, () => {
            const namespace = 'angular:styles/component';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXN0eWxlc2hlZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBvbmVudC1zdHlsZXNoZWV0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw2Q0FBeUM7QUFDekMsMERBQTZCO0FBQzdCLHdEQUE4RjtBQUU5RixrRUFHdUM7QUFFdkMsTUFBTSxtQkFBb0IsU0FBUSxHQUEyQjtJQUMzRCxXQUFXLENBQUMsR0FBVyxFQUFFLE9BQTZCO1FBQ3BELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFMUIsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3ZCLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUN0QjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQWEsMEJBQTBCO0lBVWxCO0lBQ0E7SUFWVixhQUFhLEdBQUcsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO0lBQzFDLGVBQWUsR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7SUFFckQ7Ozs7T0FJRztJQUNILFlBQ21CLE9BQWdDLEVBQ2hDLEtBQXVCO1FBRHZCLFlBQU8sR0FBUCxPQUFPLENBQXlCO1FBQ2hDLFVBQUssR0FBTCxLQUFLLENBQWtCO0lBQ3ZDLENBQUM7SUFFSixLQUFLLENBQUMsVUFBVSxDQUFDLEtBQWE7UUFDNUIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRTtZQUNoRSxNQUFNLFlB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QUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ2xCLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBQzNCLDRGQUE0RjtRQUM1Riw0RkFBNEY7UUFDNUYsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDakQsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3pCLDhEQUE4RDtZQUM3RCxNQUFjLENBQUMsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7UUFDYixRQUFRO1FBQ1IsZUFBZTtLQUNoQixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZVR5cGUsIEJ1bmRsZUNvbnRleHRSZXN1bHQsIEJ1bmRsZXJDb250ZXh0IH0gZnJvbSAnLi4vYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcbmltcG9ydCB7XG4gIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyxcbn0gZnJvbSAnLi4vc3R5bGVzaGVldHMvYnVuZGxlLW9wdGlvbnMnO1xuXG5jbGFzcyBCdW5kbGVyQ29udGV4dENhY2hlIGV4dGVuZHMgTWFwPHN0cmluZywgQnVuZGxlckNvbnRleHQ+IHtcbiAgZ2V0T3JDcmVhdGUoa2V5OiBzdHJpbmcsIGNyZWF0b3I6ICgpID0+IEJ1bmRsZXJDb250ZXh0KTogQnVuZGxlckNvbnRleHQge1xuICAgIGxldCB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSBjcmVhdG9yKCk7XG4gICAgICB0aGlzLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbn1cblxuLyoqXG4gKiBCdW5kbGVzIGNvbXBvbmVudCBzdHlsZXNoZWV0cy4gQSBzdHlsZXNoZWV0IGNhbiBiZSBlaXRoZXIgYW4gaW5saW5lIHN0eWxlc2hlZXQgdGhhdFxuICogaXMgY29udGFpbmVkIHdpdGhpbiB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbiBvciBhbiBleHRlcm5hbCBmaWxlIHJlZmVyZW5jZWRcbiAqIGZyb20gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRTdHlsZXNoZWV0QnVuZGxlciB7XG4gIHJlYWRvbmx5ICNmaWxlQ29udGV4dHMgPSBuZXcgQnVuZGxlckNvbnRleHRDYWNoZSgpO1xuICByZWFkb25seSAjaW5saW5lQ29udGV4dHMgPSBuZXcgQnVuZGxlckNvbnRleHRDYWNoZSgpO1xuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgc3R5bGVzaGVldCBidW5kbGluZyBvcHRpb25zLlxuICAgKiBAcGFyYW0gY2FjaGUgQSBsb2FkIHJlc3VsdCBjYWNoZSB0byB1c2Ugd2hlbiBidW5kbGluZy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgKSB7fVxuXG4gIGFzeW5jIGJ1bmRsZUZpbGUoZW50cnk6IHN0cmluZykge1xuICAgIGNvbnN0IGJ1bmRsZXJDb250ZXh0ID0gdGhpcy4jZmlsZUNvbnRleHRzLmdldE9yQ3JlYXRlKGVudHJ5LCAoKSA9PiB7XG4gICAgICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIHRoaXMuY2FjaGUpO1xuICAgICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2VudHJ5XTtcblxuICAgICAgcmV0dXJuIG5ldyBCdW5kbGVyQ29udGV4dCh0aGlzLm9wdGlvbnMud29ya3NwYWNlUm9vdCwgdHJ1ZSwgYnVpbGRPcHRpb25zKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBleHRyYWN0UmVzdWx0KGF3YWl0IGJ1bmRsZXJDb250ZXh0LmJ1bmRsZSgpLCBidW5kbGVyQ29udGV4dC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIGFzeW5jIGJ1bmRsZUlubGluZShkYXRhOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpIHtcbiAgICAvLyBVc2UgYSBoYXNoIG9mIHRoZSBpbmxpbmUgc3R5bGVzaGVldCBjb250ZW50IHRvIGVuc3VyZSBhIGNvbnNpc3RlbnQgaWRlbnRpZmllci4gRXh0ZXJuYWwgc3R5bGVzaGVldHMgd2lsbCByZXNvbHZlXG4gICAgLy8gdG8gdGhlIGFjdHVhbCBzdHlsZXNoZWV0IGZpbGUgcGF0aC5cbiAgICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2ggaW5zdGVhZCBmb3IgaGFzaGluZ1xuICAgIGNvbnN0IGlkID0gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGRhdGEpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgY29uc3QgZW50cnkgPSBbbGFuZ3VhZ2UsIGlkLCBmaWxlbmFtZV0uam9pbignOycpO1xuXG4gICAgY29uc3QgYnVuZGxlckNvbnRleHQgPSB0aGlzLiNpbmxpbmVDb250ZXh0cy5nZXRPckNyZWF0ZShlbnRyeSwgKCkgPT4ge1xuICAgICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCc7XG4gICAgICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIHRoaXMuY2FjaGUsIHtcbiAgICAgICAgW2VudHJ5XTogZGF0YSxcbiAgICAgIH0pO1xuICAgICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2Ake25hbWVzcGFjZX07JHtlbnRyeX1gXTtcbiAgICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goe1xuICAgICAgICBuYW1lOiAnYW5ndWxhci1jb21wb25lbnQtc3R5bGVzJyxcbiAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9jb21wb25lbnQ7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgcGF0aDogZW50cnksXG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXmNzczsvLCBuYW1lc3BhY2UgfSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICAgIHJlc29sdmVEaXI6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBuZXcgQnVuZGxlckNvbnRleHQodGhpcy5vcHRpb25zLndvcmtzcGFjZVJvb3QsIHRydWUsIGJ1aWxkT3B0aW9ucyk7XG4gICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICAgIHJldHVybiBleHRyYWN0UmVzdWx0KGF3YWl0IGJ1bmRsZXJDb250ZXh0LmJ1bmRsZSgpLCBidW5kbGVyQ29udGV4dC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGV4dHMgPSBbLi4udGhpcy4jZmlsZUNvbnRleHRzLnZhbHVlcygpLCAuLi50aGlzLiNpbmxpbmVDb250ZXh0cy52YWx1ZXMoKV07XG4gICAgdGhpcy4jZmlsZUNvbnRleHRzLmNsZWFyKCk7XG4gICAgdGhpcy4jaW5saW5lQ29udGV4dHMuY2xlYXIoKTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChjb250ZXh0cy5tYXAoKGNvbnRleHQpID0+IGNvbnRleHQuZGlzcG9zZSgpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdFJlc3VsdChyZXN1bHQ6IEJ1bmRsZUNvbnRleHRSZXN1bHQsIHJlZmVyZW5jZWRGaWxlcz86IFNldDxzdHJpbmc+KSB7XG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKG91dHB1dEZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSkge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5leHBlY3RlZCBub24gQ1NTL01lZGlhIGZpbGUgXCIke2ZpbGVuYW1lfVwiIG91dHB1dHRlZCBkdXJpbmcgY29tcG9uZW50IHN0eWxlc2hlZXQgcHJvY2Vzc2luZy5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBtZXRhZmlsZTtcbiAgaWYgKCFyZXN1bHQuZXJyb3JzKSB7XG4gICAgbWV0YWZpbGUgPSByZXN1bHQubWV0YWZpbGU7XG4gICAgLy8gUmVtb3ZlIGVudHJ5UG9pbnQgZmllbGRzIGZyb20gb3V0cHV0cyB0byBwcmV2ZW50IHRoZSBpbnRlcm5hbCBjb21wb25lbnQgc3R5bGVzIGZyb20gYmVpbmdcbiAgICAvLyB0cmVhdGVkIGFzIGluaXRpYWwgZmlsZXMuIEFsc28gbWFyayB0aGUgZW50cnkgYXMgYSBjb21wb25lbnQgcmVzb3VyY2UgZm9yIHN0YXQgcmVwb3J0aW5nLlxuICAgIE9iamVjdC52YWx1ZXMobWV0YWZpbGUub3V0cHV0cykuZm9yRWFjaCgob3V0cHV0KSA9PiB7XG4gICAgICBkZWxldGUgb3V0cHV0LmVudHJ5UG9pbnQ7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gICAgbWV0YWZpbGUsXG4gICAgcmVmZXJlbmNlZEZpbGVzLFxuICB9O1xufVxuIl19