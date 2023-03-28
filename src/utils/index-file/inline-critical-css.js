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
exports.InlineCriticalCssProcessor = void 0;
const fs = __importStar(require("fs"));
const Critters = require('critters');
/**
 * Pattern used to extract the media query set by Critters in an `onload` handler.
 */
const MEDIA_SET_HANDLER_PATTERN = /^this\.media=["'](.*)["'];?$/;
/**
 * Name of the attribute used to save the Critters media query so it can be re-assigned on load.
 */
const CSP_MEDIA_ATTR = 'ngCspMedia';
class CrittersExtended extends Critters {
    constructor(optionsExtended) {
        super({
            logger: {
                warn: (s) => this.warnings.push(s),
                error: (s) => this.errors.push(s),
                info: () => { },
            },
            logLevel: 'warn',
            path: optionsExtended.outputPath,
            publicPath: optionsExtended.deployUrl,
            compress: !!optionsExtended.minify,
            pruneSource: false,
            reduceInlineStyles: false,
            mergeStylesheets: false,
            // Note: if `preload` changes to anything other than `media`, the logic in
            // `embedLinkedStylesheetOverride` will have to be updated.
            preload: 'media',
            noscriptFallback: true,
            inlineFonts: true,
        });
        this.optionsExtended = optionsExtended;
        this.warnings = [];
        this.errors = [];
        this.addedCspScriptsDocuments = new WeakSet();
        this.documentNonces = new WeakMap();
        /**
         * Override of the Critters `embedLinkedStylesheet` method
         * that makes it work with Angular's CSP APIs.
         */
        this.embedLinkedStylesheetOverride = async (link, document) => {
            const returnValue = await this.initialEmbedLinkedStylesheet(link, document);
            const cspNonce = this.findCspNonce(document);
            if (cspNonce) {
                const crittersMedia = link.getAttribute('onload')?.match(MEDIA_SET_HANDLER_PATTERN);
                if (crittersMedia) {
                    // If there's a Critters-generated `onload` handler and the file has an Angular CSP nonce,
                    // we have to remove the handler, because it's incompatible with CSP. We save the value
                    // in a different attribute and we generate a script tag with the nonce that uses
                    // `addEventListener` to apply the media query instead.
                    link.removeAttribute('onload');
                    link.setAttribute(CSP_MEDIA_ATTR, crittersMedia[1]);
                    this.conditionallyInsertCspLoadingScript(document, cspNonce);
                }
                // Ideally we would hook in at the time Critters inserts the `style` tags, but there isn't
                // a way of doing that at the moment so we fall back to doing it any time a `link` tag is
                // inserted. We mitigate it by only iterating the direct children of the `<head>` which
                // should be pretty shallow.
                document.head.children.forEach((child) => {
                    if (child.tagName === 'style' && !child.hasAttribute('nonce')) {
                        child.setAttribute('nonce', cspNonce);
                    }
                });
            }
            return returnValue;
        };
        // We can't use inheritance to override `embedLinkedStylesheet`, because it's not declared in
        // the `Critters` .d.ts which means that we can't call the `super` implementation. TS doesn't
        // allow for `super` to be cast to a different type.
        this.initialEmbedLinkedStylesheet = this.embedLinkedStylesheet;
        this.embedLinkedStylesheet = this.embedLinkedStylesheetOverride;
    }
    readFile(path) {
        const readAsset = this.optionsExtended.readAsset;
        return readAsset ? readAsset(path) : fs.promises.readFile(path, 'utf-8');
    }
    /**
     * Finds the CSP nonce for a specific document.
     */
    findCspNonce(document) {
        if (this.documentNonces.has(document)) {
            return this.documentNonces.get(document) ?? null;
        }
        // HTML attribute are case-insensitive, but the parser used by Critters is case-sensitive.
        const nonceElement = document.querySelector('[ngCspNonce], [ngcspnonce]');
        const cspNonce = nonceElement?.getAttribute('ngCspNonce') || nonceElement?.getAttribute('ngcspnonce') || null;
        this.documentNonces.set(document, cspNonce);
        return cspNonce;
    }
    /**
     * Inserts the `script` tag that swaps the critical CSS at runtime,
     * if one hasn't been inserted into the document already.
     */
    conditionallyInsertCspLoadingScript(document, nonce) {
        if (this.addedCspScriptsDocuments.has(document)) {
            return;
        }
        const script = document.createElement('script');
        script.setAttribute('nonce', nonce);
        script.textContent = [
            `(() => {`,
            // Save the `children` in a variable since they're a live DOM node collection.
            // We iterate over the direct descendants, instead of going through a `querySelectorAll`,
            // because we know that the tags will be directly inside the `head`.
            `  const children = document.head.children;`,
            // Declare `onLoad` outside the loop to avoid leaking memory.
            // Can't be an arrow function, because we need `this` to refer to the DOM node.
            `  function onLoad() {this.media = this.getAttribute('${CSP_MEDIA_ATTR}');}`,
            // Has to use a plain for loop, because some browsers don't support
            // `forEach` on `children` which is a `HTMLCollection`.
            `  for (let i = 0; i < children.length; i++) {`,
            `    const child = children[i];`,
            `    child.hasAttribute('${CSP_MEDIA_ATTR}') && child.addEventListener('load', onLoad);`,
            `  }`,
            `})();`,
        ].join('\n');
        // Append the script to the head since it needs to
        // run as early as possible, after the `link` tags.
        document.head.appendChild(script);
        this.addedCspScriptsDocuments.add(document);
    }
}
class InlineCriticalCssProcessor {
    constructor(options) {
        this.options = options;
    }
    async process(html, options) {
        const critters = new CrittersExtended({ ...this.options, ...options });
        const content = await critters.process(html);
        return {
            // Clean up value from value less attributes.
            // This is caused because parse5 always requires attributes to have a string value.
            // nomodule="" defer="" -> nomodule defer.
            content: content.replace(/(\s(?:defer|nomodule))=""/g, '$1'),
            errors: critters.errors,
            warnings: critters.warnings,
        };
    }
}
exports.InlineCriticalCssProcessor = InlineCriticalCssProcessor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLWNyaXRpY2FsLWNzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUV6QixNQUFNLFFBQVEsR0FBc0MsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRXhFOztHQUVHO0FBQ0gsTUFBTSx5QkFBeUIsR0FBRyw4QkFBOEIsQ0FBQztBQUVqRTs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHLFlBQVksQ0FBQztBQXFDcEMsTUFBTSxnQkFBaUIsU0FBUSxRQUFRO0lBVXJDLFlBQ21CLGVBQ2dCO1FBRWpDLEtBQUssQ0FBQztZQUNKLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDMUMsS0FBSyxFQUFFLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDO2FBQ2Y7WUFDRCxRQUFRLEVBQUUsTUFBTTtZQUNoQixJQUFJLEVBQUUsZUFBZSxDQUFDLFVBQVU7WUFDaEMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxTQUFTO1lBQ3JDLFFBQVEsRUFBRSxDQUFDLENBQUMsZUFBZSxDQUFDLE1BQU07WUFDbEMsV0FBVyxFQUFFLEtBQUs7WUFDbEIsa0JBQWtCLEVBQUUsS0FBSztZQUN6QixnQkFBZ0IsRUFBRSxLQUFLO1lBQ3ZCLDBFQUEwRTtZQUMxRSwyREFBMkQ7WUFDM0Qs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QUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN2RSxNQUFNLE9BQU8sR0FBRyxNQUFNLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0MsT0FBTztZQUNMLDZDQUE2QztZQUM3QyxtRkFBbUY7WUFDbkYsMENBQTBDO1lBQzFDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLDRCQUE0QixFQUFFLElBQUksQ0FBQztZQUM1RCxNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU07WUFDdkIsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRO1NBQzVCLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFuQkQsZ0VBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcblxuY29uc3QgQ3JpdHRlcnM6IHR5cGVvZiBpbXBvcnQoJ2NyaXR0ZXJzJykuZGVmYXVsdCA9IHJlcXVpcmUoJ2NyaXR0ZXJzJyk7XG5cbi8qKlxuICogUGF0dGVybiB1c2VkIHRvIGV4dHJhY3QgdGhlIG1lZGlhIHF1ZXJ5IHNldCBieSBDcml0dGVycyBpbiBhbiBgb25sb2FkYCBoYW5kbGVyLlxuICovXG5jb25zdCBNRURJQV9TRVRfSEFORExFUl9QQVRURVJOID0gL150aGlzXFwubWVkaWE9W1wiJ10oLiopW1wiJ107PyQvO1xuXG4vKipcbiAqIE5hbWUgb2YgdGhlIGF0dHJpYnV0ZSB1c2VkIHRvIHNhdmUgdGhlIENyaXR0ZXJzIG1lZGlhIHF1ZXJ5IHNvIGl0IGNhbiBiZSByZS1hc3NpZ25lZCBvbiBsb2FkLlxuICovXG5jb25zdCBDU1BfTUVESUFfQVRUUiA9ICduZ0NzcE1lZGlhJztcblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NPcHRpb25zIHtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yT3B0aW9ucyB7XG4gIG1pbmlmeT86IGJvb2xlYW47XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgcmVhZEFzc2V0PzogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+O1xufVxuXG4vKiogUGFydGlhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBgSFRNTEVsZW1lbnRgLiAqL1xuaW50ZXJmYWNlIFBhcnRpYWxIVE1MRWxlbWVudCB7XG4gIGdldEF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsO1xuICBzZXRBdHRyaWJ1dGUobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogdm9pZDtcbiAgaGFzQXR0cmlidXRlKG5hbWU6IHN0cmluZyk6IGJvb2xlYW47XG4gIHJlbW92ZUF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiB2b2lkO1xuICBhcHBlbmRDaGlsZChjaGlsZDogUGFydGlhbEhUTUxFbGVtZW50KTogdm9pZDtcbiAgdGV4dENvbnRlbnQ6IHN0cmluZztcbiAgdGFnTmFtZTogc3RyaW5nIHwgbnVsbDtcbiAgY2hpbGRyZW46IFBhcnRpYWxIVE1MRWxlbWVudFtdO1xufVxuXG4vKiogUGFydGlhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBIVE1MIGBEb2N1bWVudGAuICovXG5pbnRlcmZhY2UgUGFydGlhbERvY3VtZW50IHtcbiAgaGVhZDogUGFydGlhbEhUTUxFbGVtZW50O1xuICBjcmVhdGVFbGVtZW50KHRhZ05hbWU6IHN0cmluZyk6IFBhcnRpYWxIVE1MRWxlbWVudDtcbiAgcXVlcnlTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nKTogUGFydGlhbEhUTUxFbGVtZW50IHwgbnVsbDtcbn1cblxuLyoqIFNpZ25hdHVyZSBvZiB0aGUgYENyaXR0ZXJzLmVtYmVkTGlua2VkU3R5bGVzaGVldGAgbWV0aG9kLiAqL1xudHlwZSBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbiA9IChcbiAgbGluazogUGFydGlhbEhUTUxFbGVtZW50LFxuICBkb2N1bWVudDogUGFydGlhbERvY3VtZW50LFxuKSA9PiBQcm9taXNlPHVua25vd24+O1xuXG5jbGFzcyBDcml0dGVyc0V4dGVuZGVkIGV4dGVuZHMgQ3JpdHRlcnMge1xuICByZWFkb25seSB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgcmVhZG9ubHkgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluaXRpYWxFbWJlZExpbmtlZFN0eWxlc2hlZXQ6IEVtYmVkTGlua2VkU3R5bGVzaGVldEZuO1xuICBwcml2YXRlIGFkZGVkQ3NwU2NyaXB0c0RvY3VtZW50cyA9IG5ldyBXZWFrU2V0PFBhcnRpYWxEb2N1bWVudD4oKTtcbiAgcHJpdmF0ZSBkb2N1bWVudE5vbmNlcyA9IG5ldyBXZWFrTWFwPFBhcnRpYWxEb2N1bWVudCwgc3RyaW5nIHwgbnVsbD4oKTtcblxuICAvLyBJbmhlcml0ZWQgZnJvbSBgQ3JpdHRlcnNgLCBidXQgbm90IGV4cG9zZWQgaW4gdGhlIHR5cGluZ3MuXG4gIHByb3RlY3RlZCBlbWJlZExpbmtlZFN0eWxlc2hlZXQhOiBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnNFeHRlbmRlZDogSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3JPcHRpb25zICZcbiAgICAgIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc09wdGlvbnMsXG4gICkge1xuICAgIHN1cGVyKHtcbiAgICAgIGxvZ2dlcjoge1xuICAgICAgICB3YXJuOiAoczogc3RyaW5nKSA9PiB0aGlzLndhcm5pbmdzLnB1c2gocyksXG4gICAgICAgIGVycm9yOiAoczogc3RyaW5nKSA9PiB0aGlzLmVycm9ycy5wdXNoKHMpLFxuICAgICAgICBpbmZvOiAoKSA9PiB7fSxcbiAgICAgIH0sXG4gICAgICBsb2dMZXZlbDogJ3dhcm4nLFxuICAgICAgcGF0aDogb3B0aW9uc0V4dGVuZGVkLm91dHB1dFBhdGgsXG4gICAgICBwdWJsaWNQYXRoOiBvcHRpb25zRXh0ZW5kZWQuZGVwbG95VXJsLFxuICAgICAgY29tcHJlc3M6ICEhb3B0aW9uc0V4dGVuZGVkLm1pbmlmeSxcbiAgICAgIHBydW5lU291cmNlOiBmYWxzZSxcbiAgICAgIHJlZHVjZUlubGluZVN0eWxlczogZmFsc2UsXG4gICAgICBtZXJnZVN0eWxlc2hlZXRzOiBmYWxzZSxcbiAgICAgIC8vIE5vdGU6IGlmIGBwcmVsb2FkYCBjaGFuZ2VzIHRvIGFueXRoaW5nIG90aGVyIHRoYW4gYG1lZGlhYCwgdGhlIGxvZ2ljIGluXG4gICAgICAvLyBgZW1iZWRMaW5rZWRTdHlsZXNoZWV0T3ZlcnJpZGVgIHdpbGwgaGF2ZSB0byBiZSB1cGRhdGVkLlxuICAgICAgcHJlbG9hZDogJ21lZGlhJyxcbiAgICAgIG5vc2NyaXB0RmFsbGJhY2s6IHRydWUsXG4gICAgICBpbmxpbmVGb250czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFdlIGNhbid0IHVzZSBpbmhlcml0YW5jZSB0byBvdmVycmlkZSBgZW1iZWRMaW5rZWRTdHlsZXNoZWV0YCwgYmVjYXVzZSBpdCdzIG5vdCBkZWNsYXJlZCBpblxuICAgIC8vIHRoZSBgQ3JpdHRlcnNgIC5kLnRzIHdoaWNoIG1lYW5zIHRoYXQgd2UgY2FuJ3QgY2FsbCB0aGUgYHN1cGVyYCBpbXBsZW1lbnRhdGlvbi4gVFMgZG9lc24ndFxuICAgIC8vIGFsbG93IGZvciBgc3VwZXJgIHRvIGJlIGNhc3QgdG8gYSBkaWZmZXJlbnQgdHlwZS5cbiAgICB0aGlzLmluaXRpYWxFbWJlZExpbmtlZFN0eWxlc2hlZXQgPSB0aGlzLmVtYmVkTGlua2VkU3R5bGVzaGVldDtcbiAgICB0aGlzLmVtYmVkTGlua2VkU3R5bGVzaGVldCA9IHRoaXMuZW1iZWRMaW5rZWRTdHlsZXNoZWV0T3ZlcnJpZGU7XG4gIH1cblxuICBwdWJsaWMgb3ZlcnJpZGUgcmVhZEZpbGUocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZWFkQXNzZXQgPSB0aGlzLm9wdGlvbnNFeHRlbmRlZC5yZWFkQXNzZXQ7XG5cbiAgICByZXR1cm4gcmVhZEFzc2V0ID8gcmVhZEFzc2V0KHBhdGgpIDogZnMucHJvbWlzZXMucmVhZEZpbGUocGF0aCwgJ3V0Zi04Jyk7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcnJpZGUgb2YgdGhlIENyaXR0ZXJzIGBlbWJlZExpbmtlZFN0eWxlc2hlZXRgIG1ldGhvZFxuICAgKiB0aGF0IG1ha2VzIGl0IHdvcmsgd2l0aCBBbmd1bGFyJ3MgQ1NQIEFQSXMuXG4gICAqL1xuICBwcml2YXRlIGVtYmVkTGlua2VkU3R5bGVzaGVldE92ZXJyaWRlOiBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbiA9IGFzeW5jIChsaW5rLCBkb2N1bWVudCkgPT4ge1xuICAgIGNvbnN0IHJldHVyblZhbHVlID0gYXdhaXQgdGhpcy5pbml0aWFsRW1iZWRMaW5rZWRTdHlsZXNoZWV0KGxpbmssIGRvY3VtZW50KTtcbiAgICBjb25zdCBjc3BOb25jZSA9IHRoaXMuZmluZENzcE5vbmNlKGRvY3VtZW50KTtcblxuICAgIGlmIChjc3BOb25jZSkge1xuICAgICAgY29uc3QgY3JpdHRlcnNNZWRpYSA9IGxpbmsuZ2V0QXR0cmlidXRlKCdvbmxvYWQnKT8ubWF0Y2goTUVESUFfU0VUX0hBTkRMRVJfUEFUVEVSTik7XG5cbiAgICAgIGlmIChjcml0dGVyc01lZGlhKSB7XG4gICAgICAgIC8vIElmIHRoZXJlJ3MgYSBDcml0dGVycy1nZW5lcmF0ZWQgYG9ubG9hZGAgaGFuZGxlciBhbmQgdGhlIGZpbGUgaGFzIGFuIEFuZ3VsYXIgQ1NQIG5vbmNlLFxuICAgICAgICAvLyB3ZSBoYXZlIHRvIHJlbW92ZSB0aGUgaGFuZGxlciwgYmVjYXVzZSBpdCdzIGluY29tcGF0aWJsZSB3aXRoIENTUC4gV2Ugc2F2ZSB0aGUgdmFsdWVcbiAgICAgICAgLy8gaW4gYSBkaWZmZXJlbnQgYXR0cmlidXRlIGFuZCB3ZSBnZW5lcmF0ZSBhIHNjcmlwdCB0YWcgd2l0aCB0aGUgbm9uY2UgdGhhdCB1c2VzXG4gICAgICAgIC8vIGBhZGRFdmVudExpc3RlbmVyYCB0byBhcHBseSB0aGUgbWVkaWEgcXVlcnkgaW5zdGVhZC5cbiAgICAgICAgbGluay5yZW1vdmVBdHRyaWJ1dGUoJ29ubG9hZCcpO1xuICAgICAgICBsaW5rLnNldEF0dHJpYnV0ZShDU1BfTUVESUFfQVRUUiwgY3JpdHRlcnNNZWRpYVsxXSk7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUluc2VydENzcExvYWRpbmdTY3JpcHQoZG9jdW1lbnQsIGNzcE5vbmNlKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWRlYWxseSB3ZSB3b3VsZCBob29rIGluIGF0IHRoZSB0aW1lIENyaXR0ZXJzIGluc2VydHMgdGhlIGBzdHlsZWAgdGFncywgYnV0IHRoZXJlIGlzbid0XG4gICAgICAvLyBhIHdheSBvZiBkb2luZyB0aGF0IGF0IHRoZSBtb21lbnQgc28gd2UgZmFsbCBiYWNrIHRvIGRvaW5nIGl0IGFueSB0aW1lIGEgYGxpbmtgIHRhZyBpc1xuICAgICAgLy8gaW5zZXJ0ZWQuIFdlIG1pdGlnYXRlIGl0IGJ5IG9ubHkgaXRlcmF0aW5nIHRoZSBkaXJlY3QgY2hpbGRyZW4gb2YgdGhlIGA8aGVhZD5gIHdoaWNoXG4gICAgICAvLyBzaG91bGQgYmUgcHJldHR5IHNoYWxsb3cuXG4gICAgICBkb2N1bWVudC5oZWFkLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkKSA9PiB7XG4gICAgICAgIGlmIChjaGlsZC50YWdOYW1lID09PSAnc3R5bGUnICYmICFjaGlsZC5oYXNBdHRyaWJ1dGUoJ25vbmNlJykpIHtcbiAgICAgICAgICBjaGlsZC5zZXRBdHRyaWJ1dGUoJ25vbmNlJywgY3NwTm9uY2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBDU1Agbm9uY2UgZm9yIGEgc3BlY2lmaWMgZG9jdW1lbnQuXG4gICAqL1xuICBwcml2YXRlIGZpbmRDc3BOb25jZShkb2N1bWVudDogUGFydGlhbERvY3VtZW50KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKHRoaXMuZG9jdW1lbnROb25jZXMuaGFzKGRvY3VtZW50KSkge1xuICAgICAgcmV0dXJuIHRoaXMuZG9jdW1lbnROb25jZXMuZ2V0KGRvY3VtZW50KSA/PyBudWxsO1xuICAgIH1cblxuICAgIC8vIEhUTUwgYXR0cmlidXRlIGFyZSBjYXNlLWluc2Vuc2l0aXZlLCBidXQgdGhlIHBhcnNlciB1c2VkIGJ5IENyaXR0ZXJzIGlzIGNhc2Utc2Vuc2l0aXZlLlxuICAgIGNvbnN0IG5vbmNlRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuZ0NzcE5vbmNlXSwgW25nY3Nwbm9uY2VdJyk7XG4gICAgY29uc3QgY3NwTm9uY2UgPVxuICAgICAgbm9uY2VFbGVtZW50Py5nZXRBdHRyaWJ1dGUoJ25nQ3NwTm9uY2UnKSB8fCBub25jZUVsZW1lbnQ/LmdldEF0dHJpYnV0ZSgnbmdjc3Bub25jZScpIHx8IG51bGw7XG5cbiAgICB0aGlzLmRvY3VtZW50Tm9uY2VzLnNldChkb2N1bWVudCwgY3NwTm9uY2UpO1xuXG4gICAgcmV0dXJuIGNzcE5vbmNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydHMgdGhlIGBzY3JpcHRgIHRhZyB0aGF0IHN3YXBzIHRoZSBjcml0aWNhbCBDU1MgYXQgcnVudGltZSxcbiAgICogaWYgb25lIGhhc24ndCBiZWVuIGluc2VydGVkIGludG8gdGhlIGRvY3VtZW50IGFscmVhZHkuXG4gICAqL1xuICBwcml2YXRlIGNvbmRpdGlvbmFsbHlJbnNlcnRDc3BMb2FkaW5nU2NyaXB0KGRvY3VtZW50OiBQYXJ0aWFsRG9jdW1lbnQsIG5vbmNlOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5hZGRlZENzcFNjcmlwdHNEb2N1bWVudHMuaGFzKGRvY3VtZW50KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoJ25vbmNlJywgbm9uY2UpO1xuICAgIHNjcmlwdC50ZXh0Q29udGVudCA9IFtcbiAgICAgIGAoKCkgPT4ge2AsXG4gICAgICAvLyBTYXZlIHRoZSBgY2hpbGRyZW5gIGluIGEgdmFyaWFibGUgc2luY2UgdGhleSdyZSBhIGxpdmUgRE9NIG5vZGUgY29sbGVjdGlvbi5cbiAgICAgIC8vIFdlIGl0ZXJhdGUgb3ZlciB0aGUgZGlyZWN0IGRlc2NlbmRhbnRzLCBpbnN0ZWFkIG9mIGdvaW5nIHRocm91Z2ggYSBgcXVlcnlTZWxlY3RvckFsbGAsXG4gICAgICAvLyBiZWNhdXNlIHdlIGtub3cgdGhhdCB0aGUgdGFncyB3aWxsIGJlIGRpcmVjdGx5IGluc2lkZSB0aGUgYGhlYWRgLlxuICAgICAgYCAgY29uc3QgY2hpbGRyZW4gPSBkb2N1bWVudC5oZWFkLmNoaWxkcmVuO2AsXG4gICAgICAvLyBEZWNsYXJlIGBvbkxvYWRgIG91dHNpZGUgdGhlIGxvb3AgdG8gYXZvaWQgbGVha2luZyBtZW1vcnkuXG4gICAgICAvLyBDYW4ndCBiZSBhbiBhcnJvdyBmdW5jdGlvbiwgYmVjYXVzZSB3ZSBuZWVkIGB0aGlzYCB0byByZWZlciB0byB0aGUgRE9NIG5vZGUuXG4gICAgICBgICBmdW5jdGlvbiBvbkxvYWQoKSB7dGhpcy5tZWRpYSA9IHRoaXMuZ2V0QXR0cmlidXRlKCcke0NTUF9NRURJQV9BVFRSfScpO31gLFxuICAgICAgLy8gSGFzIHRvIHVzZSBhIHBsYWluIGZvciBsb29wLCBiZWNhdXNlIHNvbWUgYnJvd3NlcnMgZG9uJ3Qgc3VwcG9ydFxuICAgICAgLy8gYGZvckVhY2hgIG9uIGBjaGlsZHJlbmAgd2hpY2ggaXMgYSBgSFRNTENvbGxlY3Rpb25gLlxuICAgICAgYCAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge2AsXG4gICAgICBgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRyZW5baV07YCxcbiAgICAgIGAgICAgY2hpbGQuaGFzQXR0cmlidXRlKCcke0NTUF9NRURJQV9BVFRSfScpICYmIGNoaWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBvbkxvYWQpO2AsXG4gICAgICBgICB9YCxcbiAgICAgIGB9KSgpO2AsXG4gICAgXS5qb2luKCdcXG4nKTtcbiAgICAvLyBBcHBlbmQgdGhlIHNjcmlwdCB0byB0aGUgaGVhZCBzaW5jZSBpdCBuZWVkcyB0b1xuICAgIC8vIHJ1biBhcyBlYXJseSBhcyBwb3NzaWJsZSwgYWZ0ZXIgdGhlIGBsaW5rYCB0YWdzLlxuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICB0aGlzLmFkZGVkQ3NwU2NyaXB0c0RvY3VtZW50cy5hZGQoZG9jdW1lbnQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCByZWFkb25seSBvcHRpb25zOiBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvck9wdGlvbnMpIHt9XG5cbiAgYXN5bmMgcHJvY2VzcyhcbiAgICBodG1sOiBzdHJpbmcsXG4gICAgb3B0aW9uczogSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7IGNvbnRlbnQ6IHN0cmluZzsgd2FybmluZ3M6IHN0cmluZ1tdOyBlcnJvcnM6IHN0cmluZ1tdIH0+IHtcbiAgICBjb25zdCBjcml0dGVycyA9IG5ldyBDcml0dGVyc0V4dGVuZGVkKHsgLi4udGhpcy5vcHRpb25zLCAuLi5vcHRpb25zIH0pO1xuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBjcml0dGVycy5wcm9jZXNzKGh0bWwpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIENsZWFuIHVwIHZhbHVlIGZyb20gdmFsdWUgbGVzcyBhdHRyaWJ1dGVzLlxuICAgICAgLy8gVGhpcyBpcyBjYXVzZWQgYmVjYXVzZSBwYXJzZTUgYWx3YXlzIHJlcXVpcmVzIGF0dHJpYnV0ZXMgdG8gaGF2ZSBhIHN0cmluZyB2YWx1ZS5cbiAgICAgIC8vIG5vbW9kdWxlPVwiXCIgZGVmZXI9XCJcIiAtPiBub21vZHVsZSBkZWZlci5cbiAgICAgIGNvbnRlbnQ6IGNvbnRlbnQucmVwbGFjZSgvKFxccyg/OmRlZmVyfG5vbW9kdWxlKSk9XCJcIi9nLCAnJDEnKSxcbiAgICAgIGVycm9yczogY3JpdHRlcnMuZXJyb3JzLFxuICAgICAgd2FybmluZ3M6IGNyaXR0ZXJzLndhcm5pbmdzLFxuICAgIH07XG4gIH1cbn1cbiJdfQ==