"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineCriticalCssProcessor = void 0;
const promises_1 = require("node:fs/promises");
class InlineCriticalCssProcessor {
    options;
    constructor(options) {
        this.options = options;
    }
    async process(html) {
        const warnings = [];
        const errors = [];
        const { outputPath, deployUrl, minify = false, readAsset } = this.options;
        const { default: Beasties } = await Promise.resolve().then(() => __importStar(require('beasties')));
        const beasties = new Beasties({
            logger: {
                warn: (s) => warnings.push(s),
                error: (s) => errors.push(s),
                info: () => { },
            },
            logLevel: 'warn',
            path: outputPath,
            publicPath: deployUrl,
            compress: minify,
            pruneSource: false,
            reduceInlineStyles: false,
            mergeStylesheets: false,
            preload: 'media-script',
            nonce: (document) => {
                const nonceElement = document.querySelector('[ngCspNonce], [ngcspnonce]');
                const cspNonce = nonceElement?.getAttribute('ngCspNonce') || nonceElement?.getAttribute('ngcspnonce');
                return cspNonce ?? undefined;
            },
            noscriptFallback: true,
            inlineFonts: true,
        });
        beasties.readFile = (path) => {
            return readAsset ? readAsset(path) : (0, promises_1.readFile)(path, 'utf-8');
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const beastiesInternal = beasties;
        const initialEmbedLinkedStylesheet = beastiesInternal.embedLinkedStylesheet.bind(beastiesInternal);
        beastiesInternal.embedLinkedStylesheet = async (link, document) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const linkEl = link;
            const beastiesMedia = linkEl.getAttribute('data-beasties-media');
            if (beastiesMedia) {
                linkEl.removeAttribute('data-beasties-media');
                linkEl.setAttribute('media', beastiesMedia);
                if (linkEl.next?.name === 'noscript') {
                    linkEl.next.remove?.();
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                document.querySelectorAll('script').forEach((script) => {
                    if (script.textContent?.includes('data-beasties-media')) {
                        script.remove?.();
                    }
                });
            }
            return initialEmbedLinkedStylesheet(link, document);
        };
        const content = await beasties.process(html);
        return {
            // Clean up value from value less attributes.
            // This is caused because parse5 always requires attributes to have a string value.
            // nomodule="" defer="" -> nomodule defer.
            content: content.replace(/(\s(?:defer|nomodule))=""/g, '$1'),
            errors,
            warnings,
        };
    }
}
exports.InlineCriticalCssProcessor = InlineCriticalCssProcessor;
//# sourceMappingURL=inline-critical-css.js.map