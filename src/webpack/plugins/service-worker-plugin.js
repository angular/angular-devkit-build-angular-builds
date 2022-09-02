"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceWorkerPlugin = void 0;
const service_worker_1 = require("../../utils/service-worker");
class ServiceWorkerPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.done.tapPromise('angular-service-worker', async ({ compilation }) => {
            const { projectRoot, root, baseHref = '', ngswConfigPath } = this.options;
            // We use the output path from the compilation instead of build options since during
            // localization the output path is modified to a temp directory.
            // See: https://github.com/angular/angular-cli/blob/7e64b1537d54fadb650559214fbb12707324cd75/packages/angular_devkit/build_angular/src/utils/i18n-options.ts#L251-L252
            const outputPath = compilation.outputOptions.path;
            if (!outputPath) {
                throw new Error('Compilation output path cannot be empty.');
            }
            await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, root, outputPath, baseHref, ngswConfigPath, 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            compiler.inputFileSystem.promises, 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            compiler.outputFileSystem.promises);
        });
    }
}
exports.ServiceWorkerPlugin = ServiceWorkerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3NlcnZpY2Utd29ya2VyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCwrREFBeUU7QUFTekUsTUFBYSxtQkFBbUI7SUFDOUIsWUFBNkIsT0FBbUM7UUFBbkMsWUFBTyxHQUFQLE9BQU8sQ0FBNEI7SUFBRyxDQUFDO0lBRXBFLEtBQUssQ0FBQyxRQUFrQjtRQUN0QixRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsd0JBQXdCLEVBQUUsS0FBSyxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtZQUNqRixNQUFNLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLEdBQUcsRUFBRSxFQUFFLGNBQWMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDMUUsb0ZBQW9GO1lBQ3BGLGdFQUFnRTtZQUNoRSxzS0FBc0s7WUFDdEssTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7WUFFbEQsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDZixNQUFNLElBQUksS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7YUFDN0Q7WUFFRCxNQUFNLElBQUEsNENBQTJCLEVBQy9CLFdBQVcsRUFDWCxJQUFJLEVBQ0osVUFBVSxFQUNWLFFBQVEsRUFDUixjQUFjO1lBQ2QsOERBQThEO1lBQzdELFFBQVEsQ0FBQyxlQUF1QixDQUFDLFFBQVE7WUFDMUMsOERBQThEO1lBQzdELFFBQVEsQ0FBQyxnQkFBd0IsQ0FBQyxRQUFRLENBQzVDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVCRCxrREE0QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlcnZpY2VXb3JrZXJQbHVnaW5PcHRpb25zIHtcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgcm9vdDogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgbmdzd0NvbmZpZ1BhdGg/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTZXJ2aWNlV29ya2VyUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBTZXJ2aWNlV29ya2VyUGx1Z2luT3B0aW9ucykge31cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpIHtcbiAgICBjb21waWxlci5ob29rcy5kb25lLnRhcFByb21pc2UoJ2FuZ3VsYXItc2VydmljZS13b3JrZXInLCBhc3luYyAoeyBjb21waWxhdGlvbiB9KSA9PiB7XG4gICAgICBjb25zdCB7IHByb2plY3RSb290LCByb290LCBiYXNlSHJlZiA9ICcnLCBuZ3N3Q29uZmlnUGF0aCB9ID0gdGhpcy5vcHRpb25zO1xuICAgICAgLy8gV2UgdXNlIHRoZSBvdXRwdXQgcGF0aCBmcm9tIHRoZSBjb21waWxhdGlvbiBpbnN0ZWFkIG9mIGJ1aWxkIG9wdGlvbnMgc2luY2UgZHVyaW5nXG4gICAgICAvLyBsb2NhbGl6YXRpb24gdGhlIG91dHB1dCBwYXRoIGlzIG1vZGlmaWVkIHRvIGEgdGVtcCBkaXJlY3RvcnkuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2Jsb2IvN2U2NGIxNTM3ZDU0ZmFkYjY1MDU1OTIxNGZiYjEyNzA3MzI0Y2Q3NS9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pMThuLW9wdGlvbnMudHMjTDI1MS1MMjUyXG4gICAgICBjb25zdCBvdXRwdXRQYXRoID0gY29tcGlsYXRpb24ub3V0cHV0T3B0aW9ucy5wYXRoO1xuXG4gICAgICBpZiAoIW91dHB1dFBhdGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21waWxhdGlvbiBvdXRwdXQgcGF0aCBjYW5ub3QgYmUgZW1wdHkuJyk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIGJhc2VIcmVmLFxuICAgICAgICBuZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgKGNvbXBpbGVyLmlucHV0RmlsZVN5c3RlbSBhcyBhbnkpLnByb21pc2VzLFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAoY29tcGlsZXIub3V0cHV0RmlsZVN5c3RlbSBhcyBhbnkpLnByb21pc2VzLFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxufVxuIl19