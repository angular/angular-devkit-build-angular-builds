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
    for await (const { route, success } of extractRoutes(bootstrapAppFnOrModule, document)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVzLWV4dHJhY3Rvci13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvcm91dGVzLWV4dHJhY3Rvci13b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0Q0FBOEI7QUFDOUIsZ0RBQWtDO0FBQ2xDLDZEQUFpRDtBQXFCakQsTUFBTSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQzVELGdDQUF1QyxDQUFDO0FBRTFDLEtBQUssVUFBVSxPQUFPO0lBQ3BCLE1BQU0sRUFDSixlQUFlLEVBQ2YsYUFBYSxFQUNiLE9BQU8sRUFBRSxjQUFjLEdBQ3hCLEdBQUcsQ0FBQyx5QkFBYSxnQkFBZ0IsdUNBQUMsQ0FBd0IsQ0FBQztJQUU1RCxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9ELE1BQU0sUUFBUSxHQUFHLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFM0UsTUFBTSxzQkFBc0IsR0FBRyxjQUFjLElBQUksZUFBZSxDQUFDO0lBQ2pFLElBQUEscUJBQU0sRUFDSixzQkFBc0IsRUFDdEIsOEVBQThFLGdCQUFnQixHQUFHLENBQ2xHLENBQUM7SUFFRixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsSUFBSSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxhQUFhLENBQUMsc0JBQXNCLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDdEYsSUFBSSxPQUFPLEVBQUU7WUFDWCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ3BCO0tBQ0Y7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxLQUFLLFVBQVUsVUFBVTtJQUN2QixnQkFBZ0I7SUFDaEIseUJBQWEsV0FBVyx1Q0FBQyxDQUFDO0lBRTFCLE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxrQkFBZSxVQUFVLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEFwcGxpY2F0aW9uUmVmLCBUeXBlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHR5cGUgeyBleHRyYWN0Um91dGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcm91dGVzLWV4dHJhY3Rvci9leHRyYWN0b3InO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEge1xuICB6b25lUGFja2FnZTogc3RyaW5nO1xuICBpbmRleEZpbGU6IHN0cmluZztcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBzZXJ2ZXJCdW5kbGVQYXRoOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTZXJ2ZXJCdW5kbGVFeHBvcnRzIHtcbiAgLyoqIE5nTW9kdWxlIHRvIHJlbmRlci4gKi9cbiAgQXBwU2VydmVyTW9kdWxlPzogVHlwZTx1bmtub3duPjtcblxuICAvKiogU3RhbmRhbG9uZSBhcHBsaWNhdGlvbiBib290c3RyYXBwaW5nIGZ1bmN0aW9uLiAqL1xuICBkZWZhdWx0PzogKCgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+KSB8IFR5cGU8dW5rbm93bj47XG5cbiAgLyoqIE1ldGhvZCB0byBleHRyYWN0IHJvdXRlcyBmcm9tIHRoZSByb3V0ZXIgY29uZmlnLiAqL1xuICBleHRyYWN0Um91dGVzOiB0eXBlb2YgZXh0cmFjdFJvdXRlcztcbn1cblxuY29uc3QgeyB6b25lUGFja2FnZSwgc2VydmVyQnVuZGxlUGF0aCwgb3V0cHV0UGF0aCwgaW5kZXhGaWxlIH0gPVxuICB3b3JrZXJEYXRhIGFzIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGE7XG5cbmFzeW5jIGZ1bmN0aW9uIGV4dHJhY3QoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCB7XG4gICAgQXBwU2VydmVyTW9kdWxlLFxuICAgIGV4dHJhY3RSb3V0ZXMsXG4gICAgZGVmYXVsdDogYm9vdHN0cmFwQXBwRm4sXG4gIH0gPSAoYXdhaXQgaW1wb3J0KHNlcnZlckJ1bmRsZVBhdGgpKSBhcyBTZXJ2ZXJCdW5kbGVFeHBvcnRzO1xuXG4gIGNvbnN0IGJyb3dzZXJJbmRleElucHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBpbmRleEZpbGUpO1xuICBjb25zdCBkb2N1bWVudCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGJyb3dzZXJJbmRleElucHV0UGF0aCwgJ3V0ZjgnKTtcblxuICBjb25zdCBib290c3RyYXBBcHBGbk9yTW9kdWxlID0gYm9vdHN0cmFwQXBwRm4gfHwgQXBwU2VydmVyTW9kdWxlO1xuICBhc3NlcnQoXG4gICAgYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSxcbiAgICBgTmVpdGhlciBhbiBBcHBTZXJ2ZXJNb2R1bGUgbm9yIGEgYm9vdHN0cmFwcGluZyBmdW5jdGlvbiB3YXMgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gLFxuICApO1xuXG4gIGNvbnN0IHJvdXRlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIGF3YWl0IChjb25zdCB7IHJvdXRlLCBzdWNjZXNzIH0gb2YgZXh0cmFjdFJvdXRlcyhib290c3RyYXBBcHBGbk9yTW9kdWxlLCBkb2N1bWVudCkpIHtcbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgcm91dGVzLnB1c2gocm91dGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByb3V0ZXM7XG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHdvcmtlciB3aGVuIGl0IGlzIGZpcnN0IGNyZWF0ZWQgYnkgbG9hZGluZyB0aGUgWm9uZS5qcyBwYWNrYWdlXG4gKiBpbnRvIHRoZSB3b3JrZXIgaW5zdGFuY2UuXG4gKlxuICogQHJldHVybnMgQSBwcm9taXNlIHJlc29sdmluZyB0byB0aGUgZXh0cmFjdCBmdW5jdGlvbiBvZiB0aGUgd29ya2VyLlxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuICAvLyBTZXR1cCBab25lLmpzXG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgcmV0dXJuIGV4dHJhY3Q7XG59XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgZXhwb3J0IHdpbGwgYmUgdGhlIHByb21pc2UgcmV0dXJuZWQgYnkgdGhlIGluaXRpYWxpemUgZnVuY3Rpb24uXG4gKiBUaGlzIGlzIGF3YWl0ZWQgYnkgcGlzY2luYSBwcmlvciB0byB1c2luZyB0aGUgV29ya2VyLlxuICovXG5leHBvcnQgZGVmYXVsdCBpbml0aWFsaXplKCk7XG4iXX0=