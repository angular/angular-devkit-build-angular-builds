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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.createTranslationLoader = void 0;
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const load_esm_1 = require("./load-esm");
async function createTranslationLoader() {
    const { parsers, diagnostics } = await importParsers();
    return (path) => {
        const content = fs.readFileSync(path, 'utf8');
        const unusedParsers = new Map();
        for (const [format, parser] of Object.entries(parsers)) {
            const analysis = analyze(parser, path, content);
            if (analysis.canParse) {
                const { locale, translations } = parser.parse(path, content, analysis.hint);
                const integrity = 'sha256-' + (0, crypto_1.createHash)('sha256').update(content).digest('base64');
                return { format, locale, translations, diagnostics, integrity };
            }
            else {
                unusedParsers.set(parser, analysis);
            }
        }
        const messages = [];
        for (const [parser, analysis] of unusedParsers.entries()) {
            messages.push(analysis.diagnostics.formatDiagnostics(`*** ${parser.constructor.name} ***`));
        }
        throw new Error(`Unsupported translation file format in ${path}. The following parsers were tried:\n` +
            messages.join('\n'));
    };
    // TODO: `parser.canParse()` is deprecated; remove this polyfill once we are sure all parsers provide the `parser.analyze()` method.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function analyze(parser, path, content) {
        if (parser.analyze !== undefined) {
            return parser.analyze(path, content);
        }
        else {
            const hint = parser.canParse(path, content);
            return { canParse: hint !== false, hint, diagnostics };
        }
    }
}
exports.createTranslationLoader = createTranslationLoader;
async function importParsers() {
    try {
        // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
        // Once TypeScript provides support for keeping the dynamic import this workaround can be
        // changed to a direct dynamic import.
        const { Diagnostics, ArbTranslationParser, SimpleJsonTranslationParser, Xliff1TranslationParser, Xliff2TranslationParser, XtbTranslationParser, } = await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
        const diagnostics = new Diagnostics();
        const parsers = {
            arb: new ArbTranslationParser(),
            json: new SimpleJsonTranslationParser(),
            xlf: new Xliff1TranslationParser(),
            xlf2: new Xliff2TranslationParser(),
            // The name ('xmb') needs to match the AOT compiler option
            xmb: new XtbTranslationParser(),
        };
        return { parsers, diagnostics };
    }
    catch (_a) {
        throw new Error(`Unable to load translation file parsers. Please ensure '@angular/localize' is installed.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC10cmFuc2xhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9sb2FkLXRyYW5zbGF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsbUNBQW9DO0FBQ3BDLHVDQUF5QjtBQUN6Qix5Q0FBMkM7QUFVcEMsS0FBSyxVQUFVLHVCQUF1QjtJQUMzQyxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxHQUFHLE1BQU0sYUFBYSxFQUFFLENBQUM7SUFFdkQsT0FBTyxDQUFDLElBQVksRUFBRSxFQUFFO1FBQ3RCLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlDLE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7UUFDaEMsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDdEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDaEQsSUFBSSxRQUFRLENBQUMsUUFBUSxFQUFFO2dCQUNyQixNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzVFLE1BQU0sU0FBUyxHQUFHLFNBQVMsR0FBRyxJQUFBLG1CQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFFcEYsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsQ0FBQzthQUNqRTtpQkFBTTtnQkFDTCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQzthQUNyQztTQUNGO1FBRUQsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBQzlCLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxhQUFhLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDeEQsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLE9BQU8sTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUM7U0FDN0Y7UUFDRCxNQUFNLElBQUksS0FBSyxDQUNiLDBDQUEwQyxJQUFJLHVDQUF1QztZQUNuRixRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUN0QixDQUFDO0lBQ0osQ0FBQyxDQUFDO0lBRUYsb0lBQW9JO0lBQ3BJLDhEQUE4RDtJQUM5RCxTQUFTLE9BQU8sQ0FBQyxNQUFXLEVBQUUsSUFBWSxFQUFFLE9BQWU7UUFDekQsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRTtZQUNoQyxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3RDO2FBQU07WUFDTCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUU1QyxPQUFPLEVBQUUsUUFBUSxFQUFFLElBQUksS0FBSyxLQUFLLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDO1NBQ3hEO0lBQ0gsQ0FBQztBQUNILENBQUM7QUF2Q0QsMERBdUNDO0FBRUQsS0FBSyxVQUFVLGFBQWE7SUFDMUIsSUFBSTtRQUNGLHFGQUFxRjtRQUNyRix5RkFBeUY7UUFDekYsc0NBQXNDO1FBQ3RDLE1BQU0sRUFDSixXQUFXLEVBQ1gsb0JBQW9CLEVBQ3BCLDJCQUEyQixFQUMzQix1QkFBdUIsRUFDdkIsdUJBQXVCLEVBQ3ZCLG9CQUFvQixHQUNyQixHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUEyQyx5QkFBeUIsQ0FBQyxDQUFDO1FBRTdGLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7UUFDdEMsTUFBTSxPQUFPLEdBQUc7WUFDZCxHQUFHLEVBQUUsSUFBSSxvQkFBb0IsRUFBRTtZQUMvQixJQUFJLEVBQUUsSUFBSSwyQkFBMkIsRUFBRTtZQUN2QyxHQUFHLEVBQUUsSUFBSSx1QkFBdUIsRUFBRTtZQUNsQyxJQUFJLEVBQUUsSUFBSSx1QkFBdUIsRUFBRTtZQUNuQywwREFBMEQ7WUFDMUQsR0FBRyxFQUFFLElBQUksb0JBQW9CLEVBQUU7U0FDaEMsQ0FBQztRQUVGLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUM7S0FDakM7SUFBQyxXQUFNO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FDYiwwRkFBMEYsQ0FDM0YsQ0FBQztLQUNIO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IERpYWdub3N0aWNzIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi9sb2FkLWVzbSc7XG5cbmV4cG9ydCB0eXBlIFRyYW5zbGF0aW9uTG9hZGVyID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICB0cmFuc2xhdGlvbnM6IFJlY29yZDxzdHJpbmcsIGltcG9ydCgnQGFuZ3VsYXIvbG9jYWxpemUnKS7JtVBhcnNlZFRyYW5zbGF0aW9uPjtcbiAgZm9ybWF0OiBzdHJpbmc7XG4gIGxvY2FsZT86IHN0cmluZztcbiAgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzO1xuICBpbnRlZ3JpdHk6IHN0cmluZztcbn07XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlcigpOiBQcm9taXNlPFRyYW5zbGF0aW9uTG9hZGVyPiB7XG4gIGNvbnN0IHsgcGFyc2VycywgZGlhZ25vc3RpY3MgfSA9IGF3YWl0IGltcG9ydFBhcnNlcnMoKTtcblxuICByZXR1cm4gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocGF0aCwgJ3V0ZjgnKTtcbiAgICBjb25zdCB1bnVzZWRQYXJzZXJzID0gbmV3IE1hcCgpO1xuICAgIGZvciAoY29uc3QgW2Zvcm1hdCwgcGFyc2VyXSBvZiBPYmplY3QuZW50cmllcyhwYXJzZXJzKSkge1xuICAgICAgY29uc3QgYW5hbHlzaXMgPSBhbmFseXplKHBhcnNlciwgcGF0aCwgY29udGVudCk7XG4gICAgICBpZiAoYW5hbHlzaXMuY2FuUGFyc2UpIHtcbiAgICAgICAgY29uc3QgeyBsb2NhbGUsIHRyYW5zbGF0aW9ucyB9ID0gcGFyc2VyLnBhcnNlKHBhdGgsIGNvbnRlbnQsIGFuYWx5c2lzLmhpbnQpO1xuICAgICAgICBjb25zdCBpbnRlZ3JpdHkgPSAnc2hhMjU2LScgKyBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoY29udGVudCkuZGlnZXN0KCdiYXNlNjQnKTtcblxuICAgICAgICByZXR1cm4geyBmb3JtYXQsIGxvY2FsZSwgdHJhbnNsYXRpb25zLCBkaWFnbm9zdGljcywgaW50ZWdyaXR5IH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB1bnVzZWRQYXJzZXJzLnNldChwYXJzZXIsIGFuYWx5c2lzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtwYXJzZXIsIGFuYWx5c2lzXSBvZiB1bnVzZWRQYXJzZXJzLmVudHJpZXMoKSkge1xuICAgICAgbWVzc2FnZXMucHVzaChhbmFseXNpcy5kaWFnbm9zdGljcy5mb3JtYXREaWFnbm9zdGljcyhgKioqICR7cGFyc2VyLmNvbnN0cnVjdG9yLm5hbWV9ICoqKmApKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFVuc3VwcG9ydGVkIHRyYW5zbGF0aW9uIGZpbGUgZm9ybWF0IGluICR7cGF0aH0uIFRoZSBmb2xsb3dpbmcgcGFyc2VycyB3ZXJlIHRyaWVkOlxcbmAgK1xuICAgICAgICBtZXNzYWdlcy5qb2luKCdcXG4nKSxcbiAgICApO1xuICB9O1xuXG4gIC8vIFRPRE86IGBwYXJzZXIuY2FuUGFyc2UoKWAgaXMgZGVwcmVjYXRlZDsgcmVtb3ZlIHRoaXMgcG9seWZpbGwgb25jZSB3ZSBhcmUgc3VyZSBhbGwgcGFyc2VycyBwcm92aWRlIHRoZSBgcGFyc2VyLmFuYWx5emUoKWAgbWV0aG9kLlxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBmdW5jdGlvbiBhbmFseXplKHBhcnNlcjogYW55LCBwYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZykge1xuICAgIGlmIChwYXJzZXIuYW5hbHl6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gcGFyc2VyLmFuYWx5emUocGF0aCwgY29udGVudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGhpbnQgPSBwYXJzZXIuY2FuUGFyc2UocGF0aCwgY29udGVudCk7XG5cbiAgICAgIHJldHVybiB7IGNhblBhcnNlOiBoaW50ICE9PSBmYWxzZSwgaGludCwgZGlhZ25vc3RpY3MgfTtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gaW1wb3J0UGFyc2VycygpIHtcbiAgdHJ5IHtcbiAgICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHNgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgIGNvbnN0IHtcbiAgICAgIERpYWdub3N0aWNzLFxuICAgICAgQXJiVHJhbnNsYXRpb25QYXJzZXIsXG4gICAgICBTaW1wbGVKc29uVHJhbnNsYXRpb25QYXJzZXIsXG4gICAgICBYbGlmZjFUcmFuc2xhdGlvblBhcnNlcixcbiAgICAgIFhsaWZmMlRyYW5zbGF0aW9uUGFyc2VyLFxuICAgICAgWHRiVHJhbnNsYXRpb25QYXJzZXIsXG4gICAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKT4oJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk7XG5cbiAgICBjb25zdCBkaWFnbm9zdGljcyA9IG5ldyBEaWFnbm9zdGljcygpO1xuICAgIGNvbnN0IHBhcnNlcnMgPSB7XG4gICAgICBhcmI6IG5ldyBBcmJUcmFuc2xhdGlvblBhcnNlcigpLFxuICAgICAganNvbjogbmV3IFNpbXBsZUpzb25UcmFuc2xhdGlvblBhcnNlcigpLFxuICAgICAgeGxmOiBuZXcgWGxpZmYxVHJhbnNsYXRpb25QYXJzZXIoKSxcbiAgICAgIHhsZjI6IG5ldyBYbGlmZjJUcmFuc2xhdGlvblBhcnNlcigpLFxuICAgICAgLy8gVGhlIG5hbWUgKCd4bWInKSBuZWVkcyB0byBtYXRjaCB0aGUgQU9UIGNvbXBpbGVyIG9wdGlvblxuICAgICAgeG1iOiBuZXcgWHRiVHJhbnNsYXRpb25QYXJzZXIoKSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHsgcGFyc2VycywgZGlhZ25vc3RpY3MgfTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFVuYWJsZSB0byBsb2FkIHRyYW5zbGF0aW9uIGZpbGUgcGFyc2Vycy4gUGxlYXNlIGVuc3VyZSAnQGFuZ3VsYXIvbG9jYWxpemUnIGlzIGluc3RhbGxlZC5gLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==