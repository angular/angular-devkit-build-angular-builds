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
        const normalizedFiles = [...files].map(node_path_1.default.normalize);
        for (const bundler of this.#fileContexts.values()) {
            bundler.invalidate(normalizedFiles);
        }
        for (const bundler of this.#inlineContexts.values()) {
            bundler.invalidate(normalizedFiles);
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
