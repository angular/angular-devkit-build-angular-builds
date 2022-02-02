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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLWZvbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtZm9udHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx1Q0FBeUI7QUFDekIsNkNBQStCO0FBQy9CLDBFQUEyQztBQUMzQywrQkFBNEI7QUFDNUIsNkJBQTBCO0FBRTFCLHdEQUE2QztBQUM3QyxtRUFBOEQ7QUFXOUQsTUFBTSxtQkFBbUIsR0FBd0M7SUFDL0Qsc0JBQXNCLEVBQUU7UUFDdEIsYUFBYSxFQUFFLDJCQUEyQjtLQUMzQztJQUNELGlCQUFpQixFQUFFO1FBQ2pCLGFBQWEsRUFBRSx5QkFBeUI7S0FDekM7Q0FDRixDQUFDO0FBRUYsTUFBYSxvQkFBb0I7SUFFL0IsWUFBb0IsT0FBMkI7UUFBM0IsWUFBTyxHQUFQLE9BQU8sQ0FBb0I7UUFDN0MsTUFBTSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ25FLElBQUksY0FBYyxJQUFJLE9BQU8sRUFBRTtZQUM3QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUEsV0FBSSxFQUFDLGNBQWMsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1NBQzlEO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBZTs7UUFDM0IsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBQzlCLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUU3QyxnQ0FBZ0M7UUFDaEMsTUFBTSxFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUUsR0FBRyxNQUFNLElBQUEs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R0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDekUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDdEMsaUJBQWlCO1lBQ2pCLHFDQUFxQztZQUNyQyxPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELE1BQU0sR0FBRyxHQUFHLElBQUksU0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3BDLHVCQUF1QjtRQUN2QixHQUFHLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUV4QixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7Q0FDRjtBQTdORCxvREE2TkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2FjYWNoZSBmcm9tICdjYWNhY2hlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBwcm94eUFnZW50IGZyb20gJ2h0dHBzLXByb3h5LWFnZW50JztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IFVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucyB9IGZyb20gJy4uL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSAnLi4vcGFja2FnZS12ZXJzaW9uJztcbmltcG9ydCB7IGh0bWxSZXdyaXRpbmdTdHJlYW0gfSBmcm9tICcuL2h0bWwtcmV3cml0aW5nLXN0cmVhbSc7XG5cbmludGVyZmFjZSBGb250UHJvdmlkZXJEZXRhaWxzIHtcbiAgcHJlY29ubmVjdFVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZUZvbnRzT3B0aW9ucyB7XG4gIG1pbmlmeT86IGJvb2xlYW47XG4gIGNhY2hlPzogTm9ybWFsaXplZENhY2hlZE9wdGlvbnM7XG59XG5cbmNvbnN0IFNVUFBPUlRFRF9QUk9WSURFUlM6IFJlY29yZDxzdHJpbmcsIEZvbnRQcm92aWRlckRldGFpbHM+ID0ge1xuICAnZm9udHMuZ29vZ2xlYXBpcy5jb20nOiB7XG4gICAgcHJlY29ubmVjdFVybDogJ2h0dHBzOi8vZm9udHMuZ3N0YXRpYy5jb20nLFxuICB9LFxuICAndXNlLnR5cGVraXQubmV0Jzoge1xuICAgIHByZWNvbm5lY3RVcmw6ICdodHRwczovL3VzZS50eXBla2l0Lm5ldCcsXG4gIH0sXG59O1xuXG5leHBvcnQgY2xhc3MgSW5saW5lRm9udHNQcm9jZXNzb3Ige1xuICBwcml2YXRlIHJlYWRvbmx5IGNhY2hlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG9wdGlvbnM6IElubGluZUZvbnRzT3B0aW9ucykge1xuICAgIGNvbnN0IHsgcGF0aDogY2FjaGVEaXJlY3RvcnksIGVuYWJsZWQgfSA9IHRoaXMub3B0aW9ucy5jYWNoZSB8fCB7fTtcbiAgICBpZiAoY2FjaGVEaXJlY3RvcnkgJiYgZW5hYmxlZCkge1xuICAgICAgdGhpcy5jYWNoZVBhdGggPSBqb2luKGNhY2hlRGlyZWN0b3J5LCAnYW5ndWxhci1idWlsZC1mb250cycpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHByb2Nlc3MoY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBocmVmTGlzdDogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBleGlzdGluZ1ByZWNvbm5lY3QgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIC8vIENvbGxlY3RvciBsaW5rIHRhZ3Mgd2l0aCBocmVmXG4gICAgY29uc3QgeyByZXdyaXRlcjogY29sbGVjdG9yU3RyZWFtIH0gPSBhd2FpdCBodG1sUmV3cml0aW5nU3RyZWFtKGNvbnRlbnQpO1xuXG4gICAgY29sbGVjdG9yU3RyZWFtLm9uKCdzdGFydFRhZycsICh0YWcpID0+IHtcbiAgICAgIGNvbnN0IHsgdGFnTmFtZSwgYXR0cnMgfSA9IHRhZztcblxuICAgICAgaWYgKHRhZ05hbWUgIT09ICdsaW5rJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxldCBocmVmVmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGxldCByZWxWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgZm9yIChjb25zdCB7IG5hbWUsIHZhbHVlIH0gb2YgYXR0cnMpIHtcbiAgICAgICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICAgICAgY2FzZSAncmVsJzpcbiAgICAgICAgICAgIHJlbFZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2hyZWYnOlxuICAgICAgICAgICAgaHJlZlZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChocmVmVmFsdWUgJiYgcmVsVmFsdWUpIHtcbiAgICAgICAgICBzd2l0Y2ggKHJlbFZhbHVlKSB7XG4gICAgICAgICAgICBjYXNlICdzdHlsZXNoZWV0JzpcbiAgICAgICAgICAgICAgLy8gPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCJodHRwczovL2V4YW1wbGUuY29tL21haW4uY3NzXCI+XG4gICAgICAgICAgICAgIGhyZWZMaXN0LnB1c2goaHJlZlZhbHVlKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3ByZWNvbm5lY3QnOlxuICAgICAgICAgICAgICAvLyA8bGluayByZWw9XCJwcmVjb25uZWN0XCIgaHJlZj1cImh0dHBzOi8vZXhhbXBsZS5jb21cIj5cbiAgICAgICAgICAgICAgZXhpc3RpbmdQcmVjb25uZWN0LmFkZChocmVmVmFsdWUucmVwbGFjZSgvXFwvJC8sICcnKSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IGNvbGxlY3RvclN0cmVhbS5vbignZmluaXNoJywgcmVzb2x2ZSkpO1xuXG4gICAgLy8gRG93bmxvYWQgc3R5bGVzaGVldHNcbiAgICBjb25zdCBocmVmc0NvbnRlbnQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IG5ld1ByZWNvbm5lY3RVcmxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGhyZWZJdGVtIG9mIGhyZWZMaXN0KSB7XG4gICAgICBjb25zdCB1cmwgPSB0aGlzLmNyZWF0ZU5vcm1hbGl6ZWRVcmwoaHJlZkl0ZW0pO1xuICAgICAgaWYgKCF1cmwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnByb2Nlc3NIcmVmKHVybCk7XG4gICAgICBpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBocmVmc0NvbnRlbnQuc2V0KGhyZWZJdGVtLCBjb250ZW50KTtcblxuICAgICAgLy8gQWRkIHByZWNvbm5lY3RcbiAgICAgIGNvbnN0IHByZWNvbm5lY3RVcmwgPSB0aGlzLmdldEZvbnRQcm92aWRlckRldGFpbHModXJsKT8ucHJlY29ubmVjdFVybDtcbiAgICAgIGlmIChwcmVjb25uZWN0VXJsICYmICFleGlzdGluZ1ByZWNvbm5lY3QuaGFzKHByZWNvbm5lY3RVcmwpKSB7XG4gICAgICAgIG5ld1ByZWNvbm5lY3RVcmxzLmFkZChwcmVjb25uZWN0VXJsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaHJlZnNDb250ZW50LnNpemUgPT09IDApIHtcbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH1cblxuICAgIC8vIFJlcGxhY2UgbGluayB3aXRoIHN0eWxlIHRhZy5cbiAgICBjb25zdCB7IHJld3JpdGVyLCB0cmFuc2Zvcm1lZENvbnRlbnQgfSA9IGF3YWl0IGh0bWxSZXdyaXRpbmdTdHJlYW0oY29udGVudCk7XG4gICAgcmV3cml0ZXIub24oJ3N0YXJ0VGFnJywgKHRhZykgPT4ge1xuICAgICAgY29uc3QgeyB0YWdOYW1lLCBhdHRycyB9ID0gdGFnO1xuXG4gICAgICBzd2l0Y2ggKHRhZ05hbWUpIHtcbiAgICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICAgICAgcmV3cml0ZXIuZW1pdFN0YXJ0VGFnKHRhZyk7XG4gICAgICAgICAgZm9yIChjb25zdCB1cmwgb2YgbmV3UHJlY29ubmVjdFVybHMpIHtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcoYDxsaW5rIHJlbD1cInByZWNvbm5lY3RcIiBocmVmPVwiJHt1cmx9XCIgY3Jvc3NvcmlnaW4+YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2xpbmsnOlxuICAgICAgICAgIGNvbnN0IGhyZWZBdHRyID1cbiAgICAgICAgICAgIGF0dHJzLnNvbWUoKHsgbmFtZSwgdmFsdWUgfSkgPT4gbmFtZSA9PT0gJ3JlbCcgJiYgdmFsdWUgPT09ICdzdHlsZXNoZWV0JykgJiZcbiAgICAgICAgICAgIGF0dHJzLmZpbmQoKHsgbmFtZSwgdmFsdWUgfSkgPT4gbmFtZSA9PT0gJ2hyZWYnICYmIGhyZWZzQ29udGVudC5oYXModmFsdWUpKTtcbiAgICAgICAgICBpZiAoaHJlZkF0dHIpIHtcbiAgICAgICAgICAgIGNvbnN0IGhyZWYgPSBocmVmQXR0ci52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGNzc0NvbnRlbnQgPSBocmVmc0NvbnRlbnQuZ2V0KGhyZWYpO1xuICAgICAgICAgICAgcmV3cml0ZXIuZW1pdFJhdyhgPHN0eWxlIHR5cGU9XCJ0ZXh0L2Nzc1wiPiR7Y3NzQ29udGVudH08L3N0eWxlPmApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0U3RhcnRUYWcodGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXdyaXRlci5lbWl0U3RhcnRUYWcodGFnKTtcblxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkQ29udGVudDtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZ2V0UmVzcG9uc2UodXJsOiBVUkwpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGtleSA9IGAke1ZFUlNJT059fCR7dXJsfWA7XG5cbiAgICBpZiAodGhpcy5jYWNoZVBhdGgpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gYXdhaXQgY2FjYWNoZS5nZXQuaW5mbyh0aGlzLmNhY2hlUGF0aCwga2V5KTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICByZXR1cm4gZnMucHJvbWlzZXMucmVhZEZpbGUoZW50cnkucGF0aCwgJ3V0ZjgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgYWdlbnQ6IHByb3h5QWdlbnQuSHR0cHNQcm94eUFnZW50IHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGh0dHBzUHJveHkgPSBwcm9jZXNzLmVudi5IVFRQU19QUk9YWSA/PyBwcm9jZXNzLmVudi5odHRwc19wcm94eTtcblxuICAgIGlmIChodHRwc1Byb3h5KSB7XG4gICAgICBhZ2VudCA9IHByb3h5QWdlbnQoaHR0cHNQcm94eSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJhd1Jlc3BvbnNlID0gJyc7XG4gICAgICBodHRwc1xuICAgICAgICAuZ2V0KFxuICAgICAgICAgIHVybCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBhZ2VudCxcbiAgICAgICAgICAgIHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICd1c2VyLWFnZW50JzpcbiAgICAgICAgICAgICAgICAnTW96aWxsYS81LjAgKE1hY2ludG9zaDsgSW50ZWwgTWFjIE9TIFggMTBfMTVfNikgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzg1LjAuNDE4My4xMjEgU2FmYXJpLzUzNy4zNicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgKHJlcykgPT4ge1xuICAgICAgICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlICE9PSAyMDApIHtcbiAgICAgICAgICAgICAgcmVqZWN0KFxuICAgICAgICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAgIGBJbmxpbmluZyBvZiBmb250cyBmYWlsZWQuICR7dXJsfSByZXR1cm5lZCBzdGF0dXMgY29kZTogJHtyZXMuc3RhdHVzQ29kZX0uYCxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzLm9uKCdkYXRhJywgKGNodW5rKSA9PiAocmF3UmVzcG9uc2UgKz0gY2h1bmspKS5vbignZW5kJywgKCkgPT4gcmVzb2x2ZShyYXdSZXNwb25zZSkpO1xuICAgICAgICAgIH0sXG4gICAgICAgIClcbiAgICAgICAgLm9uKCdlcnJvcicsIChlKSA9PlxuICAgICAgICAgIHJlamVjdChcbiAgICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYElubGluaW5nIG9mIGZvbnRzIGZhaWxlZC4gQW4gZXJyb3IgaGFzIG9jY3VycmVkIHdoaWxlIHJldHJpZXZpbmcgJHt1cmx9IG92ZXIgdGhlIGludGVybmV0LlxcbmAgK1xuICAgICAgICAgICAgICAgIGUubWVzc2FnZSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmNhY2hlUGF0aCkge1xuICAgICAgYXdhaXQgY2FjYWNoZS5wdXQodGhpcy5jYWNoZVBhdGgsIGtleSwgZGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NIcmVmKHVybDogVVJMKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBjb25zdCBwcm92aWRlciA9IHRoaXMuZ2V0Rm9udFByb3ZpZGVyRGV0YWlscyh1cmwpO1xuICAgIGlmICghcHJvdmlkZXIpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgbGV0IGNzc0NvbnRlbnQgPSBhd2FpdCB0aGlzLmdldFJlc3BvbnNlKHVybCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm1pbmlmeSkge1xuICAgICAgY3NzQ29udGVudCA9IGNzc0NvbnRlbnRcbiAgICAgICAgLy8gQ29tbWVudHMuXG4gICAgICAgIC5yZXBsYWNlKC9cXC9cXCooW1xcc1xcU10qPylcXCpcXC8vZywgJycpXG4gICAgICAgIC8vIE5ldyBsaW5lcy5cbiAgICAgICAgLnJlcGxhY2UoL1xcbi9nLCAnJylcbiAgICAgICAgLy8gU2FmZSBzcGFjZXMuXG4gICAgICAgIC5yZXBsYWNlKC9cXHM/W3s6O11cXHMrL2csIChzKSA9PiBzLnRyaW0oKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNzc0NvbnRlbnQ7XG4gIH1cblxuICBwcml2YXRlIGdldEZvbnRQcm92aWRlckRldGFpbHModXJsOiBVUkwpOiBGb250UHJvdmlkZXJEZXRhaWxzIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gU1VQUE9SVEVEX1BST1ZJREVSU1t1cmwuaG9zdG5hbWVdO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVOb3JtYWxpemVkVXJsKHZhbHVlOiBzdHJpbmcpOiBVUkwgfCB1bmRlZmluZWQge1xuICAgIC8vIE5lZWQgdG8gY29udmVydCAnLy8nIHRvICdodHRwczovLycgYmVjYXVzZSB0aGUgVVJMIHBhcnNlciB3aWxsIGZhaWwgd2l0aCAnLy8nLlxuICAgIGNvbnN0IG5vcm1hbGl6ZWRIcmVmID0gdmFsdWUuc3RhcnRzV2l0aCgnLy8nKSA/IGBodHRwczoke3ZhbHVlfWAgOiB2YWx1ZTtcbiAgICBpZiAoIW5vcm1hbGl6ZWRIcmVmLnN0YXJ0c1dpdGgoJ2h0dHAnKSkge1xuICAgICAgLy8gTm9uIHZhbGlkIFVSTC5cbiAgICAgIC8vIEV4YW1wbGU6IHJlbGF0aXZlIHBhdGggc3R5bGVzLmNzcy5cbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChub3JtYWxpemVkSHJlZik7XG4gICAgLy8gRm9yY2UgSFRUUFMgcHJvdG9jb2xcbiAgICB1cmwucHJvdG9jb2wgPSAnaHR0cHM6JztcblxuICAgIHJldHVybiB1cmw7XG4gIH1cbn1cbiJdfQ==