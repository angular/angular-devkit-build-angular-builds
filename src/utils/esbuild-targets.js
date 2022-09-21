"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformSupportedBrowsersToTargets = void 0;
/**
 * Transform browserlists result to esbuild target.
 * @see https://esbuild.github.io/api/#target
 */
function transformSupportedBrowsersToTargets(supportedBrowsers) {
    const transformed = [];
    // https://esbuild.github.io/api/#target
    const esBuildSupportedBrowsers = new Set(['safari', 'firefox', 'edge', 'chrome', 'ios', 'node']);
    for (const browser of supportedBrowsers) {
        let [browserName, version] = browser.split(' ');
        // browserslist uses the name `ios_saf` for iOS Safari whereas esbuild uses `ios`
        if (browserName === 'ios_saf') {
            browserName = 'ios';
        }
        // browserslist uses ranges `15.2-15.3` versions but only the lowest is required
        // to perform minimum supported feature checks. esbuild also expects a single version.
        [version] = version.split('-');
        if (esBuildSupportedBrowsers.has(browserName)) {
            if (browserName === 'safari' && version === 'TP') {
                // esbuild only supports numeric versions so `TP` is converted to a high number (999) since
                // a Technology Preview (TP) of Safari is assumed to support all currently known features.
                version = '999';
            }
            transformed.push(browserName + version);
        }
    }
    return transformed;
}
exports.transformSupportedBrowsersToTargets = transformSupportedBrowsersToTargets;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC10YXJnZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvZXNidWlsZC10YXJnZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVIOzs7R0FHRztBQUNILFNBQWdCLG1DQUFtQyxDQUFDLGlCQUEyQjtJQUM3RSxNQUFNLFdBQVcsR0FBYSxFQUFFLENBQUM7SUFFakMsd0NBQXdDO0lBQ3hDLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFakcsS0FBSyxNQUFNLE9BQU8sSUFBSSxpQkFBaUIsRUFBRTtRQUN2QyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFaEQsaUZBQWlGO1FBQ2pGLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtZQUM3QixXQUFXLEdBQUcsS0FBSyxDQUFDO1NBQ3JCO1FBRUQsZ0ZBQWdGO1FBQ2hGLHNGQUFzRjtRQUN0RixDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFL0IsSUFBSSx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDN0MsSUFBSSxXQUFXLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7Z0JBQ2hELDJGQUEyRjtnQkFDM0YsMEZBQTBGO2dCQUMxRixPQUFPLEdBQUcsS0FBSyxDQUFDO2FBQ2pCO1lBRUQsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUM7U0FDekM7S0FDRjtJQUVELE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUE5QkQsa0ZBOEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogVHJhbnNmb3JtIGJyb3dzZXJsaXN0cyByZXN1bHQgdG8gZXNidWlsZCB0YXJnZXQuXG4gKiBAc2VlIGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyN0YXJnZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKHN1cHBvcnRlZEJyb3dzZXJzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgY29uc3QgdHJhbnNmb3JtZWQ6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3RhcmdldFxuICBjb25zdCBlc0J1aWxkU3VwcG9ydGVkQnJvd3NlcnMgPSBuZXcgU2V0KFsnc2FmYXJpJywgJ2ZpcmVmb3gnLCAnZWRnZScsICdjaHJvbWUnLCAnaW9zJywgJ25vZGUnXSk7XG5cbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgbGV0IFticm93c2VyTmFtZSwgdmVyc2lvbl0gPSBicm93c2VyLnNwbGl0KCcgJyk7XG5cbiAgICAvLyBicm93c2Vyc2xpc3QgdXNlcyB0aGUgbmFtZSBgaW9zX3NhZmAgZm9yIGlPUyBTYWZhcmkgd2hlcmVhcyBlc2J1aWxkIHVzZXMgYGlvc2BcbiAgICBpZiAoYnJvd3Nlck5hbWUgPT09ICdpb3Nfc2FmJykge1xuICAgICAgYnJvd3Nlck5hbWUgPSAnaW9zJztcbiAgICB9XG5cbiAgICAvLyBicm93c2Vyc2xpc3QgdXNlcyByYW5nZXMgYDE1LjItMTUuM2AgdmVyc2lvbnMgYnV0IG9ubHkgdGhlIGxvd2VzdCBpcyByZXF1aXJlZFxuICAgIC8vIHRvIHBlcmZvcm0gbWluaW11bSBzdXBwb3J0ZWQgZmVhdHVyZSBjaGVja3MuIGVzYnVpbGQgYWxzbyBleHBlY3RzIGEgc2luZ2xlIHZlcnNpb24uXG4gICAgW3ZlcnNpb25dID0gdmVyc2lvbi5zcGxpdCgnLScpO1xuXG4gICAgaWYgKGVzQnVpbGRTdXBwb3J0ZWRCcm93c2Vycy5oYXMoYnJvd3Nlck5hbWUpKSB7XG4gICAgICBpZiAoYnJvd3Nlck5hbWUgPT09ICdzYWZhcmknICYmIHZlcnNpb24gPT09ICdUUCcpIHtcbiAgICAgICAgLy8gZXNidWlsZCBvbmx5IHN1cHBvcnRzIG51bWVyaWMgdmVyc2lvbnMgc28gYFRQYCBpcyBjb252ZXJ0ZWQgdG8gYSBoaWdoIG51bWJlciAoOTk5KSBzaW5jZVxuICAgICAgICAvLyBhIFRlY2hub2xvZ3kgUHJldmlldyAoVFApIG9mIFNhZmFyaSBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgYWxsIGN1cnJlbnRseSBrbm93biBmZWF0dXJlcy5cbiAgICAgICAgdmVyc2lvbiA9ICc5OTknO1xuICAgICAgfVxuXG4gICAgICB0cmFuc2Zvcm1lZC5wdXNoKGJyb3dzZXJOYW1lICsgdmVyc2lvbik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybWVkO1xufVxuIl19