"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_worker_threads_1 = require("node:worker_threads");
/**
 * The fully resolved path to the zone.js package that will be loaded during worker initialization.
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { zonePackage } = node_worker_threads_1.workerData;
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function render({ indexFile, deployUrl, minifyCss, outputPath, serverBundlePath, route, inlineCriticalCss, }) {
    const result = {};
    const browserIndexOutputPath = path.join(outputPath, indexFile);
    const outputFolderPath = path.join(outputPath, route);
    const outputIndexPath = path.join(outputFolderPath, 'index.html');
    const { ɵSERVER_CONTEXT, AppServerModule, renderModule, renderApplication, default: bootstrapAppFn, } = (await Promise.resolve(`${serverBundlePath}`).then(s => __importStar(require(s))));
    (0, node_assert_1.default)(ɵSERVER_CONTEXT, `ɵSERVER_CONTEXT was not exported from: ${serverBundlePath}.`);
    const indexBaseName = fs.existsSync(path.join(outputPath, 'index.original.html'))
        ? 'index.original.html'
        : indexFile;
    const browserIndexInputPath = path.join(outputPath, indexBaseName);
    const document = await fs.promises.readFile(browserIndexInputPath, 'utf8');
    const platformProviders = [
        {
            provide: ɵSERVER_CONTEXT,
            useValue: 'ssg',
        },
    ];
    let html;
    // Render platform server module
    if (isBootstrapFn(bootstrapAppFn)) {
        (0, node_assert_1.default)(renderApplication, `renderApplication was not exported from: ${serverBundlePath}.`);
        html = await renderApplication(bootstrapAppFn, {
            document,
            url: route,
            platformProviders,
        });
    }
    else {
        (0, node_assert_1.default)(renderModule, `renderModule was not exported from: ${serverBundlePath}.`);
        const moduleClass = bootstrapAppFn || AppServerModule;
        (0, node_assert_1.default)(moduleClass, `Neither an AppServerModule nor a bootstrapping function was exported from: ${serverBundlePath}.`);
        html = await renderModule(moduleClass, {
            document,
            url: route,
            extraProviders: platformProviders,
        });
    }
    if (inlineCriticalCss) {
        const { InlineCriticalCssProcessor } = await Promise.resolve().then(() => __importStar(require('../../utils/index-file/inline-critical-css')));
        const inlineCriticalCssProcessor = new InlineCriticalCssProcessor({
            deployUrl: deployUrl,
            minify: minifyCss,
        });
        const { content, warnings, errors } = await inlineCriticalCssProcessor.process(html, {
            outputPath,
        });
        result.errors = errors;
        result.warnings = warnings;
        html = content;
    }
    // This case happens when we are prerendering "/".
    if (browserIndexOutputPath === outputIndexPath) {
        const browserIndexOutputPathOriginal = path.join(outputPath, 'index.original.html');
        fs.renameSync(browserIndexOutputPath, browserIndexOutputPathOriginal);
    }
    fs.mkdirSync(outputFolderPath, { recursive: true });
    fs.writeFileSync(outputIndexPath, html);
    return result;
}
function isBootstrapFn(value) {
    // We can differentiate between a module and a bootstrap function by reading compiler-generated `ɵmod` static property:
    return typeof value === 'function' && !('ɵmod' in value);
}
/**
 * Initializes the worker when it is first created by loading the Zone.js package
 * into the worker instance.
 *
 * @returns A promise resolving to the render function of the worker.
 */
