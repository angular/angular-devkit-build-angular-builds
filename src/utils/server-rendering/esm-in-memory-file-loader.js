"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = exports.resolve = void 0;
const node_worker_threads_1 = require("node:worker_threads");
const url_1 = require("url");
/**
 * Node.js ESM loader to redirect imports to in memory files.
 * @see: https://nodejs.org/api/esm.html#loaders for more information about loaders.
 */
const { outputFiles } = node_worker_threads_1.workerData;
function resolve(specifier, context, nextResolve) {
    if (!isFileProtocol(specifier)) {
        const normalizedSpecifier = specifier.replace(/^\.\//, '');
        if (normalizedSpecifier in outputFiles) {
            return {
                format: 'module',
                shortCircuit: true,
                url: new URL(normalizedSpecifier, 'file:').href,
            };
        }
    }
    // Defer to the next hook in the chain, which would be the
    // Node.js default resolve if this is the last user-specified loader.
    return nextResolve(specifier);
}
exports.resolve = resolve;
function load(url, context, nextLoad) {
    if (isFileProtocol(url)) {
        const source = outputFiles[(0, url_1.fileURLToPath)(url).slice(1)]; // Remove leading slash
        if (source !== undefined) {
            const { format } = context;
            return {
                format,
                shortCircuit: true,
                source,
            };
        }
    }
    // Let Node.js handle all other URLs.
    return nextLoad(url);
}
exports.load = load;
function isFileProtocol(url) {
    return url.startsWith('file://');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtLWluLW1lbW9yeS1maWxlLWxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvZXNtLWluLW1lbW9yeS1maWxlLWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCw2REFBaUQ7QUFDakQsNkJBQW9DO0FBRXBDOzs7R0FHRztBQUVILE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxnQ0FFdkIsQ0FBQztBQUVGLFNBQWdCLE9BQU8sQ0FBQyxTQUFpQixFQUFFLE9BQVcsRUFBRSxXQUFxQjtJQUMzRSxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzlCLE1BQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDM0QsSUFBSSxtQkFBbUIsSUFBSSxXQUFXLEVBQUU7WUFDdEMsT0FBTztnQkFDTCxNQUFNLEVBQUUsUUFBUTtnQkFDaEIsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLEdBQUcsRUFBRSxJQUFJLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJO2FBQ2hELENBQUM7U0FDSDtLQUNGO0lBRUQsMERBQTBEO0lBQzFELHFFQUFxRTtJQUNyRSxPQUFPLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBZkQsMEJBZUM7QUFFRCxTQUFnQixJQUFJLENBQUMsR0FBVyxFQUFFLE9BQW1DLEVBQUUsUUFBa0I7SUFDdkYsSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDdkIsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUEsbUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtRQUNoRixJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7WUFDeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQztZQUUzQixPQUFPO2dCQUNMLE1BQU07Z0JBQ04sWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE1BQU07YUFDUCxDQUFDO1NBQ0g7S0FDRjtJQUVELHFDQUFxQztJQUNyQyxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QixDQUFDO0FBaEJELG9CQWdCQztBQUVELFNBQVMsY0FBYyxDQUFDLEdBQVc7SUFDakMsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ25DLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbi8qKlxuICogTm9kZS5qcyBFU00gbG9hZGVyIHRvIHJlZGlyZWN0IGltcG9ydHMgdG8gaW4gbWVtb3J5IGZpbGVzLlxuICogQHNlZTogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9lc20uaHRtbCNsb2FkZXJzIGZvciBtb3JlIGluZm9ybWF0aW9uIGFib3V0IGxvYWRlcnMuXG4gKi9cblxuY29uc3QgeyBvdXRwdXRGaWxlcyB9ID0gd29ya2VyRGF0YSBhcyB7XG4gIG91dHB1dEZpbGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmUoc3BlY2lmaWVyOiBzdHJpbmcsIGNvbnRleHQ6IHt9LCBuZXh0UmVzb2x2ZTogRnVuY3Rpb24pIHtcbiAgaWYgKCFpc0ZpbGVQcm90b2NvbChzcGVjaWZpZXIpKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFNwZWNpZmllciA9IHNwZWNpZmllci5yZXBsYWNlKC9eXFwuXFwvLywgJycpO1xuICAgIGlmIChub3JtYWxpemVkU3BlY2lmaWVyIGluIG91dHB1dEZpbGVzKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBmb3JtYXQ6ICdtb2R1bGUnLFxuICAgICAgICBzaG9ydENpcmN1aXQ6IHRydWUsXG4gICAgICAgIHVybDogbmV3IFVSTChub3JtYWxpemVkU3BlY2lmaWVyLCAnZmlsZTonKS5ocmVmLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvLyBEZWZlciB0byB0aGUgbmV4dCBob29rIGluIHRoZSBjaGFpbiwgd2hpY2ggd291bGQgYmUgdGhlXG4gIC8vIE5vZGUuanMgZGVmYXVsdCByZXNvbHZlIGlmIHRoaXMgaXMgdGhlIGxhc3QgdXNlci1zcGVjaWZpZWQgbG9hZGVyLlxuICByZXR1cm4gbmV4dFJlc29sdmUoc3BlY2lmaWVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQodXJsOiBzdHJpbmcsIGNvbnRleHQ6IHsgZm9ybWF0Pzogc3RyaW5nIHwgbnVsbCB9LCBuZXh0TG9hZDogRnVuY3Rpb24pIHtcbiAgaWYgKGlzRmlsZVByb3RvY29sKHVybCkpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBvdXRwdXRGaWxlc1tmaWxlVVJMVG9QYXRoKHVybCkuc2xpY2UoMSldOyAvLyBSZW1vdmUgbGVhZGluZyBzbGFzaFxuICAgIGlmIChzb3VyY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgeyBmb3JtYXQgfSA9IGNvbnRleHQ7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZvcm1hdCxcbiAgICAgICAgc2hvcnRDaXJjdWl0OiB0cnVlLFxuICAgICAgICBzb3VyY2UsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8vIExldCBOb2RlLmpzIGhhbmRsZSBhbGwgb3RoZXIgVVJMcy5cbiAgcmV0dXJuIG5leHRMb2FkKHVybCk7XG59XG5cbmZ1bmN0aW9uIGlzRmlsZVByb3RvY29sKHVybDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpO1xufVxuIl19