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
const node_path_1 = require("node:path");
const node_worker_threads_1 = require("node:worker_threads");
const inline_critical_css_1 = require("../index-file/inline-critical-css");
const load_esm_1 = require("../load-esm");
/**
 * The fully resolved path to the zone.js package that will be loaded during worker initialization.
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { zonePackage, outputFiles, document, inlineCriticalCss } = node_worker_threads_1.workerData;
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function render({ route, serverContext }) {
    const { default: bootstrapAppFnOrModule, ɵSERVER_CONTEXT, renderModule, renderApplication, } = await (0, load_esm_1.loadEsmModule)('./server.mjs');
    (0, node_assert_1.default)(ɵSERVER_CONTEXT, `ɵSERVER_CONTEXT was not exported.`);
    const platformProviders = [
        {
            provide: ɵSERVER_CONTEXT,
            useValue: serverContext,
        },
    ];
    let html;
    if (isBootstrapFn(bootstrapAppFnOrModule)) {
        (0, node_assert_1.default)(renderApplication, `renderApplication was not exported.`);
        html = await renderApplication(bootstrapAppFnOrModule, {
            document,
            url: route,
            platformProviders,
        });
    }
    else {
        (0, node_assert_1.default)(renderModule, `renderModule was not exported.`);
        (0, node_assert_1.default)(bootstrapAppFnOrModule, `Neither an AppServerModule nor a bootstrapping function was exported.`);
        html = await renderModule(bootstrapAppFnOrModule, {
            document,
            url: route,
            extraProviders: platformProviders,
        });
    }
    if (inlineCriticalCss) {
        const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
            minify: false,
            readAsset: async (filePath) => {
                filePath = (0, node_path_1.basename)(filePath);
                const content = outputFiles[filePath];
                if (content === undefined) {
                    throw new Error(`Output file does not exist: ${filePath}`);
                }
                return content;
            },
        });
        return inlineCriticalCssProcessor.process(html, { outputPath: '' });
    }
    return {
        content: html,
    };
}
function isBootstrapFn(value) {
    // We can differentiate between a module and a bootstrap function by reading `cmp`:
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
    return render;
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3NzZy9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw4REFBaUM7QUFDakMseUNBQXFDO0FBQ3JDLDZEQUFpRDtBQUNqRCwyRUFBK0U7QUFDL0UsMENBQTRDO0FBb0M1Qzs7O0dBR0c7QUFDSCxNQUFNLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxnQ0FBd0IsQ0FBQztBQUUzRjs7R0FFRztBQUNILEtBQUssVUFBVSxNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFpQjtJQUMzRCxNQUFNLEVBQ0osT0FBTyxFQUFFLHNCQUFzQixFQUMvQixlQUFlLEVBQ2YsWUFBWSxFQUNaLGlCQUFpQixHQUNsQixHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUFnQixjQUFjLENBQUMsQ0FBQztJQUV2RCxJQUFBLHFCQUFNLEVBQUMsZUFBZSxFQUFFLG1DQUFtQyxDQUFDLENBQUM7SUFFN0QsTUFBTSxpQkFBaUIsR0FBcUI7UUFDMUM7WUFDRSxPQUFPLEVBQUUsZUFBZTtZQUN4QixRQUFRLEVBQUUsYUFBYTtTQUN4QjtLQUNGLENBQUM7SUFFRixJQUFJLElBQXdCLENBQUM7SUFFN0IsSUFBSSxhQUFhLENBQUMsc0JBQXNCLENBQUMsRUFBRTtRQUN6QyxJQUFBLHFCQUFNLEVBQUMsaUJBQWlCLEVBQUUscUNBQXFDLENBQUMsQ0FBQztRQUNqRSxJQUFJLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBRTtZQUNyRCxRQUFRO1lBQ1IsR0FBRyxFQUFFLEtBQUs7WUFDVixpQkFBaUI7U0FDbEIsQ0FBQyxDQUFDO0tBQ0o7U0FBTTtRQUNMLElBQUEscUJBQU0sRUFBQyxZQUFZLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQztRQUN2RCxJQUFBLHFCQUFNLEVBQ0osc0JBQXNCLEVBQ3RCLHVFQUF1RSxDQUN4RSxDQUFDO1FBRUYsSUFBSSxHQUFHLE1BQU0sWUFBWSxDQUFDLHNCQUFzQixFQUFFO1lBQ2hELFFBQVE7WUFDUixHQUFHLEVBQUUsS0FBSztZQUNWLGNBQWMsRUFBRSxpQkFBaUI7U0FDbEMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLGlCQUFpQixFQUFFO1FBQ3JCLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxnREFBMEIsQ0FBQztZQUNoRSxNQUFNLEVBQUUsS0FBSztZQUNiLFNBQVMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUU7Z0JBQzVCLFFBQVEsR0FBRyxJQUFBLG9CQUFRLEVBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzlCLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFO29CQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixRQUFRLEVBQUUsQ0FBQyxDQUFDO2lCQUM1RDtnQkFFRCxPQUFPLE9BQU8sQ0FBQztZQUNqQixDQUFDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsT0FBTywwQkFBMEIsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7S0FDckU7SUFFRCxPQUFPO1FBQ0wsT0FBTyxFQUFFLElBQUk7S0FDZCxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLEtBQWM7SUFDbkMsbUZBQW1GO0lBQ25GLE9BQU8sT0FBTyxLQUFLLEtBQUssVUFBVSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLENBQUM7QUFDM0QsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsS0FBSyxVQUFVLFVBQVU7SUFDdkIsZ0JBQWdCO0lBQ2hCLHlCQUFhLFdBQVcsdUNBQUMsQ0FBQztJQUUxQixPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsa0JBQWUsVUFBVSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvblJlZiwgU3RhdGljUHJvdmlkZXIsIFR5cGUgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB0eXBlIHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICdub2RlOndvcmtlcl90aHJlYWRzJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi4vaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi9sb2FkLWVzbSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyT3B0aW9ucyB7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIHNlcnZlckNvbnRleHQ6IFNlcnZlckNvbnRleHQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyUmVzdWx0IHtcbiAgZXJyb3JzPzogc3RyaW5nW107XG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFNlcnZlckNvbnRleHQgPSAnYXBwLXNoZWxsJyB8ICdzc2cnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdvcmtlckRhdGEge1xuICB6b25lUGFja2FnZTogc3RyaW5nO1xuICBvdXRwdXRGaWxlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgZG9jdW1lbnQ6IHN0cmluZztcbiAgaW5saW5lQ3JpdGljYWxDc3M/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQnVuZGxlRXhwb3J0cyB7XG4gIC8qKiBBbiBpbnRlcm5hbCB0b2tlbiB0aGF0IGFsbG93cyBwcm92aWRpbmcgZXh0cmEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHNlcnZlciBjb250ZXh0LiAqL1xuICDJtVNFUlZFUl9DT05URVhUPzogdHlwZW9mIMm1U0VSVkVSX0NPTlRFWFQ7XG5cbiAgLyoqIFJlbmRlciBhbiBOZ01vZHVsZSBhcHBsaWNhdGlvbi4gKi9cbiAgcmVuZGVyTW9kdWxlPzogdHlwZW9mIHJlbmRlck1vZHVsZTtcblxuICAvKiogTWV0aG9kIHRvIHJlbmRlciBhIHN0YW5kYWxvbmUgYXBwbGljYXRpb24uICovXG4gIHJlbmRlckFwcGxpY2F0aW9uPzogdHlwZW9mIHJlbmRlckFwcGxpY2F0aW9uO1xuXG4gIC8qKiBTdGFuZGFsb25lIGFwcGxpY2F0aW9uIGJvb3RzdHJhcHBpbmcgZnVuY3Rpb24uICovXG4gIGRlZmF1bHQ/OiAoKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4pIHwgVHlwZTx1bmtub3duPjtcbn1cblxuLyoqXG4gKiBUaGUgZnVsbHkgcmVzb2x2ZWQgcGF0aCB0byB0aGUgem9uZS5qcyBwYWNrYWdlIHRoYXQgd2lsbCBiZSBsb2FkZWQgZHVyaW5nIHdvcmtlciBpbml0aWFsaXphdGlvbi5cbiAqIFRoaXMgaXMgcGFzc2VkIGFzIHdvcmtlckRhdGEgd2hlbiBzZXR0aW5nIHVwIHRoZSB3b3JrZXIgdmlhIHRoZSBgcGlzY2luYWAgcGFja2FnZS5cbiAqL1xuY29uc3QgeyB6b25lUGFja2FnZSwgb3V0cHV0RmlsZXMsIGRvY3VtZW50LCBpbmxpbmVDcml0aWNhbENzcyB9ID0gd29ya2VyRGF0YSBhcyBXb3JrZXJEYXRhO1xuXG4vKipcbiAqIFJlbmRlcnMgZWFjaCByb3V0ZSBpbiByb3V0ZXMgYW5kIHdyaXRlcyB0aGVtIHRvIDxvdXRwdXRQYXRoPi88cm91dGU+L2luZGV4Lmh0bWwuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlbmRlcih7IHJvdXRlLCBzZXJ2ZXJDb250ZXh0IH06IFJlbmRlck9wdGlvbnMpOiBQcm9taXNlPFJlbmRlclJlc3VsdD4ge1xuICBjb25zdCB7XG4gICAgZGVmYXVsdDogYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSxcbiAgICDJtVNFUlZFUl9DT05URVhULFxuICAgIHJlbmRlck1vZHVsZSxcbiAgICByZW5kZXJBcHBsaWNhdGlvbixcbiAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8QnVuZGxlRXhwb3J0cz4oJy4vc2VydmVyLm1qcycpO1xuXG4gIGFzc2VydCjJtVNFUlZFUl9DT05URVhULCBgybVTRVJWRVJfQ09OVEVYVCB3YXMgbm90IGV4cG9ydGVkLmApO1xuXG4gIGNvbnN0IHBsYXRmb3JtUHJvdmlkZXJzOiBTdGF0aWNQcm92aWRlcltdID0gW1xuICAgIHtcbiAgICAgIHByb3ZpZGU6IMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgICB1c2VWYWx1ZTogc2VydmVyQ29udGV4dCxcbiAgICB9LFxuICBdO1xuXG4gIGxldCBodG1sOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgaWYgKGlzQm9vdHN0cmFwRm4oYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSkpIHtcbiAgICBhc3NlcnQocmVuZGVyQXBwbGljYXRpb24sIGByZW5kZXJBcHBsaWNhdGlvbiB3YXMgbm90IGV4cG9ydGVkLmApO1xuICAgIGh0bWwgPSBhd2FpdCByZW5kZXJBcHBsaWNhdGlvbihib290c3RyYXBBcHBGbk9yTW9kdWxlLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBhc3NlcnQocmVuZGVyTW9kdWxlLCBgcmVuZGVyTW9kdWxlIHdhcyBub3QgZXhwb3J0ZWQuYCk7XG4gICAgYXNzZXJ0KFxuICAgICAgYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSxcbiAgICAgIGBOZWl0aGVyIGFuIEFwcFNlcnZlck1vZHVsZSBub3IgYSBib290c3RyYXBwaW5nIGZ1bmN0aW9uIHdhcyBleHBvcnRlZC5gLFxuICAgICk7XG5cbiAgICBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlKGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUsIHtcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdXJsOiByb3V0ZSxcbiAgICAgIGV4dHJhUHJvdmlkZXJzOiBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChpbmxpbmVDcml0aWNhbENzcykge1xuICAgIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICAgIG1pbmlmeTogZmFsc2UsIC8vIENTUyBoYXMgYWxyZWFkeSBiZWVuIG1pbmlmaWVkIGR1cmluZyB0aGUgYnVpbGQuXG4gICAgICByZWFkQXNzZXQ6IGFzeW5jIChmaWxlUGF0aCkgPT4ge1xuICAgICAgICBmaWxlUGF0aCA9IGJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgICAgY29uc3QgY29udGVudCA9IG91dHB1dEZpbGVzW2ZpbGVQYXRoXTtcbiAgICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7IG91dHB1dFBhdGg6ICcnIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjb250ZW50OiBodG1sLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0Jvb3RzdHJhcEZuKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4ge1xuICAvLyBXZSBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgbW9kdWxlIGFuZCBhIGJvb3RzdHJhcCBmdW5jdGlvbiBieSByZWFkaW5nIGBjbXBgOlxuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmICEoJ8m1bW9kJyBpbiB2YWx1ZSk7XG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHdvcmtlciB3aGVuIGl0IGlzIGZpcnN0IGNyZWF0ZWQgYnkgbG9hZGluZyB0aGUgWm9uZS5qcyBwYWNrYWdlXG4gKiBpbnRvIHRoZSB3b3JrZXIgaW5zdGFuY2UuXG4gKlxuICogQHJldHVybnMgQSBwcm9taXNlIHJlc29sdmluZyB0byB0aGUgcmVuZGVyIGZ1bmN0aW9uIG9mIHRoZSB3b3JrZXIuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG4gIC8vIFNldHVwIFpvbmUuanNcbiAgYXdhaXQgaW1wb3J0KHpvbmVQYWNrYWdlKTtcblxuICByZXR1cm4gcmVuZGVyO1xufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGV4cG9ydCB3aWxsIGJlIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpbml0aWFsaXplIGZ1bmN0aW9uLlxuICogVGhpcyBpcyBhd2FpdGVkIGJ5IHBpc2NpbmEgcHJpb3IgdG8gdXNpbmcgdGhlIFdvcmtlci5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgaW5pdGlhbGl6ZSgpO1xuIl19