"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCacheOptions = void 0;
const core_1 = require("@angular-devkit/core");
const path_1 = require("path");
const environment_options_1 = require("./environment-options");
const package_version_1 = require("./package-version");
function normalizeCacheOptions(metadata, worspaceRoot) {
    var _a;
    const cacheMetadata = core_1.json.isJsonObject(metadata.cli) && core_1.json.isJsonObject(metadata.cli.cache)
        ? metadata.cli.cache
        : {};
    const { enabled = true, environment = 'local', path = '.angular/cache' } = cacheMetadata;
    const isCI = process.env['CI'] === '1' || ((_a = process.env['CI']) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'true';
    let cacheEnabled = enabled;
    if (environment_options_1.cachingDisabled !== null) {
        cacheEnabled = !environment_options_1.cachingDisabled;
    }
    if (cacheEnabled) {
        switch (environment) {
            case 'ci':
                cacheEnabled = isCI;
                break;
            case 'local':
                cacheEnabled = !isCI;
                break;
        }
    }
    const cacheBasePath = (0, path_1.resolve)(worspaceRoot, path);
    return {
        enabled: cacheEnabled,
        basePath: cacheBasePath,
        path: (0, path_1.join)(cacheBasePath, package_version_1.VERSION),
    };
}
exports.normalizeCacheOptions = normalizeCacheOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXplLWNhY2hlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvbm9ybWFsaXplLWNhY2hlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtDQUE0QztBQUM1QywrQkFBcUM7QUFDckMsK0RBQXdEO0FBQ3hELHVEQUE0QztBQWlCNUMsU0FBZ0IscUJBQXFCLENBQ25DLFFBQXlCLEVBQ3pCLFlBQW9COztJQUVwQixNQUFNLGFBQWEsR0FDakIsV0FBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksV0FBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztRQUN0RSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLO1FBQ3BCLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFVCxNQUFNLEVBQUUsT0FBTyxHQUFHLElBQUksRUFBRSxXQUFXLEdBQUcsT0FBTyxFQUFFLElBQUksR0FBRyxnQkFBZ0IsRUFBRSxHQUFHLGFBQWEsQ0FBQztJQUN6RixNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFBLE1BQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsMENBQUUsV0FBVyxFQUFFLE1BQUssTUFBTSxDQUFDO0lBRXRGLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQztJQUMzQixJQUFJLHFDQUFlLEtBQUssSUFBSSxFQUFFO1FBQzVCLFlBQVksR0FBRyxDQUFDLHFDQUFlLENBQUM7S0FDakM7SUFFRCxJQUFJLFlBQVksRUFBRTtRQUNoQixRQUFRLFdBQVcsRUFBRTtZQUNuQixLQUFLLElBQUk7Z0JBQ1AsWUFBWSxHQUFHLElBQUksQ0FBQztnQkFDcEIsTUFBTTtZQUNSLEtBQUssT0FBTztnQkFDVixZQUFZLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ3JCLE1BQU07U0FDVDtLQUNGO0lBRUQsTUFBTSxhQUFhLEdBQUcsSUFBQSxjQUFPLEVBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRWxELE9BQU87UUFDTCxPQUFPLEVBQUUsWUFBWTtRQUNyQixRQUFRLEVBQUUsYUFBYTtRQUN2QixJQUFJLEVBQUUsSUFBQSxXQUFJLEVBQUMsYUFBYSxFQUFFLHlCQUFPLENBQUM7S0FDbkMsQ0FBQztBQUNKLENBQUM7QUFuQ0Qsc0RBbUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGpzb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBqb2luLCByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBjYWNoaW5nRGlzYWJsZWQgfSBmcm9tICcuL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gJy4vcGFja2FnZS12ZXJzaW9uJztcblxuZXhwb3J0IGludGVyZmFjZSBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucyB7XG4gIC8qKiBXaGV0aGVyIGRpc2sgY2FjaGUgaXMgZW5hYmxlZC4gKi9cbiAgZW5hYmxlZDogYm9vbGVhbjtcbiAgLyoqIERpc2sgY2FjaGUgcGF0aC4gRXhhbXBsZTogYC8uYW5ndWxhci9jYWNoZS92MTIuMC4wYC4gKi9cbiAgcGF0aDogc3RyaW5nO1xuICAvKiogRGlzayBjYWNoZSBiYXNlIHBhdGguIEV4YW1wbGU6IGAvLmFuZ3VsYXIvY2FjaGVgLiAqL1xuICBiYXNlUGF0aDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgQ2FjaGVNZXRhZGF0YSB7XG4gIGVuYWJsZWQ/OiBib29sZWFuO1xuICBlbnZpcm9ubWVudD86ICdsb2NhbCcgfCAnY2knIHwgJ2FsbCc7XG4gIHBhdGg/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVDYWNoZU9wdGlvbnMoXG4gIG1ldGFkYXRhOiBqc29uLkpzb25PYmplY3QsXG4gIHdvcnNwYWNlUm9vdDogc3RyaW5nLFxuKTogTm9ybWFsaXplZENhY2hlZE9wdGlvbnMge1xuICBjb25zdCBjYWNoZU1ldGFkYXRhOiBDYWNoZU1ldGFkYXRhID1cbiAgICBqc29uLmlzSnNvbk9iamVjdChtZXRhZGF0YS5jbGkpICYmIGpzb24uaXNKc29uT2JqZWN0KG1ldGFkYXRhLmNsaS5jYWNoZSlcbiAgICAgID8gbWV0YWRhdGEuY2xpLmNhY2hlXG4gICAgICA6IHt9O1xuXG4gIGNvbnN0IHsgZW5hYmxlZCA9IHRydWUsIGVudmlyb25tZW50ID0gJ2xvY2FsJywgcGF0aCA9ICcuYW5ndWxhci9jYWNoZScgfSA9IGNhY2hlTWV0YWRhdGE7XG4gIGNvbnN0IGlzQ0kgPSBwcm9jZXNzLmVudlsnQ0knXSA9PT0gJzEnIHx8IHByb2Nlc3MuZW52WydDSSddPy50b0xvd2VyQ2FzZSgpID09PSAndHJ1ZSc7XG5cbiAgbGV0IGNhY2hlRW5hYmxlZCA9IGVuYWJsZWQ7XG4gIGlmIChjYWNoaW5nRGlzYWJsZWQgIT09IG51bGwpIHtcbiAgICBjYWNoZUVuYWJsZWQgPSAhY2FjaGluZ0Rpc2FibGVkO1xuICB9XG5cbiAgaWYgKGNhY2hlRW5hYmxlZCkge1xuICAgIHN3aXRjaCAoZW52aXJvbm1lbnQpIHtcbiAgICAgIGNhc2UgJ2NpJzpcbiAgICAgICAgY2FjaGVFbmFibGVkID0gaXNDSTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdsb2NhbCc6XG4gICAgICAgIGNhY2hlRW5hYmxlZCA9ICFpc0NJO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBjb25zdCBjYWNoZUJhc2VQYXRoID0gcmVzb2x2ZSh3b3JzcGFjZVJvb3QsIHBhdGgpO1xuXG4gIHJldHVybiB7XG4gICAgZW5hYmxlZDogY2FjaGVFbmFibGVkLFxuICAgIGJhc2VQYXRoOiBjYWNoZUJhc2VQYXRoLFxuICAgIHBhdGg6IGpvaW4oY2FjaGVCYXNlUGF0aCwgVkVSU0lPTiksXG4gIH07XG59XG4iXX0=