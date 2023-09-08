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
    optionsExtended;
    warnings = [];
    errors = [];
    initialEmbedLinkedStylesheet;
    addedCspScriptsDocuments = new WeakSet();
    documentNonces = new WeakMap();
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
     * Override of the Critters `embedLinkedStylesheet` method
     * that makes it work with Angular's CSP APIs.
     */
    embedLinkedStylesheetOverride = async (link, document) => {
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
    options;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLWNyaXRpY2FsLWNzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBNEM7QUFFNUMsTUFBTSxRQUFRLEdBQXNDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUV4RTs7R0FFRztBQUNILE1BQU0seUJBQXlCLEdBQUcsOEJBQThCLENBQUM7QUFFakU7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUM7QUFFcEM7O0dBRUc7QUFDSCxNQUFNLHdCQUF3QixHQUFHO0lBQy9CLFVBQVU7SUFDViw4RUFBOEU7SUFDOUUseUZBQXlGO0lBQ3pGLG9FQUFvRTtJQUNwRSw0Q0FBNEM7SUFDNUMsNkRBQTZEO0lBQzdELCtFQUErRTtJQUMvRSx3REFBd0QsY0FBYyxNQUFNO0lBQzVFLG1FQUFtRTtJQUNuRSx1REFBdUQ7SUFDdkQsK0NBQStDO0lBQy9DLGdDQUFnQztJQUNoQywyQkFBMkIsY0FBYywrQ0FBK0M7SUFDeEYsS0FBSztJQUNMLE9BQU87Q0FDUixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQXlDYixNQUFNLGdCQUFpQixTQUFRLFFBQVE7SUFXbEI7SUFWVixRQUFRLEdBQWEsRUFBRSxDQUFDO0lBQ3hCLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDdkIsNEJBQTRCLENBQTBCO0lBQ3RELHdCQUF3QixHQUFHLElBQUksT0FBTyxFQUFtQixDQUFDO0lBQzFELGNBQWMsR0FBRyxJQUFJLE9BQU8sRUFBa0MsQ0FBQztJQUt2RSxZQUNtQixlQUNnQjtRQUVqQyxLQUFLLENBQUM7WUFDSixNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLENBQUMs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aEQsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEMsTUFBTSxDQUFDLFdBQVcsR0FBRyx3QkFBd0IsQ0FBQztRQUM5QyxrREFBa0Q7UUFDbEQsbURBQW1EO1FBQ25ELFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDOUMsQ0FBQztDQUNGO0FBRUQsTUFBYSwwQkFBMEI7SUFDTjtJQUEvQixZQUErQixPQUEwQztRQUExQyxZQUFPLEdBQVAsT0FBTyxDQUFtQztJQUFHLENBQUM7SUFFN0UsS0FBSyxDQUFDLE9BQU8sQ0FDWCxJQUFZLEVBQ1osT0FBd0M7UUFFeEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDdkUsTUFBTSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTdDLE9BQU87WUFDTCw2Q0FBNkM7WUFDN0MsbUZBQW1GO1lBQ25GLDBDQUEwQztZQUMxQyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxJQUFJLENBQUM7WUFDNUQsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNO1lBQ3ZCLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtTQUM1QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBbkJELGdFQW1CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuXG5jb25zdCBDcml0dGVyczogdHlwZW9mIGltcG9ydCgnY3JpdHRlcnMnKS5kZWZhdWx0ID0gcmVxdWlyZSgnY3JpdHRlcnMnKTtcblxuLyoqXG4gKiBQYXR0ZXJuIHVzZWQgdG8gZXh0cmFjdCB0aGUgbWVkaWEgcXVlcnkgc2V0IGJ5IENyaXR0ZXJzIGluIGFuIGBvbmxvYWRgIGhhbmRsZXIuXG4gKi9cbmNvbnN0IE1FRElBX1NFVF9IQU5ETEVSX1BBVFRFUk4gPSAvXnRoaXNcXC5tZWRpYT1bXCInXSguKilbXCInXTs/JC87XG5cbi8qKlxuICogTmFtZSBvZiB0aGUgYXR0cmlidXRlIHVzZWQgdG8gc2F2ZSB0aGUgQ3JpdHRlcnMgbWVkaWEgcXVlcnkgc28gaXQgY2FuIGJlIHJlLWFzc2lnbmVkIG9uIGxvYWQuXG4gKi9cbmNvbnN0IENTUF9NRURJQV9BVFRSID0gJ25nQ3NwTWVkaWEnO1xuXG4vKipcbiAqIFNjcmlwdCB0ZXh0IHVzZWQgdG8gY2hhbmdlIHRoZSBtZWRpYSB2YWx1ZSBvZiB0aGUgbGluayB0YWdzLlxuICovXG5jb25zdCBMSU5LX0xPQURfU0NSSVBUX0NPTlRFTlQgPSBbXG4gIGAoKCkgPT4ge2AsXG4gIC8vIFNhdmUgdGhlIGBjaGlsZHJlbmAgaW4gYSB2YXJpYWJsZSBzaW5jZSB0aGV5J3JlIGEgbGl2ZSBET00gbm9kZSBjb2xsZWN0aW9uLlxuICAvLyBXZSBpdGVyYXRlIG92ZXIgdGhlIGRpcmVjdCBkZXNjZW5kYW50cywgaW5zdGVhZCBvZiBnb2luZyB0aHJvdWdoIGEgYHF1ZXJ5U2VsZWN0b3JBbGxgLFxuICAvLyBiZWNhdXNlIHdlIGtub3cgdGhhdCB0aGUgdGFncyB3aWxsIGJlIGRpcmVjdGx5IGluc2lkZSB0aGUgYGhlYWRgLlxuICBgICBjb25zdCBjaGlsZHJlbiA9IGRvY3VtZW50LmhlYWQuY2hpbGRyZW47YCxcbiAgLy8gRGVjbGFyZSBgb25Mb2FkYCBvdXRzaWRlIHRoZSBsb29wIHRvIGF2b2lkIGxlYWtpbmcgbWVtb3J5LlxuICAvLyBDYW4ndCBiZSBhbiBhcnJvdyBmdW5jdGlvbiwgYmVjYXVzZSB3ZSBuZWVkIGB0aGlzYCB0byByZWZlciB0byB0aGUgRE9NIG5vZGUuXG4gIGAgIGZ1bmN0aW9uIG9uTG9hZCgpIHt0aGlzLm1lZGlhID0gdGhpcy5nZXRBdHRyaWJ1dGUoJyR7Q1NQX01FRElBX0FUVFJ9Jyk7fWAsXG4gIC8vIEhhcyB0byB1c2UgYSBwbGFpbiBmb3IgbG9vcCwgYmVjYXVzZSBzb21lIGJyb3dzZXJzIGRvbid0IHN1cHBvcnRcbiAgLy8gYGZvckVhY2hgIG9uIGBjaGlsZHJlbmAgd2hpY2ggaXMgYSBgSFRNTENvbGxlY3Rpb25gLlxuICBgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7YCxcbiAgYCAgICBjb25zdCBjaGlsZCA9IGNoaWxkcmVuW2ldO2AsXG4gIGAgICAgY2hpbGQuaGFzQXR0cmlidXRlKCcke0NTUF9NRURJQV9BVFRSfScpICYmIGNoaWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBvbkxvYWQpO2AsXG4gIGAgIH1gLFxuICBgfSkoKTtgLFxuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NPcHRpb25zIHtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yT3B0aW9ucyB7XG4gIG1pbmlmeT86IGJvb2xlYW47XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgcmVhZEFzc2V0PzogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+O1xufVxuXG4vKiogUGFydGlhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBgSFRNTEVsZW1lbnRgLiAqL1xuaW50ZXJmYWNlIFBhcnRpYWxIVE1MRWxlbWVudCB7XG4gIGdldEF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsO1xuICBzZXRBdHRyaWJ1dGUobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogdm9pZDtcbiAgaGFzQXR0cmlidXRlKG5hbWU6IHN0cmluZyk6IGJvb2xlYW47XG4gIHJlbW92ZUF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiB2b2lkO1xuICBhcHBlbmRDaGlsZChjaGlsZDogUGFydGlhbEhUTUxFbGVtZW50KTogdm9pZDtcbiAgcmVtb3ZlKCk6IHZvaWQ7XG4gIG5hbWU6IHN0cmluZztcbiAgdGV4dENvbnRlbnQ6IHN0cmluZztcbiAgdGFnTmFtZTogc3RyaW5nIHwgbnVsbDtcbiAgY2hpbGRyZW46IFBhcnRpYWxIVE1MRWxlbWVudFtdO1xuICBuZXh0OiBQYXJ0aWFsSFRNTEVsZW1lbnQgfCBudWxsO1xuICBwcmV2OiBQYXJ0aWFsSFRNTEVsZW1lbnQgfCBudWxsO1xufVxuXG4vKiogUGFydGlhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBIVE1MIGBEb2N1bWVudGAuICovXG5pbnRlcmZhY2UgUGFydGlhbERvY3VtZW50IHtcbiAgaGVhZDogUGFydGlhbEhUTUxFbGVtZW50O1xuICBjcmVhdGVFbGVtZW50KHRhZ05hbWU6IHN0cmluZyk6IFBhcnRpYWxIVE1MRWxlbWVudDtcbiAgcXVlcnlTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nKTogUGFydGlhbEhUTUxFbGVtZW50IHwgbnVsbDtcbn1cblxuLyoqIFNpZ25hdHVyZSBvZiB0aGUgYENyaXR0ZXJzLmVtYmVkTGlua2VkU3R5bGVzaGVldGAgbWV0aG9kLiAqL1xudHlwZSBFbWJlZExpbmtlZFN0eWxlc2hlZXRGbiA9IChcbiAgbGluazogUGFydGlhbEhUTUxFbGVtZW50LFxuICBkb2N1bWVudDogUGFydGlhbERvY3VtZW50LFxuKSA9PiBQcm9taXNlPHVua25vd24+O1xuXG5jbGFzcyBDcml0dGVyc0V4dGVuZGVkIGV4dGVuZHMgQ3JpdHRlcnMge1xuICByZWFkb25seSB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgcmVhZG9ubHkgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluaXRpYWxFbWJlZExpbmtlZFN0eWxlc2hlZXQ6IEVtYmVkTGlua2VkU3R5bGVzaGVldEZuO1xuICBwcml2YXRlIGFkZGVkQ3NwU2NyaXB0c0RvY3VtZW50cyA9IG5ldyBXZWFrU2V0PFBhcnRpYWxEb2N1bWVudD4oKTtcbiAgcHJpdmF0ZSBkb2N1bWVudE5vbmNlcyA9IG5ldyBXZWFrTWFwPFBhcnRpYWxEb2N1bWVudCwgc3RyaW5nIHwgbnVsbD4oKTtcblxuICAvLyBJbmhlcml0ZWQgZnJvbSBgQ3JpdHRlcnNgLCBidXQgbm90IGV4cG9zZWQgaW4gdGhlIHR5cGluZ3MuXG4gIHByb3RlY3RlZCBkZWNsYXJlIGVtYmVkTGlua2VkU3R5bGVzaGVldDogRW1iZWRMaW5rZWRTdHlsZXNoZWV0Rm47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zRXh0ZW5kZWQ6IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yT3B0aW9ucyAmXG4gICAgICBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NPcHRpb25zLFxuICApIHtcbiAgICBzdXBlcih7XG4gICAgICBsb2dnZXI6IHtcbiAgICAgICAgd2FybjogKHM6IHN0cmluZykgPT4gdGhpcy53YXJuaW5ncy5wdXNoKHMpLFxuICAgICAgICBlcnJvcjogKHM6IHN0cmluZykgPT4gdGhpcy5lcnJvcnMucHVzaChzKSxcbiAgICAgICAgaW5mbzogKCkgPT4ge30sXG4gICAgICB9LFxuICAgICAgbG9nTGV2ZWw6ICd3YXJuJyxcbiAgICAgIHBhdGg6IG9wdGlvbnNFeHRlbmRlZC5vdXRwdXRQYXRoLFxuICAgICAgcHVibGljUGF0aDogb3B0aW9uc0V4dGVuZGVkLmRlcGxveVVybCxcbiAgICAgIGNvbXByZXNzOiAhIW9wdGlvbnNFeHRlbmRlZC5taW5pZnksXG4gICAgICBwcnVuZVNvdXJjZTogZmFsc2UsXG4gICAgICByZWR1Y2VJbmxpbmVTdHlsZXM6IGZhbHNlLFxuICAgICAgbWVyZ2VTdHlsZXNoZWV0czogZmFsc2UsXG4gICAgICAvLyBOb3RlOiBpZiBgcHJlbG9hZGAgY2hhbmdlcyB0byBhbnl0aGluZyBvdGhlciB0aGFuIGBtZWRpYWAsIHRoZSBsb2dpYyBpblxuICAgICAgLy8gYGVtYmVkTGlua2VkU3R5bGVzaGVldE92ZXJyaWRlYCB3aWxsIGhhdmUgdG8gYmUgdXBkYXRlZC5cbiAgICAgIHByZWxvYWQ6ICdtZWRpYScsXG4gICAgICBub3NjcmlwdEZhbGxiYWNrOiB0cnVlLFxuICAgICAgaW5saW5lRm9udHM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBXZSBjYW4ndCB1c2UgaW5oZXJpdGFuY2UgdG8gb3ZlcnJpZGUgYGVtYmVkTGlua2VkU3R5bGVzaGVldGAsIGJlY2F1c2UgaXQncyBub3QgZGVjbGFyZWQgaW5cbiAgICAvLyB0aGUgYENyaXR0ZXJzYCAuZC50cyB3aGljaCBtZWFucyB0aGF0IHdlIGNhbid0IGNhbGwgdGhlIGBzdXBlcmAgaW1wbGVtZW50YXRpb24uIFRTIGRvZXNuJ3RcbiAgICAvLyBhbGxvdyBmb3IgYHN1cGVyYCB0byBiZSBjYXN0IHRvIGEgZGlmZmVyZW50IHR5cGUuXG4gICAgdGhpcy5pbml0aWFsRW1iZWRMaW5rZWRTdHlsZXNoZWV0ID0gdGhpcy5lbWJlZExpbmtlZFN0eWxlc2hlZXQ7XG4gICAgdGhpcy5lbWJlZExpbmtlZFN0eWxlc2hlZXQgPSB0aGlzLmVtYmVkTGlua2VkU3R5bGVzaGVldE92ZXJyaWRlO1xuICB9XG5cbiAgcHVibGljIG92ZXJyaWRlIHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVhZEFzc2V0ID0gdGhpcy5vcHRpb25zRXh0ZW5kZWQucmVhZEFzc2V0O1xuXG4gICAgcmV0dXJuIHJlYWRBc3NldCA/IHJlYWRBc3NldChwYXRoKSA6IHJlYWRGaWxlKHBhdGgsICd1dGYtOCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJyaWRlIG9mIHRoZSBDcml0dGVycyBgZW1iZWRMaW5rZWRTdHlsZXNoZWV0YCBtZXRob2RcbiAgICogdGhhdCBtYWtlcyBpdCB3b3JrIHdpdGggQW5ndWxhcidzIENTUCBBUElzLlxuICAgKi9cbiAgcHJpdmF0ZSBlbWJlZExpbmtlZFN0eWxlc2hlZXRPdmVycmlkZTogRW1iZWRMaW5rZWRTdHlsZXNoZWV0Rm4gPSBhc3luYyAobGluaywgZG9jdW1lbnQpID0+IHtcbiAgICBpZiAobGluay5nZXRBdHRyaWJ1dGUoJ21lZGlhJykgPT09ICdwcmludCcgJiYgbGluay5uZXh0Py5uYW1lID09PSAnbm9zY3JpcHQnKSB7XG4gICAgICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vR29vZ2xlQ2hyb21lTGFicy9jcml0dGVycy9pc3N1ZXMvNjRcbiAgICAgIC8vIE5COiB0aGlzIGlzIG9ubHkgbmVlZGVkIGZvciB0aGUgd2VicGFjayBiYXNlZCBidWlsZGVycy5cbiAgICAgIGNvbnN0IG1lZGlhID0gbGluay5nZXRBdHRyaWJ1dGUoJ29ubG9hZCcpPy5tYXRjaChNRURJQV9TRVRfSEFORExFUl9QQVRURVJOKTtcbiAgICAgIGlmIChtZWRpYSkge1xuICAgICAgICBsaW5rLnJlbW92ZUF0dHJpYnV0ZSgnb25sb2FkJyk7XG4gICAgICAgIGxpbmsuc2V0QXR0cmlidXRlKCdtZWRpYScsIG1lZGlhWzFdKTtcbiAgICAgICAgbGluaz8ubmV4dD8ucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmV0dXJuVmFsdWUgPSBhd2FpdCB0aGlzLmluaXRpYWxFbWJlZExpbmtlZFN0eWxlc2hlZXQobGluaywgZG9jdW1lbnQpO1xuICAgIGNvbnN0IGNzcE5vbmNlID0gdGhpcy5maW5kQ3NwTm9uY2UoZG9jdW1lbnQpO1xuXG4gICAgaWYgKGNzcE5vbmNlKSB7XG4gICAgICBjb25zdCBjcml0dGVyc01lZGlhID0gbGluay5nZXRBdHRyaWJ1dGUoJ29ubG9hZCcpPy5tYXRjaChNRURJQV9TRVRfSEFORExFUl9QQVRURVJOKTtcblxuICAgICAgaWYgKGNyaXR0ZXJzTWVkaWEpIHtcbiAgICAgICAgLy8gSWYgdGhlcmUncyBhIENyaXR0ZXJzLWdlbmVyYXRlZCBgb25sb2FkYCBoYW5kbGVyIGFuZCB0aGUgZmlsZSBoYXMgYW4gQW5ndWxhciBDU1Agbm9uY2UsXG4gICAgICAgIC8vIHdlIGhhdmUgdG8gcmVtb3ZlIHRoZSBoYW5kbGVyLCBiZWNhdXNlIGl0J3MgaW5jb21wYXRpYmxlIHdpdGggQ1NQLiBXZSBzYXZlIHRoZSB2YWx1ZVxuICAgICAgICAvLyBpbiBhIGRpZmZlcmVudCBhdHRyaWJ1dGUgYW5kIHdlIGdlbmVyYXRlIGEgc2NyaXB0IHRhZyB3aXRoIHRoZSBub25jZSB0aGF0IHVzZXNcbiAgICAgICAgLy8gYGFkZEV2ZW50TGlzdGVuZXJgIHRvIGFwcGx5IHRoZSBtZWRpYSBxdWVyeSBpbnN0ZWFkLlxuICAgICAgICBsaW5rLnJlbW92ZUF0dHJpYnV0ZSgnb25sb2FkJyk7XG4gICAgICAgIGxpbmsuc2V0QXR0cmlidXRlKENTUF9NRURJQV9BVFRSLCBjcml0dGVyc01lZGlhWzFdKTtcbiAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5SW5zZXJ0Q3NwTG9hZGluZ1NjcmlwdChkb2N1bWVudCwgY3NwTm9uY2UpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZGVhbGx5IHdlIHdvdWxkIGhvb2sgaW4gYXQgdGhlIHRpbWUgQ3JpdHRlcnMgaW5zZXJ0cyB0aGUgYHN0eWxlYCB0YWdzLCBidXQgdGhlcmUgaXNuJ3RcbiAgICAgIC8vIGEgd2F5IG9mIGRvaW5nIHRoYXQgYXQgdGhlIG1vbWVudCBzbyB3ZSBmYWxsIGJhY2sgdG8gZG9pbmcgaXQgYW55IHRpbWUgYSBgbGlua2AgdGFnIGlzXG4gICAgICAvLyBpbnNlcnRlZC4gV2UgbWl0aWdhdGUgaXQgYnkgb25seSBpdGVyYXRpbmcgdGhlIGRpcmVjdCBjaGlsZHJlbiBvZiB0aGUgYDxoZWFkPmAgd2hpY2hcbiAgICAgIC8vIHNob3VsZCBiZSBwcmV0dHkgc2hhbGxvdy5cbiAgICAgIGRvY3VtZW50LmhlYWQuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQpID0+IHtcbiAgICAgICAgaWYgKGNoaWxkLnRhZ05hbWUgPT09ICdzdHlsZScgJiYgIWNoaWxkLmhhc0F0dHJpYnV0ZSgnbm9uY2UnKSkge1xuICAgICAgICAgIGNoaWxkLnNldEF0dHJpYnV0ZSgnbm9uY2UnLCBjc3BOb25jZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgfTtcblxuICAvKipcbiAgICogRmluZHMgdGhlIENTUCBub25jZSBmb3IgYSBzcGVjaWZpYyBkb2N1bWVudC5cbiAgICovXG4gIHByaXZhdGUgZmluZENzcE5vbmNlKGRvY3VtZW50OiBQYXJ0aWFsRG9jdW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAodGhpcy5kb2N1bWVudE5vbmNlcy5oYXMoZG9jdW1lbnQpKSB7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgcmV0dXJuIHRoaXMuZG9jdW1lbnROb25jZXMuZ2V0KGRvY3VtZW50KSE7XG4gICAgfVxuXG4gICAgLy8gSFRNTCBhdHRyaWJ1dGUgYXJlIGNhc2UtaW5zZW5zaXRpdmUsIGJ1dCB0aGUgcGFyc2VyIHVzZWQgYnkgQ3JpdHRlcnMgaXMgY2FzZS1zZW5zaXRpdmUuXG4gICAgY29uc3Qgbm9uY2VFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25nQ3NwTm9uY2VdLCBbbmdjc3Bub25jZV0nKTtcbiAgICBjb25zdCBjc3BOb25jZSA9XG4gICAgICBub25jZUVsZW1lbnQ/LmdldEF0dHJpYnV0ZSgnbmdDc3BOb25jZScpIHx8IG5vbmNlRWxlbWVudD8uZ2V0QXR0cmlidXRlKCduZ2NzcG5vbmNlJykgfHwgbnVsbDtcblxuICAgIHRoaXMuZG9jdW1lbnROb25jZXMuc2V0KGRvY3VtZW50LCBjc3BOb25jZSk7XG5cbiAgICByZXR1cm4gY3NwTm9uY2U7XG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0cyB0aGUgYHNjcmlwdGAgdGFnIHRoYXQgc3dhcHMgdGhlIGNyaXRpY2FsIENTUyBhdCBydW50aW1lLFxuICAgKiBpZiBvbmUgaGFzbid0IGJlZW4gaW5zZXJ0ZWQgaW50byB0aGUgZG9jdW1lbnQgYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgY29uZGl0aW9uYWxseUluc2VydENzcExvYWRpbmdTY3JpcHQoZG9jdW1lbnQ6IFBhcnRpYWxEb2N1bWVudCwgbm9uY2U6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aGlzLmFkZGVkQ3NwU2NyaXB0c0RvY3VtZW50cy5oYXMoZG9jdW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnbm9uY2UnLCBub25jZSk7XG4gICAgc2NyaXB0LnRleHRDb250ZW50ID0gTElOS19MT0FEX1NDUklQVF9DT05URU5UO1xuICAgIC8vIEFwcGVuZCB0aGUgc2NyaXB0IHRvIHRoZSBoZWFkIHNpbmNlIGl0IG5lZWRzIHRvXG4gICAgLy8gcnVuIGFzIGVhcmx5IGFzIHBvc3NpYmxlLCBhZnRlciB0aGUgYGxpbmtgIHRhZ3MuXG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgIHRoaXMuYWRkZWRDc3BTY3JpcHRzRG9jdW1lbnRzLmFkZChkb2N1bWVudCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHJlYWRvbmx5IG9wdGlvbnM6IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yT3B0aW9ucykge31cblxuICBhc3luYyBwcm9jZXNzKFxuICAgIGh0bWw6IHN0cmluZyxcbiAgICBvcHRpb25zOiBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NPcHRpb25zLFxuICApOiBQcm9taXNlPHsgY29udGVudDogc3RyaW5nOyB3YXJuaW5nczogc3RyaW5nW107IGVycm9yczogc3RyaW5nW10gfT4ge1xuICAgIGNvbnN0IGNyaXR0ZXJzID0gbmV3IENyaXR0ZXJzRXh0ZW5kZWQoeyAuLi50aGlzLm9wdGlvbnMsIC4uLm9wdGlvbnMgfSk7XG4gICAgY29uc3QgY29udGVudCA9IGF3YWl0IGNyaXR0ZXJzLnByb2Nlc3MoaHRtbCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgLy8gQ2xlYW4gdXAgdmFsdWUgZnJvbSB2YWx1ZSBsZXNzIGF0dHJpYnV0ZXMuXG4gICAgICAvLyBUaGlzIGlzIGNhdXNlZCBiZWNhdXNlIHBhcnNlNSBhbHdheXMgcmVxdWlyZXMgYXR0cmlidXRlcyB0byBoYXZlIGEgc3RyaW5nIHZhbHVlLlxuICAgICAgLy8gbm9tb2R1bGU9XCJcIiBkZWZlcj1cIlwiIC0+IG5vbW9kdWxlIGRlZmVyLlxuICAgICAgY29udGVudDogY29udGVudC5yZXBsYWNlKC8oXFxzKD86ZGVmZXJ8bm9tb2R1bGUpKT1cIlwiL2csICckMScpLFxuICAgICAgZXJyb3JzOiBjcml0dGVycy5lcnJvcnMsXG4gICAgICB3YXJuaW5nczogY3JpdHRlcnMud2FybmluZ3MsXG4gICAgfTtcbiAgfVxufVxuIl19