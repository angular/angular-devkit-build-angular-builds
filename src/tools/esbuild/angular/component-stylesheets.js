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
    #fileContexts = new BundlerContextCache();
    #inlineContexts = new BundlerContextCache();
    /**
     *
     * @param options An object containing the stylesheet bundling options.
     * @param cache A load result cache to use when bundling.
     */
    constructor(options, incremental) {
        this.options = options;
        this.incremental = incremental;
    }
    async bundleFile(entry) {
        const bundlerContext = this.#fileContexts.getOrCreate(entry, () => {
            return new bundler_context_1.BundlerContext(this.options.workspaceRoot, this.incremental, (loadCache) => {
                const buildOptions = (0, bundle_options_1.createStylesheetBundleOptions)(this.options, loadCache);
                buildOptions.entryPoints = [entry];
                return buildOptions;
            });
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
            return new bundler_context_1.BundlerContext(this.options.workspaceRoot, this.incremental, (loadCache) => {
                const buildOptions = (0, bundle_options_1.createStylesheetBundleOptions)(this.options, loadCache, {
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
                return buildOptions;
            });
        });
        // Extract the result of the bundling from the output files
        return extractResult(await bundlerContext.bundle(), bundlerContext.watchFiles);
    }
    invalidate(files) {
        if (!this.incremental) {
            return;
        }
        for (const bundler of this.#fileContexts.values()) {
            bundler.invalidate(files);
        }
        for (const bundler of this.#inlineContexts.values()) {
            bundler.invalidate(files);
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXN0eWxlc2hlZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBvbmVudC1zdHlsZXNoZWV0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw2Q0FBeUM7QUFDekMsMERBQTZCO0FBQzdCLHdEQUE4RjtBQUM5RixrRUFHdUM7QUFFdkMsTUFBTSxtQkFBb0IsU0FBUSxHQUEyQjtJQUMzRCxXQUFXLENBQUMsR0FBVyxFQUFFLE9BQTZCO1FBQ3BELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFMUIsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3ZCLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUN0QjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQWEsMEJBQTBCO0lBVWxCO0lBQ0E7SUFWVixhQUFhLEdBQUcsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO0lBQzFDLGVBQWUsR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7SUFFckQ7Ozs7T0FJRztJQUNILFlBQ21CLE9BQWdDLEVBQ2hDLFdBQW9CO1FBRHBCLFlBQU8sR0FBUCxPQUFPLENBQXlCO1FBQ2hDLGdCQUFXLEdBQVgsV0FBVyxDQUFTO0lBQ3BDLENBQUM7SUFFSixLQUFLLENBQUMsVUFBVSxDQUFDLEtBQWE7UUFDNUIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRTtZQUNoRSxPQUFPLElB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ZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgQnVpbGRPdXRwdXRGaWxlVHlwZSwgQnVuZGxlQ29udGV4dFJlc3VsdCwgQnVuZGxlckNvbnRleHQgfSBmcm9tICcuLi9idW5kbGVyLWNvbnRleHQnO1xuaW1wb3J0IHtcbiAgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gIGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zLFxufSBmcm9tICcuLi9zdHlsZXNoZWV0cy9idW5kbGUtb3B0aW9ucyc7XG5cbmNsYXNzIEJ1bmRsZXJDb250ZXh0Q2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCBCdW5kbGVyQ29udGV4dD4ge1xuICBnZXRPckNyZWF0ZShrZXk6IHN0cmluZywgY3JlYXRvcjogKCkgPT4gQnVuZGxlckNvbnRleHQpOiBCdW5kbGVyQ29udGV4dCB7XG4gICAgbGV0IHZhbHVlID0gdGhpcy5nZXQoa2V5KTtcblxuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YWx1ZSA9IGNyZWF0b3IoKTtcbiAgICAgIHRoaXMuc2V0KGtleSwgdmFsdWUpO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxufVxuXG4vKipcbiAqIEJ1bmRsZXMgY29tcG9uZW50IHN0eWxlc2hlZXRzLiBBIHN0eWxlc2hlZXQgY2FuIGJlIGVpdGhlciBhbiBpbmxpbmUgc3R5bGVzaGVldCB0aGF0XG4gKiBpcyBjb250YWluZWQgd2l0aGluIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uIG9yIGFuIGV4dGVybmFsIGZpbGUgcmVmZXJlbmNlZFxuICogZnJvbSB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudFN0eWxlc2hlZXRCdW5kbGVyIHtcbiAgcmVhZG9ubHkgI2ZpbGVDb250ZXh0cyA9IG5ldyBCdW5kbGVyQ29udGV4dENhY2hlKCk7XG4gIHJlYWRvbmx5ICNpbmxpbmVDb250ZXh0cyA9IG5ldyBCdW5kbGVyQ29udGV4dENhY2hlKCk7XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMuXG4gICAqIEBwYXJhbSBjYWNoZSBBIGxvYWQgcmVzdWx0IGNhY2hlIHRvIHVzZSB3aGVuIGJ1bmRsaW5nLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGluY3JlbWVudGFsOiBib29sZWFuLFxuICApIHt9XG5cbiAgYXN5bmMgYnVuZGxlRmlsZShlbnRyeTogc3RyaW5nKSB7XG4gICAgY29uc3QgYnVuZGxlckNvbnRleHQgPSB0aGlzLiNmaWxlQ29udGV4dHMuZ2V0T3JDcmVhdGUoZW50cnksICgpID0+IHtcbiAgICAgIHJldHVybiBuZXcgQnVuZGxlckNvbnRleHQodGhpcy5vcHRpb25zLndvcmtzcGFjZVJvb3QsIHRoaXMuaW5jcmVtZW50YWwsIChsb2FkQ2FjaGUpID0+IHtcbiAgICAgICAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnModGhpcy5vcHRpb25zLCBsb2FkQ2FjaGUpO1xuICAgICAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSBbZW50cnldO1xuXG4gICAgICAgIHJldHVybiBidWlsZE9wdGlvbnM7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBleHRyYWN0UmVzdWx0KGF3YWl0IGJ1bmRsZXJDb250ZXh0LmJ1bmRsZSgpLCBidW5kbGVyQ29udGV4dC53YXRjaEZpbGVzKTtcbiAgfVxuXG4gIGFzeW5jIGJ1bmRsZUlubGluZShkYXRhOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpIHtcbiAgICAvLyBVc2UgYSBoYXNoIG9mIHRoZSBpbmxpbmUgc3R5bGVzaGVldCBjb250ZW50IHRvIGVuc3VyZSBhIGNvbnNpc3RlbnQgaWRlbnRpZmllci4gRXh0ZXJuYWwgc3R5bGVzaGVldHMgd2lsbCByZXNvbHZlXG4gICAgLy8gdG8gdGhlIGFjdHVhbCBzdHlsZXNoZWV0IGZpbGUgcGF0aC5cbiAgICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2ggaW5zdGVhZCBmb3IgaGFzaGluZ1xuICAgIGNvbnN0IGlkID0gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGRhdGEpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgY29uc3QgZW50cnkgPSBbbGFuZ3VhZ2UsIGlkLCBmaWxlbmFtZV0uam9pbignOycpO1xuXG4gICAgY29uc3QgYnVuZGxlckNvbnRleHQgPSB0aGlzLiNpbmxpbmVDb250ZXh0cy5nZXRPckNyZWF0ZShlbnRyeSwgKCkgPT4ge1xuICAgICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCc7XG5cbiAgICAgIHJldHVybiBuZXcgQnVuZGxlckNvbnRleHQodGhpcy5vcHRpb25zLndvcmtzcGFjZVJvb3QsIHRoaXMuaW5jcmVtZW50YWwsIChsb2FkQ2FjaGUpID0+IHtcbiAgICAgICAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnModGhpcy5vcHRpb25zLCBsb2FkQ2FjaGUsIHtcbiAgICAgICAgICBbZW50cnldOiBkYXRhLFxuICAgICAgICB9KTtcbiAgICAgICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2Ake25hbWVzcGFjZX07JHtlbnRyeX1gXTtcbiAgICAgICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaCh7XG4gICAgICAgICAgbmFtZTogJ2FuZ3VsYXItY29tcG9uZW50LXN0eWxlcycsXG4gICAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDsvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcGF0aDogZW50cnksXG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9eY3NzOy8sIG5hbWVzcGFjZSB9LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwYXRoLmRpcm5hbWUoZmlsZW5hbWUpLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gRXh0cmFjdCB0aGUgcmVzdWx0IG9mIHRoZSBidW5kbGluZyBmcm9tIHRoZSBvdXRwdXQgZmlsZXNcbiAgICByZXR1cm4gZXh0cmFjdFJlc3VsdChhd2FpdCBidW5kbGVyQ29udGV4dC5idW5kbGUoKSwgYnVuZGxlckNvbnRleHQud2F0Y2hGaWxlcyk7XG4gIH1cblxuICBpbnZhbGlkYXRlKGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+KSB7XG4gICAgaWYgKCF0aGlzLmluY3JlbWVudGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBidW5kbGVyIG9mIHRoaXMuI2ZpbGVDb250ZXh0cy52YWx1ZXMoKSkge1xuICAgICAgYnVuZGxlci5pbnZhbGlkYXRlKGZpbGVzKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBidW5kbGVyIG9mIHRoaXMuI2lubGluZUNvbnRleHRzLnZhbHVlcygpKSB7XG4gICAgICBidW5kbGVyLmludmFsaWRhdGUoZmlsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGV4dHMgPSBbLi4udGhpcy4jZmlsZUNvbnRleHRzLnZhbHVlcygpLCAuLi50aGlzLiNpbmxpbmVDb250ZXh0cy52YWx1ZXMoKV07XG4gICAgdGhpcy4jZmlsZUNvbnRleHRzLmNsZWFyKCk7XG4gICAgdGhpcy4jaW5saW5lQ29udGV4dHMuY2xlYXIoKTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChjb250ZXh0cy5tYXAoKGNvbnRleHQpID0+IGNvbnRleHQuZGlzcG9zZSgpKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdFJlc3VsdChyZXN1bHQ6IEJ1bmRsZUNvbnRleHRSZXN1bHQsIHJlZmVyZW5jZWRGaWxlcz86IFNldDxzdHJpbmc+KSB7XG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKG91dHB1dEZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSkge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5leHBlY3RlZCBub24gQ1NTL01lZGlhIGZpbGUgXCIke2ZpbGVuYW1lfVwiIG91dHB1dHRlZCBkdXJpbmcgY29tcG9uZW50IHN0eWxlc2hlZXQgcHJvY2Vzc2luZy5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBtZXRhZmlsZTtcbiAgaWYgKCFyZXN1bHQuZXJyb3JzKSB7XG4gICAgbWV0YWZpbGUgPSByZXN1bHQubWV0YWZpbGU7XG4gICAgLy8gUmVtb3ZlIGVudHJ5UG9pbnQgZmllbGRzIGZyb20gb3V0cHV0cyB0byBwcmV2ZW50IHRoZSBpbnRlcm5hbCBjb21wb25lbnQgc3R5bGVzIGZyb20gYmVpbmdcbiAgICAvLyB0cmVhdGVkIGFzIGluaXRpYWwgZmlsZXMuIEFsc28gbWFyayB0aGUgZW50cnkgYXMgYSBjb21wb25lbnQgcmVzb3VyY2UgZm9yIHN0YXQgcmVwb3J0aW5nLlxuICAgIE9iamVjdC52YWx1ZXMobWV0YWZpbGUub3V0cHV0cykuZm9yRWFjaCgob3V0cHV0KSA9PiB7XG4gICAgICBkZWxldGUgb3V0cHV0LmVudHJ5UG9pbnQ7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gICAgbWV0YWZpbGUsXG4gICAgcmVmZXJlbmNlZEZpbGVzLFxuICB9O1xufVxuIl19