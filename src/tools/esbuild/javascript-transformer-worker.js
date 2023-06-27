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
const application_1 = __importDefault(require("../../tools/babel/presets/application"));
const webpack_loader_1 = require("../../tools/babel/webpack-loader");
const load_esm_1 = require("../../utils/load-esm");
async function transformJavaScript(request) {
    request.data ?? (request.data = await (0, promises_1.readFile)(request.filename, 'utf-8'));
    const transformedData = await transformWithBabel(request);
    return Buffer.from(transformedData, 'utf-8');
}
exports.default = transformJavaScript;
let linkerPluginCreator;
async function transformWithBabel({ filename, data, ...options }) {
    const shouldLink = !options.skipLinker && (await (0, webpack_loader_1.requiresLinking)(filename, data));
    const useInputSourcemap = options.sourcemap &&
        (!!options.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(filename));
    // If no additional transformations are needed, return the data directly
    if (!options.advancedOptimizations && !shouldLink) {
        // Strip sourcemaps if they should not be used
        return useInputSourcemap ? data : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '');
    }
    // @angular/platform-server/init entry-point has side-effects.
    const safeAngularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(filename) &&
        !/@angular[\\/]platform-server[\\/]f?esm2022[\\/]init/.test(filename);
    // Lazy load the linker plugin only when linking is required
    if (shouldLink) {
        linkerPluginCreator ?? (linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin);
    }
    const result = await (0, core_1.transformAsync)(data, {
        filename,
        inputSourceMap: (useInputSourcemap ? undefined : false),
        sourceMaps: useInputSourcemap ? 'inline' : false,
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
                    optimize: options.advancedOptimizations && {
                        pureTopLevel: safeAngularPackage,
                    },
                },
            ],
        ],
    });
    const outputCode = result?.code ?? data;
    // Strip sourcemaps if they should not be used.
    // Babel will keep the original comments even if sourcemaps are disabled.
    return useInputSourcemap
        ? outputCode
        : outputCode.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7O0FBRUgsc0NBQTZDO0FBQzdDLCtDQUE0QztBQUM1Qyx3RkFBNkU7QUFDN0UscUVBQW1FO0FBQ25FLG1EQUFxRDtBQVl0QyxLQUFLLFVBQVUsbUJBQW1CLENBQy9DLE9BQW1DO0lBRW5DLE9BQU8sQ0FBQyxJQUFJLEtBQVosT0FBTyxDQUFDLElBQUksR0FBSyxNQUFNLElBQUEsbUJBQVEsRUFBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFDO0lBQzNELE1BQU0sZUFBZSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFMUQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBUEQsc0NBT0M7QUFFRCxJQUFJLG1CQUVTLENBQUM7QUFFZCxLQUFLLFVBQVUsa0JBQWtCLENBQUMsRUFDaEMsUUFBUSxFQUNSLElBQUksRUFDSixHQUFHLE9BQU8sRUFDaUI7SUFDM0IsTUFBTSxVQUFVLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLENBQUMsTUFBTSxJQUFBLGdDQUFlLEVBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEYsTUFBTSxpQkFBaUIsR0FDckIsT0FBTyxDQUFDLFNBQVM7UUFDakIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLG9CQUFvQixJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFFL0Usd0VBQXdFO0lBQ3hFLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDakQsOENBQThDO1FBQzlDLE9BQU8saUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQ0FBb0MsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUMxRjtJQUVELDhEQUE4RDtJQUM5RCxNQUFNLGtCQUFrQixHQUN0QixxQ0FBcUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3BELENBQUMscURBQXFELENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhFLDREQUE0RDtJQUM1RCxJQUFJLFVBQVUsRUFBRTtRQUNkLG1CQUFtQixLQUFuQixtQkFBbUIsR0FBSyxDQUN0QixNQUFNLElBQUEsd0JBQWEsRUFDakIsb0NBQW9DLENBQ3JDLENBQ0YsQ0FBQyx3QkFBd0IsRUFBQztLQUM1QjtJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxxQkFBYyxFQUFDLElBQUksRUFBRTtRQUN4QyxRQUFRO1FBQ1IsY0FBYyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFjO1FBQ3BFLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLO1FBQ2hELE9BQU8sRUFBRSxLQUFLO1FBQ2QsVUFBVSxFQUFFLEtBQUs7UUFDakIsT0FBTyxFQUFFLEtBQUs7UUFDZCxzQkFBc0IsRUFBRSxLQUFLO1FBQzdCLE9BQU8sRUFBRSxFQUFFO1FBQ1gsT0FBTyxFQUFFO1lBQ1A7Z0JBQ0UscUJBQXdCO2dCQUN4QjtvQkFDRSxhQUFhLEVBQUUsbUJBQW1CLElBQUk7d0JBQ3BDLFVBQVU7d0JBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHO3dCQUNwQixtQkFBbUI7cUJBQ3BCO29CQUNELFFBQVEsRUFBRSxPQUFPLENBQUMscUJBQXFCLElBQUk7d0JBQ3pDLFlBQVksRUFBRSxrQkFBa0I7cUJBQ2pDO2lCQUNGO2FBQ0Y7U0FDRjtLQUNGLENBQUMsQ0FBQztJQUVILE1BQU0sVUFBVSxHQUFHLE1BQU0sRUFBRSxJQUFJLElBQUksSUFBSSxDQUFDO0lBRXhDLCtDQUErQztJQUMvQyx5RUFBeUU7SUFDekUsT0FBTyxpQkFBaUI7UUFDdEIsQ0FBQyxDQUFDLFVBQVU7UUFDWixDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxvQ0FBb0MsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNuRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IHRyYW5zZm9ybUFzeW5jIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vdG9vbHMvYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi90b29scy9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuXG5pbnRlcmZhY2UgSmF2YVNjcmlwdFRyYW5zZm9ybVJlcXVlc3Qge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBkYXRhOiBzdHJpbmc7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9uczogYm9vbGVhbjtcbiAgc2tpcExpbmtlcjogYm9vbGVhbjtcbiAgaml0OiBib29sZWFuO1xufVxuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiB0cmFuc2Zvcm1KYXZhU2NyaXB0KFxuICByZXF1ZXN0OiBKYXZhU2NyaXB0VHJhbnNmb3JtUmVxdWVzdCxcbik6IFByb21pc2U8VWludDhBcnJheT4ge1xuICByZXF1ZXN0LmRhdGEgPz89IGF3YWl0IHJlYWRGaWxlKHJlcXVlc3QuZmlsZW5hbWUsICd1dGYtOCcpO1xuICBjb25zdCB0cmFuc2Zvcm1lZERhdGEgPSBhd2FpdCB0cmFuc2Zvcm1XaXRoQmFiZWwocmVxdWVzdCk7XG5cbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRyYW5zZm9ybWVkRGF0YSwgJ3V0Zi04Jyk7XG59XG5cbmxldCBsaW5rZXJQbHVnaW5DcmVhdG9yOlxuICB8IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbiAgfCB1bmRlZmluZWQ7XG5cbmFzeW5jIGZ1bmN0aW9uIHRyYW5zZm9ybVdpdGhCYWJlbCh7XG4gIGZpbGVuYW1lLFxuICBkYXRhLFxuICAuLi5vcHRpb25zXG59OiBKYXZhU2NyaXB0VHJhbnNmb3JtUmVxdWVzdCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHNob3VsZExpbmsgPSAhb3B0aW9ucy5za2lwTGlua2VyICYmIChhd2FpdCByZXF1aXJlc0xpbmtpbmcoZmlsZW5hbWUsIGRhdGEpKTtcbiAgY29uc3QgdXNlSW5wdXRTb3VyY2VtYXAgPVxuICAgIG9wdGlvbnMuc291cmNlbWFwICYmXG4gICAgKCEhb3B0aW9ucy50aGlyZFBhcnR5U291cmNlbWFwcyB8fCAhL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKSk7XG5cbiAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBkYXRhIGRpcmVjdGx5XG4gIGlmICghb3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYgIXNob3VsZExpbmspIHtcbiAgICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkXG4gICAgcmV0dXJuIHVzZUlucHV0U291cmNlbWFwID8gZGF0YSA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyk7XG4gIH1cblxuICAvLyBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXIvaW5pdCBlbnRyeS1wb2ludCBoYXMgc2lkZS1lZmZlY3RzLlxuICBjb25zdCBzYWZlQW5ndWxhclBhY2thZ2UgPVxuICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXS8udGVzdChmaWxlbmFtZSkgJiZcbiAgICAhL0Bhbmd1bGFyW1xcXFwvXXBsYXRmb3JtLXNlcnZlcltcXFxcL11mP2VzbTIwMjJbXFxcXC9daW5pdC8udGVzdChmaWxlbmFtZSk7XG5cbiAgLy8gTGF6eSBsb2FkIHRoZSBsaW5rZXIgcGx1Z2luIG9ubHkgd2hlbiBsaW5raW5nIGlzIHJlcXVpcmVkXG4gIGlmIChzaG91bGRMaW5rKSB7XG4gICAgbGlua2VyUGx1Z2luQ3JlYXRvciA/Pz0gKFxuICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICApXG4gICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgZmlsZW5hbWUsXG4gICAgaW5wdXRTb3VyY2VNYXA6ICh1c2VJbnB1dFNvdXJjZW1hcCA/IHVuZGVmaW5lZCA6IGZhbHNlKSBhcyB1bmRlZmluZWQsXG4gICAgc291cmNlTWFwczogdXNlSW5wdXRTb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHBsdWdpbnM6IFtdLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0LFxuICAgICAgICB7XG4gICAgICAgICAgYW5ndWxhckxpbmtlcjogbGlua2VyUGx1Z2luQ3JlYXRvciAmJiB7XG4gICAgICAgICAgICBzaG91bGRMaW5rLFxuICAgICAgICAgICAgaml0TW9kZTogb3B0aW9ucy5qaXQsXG4gICAgICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgb3B0aW1pemU6IG9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHtcbiAgICAgICAgICAgIHB1cmVUb3BMZXZlbDogc2FmZUFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gIH0pO1xuXG4gIGNvbnN0IG91dHB1dENvZGUgPSByZXN1bHQ/LmNvZGUgPz8gZGF0YTtcblxuICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkLlxuICAvLyBCYWJlbCB3aWxsIGtlZXAgdGhlIG9yaWdpbmFsIGNvbW1lbnRzIGV2ZW4gaWYgc291cmNlbWFwcyBhcmUgZGlzYWJsZWQuXG4gIHJldHVybiB1c2VJbnB1dFNvdXJjZW1hcFxuICAgID8gb3V0cHV0Q29kZVxuICAgIDogb3V0cHV0Q29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKTtcbn1cbiJdfQ==