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
    var _a;
    (_a = request.data) !== null && _a !== void 0 ? _a : (request.data = await (0, promises_1.readFile)(request.filename, 'utf-8'));
    const transformedData = await transformWithBabel(request);
    return Buffer.from(transformedData, 'utf-8');
}
exports.default = transformJavaScript;
let linkerPluginCreator;
async function transformWithBabel({ filename, data, ...options }) {
    var _a, _b;
    const forceAsyncTransformation = (_a = options.forceAsyncTransformation) !== null && _a !== void 0 ? _a : (!/[\\/][_f]?esm2015[\\/]/.test(filename) && /async(?:\s+function)?\s*\*/.test(data));
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
        linkerPluginCreator !== null && linkerPluginCreator !== void 0 ? linkerPluginCreator : (linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin);
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
                        jitMode: false,
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
    return (_b = result === null || result === void 0 ? void 0 : result.code) !== null && _b !== void 0 ? _b : data;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7QUFFSCxzQ0FBNkM7QUFDN0MsK0NBQTRDO0FBQzVDLGtGQUF1RTtBQUN2RSwrREFBNkQ7QUFDN0QsbURBQXFEO0FBWXRDLEtBQUssVUFBVSxtQkFBbUIsQ0FDL0MsT0FBbUM7O0lBRW5DLE1BQUEsT0FBTyxDQUFDLElBQUksb0NBQVosT0FBTyxDQUFDLElBQUksR0FBSyxNQUFNLElBQUEsbUJBQVEsRUFBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFDO0lBQzNELE1BQU0sZUFBZSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFMUQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBUEQsc0NBT0M7QUFFRCxJQUFJLG1CQUVTLENBQUM7QUFFZCxLQUFLLFVBQVUsa0JBQWtCLENBQUMsRUFDaEMsUUFBUSxFQUNSLElBQUksRUFDSixHQUFHLE9BQU8sRUFDaUI7O0lBQzNCLE1BQU0sd0JBQXdCLEdBQzVCLE1BQUEsT0FBTyxDQUFDLHdCQUF3QixtQ0FDaEMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4RixNQUFNLFVBQVUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQUksQ0FBQyxNQUFNLElBQUEsZ0NBQWUsRUFBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNsRixNQUFNLGlCQUFpQixHQUNyQixPQUFPLENBQUMsU0FBUztRQUNqQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUUvRSx3RUFBd0U7SUFDeEUsSUFBSSxDQUFDLHdCQUF3QixJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixJQUFJLENBQUMsVUFBVSxFQUFFO1FBQzlFLDhDQUE4QztRQUM5QyxPQUFPLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsb0NBQW9DLEVBQUUsRUFBRSxDQUFDLENBQUM7S0FDMUY7SUFFRCxNQUFNLGNBQWMsR0FBRyxxQ0FBcUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFNUUsNERBQTREO0lBQzVELElBQUksVUFBVSxFQUFFO1FBQ2QsbUJBQW1CLGFBQW5CLG1CQUFtQixjQUFuQixtQkFBbUIsSUFBbkIsbUJBQW1CLEdBQUssQ0FDdEIsTUFBTSxJQUFBLHdCQUFhLEVBQ2pCLG9DQUFvQyxDQUNyQyxDQUNGLENBQUMsd0JBQXdCLEVBQUM7S0FDNUI7SUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEscUJBQWMsRUFBQyxJQUFJLEVBQUU7UUFDeEMsUUFBUTtRQUNSLGNBQWMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBYztRQUNwRSxVQUFVLEVBQUUsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLO1FBQ2hELE9BQU8sRUFBRSxLQUFLO1FBQ2QsVUFBVSxFQUFFLEtBQUs7UUFDakIsT0FBTyxFQUFFLEtBQUs7UUFDZCxzQkFBc0IsRUFBRSxLQUFLO1FBQzdCLE9BQU8sRUFBRSxFQUFFO1FBQ1gsT0FBTyxFQUFFO1lBQ1A7Z0JBQ0UscUJBQXdCO2dCQUN4QjtvQkFDRSxhQUFhLEVBQUUsbUJBQW1CLElBQUk7d0JBQ3BDLFVBQVU7d0JBQ1YsT0FBTyxFQUFFLEtBQUs7d0JBQ2QsbUJBQW1CO3FCQUNwQjtvQkFDRCx3QkFBd0I7b0JBQ3hCLFFBQVEsRUFBRSxPQUFPLENBQUMscUJBQXFCLElBQUk7d0JBQ3pDLFVBQVUsRUFBRSxjQUFjO3dCQUMxQixZQUFZLEVBQUUsY0FBYztxQkFDN0I7aUJBQ0Y7YUFDRjtTQUNGO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsT0FBTyxNQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxJQUFJLG1DQUFJLElBQUksQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IHRyYW5zZm9ybUFzeW5jIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuXG5pbnRlcmZhY2UgSmF2YVNjcmlwdFRyYW5zZm9ybVJlcXVlc3Qge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBkYXRhOiBzdHJpbmc7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9uczogYm9vbGVhbjtcbiAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uPzogYm9vbGVhbjtcbiAgc2tpcExpbmtlcjogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gdHJhbnNmb3JtSmF2YVNjcmlwdChcbiAgcmVxdWVzdDogSmF2YVNjcmlwdFRyYW5zZm9ybVJlcXVlc3QsXG4pOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgcmVxdWVzdC5kYXRhID8/PSBhd2FpdCByZWFkRmlsZShyZXF1ZXN0LmZpbGVuYW1lLCAndXRmLTgnKTtcbiAgY29uc3QgdHJhbnNmb3JtZWREYXRhID0gYXdhaXQgdHJhbnNmb3JtV2l0aEJhYmVsKHJlcXVlc3QpO1xuXG4gIHJldHVybiBCdWZmZXIuZnJvbSh0cmFuc2Zvcm1lZERhdGEsICd1dGYtOCcpO1xufVxuXG5sZXQgbGlua2VyUGx1Z2luQ3JlYXRvcjpcbiAgfCB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4gIHwgdW5kZWZpbmVkO1xuXG5hc3luYyBmdW5jdGlvbiB0cmFuc2Zvcm1XaXRoQmFiZWwoe1xuICBmaWxlbmFtZSxcbiAgZGF0YSxcbiAgLi4ub3B0aW9uc1xufTogSmF2YVNjcmlwdFRyYW5zZm9ybVJlcXVlc3QpOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgIG9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID8/XG4gICAgKCEvW1xcXFwvXVtfZl0/ZXNtMjAxNVtcXFxcL10vLnRlc3QoZmlsZW5hbWUpICYmIC9hc3luYyg/OlxccytmdW5jdGlvbik/XFxzKlxcKi8udGVzdChkYXRhKSk7XG4gIGNvbnN0IHNob3VsZExpbmsgPSAhb3B0aW9ucy5za2lwTGlua2VyICYmIChhd2FpdCByZXF1aXJlc0xpbmtpbmcoZmlsZW5hbWUsIGRhdGEpKTtcbiAgY29uc3QgdXNlSW5wdXRTb3VyY2VtYXAgPVxuICAgIG9wdGlvbnMuc291cmNlbWFwICYmXG4gICAgKCEhb3B0aW9ucy50aGlyZFBhcnR5U291cmNlbWFwcyB8fCAhL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKSk7XG5cbiAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBkYXRhIGRpcmVjdGx5XG4gIGlmICghZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uICYmICFvcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiAhc2hvdWxkTGluaykge1xuICAgIC8vIFN0cmlwIHNvdXJjZW1hcHMgaWYgdGhleSBzaG91bGQgbm90IGJlIHVzZWRcbiAgICByZXR1cm4gdXNlSW5wdXRTb3VyY2VtYXAgPyBkYXRhIDogZGF0YS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKTtcbiAgfVxuXG4gIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKTtcblxuICAvLyBMYXp5IGxvYWQgdGhlIGxpbmtlciBwbHVnaW4gb25seSB3aGVuIGxpbmtpbmcgaXMgcmVxdWlyZWRcbiAgaWYgKHNob3VsZExpbmspIHtcbiAgICBsaW5rZXJQbHVnaW5DcmVhdG9yID8/PSAoXG4gICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgIClcbiAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGRhdGEsIHtcbiAgICBmaWxlbmFtZSxcbiAgICBpbnB1dFNvdXJjZU1hcDogKHVzZUlucHV0U291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICBzb3VyY2VNYXBzOiBvcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgY29tcGFjdDogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgcGx1Z2luczogW10sXG4gICAgcHJlc2V0czogW1xuICAgICAgW1xuICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgIHtcbiAgICAgICAgICBhbmd1bGFyTGlua2VyOiBsaW5rZXJQbHVnaW5DcmVhdG9yICYmIHtcbiAgICAgICAgICAgIHNob3VsZExpbmssXG4gICAgICAgICAgICBqaXRNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24sXG4gICAgICAgICAgb3B0aW1pemU6IG9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHtcbiAgICAgICAgICAgIGxvb3NlRW51bXM6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgICAgcHVyZVRvcExldmVsOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICBdLFxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0Py5jb2RlID8/IGRhdGE7XG59XG4iXX0=