"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@babel/core");
const promises_1 = require("node:fs/promises");
const application_1 = __importDefault(require("../../babel/presets/application"));
const webpack_loader_1 = require("../../babel/webpack-loader");
const load_esm_1 = require("../../utils/load-esm");
async function transformJavaScript(request) {
    request.data ?? (request.data = await (0, promises_1.readFile)(request.filename, 'utf-8'));
    const transformedData = await transformWithBabel(request);
    return Buffer.from(transformedData, 'utf-8');
}
exports.default = transformJavaScript;
let linkerPluginCreator;
async function transformWithBabel({ filename, data, ...options }) {
    const forceAsyncTransformation = options.forceAsyncTransformation ??
        (!/[\\/][_f]?esm2015[\\/]/.test(filename) && /async(?:\s+function)?\s*\*/.test(data));
    const shouldLink = !options.skipLinker && (await (0, webpack_loader_1.requiresLinking)(filename, data));
    const useInputSourcemap = options.sourcemap &&
        (!!options.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(filename));
    // If no additional transformations are needed, return the data directly
    if (!forceAsyncTransformation && !options.advancedOptimizations && !shouldLink) {
        // Strip sourcemaps if they should not be used
        return useInputSourcemap ? data : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '');
    }
    const angularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(filename);
    // Lazy load the linker plugin only when linking is required
    if (shouldLink) {
        linkerPluginCreator ?? (linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin);
    }
    const result = await (0, core_1.transformAsync)(data, {
        filename,
        inputSourceMap: (useInputSourcemap ? undefined : false),
        sourceMaps: options.sourcemap ? 'inline' : false,
        compact: false,
        configFile: false,
        babelrc: false,
        browserslistConfigFile: false,
        plugins: [],
        presets: [
            [
                application_1.default,
                {
                    angularLinker: linkerPluginCreator && {
                        shouldLink,
                        jitMode: options.jit,
                        linkerPluginCreator,
                    },
                    forceAsyncTransformation,
                    optimize: options.advancedOptimizations && {
                        looseEnums: angularPackage,
                        pureTopLevel: angularPackage,
                    },
                },
            ],
        ],
    });
    return result?.code ?? data;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7QUFFSCxzQ0FBNkM7QUFDN0MsK0NBQTRDO0FBQzVDLGtGQUF1RTtBQUN2RSwrREFBNkQ7QUFDN0QsbURBQXFEO0FBYXRDLEtBQUssVUFBVSxtQkFBbUIsQ0FDL0MsT0FBbUM7SUFFbkMsT0FBTyxDQUFDLElBQUksS0FBWixPQUFPLENBQUMsSUFBSSxHQUFLLE1BQU0sSUFBQSxtQkFBUSxFQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEVBQUM7SUFDM0QsTUFBTSxlQUFlLEdBQUcsTUFBTSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUUxRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFQRCxzQ0FPQztBQUVELElBQUksbUJBRVMsQ0FBQztBQUVkLEtBQUssVUFBVSxrQkFBa0IsQ0FBQyxFQUNoQyxRQUFRLEVBQ1IsSUFBSSxFQUNKLEdBQUcsT0FBTyxFQUNpQjtJQUMzQixNQUFNLHdCQUF3QixHQUM1QixPQUFPLENBQUMsd0JBQXdCO1FBQ2hDLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksNEJBQTRCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEYsTUFBTSxVQUFVLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLENBQUMsTUFBTSxJQUFBLGdDQUFlLEVBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEYsTUFBTSxpQkFBaUIsR0FDckIsT0FBTyxDQUFDLFNBQVM7UUFDakIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLG9CQUFvQixJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFFL0Usd0VBQXdFO0lBQ3hFLElBQUksQ0FBQyx3QkFBd0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLFVBQVUsRUFBRTtRQUM5RSw4Q0FBOEM7UUFDOUMsT0FBTyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG9DQUFvQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQzFGO0lBRUQsTUFBTSxjQUFjLEdBQUcscUNBQXFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTVFLDREQUE0RDtJQUM1RCxJQUFJLFVBQVUsRUFBRTtRQUNkLG1CQUFtQixLQUFuQixtQkFBbUIsR0FBSyxDQUN0QixNQUFNLElBQUEsd0JBQWEsRUFDakIsb0NBQW9DLENBQ3JDLENBQ0YsQ0FBQyx3QkFBd0IsRUFBQztLQUM1QjtJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxxQkFBYyxFQUFDLElBQUksRUFBRTtRQUN4QyxRQUFRO1FBQ1IsY0FBYyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFjO1FBQ3BFLFVBQVUsRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUs7UUFDaEQsT0FBTyxFQUFFLEtBQUs7UUFDZCxVQUFVLEVBQUUsS0FBSztRQUNqQixPQUFPLEVBQUUsS0FBSztRQUNkLHNCQUFzQixFQUFFLEtBQUs7UUFDN0IsT0FBTyxFQUFFLEVBQUU7UUFDWCxPQUFPLEVBQUU7WUFDUDtnQkFDRSxxQkFBd0I7Z0JBQ3hCO29CQUNFLGFBQWEsRUFBRSxtQkFBbUIsSUFBSTt3QkFDcEMsVUFBVTt3QkFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUc7d0JBQ3BCLG1CQUFtQjtxQkFDcEI7b0JBQ0Qsd0JBQXdCO29CQUN4QixRQUFRLEVBQUUsT0FBTyxDQUFDLHFCQUFxQixJQUFJO3dCQUN6QyxVQUFVLEVBQUUsY0FBYzt3QkFDMUIsWUFBWSxFQUFFLGNBQWM7cUJBQzdCO2lCQUNGO2FBQ0Y7U0FDRjtLQUNGLENBQUMsQ0FBQztJQUVILE9BQU8sTUFBTSxFQUFFLElBQUksSUFBSSxJQUFJLENBQUM7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyB0cmFuc2Zvcm1Bc3luYyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0IGZyb20gJy4uLy4uL2JhYmVsL3ByZXNldHMvYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgcmVxdWlyZXNMaW5raW5nIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcblxuaW50ZXJmYWNlIEphdmFTY3JpcHRUcmFuc2Zvcm1SZXF1ZXN0IHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgZGF0YTogc3RyaW5nO1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzOiBib29sZWFuO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM6IGJvb2xlYW47XG4gIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbj86IGJvb2xlYW47XG4gIHNraXBMaW5rZXI6IGJvb2xlYW47XG4gIGppdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gdHJhbnNmb3JtSmF2YVNjcmlwdChcbiAgcmVxdWVzdDogSmF2YVNjcmlwdFRyYW5zZm9ybVJlcXVlc3QsXG4pOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgcmVxdWVzdC5kYXRhID8/PSBhd2FpdCByZWFkRmlsZShyZXF1ZXN0LmZpbGVuYW1lLCAndXRmLTgnKTtcbiAgY29uc3QgdHJhbnNmb3JtZWREYXRhID0gYXdhaXQgdHJhbnNmb3JtV2l0aEJhYmVsKHJlcXVlc3QpO1xuXG4gIHJldHVybiBCdWZmZXIuZnJvbSh0cmFuc2Zvcm1lZERhdGEsICd1dGYtOCcpO1xufVxuXG5sZXQgbGlua2VyUGx1Z2luQ3JlYXRvcjpcbiAgfCB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4gIHwgdW5kZWZpbmVkO1xuXG5hc3luYyBmdW5jdGlvbiB0cmFuc2Zvcm1XaXRoQmFiZWwoe1xuICBmaWxlbmFtZSxcbiAgZGF0YSxcbiAgLi4ub3B0aW9uc1xufTogSmF2YVNjcmlwdFRyYW5zZm9ybVJlcXVlc3QpOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgIG9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID8/XG4gICAgKCEvW1xcXFwvXVtfZl0/ZXNtMjAxNVtcXFxcL10vLnRlc3QoZmlsZW5hbWUpICYmIC9hc3luYyg/OlxccytmdW5jdGlvbik/XFxzKlxcKi8udGVzdChkYXRhKSk7XG4gIGNvbnN0IHNob3VsZExpbmsgPSAhb3B0aW9ucy5za2lwTGlua2VyICYmIChhd2FpdCByZXF1aXJlc0xpbmtpbmcoZmlsZW5hbWUsIGRhdGEpKTtcbiAgY29uc3QgdXNlSW5wdXRTb3VyY2VtYXAgPVxuICAgIG9wdGlvbnMuc291cmNlbWFwICYmXG4gICAgKCEhb3B0aW9ucy50aGlyZFBhcnR5U291cmNlbWFwcyB8fCAhL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKSk7XG5cbiAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBkYXRhIGRpcmVjdGx5XG4gIGlmICghZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uICYmICFvcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiAhc2hvdWxkTGluaykge1xuICAgIC8vIFN0cmlwIHNvdXJjZW1hcHMgaWYgdGhleSBzaG91bGQgbm90IGJlIHVzZWRcbiAgICByZXR1cm4gdXNlSW5wdXRTb3VyY2VtYXAgPyBkYXRhIDogZGF0YS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKTtcbiAgfVxuXG4gIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKTtcblxuICAvLyBMYXp5IGxvYWQgdGhlIGxpbmtlciBwbHVnaW4gb25seSB3aGVuIGxpbmtpbmcgaXMgcmVxdWlyZWRcbiAgaWYgKHNob3VsZExpbmspIHtcbiAgICBsaW5rZXJQbHVnaW5DcmVhdG9yID8/PSAoXG4gICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgIClcbiAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGRhdGEsIHtcbiAgICBmaWxlbmFtZSxcbiAgICBpbnB1dFNvdXJjZU1hcDogKHVzZUlucHV0U291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICBzb3VyY2VNYXBzOiBvcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgY29tcGFjdDogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgcGx1Z2luczogW10sXG4gICAgcHJlc2V0czogW1xuICAgICAgW1xuICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgIHtcbiAgICAgICAgICBhbmd1bGFyTGlua2VyOiBsaW5rZXJQbHVnaW5DcmVhdG9yICYmIHtcbiAgICAgICAgICAgIHNob3VsZExpbmssXG4gICAgICAgICAgICBqaXRNb2RlOiBvcHRpb25zLmppdCxcbiAgICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24sXG4gICAgICAgICAgb3B0aW1pemU6IG9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHtcbiAgICAgICAgICAgIGxvb3NlRW51bXM6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgICAgcHVyZVRvcExldmVsOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICBdLFxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0Py5jb2RlID8/IGRhdGE7XG59XG4iXX0=