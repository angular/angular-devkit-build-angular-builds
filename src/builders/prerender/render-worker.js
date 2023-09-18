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
const inline_critical_css_1 = require("../../utils/index-file/inline-critical-css");
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
        const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL3ByZXJlbmRlci9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw4REFBaUM7QUFDakMsNENBQThCO0FBQzlCLGdEQUFrQztBQUNsQyw2REFBaUQ7QUFDakQsb0ZBQXdGO0FBa0N4Rjs7O0dBR0c7QUFDSCxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsZ0NBRXZCLENBQUM7QUFFRjs7R0FFRztBQUNILEtBQUssVUFBVSxNQUFNLENBQUMsRUFDcEIsU0FBUyxFQUNULFNBQVMsRUFDVCxTQUFTLEVBQ1QsVUFBVSxFQUNWLGdCQUFnQixFQUNoQixLQUFLLEVBQ0wsaUJBQWlCLEdBQ0g7SUFDZCxNQUFNLE1BQU0sR0FBRyxFQUFrQixDQUFDO0lBQ2xDLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDaEUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN0RCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxDQUFDO0lBRWxFLE1BQU0sRUFDSixlQUFlLEVBQ2YsZUFBZSxFQUNmLFlBQVksRUFDWixpQkFBaUIsRUFDakIsT0FBTyxFQUFFLGNBQWMsR0FDeEIsR0FBRyxDQUFDLHlCQUFhLGdCQUFnQix1Q0FBQyxDQUF3QixDQUFDO0lBRTVELElBQUEscUJBQU0sRUFBQyxlQUFlLEVBQUUsMENBQTBDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUV2RixN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OztHQUdHO0FBQ0gsa0JBQWUsVUFBVSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvblJlZiwgU3RhdGljUHJvdmlkZXIsIFR5cGUgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB0eXBlIHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlck9wdGlvbnMge1xuICBpbmRleEZpbGU6IHN0cmluZztcbiAgZGVwbG95VXJsOiBzdHJpbmc7XG4gIGlubGluZUNyaXRpY2FsQ3NzOiBib29sZWFuO1xuICBtaW5pZnlDc3M6IGJvb2xlYW47XG4gIG91dHB1dFBhdGg6IHN0cmluZztcbiAgc2VydmVyQnVuZGxlUGF0aDogc3RyaW5nO1xuICByb3V0ZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlclJlc3VsdCB7XG4gIGVycm9ycz86IHN0cmluZ1tdO1xuICB3YXJuaW5ncz86IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgU2VydmVyQnVuZGxlRXhwb3J0cyB7XG4gIC8qKiBBbiBpbnRlcm5hbCB0b2tlbiB0aGF0IGFsbG93cyBwcm92aWRpbmcgZXh0cmEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHNlcnZlciBjb250ZXh0LiAqL1xuICDJtVNFUlZFUl9DT05URVhUPzogdHlwZW9mIMm1U0VSVkVSX0NPTlRFWFQ7XG5cbiAgLyoqIFJlbmRlciBhbiBOZ01vZHVsZSBhcHBsaWNhdGlvbi4gKi9cbiAgcmVuZGVyTW9kdWxlPzogdHlwZW9mIHJlbmRlck1vZHVsZTtcblxuICAvKiogTmdNb2R1bGUgdG8gcmVuZGVyLiAqL1xuICBBcHBTZXJ2ZXJNb2R1bGU/OiBUeXBlPHVua25vd24+O1xuXG4gIC8qKiBNZXRob2QgdG8gcmVuZGVyIGEgc3RhbmRhbG9uZSBhcHBsaWNhdGlvbi4gKi9cbiAgcmVuZGVyQXBwbGljYXRpb24/OiB0eXBlb2YgcmVuZGVyQXBwbGljYXRpb247XG5cbiAgLyoqIFN0YW5kYWxvbmUgYXBwbGljYXRpb24gYm9vdHN0cmFwcGluZyBmdW5jdGlvbi4gKi9cbiAgZGVmYXVsdD86ICgoKSA9PiBQcm9taXNlPEFwcGxpY2F0aW9uUmVmPikgfCBUeXBlPHVua25vd24+O1xufVxuXG4vKipcbiAqIFRoZSBmdWxseSByZXNvbHZlZCBwYXRoIHRvIHRoZSB6b25lLmpzIHBhY2thZ2UgdGhhdCB3aWxsIGJlIGxvYWRlZCBkdXJpbmcgd29ya2VyIGluaXRpYWxpemF0aW9uLlxuICogVGhpcyBpcyBwYXNzZWQgYXMgd29ya2VyRGF0YSB3aGVuIHNldHRpbmcgdXAgdGhlIHdvcmtlciB2aWEgdGhlIGBwaXNjaW5hYCBwYWNrYWdlLlxuICovXG5jb25zdCB7IHpvbmVQYWNrYWdlIH0gPSB3b3JrZXJEYXRhIGFzIHtcbiAgem9uZVBhY2thZ2U6IHN0cmluZztcbn07XG5cbi8qKlxuICogUmVuZGVycyBlYWNoIHJvdXRlIGluIHJvdXRlcyBhbmQgd3JpdGVzIHRoZW0gdG8gPG91dHB1dFBhdGg+Lzxyb3V0ZT4vaW5kZXguaHRtbC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVuZGVyKHtcbiAgaW5kZXhGaWxlLFxuICBkZXBsb3lVcmwsXG4gIG1pbmlmeUNzcyxcbiAgb3V0cHV0UGF0aCxcbiAgc2VydmVyQnVuZGxlUGF0aCxcbiAgcm91dGUsXG4gIGlubGluZUNyaXRpY2FsQ3NzLFxufTogUmVuZGVyT3B0aW9ucyk6IFByb21pc2U8UmVuZGVyUmVzdWx0PiB7XG4gIGNvbnN0IHJlc3VsdCA9IHt9IGFzIFJlbmRlclJlc3VsdDtcbiAgY29uc3QgYnJvd3NlckluZGV4T3V0cHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBpbmRleEZpbGUpO1xuICBjb25zdCBvdXRwdXRGb2xkZXJQYXRoID0gcGF0aC5qb2luKG91dHB1dFBhdGgsIHJvdXRlKTtcbiAgY29uc3Qgb3V0cHV0SW5kZXhQYXRoID0gcGF0aC5qb2luKG91dHB1dEZvbGRlclBhdGgsICdpbmRleC5odG1sJyk7XG5cbiAgY29uc3Qge1xuICAgIMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgQXBwU2VydmVyTW9kdWxlLFxuICAgIHJlbmRlck1vZHVsZSxcbiAgICByZW5kZXJBcHBsaWNhdGlvbixcbiAgICBkZWZhdWx0OiBib290c3RyYXBBcHBGbixcbiAgfSA9IChhd2FpdCBpbXBvcnQoc2VydmVyQnVuZGxlUGF0aCkpIGFzIFNlcnZlckJ1bmRsZUV4cG9ydHM7XG5cbiAgYXNzZXJ0KMm1U0VSVkVSX0NPTlRFWFQsIGDJtVNFUlZFUl9DT05URVhUIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcblxuICBjb25zdCBpbmRleEJhc2VOYW1lID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ2luZGV4Lm9yaWdpbmFsLmh0bWwnKSlcbiAgICA/ICdpbmRleC5vcmlnaW5hbC5odG1sJ1xuICAgIDogaW5kZXhGaWxlO1xuICBjb25zdCBicm93c2VySW5kZXhJbnB1dFBhdGggPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgaW5kZXhCYXNlTmFtZSk7XG4gIGNvbnN0IGRvY3VtZW50ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUoYnJvd3NlckluZGV4SW5wdXRQYXRoLCAndXRmOCcpO1xuXG4gIGNvbnN0IHBsYXRmb3JtUHJvdmlkZXJzOiBTdGF0aWNQcm92aWRlcltdID0gW1xuICAgIHtcbiAgICAgIHByb3ZpZGU6IMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgICB1c2VWYWx1ZTogJ3NzZycsXG4gICAgfSxcbiAgXTtcblxuICBsZXQgaHRtbDogc3RyaW5nO1xuXG4gIC8vIFJlbmRlciBwbGF0Zm9ybSBzZXJ2ZXIgbW9kdWxlXG4gIGlmIChpc0Jvb3RzdHJhcEZuKGJvb3RzdHJhcEFwcEZuKSkge1xuICAgIGFzc2VydChyZW5kZXJBcHBsaWNhdGlvbiwgYHJlbmRlckFwcGxpY2F0aW9uIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcblxuICAgIGh0bWwgPSBhd2FpdCByZW5kZXJBcHBsaWNhdGlvbihib290c3RyYXBBcHBGbiwge1xuICAgICAgZG9jdW1lbnQsXG4gICAgICB1cmw6IHJvdXRlLFxuICAgICAgcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgYXNzZXJ0KHJlbmRlck1vZHVsZSwgYHJlbmRlck1vZHVsZSB3YXMgbm90IGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCk7XG5cbiAgICBjb25zdCBtb2R1bGVDbGFzcyA9IGJvb3RzdHJhcEFwcEZuIHx8IEFwcFNlcnZlck1vZHVsZTtcbiAgICBhc3NlcnQoXG4gICAgICBtb2R1bGVDbGFzcyxcbiAgICAgIGBOZWl0aGVyIGFuIEFwcFNlcnZlck1vZHVsZSBub3IgYSBib290c3RyYXBwaW5nIGZ1bmN0aW9uIHdhcyBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmAsXG4gICAgKTtcblxuICAgIGh0bWwgPSBhd2FpdCByZW5kZXJNb2R1bGUobW9kdWxlQ2xhc3MsIHtcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdXJsOiByb3V0ZSxcbiAgICAgIGV4dHJhUHJvdmlkZXJzOiBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChpbmxpbmVDcml0aWNhbENzcykge1xuICAgIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICAgIGRlcGxveVVybDogZGVwbG95VXJsLFxuICAgICAgbWluaWZ5OiBtaW5pZnlDc3MsXG4gICAgfSk7XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoaHRtbCwge1xuICAgICAgb3V0cHV0UGF0aCxcbiAgICB9KTtcbiAgICByZXN1bHQuZXJyb3JzID0gZXJyb3JzO1xuICAgIHJlc3VsdC53YXJuaW5ncyA9IHdhcm5pbmdzO1xuICAgIGh0bWwgPSBjb250ZW50O1xuICB9XG5cbiAgLy8gVGhpcyBjYXNlIGhhcHBlbnMgd2hlbiB3ZSBhcmUgcHJlcmVuZGVyaW5nIFwiL1wiLlxuICBpZiAoYnJvd3NlckluZGV4T3V0cHV0UGF0aCA9PT0gb3V0cHV0SW5kZXhQYXRoKSB7XG4gICAgY29uc3QgYnJvd3NlckluZGV4T3V0cHV0UGF0aE9yaWdpbmFsID0gcGF0aC5qb2luKG91dHB1dFBhdGgsICdpbmRleC5vcmlnaW5hbC5odG1sJyk7XG4gICAgZnMucmVuYW1lU3luYyhicm93c2VySW5kZXhPdXRwdXRQYXRoLCBicm93c2VySW5kZXhPdXRwdXRQYXRoT3JpZ2luYWwpO1xuICB9XG5cbiAgZnMubWtkaXJTeW5jKG91dHB1dEZvbGRlclBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dEluZGV4UGF0aCwgaHRtbCk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaXNCb290c3RyYXBGbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzICgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+IHtcbiAgLy8gV2UgY2FuIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBhIG1vZHVsZSBhbmQgYSBib290c3RyYXAgZnVuY3Rpb24gYnkgcmVhZGluZyBjb21waWxlci1nZW5lcmF0ZWQgYMm1bW9kYCBzdGF0aWMgcHJvcGVydHk6XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgISgnybVtb2QnIGluIHZhbHVlKTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgd29ya2VyIHdoZW4gaXQgaXMgZmlyc3QgY3JlYXRlZCBieSBsb2FkaW5nIHRoZSBab25lLmpzIHBhY2thZ2VcbiAqIGludG8gdGhlIHdvcmtlciBpbnN0YW5jZS5cbiAqXG4gKiBAcmV0dXJucyBBIHByb21pc2UgcmVzb2x2aW5nIHRvIHRoZSByZW5kZXIgZnVuY3Rpb24gb2YgdGhlIHdvcmtlci5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcbiAgLy8gU2V0dXAgWm9uZS5qc1xuICBhd2FpdCBpbXBvcnQoem9uZVBhY2thZ2UpO1xuXG4gIC8vIFJldHVybiB0aGUgcmVuZGVyIGZ1bmN0aW9uIGZvciB1c2VcbiAgcmV0dXJuIHJlbmRlcjtcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCBleHBvcnQgd2lsbCBiZSB0aGUgcHJvbWlzZSByZXR1cm5lZCBieSB0aGUgaW5pdGlhbGl6ZSBmdW5jdGlvbi5cbiAqIFRoaXMgaXMgYXdhaXRlZCBieSBwaXNjaW5hIHByaW9yIHRvIHVzaW5nIHRoZSBXb3JrZXIuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGluaXRpYWxpemUoKTtcbiJdfQ==