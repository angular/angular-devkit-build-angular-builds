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
    const { default: bootstrapAppFnOrModule, ɵSERVER_CONTEXT, renderModule, renderApplication, } = await loadBundle('./main.server.mjs');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILHlDQUFxQztBQUNyQywyRUFBK0U7QUFDL0UsMENBQTRDO0FBb0I1Qzs7R0FFRztBQUNJLEtBQUssVUFBVSxVQUFVLENBQUMsRUFDL0IsS0FBSyxFQUNMLGFBQWEsRUFDYixRQUFRLEVBQ1IsaUJBQWlCLEVBQ2pCLFdBQVcsRUFDWCxVQUFVLEdBQUcsd0JBQWEsR0FDWjtJQUNkLE1BQU0sRUFDSixPQUFPLEVBQUUsc0JBQXNCLEVBQy9CLGVBQWUsRUFDZixZQUFZLEVBQ1osaUJBQWlCLEdBQ2xCLEdBQUcsTUFBTSxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUUxQyxNQUFNLGlCQUFpQixHQUFxQjtRQUMxQztZQUNFLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLFFBQVEsRUFBRSxhQUFhO1NBQ3hCO0tBQ0YsQ0FBQztJQUVGLElBQUksSUFBd0IsQ0FBQztJQUU3QixJQUFJLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO1FBQ3pDLElBQUksR0FBRyxNQUFNLGlCQUFpQixDQUFDLHNCQUFzQixFQUFFO1lBQ3JELFFBQVE7WUFDUixHQUFHLEVBQUUsS0FBSztZQUNWLGlCQUFpQjtTQUNsQixDQUFDLENBQUM7S0FDSjtTQUFNO1FBQ0wsSUFBSSxHQUFHLE1BQU0sWUFBWSxDQUFDLHNCQUFzQixFQUFFO1lBQ2hELFFBQVE7WUFDUixHQUFHLEVBQUUsS0FBSztZQUNWLGNBQWMsRUFBRSxpQkFBaUI7U0FDbEMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLGlCQUFpQixFQUFFO1FBQ3JCLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxnREFBMEIsQ0FBQztZQUNoRSxNQUFNLEVBQUUsS0FBSztZQUNiLFNBQVMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUU7Z0JBQzVCLFFBQVEsR0FBRyxJQUFBLG9CQUFRLEVBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzlCLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFO29CQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixRQUFRLEVBQUUsQ0FBQyxDQUFDO2lCQUM1RDtnQkFFRCxPQUFPLE9BQU8sQ0FBQztZQUNqQixDQUFDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsT0FBTywwQkFBMEIsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7S0FDckU7SUFFRCxPQUFPO1FBQ0wsT0FBTyxFQUFFLElBQUk7S0FDZCxDQUFDO0FBQ0osQ0FBQztBQTFERCxnQ0EwREM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxLQUFjO0lBQ25DLHVIQUF1SDtJQUN2SCxPQUFPLE9BQU8sS0FBSyxLQUFLLFVBQVUsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDO0FBQzNELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvblJlZiwgU3RhdGljUHJvdmlkZXIgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi4vaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi9sb2FkLWVzbSc7XG5pbXBvcnQgeyBNYWluU2VydmVyQnVuZGxlRXhwb3J0cyB9IGZyb20gJy4vbWFpbi1idW5kbGUtZXhwb3J0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyT3B0aW9ucyB7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIHNlcnZlckNvbnRleHQ6IFNlcnZlckNvbnRleHQ7XG4gIG91dHB1dEZpbGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBkb2N1bWVudDogc3RyaW5nO1xuICBpbmxpbmVDcml0aWNhbENzcz86IGJvb2xlYW47XG4gIGxvYWRCdW5kbGU/OiAocGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPE1haW5TZXJ2ZXJCdW5kbGVFeHBvcnRzPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJSZXN1bHQge1xuICBlcnJvcnM/OiBzdHJpbmdbXTtcbiAgd2FybmluZ3M/OiBzdHJpbmdbXTtcbiAgY29udGVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgU2VydmVyQ29udGV4dCA9ICdhcHAtc2hlbGwnIHwgJ3NzZycgfCAnc3NyJztcblxuLyoqXG4gKiBSZW5kZXJzIGVhY2ggcm91dGUgaW4gcm91dGVzIGFuZCB3cml0ZXMgdGhlbSB0byA8b3V0cHV0UGF0aD4vPHJvdXRlPi9pbmRleC5odG1sLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuZGVyUGFnZSh7XG4gIHJvdXRlLFxuICBzZXJ2ZXJDb250ZXh0LFxuICBkb2N1bWVudCxcbiAgaW5saW5lQ3JpdGljYWxDc3MsXG4gIG91dHB1dEZpbGVzLFxuICBsb2FkQnVuZGxlID0gbG9hZEVzbU1vZHVsZSxcbn06IFJlbmRlck9wdGlvbnMpOiBQcm9taXNlPFJlbmRlclJlc3VsdD4ge1xuICBjb25zdCB7XG4gICAgZGVmYXVsdDogYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSxcbiAgICDJtVNFUlZFUl9DT05URVhULFxuICAgIHJlbmRlck1vZHVsZSxcbiAgICByZW5kZXJBcHBsaWNhdGlvbixcbiAgfSA9IGF3YWl0IGxvYWRCdW5kbGUoJy4vbWFpbi5zZXJ2ZXIubWpzJyk7XG5cbiAgY29uc3QgcGxhdGZvcm1Qcm92aWRlcnM6IFN0YXRpY1Byb3ZpZGVyW10gPSBbXG4gICAge1xuICAgICAgcHJvdmlkZTogybVTRVJWRVJfQ09OVEVYVCxcbiAgICAgIHVzZVZhbHVlOiBzZXJ2ZXJDb250ZXh0LFxuICAgIH0sXG4gIF07XG5cbiAgbGV0IGh0bWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICBpZiAoaXNCb290c3RyYXBGbihib290c3RyYXBBcHBGbk9yTW9kdWxlKSkge1xuICAgIGh0bWwgPSBhd2FpdCByZW5kZXJBcHBsaWNhdGlvbihib290c3RyYXBBcHBGbk9yTW9kdWxlLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlKGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUsIHtcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdXJsOiByb3V0ZSxcbiAgICAgIGV4dHJhUHJvdmlkZXJzOiBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChpbmxpbmVDcml0aWNhbENzcykge1xuICAgIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICAgIG1pbmlmeTogZmFsc2UsIC8vIENTUyBoYXMgYWxyZWFkeSBiZWVuIG1pbmlmaWVkIGR1cmluZyB0aGUgYnVpbGQuXG4gICAgICByZWFkQXNzZXQ6IGFzeW5jIChmaWxlUGF0aCkgPT4ge1xuICAgICAgICBmaWxlUGF0aCA9IGJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgICAgY29uc3QgY29udGVudCA9IG91dHB1dEZpbGVzW2ZpbGVQYXRoXTtcbiAgICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7IG91dHB1dFBhdGg6ICcnIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjb250ZW50OiBodG1sLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0Jvb3RzdHJhcEZuKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4ge1xuICAvLyBXZSBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgbW9kdWxlIGFuZCBhIGJvb3RzdHJhcCBmdW5jdGlvbiBieSByZWFkaW5nIGNvbXBpbGVyLWdlbmVyYXRlZCBgybVtb2RgIHN0YXRpYyBwcm9wZXJ0eTpcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhKCfJtW1vZCcgaW4gdmFsdWUpO1xufVxuIl19