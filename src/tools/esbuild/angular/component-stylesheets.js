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
    incremental;
    cache;
    #fileContexts = new BundlerContextCache();
    #inlineContexts = new BundlerContextCache();
    /**
     *
     * @param options An object containing the stylesheet bundling options.
     * @param cache A load result cache to use when bundling.
     */
    constructor(options, incremental, cache) {
        this.options = options;
        this.incremental = incremental;
        this.cache = cache;
    }
    async bundleFile(entry) {
        const bundlerContext = this.#fileContexts.getOrCreate(entry, () => {
            const buildOptions = (0, bundle_options_1.createStylesheetBundleOptions)(this.options, this.cache);
            buildOptions.entryPoints = [entry];
            return new bundler_context_1.BundlerContext(this.options.workspaceRoot, this.incremental, buildOptions);
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
            return new bundler_context_1.BundlerContext(this.options.workspaceRoot, this.incremental, buildOptions);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXN0eWxlc2hlZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBvbmVudC1zdHlsZXNoZWV0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw2Q0FBeUM7QUFDekMsMERBQTZCO0FBQzdCLHdEQUE4RjtBQUU5RixrRUFHdUM7QUFFdkMsTUFBTSxtQkFBb0IsU0FBUSxHQUEyQjtJQUMzRCxXQUFXLENBQUMsR0FBVyxFQUFFLE9BQTZCO1FBQ3BELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFMUIsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3ZCLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUN0QjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQWEsMEJBQTBCO0lBVWxCO0lBQ0E7SUFDQTtJQVhWLGFBQWEsR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7SUFDMUMsZUFBZSxHQUFHLElBQUksbUJBQW1CLEVBQUUsQ0FBQztJQUVyRDs7OztPQUlHO0lBQ0gsWUFDbUIsT0FBZ0MsRUFDaEMsV0FBb0IsRUFDcEIsS0FBdUI7UUFGdkIsWUFBTyxHQUFQLE9BQU8sQ0FBeUI7UUFDaEMsZ0JBQVcsR0FBWCxXQUFXLENBQVM7UUFDcEIsVUFBSyxHQUFMLEtBQUssQ0FBa0I7SUFDdkMsQ0FBQztJQUVKLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBYTtRQUM1QixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFD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QUFRLHFEQUFxRCxDQUNoRyxDQUFDO2FBQ0g7U0FDRjtLQUNGO0lBRUQsSUFBSSxRQUFRLENBQUM7SUFDYixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNsQixRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUMzQiw0RkFBNEY7UUFDNUYsNEZBQTRGO1FBQzVGLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ2pELE9BQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUN6Qiw4REFBOEQ7WUFDN0QsTUFBYyxDQUFDLGNBQWMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN6QyxDQUFDLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTztRQUNMLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtRQUNyQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsUUFBUTtRQUNSLEdBQUc7UUFDSCxJQUFJLEVBQUUsVUFBVTtRQUNoQixhQUFhO1FBQ2IsUUFBUTtRQUNSLGVBQWU7S0FDaEIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGVUeXBlLCBCdW5kbGVDb250ZXh0UmVzdWx0LCBCdW5kbGVyQ29udGV4dCB9IGZyb20gJy4uL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQge1xuICBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbiAgY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMsXG59IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcblxuY2xhc3MgQnVuZGxlckNvbnRleHRDYWNoZSBleHRlbmRzIE1hcDxzdHJpbmcsIEJ1bmRsZXJDb250ZXh0PiB7XG4gIGdldE9yQ3JlYXRlKGtleTogc3RyaW5nLCBjcmVhdG9yOiAoKSA9PiBCdW5kbGVyQ29udGV4dCk6IEJ1bmRsZXJDb250ZXh0IHtcbiAgICBsZXQgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbHVlID0gY3JlYXRvcigpO1xuICAgICAgdGhpcy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbi8qKlxuICogQnVuZGxlcyBjb21wb25lbnQgc3R5bGVzaGVldHMuIEEgc3R5bGVzaGVldCBjYW4gYmUgZWl0aGVyIGFuIGlubGluZSBzdHlsZXNoZWV0IHRoYXRcbiAqIGlzIGNvbnRhaW5lZCB3aXRoaW4gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24gb3IgYW4gZXh0ZXJuYWwgZmlsZSByZWZlcmVuY2VkXG4gKiBmcm9tIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIge1xuICByZWFkb25seSAjZmlsZUNvbnRleHRzID0gbmV3IEJ1bmRsZXJDb250ZXh0Q2FjaGUoKTtcbiAgcmVhZG9ubHkgI2lubGluZUNvbnRleHRzID0gbmV3IEJ1bmRsZXJDb250ZXh0Q2FjaGUoKTtcblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucy5cbiAgICogQHBhcmFtIGNhY2hlIEEgbG9hZCByZXN1bHQgY2FjaGUgdG8gdXNlIHdoZW4gYnVuZGxpbmcuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgaW5jcmVtZW50YWw6IGJvb2xlYW4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgKSB7fVxuXG4gIGFzeW5jIGJ1bmRsZUZpbGUoZW50cnk6IHN0cmluZykge1xuICAgIGNvbnN0IGJ1bmRsZXJDb250ZXh0ID0gdGhpcy4jZmlsZUNvbnRleHRzLmdldE9yQ3JlYXRlKGVudHJ5LCAoKSA9PiB7XG4gICAgICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIHRoaXMuY2FjaGUpO1xuICAgICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2VudHJ5XTtcblxuICAgICAgcmV0dXJuIG5ldyBCdW5kbGVyQ29udGV4dCh0aGlzLm9wdGlvbnMud29ya3NwYWNlUm9vdCwgdGhpcy5pbmNyZW1lbnRhbCwgYnVpbGRPcHRpb25zKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBleHRyYWN0UmVzdWx0KGF3YWl0IGJ1bmRsZXJDb250ZXh0LmJ1bmRsZSgpLCBidW5kbGVyQ29udGV4dC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIGFzeW5jIGJ1bmRsZUlubGluZShkYXRhOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpIHtcbiAgICAvLyBVc2UgYSBoYXNoIG9mIHRoZSBpbmxpbmUgc3R5bGVzaGVldCBjb250ZW50IHRvIGVuc3VyZSBhIGNvbnNpc3RlbnQgaWRlbnRpZmllci4gRXh0ZXJuYWwgc3R5bGVzaGVldHMgd2lsbCByZXNvbHZlXG4gICAgLy8gdG8gdGhlIGFjdHVhbCBzdHlsZXNoZWV0IGZpbGUgcGF0aC5cbiAgICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2ggaW5zdGVhZCBmb3IgaGFzaGluZ1xuICAgIGNvbnN0IGlkID0gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGRhdGEpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgY29uc3QgZW50cnkgPSBbbGFuZ3VhZ2UsIGlkLCBmaWxlbmFtZV0uam9pbignOycpO1xuXG4gICAgY29uc3QgYnVuZGxlckNvbnRleHQgPSB0aGlzLiNpbmxpbmVDb250ZXh0cy5nZXRPckNyZWF0ZShlbnRyeSwgKCkgPT4ge1xuICAgICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCc7XG4gICAgICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIHRoaXMuY2FjaGUsIHtcbiAgICAgICAgW2VudHJ5XTogZGF0YSxcbiAgICAgIH0pO1xuICAgICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2Ake25hbWVzcGFjZX07JHtlbnRyeX1gXTtcbiAgICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goe1xuICAgICAgICBuYW1lOiAnYW5ndWxhci1jb21wb25lbnQtc3R5bGVzJyxcbiAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9jb21wb25lbnQ7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgcGF0aDogZW50cnksXG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXmNzczsvLCBuYW1lc3BhY2UgfSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICAgIHJlc29sdmVEaXI6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBuZXcgQnVuZGxlckNvbnRleHQodGhpcy5vcHRpb25zLndvcmtzcGFjZVJvb3QsIHRoaXMuaW5jcmVtZW50YWwsIGJ1aWxkT3B0aW9ucyk7XG4gICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICAgIHJldHVybiBleHRyYWN0UmVzdWx0KGF3YWl0IGJ1bmRsZXJDb250ZXh0LmJ1bmRsZSgpLCBidW5kbGVyQ29udGV4dC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGV4dHMgPSBbLi4udGhpcy4jZmlsZUNvbnRleHRzLnZhbHVlcygpLCAuLi50aGlzLiNpbmxpbmVDb250ZXh0cy52YWx1ZXMoKV07XG4gICAgdGhpcy4jZmlsZUNvbnRleHRzLmNsZWFyKCk7XG4gICAgdGhpcy4jaW5saW5lQ29udGV4dHMuY2xlYXIoKTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChjb250ZXh0cy5tYXAoKGNvbnRleHQpID0+IGNvbnRleHQuZGlzcG9zZSgpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdFJlc3VsdChyZXN1bHQ6IEJ1bmRsZUNvbnRleHRSZXN1bHQsIHJlZmVyZW5jZWRGaWxlcz86IFNldDxzdHJpbmc+KSB7XG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKG91dHB1dEZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSkge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5leHBlY3RlZCBub24gQ1NTL01lZGlhIGZpbGUgXCIke2ZpbGVuYW1lfVwiIG91dHB1dHRlZCBkdXJpbmcgY29tcG9uZW50IHN0eWxlc2hlZXQgcHJvY2Vzc2luZy5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBtZXRhZmlsZTtcbiAgaWYgKCFyZXN1bHQuZXJyb3JzKSB7XG4gICAgbWV0YWZpbGUgPSByZXN1bHQubWV0YWZpbGU7XG4gICAgLy8gUmVtb3ZlIGVudHJ5UG9pbnQgZmllbGRzIGZyb20gb3V0cHV0cyB0byBwcmV2ZW50IHRoZSBpbnRlcm5hbCBjb21wb25lbnQgc3R5bGVzIGZyb20gYmVpbmdcbiAgICAvLyB0cmVhdGVkIGFzIGluaXRpYWwgZmlsZXMuIEFsc28gbWFyayB0aGUgZW50cnkgYXMgYSBjb21wb25lbnQgcmVzb3VyY2UgZm9yIHN0YXQgcmVwb3J0aW5nLlxuICAgIE9iamVjdC52YWx1ZXMobWV0YWZpbGUub3V0cHV0cykuZm9yRWFjaCgob3V0cHV0KSA9PiB7XG4gICAgICBkZWxldGUgb3V0cHV0LmVudHJ5UG9pbnQ7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gICAgbWV0YWZpbGUsXG4gICAgcmVmZXJlbmNlZEZpbGVzLFxuICB9O1xufVxuIl19