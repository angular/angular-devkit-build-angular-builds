"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const loader_utils_1 = require("loader-utils");
const path = require("path");
const postcss = require("postcss");
const url = require("url");
function wrapUrl(url) {
    let wrappedUrl;
    const hasSingleQuotes = url.indexOf('\'') >= 0;
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
exports.default = postcss.plugin('postcss-cli-resources', (options) => {
    const { deployUrl = '', baseHref = '', filename, loader, } = options;
    const dedupeSlashes = (url) => url.replace(/\/\/+/g, '/');
    const process = async (inputUrl, context, resourceCache) => {
        // If root-relative or absolute, leave as is
        if (inputUrl.match(/^(?:\w+:\/\/|data:|chrome:|#)/)) {
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
        if (inputUrl.startsWith('/') && !inputUrl.startsWith('//')) {
            let outputUrl = '';
            if (deployUrl.match(/:\/\//) || deployUrl.startsWith('/')) {
                // If deployUrl is absolute or root relative, ignore baseHref & use deployUrl as is.
                outputUrl = `${deployUrl.replace(/\/$/, '')}${inputUrl}`;
            }
            else if (baseHref.match(/:\/\//)) {
                // If baseHref contains a scheme, include it as is.
                outputUrl = baseHref.replace(/\/$/, '') + dedupeSlashes(`/${deployUrl}/${inputUrl}`);
            }
            else {
                // Join together base-href, deploy-url and the original URL.
                outputUrl = dedupeSlashes(`/${baseHref}/${deployUrl}/${inputUrl}`);
            }
            resourceCache.set(cacheKey, outputUrl);
            return outputUrl;
        }
        const { pathname, hash, search } = url.parse(inputUrl.replace(/\\/g, '/'));
        const resolver = (file, base) => new Promise((resolve, reject) => {
            loader.resolve(base, file, (err, result) => {
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
                const outputPath = loader_utils_1.interpolateName({ resourcePath: result }, filename, { content });
                loader.addDependency(result);
                loader.emitFile(outputPath, content, undefined);
                let outputUrl = outputPath.replace(/\\/g, '/');
                if (hash || search) {
                    outputUrl = url.format({ pathname: outputUrl, hash, search });
                }
                if (deployUrl && loader.loaders[loader.loaderIndex].options.ident !== 'extracted') {
                    outputUrl = url.resolve(deployUrl, outputUrl);
                }
                resourceCache.set(cacheKey, outputUrl);
                resolve(outputUrl);
            });
        });
    };
    return (root) => {
        const urlDeclarations = [];
        root.walkDecls(decl => {
            if (decl.value && decl.value.includes('url')) {
                urlDeclarations.push(decl);
            }
        });
        if (urlDeclarations.length === 0) {
            return;
        }
        const resourceCache = new Map();
        return Promise.all(urlDeclarations.map(async (decl) => {
            const value = decl.value;
            const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*\)/g;
            const segments = [];
            let match;
            let lastIndex = 0;
            let modified = false;
            // We want to load it relative to the file that imports
            const context = path.dirname(decl.source.input.file);
            // tslint:disable-next-line:no-conditional-assignment
            while (match = urlRegex.exec(value)) {
                const originalUrl = match[1] || match[2] || match[3];
                let processedUrl;
                try {
                    processedUrl = await process(originalUrl, context, resourceCache);
                }
                catch (err) {
                    loader.emitError(decl.error(err.message, { word: originalUrl }).toString());
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
        }));
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGNzcy1jbGktcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtDQUErQztBQUMvQyw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLDJCQUEyQjtBQUczQixTQUFTLE9BQU8sQ0FBQyxHQUFXO0lBQzFCLElBQUksVUFBVSxDQUFDO0lBQ2YsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFL0MsSUFBSSxlQUFlLEVBQUU7UUFDbkIsVUFBVSxHQUFHLElBQUksR0FBRyxHQUFHLENBQUM7S0FDekI7U0FBTTtRQUNMLFVBQVUsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDO0tBQ3pCO0lBRUQsT0FBTyxPQUFPLFVBQVUsR0FBRyxDQUFDO0FBQzlCLENBQUM7QUFTRCxLQUFLLFVBQVUsT0FBTyxDQUNwQixJQUFZLEVBQ1osSUFBWSxFQUNaLFFBQXlEO0lBRXpELElBQUk7UUFDRixPQUFPLE1BQU0sUUFBUSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDMUM7SUFBQyxXQUFNO1FBQ04sT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQzdCO0FBQ0gsQ0FBQztBQUVELGtCQUFlLE9BQU8sQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyxPQUFtQyxFQUFFLEVBQUU7SUFDN0YsTUFBTSxFQUNKLFNBQVMsR0FBRyxFQUFFLEVBQ2QsUUFBUSxHQUFHLEVBQUUsRUFDYixRQUFRLEVBQ1IsTUFBTSxHQUNQLEdBQUcsT0FBTyxDQUFDO0lBRVosTUFBTSxhQUFhLEdBQUcs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c291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgaW50ZXJwb2xhdGVOYW1lIH0gZnJvbSAnbG9hZGVyLXV0aWxzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBwb3N0Y3NzIGZyb20gJ3Bvc3Rjc3MnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuXG5mdW5jdGlvbiB3cmFwVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHdyYXBwZWRVcmw7XG4gIGNvbnN0IGhhc1NpbmdsZVF1b3RlcyA9IHVybC5pbmRleE9mKCdcXCcnKSA+PSAwO1xuXG4gIGlmIChoYXNTaW5nbGVRdW90ZXMpIHtcbiAgICB3cmFwcGVkVXJsID0gYFwiJHt1cmx9XCJgO1xuICB9IGVsc2Uge1xuICAgIHdyYXBwZWRVcmwgPSBgJyR7dXJsfSdgO1xuICB9XG5cbiAgcmV0dXJuIGB1cmwoJHt3cmFwcGVkVXJsfSlgO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc3Rjc3NDbGlSZXNvdXJjZXNPcHRpb25zIHtcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbG9hZGVyOiB3ZWJwYWNrLmxvYWRlci5Mb2FkZXJDb250ZXh0O1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlKFxuICBmaWxlOiBzdHJpbmcsXG4gIGJhc2U6IHN0cmluZyxcbiAgcmVzb2x2ZXI6IChmaWxlOiBzdHJpbmcsIGJhc2U6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVzb2x2ZXIoJy4vJyArIGZpbGUsIGJhc2UpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIoZmlsZSwgYmFzZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9zdGNzcy5wbHVnaW4oJ3Bvc3Rjc3MtY2xpLXJlc291cmNlcycsIChvcHRpb25zOiBQb3N0Y3NzQ2xpUmVzb3VyY2VzT3B0aW9ucykgPT4ge1xuICBjb25zdCB7XG4gICAgZGVwbG95VXJsID0gJycsXG4gICAgYmFzZUhyZWYgPSAnJyxcbiAgICBmaWxlbmFtZSxcbiAgICBsb2FkZXIsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGRlZHVwZVNsYXNoZXMgPSAodXJsOiBzdHJpbmcpID0+IHVybC5yZXBsYWNlKC9cXC9cXC8rL2csICcvJyk7XG5cbiAgY29uc3QgcHJvY2VzcyA9IGFzeW5jIChpbnB1dFVybDogc3RyaW5nLCBjb250ZXh0OiBzdHJpbmcsIHJlc291cmNlQ2FjaGU6IE1hcDxzdHJpbmcsIHN0cmluZz4pID0+IHtcbiAgICAvLyBJZiByb290LXJlbGF0aXZlIG9yIGFic29sdXRlLCBsZWF2ZSBhcyBpc1xuICAgIGlmIChpbnB1dFVybC5tYXRjaCgvXig/Olxcdys6XFwvXFwvfGRhdGE6fGNocm9tZTp8IykvKSkge1xuICAgICAgcmV0dXJuIGlucHV0VXJsO1xuICAgIH1cbiAgICAvLyBJZiBzdGFydHMgd2l0aCBhIGNhcmV0LCByZW1vdmUgYW5kIHJldHVybiByZW1haW5kZXJcbiAgICAvLyB0aGlzIHN1cHBvcnRzIGJ5cGFzc2luZyBhc3NldCBwcm9jZXNzaW5nXG4gICAgaWYgKGlucHV0VXJsLnN0YXJ0c1dpdGgoJ14nKSkge1xuICAgICAgcmV0dXJuIGlucHV0VXJsLnN1YnN0cigxKTtcbiAgICB9XG5cbiAgICBjb25zdCBjYWNoZUtleSA9IHBhdGgucmVzb2x2ZShjb250ZXh0LCBpbnB1dFVybCk7XG4gICAgY29uc3QgY2FjaGVkVXJsID0gcmVzb3VyY2VDYWNoZS5nZXQoY2FjaGVLZXkpO1xuICAgIGlmIChjYWNoZWRVcmwpIHtcbiAgICAgIHJldHVybiBjYWNoZWRVcmw7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0VXJsLnN0YXJ0c1dpdGgoJ34nKSkge1xuICAgICAgaW5wdXRVcmwgPSBpbnB1dFVybC5zdWJzdHIoMSk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0VXJsLnN0YXJ0c1dpdGgoJy8nKSAmJiAhaW5wdXRVcmwuc3RhcnRzV2l0aCgnLy8nKSkge1xuICAgICAgbGV0IG91dHB1dFVybCA9ICcnO1xuICAgICAgaWYgKGRlcGxveVVybC5tYXRjaCgvOlxcL1xcLy8pIHx8IGRlcGxveVVybC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgLy8gSWYgZGVwbG95VXJsIGlzIGFic29sdXRlIG9yIHJvb3QgcmVsYXRpdmUsIGlnbm9yZSBiYXNlSHJlZiAmIHVzZSBkZXBsb3lVcmwgYXMgaXMuXG4gICAgICAgIG91dHB1dFVybCA9IGAke2RlcGxveVVybC5yZXBsYWNlKC9cXC8kLywgJycpfSR7aW5wdXRVcmx9YDtcbiAgICAgIH0gZWxzZSBpZiAoYmFzZUhyZWYubWF0Y2goLzpcXC9cXC8vKSkge1xuICAgICAgICAvLyBJZiBiYXNlSHJlZiBjb250YWlucyBhIHNjaGVtZSwgaW5jbHVkZSBpdCBhcyBpcy5cbiAgICAgICAgb3V0cHV0VXJsID0gYmFzZUhyZWYucmVwbGFjZSgvXFwvJC8sICcnKSArIGRlZHVwZVNsYXNoZXMoYC8ke2RlcGxveVVybH0vJHtpbnB1dFVybH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZS1ocmVmLCBkZXBsb3ktdXJsIGFuZCB0aGUgb3JpZ2luYWwgVVJMLlxuICAgICAgICBvdXRwdXRVcmwgPSBkZWR1cGVTbGFzaGVzKGAvJHtiYXNlSHJlZn0vJHtkZXBsb3lVcmx9LyR7aW5wdXRVcmx9YCk7XG4gICAgICB9XG5cbiAgICAgIHJlc291cmNlQ2FjaGUuc2V0KGNhY2hlS2V5LCBvdXRwdXRVcmwpO1xuXG4gICAgICByZXR1cm4gb3V0cHV0VXJsO1xuICAgIH1cblxuICAgIGNvbnN0IHsgcGF0aG5hbWUsIGhhc2gsIHNlYXJjaCB9ID0gdXJsLnBhcnNlKGlucHV0VXJsLnJlcGxhY2UoL1xcXFwvZywgJy8nKSk7XG4gICAgY29uc3QgcmVzb2x2ZXIgPSAoZmlsZTogc3RyaW5nLCBiYXNlOiBzdHJpbmcpID0+IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbG9hZGVyLnJlc29sdmUoYmFzZSwgZmlsZSwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmUocGF0aG5hbWUgYXMgc3RyaW5nLCBjb250ZXh0LCByZXNvbHZlcik7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsb2FkZXIuZnMucmVhZEZpbGUocmVzdWx0LCAoZXJyOiBFcnJvciwgY29udGVudDogQnVmZmVyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG91dHB1dFBhdGggPSBpbnRlcnBvbGF0ZU5hbWUoXG4gICAgICAgICAgeyByZXNvdXJjZVBhdGg6IHJlc3VsdCB9IGFzIHdlYnBhY2subG9hZGVyLkxvYWRlckNvbnRleHQsXG4gICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgeyBjb250ZW50IH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgbG9hZGVyLmFkZERlcGVuZGVuY3kocmVzdWx0KTtcbiAgICAgICAgbG9hZGVyLmVtaXRGaWxlKG91dHB1dFBhdGgsIGNvbnRlbnQsIHVuZGVmaW5lZCk7XG5cbiAgICAgICAgbGV0IG91dHB1dFVybCA9IG91dHB1dFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgICBpZiAoaGFzaCB8fCBzZWFyY2gpIHtcbiAgICAgICAgICBvdXRwdXRVcmwgPSB1cmwuZm9ybWF0KHsgcGF0aG5hbWU6IG91dHB1dFVybCwgaGFzaCwgc2VhcmNoIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlcGxveVVybCAmJiBsb2FkZXIubG9hZGVyc1tsb2FkZXIubG9hZGVySW5kZXhdLm9wdGlvbnMuaWRlbnQgIT09ICdleHRyYWN0ZWQnKSB7XG4gICAgICAgICAgb3V0cHV0VXJsID0gdXJsLnJlc29sdmUoZGVwbG95VXJsLCBvdXRwdXRVcmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb3VyY2VDYWNoZS5zZXQoY2FjaGVLZXksIG91dHB1dFVybCk7XG4gICAgICAgIHJlc29sdmUob3V0cHV0VXJsKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIHJldHVybiAocm9vdCkgPT4ge1xuICAgIGNvbnN0IHVybERlY2xhcmF0aW9uczogQXJyYXk8cG9zdGNzcy5EZWNsYXJhdGlvbj4gPSBbXTtcbiAgICByb290LndhbGtEZWNscyhkZWNsID0+IHtcbiAgICAgIGlmIChkZWNsLnZhbHVlICYmIGRlY2wudmFsdWUuaW5jbHVkZXMoJ3VybCcpKSB7XG4gICAgICAgIHVybERlY2xhcmF0aW9ucy5wdXNoKGRlY2wpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHVybERlY2xhcmF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvdXJjZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICAgIHJldHVybiBQcm9taXNlLmFsbCh1cmxEZWNsYXJhdGlvbnMubWFwKGFzeW5jIGRlY2wgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBkZWNsLnZhbHVlO1xuICAgICAgY29uc3QgdXJsUmVnZXggPSAvdXJsXFwoXFxzKig/OlwiKFteXCJdKylcInwnKFteJ10rKSd8KC4rPykpXFxzKlxcKS9nO1xuICAgICAgY29uc3Qgc2VnbWVudHM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIGxldCBtYXRjaDtcbiAgICAgIGxldCBsYXN0SW5kZXggPSAwO1xuICAgICAgbGV0IG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICAgIC8vIFdlIHdhbnQgdG8gbG9hZCBpdCByZWxhdGl2ZSB0byB0aGUgZmlsZSB0aGF0IGltcG9ydHNcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBwYXRoLmRpcm5hbWUoZGVjbC5zb3VyY2UuaW5wdXQuZmlsZSk7XG5cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1jb25kaXRpb25hbC1hc3NpZ25tZW50XG4gICAgICB3aGlsZSAobWF0Y2ggPSB1cmxSZWdleC5leGVjKHZhbHVlKSkge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFVybCA9IG1hdGNoWzFdIHx8IG1hdGNoWzJdIHx8IG1hdGNoWzNdO1xuICAgICAgICBsZXQgcHJvY2Vzc2VkVXJsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHByb2Nlc3NlZFVybCA9IGF3YWl0IHByb2Nlc3Mob3JpZ2luYWxVcmwsIGNvbnRleHQsIHJlc291cmNlQ2FjaGUpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBsb2FkZXIuZW1pdEVycm9yKGRlY2wuZXJyb3IoZXJyLm1lc3NhZ2UsIHsgd29yZDogb3JpZ2luYWxVcmwgfSkudG9TdHJpbmcoKSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFzdEluZGV4IDwgbWF0Y2guaW5kZXgpIHtcbiAgICAgICAgICBzZWdtZW50cy5wdXNoKHZhbHVlLnNsaWNlKGxhc3RJbmRleCwgbWF0Y2guaW5kZXgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghcHJvY2Vzc2VkVXJsIHx8IG9yaWdpbmFsVXJsID09PSBwcm9jZXNzZWRVcmwpIHtcbiAgICAgICAgICBzZWdtZW50cy5wdXNoKG1hdGNoWzBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWdtZW50cy5wdXNoKHdyYXBVcmwocHJvY2Vzc2VkVXJsKSk7XG4gICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdEluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChsYXN0SW5kZXggPCB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgc2VnbWVudHMucHVzaCh2YWx1ZS5zbGljZShsYXN0SW5kZXgpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1vZGlmaWVkKSB7XG4gICAgICAgIGRlY2wudmFsdWUgPSBzZWdtZW50cy5qb2luKCcnKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gIH07XG59KTtcbiJdfQ==