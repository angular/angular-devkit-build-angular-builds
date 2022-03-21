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
            return inputUrl.slice(1);
        }
        const cacheKey = path.resolve(context, inputUrl);
        const cachedUrl = resourceCache.get(cacheKey);
        if (cachedUrl) {
            return cachedUrl;
        }
        if (inputUrl.startsWith('~')) {
            inputUrl = inputUrl.slice(1);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGNzcy1jbGktcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILCtDQUErQztBQUMvQywyQ0FBNkI7QUFFN0IseUNBQTJCO0FBRTNCLFNBQVMsT0FBTyxDQUFDLEdBQVc7SUFDMUIsSUFBSSxVQUFVLENBQUM7SUFDZixNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUU5QyxJQUFJLGVBQWUsRUFBRTtRQUNuQixVQUFVLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQztLQUN6QjtTQUFNO1FBQ0wsVUFBVSxHQUFHLElBQUksR0FBRyxHQUFHLENBQUM7S0FDekI7SUFFRCxPQUFPLE9BQU8sVUFBVSxHQUFHLENBQUM7QUFDOUIsQ0FBQztBQWNELEtBQUssVUFBVSxPQUFPLENBQ3BCLElBQVksRUFDWixJQUFZLEVBQ1osUUFBeUQ7SUFFekQsSUFBSTtRQUNGLE9BQU8sTUFBTSxRQUFRLENBQUMsSUFBSSxHQUFHLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztLQUMxQztJQUFDLFdBQU07UUFDTixPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDN0I7QUFDSCxDQUFDO0FBRVksUUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBRTVCLG1CQUF5QixPQUFvQztJQUMzRCxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO0tBQzFFO0lBRUQsTUFBTSxFQUNKLFNBQVMsR0FBRyxF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b0JBQ2pELFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ3pCO3FCQUFNO29CQUNMLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7b0JBQ3JDLFFBQVEsR0FBRyxJQUFJLENBQUM7aUJBQ2pCO2dCQUVELFNBQVMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7YUFDM0M7WUFFRCxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFO2dCQUM1QixRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzthQUN2QztZQUVELElBQUksUUFBUSxFQUFFO2dCQUNaLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNoQztZQUVBLElBQStDLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3JFLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXZKRCw0QkF1SkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgaW50ZXJwb2xhdGVOYW1lIH0gZnJvbSAnbG9hZGVyLXV0aWxzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBEZWNsYXJhdGlvbiwgUGx1Z2luIH0gZnJvbSAncG9zdGNzcyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcblxuZnVuY3Rpb24gd3JhcFVybCh1cmw6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCB3cmFwcGVkVXJsO1xuICBjb25zdCBoYXNTaW5nbGVRdW90ZXMgPSB1cmwuaW5kZXhPZihcIidcIikgPj0gMDtcblxuICBpZiAoaGFzU2luZ2xlUXVvdGVzKSB7XG4gICAgd3JhcHBlZFVybCA9IGBcIiR7dXJsfVwiYDtcbiAgfSBlbHNlIHtcbiAgICB3cmFwcGVkVXJsID0gYCcke3VybH0nYDtcbiAgfVxuXG4gIHJldHVybiBgdXJsKCR7d3JhcHBlZFVybH0pYDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQb3N0Y3NzQ2xpUmVzb3VyY2VzT3B0aW9ucyB7XG4gIGJhc2VIcmVmPzogc3RyaW5nO1xuICBkZXBsb3lVcmw/OiBzdHJpbmc7XG4gIHJlc291cmNlc091dHB1dFBhdGg/OiBzdHJpbmc7XG4gIHJlYmFzZVJvb3RSZWxhdGl2ZT86IGJvb2xlYW47XG4gIC8qKiBDU1MgaXMgZXh0cmFjdGVkIHRvIGEgYC5jc3NgIG9yIGlzIGVtYmVkZGVkIGluIGEgYC5qc2AgZmlsZS4gKi9cbiAgZXh0cmFjdGVkPzogYm9vbGVhbjtcbiAgZmlsZW5hbWU6IChyZXNvdXJjZVBhdGg6IHN0cmluZykgPT4gc3RyaW5nO1xuICBsb2FkZXI6IGltcG9ydCgnd2VicGFjaycpLkxvYWRlckNvbnRleHQ8dW5rbm93bj47XG4gIGVtaXRGaWxlOiBib29sZWFuO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlKFxuICBmaWxlOiBzdHJpbmcsXG4gIGJhc2U6IHN0cmluZyxcbiAgcmVzb2x2ZXI6IChmaWxlOiBzdHJpbmcsIGJhc2U6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVzb2x2ZXIoJy4vJyArIGZpbGUsIGJhc2UpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIoZmlsZSwgYmFzZSk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHBvc3Rjc3MgPSB0cnVlO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAob3B0aW9ucz86IFBvc3Rjc3NDbGlSZXNvdXJjZXNPcHRpb25zKTogUGx1Z2luIHtcbiAgaWYgKCFvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdObyBvcHRpb25zIHdlcmUgc3BlY2lmaWVkIHRvIFwicG9zdGNzcy1jbGktcmVzb3VyY2VzXCIuJyk7XG4gIH1cblxuICBjb25zdCB7XG4gICAgZGVwbG95VXJsID0gJycsXG4gICAgcmVzb3VyY2VzT3V0cHV0UGF0aCA9ICcnLFxuICAgIGZpbGVuYW1lLFxuICAgIGxvYWRlcixcbiAgICBlbWl0RmlsZSxcbiAgICBleHRyYWN0ZWQsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IHByb2Nlc3MgPSBhc3luYyAoaW5wdXRVcmw6IHN0cmluZywgY29udGV4dDogc3RyaW5nLCByZXNvdXJjZUNhY2hlOiBNYXA8c3RyaW5nLCBzdHJpbmc+KSA9PiB7XG4gICAgLy8gSWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsLCBsZWF2ZSBhcyBpc1xuICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8IykvLnRlc3QoaW5wdXRVcmwpKSB7XG4gICAgICByZXR1cm4gaW5wdXRVcmw7XG4gICAgfVxuXG4gICAgaWYgKC9eXFwvLy50ZXN0KGlucHV0VXJsKSkge1xuICAgICAgcmV0dXJuIGlucHV0VXJsO1xuICAgIH1cblxuICAgIC8vIElmIHN0YXJ0cyB3aXRoIGEgY2FyZXQsIHJlbW92ZSBhbmQgcmV0dXJuIHJlbWFpbmRlclxuICAgIC8vIHRoaXMgc3VwcG9ydHMgYnlwYXNzaW5nIGFzc2V0IHByb2Nlc3NpbmdcbiAgICBpZiAoaW5wdXRVcmwuc3RhcnRzV2l0aCgnXicpKSB7XG4gICAgICByZXR1cm4gaW5wdXRVcmwuc2xpY2UoMSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVLZXkgPSBwYXRoLnJlc29sdmUoY29udGV4dCwgaW5wdXRVcmwpO1xuICAgIGNvbnN0IGNhY2hlZFVybCA9IHJlc291cmNlQ2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICBpZiAoY2FjaGVkVXJsKSB7XG4gICAgICByZXR1cm4gY2FjaGVkVXJsO1xuICAgIH1cblxuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgIGlucHV0VXJsID0gaW5wdXRVcmwuc2xpY2UoMSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBwYXRobmFtZSwgaGFzaCwgc2VhcmNoIH0gPSB1cmwucGFyc2UoaW5wdXRVcmwucmVwbGFjZSgvXFxcXC9nLCAnLycpKTtcbiAgICBjb25zdCByZXNvbHZlciA9IChmaWxlOiBzdHJpbmcsIGJhc2U6IHN0cmluZykgPT5cbiAgICAgIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsb2FkZXIucmVzb2x2ZShiYXNlLCBkZWNvZGVVUkkoZmlsZSksIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc29sdmUocmVzdWx0IGFzIHN0cmluZyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNvbHZlKHBhdGhuYW1lIGFzIHN0cmluZywgY29udGV4dCwgcmVzb2x2ZXIpO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKHJlc3VsdCwgKGVyciwgY29udGVudCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgb3V0cHV0UGF0aCA9IGludGVycG9sYXRlTmFtZSh7IHJlc291cmNlUGF0aDogcmVzdWx0IH0sIGZpbGVuYW1lKHJlc3VsdCksIHtcbiAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgIGNvbnRleHQ6IGxvYWRlci5jb250ZXh0IHx8IGxvYWRlci5yb290Q29udGV4dCxcbiAgICAgICAgfSkucmVwbGFjZSgvXFxcXHxcXC8vZywgJy0nKTtcblxuICAgICAgICBpZiAocmVzb3VyY2VzT3V0cHV0UGF0aCkge1xuICAgICAgICAgIG91dHB1dFBhdGggPSBwYXRoLnBvc2l4LmpvaW4ocmVzb3VyY2VzT3V0cHV0UGF0aCwgb3V0cHV0UGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2FkZXIuYWRkRGVwZW5kZW5jeShyZXN1bHQpO1xuICAgICAgICBpZiAoZW1pdEZpbGUpIHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgIGxvYWRlci5lbWl0RmlsZShvdXRwdXRQYXRoLCBjb250ZW50ISwgdW5kZWZpbmVkLCB7IHNvdXJjZUZpbGVuYW1lOiByZXN1bHQgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgb3V0cHV0VXJsID0gb3V0cHV0UGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICAgIGlmIChoYXNoIHx8IHNlYXJjaCkge1xuICAgICAgICAgIG91dHB1dFVybCA9IHVybC5mb3JtYXQoeyBwYXRobmFtZTogb3V0cHV0VXJsLCBoYXNoLCBzZWFyY2ggfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwbG95VXJsICYmICFleHRyYWN0ZWQpIHtcbiAgICAgICAgICBvdXRwdXRVcmwgPSB1cmwucmVzb2x2ZShkZXBsb3lVcmwsIG91dHB1dFVybCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXNvdXJjZUNhY2hlLnNldChjYWNoZUtleSwgb3V0cHV0VXJsKTtcbiAgICAgICAgcmVzb2x2ZShvdXRwdXRVcmwpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgcmVzb3VyY2VDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGNvbnN0IHByb2Nlc3NlZCA9IFN5bWJvbCgncG9zdGNzcy1jbGktcmVzb3VyY2VzJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBwb3N0Y3NzUGx1Z2luOiAncG9zdGNzcy1jbGktcmVzb3VyY2VzJyxcbiAgICBhc3luYyBEZWNsYXJhdGlvbihkZWNsKSB7XG4gICAgICBpZiAoIWRlY2wudmFsdWUuaW5jbHVkZXMoJ3VybCcpIHx8IHByb2Nlc3NlZCBpbiBkZWNsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSBkZWNsLnZhbHVlO1xuICAgICAgY29uc3QgdXJsUmVnZXggPSAvdXJsXFwoXFxzKig/OlwiKFteXCJdKylcInwnKFteJ10rKSd8KC4rPykpXFxzKlxcKS9nO1xuICAgICAgY29uc3Qgc2VnbWVudHM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIGxldCBtYXRjaDtcbiAgICAgIGxldCBsYXN0SW5kZXggPSAwO1xuICAgICAgbGV0IG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICAgIC8vIFdlIHdhbnQgdG8gbG9hZCBpdCByZWxhdGl2ZSB0byB0aGUgZmlsZSB0aGF0IGltcG9ydHNcbiAgICAgIGNvbnN0IGlucHV0RmlsZSA9IGRlY2wuc291cmNlICYmIGRlY2wuc291cmNlLmlucHV0LmZpbGU7XG4gICAgICBjb25zdCBjb250ZXh0ID0gKGlucHV0RmlsZSAmJiBwYXRoLmRpcm5hbWUoaW5wdXRGaWxlKSkgfHwgbG9hZGVyLmNvbnRleHQ7XG5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25kLWFzc2lnblxuICAgICAgd2hpbGUgKChtYXRjaCA9IHVybFJlZ2V4LmV4ZWModmFsdWUpKSkge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFVybCA9IG1hdGNoWzFdIHx8IG1hdGNoWzJdIHx8IG1hdGNoWzNdO1xuICAgICAgICBsZXQgcHJvY2Vzc2VkVXJsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHByb2Nlc3NlZFVybCA9IGF3YWl0IHByb2Nlc3Mob3JpZ2luYWxVcmwsIGNvbnRleHQsIHJlc291cmNlQ2FjaGUpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBsb2FkZXIuZW1pdEVycm9yKGRlY2wuZXJyb3IoZXJyLm1lc3NhZ2UsIHsgd29yZDogb3JpZ2luYWxVcmwgfSkpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxhc3RJbmRleCA8IG1hdGNoLmluZGV4KSB7XG4gICAgICAgICAgc2VnbWVudHMucHVzaCh2YWx1ZS5zbGljZShsYXN0SW5kZXgsIG1hdGNoLmluZGV4KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXByb2Nlc3NlZFVybCB8fCBvcmlnaW5hbFVybCA9PT0gcHJvY2Vzc2VkVXJsKSB7XG4gICAgICAgICAgc2VnbWVudHMucHVzaChtYXRjaFswXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VnbWVudHMucHVzaCh3cmFwVXJsKHByb2Nlc3NlZFVybCkpO1xuICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgfVxuXG4gICAgICBpZiAobGFzdEluZGV4IDwgdmFsdWUubGVuZ3RoKSB7XG4gICAgICAgIHNlZ21lbnRzLnB1c2godmFsdWUuc2xpY2UobGFzdEluZGV4KSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtb2RpZmllZCkge1xuICAgICAgICBkZWNsLnZhbHVlID0gc2VnbWVudHMuam9pbignJyk7XG4gICAgICB9XG5cbiAgICAgIChkZWNsIGFzIERlY2xhcmF0aW9uICYgeyBbcHJvY2Vzc2VkXTogYm9vbGVhbiB9KVtwcm9jZXNzZWRdID0gdHJ1ZTtcbiAgICB9LFxuICB9O1xufVxuIl19