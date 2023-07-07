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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNtLWluLW1lbW9yeS1maWxlLWxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3NzZy9lc20taW4tbWVtb3J5LWZpbGUtbG9hZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILDZEQUFpRDtBQUNqRCw2QkFBb0M7QUFFcEM7OztHQUdHO0FBRUgsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLGdDQUV2QixDQUFDO0FBRUYsU0FBZ0IsT0FBTyxDQUFDLFNBQWlCLEVBQUUsT0FBVyxFQUFFLFdBQXFCO0lBQzNFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDOUIsTUFBTSxtQkFBbUIsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMzRCxJQUFJLG1CQUFtQixJQUFJLFdBQVcsRUFBRTtZQUN0QyxPQUFPO2dCQUNMLE1BQU0sRUFBRSxRQUFRO2dCQUNoQixZQUFZLEVBQUUsSUFBSTtnQkFDbEIsR0FBRyxFQUFFLElBQUksR0FBRyxDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUk7YUFDaEQsQ0FBQztTQUNIO0tBQ0Y7SUFFRCwwREFBMEQ7SUFDMUQscUVBQXFFO0lBQ3JFLE9BQU8sV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFmRCwwQkFlQztBQUVELFNBQWdCLElBQUksQ0FBQyxHQUFXLEVBQUUsT0FBbUMsRUFBRSxRQUFrQjtJQUN2RixJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN2QixNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsSUFBQSxtQkFBYSxFQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsdUJBQXVCO1FBQ2hGLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtZQUN4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDO1lBRTNCLE9BQU87Z0JBQ0wsTUFBTTtnQkFDTixZQUFZLEVBQUUsSUFBSTtnQkFDbEIsTUFBTTthQUNQLENBQUM7U0FDSDtLQUNGO0lBRUQscUNBQXFDO0lBQ3JDLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUM7QUFoQkQsb0JBZ0JDO0FBRUQsU0FBUyxjQUFjLENBQUMsR0FBVztJQUNqQyxPQUFPLEdBQUcsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyB3b3JrZXJEYXRhIH0gZnJvbSAnbm9kZTp3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAndXJsJztcblxuLyoqXG4gKiBOb2RlLmpzIEVTTSBsb2FkZXIgdG8gcmVkaXJlY3QgaW1wb3J0cyB0byBpbiBtZW1vcnkgZmlsZXMuXG4gKiBAc2VlOiBodHRwczovL25vZGVqcy5vcmcvYXBpL2VzbS5odG1sI2xvYWRlcnMgZm9yIG1vcmUgaW5mb3JtYXRpb24gYWJvdXQgbG9hZGVycy5cbiAqL1xuXG5jb25zdCB7IG91dHB1dEZpbGVzIH0gPSB3b3JrZXJEYXRhIGFzIHtcbiAgb3V0cHV0RmlsZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZShzcGVjaWZpZXI6IHN0cmluZywgY29udGV4dDoge30sIG5leHRSZXNvbHZlOiBGdW5jdGlvbikge1xuICBpZiAoIWlzRmlsZVByb3RvY29sKHNwZWNpZmllcikpIHtcbiAgICBjb25zdCBub3JtYWxpemVkU3BlY2lmaWVyID0gc3BlY2lmaWVyLnJlcGxhY2UoL15cXC5cXC8vLCAnJyk7XG4gICAgaWYgKG5vcm1hbGl6ZWRTcGVjaWZpZXIgaW4gb3V0cHV0RmlsZXMpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZvcm1hdDogJ21vZHVsZScsXG4gICAgICAgIHNob3J0Q2lyY3VpdDogdHJ1ZSxcbiAgICAgICAgdXJsOiBuZXcgVVJMKG5vcm1hbGl6ZWRTcGVjaWZpZXIsICdmaWxlOicpLmhyZWYsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8vIERlZmVyIHRvIHRoZSBuZXh0IGhvb2sgaW4gdGhlIGNoYWluLCB3aGljaCB3b3VsZCBiZSB0aGVcbiAgLy8gTm9kZS5qcyBkZWZhdWx0IHJlc29sdmUgaWYgdGhpcyBpcyB0aGUgbGFzdCB1c2VyLXNwZWNpZmllZCBsb2FkZXIuXG4gIHJldHVybiBuZXh0UmVzb2x2ZShzcGVjaWZpZXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9hZCh1cmw6IHN0cmluZywgY29udGV4dDogeyBmb3JtYXQ/OiBzdHJpbmcgfCBudWxsIH0sIG5leHRMb2FkOiBGdW5jdGlvbikge1xuICBpZiAoaXNGaWxlUHJvdG9jb2wodXJsKSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IG91dHB1dEZpbGVzW2ZpbGVVUkxUb1BhdGgodXJsKS5zbGljZSgxKV07IC8vIFJlbW92ZSBsZWFkaW5nIHNsYXNoXG4gICAgaWYgKHNvdXJjZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCB7IGZvcm1hdCB9ID0gY29udGV4dDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZm9ybWF0LFxuICAgICAgICBzaG9ydENpcmN1aXQ6IHRydWUsXG4gICAgICAgIHNvdXJjZSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLy8gTGV0IE5vZGUuanMgaGFuZGxlIGFsbCBvdGhlciBVUkxzLlxuICByZXR1cm4gbmV4dExvYWQodXJsKTtcbn1cblxuZnVuY3Rpb24gaXNGaWxlUHJvdG9jb2wodXJsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJyk7XG59XG4iXX0=