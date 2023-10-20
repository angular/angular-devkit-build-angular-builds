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
    const { default: bootstrapAppFnOrModule } = await loadBundle('./main.server.mjs');
    const { ɵSERVER_CONTEXT, renderModule, renderApplication, ɵresetCompiledComponents, ɵConsole } = await loadBundle('./render-utils.server.mjs');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gseUNBQXFDO0FBQ3JDLDBDQUE0QztBQXFCNUM7O0dBRUc7QUFDSSxLQUFLLFVBQVUsVUFBVSxDQUFDLEVBQy9CLEtBQUssRUFDTCxhQUFhLEVBQ2IsUUFBUSxFQUNSLGlCQUFpQixFQUNqQixXQUFXLEVBQ1gsVUFBVSxHQUFHLHdCQUFhLEdBQ1o7SUFDZCxNQUFNLEVBQUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLEdBQUcsTUFBTSxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUNsRixNQUFNLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSx3QkFBd0IsRUFBRSxRQUFRLEVBQUUsR0FDNUYsTUFBTSxVQUFVLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUVoRCw4REFBOEQ7SUFDOUQsOEdBQThHO0lBQzlHLDJEQUEyRDtJQUMzRCx3QkFBd0IsRUFBRSxFQUFFLENBQUM7SUFFN0IsTUFBTSxpQkFBaUIsR0FBcUI7UUFDMUM7WUFDRSxPQUFPLEVBQUUsZUFBZTtZQUN4QixRQUFRLEVBQUUsYUFBYTtTQUN4QjtRQUNEO1lBQ0UsT0FBTyxFQUFFLFFBQVE7WUFDakIsZ0ZBQWdGO1lBQ2hGLFVBQVUsRUFBRSxHQUFHLEVBQUU7Z0JBQ2YsTUFBTSxPQUFRLFNBQVEsUUFBUTtvQkFDWCxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNFLEdBQUcsQ0FBQyxPQUFlO3dCQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7NEJBQ2xDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7eUJBQ3BCO29CQUNILENBQUM7aUJBQ0Y7Z0JBRUQsT0FBTyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLENBQUM7U0FDRjtLQUNGLENBQUM7SUFFRixJQUFJLElBQXdCLENBQUM7SUFFN0IsSUFBSSxhQUFhLENBQUMsc0JBQXNCLENBQUMsRUFBRTtRQUN6QyxJQUFJLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBRTtZQUNyRCxRQUFRO1lBQ1IsR0FBRyxFQUFFLEtBQUs7WUFDVixpQkFBaUI7U0FDbEIsQ0FBQyxDQUFDO0tBQ0o7U0FBTTtRQUNMLElBQUksR0FBRyxNQUFNLFlBQVksQ0FBQyxzQkFBc0IsRUFBRTtZQUNoRCxRQUFRO1lBQ1IsR0FBRyxFQUFFLEtBQUs7WUFDVixjQUFjLEVBQUUsaUJBQWlCO1NBQ2xDLENBQUMsQ0FBQztLQUNKO0lBRUQsSUFBSSxpQkFBaUIsRUFBRTtRQUNyQixNQUFNLEVBQUUsMEJBQTBCLEVBQUUsR0FBRyx3REFDckMsNENBQTRDLEdBQzdDLENBQUM7UUFFRixNQUFNLDBCQUEwQixHQUFHLElBQUksMEJBQTBCLENBQUM7WUFDaEUsTUFBTSxFQUFFLEtBQUs7WUFDYixTQUFTLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO2dCQUM1QixRQUFRLEdBQUcsSUFBQSxvQkFBUSxFQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM5QixNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3RDLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRTtvQkFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsUUFBUSxFQUFFLENBQUMsQ0FBQztpQkFDNUQ7Z0JBRUQsT0FBTyxPQUFPLENBQUM7WUFDakIsQ0FBQztTQUNGLENBQUMsQ0FBQztRQUVILE9BQU8sMEJBQTBCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQ3JFO0lBRUQsT0FBTztRQUNMLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztBQUNKLENBQUM7QUFoRkQsZ0NBZ0ZDO0FBRUQsU0FBUyxhQUFhLENBQUMsS0FBYztJQUNuQyx1SEFBdUg7SUFDdkgsT0FBTyxPQUFPLEtBQUssS0FBSyxVQUFVLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQztBQUMzRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQXBwbGljYXRpb25SZWYsIFN0YXRpY1Byb3ZpZGVyIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vbG9hZC1lc20nO1xuaW1wb3J0IHsgTWFpblNlcnZlckJ1bmRsZUV4cG9ydHMsIFJlbmRlclV0aWxzU2VydmVyQnVuZGxlRXhwb3J0cyB9IGZyb20gJy4vbWFpbi1idW5kbGUtZXhwb3J0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyT3B0aW9ucyB7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIHNlcnZlckNvbnRleHQ6IFNlcnZlckNvbnRleHQ7XG4gIG91dHB1dEZpbGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBkb2N1bWVudDogc3RyaW5nO1xuICBpbmxpbmVDcml0aWNhbENzcz86IGJvb2xlYW47XG4gIGxvYWRCdW5kbGU/OiAoKHBhdGg6ICcuL21haW4uc2VydmVyLm1qcycpID0+IFByb21pc2U8TWFpblNlcnZlckJ1bmRsZUV4cG9ydHM+KSAmXG4gICAgKChwYXRoOiAnLi9yZW5kZXItdXRpbHMuc2VydmVyLm1qcycpID0+IFByb21pc2U8UmVuZGVyVXRpbHNTZXJ2ZXJCdW5kbGVFeHBvcnRzPik7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyUmVzdWx0IHtcbiAgZXJyb3JzPzogc3RyaW5nW107XG4gIHdhcm5pbmdzPzogc3RyaW5nW107XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFNlcnZlckNvbnRleHQgPSAnYXBwLXNoZWxsJyB8ICdzc2cnIHwgJ3Nzcic7XG5cbi8qKlxuICogUmVuZGVycyBlYWNoIHJvdXRlIGluIHJvdXRlcyBhbmQgd3JpdGVzIHRoZW0gdG8gPG91dHB1dFBhdGg+Lzxyb3V0ZT4vaW5kZXguaHRtbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbmRlclBhZ2Uoe1xuICByb3V0ZSxcbiAgc2VydmVyQ29udGV4dCxcbiAgZG9jdW1lbnQsXG4gIGlubGluZUNyaXRpY2FsQ3NzLFxuICBvdXRwdXRGaWxlcyxcbiAgbG9hZEJ1bmRsZSA9IGxvYWRFc21Nb2R1bGUsXG59OiBSZW5kZXJPcHRpb25zKTogUHJvbWlzZTxSZW5kZXJSZXN1bHQ+IHtcbiAgY29uc3QgeyBkZWZhdWx0OiBib290c3RyYXBBcHBGbk9yTW9kdWxlIH0gPSBhd2FpdCBsb2FkQnVuZGxlKCcuL21haW4uc2VydmVyLm1qcycpO1xuICBjb25zdCB7IMm1U0VSVkVSX0NPTlRFWFQsIHJlbmRlck1vZHVsZSwgcmVuZGVyQXBwbGljYXRpb24sIMm1cmVzZXRDb21waWxlZENvbXBvbmVudHMsIMm1Q29uc29sZSB9ID1cbiAgICBhd2FpdCBsb2FkQnVuZGxlKCcuL3JlbmRlci11dGlscy5zZXJ2ZXIubWpzJyk7XG5cbiAgLy8gTmVlZCB0byBjbGVhbiB1cCBHRU5FUkFURURfQ09NUF9JRFMgbWFwIGluIGBAYW5ndWxhci9jb3JlYC5cbiAgLy8gT3RoZXJ3aXNlIGFuIGluY29ycmVjdCBjb21wb25lbnQgSUQgZ2VuZXJhdGlvbiBjb2xsaXNpb24gZGV0ZWN0ZWQgd2FybmluZyB3aWxsIGJlIGRpc3BsYXllZCBpbiBkZXZlbG9wbWVudC5cbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU5MjRcbiAgybVyZXNldENvbXBpbGVkQ29tcG9uZW50cz8uKCk7XG5cbiAgY29uc3QgcGxhdGZvcm1Qcm92aWRlcnM6IFN0YXRpY1Byb3ZpZGVyW10gPSBbXG4gICAge1xuICAgICAgcHJvdmlkZTogybVTRVJWRVJfQ09OVEVYVCxcbiAgICAgIHVzZVZhbHVlOiBzZXJ2ZXJDb250ZXh0LFxuICAgIH0sXG4gICAge1xuICAgICAgcHJvdmlkZTogybVDb25zb2xlLFxuICAgICAgLyoqIEFuIEFuZ3VsYXIgQ29uc29sZSBQcm92aWRlciB0aGF0IGRvZXMgbm90IHByaW50IGEgc2V0IG9mIHByZWRlZmluZWQgbG9ncy4gKi9cbiAgICAgIHVzZUZhY3Rvcnk6ICgpID0+IHtcbiAgICAgICAgY2xhc3MgQ29uc29sZSBleHRlbmRzIMm1Q29uc29sZSB7XG4gICAgICAgICAgcHJpdmF0ZSByZWFkb25seSBpZ25vcmVkTG9ncyA9IG5ldyBTZXQoWydBbmd1bGFyIGlzIHJ1bm5pbmcgaW4gZGV2ZWxvcG1lbnQgbW9kZS4nXSk7XG4gICAgICAgICAgb3ZlcnJpZGUgbG9nKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmlnbm9yZWRMb2dzLmhhcyhtZXNzYWdlKSkge1xuICAgICAgICAgICAgICBzdXBlci5sb2cobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBDb25zb2xlKCk7XG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgbGV0IGh0bWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICBpZiAoaXNCb290c3RyYXBGbihib290c3RyYXBBcHBGbk9yTW9kdWxlKSkge1xuICAgIGh0bWwgPSBhd2FpdCByZW5kZXJBcHBsaWNhdGlvbihib290c3RyYXBBcHBGbk9yTW9kdWxlLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlKGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUsIHtcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdXJsOiByb3V0ZSxcbiAgICAgIGV4dHJhUHJvdmlkZXJzOiBwbGF0Zm9ybVByb3ZpZGVycyxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChpbmxpbmVDcml0aWNhbENzcykge1xuICAgIGNvbnN0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICcuLi8uLi91dGlscy9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnXG4gICAgKTtcblxuICAgIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICAgIG1pbmlmeTogZmFsc2UsIC8vIENTUyBoYXMgYWxyZWFkeSBiZWVuIG1pbmlmaWVkIGR1cmluZyB0aGUgYnVpbGQuXG4gICAgICByZWFkQXNzZXQ6IGFzeW5jIChmaWxlUGF0aCkgPT4ge1xuICAgICAgICBmaWxlUGF0aCA9IGJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgICAgY29uc3QgY29udGVudCA9IG91dHB1dEZpbGVzW2ZpbGVQYXRoXTtcbiAgICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7IG91dHB1dFBhdGg6ICcnIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjb250ZW50OiBodG1sLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0Jvb3RzdHJhcEZuKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4ge1xuICAvLyBXZSBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgbW9kdWxlIGFuZCBhIGJvb3RzdHJhcCBmdW5jdGlvbiBieSByZWFkaW5nIGNvbXBpbGVyLWdlbmVyYXRlZCBgybVtb2RgIHN0YXRpYyBwcm9wZXJ0eTpcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhKCfJtW1vZCcgaW4gdmFsdWUpO1xufVxuIl19