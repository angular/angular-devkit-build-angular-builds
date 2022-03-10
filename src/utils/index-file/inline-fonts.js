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
exports.InlineFontsProcessor = void 0;
const cacache = __importStar(require("cacache"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
const path_1 = require("path");
const url_1 = require("url");
const package_version_1 = require("../package-version");
const html_rewriting_stream_1 = require("./html-rewriting-stream");
const SUPPORTED_PROVIDERS = {
    'fonts.googleapis.com': {
        preconnectUrl: 'https://fonts.gstatic.com',
    },
    'use.typekit.net': {
        preconnectUrl: 'https://use.typekit.net',
    },
};
class InlineFontsProcessor {
    constructor(options) {
        this.options = options;
        const { path: cacheDirectory, enabled } = this.options.cache || {};
        if (cacheDirectory && enabled) {
            this.cachePath = (0, path_1.join)(cacheDirectory, 'angular-build-fonts');
        }
    }
    async process(content) {
        var _a;
        const hrefList = [];
        const existingPreconnect = new Set();
        // Collector link tags with href
        const { rewriter: collectorStream } = await (0, html_rewriting_stream_1.htmlRewritingStream)(content);
        collectorStream.on('startTag', (tag) => {
            const { tagName, attrs } = tag;
            if (tagName !== 'link') {
                return;
            }
            let hrefValue;
            let relValue;
            for (const { name, value } of attrs) {
                switch (name) {
                    case 'rel':
                        relValue = value;
                        break;
                    case 'href':
                        hrefValue = value;
                        break;
                }
                if (hrefValue && relValue) {
                    switch (relValue) {
                        case 'stylesheet':
                            // <link rel="stylesheet" href="https://example.com/main.css">
                            hrefList.push(hrefValue);
                            break;
                        case 'preconnect':
                            // <link rel="preconnect" href="https://example.com">
                            existingPreconnect.add(hrefValue.replace(/\/$/, ''));
                            break;
                    }
                    return;
                }
            }
        });
        await new Promise((resolve) => collectorStream.on('finish', resolve));
        // Download stylesheets
        const hrefsContent = new Map();
        const newPreconnectUrls = new Set();
        for (const hrefItem of hrefList) {
            const url = this.createNormalizedUrl(hrefItem);
            if (!url) {
                continue;
            }
            const content = await this.processHref(url);
            if (content === undefined) {
                continue;
            }
            hrefsContent.set(hrefItem, content);
            // Add preconnect
            const preconnectUrl = (_a = this.getFontProviderDetails(url)) === null || _a === void 0 ? void 0 : _a.preconnectUrl;
            if (preconnectUrl && !existingPreconnect.has(preconnectUrl)) {
                newPreconnectUrls.add(preconnectUrl);
            }
        }
        if (hrefsContent.size === 0) {
            return content;
        }
        // Replace link with style tag.
        const { rewriter, transformedContent } = await (0, html_rewriting_stream_1.htmlRewritingStream)(content);
        rewriter.on('startTag', (tag) => {
            const { tagName, attrs } = tag;
            switch (tagName) {
                case 'head':
                    rewriter.emitStartTag(tag);
                    for (const url of newPreconnectUrls) {
                        rewriter.emitRaw(`<link rel="preconnect" href="${url}" crossorigin>`);
                    }
                    break;
                case 'link':
                    const hrefAttr = attrs.some(({ name, value }) => name === 'rel' && value === 'stylesheet') &&
                        attrs.find(({ name, value }) => name === 'href' && hrefsContent.has(value));
                    if (hrefAttr) {
                        const href = hrefAttr.value;
                        const cssContent = hrefsContent.get(href);
                        rewriter.emitRaw(`<style type="text/css">${cssContent}</style>`);
                    }
                    else {
                        rewriter.emitStartTag(tag);
                    }
                    break;
                default:
                    rewriter.emitStartTag(tag);
                    break;
            }
        });
        return transformedContent;
    }
    async getResponse(url) {
        var _a;
        const key = `${package_version_1.VERSION}|${url}`;
        if (this.cachePath) {
            const entry = await cacache.get.info(this.cachePath, key);
            if (entry) {
                return fs.promises.readFile(entry.path, 'utf8');
            }
        }
        let agent;
        const httpsProxy = (_a = process.env.HTTPS_PROXY) !== null && _a !== void 0 ? _a : process.env.https_proxy;
        if (httpsProxy) {
            agent = (0, https_proxy_agent_1.default)(httpsProxy);
        }
        const data = await new Promise((resolve, reject) => {
            let rawResponse = '';
            https
                .get(url, {
                agent,
                rejectUnauthorized: false,
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
                },
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Inlining of fonts failed. ${url} returned status code: ${res.statusCode}.`));
                    return;
                }
                res.on('data', (chunk) => (rawResponse += chunk)).on('end', () => resolve(rawResponse));
            })
                .on('error', (e) => reject(new Error(`Inlining of fonts failed. An error has occurred while retrieving ${url} over the internet.\n` +
                e.message)));
        });
        if (this.cachePath) {
            await cacache.put(this.cachePath, key, data);
        }
        return data;
    }
    async processHref(url) {
        const provider = this.getFontProviderDetails(url);
        if (!provider) {
            return undefined;
        }
        let cssContent = await this.getResponse(url);
        if (this.options.minify) {
            cssContent = cssContent
                // Comments.
                .replace(/\/\*([\s\S]*?)\*\//g, '')
                // New lines.
                .replace(/\n/g, '')
                // Safe spaces.
                .replace(/\s?[{:;]\s+/g, (s) => s.trim());
        }
        return cssContent;
    }
    getFontProviderDetails(url) {
        return SUPPORTED_PROVIDERS[url.hostname];
    }
    createNormalizedUrl(value) {
        // Need to convert '//' to 'https://' because the URL parser will fail with '//'.
        const normalizedHref = value.startsWith('//') ? `https:${value}` : value;
        if (!normalizedHref.startsWith('http')) {
            // Non valid URL.
            // Example: relative path styles.css.
            return undefined;
        }
        const url = new url_1.URL(normalizedHref);
        // Force HTTPS protocol
        url.protocol = 'https:';
        return url;
    }
}
exports.InlineFontsProcessor = InlineFontsProcessor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLWZvbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtZm9udHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsdUNBQXlCO0FBQ3pCLDZDQUErQjtBQUMvQiwwRUFBMkM7QUFDM0MsK0JBQTRCO0FBQzVCLDZCQUEwQjtBQUUxQix3REFBNkM7QUFDN0MsbUVBQThEO0FBVzlELE1BQU0sbUJBQW1CLEdBQXdDO0lBQy9ELHNCQUFzQixFQUFFO1FBQ3RCLGFBQWEsRUFBRSwyQkFBMkI7S0FDM0M7SUFDRCxpQkFBaUIsRUFBRTtRQUNqQixhQUFhLEVBQUUseUJBQXlCO0tBQ3pDO0NBQ0YsQ0FBQztBQUVGLE1BQWEsb0JBQW9CO0lBRS9CLFlBQW9CLE9BQTJCO1FBQTNCLFlBQU8sR0FBUCxPQUFPLENBQW9CO1FBQzdDLE1BQU0sRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUNuRSxJQUFJLGNBQWMsSUFBSSxPQUFPLEVBQUU7WUFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFBLFdBQUksRUFBQyxjQUFjLEVBQUUscUJBQXFCLENBQUMsQ0FBQztTQUM5RDtJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQWU7O1FBQzNCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUM5QixNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFFN0MsZ0NBQWdDO1FBQ2hDLE1BQU0sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLEdBQUcsTUFBTSxJ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QUFjLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3RDLGlCQUFpQjtZQUNqQixxQ0FBcUM7WUFDckMsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLFNBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNwQyx1QkFBdUI7UUFDdkIsR0FBRyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFFeEIsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0NBQ0Y7QUE3TkQsb0RBNk5DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNhY2FjaGUgZnJvbSAnY2FjYWNoZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBodHRwcyBmcm9tICdodHRwcyc7XG5pbXBvcnQgcHJveHlBZ2VudCBmcm9tICdodHRwcy1wcm94eS1hZ2VudCc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgTm9ybWFsaXplZENhY2hlZE9wdGlvbnMgfSBmcm9tICcuLi9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4uL3BhY2thZ2UtdmVyc2lvbic7XG5pbXBvcnQgeyBodG1sUmV3cml0aW5nU3RyZWFtIH0gZnJvbSAnLi9odG1sLXJld3JpdGluZy1zdHJlYW0nO1xuXG5pbnRlcmZhY2UgRm9udFByb3ZpZGVyRGV0YWlscyB7XG4gIHByZWNvbm5lY3RVcmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVGb250c09wdGlvbnMge1xuICBtaW5pZnk/OiBib29sZWFuO1xuICBjYWNoZT86IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zO1xufVxuXG5jb25zdCBTVVBQT1JURURfUFJPVklERVJTOiBSZWNvcmQ8c3RyaW5nLCBGb250UHJvdmlkZXJEZXRhaWxzPiA9IHtcbiAgJ2ZvbnRzLmdvb2dsZWFwaXMuY29tJzoge1xuICAgIHByZWNvbm5lY3RVcmw6ICdodHRwczovL2ZvbnRzLmdzdGF0aWMuY29tJyxcbiAgfSxcbiAgJ3VzZS50eXBla2l0Lm5ldCc6IHtcbiAgICBwcmVjb25uZWN0VXJsOiAnaHR0cHM6Ly91c2UudHlwZWtpdC5uZXQnLFxuICB9LFxufTtcblxuZXhwb3J0IGNsYXNzIElubGluZUZvbnRzUHJvY2Vzc29yIHtcbiAgcHJpdmF0ZSByZWFkb25seSBjYWNoZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvcHRpb25zOiBJbmxpbmVGb250c09wdGlvbnMpIHtcbiAgICBjb25zdCB7IHBhdGg6IGNhY2hlRGlyZWN0b3J5LCBlbmFibGVkIH0gPSB0aGlzLm9wdGlvbnMuY2FjaGUgfHwge307XG4gICAgaWYgKGNhY2hlRGlyZWN0b3J5ICYmIGVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY2FjaGVQYXRoID0gam9pbihjYWNoZURpcmVjdG9yeSwgJ2FuZ3VsYXItYnVpbGQtZm9udHMnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBwcm9jZXNzKGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaHJlZkxpc3Q6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZXhpc3RpbmdQcmVjb25uZWN0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICAvLyBDb2xsZWN0b3IgbGluayB0YWdzIHdpdGggaHJlZlxuICAgIGNvbnN0IHsgcmV3cml0ZXI6IGNvbGxlY3RvclN0cmVhbSB9ID0gYXdhaXQgaHRtbFJld3JpdGluZ1N0cmVhbShjb250ZW50KTtcblxuICAgIGNvbGxlY3RvclN0cmVhbS5vbignc3RhcnRUYWcnLCAodGFnKSA9PiB7XG4gICAgICBjb25zdCB7IHRhZ05hbWUsIGF0dHJzIH0gPSB0YWc7XG5cbiAgICAgIGlmICh0YWdOYW1lICE9PSAnbGluaycpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgaHJlZlZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgcmVsVmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGZvciAoY29uc3QgeyBuYW1lLCB2YWx1ZSB9IG9mIGF0dHJzKSB7XG4gICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgIGNhc2UgJ3JlbCc6XG4gICAgICAgICAgICByZWxWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdocmVmJzpcbiAgICAgICAgICAgIGhyZWZWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaHJlZlZhbHVlICYmIHJlbFZhbHVlKSB7XG4gICAgICAgICAgc3dpdGNoIChyZWxWYWx1ZSkge1xuICAgICAgICAgICAgY2FzZSAnc3R5bGVzaGVldCc6XG4gICAgICAgICAgICAgIC8vIDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiaHR0cHM6Ly9leGFtcGxlLmNvbS9tYWluLmNzc1wiPlxuICAgICAgICAgICAgICBocmVmTGlzdC5wdXNoKGhyZWZWYWx1ZSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdwcmVjb25uZWN0JzpcbiAgICAgICAgICAgICAgLy8gPGxpbmsgcmVsPVwicHJlY29ubmVjdFwiIGhyZWY9XCJodHRwczovL2V4YW1wbGUuY29tXCI+XG4gICAgICAgICAgICAgIGV4aXN0aW5nUHJlY29ubmVjdC5hZGQoaHJlZlZhbHVlLnJlcGxhY2UoL1xcLyQvLCAnJykpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBjb2xsZWN0b3JTdHJlYW0ub24oJ2ZpbmlzaCcsIHJlc29sdmUpKTtcblxuICAgIC8vIERvd25sb2FkIHN0eWxlc2hlZXRzXG4gICAgY29uc3QgaHJlZnNDb250ZW50ID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBjb25zdCBuZXdQcmVjb25uZWN0VXJscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBocmVmSXRlbSBvZiBocmVmTGlzdCkge1xuICAgICAgY29uc3QgdXJsID0gdGhpcy5jcmVhdGVOb3JtYWxpemVkVXJsKGhyZWZJdGVtKTtcbiAgICAgIGlmICghdXJsKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5wcm9jZXNzSHJlZih1cmwpO1xuICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaHJlZnNDb250ZW50LnNldChocmVmSXRlbSwgY29udGVudCk7XG5cbiAgICAgIC8vIEFkZCBwcmVjb25uZWN0XG4gICAgICBjb25zdCBwcmVjb25uZWN0VXJsID0gdGhpcy5nZXRGb250UHJvdmlkZXJEZXRhaWxzKHVybCk/LnByZWNvbm5lY3RVcmw7XG4gICAgICBpZiAocHJlY29ubmVjdFVybCAmJiAhZXhpc3RpbmdQcmVjb25uZWN0LmhhcyhwcmVjb25uZWN0VXJsKSkge1xuICAgICAgICBuZXdQcmVjb25uZWN0VXJscy5hZGQocHJlY29ubmVjdFVybCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGhyZWZzQ29udGVudC5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gY29udGVudDtcbiAgICB9XG5cbiAgICAvLyBSZXBsYWNlIGxpbmsgd2l0aCBzdHlsZSB0YWcuXG4gICAgY29uc3QgeyByZXdyaXRlciwgdHJhbnNmb3JtZWRDb250ZW50IH0gPSBhd2FpdCBodG1sUmV3cml0aW5nU3RyZWFtKGNvbnRlbnQpO1xuICAgIHJld3JpdGVyLm9uKCdzdGFydFRhZycsICh0YWcpID0+IHtcbiAgICAgIGNvbnN0IHsgdGFnTmFtZSwgYXR0cnMgfSA9IHRhZztcblxuICAgICAgc3dpdGNoICh0YWdOYW1lKSB7XG4gICAgICAgIGNhc2UgJ2hlYWQnOlxuICAgICAgICAgIHJld3JpdGVyLmVtaXRTdGFydFRhZyh0YWcpO1xuICAgICAgICAgIGZvciAoY29uc3QgdXJsIG9mIG5ld1ByZWNvbm5lY3RVcmxzKSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0UmF3KGA8bGluayByZWw9XCJwcmVjb25uZWN0XCIgaHJlZj1cIiR7dXJsfVwiIGNyb3Nzb3JpZ2luPmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdsaW5rJzpcbiAgICAgICAgICBjb25zdCBocmVmQXR0ciA9XG4gICAgICAgICAgICBhdHRycy5zb21lKCh7IG5hbWUsIHZhbHVlIH0pID0+IG5hbWUgPT09ICdyZWwnICYmIHZhbHVlID09PSAnc3R5bGVzaGVldCcpICYmXG4gICAgICAgICAgICBhdHRycy5maW5kKCh7IG5hbWUsIHZhbHVlIH0pID0+IG5hbWUgPT09ICdocmVmJyAmJiBocmVmc0NvbnRlbnQuaGFzKHZhbHVlKSk7XG4gICAgICAgICAgaWYgKGhyZWZBdHRyKSB7XG4gICAgICAgICAgICBjb25zdCBocmVmID0gaHJlZkF0dHIudmFsdWU7XG4gICAgICAgICAgICBjb25zdCBjc3NDb250ZW50ID0gaHJlZnNDb250ZW50LmdldChocmVmKTtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcoYDxzdHlsZSB0eXBlPVwidGV4dC9jc3NcIj4ke2Nzc0NvbnRlbnR9PC9zdHlsZT5gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV3cml0ZXIuZW1pdFN0YXJ0VGFnKHRhZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV3cml0ZXIuZW1pdFN0YXJ0VGFnKHRhZyk7XG5cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB0cmFuc2Zvcm1lZENvbnRlbnQ7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGdldFJlc3BvbnNlKHVybDogVVJMKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBrZXkgPSBgJHtWRVJTSU9OfXwke3VybH1gO1xuXG4gICAgaWYgKHRoaXMuY2FjaGVQYXRoKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IGF3YWl0IGNhY2FjaGUuZ2V0LmluZm8odGhpcy5jYWNoZVBhdGgsIGtleSk7XG4gICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnJlYWRGaWxlKGVudHJ5LnBhdGgsICd1dGY4Jyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGFnZW50OiBwcm94eUFnZW50Lkh0dHBzUHJveHlBZ2VudCB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBodHRwc1Byb3h5ID0gcHJvY2Vzcy5lbnYuSFRUUFNfUFJPWFkgPz8gcHJvY2Vzcy5lbnYuaHR0cHNfcHJveHk7XG5cbiAgICBpZiAoaHR0cHNQcm94eSkge1xuICAgICAgYWdlbnQgPSBwcm94eUFnZW50KGh0dHBzUHJveHkpO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByYXdSZXNwb25zZSA9ICcnO1xuICAgICAgaHR0cHNcbiAgICAgICAgLmdldChcbiAgICAgICAgICB1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgYWdlbnQsXG4gICAgICAgICAgICByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAndXNlci1hZ2VudCc6XG4gICAgICAgICAgICAgICAgJ01vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzYpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS84NS4wLjQxODMuMTIxIFNhZmFyaS81MzcuMzYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIChyZXMpID0+IHtcbiAgICAgICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSAhPT0gMjAwKSB7XG4gICAgICAgICAgICAgIHJlamVjdChcbiAgICAgICAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICBgSW5saW5pbmcgb2YgZm9udHMgZmFpbGVkLiAke3VybH0gcmV0dXJuZWQgc3RhdHVzIGNvZGU6ICR7cmVzLnN0YXR1c0NvZGV9LmAsXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlcy5vbignZGF0YScsIChjaHVuaykgPT4gKHJhd1Jlc3BvbnNlICs9IGNodW5rKSkub24oJ2VuZCcsICgpID0+IHJlc29sdmUocmF3UmVzcG9uc2UpKTtcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT5cbiAgICAgICAgICByZWplY3QoXG4gICAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgIGBJbmxpbmluZyBvZiBmb250cyBmYWlsZWQuIEFuIGVycm9yIGhhcyBvY2N1cnJlZCB3aGlsZSByZXRyaWV2aW5nICR7dXJsfSBvdmVyIHRoZSBpbnRlcm5ldC5cXG5gICtcbiAgICAgICAgICAgICAgICBlLm1lc3NhZ2UsXG4gICAgICAgICAgICApLFxuICAgICAgICAgICksXG4gICAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5jYWNoZVBhdGgpIHtcbiAgICAgIGF3YWl0IGNhY2FjaGUucHV0KHRoaXMuY2FjaGVQYXRoLCBrZXksIGRhdGEpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzSHJlZih1cmw6IFVSTCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgcHJvdmlkZXIgPSB0aGlzLmdldEZvbnRQcm92aWRlckRldGFpbHModXJsKTtcbiAgICBpZiAoIXByb3ZpZGVyKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCBjc3NDb250ZW50ID0gYXdhaXQgdGhpcy5nZXRSZXNwb25zZSh1cmwpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5taW5pZnkpIHtcbiAgICAgIGNzc0NvbnRlbnQgPSBjc3NDb250ZW50XG4gICAgICAgIC8vIENvbW1lbnRzLlxuICAgICAgICAucmVwbGFjZSgvXFwvXFwqKFtcXHNcXFNdKj8pXFwqXFwvL2csICcnKVxuICAgICAgICAvLyBOZXcgbGluZXMuXG4gICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJycpXG4gICAgICAgIC8vIFNhZmUgc3BhY2VzLlxuICAgICAgICAucmVwbGFjZSgvXFxzP1t7OjtdXFxzKy9nLCAocykgPT4gcy50cmltKCkpO1xuICAgIH1cblxuICAgIHJldHVybiBjc3NDb250ZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRGb250UHJvdmlkZXJEZXRhaWxzKHVybDogVVJMKTogRm9udFByb3ZpZGVyRGV0YWlscyB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIFNVUFBPUlRFRF9QUk9WSURFUlNbdXJsLmhvc3RuYW1lXTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTm9ybWFsaXplZFVybCh2YWx1ZTogc3RyaW5nKTogVVJMIHwgdW5kZWZpbmVkIHtcbiAgICAvLyBOZWVkIHRvIGNvbnZlcnQgJy8vJyB0byAnaHR0cHM6Ly8nIGJlY2F1c2UgdGhlIFVSTCBwYXJzZXIgd2lsbCBmYWlsIHdpdGggJy8vJy5cbiAgICBjb25zdCBub3JtYWxpemVkSHJlZiA9IHZhbHVlLnN0YXJ0c1dpdGgoJy8vJykgPyBgaHR0cHM6JHt2YWx1ZX1gIDogdmFsdWU7XG4gICAgaWYgKCFub3JtYWxpemVkSHJlZi5zdGFydHNXaXRoKCdodHRwJykpIHtcbiAgICAgIC8vIE5vbiB2YWxpZCBVUkwuXG4gICAgICAvLyBFeGFtcGxlOiByZWxhdGl2ZSBwYXRoIHN0eWxlcy5jc3MuXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwobm9ybWFsaXplZEhyZWYpO1xuICAgIC8vIEZvcmNlIEhUVFBTIHByb3RvY29sXG4gICAgdXJsLnByb3RvY29sID0gJ2h0dHBzOic7XG5cbiAgICByZXR1cm4gdXJsO1xuICB9XG59XG4iXX0=