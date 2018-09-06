"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const loader_utils_1 = require("loader-utils");
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
function resolve(file, base, resolver) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield resolver('./' + file, base);
        }
        catch (_a) {
            return resolver(file, base);
        }
    });
}
exports.default = postcss.plugin('postcss-cli-resources', (options) => {
    const { deployUrl = '', baseHref = '', filename, loader, } = options;
    const dedupeSlashes = (url) => url.replace(/\/\/+/g, '/');
    const process = (inputUrl, resourceCache) => __awaiter(this, void 0, void 0, function* () {
        // If root-relative or absolute, leave as is
        if (inputUrl.match(/^(?:\w+:\/\/|data:|chrome:|#)/)) {
            return inputUrl;
        }
        // If starts with a caret, remove and return remainder
        // this supports bypassing asset processing
        if (inputUrl.startsWith('^')) {
            return inputUrl.substr(1);
        }
        const cachedUrl = resourceCache.get(inputUrl);
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
            resourceCache.set(inputUrl, outputUrl);
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
        const result = yield resolve(pathname, loader.context, resolver);
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
                resourceCache.set(inputUrl, outputUrl);
                resolve(outputUrl);
            });
        });
    });
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
        return Promise.all(urlDeclarations.map((decl) => __awaiter(this, void 0, void 0, function* () {
            const value = decl.value;
            const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*\)/g;
            const segments = [];
            let match;
            let lastIndex = 0;
            let modified = false;
            // tslint:disable-next-line:no-conditional-assignment
            while (match = urlRegex.exec(value)) {
                const originalUrl = match[1] || match[2] || match[3];
                let processedUrl;
                try {
                    processedUrl = yield process(originalUrl, resourceCache);
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
        })));
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGNzcy1jbGktcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsK0NBQStDO0FBQy9DLG1DQUFtQztBQUNuQywyQkFBMkI7QUFHM0IsU0FBUyxPQUFPLENBQUMsR0FBVztJQUMxQixJQUFJLFVBQVUsQ0FBQztJQUNmLE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRS9DLElBQUksZUFBZSxFQUFFO1FBQ25CLFVBQVUsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDO0tBQ3pCO1NBQU07UUFDTCxVQUFVLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQztLQUN6QjtJQUVELE9BQU8sT0FBTyxVQUFVLEdBQUcsQ0FBQztBQUM5QixDQUFDO0FBU0QsU0FBZSxPQUFPLENBQ3BCLElBQVksRUFDWixJQUFZLEVBQ1osUUFBeUQ7O1FBRXpELElBQUk7WUFDRixPQUFPLE1BQU0sUUFBUSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDMUM7UUFBQyxXQUFNO1lBQ04sT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzdCO0lBQ0gsQ0FBQztDQUFBO0FBRUQsa0JBQWUsT0FBTyxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLE9BQW1DLEVBQUUsRUFBRTtJQUM3RixNQUFNLEVBQ0osU0FBUyxHQUFHLEVBQUUsRUFDZCxRQUFRLEdBQUcsRUFBRSxFQUNiLFFBQVEsRUFDUixNQUFNLEdBQ1AsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLGFBQWEsR0FBRyxDQUFD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QVEsRUFBRSxDQUFDLENBQUM7b0JBQzVFLFNBQVM7aUJBQ1Y7Z0JBRUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRTtvQkFDM0IsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztpQkFDcEQ7Z0JBRUQsSUFBSSxDQUFDLFlBQVksSUFBSSxXQUFXLEtBQUssWUFBWSxFQUFFO29CQUNqRCxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUN6QjtxQkFBTTtvQkFDTCxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUNyQyxRQUFRLEdBQUcsSUFBSSxDQUFDO2lCQUNqQjtnQkFFRCxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2FBQzNDO1lBRUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDNUIsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7YUFDdkM7WUFFRCxJQUFJLFFBQVEsRUFBRTtnQkFDWixJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDaEM7UUFDSCxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IGludGVycG9sYXRlTmFtZSB9IGZyb20gJ2xvYWRlci11dGlscyc7XG5pbXBvcnQgKiBhcyBwb3N0Y3NzIGZyb20gJ3Bvc3Rjc3MnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuXG5mdW5jdGlvbiB3cmFwVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHdyYXBwZWRVcmw7XG4gIGNvbnN0IGhhc1NpbmdsZVF1b3RlcyA9IHVybC5pbmRleE9mKCdcXCcnKSA+PSAwO1xuXG4gIGlmIChoYXNTaW5nbGVRdW90ZXMpIHtcbiAgICB3cmFwcGVkVXJsID0gYFwiJHt1cmx9XCJgO1xuICB9IGVsc2Uge1xuICAgIHdyYXBwZWRVcmwgPSBgJyR7dXJsfSdgO1xuICB9XG5cbiAgcmV0dXJuIGB1cmwoJHt3cmFwcGVkVXJsfSlgO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc3Rjc3NDbGlSZXNvdXJjZXNPcHRpb25zIHtcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbG9hZGVyOiB3ZWJwYWNrLmxvYWRlci5Mb2FkZXJDb250ZXh0O1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlKFxuICBmaWxlOiBzdHJpbmcsXG4gIGJhc2U6IHN0cmluZyxcbiAgcmVzb2x2ZXI6IChmaWxlOiBzdHJpbmcsIGJhc2U6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVzb2x2ZXIoJy4vJyArIGZpbGUsIGJhc2UpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIoZmlsZSwgYmFzZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9zdGNzcy5wbHVnaW4oJ3Bvc3Rjc3MtY2xpLXJlc291cmNlcycsIChvcHRpb25zOiBQb3N0Y3NzQ2xpUmVzb3VyY2VzT3B0aW9ucykgPT4ge1xuICBjb25zdCB7XG4gICAgZGVwbG95VXJsID0gJycsXG4gICAgYmFzZUhyZWYgPSAnJyxcbiAgICBmaWxlbmFtZSxcbiAgICBsb2FkZXIsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGRlZHVwZVNsYXNoZXMgPSAodXJsOiBzdHJpbmcpID0+IHVybC5yZXBsYWNlKC9cXC9cXC8rL2csICcvJyk7XG5cbiAgY29uc3QgcHJvY2VzcyA9IGFzeW5jIChpbnB1dFVybDogc3RyaW5nLCByZXNvdXJjZUNhY2hlOiBNYXA8c3RyaW5nLCBzdHJpbmc+KSA9PiB7XG4gICAgLy8gSWYgcm9vdC1yZWxhdGl2ZSBvciBhYnNvbHV0ZSwgbGVhdmUgYXMgaXNcbiAgICBpZiAoaW5wdXRVcmwubWF0Y2goL14oPzpcXHcrOlxcL1xcL3xkYXRhOnxjaHJvbWU6fCMpLykpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybDtcbiAgICB9XG4gICAgLy8gSWYgc3RhcnRzIHdpdGggYSBjYXJldCwgcmVtb3ZlIGFuZCByZXR1cm4gcmVtYWluZGVyXG4gICAgLy8gdGhpcyBzdXBwb3J0cyBieXBhc3NpbmcgYXNzZXQgcHJvY2Vzc2luZ1xuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCdeJykpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybC5zdWJzdHIoMSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVkVXJsID0gcmVzb3VyY2VDYWNoZS5nZXQoaW5wdXRVcmwpO1xuICAgIGlmIChjYWNoZWRVcmwpIHtcbiAgICAgIHJldHVybiBjYWNoZWRVcmw7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0VXJsLnN0YXJ0c1dpdGgoJ34nKSkge1xuICAgICAgaW5wdXRVcmwgPSBpbnB1dFVybC5zdWJzdHIoMSk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0VXJsLnN0YXJ0c1dpdGgoJy8nKSAmJiAhaW5wdXRVcmwuc3RhcnRzV2l0aCgnLy8nKSkge1xuICAgICAgbGV0IG91dHB1dFVybCA9ICcnO1xuICAgICAgaWYgKGRlcGxveVVybC5tYXRjaCgvOlxcL1xcLy8pIHx8IGRlcGxveVVybC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgLy8gSWYgZGVwbG95VXJsIGlzIGFic29sdXRlIG9yIHJvb3QgcmVsYXRpdmUsIGlnbm9yZSBiYXNlSHJlZiAmIHVzZSBkZXBsb3lVcmwgYXMgaXMuXG4gICAgICAgIG91dHB1dFVybCA9IGAke2RlcGxveVVybC5yZXBsYWNlKC9cXC8kLywgJycpfSR7aW5wdXRVcmx9YDtcbiAgICAgIH0gZWxzZSBpZiAoYmFzZUhyZWYubWF0Y2goLzpcXC9cXC8vKSkge1xuICAgICAgICAvLyBJZiBiYXNlSHJlZiBjb250YWlucyBhIHNjaGVtZSwgaW5jbHVkZSBpdCBhcyBpcy5cbiAgICAgICAgb3V0cHV0VXJsID0gYmFzZUhyZWYucmVwbGFjZSgvXFwvJC8sICcnKSArIGRlZHVwZVNsYXNoZXMoYC8ke2RlcGxveVVybH0vJHtpbnB1dFVybH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZS1ocmVmLCBkZXBsb3ktdXJsIGFuZCB0aGUgb3JpZ2luYWwgVVJMLlxuICAgICAgICBvdXRwdXRVcmwgPSBkZWR1cGVTbGFzaGVzKGAvJHtiYXNlSHJlZn0vJHtkZXBsb3lVcmx9LyR7aW5wdXRVcmx9YCk7XG4gICAgICB9XG5cbiAgICAgIHJlc291cmNlQ2FjaGUuc2V0KGlucHV0VXJsLCBvdXRwdXRVcmwpO1xuXG4gICAgICByZXR1cm4gb3V0cHV0VXJsO1xuICAgIH1cblxuICAgIGNvbnN0IHsgcGF0aG5hbWUsIGhhc2gsIHNlYXJjaCB9ID0gdXJsLnBhcnNlKGlucHV0VXJsLnJlcGxhY2UoL1xcXFwvZywgJy8nKSk7XG4gICAgY29uc3QgcmVzb2x2ZXIgPSAoZmlsZTogc3RyaW5nLCBiYXNlOiBzdHJpbmcpID0+IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbG9hZGVyLnJlc29sdmUoYmFzZSwgZmlsZSwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmUocGF0aG5hbWUgYXMgc3RyaW5nLCBsb2FkZXIuY29udGV4dCwgcmVzb2x2ZXIpO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKHJlc3VsdCwgKGVycjogRXJyb3IsIGNvbnRlbnQ6IEJ1ZmZlcikgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvdXRwdXRQYXRoID0gaW50ZXJwb2xhdGVOYW1lKFxuICAgICAgICAgIHsgcmVzb3VyY2VQYXRoOiByZXN1bHQgfSBhcyB3ZWJwYWNrLmxvYWRlci5Mb2FkZXJDb250ZXh0LFxuICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgIHsgY29udGVudCB9LFxuICAgICAgICApO1xuXG4gICAgICAgIGxvYWRlci5hZGREZXBlbmRlbmN5KHJlc3VsdCk7XG4gICAgICAgIGxvYWRlci5lbWl0RmlsZShvdXRwdXRQYXRoLCBjb250ZW50LCB1bmRlZmluZWQpO1xuXG4gICAgICAgIGxldCBvdXRwdXRVcmwgPSBvdXRwdXRQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgICAgaWYgKGhhc2ggfHwgc2VhcmNoKSB7XG4gICAgICAgICAgb3V0cHV0VXJsID0gdXJsLmZvcm1hdCh7IHBhdGhuYW1lOiBvdXRwdXRVcmwsIGhhc2gsIHNlYXJjaCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXBsb3lVcmwgJiYgbG9hZGVyLmxvYWRlcnNbbG9hZGVyLmxvYWRlckluZGV4XS5vcHRpb25zLmlkZW50ICE9PSAnZXh0cmFjdGVkJykge1xuICAgICAgICAgIG91dHB1dFVybCA9IHVybC5yZXNvbHZlKGRlcGxveVVybCwgb3V0cHV0VXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc291cmNlQ2FjaGUuc2V0KGlucHV0VXJsLCBvdXRwdXRVcmwpO1xuICAgICAgICByZXNvbHZlKG91dHB1dFVybCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gKHJvb3QpID0+IHtcbiAgICBjb25zdCB1cmxEZWNsYXJhdGlvbnM6IEFycmF5PHBvc3Rjc3MuRGVjbGFyYXRpb24+ID0gW107XG4gICAgcm9vdC53YWxrRGVjbHMoZGVjbCA9PiB7XG4gICAgICBpZiAoZGVjbC52YWx1ZSAmJiBkZWNsLnZhbHVlLmluY2x1ZGVzKCd1cmwnKSkge1xuICAgICAgICB1cmxEZWNsYXJhdGlvbnMucHVzaChkZWNsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh1cmxEZWNsYXJhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb3VyY2VDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwodXJsRGVjbGFyYXRpb25zLm1hcChhc3luYyBkZWNsID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gZGVjbC52YWx1ZTtcbiAgICAgIGNvbnN0IHVybFJlZ2V4ID0gL3VybFxcKFxccyooPzpcIihbXlwiXSspXCJ8JyhbXiddKyknfCguKz8pKVxccypcXCkvZztcbiAgICAgIGNvbnN0IHNlZ21lbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBsZXQgbWF0Y2g7XG4gICAgICBsZXQgbGFzdEluZGV4ID0gMDtcbiAgICAgIGxldCBtb2RpZmllZCA9IGZhbHNlO1xuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWNvbmRpdGlvbmFsLWFzc2lnbm1lbnRcbiAgICAgIHdoaWxlIChtYXRjaCA9IHVybFJlZ2V4LmV4ZWModmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVXJsID0gbWF0Y2hbMV0gfHwgbWF0Y2hbMl0gfHwgbWF0Y2hbM107XG4gICAgICAgIGxldCBwcm9jZXNzZWRVcmw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcHJvY2Vzc2VkVXJsID0gYXdhaXQgcHJvY2VzcyhvcmlnaW5hbFVybCwgcmVzb3VyY2VDYWNoZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvYWRlci5lbWl0RXJyb3IoZGVjbC5lcnJvcihlcnIubWVzc2FnZSwgeyB3b3JkOiBvcmlnaW5hbFVybCB9KS50b1N0cmluZygpKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SW5kZXggPCBtYXRjaC5pbmRleCkge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2godmFsdWUuc2xpY2UobGFzdEluZGV4LCBtYXRjaC5pbmRleCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFwcm9jZXNzZWRVcmwgfHwgb3JpZ2luYWxVcmwgPT09IHByb2Nlc3NlZFVybCkge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2gobWF0Y2hbMF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2god3JhcFVybChwcm9jZXNzZWRVcmwpKTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKGxhc3RJbmRleCA8IHZhbHVlLmxlbmd0aCkge1xuICAgICAgICBzZWdtZW50cy5wdXNoKHZhbHVlLnNsaWNlKGxhc3RJbmRleCkpO1xuICAgICAgfVxuXG4gICAgICBpZiAobW9kaWZpZWQpIHtcbiAgICAgICAgZGVjbC52YWx1ZSA9IHNlZ21lbnRzLmpvaW4oJycpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgfTtcbn0pO1xuIl19