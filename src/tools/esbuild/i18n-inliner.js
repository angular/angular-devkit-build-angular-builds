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
    constructor(options, maxThreads) {
        this.#unmodifiedFiles = [];
        const files = new Map();
        const pendingMaps = [];
        for (const file of options.outputFiles) {
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
            ...rawResults.flat().map(({ file, contents }) => (0, utils_1.createOutputFileFromText)(file, contents)),
            ...this.#unmodifiedFiles.map((file) => (0, utils_1.cloneOutputFile)(file)),
        ];
    }
    /**
     * Stops all active transformation tasks and shuts down all workers.
     * @returns A void promise that resolves when closing is complete.
     */
    close() {
        return this.#workerPool.destroy();
    }
}
exports.I18nInliner = I18nInliner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1pbmxpbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9pMThuLWlubGluZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsc0RBQThCO0FBQzlCLG1DQUFvRTtBQUVwRTs7O0dBR0c7QUFDSCxNQUFNLGdCQUFnQixHQUFHLFdBQVcsQ0FBQztBQVdyQzs7Ozs7R0FLRztBQUNILE1BQWEsV0FBVztJQUN0QixXQUFXLENBQVU7SUFDWixjQUFjLENBQTRCO0lBQzFDLGdCQUFnQixDQUFvQjtJQUU3QyxZQUFZLE9BQTJCLEVBQUUsVUFBbUI7UUFDMUQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztRQUUzQixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBZ0IsQ0FBQztRQUN0QyxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7UUFDdkIsS0FBSyxNQUFNLElBQUksSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFO1lBQ3RDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQzNELHFDQUFxQztnQkFDckMsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO29CQUNsRCxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVE7b0JBQ2YsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDMUYsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUU3RCxJQUFJLFdBQVcsRUFBRTtvQkFDZixxRkFBcUY7b0JBQ3JGLHVGQUF1RjtvQkFDdkYsbUZBQW1GO29CQUNuRixpRUFBaUU7b0JBQ2pFLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBRWhELFNBQVM7aUJBQ1Y7YUFDRjtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUN4QyxzRkFBc0Y7Z0JBQ3RGLDZFQUE2RTtnQkFDN0UsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdkIsU0FBUzthQUNWO1lBRUQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNsQztRQUVELGtHQUFrRztRQUNsRyxLQUFLLE1BQU0sSUFBSSxJQUFJLFdBQVcsRUFBRTtZQUM5QixJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDckMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNqRDtpQkFBTTtnQkFDTCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xDO1NBQ0Y7UUFFRCxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztRQUU1QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksaUJBQU8sQ0FBQztZQUM3QixRQUFRLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQztZQUNsRCxVQUFVO1lBQ1YseUZBQXlGO1lBQ3pGLFVBQVUsRUFBRTtnQkFDVixrQkFBa0IsRUFBRSxPQUFPLENBQUMsa0JBQWtCO2dCQUM5QyxjQUFjLEVBQUUsT0FBTyxDQUFDLGNBQWM7Z0JBQ3RDLEtBQUs7YUFDTjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsS0FBSyxDQUFDLGVBQWUsQ0FDbkIsTUFBYyxFQUNkLFdBQWdEO1FBRWhELDhEQUE4RDtRQUM5RCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFDcEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ2pELElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDN0IsU0FBUzthQUNWO1lBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUM7Z0JBQ3ZDLFFBQVE7Z0JBQ1IsTUFBTTtnQkFDTixXQUFXO2FBQ1osQ0FBQyxDQUFDO1lBQ0gsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUM1QjtRQUVELHlDQUF5QztRQUN6QyxNQUFNLFVBQVUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFL0MsOEVBQThFO1FBQzlFLE9BQU87WUFDTCxHQUFHLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBQSxnQ0FBd0IsRUFBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDMUYsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFBLHVCQUFlLEVBQUMsSUFBSSxDQUFDLENBQUM7U0FDOUQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLO1FBQ0gsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQXhHRCxrQ0F3R0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB7IGNsb25lT3V0cHV0RmlsZSwgY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0IH0gZnJvbSAnLi91dGlscyc7XG5cbi8qKlxuICogQSBrZXl3b3JkIHVzZWQgdG8gaW5kaWNhdGUgaWYgYSBKYXZhU2NyaXB0IGZpbGUgbWF5IHJlcXVpcmUgaW5saW5pbmcgb2YgdHJhbnNsYXRpb25zLlxuICogVGhpcyBrZXl3b3JkIGlzIHVzZWQgdG8gYXZvaWQgcHJvY2Vzc2luZyBmaWxlcyB0aGF0IHdvdWxkIG5vdCBvdGhlcndpc2UgbmVlZCBpMThuIHByb2Nlc3NpbmcuXG4gKi9cbmNvbnN0IExPQ0FMSVpFX0tFWVdPUkQgPSAnJGxvY2FsaXplJztcblxuLyoqXG4gKiBJbmxpbmluZyBvcHRpb25zIHRoYXQgc2hvdWxkIGFwcGx5IHRvIGFsbCB0cmFuc2Zvcm1lZCBjb2RlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEkxOG5JbmxpbmVyT3B0aW9ucyB7XG4gIG1pc3NpbmdUcmFuc2xhdGlvbjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnO1xuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdO1xuICBzaG91bGRPcHRpbWl6ZT86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBjbGFzcyB0aGF0IHBlcmZvcm1zIGkxOG4gdHJhbnNsYXRpb24gaW5saW5pbmcgb2YgSmF2YVNjcmlwdCBjb2RlLlxuICogQSB3b3JrZXIgcG9vbCBpcyB1c2VkIHRvIGRpc3RyaWJ1dGUgdGhlIHRyYW5zZm9ybWF0aW9uIGFjdGlvbnMgYW5kIGFsbG93XG4gKiBwYXJhbGxlbCBwcm9jZXNzaW5nLiBJbmxpbmluZyBpcyBvbmx5IHBlcmZvcm1lZCBvbiBjb2RlIHRoYXQgY29udGFpbnMgdGhlXG4gKiBsb2NhbGl6ZSBmdW5jdGlvbiAoYCRsb2NhbGl6ZWApLlxuICovXG5leHBvcnQgY2xhc3MgSTE4bklubGluZXIge1xuICAjd29ya2VyUG9vbDogUGlzY2luYTtcbiAgcmVhZG9ubHkgI2xvY2FsaXplRmlsZXM6IFJlYWRvbmx5TWFwPHN0cmluZywgQmxvYj47XG4gIHJlYWRvbmx5ICN1bm1vZGlmaWVkRmlsZXM6IEFycmF5PE91dHB1dEZpbGU+O1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEkxOG5JbmxpbmVyT3B0aW9ucywgbWF4VGhyZWFkcz86IG51bWJlcikge1xuICAgIHRoaXMuI3VubW9kaWZpZWRGaWxlcyA9IFtdO1xuXG4gICAgY29uc3QgZmlsZXMgPSBuZXcgTWFwPHN0cmluZywgQmxvYj4oKTtcbiAgICBjb25zdCBwZW5kaW5nTWFwcyA9IFtdO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBvcHRpb25zLm91dHB1dEZpbGVzKSB7XG4gICAgICBpZiAoZmlsZS5wYXRoLmVuZHNXaXRoKCcuanMnKSB8fCBmaWxlLnBhdGguZW5kc1dpdGgoJy5tanMnKSkge1xuICAgICAgICAvLyBDaGVjayBpZiBsb2NhbGl6YXRpb25zIGFyZSBwcmVzZW50XG4gICAgICAgIGNvbnN0IGNvbnRlbnRCdWZmZXIgPSBCdWZmZXIuaXNCdWZmZXIoZmlsZS5jb250ZW50cylcbiAgICAgICAgICA/IGZpbGUuY29udGVudHNcbiAgICAgICAgICA6IEJ1ZmZlci5mcm9tKGZpbGUuY29udGVudHMuYnVmZmVyLCBmaWxlLmNvbnRlbnRzLmJ5dGVPZmZzZXQsIGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGhhc0xvY2FsaXplID0gY29udGVudEJ1ZmZlci5pbmNsdWRlcyhMT0NBTElaRV9LRVlXT1JEKTtcblxuICAgICAgICBpZiAoaGFzTG9jYWxpemUpIHtcbiAgICAgICAgICAvLyBBIEJsb2IgaXMgYW4gaW1tdXRhYmxlIGRhdGEgc3RydWN0dXJlIHRoYXQgYWxsb3dzIHNoYXJpbmcgdGhlIGRhdGEgYmV0d2VlbiB3b3JrZXJzXG4gICAgICAgICAgLy8gd2l0aG91dCBjb3B5aW5nIHVudGlsIHRoZSBkYXRhIGlzIGFjdHVhbGx5IHVzZWQgd2l0aGluIGEgV29ya2VyLiBUaGlzIGlzIHVzZWZ1bCBoZXJlXG4gICAgICAgICAgLy8gc2luY2UgZWFjaCBmaWxlIG1heSBub3QgYWN0dWFsbHkgYmUgcHJvY2Vzc2VkIGluIGVhY2ggV29ya2VyIGFuZCB0aGUgQmxvYiBhdm9pZHNcbiAgICAgICAgICAvLyB1bm5lZWRlZCByZXBlYXQgY29weWluZyBvZiBwb3RlbnRpYWxseSBsYXJnZSBKYXZhU2NyaXB0IGZpbGVzLlxuICAgICAgICAgIGZpbGVzLnNldChmaWxlLnBhdGgsIG5ldyBCbG9iKFtmaWxlLmNvbnRlbnRzXSkpO1xuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZmlsZS5wYXRoLmVuZHNXaXRoKCcuanMubWFwJykpIHtcbiAgICAgICAgLy8gVGhlIHJlbGF0ZWQgSlMgZmlsZSBtYXkgbm90IGhhdmUgYmVlbiBjaGVja2VkIHlldC4gVG8gZW5zdXJlIHRoYXQgbWFwIGZpbGVzIGFyZSBub3RcbiAgICAgICAgLy8gbWlzc2VkLCBzdG9yZSBhbnkgcGVuZGluZyBtYXAgZmlsZXMgYW5kIGNoZWNrIHRoZW0gYWZ0ZXIgYWxsIG91dHB1dCBmaWxlcy5cbiAgICAgICAgcGVuZGluZ01hcHMucHVzaChmaWxlKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuI3VubW9kaWZpZWRGaWxlcy5wdXNoKGZpbGUpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIGFueSBwZW5kaW5nIG1hcCBmaWxlcyBzaG91bGQgYmUgcHJvY2Vzc2VkIGJ5IGNoZWNraW5nIGlmIHRoZSBwYXJlbnQgSlMgZmlsZSBpcyBwcmVzZW50XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIHBlbmRpbmdNYXBzKSB7XG4gICAgICBpZiAoZmlsZXMuaGFzKGZpbGUucGF0aC5zbGljZSgwLCAtNCkpKSB7XG4gICAgICAgIGZpbGVzLnNldChmaWxlLnBhdGgsIG5ldyBCbG9iKFtmaWxlLmNvbnRlbnRzXSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy4jdW5tb2RpZmllZEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy4jbG9jYWxpemVGaWxlcyA9IGZpbGVzO1xuXG4gICAgdGhpcy4jd29ya2VyUG9vbCA9IG5ldyBQaXNjaW5hKHtcbiAgICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vaTE4bi1pbmxpbmVyLXdvcmtlcicpLFxuICAgICAgbWF4VGhyZWFkcyxcbiAgICAgIC8vIEV4dHJhY3Qgb3B0aW9ucyB0byBlbnN1cmUgb25seSB0aGUgbmFtZWQgb3B0aW9ucyBhcmUgc2VyaWFsaXplZCBhbmQgc2VudCB0byB0aGUgd29ya2VyXG4gICAgICB3b3JrZXJEYXRhOiB7XG4gICAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogb3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgIHNob3VsZE9wdGltaXplOiBvcHRpb25zLnNob3VsZE9wdGltaXplLFxuICAgICAgICBmaWxlcyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgaW5saW5pbmcgb2YgdHJhbnNsYXRpb25zIGZvciB0aGUgcHJvdmlkZWQgbG9jYWxlIGFuZCB0cmFuc2xhdGlvbnMuIFRoZSBmaWxlcyB0aGF0XG4gICAqIGFyZSBwcm9jZXNzZWQgb3JpZ2luYXRlIGZyb20gdGhlIGZpbGVzIHBhc3NlZCB0byB0aGUgY2xhc3MgY29uc3RydWN0b3IgYW5kIGZpbHRlciBieSBwcmVzZW5jZVxuICAgKiBvZiB0aGUgbG9jYWxpemUgZnVuY3Rpb24ga2V5d29yZC5cbiAgICogQHBhcmFtIGxvY2FsZSBUaGUgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgbG9jYWxlIHRvIGlubGluZS5cbiAgICogQHBhcmFtIHRyYW5zbGF0aW9uIFRoZSB0cmFuc2xhdGlvbiBtZXNzYWdlcyB0byB1c2Ugd2hlbiBpbmxpbmluZy5cbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgT3V0cHV0RmlsZXMgcmVwcmVzZW50aW5nIGEgdHJhbnNsYXRlZCByZXN1bHQuXG4gICAqL1xuICBhc3luYyBpbmxpbmVGb3JMb2NhbGUoXG4gICAgbG9jYWxlOiBzdHJpbmcsXG4gICAgdHJhbnNsYXRpb246IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkLFxuICApOiBQcm9taXNlPE91dHB1dEZpbGVbXT4ge1xuICAgIC8vIFJlcXVlc3QgaW5saW5pbmcgZm9yIGVhY2ggZmlsZSB0aGF0IGNvbnRhaW5zIGxvY2FsaXplIGNhbGxzXG4gICAgY29uc3QgcmVxdWVzdHMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGZpbGVuYW1lIG9mIHRoaXMuI2xvY2FsaXplRmlsZXMua2V5cygpKSB7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZVJlcXVlc3QgPSB0aGlzLiN3b3JrZXJQb29sLnJ1bih7XG4gICAgICAgIGZpbGVuYW1lLFxuICAgICAgICBsb2NhbGUsXG4gICAgICAgIHRyYW5zbGF0aW9uLFxuICAgICAgfSk7XG4gICAgICByZXF1ZXN0cy5wdXNoKGZpbGVSZXF1ZXN0KTtcbiAgICB9XG5cbiAgICAvLyBXYWl0IGZvciBhbGwgZmlsZSByZXF1ZXN0cyB0byBjb21wbGV0ZVxuICAgIGNvbnN0IHJhd1Jlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChyZXF1ZXN0cyk7XG5cbiAgICAvLyBDb252ZXJ0IHJhdyByZXN1bHRzIHRvIG91dHB1dCBmaWxlIG9iamVjdHMgYW5kIGluY2x1ZGUgYWxsIHVubW9kaWZpZWQgZmlsZXNcbiAgICByZXR1cm4gW1xuICAgICAgLi4ucmF3UmVzdWx0cy5mbGF0KCkubWFwKCh7IGZpbGUsIGNvbnRlbnRzIH0pID0+IGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChmaWxlLCBjb250ZW50cykpLFxuICAgICAgLi4udGhpcy4jdW5tb2RpZmllZEZpbGVzLm1hcCgoZmlsZSkgPT4gY2xvbmVPdXRwdXRGaWxlKGZpbGUpKSxcbiAgICBdO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3BzIGFsbCBhY3RpdmUgdHJhbnNmb3JtYXRpb24gdGFza3MgYW5kIHNodXRzIGRvd24gYWxsIHdvcmtlcnMuXG4gICAqIEByZXR1cm5zIEEgdm9pZCBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBjbG9zaW5nIGlzIGNvbXBsZXRlLlxuICAgKi9cbiAgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wuZGVzdHJveSgpO1xuICB9XG59XG4iXX0=