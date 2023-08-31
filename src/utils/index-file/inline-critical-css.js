"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineCriticalCssProcessor = void 0;
const promises_1 = require("node:fs/promises");
const Critters = require('critters');
/**
 * Pattern used to extract the media query set by Critters in an `onload` handler.
 */
const MEDIA_SET_HANDLER_PATTERN = /^this\.media=["'](.*)["'];?$/;
/**
 * Name of the attribute used to save the Critters media query so it can be re-assigned on load.
 */
const CSP_MEDIA_ATTR = 'ngCspMedia';
/**
 * Script text used to change the media value of the link tags.
 */
const LINK_LOAD_SCRIPT_CONTENT = [
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
            if (link.getAttribute('media') === 'print' && link.next?.name === 'noscript') {
                // Workaround for https://github.com/GoogleChromeLabs/critters/issues/64
                // NB: this is only needed for the webpack based builders.
                const media = link.getAttribute('onload')?.match(MEDIA_SET_HANDLER_PATTERN);
                if (media) {
                    link.removeAttribute('onload');
                    link.setAttribute('media', media[1]);
                    link?.next?.remove();
                }
            }
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
        return readAsset ? readAsset(path) : (0, promises_1.readFile)(path, 'utf-8');
    }
    /**
     * Finds the CSP nonce for a specific document.
     */
    findCspNonce(document) {
        if (this.documentNonces.has(document)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return this.documentNonces.get(document);
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
        script.textContent = LINK_LOAD_SCRIPT_CONTENT;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLWNyaXRpY2FsLWNzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBNEM7QUFFNUMsTUFBTSxRQUFRLEdBQXNDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUV4RTs7R0FFRztBQUNILE1BQU0seUJBQXlCLEdBQUcsOEJBQThCLENBQUM7QUFFakU7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUFFcEM7O0dBRUc7QUFDSCxNQUFNLHdCQUF3QixHQUFHO0lBQy9CLFVBQVU7SUFDViw4RUFBOEU7SUFDOUUseUZBQXlGO0lBQ3pGLG9FQUFvRTtJQUNwRSw0Q0FBNEM7SUFDNUMsNkRBQTZEO0lBQzdELCtFQUErRTtJQUMvRSx3REFBd0QsY0FBYyxNQUFNO0lBQzVFLG1FQUFtRTtJQUNuRSx1REFBdUQ7SUFDdkQsK0NBQStDO0lBQy9DLGdDQUFnQztJQUNoQywyQkFBMkIsY0FBYywrQ0FBK0M7SUFDeEYsS0FBSztJQUNMLE9BQU87Q0FDUixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQXlDYixNQUFNLGdCQUFpQixTQUFRLFFBQVE7SUFVckMsWUFDbUIsZUFDZ0I7UUFFakMsS0FBSyxDQUFDO1lBQ0osTUFBTSxFQUFFO2dCQUNOLElBQUksRUFBRSxDQUFDLENBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxLQUFLLEVBQUUsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDekMsSUFB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LENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwQyxNQUFNLENBQUMsV0FBVyxHQUFHLHdCQUF3QixDQUFDO1FBQzlDLGtEQUFrRDtRQUNsRCxtREFBbUQ7UUFDbkQsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUFFRCxNQUFhLDBCQUEwQjtJQUNyQyxZQUErQixPQUEwQztRQUExQyxZQUFPLEdBQVAsT0FBTyxDQUFtQztJQUFHLENBQUM7SUFFN0UsS0FBSyxDQUFDLE9BQU8sQ0FDWCxJQUFZLEVBQ1osT0FBd0M7UUFFeEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDdkUsTUFBTSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTdDLE9BQU87WUFDTCw2Q0FBNkM7WUFDN0MsbUZBQW1GO1lBQ25GLDBDQUEwQztZQUMxQyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxJQUFJLENBQUM7WUFDNUQsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNO1lBQ3ZCLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtTQUM1QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBbkJELGdFQW1CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuXG5jb25zdCBDcml0dGVyczogdHlwZW9mIGltcG9ydCgnY3JpdHRlcnMnKS5kZWZhdWx0ID0gcmVxdWlyZSgnY3JpdHRlcnMnKTtcblxuLyoqXG4gKiBQYXR0ZXJuIHVzZWQgdG8gZXh0cmFjdCB0aGUgbWVkaWEgcXVlcnkgc2V0IGJ5IENyaXR0ZXJzIGluIGFuIGBvbmxvYWRgIGhhbmRsZXIuXG4gKi9cbmNvbnN0IE1FRElBX1NFVF9IQU5ETEVSX1BBVFRFUk4gPSAvXnRoaXNcXC5tZWRpYT1bXCInXSguKilbXCInXTs/JC87XG5cbi8qKlxuICogTmFtZSBvZiB0aGUgYXR0cmlidXRlIHVzZWQgdG8gc2F2ZSB0aGUgQ3JpdHRlcnMgbWVkaWEgcXVlcnkgc28gaXQgY2FuIGJlIHJlLWFzc2lnbmVkIG9uIGxvYWQuXG4gKi9cbmNvbnN0IENTUF9NRURJQV9BVFRSID0gJ25nQ3NwTWVkaWEnO1xuXG4vKipcbiAqIFNjcmlwdCB0ZXh0IHVzZWQgdG8gY2hhbmdlIHRoZSBtZWRpYSB2YWx1ZSBvZiB0aGUgbGluayB0YWdzLlxuICovXG5jb25zdCBMSU5LX0xPQURfU0NSSVBUX0NPTlRFTlQgPSBbXG4gIGAoKCkgPT4ge2AsXG4gIC8vIFNhdmUgdGhlIGBjaGlsZHJlbmAgaW4gYSB2YXJpYWJsZSBzaW5jZSB0aGV5J3JlIGEgbGl2ZSBET00gbm9kZSBjb2xsZWN0aW9uLlxuICAvLyBXZSBpdGVyYXRlIG92ZXIgdGhlIGRpcmVjdCBkZXNjZW5kYW50cywgaW5zdGVhZCBvZiBnb2luZyB0aHJvdWdoIGEgYHF1ZXJ5U2VsZWN0b3JBbGxgLFxuICAvLyBiZWNhdXNlIHdlIGtub3cgdGhhdCB0aGUgdGFncyB3aWxsIGJlIGRpcmVjdGx5IGluc2lkZSB0aGUgYGhlYWRgLlxuICBgICBjb25zdCBjaGlsZHJlbiA9IGRvY3VtZW50LmhlYWQuY2hpbGRyZW47YCxcbiAgLy8gRGVjbGFyZSBgb25Mb2FkYCBvdXRzaWRlIHRoZSBsb29wIHRvIGF2b2lkIGxlYWtpbmcgbWVtb3J5LlxuICAvLyBDYW4ndCBiZSBhbiBhcnJvdyBmdW5jdGlvbiwgYmVjYXVzZSB3ZSBuZWVkIGB0aGlzYCB0byByZWZlciB0byB0aGUgRE9NIG5vZGUuXG4gIGAgIGZ1bmN0aW9uIG9uTG9hZCgpIHt0aGlzLm1lZGlhID0gdGhpcy5nZXRBdHRyaWJ1dGUoJyR7Q1NQX01FRElBX0FUVFJ9Jyk7fWAsXG4gIC8vIEhhcyB0byB1c2UgYSBwbGFpbiBmb3IgbG9vcCwgYmVjYXVzZSBzb21lIGJyb3dzZXJzIGRvbid0IHN1cHBvcnRcbiAgLy8gYGZvckVhY2hgIG9uIGBjaGlsZHJlbmAgd2hpY2ggaXMgYSBgSFRNTENvbGxlY3Rpb25gLlxuICBgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7YCxcbiAgYCAgICBjb25zdCBjaGlsZCA9IGNoaWxkcmVuW2ldO2AsXG4gIGAgICAgY2hpbGQuaGFzQXR0cmlidXRlKCcke0NTUF9NRURJQV9BVFRSfScpICYmIGNoaWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBvbkxvYWQpO2AsXG4gIGAgIH1gLFxuICBgfSkoKTtgLFxuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NPcHRpb25zIHtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yT3B0aW9ucyB7XG4gIG1pbmlmeT86IGJvb2xlYW47XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgcmVhZEFzc2V0PzogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+O1xufVxuXG4vKiogUGFydGlhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBgSFRNTEVsZW1lbnRgLiAqL1xuaW50ZXJmYWNlIFBhcnRpYWxIVE1MRWxlbWVudCB7XG4gIGdldEF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsO1xuICBzZXRBdHRyaWJ1dGUobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogdm9pZDtcbiAgaGFzQXR0cmlidXRlKG5hbWU6IHN0cmluZyk6IGJvb2xlYW47XG4gIHJlbW92ZUF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiB2b2lkO1xuICBhcHBlbmRDaGlsZChjaGlsZDogUGFydGlhbEhUTUxFbGVtZW50KTogdm9pZDtcbiAgcmVtb3ZlKCk6IHZvaWQ7XG4gIG5hbWU6IHN0cmluZztcbiAgdGV4dENvbnRlbnQ6IHN0cmluZztcbiAgdGFnTmFtZTogc3RyaW5nIHwgbnVsbDtcbiAgY2hpbGRyZW46IFBhcnRpYWxIVE1MRWxlbWVudFtdO1xuICBuZXh0OiBQYXJ0aWFsSFRNTEVsZW1lbnQgfCBudWxsO1xuICBwcmV2OiBQYXJ0aWFsSFRNTEVsZW1lbnQgfCBudWxsO1xufVxuXG4vKiogUGFydGlhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBIVE1MIGBEb2N1bWVudGAuICovXG5pbnRlcmZhY2UgUGFydGlhbERvY3VtZW50IHtcbiAgaGVhZDogUGFydGlhbEhUTUxFbGVtZW50O1xuICBjcmVhdGVFbGVtZW50KHRhZ05hbWU6IHN0cmluZyk6IFBhcnRpYWxIVE1MRWxlbWVudDtcbiAgcXVlcnlTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nKTogUGFydGlhbEhUTUxFbGVtZW50IHwgbnVsbDtcbn1cblxuLyoqIFNpZ25hdHVyZSBvZiB0aGUgYENyaXR0ZXJzLmVtYmVkTGlua2VkU3R5bGVzaGVldGAgbWV0aG9kLiAqL1xudHlwZSBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbiA9IChcbiAgbGluazogUGFydGlhbEhUTUxFbGVtZW50LFxuICBkb2N1bWVudDogUGFydGlhbERvY3VtZW50LFxuKSA9PiBQcm9taXNlPHVua25vd24+O1xuXG5jbGFzcyBDcml0dGVyc0V4dGVuZGVkIGV4dGVuZHMgQ3JpdHRlcnMge1xuICByZWFkb25seSB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgcmVhZG9ubHkgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluaXRpYWxFbWJlZExpbmtlZFN0eWxlc2hlZXQ6IEVtYmVkTGlua2VkU3R5bGVzaGVldEZuO1xuICBwcml2YXRlIGFkZGVkQ3NwU2NyaXB0c0RvY3VtZW50cyA9IG5ldyBXZWFrU2V0PFBhcnRpYWxEb2N1bWVudD4oKTtcbiAgcHJpdmF0ZSBkb2N1bWVudE5vbmNlcyA9IG5ldyBXZWFrTWFwPFBhcnRpYWxEb2N1bWVudCwgc3RyaW5nIHwgbnVsbD4oKTtcblxuICAvLyBJbmhlcml0ZWQgZnJvbSBgQ3JpdHRlcnNgLCBidXQgbm90IGV4cG9zZWQgaW4gdGhlIHR5cGluZ3MuXG4gIHByb3RlY3RlZCBlbWJlZExpbmtlZFN0eWxlc2hlZXQhOiBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnNFeHRlbmRlZDogSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3JPcHRpb25zICZcbiAgICAgIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc09wdGlvbnMsXG4gICkge1xuICAgIHN1cGVyKHtcbiAgICAgIGxvZ2dlcjoge1xuICAgICAgICB3YXJuOiAoczogc3RyaW5nKSA9PiB0aGlzLndhcm5pbmdzLnB1c2gocyksXG4gICAgICAgIGVycm9yOiAoczogc3RyaW5nKSA9PiB0aGlzLmVycm9ycy5wdXNoKHMpLFxuICAgICAgICBpbmZvOiAoKSA9PiB7fSxcbiAgICAgIH0sXG4gICAgICBsb2dMZXZlbDogJ3dhcm4nLFxuICAgICAgcGF0aDogb3B0aW9uc0V4dGVuZGVkLm91dHB1dFBhdGgsXG4gICAgICBwdWJsaWNQYXRoOiBvcHRpb25zRXh0ZW5kZWQuZGVwbG95VXJsLFxuICAgICAgY29tcHJlc3M6ICEhb3B0aW9uc0V4dGVuZGVkLm1pbmlmeSxcbiAgICAgIHBydW5lU291cmNlOiBmYWxzZSxcbiAgICAgIHJlZHVjZUlubGluZVN0eWxlczogZmFsc2UsXG4gICAgICBtZXJnZVN0eWxlc2hlZXRzOiBmYWxzZSxcbiAgICAgIC8vIE5vdGU6IGlmIGBwcmVsb2FkYCBjaGFuZ2VzIHRvIGFueXRoaW5nIG90aGVyIHRoYW4gYG1lZGlhYCwgdGhlIGxvZ2ljIGluXG4gICAgICAvLyBgZW1iZWRMaW5rZWRTdHlsZXNoZWV0T3ZlcnJpZGVgIHdpbGwgaGF2ZSB0byBiZSB1cGRhdGVkLlxuICAgICAgcHJlbG9hZDogJ21lZGlhJyxcbiAgICAgIG5vc2NyaXB0RmFsbGJhY2s6IHRydWUsXG4gICAgICBpbmxpbmVGb250czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFdlIGNhbid0IHVzZSBpbmhlcml0YW5jZSB0byBvdmVycmlkZSBgZW1iZWRMaW5rZWRTdHlsZXNoZWV0YCwgYmVjYXVzZSBpdCdzIG5vdCBkZWNsYXJlZCBpblxuICAgIC8vIHRoZSBgQ3JpdHRlcnNgIC5kLnRzIHdoaWNoIG1lYW5zIHRoYXQgd2UgY2FuJ3QgY2FsbCB0aGUgYHN1cGVyYCBpbXBsZW1lbnRhdGlvbi4gVFMgZG9lc24ndFxuICAgIC8vIGFsbG93IGZvciBgc3VwZXJgIHRvIGJlIGNhc3QgdG8gYSBkaWZmZXJlbnQgdHlwZS5cbiAgICB0aGlzLmluaXRpYWxFbWJlZExpbmtlZFN0eWxlc2hlZXQgPSB0aGlzLmVtYmVkTGlua2VkU3R5bGVzaGVldDtcbiAgICB0aGlzLmVtYmVkTGlua2VkU3R5bGVzaGVldCA9IHRoaXMuZW1iZWRMaW5rZWRTdHlsZXNoZWV0T3ZlcnJpZGU7XG4gIH1cblxuICBwdWJsaWMgb3ZlcnJpZGUgcmVhZEZpbGUocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCByZWFkQXNzZXQgPSB0aGlzLm9wdGlvbnNFeHRlbmRlZC5yZWFkQXNzZXQ7XG5cbiAgICByZXR1cm4gcmVhZEFzc2V0ID8gcmVhZEFzc2V0KHBhdGgpIDogcmVhZEZpbGUocGF0aCwgJ3V0Zi04Jyk7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcnJpZGUgb2YgdGhlIENyaXR0ZXJzIGBlbWJlZExpbmtlZFN0eWxlc2hlZXRgIG1ldGhvZFxuICAgKiB0aGF0IG1ha2VzIGl0IHdvcmsgd2l0aCBBbmd1bGFyJ3MgQ1NQIEFQSXMuXG4gICAqL1xuICBwcml2YXRlIGVtYmVkTGlua2VkU3R5bGVzaGVldE92ZXJyaWRlOiBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbiA9IGFzeW5jIChsaW5rLCBkb2N1bWVudCkgPT4ge1xuICAgIGlmIChsaW5rLmdldEF0dHJpYnV0ZSgnbWVkaWEnKSA9PT0gJ3ByaW50JyAmJiBsaW5rLm5leHQ/Lm5hbWUgPT09ICdub3NjcmlwdCcpIHtcbiAgICAgIC8vIFdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9Hb29nbGVDaHJvbWVMYWJzL2NyaXR0ZXJzL2lzc3Vlcy82NFxuICAgICAgLy8gTkI6IHRoaXMgaXMgb25seSBuZWVkZWQgZm9yIHRoZSB3ZWJwYWNrIGJhc2VkIGJ1aWxkZXJzLlxuICAgICAgY29uc3QgbWVkaWEgPSBsaW5rLmdldEF0dHJpYnV0ZSgnb25sb2FkJyk/Lm1hdGNoKE1FRElBX1NFVF9IQU5ETEVSX1BBVFRFUk4pO1xuICAgICAgaWYgKG1lZGlhKSB7XG4gICAgICAgIGxpbmsucmVtb3ZlQXR0cmlidXRlKCdvbmxvYWQnKTtcbiAgICAgICAgbGluay5zZXRBdHRyaWJ1dGUoJ21lZGlhJywgbWVkaWFbMV0pO1xuICAgICAgICBsaW5rPy5uZXh0Py5yZW1vdmUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXR1cm5WYWx1ZSA9IGF3YWl0IHRoaXMuaW5pdGlhbEVtYmVkTGlua2VkU3R5bGVzaGVldChsaW5rLCBkb2N1bWVudCk7XG4gICAgY29uc3QgY3NwTm9uY2UgPSB0aGlzLmZpbmRDc3BOb25jZShkb2N1bWVudCk7XG5cbiAgICBpZiAoY3NwTm9uY2UpIHtcbiAgICAgIGNvbnN0IGNyaXR0ZXJzTWVkaWEgPSBsaW5rLmdldEF0dHJpYnV0ZSgnb25sb2FkJyk/Lm1hdGNoKE1FRElBX1NFVF9IQU5ETEVSX1BBVFRFUk4pO1xuXG4gICAgICBpZiAoY3JpdHRlcnNNZWRpYSkge1xuICAgICAgICAvLyBJZiB0aGVyZSdzIGEgQ3JpdHRlcnMtZ2VuZXJhdGVkIGBvbmxvYWRgIGhhbmRsZXIgYW5kIHRoZSBmaWxlIGhhcyBhbiBBbmd1bGFyIENTUCBub25jZSxcbiAgICAgICAgLy8gd2UgaGF2ZSB0byByZW1vdmUgdGhlIGhhbmRsZXIsIGJlY2F1c2UgaXQncyBpbmNvbXBhdGlibGUgd2l0aCBDU1AuIFdlIHNhdmUgdGhlIHZhbHVlXG4gICAgICAgIC8vIGluIGEgZGlmZmVyZW50IGF0dHJpYnV0ZSBhbmQgd2UgZ2VuZXJhdGUgYSBzY3JpcHQgdGFnIHdpdGggdGhlIG5vbmNlIHRoYXQgdXNlc1xuICAgICAgICAvLyBgYWRkRXZlbnRMaXN0ZW5lcmAgdG8gYXBwbHkgdGhlIG1lZGlhIHF1ZXJ5IGluc3RlYWQuXG4gICAgICAgIGxpbmsucmVtb3ZlQXR0cmlidXRlKCdvbmxvYWQnKTtcbiAgICAgICAgbGluay5zZXRBdHRyaWJ1dGUoQ1NQX01FRElBX0FUVFIsIGNyaXR0ZXJzTWVkaWFbMV0pO1xuICAgICAgICB0aGlzLmNvbmRpdGlvbmFsbHlJbnNlcnRDc3BMb2FkaW5nU2NyaXB0KGRvY3VtZW50LCBjc3BOb25jZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIElkZWFsbHkgd2Ugd291bGQgaG9vayBpbiBhdCB0aGUgdGltZSBDcml0dGVycyBpbnNlcnRzIHRoZSBgc3R5bGVgIHRhZ3MsIGJ1dCB0aGVyZSBpc24ndFxuICAgICAgLy8gYSB3YXkgb2YgZG9pbmcgdGhhdCBhdCB0aGUgbW9tZW50IHNvIHdlIGZhbGwgYmFjayB0byBkb2luZyBpdCBhbnkgdGltZSBhIGBsaW5rYCB0YWcgaXNcbiAgICAgIC8vIGluc2VydGVkLiBXZSBtaXRpZ2F0ZSBpdCBieSBvbmx5IGl0ZXJhdGluZyB0aGUgZGlyZWN0IGNoaWxkcmVuIG9mIHRoZSBgPGhlYWQ+YCB3aGljaFxuICAgICAgLy8gc2hvdWxkIGJlIHByZXR0eSBzaGFsbG93LlxuICAgICAgZG9jdW1lbnQuaGVhZC5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgICAgICBpZiAoY2hpbGQudGFnTmFtZSA9PT0gJ3N0eWxlJyAmJiAhY2hpbGQuaGFzQXR0cmlidXRlKCdub25jZScpKSB7XG4gICAgICAgICAgY2hpbGQuc2V0QXR0cmlidXRlKCdub25jZScsIGNzcE5vbmNlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblZhbHVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgQ1NQIG5vbmNlIGZvciBhIHNwZWNpZmljIGRvY3VtZW50LlxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kQ3NwTm9uY2UoZG9jdW1lbnQ6IFBhcnRpYWxEb2N1bWVudCk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICh0aGlzLmRvY3VtZW50Tm9uY2VzLmhhcyhkb2N1bWVudCkpIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICByZXR1cm4gdGhpcy5kb2N1bWVudE5vbmNlcy5nZXQoZG9jdW1lbnQpITtcbiAgICB9XG5cbiAgICAvLyBIVE1MIGF0dHJpYnV0ZSBhcmUgY2FzZS1pbnNlbnNpdGl2ZSwgYnV0IHRoZSBwYXJzZXIgdXNlZCBieSBDcml0dGVycyBpcyBjYXNlLXNlbnNpdGl2ZS5cbiAgICBjb25zdCBub25jZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmdDc3BOb25jZV0sIFtuZ2NzcG5vbmNlXScpO1xuICAgIGNvbnN0IGNzcE5vbmNlID1cbiAgICAgIG5vbmNlRWxlbWVudD8uZ2V0QXR0cmlidXRlKCduZ0NzcE5vbmNlJykgfHwgbm9uY2VFbGVtZW50Py5nZXRBdHRyaWJ1dGUoJ25nY3Nwbm9uY2UnKSB8fCBudWxsO1xuXG4gICAgdGhpcy5kb2N1bWVudE5vbmNlcy5zZXQoZG9jdW1lbnQsIGNzcE5vbmNlKTtcblxuICAgIHJldHVybiBjc3BOb25jZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnRzIHRoZSBgc2NyaXB0YCB0YWcgdGhhdCBzd2FwcyB0aGUgY3JpdGljYWwgQ1NTIGF0IHJ1bnRpbWUsXG4gICAqIGlmIG9uZSBoYXNuJ3QgYmVlbiBpbnNlcnRlZCBpbnRvIHRoZSBkb2N1bWVudCBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBjb25kaXRpb25hbGx5SW5zZXJ0Q3NwTG9hZGluZ1NjcmlwdChkb2N1bWVudDogUGFydGlhbERvY3VtZW50LCBub25jZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuYWRkZWRDc3BTY3JpcHRzRG9jdW1lbnRzLmhhcyhkb2N1bWVudCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICBzY3JpcHQuc2V0QXR0cmlidXRlKCdub25jZScsIG5vbmNlKTtcbiAgICBzY3JpcHQudGV4dENvbnRlbnQgPSBMSU5LX0xPQURfU0NSSVBUX0NPTlRFTlQ7XG4gICAgLy8gQXBwZW5kIHRoZSBzY3JpcHQgdG8gdGhlIGhlYWQgc2luY2UgaXQgbmVlZHMgdG9cbiAgICAvLyBydW4gYXMgZWFybHkgYXMgcG9zc2libGUsIGFmdGVyIHRoZSBgbGlua2AgdGFncy5cbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgdGhpcy5hZGRlZENzcFNjcmlwdHNEb2N1bWVudHMuYWRkKGRvY3VtZW50KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ige1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgcmVhZG9ubHkgb3B0aW9uczogSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3JPcHRpb25zKSB7fVxuXG4gIGFzeW5jIHByb2Nlc3MoXG4gICAgaHRtbDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc09wdGlvbnMsXG4gICk6IFByb21pc2U8eyBjb250ZW50OiBzdHJpbmc7IHdhcm5pbmdzOiBzdHJpbmdbXTsgZXJyb3JzOiBzdHJpbmdbXSB9PiB7XG4gICAgY29uc3QgY3JpdHRlcnMgPSBuZXcgQ3JpdHRlcnNFeHRlbmRlZCh7IC4uLnRoaXMub3B0aW9ucywgLi4ub3B0aW9ucyB9KTtcbiAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgY3JpdHRlcnMucHJvY2VzcyhodG1sKTtcblxuICAgIHJldHVybiB7XG4gICAgICAvLyBDbGVhbiB1cCB2YWx1ZSBmcm9tIHZhbHVlIGxlc3MgYXR0cmlidXRlcy5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJlY2F1c2UgcGFyc2U1IGFsd2F5cyByZXF1aXJlcyBhdHRyaWJ1dGVzIHRvIGhhdmUgYSBzdHJpbmcgdmFsdWUuXG4gICAgICAvLyBub21vZHVsZT1cIlwiIGRlZmVyPVwiXCIgLT4gbm9tb2R1bGUgZGVmZXIuXG4gICAgICBjb250ZW50OiBjb250ZW50LnJlcGxhY2UoLyhcXHMoPzpkZWZlcnxub21vZHVsZSkpPVwiXCIvZywgJyQxJyksXG4gICAgICBlcnJvcnM6IGNyaXR0ZXJzLmVycm9ycyxcbiAgICAgIHdhcm5pbmdzOiBjcml0dGVycy53YXJuaW5ncyxcbiAgICB9O1xuICB9XG59XG4iXX0=