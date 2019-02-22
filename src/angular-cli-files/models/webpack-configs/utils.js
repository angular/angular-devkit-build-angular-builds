"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const core_1 = require("@angular-devkit/core");
const webpack_1 = require("webpack");
exports.ngAppResolve = (resolvePath) => {
    return path.resolve(process.cwd(), resolvePath);
};
function getOutputHashFormat(option, length = 20) {
    /* tslint:disable:max-line-length */
    const hashFormats = {
        none: { chunk: '', extract: '', file: '', script: '' },
        media: { chunk: '', extract: '', file: `.[hash:${length}]`, script: '' },
        bundles: { chunk: `.[chunkhash:${length}]`, extract: `.[contenthash:${length}]`, file: '', script: `.[hash:${length}]` },
        all: { chunk: `.[chunkhash:${length}]`, extract: `.[contenthash:${length}]`, file: `.[hash:${length}]`, script: `.[hash:${length}]` },
    };
    /* tslint:enable:max-line-length */
    return hashFormats[option] || hashFormats['none'];
}
exports.getOutputHashFormat = getOutputHashFormat;
function normalizeExtraEntryPoints(extraEntryPoints, defaultBundleName) {
    return extraEntryPoints.map(entry => {
        let normalizedEntry;
        if (typeof entry === 'string') {
            normalizedEntry = { input: entry, lazy: false, bundleName: defaultBundleName };
        }
        else {
            let bundleName;
            if (entry.bundleName) {
                bundleName = entry.bundleName;
            }
            else if (entry.lazy) {
                // Lazy entry points use the file name as bundle name.
                bundleName = core_1.basename(core_1.normalize(entry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')));
            }
            else {
                bundleName = defaultBundleName;
            }
            normalizedEntry = Object.assign({}, entry, { bundleName });
        }
        return normalizedEntry;
    });
}
exports.normalizeExtraEntryPoints = normalizeExtraEntryPoints;
function getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, hiddenSourceMap = false, inlineSourceMap = false) {
    const include = [];
    if (scriptsSourceMap) {
        include.push(/js$/);
    }
    if (stylesSourceMap) {
        include.push(/css$/);
    }
    return new webpack_1.SourceMapDevToolPlugin({
        filename: inlineSourceMap ? undefined : '[file].map',
        include,
        append: hiddenSourceMap ? false : undefined,
    });
}
exports.getSourceMapDevTool = getSourceMapDevTool;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRztBQUNILGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUM3QiwrQ0FBMkQ7QUFFM0QscUNBQWlEO0FBRXBDLFFBQUEsWUFBWSxHQUFHLENBQUMsV0FBbUIsRUFBVSxFQUFFO0lBQzFELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDbEQsQ0FBQyxDQUFDO0FBU0YsU0FBZ0IsbUJBQW1CLENBQUMsTUFBYyxFQUFFLE1BQU0sR0FBRyxFQUFFO0lBQzdELG9DQUFvQztJQUNwQyxNQUFNLFdBQVcsR0FBcUM7UUFDcEQsSUFBSSxFQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBd0IsT0FBTyxFQUFFLEVBQUUsRUFBMEIsSUFBSSxFQUFFLEVBQUUsRUFBbUIsTUFBTSxFQUFFLEVBQUUsRUFBRTtRQUN4SCxLQUFLLEVBQUksRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUF3QixPQUFPLEVBQUUsRUFBRSxFQUEwQixJQUFJLEVBQUUsVUFBVSxNQUFNLEdBQUcsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFHO1FBQ3pILE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxlQUFlLE1BQU0sR0FBRyxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsTUFBTSxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBbUIsTUFBTSxFQUFFLFVBQVUsTUFBTSxHQUFHLEVBQUc7UUFDMUksR0FBRyxFQUFNLEVBQUUsS0FBSyxFQUFFLGVBQWUsTUFBTSxHQUFHLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixNQUFNLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxNQUFNLEdBQUcsRUFBRSxNQUFNLEVBQUUsVUFBVSxNQUFNLEdBQUcsRUFBRztLQUMzSSxDQUFDO0lBQ0YsbUNBQW1DO0lBQ25DLE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBVkQsa0RBVUM7QUFJRCxTQUFnQix5QkFBeUIsQ0FDdkMsZ0JBQW1DLEVBQ25DLGlCQUF5QjtJQUV6QixPQUFPLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNsQyxJQUFJLGVBQWUsQ0FBQztRQUVwQixJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtZQUM3QixlQUFlLEdBQUcsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUM7U0FDaEY7YUFBTTtZQUNMLElBQUksVUFBVSxDQUFDO1lBRWYsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUNwQixVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQzthQUMvQjtpQkFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7Z0JBQ3JCLHNEQUFzRDtnQkFDdEQsVUFBVSxHQUFHLGVBQVEsQ0FDbkIsZ0JBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQ0FBa0MsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUN2RSxDQUFDO2FBQ0g7aUJBQU07Z0JBQ0wsVUFBVSxHQUFHLGlCQUFpQixDQUFDO2FBQ2hDO1lBRUQsZUFBZSxxQkFBTyxLQUFLLElBQUUsVUFBVSxHQUFDLENBQUM7U0FDMUM7UUFFRCxPQUFPLGVBQWUsQ0FBQztJQUN6QixDQUFDLENBQUMsQ0FBQTtBQUNKLENBQUM7QUE1QkQsOERBNEJDO0FBRUQsU0FBZ0IsbUJBQW1CLENBQ2pDLGdCQUF5QixFQUN6QixlQUF3QixFQUN4QixlQUFlLEdBQUcsS0FBSyxFQUN2QixlQUFlLEdBQUcsS0FBSztJQUV2QixNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDbkIsSUFBSSxnQkFBZ0IsRUFBRTtRQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3JCO0lBRUQsSUFBSSxlQUFlLEVBQUU7UUFDbkIsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUN0QjtJQUVELE9BQU8sSUFBSSxnQ0FBc0IsQ0FBQztRQUNoQyxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFlBQVk7UUFDcEQsT0FBTztRQUNQLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUztLQUM1QyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBcEJELGtEQW9CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGJhc2VuYW1lLCBub3JtYWxpemUgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBFeHRyYUVudHJ5UG9pbnQsIEV4dHJhRW50cnlQb2ludENsYXNzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU291cmNlTWFwRGV2VG9vbFBsdWdpbiB9IGZyb20gJ3dlYnBhY2snO1xuXG5leHBvcnQgY29uc3QgbmdBcHBSZXNvbHZlID0gKHJlc29sdmVQYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICByZXR1cm4gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIHJlc29sdmVQYXRoKTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFzaEZvcm1hdCB7XG4gIGNodW5rOiBzdHJpbmc7XG4gIGV4dHJhY3Q6IHN0cmluZztcbiAgZmlsZTogc3RyaW5nO1xuICBzY3JpcHQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE91dHB1dEhhc2hGb3JtYXQob3B0aW9uOiBzdHJpbmcsIGxlbmd0aCA9IDIwKTogSGFzaEZvcm1hdCB7XG4gIC8qIHRzbGludDpkaXNhYmxlOm1heC1saW5lLWxlbmd0aCAqL1xuICBjb25zdCBoYXNoRm9ybWF0czogeyBbb3B0aW9uOiBzdHJpbmddOiBIYXNoRm9ybWF0IH0gPSB7XG4gICAgbm9uZTogICAgeyBjaHVuazogJycsICAgICAgICAgICAgICAgICAgICAgICBleHRyYWN0OiAnJywgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZTogJycgICAgICAgICAgICAgICAgICwgc2NyaXB0OiAnJyB9LFxuICAgIG1lZGlhOiAgIHsgY2h1bms6ICcnLCAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFjdDogJycsICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGU6IGAuW2hhc2g6JHtsZW5ndGh9XWAsIHNjcmlwdDogJycgIH0sXG4gICAgYnVuZGxlczogeyBjaHVuazogYC5bY2h1bmtoYXNoOiR7bGVuZ3RofV1gLCBleHRyYWN0OiBgLltjb250ZW50aGFzaDoke2xlbmd0aH1dYCwgZmlsZTogJycgICAgICAgICAgICAgICAgICwgc2NyaXB0OiBgLltoYXNoOiR7bGVuZ3RofV1gICB9LFxuICAgIGFsbDogICAgIHsgY2h1bms6IGAuW2NodW5raGFzaDoke2xlbmd0aH1dYCwgZXh0cmFjdDogYC5bY29udGVudGhhc2g6JHtsZW5ndGh9XWAsIGZpbGU6IGAuW2hhc2g6JHtsZW5ndGh9XWAsIHNjcmlwdDogYC5baGFzaDoke2xlbmd0aH1dYCAgfSxcbiAgfTtcbiAgLyogdHNsaW50OmVuYWJsZTptYXgtbGluZS1sZW5ndGggKi9cbiAgcmV0dXJuIGhhc2hGb3JtYXRzW29wdGlvbl0gfHwgaGFzaEZvcm1hdHNbJ25vbmUnXTtcbn1cblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEVudHJ5UG9pbnQgPSBFeHRyYUVudHJ5UG9pbnRDbGFzcyAmIHsgYnVuZGxlTmFtZTogc3RyaW5nIH07XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICBleHRyYUVudHJ5UG9pbnRzOiBFeHRyYUVudHJ5UG9pbnRbXSxcbiAgZGVmYXVsdEJ1bmRsZU5hbWU6IHN0cmluZ1xuKTogTm9ybWFsaXplZEVudHJ5UG9pbnRbXSB7XG4gIHJldHVybiBleHRyYUVudHJ5UG9pbnRzLm1hcChlbnRyeSA9PiB7XG4gICAgbGV0IG5vcm1hbGl6ZWRFbnRyeTtcblxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBub3JtYWxpemVkRW50cnkgPSB7IGlucHV0OiBlbnRyeSwgbGF6eTogZmFsc2UsIGJ1bmRsZU5hbWU6IGRlZmF1bHRCdW5kbGVOYW1lIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBidW5kbGVOYW1lO1xuXG4gICAgICBpZiAoZW50cnkuYnVuZGxlTmFtZSkge1xuICAgICAgICBidW5kbGVOYW1lID0gZW50cnkuYnVuZGxlTmFtZTtcbiAgICAgIH0gZWxzZSBpZiAoZW50cnkubGF6eSkge1xuICAgICAgICAvLyBMYXp5IGVudHJ5IHBvaW50cyB1c2UgdGhlIGZpbGUgbmFtZSBhcyBidW5kbGUgbmFtZS5cbiAgICAgICAgYnVuZGxlTmFtZSA9IGJhc2VuYW1lKFxuICAgICAgICAgIG5vcm1hbGl6ZShlbnRyeS5pbnB1dC5yZXBsYWNlKC9cXC4oanN8Y3NzfHNjc3N8c2Fzc3xsZXNzfHN0eWwpJC9pLCAnJykpLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVuZGxlTmFtZSA9IGRlZmF1bHRCdW5kbGVOYW1lO1xuICAgICAgfVxuXG4gICAgICBub3JtYWxpemVkRW50cnkgPSB7Li4uZW50cnksIGJ1bmRsZU5hbWV9O1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxpemVkRW50cnk7XG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTb3VyY2VNYXBEZXZUb29sKFxuICBzY3JpcHRzU291cmNlTWFwOiBib29sZWFuLFxuICBzdHlsZXNTb3VyY2VNYXA6IGJvb2xlYW4sXG4gIGhpZGRlblNvdXJjZU1hcCA9IGZhbHNlLFxuICBpbmxpbmVTb3VyY2VNYXAgPSBmYWxzZSxcbik6IFNvdXJjZU1hcERldlRvb2xQbHVnaW4ge1xuICBjb25zdCBpbmNsdWRlID0gW107XG4gIGlmIChzY3JpcHRzU291cmNlTWFwKSB7XG4gICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgfVxuXG4gIGlmIChzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgU291cmNlTWFwRGV2VG9vbFBsdWdpbih7XG4gICAgZmlsZW5hbWU6IGlubGluZVNvdXJjZU1hcCA/IHVuZGVmaW5lZCA6ICdbZmlsZV0ubWFwJyxcbiAgICBpbmNsdWRlLFxuICAgIGFwcGVuZDogaGlkZGVuU291cmNlTWFwID8gZmFsc2UgOiB1bmRlZmluZWQsXG4gIH0pO1xufVxuIl19