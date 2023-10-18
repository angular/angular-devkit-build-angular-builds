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
exports.renderPage = void 0;
const node_path_1 = require("node:path");
const load_esm_1 = require("../load-esm");
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function renderPage({ route, serverContext, document, inlineCriticalCss, outputFiles, loadBundle = load_esm_1.loadEsmModule, }) {
    const { default: bootstrapAppFnOrModule, ɵSERVER_CONTEXT, renderModule, renderApplication, ɵresetCompiledComponents, ɵConsole, } = await loadBundle('./main.server.mjs');
    // Need to clean up GENERATED_COMP_IDS map in `@angular/core`.
    // Otherwise an incorrect component ID generation collision detected warning will be displayed in development.
    // See: https://github.com/angular/angular-cli/issues/25924
    ɵresetCompiledComponents?.();
    const platformProviders = [
        {
            provide: ɵSERVER_CONTEXT,
            useValue: serverContext,
        },
        {
            provide: ɵConsole,
            /** An Angular Console Provider that does not print a set of predefined logs. */
            useFactory: () => {
                class Console extends ɵConsole {
                    ignoredLogs = new Set(['Angular is running in development mode.']);
                    log(message) {
                        if (!this.ignoredLogs.has(message)) {
                            super.log(message);
                        }
                    }
                }
                return new Console();
            },
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
        const { InlineCriticalCssProcessor } = await Promise.resolve().then(() => __importStar(require('../../utils/index-file/inline-critical-css')));
        const inlineCriticalCssProcessor = new InlineCriticalCssProcessor({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gseUNBQXFDO0FBQ3JDLDBDQUE0QztBQW9CNUM7O0dBRUc7QUFDSSxLQUFLLFVBQVUsVUFBVSxDQUFDLEVBQy9CLEtBQUssRUFDTCxhQUFhLEVBQ2IsUUFBUSxFQUNSLGlCQUFpQixFQUNqQixXQUFXLEVBQ1gsVUFBVSxHQUFHLHdCQUFhLEdBQ1o7SUFDZCxNQUFNLEVBQ0osT0FBTyxFQUFFLHNCQUFzQixFQUMvQixlQUFlLEVBQ2YsWUFBWSxFQUNaLGlCQUFpQixFQUNqQix3QkFBd0IsRUFDeEIsUUFBUSxHQUNULEdBQUcsTUFBTSxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUUxQyw4REFBOEQ7SUFDOUQsOEdBQThHO0lBQzlHLDJEQUEyRDtJQUMzRCx3QkFBd0IsRUFBRSxFQUFFLENBQUM7SUFFN0IsTUFBTSxpQkFBaUIsR0FBcUI7UUFDMUM7WUFDRSxPQUFPLEVBQUUsZUFBZTtZQUN4QixRQUFRLEVBQUUsYUFBYTtTQUN4QjtRQUNEO1lBQ0UsT0FBTyxFQUFFLFFBQVE7WUFDakIsZ0ZBQWdGO1lBQ2hGLFVBQVUsRUFBRSxHQUFHLEVBQUU7Z0JBQ2YsTUFBTSxPQUFRLFNBQVEsUUFBUTtvQkFDWCxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNFLEdBQUcsQ0FBQyxPQUFlO3dCQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7NEJBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7eUJBQ3BCO29CQUNILENBQUM7aUJBQ0Y7Z0JBRUQsT0FBTyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLENBQUM7U0FDRjtLQUNGLENBQUM7SUFFRixJQUFJLElBQXdCLENBQUM7SUFFN0IsSUFBSSxhQUFhLENBQUMsc0JBQXNCLENBQUMsRUFBRTtRQUN6QyxJQUFJLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBRTtZQUNyRCxRQUFRO1lBQ1IsR0FBRyxFQUFFLEtBQUs7WUFDVixpQkFBaUI7U0FDbEIsQ0FBQyxDQUFDO0tBQ0o7U0FBTTtRQUNMLElBQUksR0FBRyxNQUFNLFlBQVksQ0FBQyxzQkFBc0IsRUFBRTtZQUNoRCxRQUFRO1lBQ1IsR0FBRyxFQUFFLEtBQUs7WUFDVixjQUFjLEVBQUUsaUJBQWlCO1NBQ2xDLENBQUMsQ0FBQztLQUNKO0lBRUQsSUFBSSxpQkFBaUIsRUFBRTtRQUNyQixNQUFNLEVBQUUsMEJBQTBCLEVBQUUsR0FBRyx3REFDckMsNENBQTRDLEdBQzdDLENBQUM7UUFFRixNQUFNLDBCQUEwQixHQUFHLElBQUksMEJBQTBCLENBQUM7WUFDaEUsTUFBTSxFQUFFLEtBQUs7WUFDYixTQUFTLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO2dCQUM1QixRQUFRLEdBQUcsSUFBQSxvQkFBUSxFQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM5QixNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3RDLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRTtvQkFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsUUFBUSxFQUFFLENBQUMsQ0FBQztpQkFDNUQ7Z0JBRUQsT0FBTyxPQUFPLENBQUM7WUFDakIsQ0FBQztTQUNGLENBQUMsQ0FBQztRQUVILE9BQU8sMEJBQTBCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQ3JFO0lBRUQsT0FBTztRQUNMLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztBQUNKLENBQUM7QUFyRkQsZ0NBcUZDO0FBRUQsU0FBUyxhQUFhLENBQUMsS0FBYztJQUNuQyx1SEFBdUg7SUFDdkgsT0FBTyxPQUFPLEtBQUssS0FBSyxVQUFVLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQztBQUMzRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQXBwbGljYXRpb25SZWYsIFN0YXRpY1Byb3ZpZGVyIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vbG9hZC1lc20nO1xuaW1wb3J0IHsgTWFpblNlcnZlckJ1bmRsZUV4cG9ydHMgfSBmcm9tICcuL21haW4tYnVuZGxlLWV4cG9ydHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlck9wdGlvbnMge1xuICByb3V0ZTogc3RyaW5nO1xuICBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0O1xuICBvdXRwdXRGaWxlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgZG9jdW1lbnQ6IHN0cmluZztcbiAgaW5saW5lQ3JpdGljYWxDc3M/OiBib29sZWFuO1xuICBsb2FkQnVuZGxlPzogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxNYWluU2VydmVyQnVuZGxlRXhwb3J0cz47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyUmVzdWx0IHtcbiAgZXJyb3JzPzogc3RyaW5nW107XG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFNlcnZlckNvbnRleHQgPSAnYXBwLXNoZWxsJyB8ICdzc2cnIHwgJ3Nzcic7XG5cbi8qKlxuICogUmVuZGVycyBlYWNoIHJvdXRlIGluIHJvdXRlcyBhbmQgd3JpdGVzIHRoZW0gdG8gPG91dHB1dFBhdGg+Lzxyb3V0ZT4vaW5kZXguaHRtbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbmRlclBhZ2Uoe1xuICByb3V0ZSxcbiAgc2VydmVyQ29udGV4dCxcbiAgZG9jdW1lbnQsXG4gIGlubGluZUNyaXRpY2FsQ3NzLFxuICBvdXRwdXRGaWxlcyxcbiAgbG9hZEJ1bmRsZSA9IGxvYWRFc21Nb2R1bGUsXG59OiBSZW5kZXJPcHRpb25zKTogUHJvbWlzZTxSZW5kZXJSZXN1bHQ+IHtcbiAgY29uc3Qge1xuICAgIGRlZmF1bHQ6IGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUsXG4gICAgybVTRVJWRVJfQ09OVEVYVCxcbiAgICByZW5kZXJNb2R1bGUsXG4gICAgcmVuZGVyQXBwbGljYXRpb24sXG4gICAgybVyZXNldENvbXBpbGVkQ29tcG9uZW50cyxcbiAgICDJtUNvbnNvbGUsXG4gIH0gPSBhd2FpdCBsb2FkQnVuZGxlKCcuL21haW4uc2VydmVyLm1qcycpO1xuXG4gIC8vIE5lZWQgdG8gY2xlYW4gdXAgR0VORVJBVEVEX0NPTVBfSURTIG1hcCBpbiBgQGFuZ3VsYXIvY29yZWAuXG4gIC8vIE90aGVyd2lzZSBhbiBpbmNvcnJlY3QgY29tcG9uZW50IElEIGdlbmVyYXRpb24gY29sbGlzaW9uIGRldGVjdGVkIHdhcm5pbmcgd2lsbCBiZSBkaXNwbGF5ZWQgaW4gZGV2ZWxvcG1lbnQuXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1OTI0XG4gIMm1cmVzZXRDb21waWxlZENvbXBvbmVudHM/LigpO1xuXG4gIGNvbnN0IHBsYXRmb3JtUHJvdmlkZXJzOiBTdGF0aWNQcm92aWRlcltdID0gW1xuICAgIHtcbiAgICAgIHByb3ZpZGU6IMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgICB1c2VWYWx1ZTogc2VydmVyQ29udGV4dCxcbiAgICB9LFxuICAgIHtcbiAgICAgIHByb3ZpZGU6IMm1Q29uc29sZSxcbiAgICAgIC8qKiBBbiBBbmd1bGFyIENvbnNvbGUgUHJvdmlkZXIgdGhhdCBkb2VzIG5vdCBwcmludCBhIHNldCBvZiBwcmVkZWZpbmVkIGxvZ3MuICovXG4gICAgICB1c2VGYWN0b3J5OiAoKSA9PiB7XG4gICAgICAgIGNsYXNzIENvbnNvbGUgZXh0ZW5kcyDJtUNvbnNvbGUge1xuICAgICAgICAgIHByaXZhdGUgcmVhZG9ubHkgaWdub3JlZExvZ3MgPSBuZXcgU2V0KFsnQW5ndWxhciBpcyBydW5uaW5nIGluIGRldmVsb3BtZW50IG1vZGUuJ10pO1xuICAgICAgICAgIG92ZXJyaWRlIGxvZyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5pZ25vcmVkTG9ncy5oYXMobWVzc2FnZSkpIHtcbiAgICAgICAgICAgICAgc3VwZXIubG9nKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgQ29uc29sZSgpO1xuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGxldCBodG1sOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgaWYgKGlzQm9vdHN0cmFwRm4oYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSkpIHtcbiAgICBodG1sID0gYXdhaXQgcmVuZGVyQXBwbGljYXRpb24oYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSwge1xuICAgICAgZG9jdW1lbnQsXG4gICAgICB1cmw6IHJvdXRlLFxuICAgICAgcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaHRtbCA9IGF3YWl0IHJlbmRlck1vZHVsZShib290c3RyYXBBcHBGbk9yTW9kdWxlLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBleHRyYVByb3ZpZGVyczogcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH1cblxuICBpZiAoaW5saW5lQ3JpdGljYWxDc3MpIHtcbiAgICBjb25zdCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJ1xuICAgICk7XG5cbiAgICBjb25zdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciA9IG5ldyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcih7XG4gICAgICBtaW5pZnk6IGZhbHNlLCAvLyBDU1MgaGFzIGFscmVhZHkgYmVlbiBtaW5pZmllZCBkdXJpbmcgdGhlIGJ1aWxkLlxuICAgICAgcmVhZEFzc2V0OiBhc3luYyAoZmlsZVBhdGgpID0+IHtcbiAgICAgICAgZmlsZVBhdGggPSBiYXNlbmFtZShmaWxlUGF0aCk7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBvdXRwdXRGaWxlc1tmaWxlUGF0aF07XG4gICAgICAgIGlmIChjb250ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke2ZpbGVQYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoaHRtbCwgeyBvdXRwdXRQYXRoOiAnJyB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29udGVudDogaHRtbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaXNCb290c3RyYXBGbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzICgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+IHtcbiAgLy8gV2UgY2FuIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBhIG1vZHVsZSBhbmQgYSBib290c3RyYXAgZnVuY3Rpb24gYnkgcmVhZGluZyBjb21waWxlci1nZW5lcmF0ZWQgYMm1bW9kYCBzdGF0aWMgcHJvcGVydHk6XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgISgnybVtb2QnIGluIHZhbHVlKTtcbn1cbiJdfQ==