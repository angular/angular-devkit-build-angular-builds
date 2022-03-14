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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.postcss = void 0;
const loader_utils_1 = require("loader-utils");
const path = __importStar(require("path"));
const url = __importStar(require("url"));
function wrapUrl(url) {
    let wrappedUrl;
    const hasSingleQuotes = url.indexOf("'") >= 0;
    if (hasSingleQuotes) {
        wrappedUrl = `"${url}"`;
    }
    else {
        wrappedUrl = `'${url}'`;
    }
    return `url(${wrappedUrl})`;
}
async function resolve(file, base, resolver) {
    try {
        return await resolver('./' + file, base);
    }
    catch (_a) {
        return resolver(file, base);
    }
}
exports.postcss = true;
function default_1(options) {
    if (!options) {
        throw new Error('No options were specified to "postcss-cli-resources".');
    }
    const { deployUrl = '', resourcesOutputPath = '', filename, loader, emitFile, extracted, } = options;
    const process = async (inputUrl, context, resourceCache) => {
        // If root-relative, absolute or protocol relative url, leave as is
        if (/^((?:\w+:)?\/\/|data:|chrome:|#)/.test(inputUrl)) {
            return inputUrl;
        }
        if (/^\//.test(inputUrl)) {
            return inputUrl;
        }
        // If starts with a caret, remove and return remainder
        // this supports bypassing asset processing
        if (inputUrl.startsWith('^')) {
            return inputUrl.substr(1);
        }
        const cacheKey = path.resolve(context, inputUrl);
        const cachedUrl = resourceCache.get(cacheKey);
        if (cachedUrl) {
            return cachedUrl;
        }
        if (inputUrl.startsWith('~')) {
            inputUrl = inputUrl.substr(1);
        }
        const { pathname, hash, search } = url.parse(inputUrl.replace(/\\/g, '/'));
        const resolver = (file, base) => new Promise((resolve, reject) => {
            loader.resolve(base, decodeURI(file), (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
        const result = await resolve(pathname, context, resolver);
        return new Promise((resolve, reject) => {
            loader.fs.readFile(result, (err, content) => {
                if (err) {
                    reject(err);
                    return;
                }
                let outputPath = (0, loader_utils_1.interpolateName)({ resourcePath: result }, filename(result), {
                    content,
                    context: loader.context || loader.rootContext,
                }).replace(/\\|\//g, '-');
                if (resourcesOutputPath) {
                    outputPath = path.posix.join(resourcesOutputPath, outputPath);
                }
                loader.addDependency(result);
                if (emitFile) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    loader.emitFile(outputPath, content, undefined, { sourceFilename: result });
                }
                let outputUrl = outputPath.replace(/\\/g, '/');
                if (hash || search) {
                    outputUrl = url.format({ pathname: outputUrl, hash, search });
                }
                if (deployUrl && !extracted) {
                    outputUrl = url.resolve(deployUrl, outputUrl);
                }
                resourceCache.set(cacheKey, outputUrl);
                resolve(outputUrl);
            });
        });
    };
    const resourceCache = new Map();
    const processed = Symbol('postcss-cli-resources');
    return {
        postcssPlugin: 'postcss-cli-resources',
        async Declaration(decl) {
            if (!decl.value.includes('url') || processed in decl) {
                return;
            }
            const value = decl.value;
            const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*\)/g;
            const segments = [];
            let match;
            let lastIndex = 0;
            let modified = false;
            // We want to load it relative to the file that imports
            const inputFile = decl.source && decl.source.input.file;
            const context = (inputFile && path.dirname(inputFile)) || loader.context;
            // eslint-disable-next-line no-cond-assign
            while ((match = urlRegex.exec(value))) {
                const originalUrl = match[1] || match[2] || match[3];
                let processedUrl;
                try {
                    processedUrl = await process(originalUrl, context, resourceCache);
                }
                catch (err) {
                    loader.emitError(decl.error(err.message, { word: originalUrl }));
                    continue;
                }
                if (lastIndex < match.index) {
                    segments.push(value.slice(lastIndex, match.index));
                }
                if (!processedUrl || originalUrl === processedUrl) {
                    segments.push(match[0]);
                }
                else {
                    segments.push(wrapUrl(processedUrl));
                    modified = true;
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < value.length) {
                segments.push(value.slice(lastIndex));
            }
            if (modified) {
                decl.value = segments.join('');
            }
            decl[processed] = true;
        },
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGNzcy1jbGktcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQStDO0FBQy9DLDJDQUE2QjtBQUU3Qix5Q0FBMkI7QUFFM0IsU0FBUyxPQUFPLENBQUMsR0FBVztJQUMxQixJQUFJLFVBQVUsQ0FBQztJQUNmLE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTlDLElBQUksZUFBZSxFQUFFO1FBQ25CLFVBQVUsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDO0tBQ3pCO1NBQU07UUFDTCxVQUFVLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQztLQUN6QjtJQUVELE9BQU8sT0FBTyxVQUFVLEdBQUcsQ0FBQztBQUM5QixDQUFDO0FBY0QsS0FBSyxVQUFVLE9BQU8sQ0FDcEIsSUFBWSxFQUNaLElBQVksRUFDWixRQUF5RDtJQUV6RCxJQUFJO1FBQ0YsT0FBTyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQzFDO0lBQUMsV0FBTTtRQUNOLE9BQU8sUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztLQUM3QjtBQUNILENBQUM7QUFFWSxRQUFBLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFFNUIsbUJBQXlCLE9BQW9DO0lBQzNELElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDWixNQUFNLElBQUksS0FBSyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7S0FDMUU7SUFFRCxNQUFNLEVBQ0osU0FBUyxHQUFHLEVBQUUs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akQsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDekI7cUJBQU07b0JBQ0wsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztvQkFDckMsUUFBUSxHQUFHLElBQUksQ0FBQztpQkFDakI7Z0JBRUQsU0FBUyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQzthQUMzQztZQUVELElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUU7Z0JBQzVCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2FBQ3ZDO1lBRUQsSUFBSSxRQUFRLEVBQUU7Z0JBQ1osSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQ2hDO1lBRUEsSUFBK0MsQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDckUsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBdkpELDRCQXVKQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBpbnRlcnBvbGF0ZU5hbWUgfSBmcm9tICdsb2FkZXItdXRpbHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IERlY2xhcmF0aW9uLCBQbHVnaW4gfSBmcm9tICdwb3N0Y3NzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuXG5mdW5jdGlvbiB3cmFwVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHdyYXBwZWRVcmw7XG4gIGNvbnN0IGhhc1NpbmdsZVF1b3RlcyA9IHVybC5pbmRleE9mKFwiJ1wiKSA+PSAwO1xuXG4gIGlmIChoYXNTaW5nbGVRdW90ZXMpIHtcbiAgICB3cmFwcGVkVXJsID0gYFwiJHt1cmx9XCJgO1xuICB9IGVsc2Uge1xuICAgIHdyYXBwZWRVcmwgPSBgJyR7dXJsfSdgO1xuICB9XG5cbiAgcmV0dXJuIGB1cmwoJHt3cmFwcGVkVXJsfSlgO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc3Rjc3NDbGlSZXNvdXJjZXNPcHRpb25zIHtcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgcmVzb3VyY2VzT3V0cHV0UGF0aD86IHN0cmluZztcbiAgcmViYXNlUm9vdFJlbGF0aXZlPzogYm9vbGVhbjtcbiAgLyoqIENTUyBpcyBleHRyYWN0ZWQgdG8gYSBgLmNzc2Agb3IgaXMgZW1iZWRkZWQgaW4gYSBgLmpzYCBmaWxlLiAqL1xuICBleHRyYWN0ZWQ/OiBib29sZWFuO1xuICBmaWxlbmFtZTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmc7XG4gIGxvYWRlcjogaW1wb3J0KCd3ZWJwYWNrJykuTG9hZGVyQ29udGV4dDx1bmtub3duPjtcbiAgZW1pdEZpbGU6IGJvb2xlYW47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmUoXG4gIGZpbGU6IHN0cmluZyxcbiAgYmFzZTogc3RyaW5nLFxuICByZXNvbHZlcjogKGZpbGU6IHN0cmluZywgYmFzZTogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz4sXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCByZXNvbHZlcignLi8nICsgZmlsZSwgYmFzZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiByZXNvbHZlcihmaWxlLCBiYXNlKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgcG9zdGNzcyA9IHRydWU7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChvcHRpb25zPzogUG9zdGNzc0NsaVJlc291cmNlc09wdGlvbnMpOiBQbHVnaW4ge1xuICBpZiAoIW9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9wdGlvbnMgd2VyZSBzcGVjaWZpZWQgdG8gXCJwb3N0Y3NzLWNsaS1yZXNvdXJjZXNcIi4nKTtcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICBkZXBsb3lVcmwgPSAnJyxcbiAgICByZXNvdXJjZXNPdXRwdXRQYXRoID0gJycsXG4gICAgZmlsZW5hbWUsXG4gICAgbG9hZGVyLFxuICAgIGVtaXRGaWxlLFxuICAgIGV4dHJhY3RlZCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgcHJvY2VzcyA9IGFzeW5jIChpbnB1dFVybDogc3RyaW5nLCBjb250ZXh0OiBzdHJpbmcsIHJlc291cmNlQ2FjaGU6IE1hcDxzdHJpbmcsIHN0cmluZz4pID0+IHtcbiAgICAvLyBJZiByb290LXJlbGF0aXZlLCBhYnNvbHV0ZSBvciBwcm90b2NvbCByZWxhdGl2ZSB1cmwsIGxlYXZlIGFzIGlzXG4gICAgaWYgKC9eKCg/Olxcdys6KT9cXC9cXC98ZGF0YTp8Y2hyb21lOnwjKS8udGVzdChpbnB1dFVybCkpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybDtcbiAgICB9XG5cbiAgICBpZiAoL15cXC8vLnRlc3QoaW5wdXRVcmwpKSB7XG4gICAgICByZXR1cm4gaW5wdXRVcmw7XG4gICAgfVxuXG4gICAgLy8gSWYgc3RhcnRzIHdpdGggYSBjYXJldCwgcmVtb3ZlIGFuZCByZXR1cm4gcmVtYWluZGVyXG4gICAgLy8gdGhpcyBzdXBwb3J0cyBieXBhc3NpbmcgYXNzZXQgcHJvY2Vzc2luZ1xuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCdeJykpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybC5zdWJzdHIoMSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVLZXkgPSBwYXRoLnJlc29sdmUoY29udGV4dCwgaW5wdXRVcmwpO1xuICAgIGNvbnN0IGNhY2hlZFVybCA9IHJlc291cmNlQ2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICBpZiAoY2FjaGVkVXJsKSB7XG4gICAgICByZXR1cm4gY2FjaGVkVXJsO1xuICAgIH1cblxuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgIGlucHV0VXJsID0gaW5wdXRVcmwuc3Vic3RyKDEpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgcGF0aG5hbWUsIGhhc2gsIHNlYXJjaCB9ID0gdXJsLnBhcnNlKGlucHV0VXJsLnJlcGxhY2UoL1xcXFwvZywgJy8nKSk7XG4gICAgY29uc3QgcmVzb2x2ZXIgPSAoZmlsZTogc3RyaW5nLCBiYXNlOiBzdHJpbmcpID0+XG4gICAgICBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgbG9hZGVyLnJlc29sdmUoYmFzZSwgZGVjb2RlVVJJKGZpbGUpLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXNvbHZlKHJlc3VsdCBhcyBzdHJpbmcpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzb2x2ZShwYXRobmFtZSBhcyBzdHJpbmcsIGNvbnRleHQsIHJlc29sdmVyKTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShyZXN1bHQsIChlcnIsIGNvbnRlbnQpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG91dHB1dFBhdGggPSBpbnRlcnBvbGF0ZU5hbWUoeyByZXNvdXJjZVBhdGg6IHJlc3VsdCB9LCBmaWxlbmFtZShyZXN1bHQpLCB7XG4gICAgICAgICAgY29udGVudCxcbiAgICAgICAgICBjb250ZXh0OiBsb2FkZXIuY29udGV4dCB8fCBsb2FkZXIucm9vdENvbnRleHQsXG4gICAgICAgIH0pLnJlcGxhY2UoL1xcXFx8XFwvL2csICctJyk7XG5cbiAgICAgICAgaWYgKHJlc291cmNlc091dHB1dFBhdGgpIHtcbiAgICAgICAgICBvdXRwdXRQYXRoID0gcGF0aC5wb3NpeC5qb2luKHJlc291cmNlc091dHB1dFBhdGgsIG91dHB1dFBhdGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9hZGVyLmFkZERlcGVuZGVuY3kocmVzdWx0KTtcbiAgICAgICAgaWYgKGVtaXRGaWxlKSB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICBsb2FkZXIuZW1pdEZpbGUob3V0cHV0UGF0aCwgY29udGVudCEsIHVuZGVmaW5lZCwgeyBzb3VyY2VGaWxlbmFtZTogcmVzdWx0IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG91dHB1dFVybCA9IG91dHB1dFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgICBpZiAoaGFzaCB8fCBzZWFyY2gpIHtcbiAgICAgICAgICBvdXRwdXRVcmwgPSB1cmwuZm9ybWF0KHsgcGF0aG5hbWU6IG91dHB1dFVybCwgaGFzaCwgc2VhcmNoIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlcGxveVVybCAmJiAhZXh0cmFjdGVkKSB7XG4gICAgICAgICAgb3V0cHV0VXJsID0gdXJsLnJlc29sdmUoZGVwbG95VXJsLCBvdXRwdXRVcmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb3VyY2VDYWNoZS5zZXQoY2FjaGVLZXksIG91dHB1dFVybCk7XG4gICAgICAgIHJlc29sdmUob3V0cHV0VXJsKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IHJlc291cmNlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBjb25zdCBwcm9jZXNzZWQgPSBTeW1ib2woJ3Bvc3Rjc3MtY2xpLXJlc291cmNlcycpO1xuXG4gIHJldHVybiB7XG4gICAgcG9zdGNzc1BsdWdpbjogJ3Bvc3Rjc3MtY2xpLXJlc291cmNlcycsXG4gICAgYXN5bmMgRGVjbGFyYXRpb24oZGVjbCkge1xuICAgICAgaWYgKCFkZWNsLnZhbHVlLmluY2x1ZGVzKCd1cmwnKSB8fCBwcm9jZXNzZWQgaW4gZGVjbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gZGVjbC52YWx1ZTtcbiAgICAgIGNvbnN0IHVybFJlZ2V4ID0gL3VybFxcKFxccyooPzpcIihbXlwiXSspXCJ8JyhbXiddKyknfCguKz8pKVxccypcXCkvZztcbiAgICAgIGNvbnN0IHNlZ21lbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBsZXQgbWF0Y2g7XG4gICAgICBsZXQgbGFzdEluZGV4ID0gMDtcbiAgICAgIGxldCBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgICAvLyBXZSB3YW50IHRvIGxvYWQgaXQgcmVsYXRpdmUgdG8gdGhlIGZpbGUgdGhhdCBpbXBvcnRzXG4gICAgICBjb25zdCBpbnB1dEZpbGUgPSBkZWNsLnNvdXJjZSAmJiBkZWNsLnNvdXJjZS5pbnB1dC5maWxlO1xuICAgICAgY29uc3QgY29udGV4dCA9IChpbnB1dEZpbGUgJiYgcGF0aC5kaXJuYW1lKGlucHV0RmlsZSkpIHx8IGxvYWRlci5jb250ZXh0O1xuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uZC1hc3NpZ25cbiAgICAgIHdoaWxlICgobWF0Y2ggPSB1cmxSZWdleC5leGVjKHZhbHVlKSkpIHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxVcmwgPSBtYXRjaFsxXSB8fCBtYXRjaFsyXSB8fCBtYXRjaFszXTtcbiAgICAgICAgbGV0IHByb2Nlc3NlZFVybDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBwcm9jZXNzZWRVcmwgPSBhd2FpdCBwcm9jZXNzKG9yaWdpbmFsVXJsLCBjb250ZXh0LCByZXNvdXJjZUNhY2hlKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgbG9hZGVyLmVtaXRFcnJvcihkZWNsLmVycm9yKGVyci5tZXNzYWdlLCB7IHdvcmQ6IG9yaWdpbmFsVXJsIH0pKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SW5kZXggPCBtYXRjaC5pbmRleCkge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2godmFsdWUuc2xpY2UobGFzdEluZGV4LCBtYXRjaC5pbmRleCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFwcm9jZXNzZWRVcmwgfHwgb3JpZ2luYWxVcmwgPT09IHByb2Nlc3NlZFVybCkge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2gobWF0Y2hbMF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2god3JhcFVybChwcm9jZXNzZWRVcmwpKTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKGxhc3RJbmRleCA8IHZhbHVlLmxlbmd0aCkge1xuICAgICAgICBzZWdtZW50cy5wdXNoKHZhbHVlLnNsaWNlKGxhc3RJbmRleCkpO1xuICAgICAgfVxuXG4gICAgICBpZiAobW9kaWZpZWQpIHtcbiAgICAgICAgZGVjbC52YWx1ZSA9IHNlZ21lbnRzLmpvaW4oJycpO1xuICAgICAgfVxuXG4gICAgICAoZGVjbCBhcyBEZWNsYXJhdGlvbiAmIHsgW3Byb2Nlc3NlZF06IGJvb2xlYW4gfSlbcHJvY2Vzc2VkXSA9IHRydWU7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==