"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPage = void 0;
const node_path_1 = require("node:path");
const inline_critical_css_1 = require("../index-file/inline-critical-css");
const load_esm_1 = require("../load-esm");
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function renderPage({ route, serverContext, document, inlineCriticalCss, outputFiles, loadBundle = load_esm_1.loadEsmModule, }) {
    const { default: bootstrapAppFnOrModule, ɵSERVER_CONTEXT, renderModule, renderApplication, ɵresetCompiledComponents, } = await loadBundle('./main.server.mjs');
    // Need to clean up GENERATED_COMP_IDS map in `@angular/core`.
    // Otherwise an incorrect component ID generation collision detected warning will be displayed in development.
    // See: https://github.com/angular/angular-cli/issues/25924
    ɵresetCompiledComponents?.();
    const platformProviders = [
        {
            provide: ɵSERVER_CONTEXT,
            useValue: serverContext,
        },
    ];
    let html;
    if (isBootstrapFn(bootstrapAppFnOrModule)) {
        html = await renderApplication(bootstrapAppFnOrModule, {
            document,
            url: route,
            platformProviders,
        });
    }
    else {
        html = await renderModule(bootstrapAppFnOrModule, {
            document,
            url: route,
            extraProviders: platformProviders,
        });
    }
    if (inlineCriticalCss) {
        const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
            minify: false,
            readAsset: async (filePath) => {
                filePath = (0, node_path_1.basename)(filePath);
                const content = outputFiles[filePath];
                if (content === undefined) {
                    throw new Error(`Output file does not exist: ${filePath}`);
                }
                return content;
            },
        });
        return inlineCriticalCssProcessor.process(html, { outputPath: '' });
    }
    return {
        content: html,
    };
}
exports.renderPage = renderPage;
function isBootstrapFn(value) {
    // We can differentiate between a module and a bootstrap function by reading compiler-generated `ɵmod` static property:
    return typeof value === 'function' && !('ɵmod' in value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHlDQUFxQztBQUNyQywyRUFBK0U7QUFDL0UsMENBQTRDO0FBb0I1Qzs7R0FFRztBQUNJLEtBQUssVUFBVSxVQUFVLENBQUMsRUFDL0IsS0FBSyxFQUNMLGFBQWEsRUFDYixRQUFRLEVBQ1IsaUJBQWlCLEVBQ2pCLFdBQVcsRUFDWCxVQUFVLEdBQUcsd0JBQWEsR0FDWjtJQUNkLE1BQU0sRUFDSixPQUFPLEVBQUUsc0JBQXNCLEVBQy9CLGVBQWUsRUFDZixZQUFZLEVBQ1osaUJBQWlCLEVBQ2pCLHdCQUF3QixHQUN6QixHQUFHLE1BQU0sVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFFMUMsOERBQThEO0lBQzlELDhHQUE4RztJQUM5RywyREFBMkQ7SUFDM0Qsd0JBQXdCLEVBQUUsRUFBRSxDQUFDO0lBRTdCLE1BQU0saUJBQWlCLEdBQXFCO1FBQzFDO1lBQ0UsT0FBTyxFQUFFLGVBQWU7WUFDeEIsUUFBUSxFQUFFLGFBQWE7U0FDeEI7S0FDRixDQUFDO0lBRUYsSUFBSSxJQUF3QixDQUFDO0lBRTdCLElBQUksYUFBYSxDQUFDLHNCQUFzQixDQUFDLEVBQUU7UUFDekMsSUFBSSxHQUFHLE1BQU0saUJBQWlCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsUUFBUTtZQUNSLEdBQUcsRUFBRSxLQUFLO1lBQ1YsaUJBQWlCO1NBQ2xCLENBQUMsQ0FBQztLQUNKO1NBQU07UUFDTCxJQUFJLEdBQUcsTUFBTSxZQUFZLENBQUMsc0JBQXNCLEVBQUU7WUFDaEQsUUFBUTtZQUNSLEdBQUcsRUFBRSxLQUFLO1lBQ1YsY0FBYyxFQUFFLGlCQUFpQjtTQUNsQyxDQUFDLENBQUM7S0FDSjtJQUVELElBQUksaUJBQWlCLEVBQUU7UUFDckIsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLGdEQUEwQixDQUFDO1lBQ2hFLE1BQU0sRUFBRSxLQUFLO1lBQ2IsU0FBUyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtnQkFDNUIsUUFBUSxHQUFHLElBQUEsb0JBQVEsRUFBQyxRQUFRLENBQUMsQ0FBQztnQkFDOUIsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUU7b0JBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLFFBQVEsRUFBRSxDQUFDLENBQUM7aUJBQzVEO2dCQUVELE9BQU8sT0FBTyxDQUFDO1lBQ2pCLENBQUM7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUNyRTtJQUVELE9BQU87UUFDTCxPQUFPLEVBQUUsSUFBSTtLQUNkLENBQUM7QUFDSixDQUFDO0FBaEVELGdDQWdFQztBQUVELFNBQVMsYUFBYSxDQUFDLEtBQWM7SUFDbkMsdUhBQXVIO0lBQ3ZILE9BQU8sT0FBTyxLQUFLLEtBQUssVUFBVSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLENBQUM7QUFDM0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEFwcGxpY2F0aW9uUmVmLCBTdGF0aWNQcm92aWRlciB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuLi9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uL2xvYWQtZXNtJztcbmltcG9ydCB7IE1haW5TZXJ2ZXJCdW5kbGVFeHBvcnRzIH0gZnJvbSAnLi9tYWluLWJ1bmRsZS1leHBvcnRzJztcblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJPcHRpb25zIHtcbiAgcm91dGU6IHN0cmluZztcbiAgc2VydmVyQ29udGV4dDogU2VydmVyQ29udGV4dDtcbiAgb3V0cHV0RmlsZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIGRvY3VtZW50OiBzdHJpbmc7XG4gIGlubGluZUNyaXRpY2FsQ3NzPzogYm9vbGVhbjtcbiAgbG9hZEJ1bmRsZT86IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8TWFpblNlcnZlckJ1bmRsZUV4cG9ydHM+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlclJlc3VsdCB7XG4gIGVycm9ycz86IHN0cmluZ1tdO1xuICB3YXJuaW5ncz86IHN0cmluZ1tdO1xuICBjb250ZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBTZXJ2ZXJDb250ZXh0ID0gJ2FwcC1zaGVsbCcgfCAnc3NnJyB8ICdzc3InO1xuXG4vKipcbiAqIFJlbmRlcnMgZWFjaCByb3V0ZSBpbiByb3V0ZXMgYW5kIHdyaXRlcyB0aGVtIHRvIDxvdXRwdXRQYXRoPi88cm91dGU+L2luZGV4Lmh0bWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5kZXJQYWdlKHtcbiAgcm91dGUsXG4gIHNlcnZlckNvbnRleHQsXG4gIGRvY3VtZW50LFxuICBpbmxpbmVDcml0aWNhbENzcyxcbiAgb3V0cHV0RmlsZXMsXG4gIGxvYWRCdW5kbGUgPSBsb2FkRXNtTW9kdWxlLFxufTogUmVuZGVyT3B0aW9ucyk6IFByb21pc2U8UmVuZGVyUmVzdWx0PiB7XG4gIGNvbnN0IHtcbiAgICBkZWZhdWx0OiBib290c3RyYXBBcHBGbk9yTW9kdWxlLFxuICAgIMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgcmVuZGVyTW9kdWxlLFxuICAgIHJlbmRlckFwcGxpY2F0aW9uLFxuICAgIMm1cmVzZXRDb21waWxlZENvbXBvbmVudHMsXG4gIH0gPSBhd2FpdCBsb2FkQnVuZGxlKCcuL21haW4uc2VydmVyLm1qcycpO1xuXG4gIC8vIE5lZWQgdG8gY2xlYW4gdXAgR0VORVJBVEVEX0NPTVBfSURTIG1hcCBpbiBgQGFuZ3VsYXIvY29yZWAuXG4gIC8vIE90aGVyd2lzZSBhbiBpbmNvcnJlY3QgY29tcG9uZW50IElEIGdlbmVyYXRpb24gY29sbGlzaW9uIGRldGVjdGVkIHdhcm5pbmcgd2lsbCBiZSBkaXNwbGF5ZWQgaW4gZGV2ZWxvcG1lbnQuXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1OTI0XG4gIMm1cmVzZXRDb21waWxlZENvbXBvbmVudHM/LigpO1xuXG4gIGNvbnN0IHBsYXRmb3JtUHJvdmlkZXJzOiBTdGF0aWNQcm92aWRlcltdID0gW1xuICAgIHtcbiAgICAgIHByb3ZpZGU6IMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgICB1c2VWYWx1ZTogc2VydmVyQ29udGV4dCxcbiAgICB9LFxuICBdO1xuXG4gIGxldCBodG1sOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgaWYgKGlzQm9vdHN0cmFwRm4oYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSkpIHtcbiAgICBodG1sID0gYXdhaXQgcmVuZGVyQXBwbGljYXRpb24oYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSwge1xuICAgICAgZG9jdW1lbnQsXG4gICAgICB1cmw6IHJvdXRlLFxuICAgICAgcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaHRtbCA9IGF3YWl0IHJlbmRlck1vZHVsZShib290c3RyYXBBcHBGbk9yTW9kdWxlLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBleHRyYVByb3ZpZGVyczogcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH1cblxuICBpZiAoaW5saW5lQ3JpdGljYWxDc3MpIHtcbiAgICBjb25zdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciA9IG5ldyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcih7XG4gICAgICBtaW5pZnk6IGZhbHNlLCAvLyBDU1MgaGFzIGFscmVhZHkgYmVlbiBtaW5pZmllZCBkdXJpbmcgdGhlIGJ1aWxkLlxuICAgICAgcmVhZEFzc2V0OiBhc3luYyAoZmlsZVBhdGgpID0+IHtcbiAgICAgICAgZmlsZVBhdGggPSBiYXNlbmFtZShmaWxlUGF0aCk7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBvdXRwdXRGaWxlc1tmaWxlUGF0aF07XG4gICAgICAgIGlmIChjb250ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke2ZpbGVQYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoaHRtbCwgeyBvdXRwdXRQYXRoOiAnJyB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29udGVudDogaHRtbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaXNCb290c3RyYXBGbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzICgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+IHtcbiAgLy8gV2UgY2FuIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBhIG1vZHVsZSBhbmQgYSBib290c3RyYXAgZnVuY3Rpb24gYnkgcmVhZGluZyBjb21waWxlci1nZW5lcmF0ZWQgYMm1bW9kYCBzdGF0aWMgcHJvcGVydHk6XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgISgnybVtb2QnIGluIHZhbHVlKTtcbn1cbiJdfQ==