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
exports.I18nInliner = void 0;
const piscina_1 = __importDefault(require("piscina"));
const bundler_context_1 = require("./bundler-context");
const utils_1 = require("./utils");
/**
 * A keyword used to indicate if a JavaScript file may require inlining of translations.
 * This keyword is used to avoid processing files that would not otherwise need i18n processing.
 */
const LOCALIZE_KEYWORD = '$localize';
/**
 * A class that performs i18n translation inlining of JavaScript code.
 * A worker pool is used to distribute the transformation actions and allow
 * parallel processing. Inlining is only performed on code that contains the
 * localize function (`$localize`).
 */
class I18nInliner {
    #workerPool;
    #localizeFiles;
    #unmodifiedFiles;
    #fileToType = new Map();
    constructor(options, maxThreads) {
        this.#unmodifiedFiles = [];
        const files = new Map();
        const pendingMaps = [];
        for (const file of options.outputFiles) {
            if (file.type === bundler_context_1.BuildOutputFileType.Root) {
                // Skip stats and similar files.
                continue;
            }
            this.#fileToType.set(file.path, file.type);
            if (file.path.endsWith('.js') || file.path.endsWith('.mjs')) {
                // Check if localizations are present
                const contentBuffer = Buffer.isBuffer(file.contents)
                    ? file.contents
                    : Buffer.from(file.contents.buffer, file.contents.byteOffset, file.contents.byteLength);
                const hasLocalize = contentBuffer.includes(LOCALIZE_KEYWORD);
                if (hasLocalize) {
                    // A Blob is an immutable data structure that allows sharing the data between workers
                    // without copying until the data is actually used within a Worker. This is useful here
                    // since each file may not actually be processed in each Worker and the Blob avoids
                    // unneeded repeat copying of potentially large JavaScript files.
                    files.set(file.path, new Blob([file.contents]));
                    continue;
                }
            }
            else if (file.path.endsWith('.js.map')) {
                // The related JS file may not have been checked yet. To ensure that map files are not
                // missed, store any pending map files and check them after all output files.
                pendingMaps.push(file);
                continue;
            }
            this.#unmodifiedFiles.push(file);
        }
        // Check if any pending map files should be processed by checking if the parent JS file is present
        for (const file of pendingMaps) {
            if (files.has(file.path.slice(0, -4))) {
                files.set(file.path, new Blob([file.contents]));
            }
            else {
                this.#unmodifiedFiles.push(file);
            }
        }
        this.#localizeFiles = files;
        this.#workerPool = new piscina_1.default({
            filename: require.resolve('./i18n-inliner-worker'),
            maxThreads,
            // Extract options to ensure only the named options are serialized and sent to the worker
            workerData: {
                missingTranslation: options.missingTranslation,
                shouldOptimize: options.shouldOptimize,
                files,
            },
        });
    }
    /**
     * Performs inlining of translations for the provided locale and translations. The files that
     * are processed originate from the files passed to the class constructor and filter by presence
     * of the localize function keyword.
     * @param locale The string representing the locale to inline.
     * @param translation The translation messages to use when inlining.
     * @returns A promise that resolves to an array of OutputFiles representing a translated result.
     */
    async inlineForLocale(locale, translation) {
        // Request inlining for each file that contains localize calls
        const requests = [];
        for (const filename of this.#localizeFiles.keys()) {
            if (filename.endsWith('.map')) {
                continue;
            }
            const fileRequest = this.#workerPool.run({
                filename,
                locale,
                translation,
            });
            requests.push(fileRequest);
        }
        // Wait for all file requests to complete
        const rawResults = await Promise.all(requests);
        // Convert raw results to output file objects and include all unmodified files
        return [
            ...rawResults.flat().map(({ file, contents }) => 
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (0, utils_1.createOutputFileFromText)(file, contents, this.#fileToType.get(file))),
            ...this.#unmodifiedFiles.map((file) => file.clone()),
        ];
    }
    /**
     * Stops all active transformation tasks and shuts down all workers.
     * @returns A void promise that resolves when closing is complete.
     */
    close() {
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        this.#workerPool.options.minThreads = 0;
        return this.#workerPool.destroy();
    }
}
exports.I18nInliner = I18nInliner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1pbmxpbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9pMThuLWlubGluZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0RBQThCO0FBQzlCLHVEQUF5RTtBQUN6RSxtQ0FBbUQ7QUFFbkQ7OztHQUdHO0FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxXQUFXLENBQUM7QUFXckM7Ozs7O0dBS0c7QUFDSCxNQUFhLFdBQVc7SUFDdEIsV0FBVyxDQUFVO0lBQ1osY0FBYyxDQUE0QjtJQUMxQyxnQkFBZ0IsQ0FBeUI7SUFDekMsV0FBVyxHQUFHLElBQUksR0FBRyxFQUErQixDQUFDO0lBRTlELFlBQVksT0FBMkIsRUFBRSxVQUFtQjtRQUMxRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1FBRTNCLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO1FBQ3RDLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUN2QixLQUFLLE1BQU0sSUFBSSxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUU7WUFDdEMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLHFDQUFtQixDQUFDLElBQUksRUFBRTtnQkFDMUMsZ0NBQWdDO2dCQUNoQyxTQUFTO2FBQ1Y7WUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUzQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUMzRCxxQ0FBcUM7Z0JBQ3JDLE1BQU0sYUFBYSxHQUFHLE1B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LEVBQUUsRUFBRTtZQUM5QyxvRUFBb0U7WUFDcEUsSUFBQSxnQ0FBd0IsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDLENBQ3RFO1lBQ0QsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDckQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLO1FBQ0gsb0dBQW9HO1FBQ3BHLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFFeEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQXRIRCxrQ0FzSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQgfSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBBIGtleXdvcmQgdXNlZCB0byBpbmRpY2F0ZSBpZiBhIEphdmFTY3JpcHQgZmlsZSBtYXkgcmVxdWlyZSBpbmxpbmluZyBvZiB0cmFuc2xhdGlvbnMuXG4gKiBUaGlzIGtleXdvcmQgaXMgdXNlZCB0byBhdm9pZCBwcm9jZXNzaW5nIGZpbGVzIHRoYXQgd291bGQgbm90IG90aGVyd2lzZSBuZWVkIGkxOG4gcHJvY2Vzc2luZy5cbiAqL1xuY29uc3QgTE9DQUxJWkVfS0VZV09SRCA9ICckbG9jYWxpemUnO1xuXG4vKipcbiAqIElubGluaW5nIG9wdGlvbnMgdGhhdCBzaG91bGQgYXBwbHkgdG8gYWxsIHRyYW5zZm9ybWVkIGNvZGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bklubGluZXJPcHRpb25zIHtcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZSc7XG4gIG91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXTtcbiAgc2hvdWxkT3B0aW1pemU/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCBwZXJmb3JtcyBpMThuIHRyYW5zbGF0aW9uIGlubGluaW5nIG9mIEphdmFTY3JpcHQgY29kZS5cbiAqIEEgd29ya2VyIHBvb2wgaXMgdXNlZCB0byBkaXN0cmlidXRlIHRoZSB0cmFuc2Zvcm1hdGlvbiBhY3Rpb25zIGFuZCBhbGxvd1xuICogcGFyYWxsZWwgcHJvY2Vzc2luZy4gSW5saW5pbmcgaXMgb25seSBwZXJmb3JtZWQgb24gY29kZSB0aGF0IGNvbnRhaW5zIHRoZVxuICogbG9jYWxpemUgZnVuY3Rpb24gKGAkbG9jYWxpemVgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIEkxOG5JbmxpbmVyIHtcbiAgI3dvcmtlclBvb2w6IFBpc2NpbmE7XG4gIHJlYWRvbmx5ICNsb2NhbGl6ZUZpbGVzOiBSZWFkb25seU1hcDxzdHJpbmcsIEJsb2I+O1xuICByZWFkb25seSAjdW5tb2RpZmllZEZpbGVzOiBBcnJheTxCdWlsZE91dHB1dEZpbGU+O1xuICByZWFkb25seSAjZmlsZVRvVHlwZSA9IG5ldyBNYXA8c3RyaW5nLCBCdWlsZE91dHB1dEZpbGVUeXBlPigpO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEkxOG5JbmxpbmVyT3B0aW9ucywgbWF4VGhyZWFkcz86IG51bWJlcikge1xuICAgIHRoaXMuI3VubW9kaWZpZWRGaWxlcyA9IFtdO1xuXG4gICAgY29uc3QgZmlsZXMgPSBuZXcgTWFwPHN0cmluZywgQmxvYj4oKTtcbiAgICBjb25zdCBwZW5kaW5nTWFwcyA9IFtdO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBvcHRpb25zLm91dHB1dEZpbGVzKSB7XG4gICAgICBpZiAoZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLlJvb3QpIHtcbiAgICAgICAgLy8gU2tpcCBzdGF0cyBhbmQgc2ltaWxhciBmaWxlcy5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuI2ZpbGVUb1R5cGUuc2V0KGZpbGUucGF0aCwgZmlsZS50eXBlKTtcblxuICAgICAgaWYgKGZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJykgfHwgZmlsZS5wYXRoLmVuZHNXaXRoKCcubWpzJykpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgbG9jYWxpemF0aW9ucyBhcmUgcHJlc2VudFxuICAgICAgICBjb25zdCBjb250ZW50QnVmZmVyID0gQnVmZmVyLmlzQnVmZmVyKGZpbGUuY29udGVudHMpXG4gICAgICAgICAgPyBmaWxlLmNvbnRlbnRzXG4gICAgICAgICAgOiBCdWZmZXIuZnJvbShmaWxlLmNvbnRlbnRzLmJ1ZmZlciwgZmlsZS5jb250ZW50cy5ieXRlT2Zmc2V0LCBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpO1xuICAgICAgICBjb25zdCBoYXNMb2NhbGl6ZSA9IGNvbnRlbnRCdWZmZXIuaW5jbHVkZXMoTE9DQUxJWkVfS0VZV09SRCk7XG5cbiAgICAgICAgaWYgKGhhc0xvY2FsaXplKSB7XG4gICAgICAgICAgLy8gQSBCbG9iIGlzIGFuIGltbXV0YWJsZSBkYXRhIHN0cnVjdHVyZSB0aGF0IGFsbG93cyBzaGFyaW5nIHRoZSBkYXRhIGJldHdlZW4gd29ya2Vyc1xuICAgICAgICAgIC8vIHdpdGhvdXQgY29weWluZyB1bnRpbCB0aGUgZGF0YSBpcyBhY3R1YWxseSB1c2VkIHdpdGhpbiBhIFdvcmtlci4gVGhpcyBpcyB1c2VmdWwgaGVyZVxuICAgICAgICAgIC8vIHNpbmNlIGVhY2ggZmlsZSBtYXkgbm90IGFjdHVhbGx5IGJlIHByb2Nlc3NlZCBpbiBlYWNoIFdvcmtlciBhbmQgdGhlIEJsb2IgYXZvaWRzXG4gICAgICAgICAgLy8gdW5uZWVkZWQgcmVwZWF0IGNvcHlpbmcgb2YgcG90ZW50aWFsbHkgbGFyZ2UgSmF2YVNjcmlwdCBmaWxlcy5cbiAgICAgICAgICBmaWxlcy5zZXQoZmlsZS5wYXRoLCBuZXcgQmxvYihbZmlsZS5jb250ZW50c10pKTtcblxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGZpbGUucGF0aC5lbmRzV2l0aCgnLmpzLm1hcCcpKSB7XG4gICAgICAgIC8vIFRoZSByZWxhdGVkIEpTIGZpbGUgbWF5IG5vdCBoYXZlIGJlZW4gY2hlY2tlZCB5ZXQuIFRvIGVuc3VyZSB0aGF0IG1hcCBmaWxlcyBhcmUgbm90XG4gICAgICAgIC8vIG1pc3NlZCwgc3RvcmUgYW55IHBlbmRpbmcgbWFwIGZpbGVzIGFuZCBjaGVjayB0aGVtIGFmdGVyIGFsbCBvdXRwdXQgZmlsZXMuXG4gICAgICAgIHBlbmRpbmdNYXBzLnB1c2goZmlsZSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLiN1bm1vZGlmaWVkRmlsZXMucHVzaChmaWxlKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBhbnkgcGVuZGluZyBtYXAgZmlsZXMgc2hvdWxkIGJlIHByb2Nlc3NlZCBieSBjaGVja2luZyBpZiB0aGUgcGFyZW50IEpTIGZpbGUgaXMgcHJlc2VudFxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBwZW5kaW5nTWFwcykge1xuICAgICAgaWYgKGZpbGVzLmhhcyhmaWxlLnBhdGguc2xpY2UoMCwgLTQpKSkge1xuICAgICAgICBmaWxlcy5zZXQoZmlsZS5wYXRoLCBuZXcgQmxvYihbZmlsZS5jb250ZW50c10pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuI3VubW9kaWZpZWRGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuI2xvY2FsaXplRmlsZXMgPSBmaWxlcztcblxuICAgIHRoaXMuI3dvcmtlclBvb2wgPSBuZXcgUGlzY2luYSh7XG4gICAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL2kxOG4taW5saW5lci13b3JrZXInKSxcbiAgICAgIG1heFRocmVhZHMsXG4gICAgICAvLyBFeHRyYWN0IG9wdGlvbnMgdG8gZW5zdXJlIG9ubHkgdGhlIG5hbWVkIG9wdGlvbnMgYXJlIHNlcmlhbGl6ZWQgYW5kIHNlbnQgdG8gdGhlIHdvcmtlclxuICAgICAgd29ya2VyRGF0YToge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG9wdGlvbnMubWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgICBzaG91bGRPcHRpbWl6ZTogb3B0aW9ucy5zaG91bGRPcHRpbWl6ZSxcbiAgICAgICAgZmlsZXMsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGlubGluaW5nIG9mIHRyYW5zbGF0aW9ucyBmb3IgdGhlIHByb3ZpZGVkIGxvY2FsZSBhbmQgdHJhbnNsYXRpb25zLiBUaGUgZmlsZXMgdGhhdFxuICAgKiBhcmUgcHJvY2Vzc2VkIG9yaWdpbmF0ZSBmcm9tIHRoZSBmaWxlcyBwYXNzZWQgdG8gdGhlIGNsYXNzIGNvbnN0cnVjdG9yIGFuZCBmaWx0ZXIgYnkgcHJlc2VuY2VcbiAgICogb2YgdGhlIGxvY2FsaXplIGZ1bmN0aW9uIGtleXdvcmQuXG4gICAqIEBwYXJhbSBsb2NhbGUgVGhlIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGxvY2FsZSB0byBpbmxpbmUuXG4gICAqIEBwYXJhbSB0cmFuc2xhdGlvbiBUaGUgdHJhbnNsYXRpb24gbWVzc2FnZXMgdG8gdXNlIHdoZW4gaW5saW5pbmcuXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIE91dHB1dEZpbGVzIHJlcHJlc2VudGluZyBhIHRyYW5zbGF0ZWQgcmVzdWx0LlxuICAgKi9cbiAgYXN5bmMgaW5saW5lRm9yTG9jYWxlKFxuICAgIGxvY2FsZTogc3RyaW5nLFxuICAgIHRyYW5zbGF0aW9uOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZCxcbiAgKTogUHJvbWlzZTxCdWlsZE91dHB1dEZpbGVbXT4ge1xuICAgIC8vIFJlcXVlc3QgaW5saW5pbmcgZm9yIGVhY2ggZmlsZSB0aGF0IGNvbnRhaW5zIGxvY2FsaXplIGNhbGxzXG4gICAgY29uc3QgcmVxdWVzdHMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGZpbGVuYW1lIG9mIHRoaXMuI2xvY2FsaXplRmlsZXMua2V5cygpKSB7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZVJlcXVlc3QgPSB0aGlzLiN3b3JrZXJQb29sLnJ1bih7XG4gICAgICAgIGZpbGVuYW1lLFxuICAgICAgICBsb2NhbGUsXG4gICAgICAgIHRyYW5zbGF0aW9uLFxuICAgICAgfSk7XG4gICAgICByZXF1ZXN0cy5wdXNoKGZpbGVSZXF1ZXN0KTtcbiAgICB9XG5cbiAgICAvLyBXYWl0IGZvciBhbGwgZmlsZSByZXF1ZXN0cyB0byBjb21wbGV0ZVxuICAgIGNvbnN0IHJhd1Jlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChyZXF1ZXN0cyk7XG5cbiAgICAvLyBDb252ZXJ0IHJhdyByZXN1bHRzIHRvIG91dHB1dCBmaWxlIG9iamVjdHMgYW5kIGluY2x1ZGUgYWxsIHVubW9kaWZpZWQgZmlsZXNcbiAgICByZXR1cm4gW1xuICAgICAgLi4ucmF3UmVzdWx0cy5mbGF0KCkubWFwKCh7IGZpbGUsIGNvbnRlbnRzIH0pID0+XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChmaWxlLCBjb250ZW50cywgdGhpcy4jZmlsZVRvVHlwZS5nZXQoZmlsZSkhKSxcbiAgICAgICksXG4gICAgICAuLi50aGlzLiN1bm1vZGlmaWVkRmlsZXMubWFwKChmaWxlKSA9PiBmaWxlLmNsb25lKCkpLFxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICogU3RvcHMgYWxsIGFjdGl2ZSB0cmFuc2Zvcm1hdGlvbiB0YXNrcyBhbmQgc2h1dHMgZG93biBhbGwgd29ya2Vycy5cbiAgICogQHJldHVybnMgQSB2b2lkIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGNsb3NpbmcgaXMgY29tcGxldGUuXG4gICAqL1xuICBjbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBXb3JrYXJvdW5kIHBpc2NpbmEgYnVnIHdoZXJlIGEgd29ya2VyIHRocmVhZCB3aWxsIGJlIHJlY3JlYXRlZCBhZnRlciBkZXN0cm95IHRvIG1lZXQgdGhlIG1pbmltdW0uXG4gICAgdGhpcy4jd29ya2VyUG9vbC5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuXG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wuZGVzdHJveSgpO1xuICB9XG59XG4iXX0=