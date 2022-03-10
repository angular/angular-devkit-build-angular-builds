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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC10cmFuc2xhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9sb2FkLXRyYW5zbGF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILG1DQUFvQztBQUNwQyx1Q0FBeUI7QUFDekIseUNBQTJDO0FBVXBDLEtBQUssVUFBVSx1QkFBdUI7SUFDM0MsTUFBTSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsR0FBRyxNQUFNLGFBQWEsRUFBRSxDQUFDO0lBRXZELE9BQU8sQ0FBQyxJQUFZLEVBQUUsRUFBRTtRQUN0QixNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM5QyxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ2hDLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3RELE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2hELElBQUksUUFBUSxDQUFDLFFBQVEsRUFBRTtnQkFDckIsTUFBTSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM1RSxNQUFNLFNBQVMsR0FBRyxTQUFTLEdBQUcsSUFBQSxtQkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRXBGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLENBQUM7YUFDakU7aUJBQU07Z0JBQ0wsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7YUFDckM7U0FDRjtRQUVELE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUM5QixLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLElBQUksYUFBYSxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQ3hELFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQzdGO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FDYiwwQ0FBMEMsSUFBSSx1Q0FBdUM7WUFDbkYsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FDdEIsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUVGLG9JQUFvSTtJQUNwSSw4REFBOEQ7SUFDOUQsU0FBUyxPQUFPLENBQUMsTUFBVyxFQUFFLElBQVksRUFBRSxPQUFlO1FBQ3pELElBQUksTUFBTSxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQUU7WUFDaEMsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN0QzthQUFNO1lBQ0wsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFFNUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLEtBQUssS0FBSyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQztTQUN4RDtJQUNILENBQUM7QUFDSCxDQUFDO0FBdkNELDBEQXVDQztBQUVELEtBQUssVUFBVSxhQUFhO0lBQzFCLElBQUk7UUFDRixxRkFBcUY7UUFDckYseUZBQXlGO1FBQ3pGLHNDQUFzQztRQUN0QyxNQUFNLEVBQ0osV0FBVyxFQUNYLG9CQUFvQixFQUNwQiwyQkFBMkIsRUFDM0IsdUJBQXVCLEVBQ3ZCLHVCQUF1QixFQUN2QixvQkFBb0IsR0FDckIsR0FBRyxNQUFNLElBQUEsd0JBQWEsRUFBMkMseUJBQXlCLENBQUMsQ0FBQztRQUU3RixNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sT0FBTyxHQUFHO1lBQ2QsR0FBRyxFQUFFLElBQUksb0JBQW9CLEVBQUU7WUFDL0IsSUFBSSxFQUFFLElBQUksMkJBQTJCLEVBQUU7WUFDdkMsR0FBRyxFQUFFLElBQUksdUJBQXVCLEVBQUU7WUFDbEMsSUFBSSxFQUFFLElBQUksdUJBQXVCLEVBQUU7WUFDbkMsMERBQTBEO1lBQzFELEdBQUcsRUFBRSxJQUFJLG9CQUFvQixFQUFFO1NBQ2hDLENBQUM7UUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxDQUFDO0tBQ2pDO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQ2IsMEZBQTBGLENBQzNGLENBQUM7S0FDSDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBEaWFnbm9zdGljcyB9IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4vbG9hZC1lc20nO1xuXG5leHBvcnQgdHlwZSBUcmFuc2xhdGlvbkxvYWRlciA9IChwYXRoOiBzdHJpbmcpID0+IHtcbiAgdHJhbnNsYXRpb25zOiBSZWNvcmQ8c3RyaW5nLCBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplJykuybVQYXJzZWRUcmFuc2xhdGlvbj47XG4gIGZvcm1hdDogc3RyaW5nO1xuICBsb2NhbGU/OiBzdHJpbmc7XG4gIGRpYWdub3N0aWNzOiBEaWFnbm9zdGljcztcbiAgaW50ZWdyaXR5OiBzdHJpbmc7XG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTogUHJvbWlzZTxUcmFuc2xhdGlvbkxvYWRlcj4ge1xuICBjb25zdCB7IHBhcnNlcnMsIGRpYWdub3N0aWNzIH0gPSBhd2FpdCBpbXBvcnRQYXJzZXJzKCk7XG5cbiAgcmV0dXJuIChwYXRoOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3QgdW51c2VkUGFyc2VycyA9IG5ldyBNYXAoKTtcbiAgICBmb3IgKGNvbnN0IFtmb3JtYXQsIHBhcnNlcl0gb2YgT2JqZWN0LmVudHJpZXMocGFyc2VycykpIHtcbiAgICAgIGNvbnN0IGFuYWx5c2lzID0gYW5hbHl6ZShwYXJzZXIsIHBhdGgsIGNvbnRlbnQpO1xuICAgICAgaWYgKGFuYWx5c2lzLmNhblBhcnNlKSB7XG4gICAgICAgIGNvbnN0IHsgbG9jYWxlLCB0cmFuc2xhdGlvbnMgfSA9IHBhcnNlci5wYXJzZShwYXRoLCBjb250ZW50LCBhbmFseXNpcy5oaW50KTtcbiAgICAgICAgY29uc3QgaW50ZWdyaXR5ID0gJ3NoYTI1Ni0nICsgY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGNvbnRlbnQpLmRpZ2VzdCgnYmFzZTY0Jyk7XG5cbiAgICAgICAgcmV0dXJuIHsgZm9ybWF0LCBsb2NhbGUsIHRyYW5zbGF0aW9ucywgZGlhZ25vc3RpY3MsIGludGVncml0eSB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdW51c2VkUGFyc2Vycy5zZXQocGFyc2VyLCBhbmFseXNpcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBbcGFyc2VyLCBhbmFseXNpc10gb2YgdW51c2VkUGFyc2Vycy5lbnRyaWVzKCkpIHtcbiAgICAgIG1lc3NhZ2VzLnB1c2goYW5hbHlzaXMuZGlhZ25vc3RpY3MuZm9ybWF0RGlhZ25vc3RpY3MoYCoqKiAke3BhcnNlci5jb25zdHJ1Y3Rvci5uYW1lfSAqKipgKSk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBVbnN1cHBvcnRlZCB0cmFuc2xhdGlvbiBmaWxlIGZvcm1hdCBpbiAke3BhdGh9LiBUaGUgZm9sbG93aW5nIHBhcnNlcnMgd2VyZSB0cmllZDpcXG5gICtcbiAgICAgICAgbWVzc2FnZXMuam9pbignXFxuJyksXG4gICAgKTtcbiAgfTtcblxuICAvLyBUT0RPOiBgcGFyc2VyLmNhblBhcnNlKClgIGlzIGRlcHJlY2F0ZWQ7IHJlbW92ZSB0aGlzIHBvbHlmaWxsIG9uY2Ugd2UgYXJlIHN1cmUgYWxsIHBhcnNlcnMgcHJvdmlkZSB0aGUgYHBhcnNlci5hbmFseXplKClgIG1ldGhvZC5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgZnVuY3Rpb24gYW5hbHl6ZShwYXJzZXI6IGFueSwgcGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpIHtcbiAgICBpZiAocGFyc2VyLmFuYWx5emUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHBhcnNlci5hbmFseXplKHBhdGgsIGNvbnRlbnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBoaW50ID0gcGFyc2VyLmNhblBhcnNlKHBhdGgsIGNvbnRlbnQpO1xuXG4gICAgICByZXR1cm4geyBjYW5QYXJzZTogaGludCAhPT0gZmFsc2UsIGhpbnQsIGRpYWdub3N0aWNzIH07XG4gICAgfVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGltcG9ydFBhcnNlcnMoKSB7XG4gIHRyeSB7XG4gICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICBjb25zdCB7XG4gICAgICBEaWFnbm9zdGljcyxcbiAgICAgIEFyYlRyYW5zbGF0aW9uUGFyc2VyLFxuICAgICAgU2ltcGxlSnNvblRyYW5zbGF0aW9uUGFyc2VyLFxuICAgICAgWGxpZmYxVHJhbnNsYXRpb25QYXJzZXIsXG4gICAgICBYbGlmZjJUcmFuc2xhdGlvblBhcnNlcixcbiAgICAgIFh0YlRyYW5zbGF0aW9uUGFyc2VyLFxuICAgIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk+KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xuXG4gICAgY29uc3QgZGlhZ25vc3RpY3MgPSBuZXcgRGlhZ25vc3RpY3MoKTtcbiAgICBjb25zdCBwYXJzZXJzID0ge1xuICAgICAgYXJiOiBuZXcgQXJiVHJhbnNsYXRpb25QYXJzZXIoKSxcbiAgICAgIGpzb246IG5ldyBTaW1wbGVKc29uVHJhbnNsYXRpb25QYXJzZXIoKSxcbiAgICAgIHhsZjogbmV3IFhsaWZmMVRyYW5zbGF0aW9uUGFyc2VyKCksXG4gICAgICB4bGYyOiBuZXcgWGxpZmYyVHJhbnNsYXRpb25QYXJzZXIoKSxcbiAgICAgIC8vIFRoZSBuYW1lICgneG1iJykgbmVlZHMgdG8gbWF0Y2ggdGhlIEFPVCBjb21waWxlciBvcHRpb25cbiAgICAgIHhtYjogbmV3IFh0YlRyYW5zbGF0aW9uUGFyc2VyKCksXG4gICAgfTtcblxuICAgIHJldHVybiB7IHBhcnNlcnMsIGRpYWdub3N0aWNzIH07XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBVbmFibGUgdG8gbG9hZCB0cmFuc2xhdGlvbiBmaWxlIHBhcnNlcnMuIFBsZWFzZSBlbnN1cmUgJ0Bhbmd1bGFyL2xvY2FsaXplJyBpcyBpbnN0YWxsZWQuYCxcbiAgICApO1xuICB9XG59XG4iXX0=