async function initialize() {
    // Setup Zone.js
    await Promise.resolve(`${zonePackage}`).then(s => __importStar(require(s)));
    // Return the render function for use
    return render;
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL3ByZXJlbmRlci9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw4REFBaUM7QUFDakMsNENBQThCO0FBQzlCLGdEQUFrQztBQUNsQyw2REFBaUQ7QUFrQ2pEOzs7R0FHRztBQUNILE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxnQ0FFdkIsQ0FBQztBQUVGOztHQUVHO0FBQ0gsS0FBSyxVQUFVLE1BQU0sQ0FBQyxFQUNwQixTQUFTLEVBQ1QsU0FBUyxFQUNULFNBQVMsRUFDVCxVQUFVLEVBQ1YsZ0JBQWdCLEVBQ2hCLEtBQUssRUFDTCxpQkFBaUIsR0FDSDtJQUNkLE1BQU0sTUFBTSxHQUFHLEVBQWtCLENBQUM7SUFDbEMsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNoRSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3RELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFFbEUsTUFBTSxFQUNKLGVBQWUsRUFDZixlQUFlLEVBQ2YsWUFBWSxFQUNaLGlCQUFpQixFQUNqQixPQUFPLEVBQUUsY0FBYyxHQUN4QixHQUFHLENBQUMseUJBQWEsZ0JBQWdCLHVDQUFDLENBQXdCLENBQUM7SUFFNUQsSUFBQSxxQkFBTSxFQUFDLGVBQWUsRUFBRSwwQ0FBMEMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBRXZGLE1BQU0sYUFBYSxHQUFH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cUNBQXFDO0lBQ3JDLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxrQkFBZSxVQUFVLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEFwcGxpY2F0aW9uUmVmLCBTdGF0aWNQcm92aWRlciwgVHlwZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHR5cGUgeyByZW5kZXJBcHBsaWNhdGlvbiwgcmVuZGVyTW9kdWxlLCDJtVNFUlZFUl9DT05URVhUIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyB3b3JrZXJEYXRhIH0gZnJvbSAnbm9kZTp3b3JrZXJfdGhyZWFkcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyT3B0aW9ucyB7XG4gIGluZGV4RmlsZTogc3RyaW5nO1xuICBkZXBsb3lVcmw6IHN0cmluZztcbiAgaW5saW5lQ3JpdGljYWxDc3M6IGJvb2xlYW47XG4gIG1pbmlmeUNzczogYm9vbGVhbjtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBzZXJ2ZXJCdW5kbGVQYXRoOiBzdHJpbmc7XG4gIHJvdXRlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyUmVzdWx0IHtcbiAgZXJyb3JzPzogc3RyaW5nW107XG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBTZXJ2ZXJCdW5kbGVFeHBvcnRzIHtcbiAgLyoqIEFuIGludGVybmFsIHRva2VuIHRoYXQgYWxsb3dzIHByb3ZpZGluZyBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgc2VydmVyIGNvbnRleHQuICovXG4gIMm1U0VSVkVSX0NPTlRFWFQ/OiB0eXBlb2YgybVTRVJWRVJfQ09OVEVYVDtcblxuICAvKiogUmVuZGVyIGFuIE5nTW9kdWxlIGFwcGxpY2F0aW9uLiAqL1xuICByZW5kZXJNb2R1bGU/OiB0eXBlb2YgcmVuZGVyTW9kdWxlO1xuXG4gIC8qKiBOZ01vZHVsZSB0byByZW5kZXIuICovXG4gIEFwcFNlcnZlck1vZHVsZT86IFR5cGU8dW5rbm93bj47XG5cbiAgLyoqIE1ldGhvZCB0byByZW5kZXIgYSBzdGFuZGFsb25lIGFwcGxpY2F0aW9uLiAqL1xuICByZW5kZXJBcHBsaWNhdGlvbj86IHR5cGVvZiByZW5kZXJBcHBsaWNhdGlvbjtcblxuICAvKiogU3RhbmRhbG9uZSBhcHBsaWNhdGlvbiBib290c3RyYXBwaW5nIGZ1bmN0aW9uLiAqL1xuICBkZWZhdWx0PzogKCgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+KSB8IFR5cGU8dW5rbm93bj47XG59XG5cbi8qKlxuICogVGhlIGZ1bGx5IHJlc29sdmVkIHBhdGggdG8gdGhlIHpvbmUuanMgcGFja2FnZSB0aGF0IHdpbGwgYmUgbG9hZGVkIGR1cmluZyB3b3JrZXIgaW5pdGlhbGl6YXRpb24uXG4gKiBUaGlzIGlzIHBhc3NlZCBhcyB3b3JrZXJEYXRhIHdoZW4gc2V0dGluZyB1cCB0aGUgd29ya2VyIHZpYSB0aGUgYHBpc2NpbmFgIHBhY2thZ2UuXG4gKi9cbmNvbnN0IHsgem9uZVBhY2thZ2UgfSA9IHdvcmtlckRhdGEgYXMge1xuICB6b25lUGFja2FnZTogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIGVhY2ggcm91dGUgaW4gcm91dGVzIGFuZCB3cml0ZXMgdGhlbSB0byA8b3V0cHV0UGF0aD4vPHJvdXRlPi9pbmRleC5odG1sLlxuICovXG5hc3luYyBmdW5jdGlvbiByZW5kZXIoe1xuICBpbmRleEZpbGUsXG4gIGRlcGxveVVybCxcbiAgbWluaWZ5Q3NzLFxuICBvdXRwdXRQYXRoLFxuICBzZXJ2ZXJCdW5kbGVQYXRoLFxuICByb3V0ZSxcbiAgaW5saW5lQ3JpdGljYWxDc3MsXG59OiBSZW5kZXJPcHRpb25zKTogUHJvbWlzZTxSZW5kZXJSZXN1bHQ+IHtcbiAgY29uc3QgcmVzdWx0ID0ge30gYXMgUmVuZGVyUmVzdWx0O1xuICBjb25zdCBicm93c2VySW5kZXhPdXRwdXRQYXRoID0gcGF0aC5qb2luKG91dHB1dFBhdGgsIGluZGV4RmlsZSk7XG4gIGNvbnN0IG91dHB1dEZvbGRlclBhdGggPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgcm91dGUpO1xuICBjb25zdCBvdXRwdXRJbmRleFBhdGggPSBwYXRoLmpvaW4ob3V0cHV0Rm9sZGVyUGF0aCwgJ2luZGV4Lmh0bWwnKTtcblxuICBjb25zdCB7XG4gICAgybVTRVJWRVJfQ09OVEVYVCxcbiAgICBBcHBTZXJ2ZXJNb2R1bGUsXG4gICAgcmVuZGVyTW9kdWxlLFxuICAgIHJlbmRlckFwcGxpY2F0aW9uLFxuICAgIGRlZmF1bHQ6IGJvb3RzdHJhcEFwcEZuLFxuICB9ID0gKGF3YWl0IGltcG9ydChzZXJ2ZXJCdW5kbGVQYXRoKSkgYXMgU2VydmVyQnVuZGxlRXhwb3J0cztcblxuICBhc3NlcnQoybVTRVJWRVJfQ09OVEVYVCwgYMm1U0VSVkVSX0NPTlRFWFQgd2FzIG5vdCBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmApO1xuXG4gIGNvbnN0IGluZGV4QmFzZU5hbWUgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihvdXRwdXRQYXRoLCAnaW5kZXgub3JpZ2luYWwuaHRtbCcpKVxuICAgID8gJ2luZGV4Lm9yaWdpbmFsLmh0bWwnXG4gICAgOiBpbmRleEZpbGU7XG4gIGNvbnN0IGJyb3dzZXJJbmRleElucHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBpbmRleEJhc2VOYW1lKTtcbiAgY29uc3QgZG9jdW1lbnQgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShicm93c2VySW5kZXhJbnB1dFBhdGgsICd1dGY4Jyk7XG5cbiAgY29uc3QgcGxhdGZvcm1Qcm92aWRlcnM6IFN0YXRpY1Byb3ZpZGVyW10gPSBbXG4gICAge1xuICAgICAgcHJvdmlkZTogybVTRVJWRVJfQ09OVEVYVCxcbiAgICAgIHVzZVZhbHVlOiAnc3NnJyxcbiAgICB9LFxuICBdO1xuXG4gIGxldCBodG1sOiBzdHJpbmc7XG5cbiAgLy8gUmVuZGVyIHBsYXRmb3JtIHNlcnZlciBtb2R1bGVcbiAgaWYgKGlzQm9vdHN0cmFwRm4oYm9vdHN0cmFwQXBwRm4pKSB7XG4gICAgYXNzZXJ0KHJlbmRlckFwcGxpY2F0aW9uLCBgcmVuZGVyQXBwbGljYXRpb24gd2FzIG5vdCBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmApO1xuXG4gICAgaHRtbCA9IGF3YWl0IHJlbmRlckFwcGxpY2F0aW9uKGJvb3RzdHJhcEFwcEZuLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBhc3NlcnQocmVuZGVyTW9kdWxlLCBgcmVuZGVyTW9kdWxlIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcblxuICAgIGNvbnN0IG1vZHVsZUNsYXNzID0gYm9vdHN0cmFwQXBwRm4gfHwgQXBwU2VydmVyTW9kdWxlO1xuICAgIGFzc2VydChcbiAgICAgIG1vZHVsZUNsYXNzLFxuICAgICAgYE5laXRoZXIgYW4gQXBwU2VydmVyTW9kdWxlIG5vciBhIGJvb3RzdHJhcHBpbmcgZnVuY3Rpb24gd2FzIGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCxcbiAgICApO1xuXG4gICAgaHRtbCA9IGF3YWl0IHJlbmRlck1vZHVsZShtb2R1bGVDbGFzcywge1xuICAgICAgZG9jdW1lbnQsXG4gICAgICB1cmw6IHJvdXRlLFxuICAgICAgZXh0cmFQcm92aWRlcnM6IHBsYXRmb3JtUHJvdmlkZXJzLFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKGlubGluZUNyaXRpY2FsQ3NzKSB7XG4gICAgY29uc3QgeyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcydcbiAgICApO1xuXG4gICAgY29uc3QgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgPSBuZXcgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ioe1xuICAgICAgZGVwbG95VXJsOiBkZXBsb3lVcmwsXG4gICAgICBtaW5pZnk6IG1pbmlmeUNzcyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7XG4gICAgICBvdXRwdXRQYXRoLFxuICAgIH0pO1xuICAgIHJlc3VsdC5lcnJvcnMgPSBlcnJvcnM7XG4gICAgcmVzdWx0Lndhcm5pbmdzID0gd2FybmluZ3M7XG4gICAgaHRtbCA9IGNvbnRlbnQ7XG4gIH1cblxuICAvLyBUaGlzIGNhc2UgaGFwcGVucyB3aGVuIHdlIGFyZSBwcmVyZW5kZXJpbmcgXCIvXCIuXG4gIGlmIChicm93c2VySW5kZXhPdXRwdXRQYXRoID09PSBvdXRwdXRJbmRleFBhdGgpIHtcbiAgICBjb25zdCBicm93c2VySW5kZXhPdXRwdXRQYXRoT3JpZ2luYWwgPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ2luZGV4Lm9yaWdpbmFsLmh0bWwnKTtcbiAgICBmcy5yZW5hbWVTeW5jKGJyb3dzZXJJbmRleE91dHB1dFBhdGgsIGJyb3dzZXJJbmRleE91dHB1dFBhdGhPcmlnaW5hbCk7XG4gIH1cblxuICBmcy5ta2RpclN5bmMob3V0cHV0Rm9sZGVyUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0SW5kZXhQYXRoLCBodG1sKTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpc0Jvb3RzdHJhcEZuKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4ge1xuICAvLyBXZSBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgbW9kdWxlIGFuZCBhIGJvb3RzdHJhcCBmdW5jdGlvbiBieSByZWFkaW5nIGNvbXBpbGVyLWdlbmVyYXRlZCBgybVtb2RgIHN0YXRpYyBwcm9wZXJ0eTpcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhKCfJtW1vZCcgaW4gdmFsdWUpO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB3b3JrZXIgd2hlbiBpdCBpcyBmaXJzdCBjcmVhdGVkIGJ5IGxvYWRpbmcgdGhlIFpvbmUuanMgcGFja2FnZVxuICogaW50byB0aGUgd29ya2VyIGluc3RhbmNlLlxuICpcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIHJlbmRlciBmdW5jdGlvbiBvZiB0aGUgd29ya2VyLlxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuICAvLyBTZXR1cCBab25lLmpzXG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgLy8gUmV0dXJuIHRoZSByZW5kZXIgZnVuY3Rpb24gZm9yIHVzZVxuICByZXR1cm4gcmVuZGVyO1xufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGV4cG9ydCB3aWxsIGJlIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpbml0aWFsaXplIGZ1bmN0aW9uLlxuICogVGhpcyBpcyBhd2FpdGVkIGJ5IHBpc2NpbmEgcHJpb3IgdG8gdXNpbmcgdGhlIFdvcmtlci5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgaW5pdGlhbGl6ZSgpO1xuIl19