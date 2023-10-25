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
const { zonePackage, serverBundlePath, outputPath, indexFile } = node_worker_threads_1.workerData;
async function extract() {
    const { AppServerModule, extractRoutes, default: bootstrapAppFn, } = (await Promise.resolve(`${serverBundlePath}`).then(s => __importStar(require(s))));
    const browserIndexInputPath = path.join(outputPath, indexFile);
    const document = await fs.promises.readFile(browserIndexInputPath, 'utf8');
    const bootstrapAppFnOrModule = bootstrapAppFn || AppServerModule;
    (0, node_assert_1.default)(bootstrapAppFnOrModule, `Neither an AppServerModule nor a bootstrapping function was exported from: ${serverBundlePath}.`);
    const routes = [];
    for await (const { route, success } of extractRoutes(bootstrapAppFnOrModule, document, '')) {
        if (success) {
            routes.push(route);
        }
    }
    return routes;
}
/**
 * Initializes the worker when it is first created by loading the Zone.js package
 * into the worker instance.
 *
 * @returns A promise resolving to the extract function of the worker.
 */
async function initialize() {
    // Setup Zone.js
    await Promise.resolve(`${zonePackage}`).then(s => __importStar(require(s)));
    return extract;
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVzLWV4dHJhY3Rvci13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvcm91dGVzLWV4dHJhY3Rvci13b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0Q0FBOEI7QUFDOUIsZ0RBQWtDO0FBQ2xDLDZEQUFpRDtBQXFCakQsTUFBTSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQzVELGdDQUF1QyxDQUFDO0FBRTFDLEtBQUssVUFBVSxPQUFPO0lBQ3BCLE1BQU0sRUFDSixlQUFlLEVBQ2YsYUFBYSxFQUNiLE9BQU8sRUFBRSxjQUFjLEdBQ3hCLEdBQUcsQ0FBQyx5QkFBYSxnQkFBZ0IsdUNBQUMsQ0FBd0IsQ0FBQztJQUU1RCxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9ELE1BQU0sUUFBUSxHQUFHLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFM0UsTUFBTSxzQkFBc0IsR0FBRyxjQUFjLElBQUksZUFBZSxDQUFDO0lBQ2pFLElBQUEscUJBQU0sRUFDSixzQkFBc0IsRUFDdEIsOEVBQThFLGdCQUFnQixHQUFHLENBQ2xHLENBQUM7SUFFRixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsSUFBSSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxhQUFhLENBQUMsc0JBQXNCLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1FBQzFGLElBQUksT0FBTyxFQUFFO1lBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNwQjtLQUNGO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsS0FBSyxVQUFVLFVBQVU7SUFDdkIsZ0JBQWdCO0lBQ2hCLHlCQUFhLFdBQVcsdUNBQUMsQ0FBQztJQUUxQixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsa0JBQWUsVUFBVSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvblJlZiwgVHlwZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICdub2RlOndvcmtlcl90aHJlYWRzJztcbmltcG9ydCB0eXBlIHsgZXh0cmFjdFJvdXRlcyB9IGZyb20gJy4uLy4uL3V0aWxzL3JvdXRlcy1leHRyYWN0b3IvZXh0cmFjdG9yJztcblxuZXhwb3J0IGludGVyZmFjZSBSb3V0ZXNFeHRyYWN0b3JXb3JrZXJEYXRhIHtcbiAgem9uZVBhY2thZ2U6IHN0cmluZztcbiAgaW5kZXhGaWxlOiBzdHJpbmc7XG4gIG91dHB1dFBhdGg6IHN0cmluZztcbiAgc2VydmVyQnVuZGxlUGF0aDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2VydmVyQnVuZGxlRXhwb3J0cyB7XG4gIC8qKiBOZ01vZHVsZSB0byByZW5kZXIuICovXG4gIEFwcFNlcnZlck1vZHVsZT86IFR5cGU8dW5rbm93bj47XG5cbiAgLyoqIFN0YW5kYWxvbmUgYXBwbGljYXRpb24gYm9vdHN0cmFwcGluZyBmdW5jdGlvbi4gKi9cbiAgZGVmYXVsdD86ICgoKSA9PiBQcm9taXNlPEFwcGxpY2F0aW9uUmVmPikgfCBUeXBlPHVua25vd24+O1xuXG4gIC8qKiBNZXRob2QgdG8gZXh0cmFjdCByb3V0ZXMgZnJvbSB0aGUgcm91dGVyIGNvbmZpZy4gKi9cbiAgZXh0cmFjdFJvdXRlczogdHlwZW9mIGV4dHJhY3RSb3V0ZXM7XG59XG5cbmNvbnN0IHsgem9uZVBhY2thZ2UsIHNlcnZlckJ1bmRsZVBhdGgsIG91dHB1dFBhdGgsIGluZGV4RmlsZSB9ID1cbiAgd29ya2VyRGF0YSBhcyBSb3V0ZXNFeHRyYWN0b3JXb3JrZXJEYXRhO1xuXG5hc3luYyBmdW5jdGlvbiBleHRyYWN0KCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3Qge1xuICAgIEFwcFNlcnZlck1vZHVsZSxcbiAgICBleHRyYWN0Um91dGVzLFxuICAgIGRlZmF1bHQ6IGJvb3RzdHJhcEFwcEZuLFxuICB9ID0gKGF3YWl0IGltcG9ydChzZXJ2ZXJCdW5kbGVQYXRoKSkgYXMgU2VydmVyQnVuZGxlRXhwb3J0cztcblxuICBjb25zdCBicm93c2VySW5kZXhJbnB1dFBhdGggPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgaW5kZXhGaWxlKTtcbiAgY29uc3QgZG9jdW1lbnQgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShicm93c2VySW5kZXhJbnB1dFBhdGgsICd1dGY4Jyk7XG5cbiAgY29uc3QgYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSA9IGJvb3RzdHJhcEFwcEZuIHx8IEFwcFNlcnZlck1vZHVsZTtcbiAgYXNzZXJ0KFxuICAgIGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUsXG4gICAgYE5laXRoZXIgYW4gQXBwU2VydmVyTW9kdWxlIG5vciBhIGJvb3RzdHJhcHBpbmcgZnVuY3Rpb24gd2FzIGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCxcbiAgKTtcblxuICBjb25zdCByb3V0ZXM6IHN0cmluZ1tdID0gW107XG4gIGZvciBhd2FpdCAoY29uc3QgeyByb3V0ZSwgc3VjY2VzcyB9IG9mIGV4dHJhY3RSb3V0ZXMoYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSwgZG9jdW1lbnQsICcnKSkge1xuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICByb3V0ZXMucHVzaChyb3V0ZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJvdXRlcztcbn1cblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgd29ya2VyIHdoZW4gaXQgaXMgZmlyc3QgY3JlYXRlZCBieSBsb2FkaW5nIHRoZSBab25lLmpzIHBhY2thZ2VcbiAqIGludG8gdGhlIHdvcmtlciBpbnN0YW5jZS5cbiAqXG4gKiBAcmV0dXJucyBBIHByb21pc2UgcmVzb2x2aW5nIHRvIHRoZSBleHRyYWN0IGZ1bmN0aW9uIG9mIHRoZSB3b3JrZXIuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG4gIC8vIFNldHVwIFpvbmUuanNcbiAgYXdhaXQgaW1wb3J0KHpvbmVQYWNrYWdlKTtcblxuICByZXR1cm4gZXh0cmFjdDtcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCBleHBvcnQgd2lsbCBiZSB0aGUgcHJvbWlzZSByZXR1cm5lZCBieSB0aGUgaW5pdGlhbGl6ZSBmdW5jdGlvbi5cbiAqIFRoaXMgaXMgYXdhaXRlZCBieSBwaXNjaW5hIHByaW9yIHRvIHVzaW5nIHRoZSBXb3JrZXIuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGluaXRpYWxpemUoKTtcbiJdfQ==