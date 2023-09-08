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
const service_worker_1 = require("../../../utils/service-worker");
class ServiceWorkerPlugin {
    options;
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.done.tapPromise('angular-service-worker', async (stats) => {
            if (stats.hasErrors()) {
                // Don't generate a service worker if the compilation has errors.
                // When there are errors some files will not be emitted which would cause other errors down the line such as readdir failures.
                return;
            }
            const { projectRoot, root, baseHref = '', ngswConfigPath } = this.options;
            const { compilation } = stats;
            // We use the output path from the compilation instead of build options since during
            // localization the output path is modified to a temp directory.
            // See: https://github.com/angular/angular-cli/blob/7e64b1537d54fadb650559214fbb12707324cd75/packages/angular_devkit/build_angular/src/utils/i18n-options.ts#L251-L252
            const outputPath = compilation.outputOptions.path;
            if (!outputPath) {
                throw new Error('Compilation output path cannot be empty.');
            }
            try {
                await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, root, outputPath, baseHref, ngswConfigPath, 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                compiler.inputFileSystem.promises, 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                compiler.outputFileSystem.promises);
            }
            catch (error) {
                compilation.errors.push(new compilation.compiler.webpack.WebpackError(`Failed to generate service worker - ${error instanceof Error ? error.message : error}`));
            }
        });
    }
}
exports.ServiceWorkerPlugin = ServiceWorkerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS13b3JrZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL3NlcnZpY2Utd29ya2VyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCxrRUFBNEU7QUFTNUUsTUFBYSxtQkFBbUI7SUFDRDtJQUE3QixZQUE2QixPQUFtQztRQUFuQyxZQUFPLEdBQVAsT0FBTyxDQUE0QjtJQUFHLENBQUM7SUFFcEUsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyx3QkFBd0IsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDdkUsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFLEVBQUU7Z0JBQ3JCLGlFQUFpRTtnQkFDakUsOEhBQThIO2dCQUM5SCxPQUFPO2FBQ1I7WUFFRCxNQUFNLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLEdBQUcsRUFBRSxFQUFFLGNBQWMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDMUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztZQUM5QixvRkFBb0Y7WUFDcEYsZ0VBQWdFO1lBQ2hFLHNLQUFzSztZQUN0SyxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztZQUVsRCxJQUFJLENBQUMsVUFBVSxFQUFFO2dCQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQzthQUM3RDtZQUVELElBQUk7Z0JBQ0YsTUFBTSxJQUFBLDRDQUEyQixFQUMvQixXQUFXLEVBQ1gsSUFBSSxFQUNKLFVBQVUsRUFDVixRQUFRLEVBQ1IsY0FBYztnQkFDZCw4REFBOEQ7Z0JBQzdELFFBQVEsQ0FBQyxlQUF1QixDQUFDLFFBQVE7Z0JBQzFDLDhEQUE4RDtnQkFDN0QsUUFBUSxDQUFDLGdCQUF3QixDQUFDLFFBQVEsQ0FDNUMsQ0FBQzthQUNIO1lBQUMsT0FBTyxLQUFLLEVBQUU7Z0JBQ2QsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ3JCLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUMzQyx1Q0FBdUMsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQ3hGLENBQ0YsQ0FBQzthQUNIO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEzQ0Qsa0RBMkNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29tcGlsZXIgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcblxuZXhwb3J0IGludGVyZmFjZSBTZXJ2aWNlV29ya2VyUGx1Z2luT3B0aW9ucyB7XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHJvb3Q6IHN0cmluZztcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIG5nc3dDb25maWdQYXRoPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU2VydmljZVdvcmtlclBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogU2VydmljZVdvcmtlclBsdWdpbk9wdGlvbnMpIHt9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MuZG9uZS50YXBQcm9taXNlKCdhbmd1bGFyLXNlcnZpY2Utd29ya2VyJywgYXN5bmMgKHN0YXRzKSA9PiB7XG4gICAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgLy8gRG9uJ3QgZ2VuZXJhdGUgYSBzZXJ2aWNlIHdvcmtlciBpZiB0aGUgY29tcGlsYXRpb24gaGFzIGVycm9ycy5cbiAgICAgICAgLy8gV2hlbiB0aGVyZSBhcmUgZXJyb3JzIHNvbWUgZmlsZXMgd2lsbCBub3QgYmUgZW1pdHRlZCB3aGljaCB3b3VsZCBjYXVzZSBvdGhlciBlcnJvcnMgZG93biB0aGUgbGluZSBzdWNoIGFzIHJlYWRkaXIgZmFpbHVyZXMuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBwcm9qZWN0Um9vdCwgcm9vdCwgYmFzZUhyZWYgPSAnJywgbmdzd0NvbmZpZ1BhdGggfSA9IHRoaXMub3B0aW9ucztcbiAgICAgIGNvbnN0IHsgY29tcGlsYXRpb24gfSA9IHN0YXRzO1xuICAgICAgLy8gV2UgdXNlIHRoZSBvdXRwdXQgcGF0aCBmcm9tIHRoZSBjb21waWxhdGlvbiBpbnN0ZWFkIG9mIGJ1aWxkIG9wdGlvbnMgc2luY2UgZHVyaW5nXG4gICAgICAvLyBsb2NhbGl6YXRpb24gdGhlIG91dHB1dCBwYXRoIGlzIG1vZGlmaWVkIHRvIGEgdGVtcCBkaXJlY3RvcnkuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2Jsb2IvN2U2NGIxNTM3ZDU0ZmFkYjY1MDU1OTIxNGZiYjEyNzA3MzI0Y2Q3NS9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pMThuLW9wdGlvbnMudHMjTDI1MS1MMjUyXG4gICAgICBjb25zdCBvdXRwdXRQYXRoID0gY29tcGlsYXRpb24ub3V0cHV0T3B0aW9ucy5wYXRoO1xuXG4gICAgICBpZiAoIW91dHB1dFBhdGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21waWxhdGlvbiBvdXRwdXQgcGF0aCBjYW5ub3QgYmUgZW1wdHkuJyk7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICByb290LFxuICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgYmFzZUhyZWYsXG4gICAgICAgICAgbmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAoY29tcGlsZXIuaW5wdXRGaWxlU3lzdGVtIGFzIGFueSkucHJvbWlzZXMsXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAoY29tcGlsZXIub3V0cHV0RmlsZVN5c3RlbSBhcyBhbnkpLnByb21pc2VzLFxuICAgICAgICApO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29tcGlsYXRpb24uZXJyb3JzLnB1c2goXG4gICAgICAgICAgbmV3IGNvbXBpbGF0aW9uLmNvbXBpbGVyLndlYnBhY2suV2VicGFja0Vycm9yKFxuICAgICAgICAgICAgYEZhaWxlZCB0byBnZW5lcmF0ZSBzZXJ2aWNlIHdvcmtlciAtICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvcn1gLFxuICAgICAgICAgICksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==