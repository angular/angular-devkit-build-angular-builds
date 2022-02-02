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
const nodePath = __importStar(require("path"));
const load_esm_1 = require("../../utils/load-esm");
function localizeExtractLoader(content, map) {
    // This loader is not cacheable due to how message extraction works.
    // Extracted messages are not part of webpack pipeline and hence they cannot be retrieved from cache.
    // TODO: We should investigate in the future on making this deterministic and more cacheable.
    this.cacheable(false);
    const options = this.getOptions();
    const callback = this.async();
    extract(this, content, map, options).then(() => {
        // Pass through the original content now that messages have been extracted
        callback(undefined, content, map);
    }, (error) => {
        callback(error);
    });
}
exports.default = localizeExtractLoader;
async function extract(loaderContext, content, map, options) {
    // Try to load the `@angular/localize` message extractor.
    // All the localize usages are setup to first try the ESM entry point then fallback to the deep imports.
    // This provides interim compatibility while the framework is transitioned to bundled ESM packages.
    let MessageExtractor;
    try {
        // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
        // Once TypeScript provides support for keeping the dynamic import this workaround can be
        // changed to a direct dynamic import.
        const localizeToolsModule = await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
        MessageExtractor = localizeToolsModule.MessageExtractor;
    }
    catch (_a) {
        throw new Error(`Unable to load message extractor. Please ensure '@angular/localize' is installed.`);
    }
    // Setup a Webpack-based logger instance
    const logger = {
        // level 2 is warnings
        level: 2,
        debug(...args) {
            // eslint-disable-next-line no-console
            console.debug(...args);
        },
        info(...args) {
            loaderContext.emitWarning(new Error(args.join('')));
        },
        warn(...args) {
            loaderContext.emitWarning(new Error(args.join('')));
        },
        error(...args) {
            loaderContext.emitError(new Error(args.join('')));
        },
    };
    let filename = loaderContext.resourcePath;
    const mapObject = typeof map === 'string' ? JSON.parse(map) : map;
    if (mapObject === null || mapObject === void 0 ? void 0 : mapObject.file) {
        // The extractor's internal sourcemap handling expects the filenames to match
        filename = nodePath.join(loaderContext.context, mapObject.file);
    }
    // Setup a virtual file system instance for the extractor
    // * MessageExtractor itself uses readFile, relative and resolve
    // * Internal SourceFileLoader (sourcemap support) uses dirname, exists, readFile, and resolve
    const filesystem = {
        readFile(path) {
            if (path === filename) {
                return content;
            }
            else if (path === filename + '.map') {
                return typeof map === 'string' ? map : JSON.stringify(map);
            }
            else {
                throw new Error('Unknown file requested: ' + path);
            }
        },
        relative(from, to) {
            return nodePath.relative(from, to);
        },
        resolve(...paths) {
            return nodePath.resolve(...paths);
        },
        exists(path) {
            return path === filename || path === filename + '.map';
        },
        dirname(path) {
            return nodePath.dirname(path);
        },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractor = new MessageExtractor(filesystem, logger, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        basePath: loaderContext.rootContext,
        useSourceMaps: !!map,
    });
    const messages = extractor.extractMessages(filename);
    if (messages.length > 0) {
        options === null || options === void 0 ? void 0 : options.messageHandler(messages);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXZ5LWV4dHJhY3QtbG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvZXh0cmFjdC1pMThuL2l2eS1leHRyYWN0LWxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwrQ0FBaUM7QUFDakMsbURBQXFEO0FBU3JELFNBQXdCLHFCQUFxQixDQUUzQyxPQUFlLEVBQ2YsR0FBb0I7SUFFcEIsb0VBQW9FO0lBQ3BFLHFHQUFxRztJQUNyRyw2RkFBNkY7SUFDN0YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUV0QixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBRTlCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQ3ZDLEdBQUcsRUFBRTtRQUNILDBFQUEwRTtRQUMxRSxRQUFRLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNwQyxDQUFDLEVBQ0QsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUNSLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNsQixDQUFDLENBQ0YsQ0FBQztBQUNKLENBQUM7QUF0QkQsd0NBc0JDO0FBRUQsS0FBSyxVQUFVLE9BQU8sQ0FDcEIsYUFBNEUsRUFDNUUsT0FBZSxFQUNmLEdBQXlDLEVBQ3pDLE9BQXFDO0lBRXJDLHlEQUF5RDtJQUN6RCx3R0FBd0c7SUFDeEcsbUdBQW1HO0lBQ25HLElBQUksZ0JBQWdCLENBQUM7SUFDckIsSUFBSTtRQUNGLHFGQUFxRjtRQUNyRix5RkFB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LFVBQWlCLEVBQUUsTUFBTSxFQUFFO1FBQ2hFLDhEQUE4RDtRQUM5RCxRQUFRLEVBQUUsYUFBYSxDQUFDLFdBQWtCO1FBQzFDLGFBQWEsRUFBRSxDQUFDLENBQUMsR0FBRztLQUNyQixDQUFDLENBQUM7SUFFSCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3JELElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDdkIsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNuQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbm9kZVBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuXG4vLyBFeHRyYWN0IGxvYWRlciBzb3VyY2UgbWFwIHBhcmFtZXRlciB0eXBlIHNpbmNlIGl0IGlzIG5vdCBleHBvcnRlZCBkaXJlY3RseVxudHlwZSBMb2FkZXJTb3VyY2VNYXAgPSBQYXJhbWV0ZXJzPGltcG9ydCgnd2VicGFjaycpLkxvYWRlckRlZmluaXRpb25GdW5jdGlvbj5bMV07XG5cbmludGVyZmFjZSBMb2NhbGl6ZUV4dHJhY3RMb2FkZXJPcHRpb25zIHtcbiAgbWVzc2FnZUhhbmRsZXI6IChtZXNzYWdlczogaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZScpLsm1UGFyc2VkTWVzc2FnZVtdKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBsb2NhbGl6ZUV4dHJhY3RMb2FkZXIoXG4gIHRoaXM6IGltcG9ydCgnd2VicGFjaycpLkxvYWRlckNvbnRleHQ8TG9jYWxpemVFeHRyYWN0TG9hZGVyT3B0aW9ucz4sXG4gIGNvbnRlbnQ6IHN0cmluZyxcbiAgbWFwOiBMb2FkZXJTb3VyY2VNYXAsXG4pIHtcbiAgLy8gVGhpcyBsb2FkZXIgaXMgbm90IGNhY2hlYWJsZSBkdWUgdG8gaG93IG1lc3NhZ2UgZXh0cmFjdGlvbiB3b3Jrcy5cbiAgLy8gRXh0cmFjdGVkIG1lc3NhZ2VzIGFyZSBub3QgcGFydCBvZiB3ZWJwYWNrIHBpcGVsaW5lIGFuZCBoZW5jZSB0aGV5IGNhbm5vdCBiZSByZXRyaWV2ZWQgZnJvbSBjYWNoZS5cbiAgLy8gVE9ETzogV2Ugc2hvdWxkIGludmVzdGlnYXRlIGluIHRoZSBmdXR1cmUgb24gbWFraW5nIHRoaXMgZGV0ZXJtaW5pc3RpYyBhbmQgbW9yZSBjYWNoZWFibGUuXG4gIHRoaXMuY2FjaGVhYmxlKGZhbHNlKTtcblxuICBjb25zdCBvcHRpb25zID0gdGhpcy5nZXRPcHRpb25zKCk7XG4gIGNvbnN0IGNhbGxiYWNrID0gdGhpcy5hc3luYygpO1xuXG4gIGV4dHJhY3QodGhpcywgY29udGVudCwgbWFwLCBvcHRpb25zKS50aGVuKFxuICAgICgpID0+IHtcbiAgICAgIC8vIFBhc3MgdGhyb3VnaCB0aGUgb3JpZ2luYWwgY29udGVudCBub3cgdGhhdCBtZXNzYWdlcyBoYXZlIGJlZW4gZXh0cmFjdGVkXG4gICAgICBjYWxsYmFjayh1bmRlZmluZWQsIGNvbnRlbnQsIG1hcCk7XG4gICAgfSxcbiAgICAoZXJyb3IpID0+IHtcbiAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9LFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBleHRyYWN0KFxuICBsb2FkZXJDb250ZXh0OiBpbXBvcnQoJ3dlYnBhY2snKS5Mb2FkZXJDb250ZXh0PExvY2FsaXplRXh0cmFjdExvYWRlck9wdGlvbnM+LFxuICBjb250ZW50OiBzdHJpbmcsXG4gIG1hcDogc3RyaW5nIHwgTG9hZGVyU291cmNlTWFwIHwgdW5kZWZpbmVkLFxuICBvcHRpb25zOiBMb2NhbGl6ZUV4dHJhY3RMb2FkZXJPcHRpb25zLFxuKSB7XG4gIC8vIFRyeSB0byBsb2FkIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIG1lc3NhZ2UgZXh0cmFjdG9yLlxuICAvLyBBbGwgdGhlIGxvY2FsaXplIHVzYWdlcyBhcmUgc2V0dXAgdG8gZmlyc3QgdHJ5IHRoZSBFU00gZW50cnkgcG9pbnQgdGhlbiBmYWxsYmFjayB0byB0aGUgZGVlcCBpbXBvcnRzLlxuICAvLyBUaGlzIHByb3ZpZGVzIGludGVyaW0gY29tcGF0aWJpbGl0eSB3aGlsZSB0aGUgZnJhbWV3b3JrIGlzIHRyYW5zaXRpb25lZCB0byBidW5kbGVkIEVTTSBwYWNrYWdlcy5cbiAgbGV0IE1lc3NhZ2VFeHRyYWN0b3I7XG4gIHRyeSB7XG4gICAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2xvY2FsaXplL3Rvb2xzYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICBjb25zdCBsb2NhbGl6ZVRvb2xzTW9kdWxlID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpPihcbiAgICAgICdAYW5ndWxhci9sb2NhbGl6ZS90b29scycsXG4gICAgKTtcbiAgICBNZXNzYWdlRXh0cmFjdG9yID0gbG9jYWxpemVUb29sc01vZHVsZS5NZXNzYWdlRXh0cmFjdG9yO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVW5hYmxlIHRvIGxvYWQgbWVzc2FnZSBleHRyYWN0b3IuIFBsZWFzZSBlbnN1cmUgJ0Bhbmd1bGFyL2xvY2FsaXplJyBpcyBpbnN0YWxsZWQuYCxcbiAgICApO1xuICB9XG5cbiAgLy8gU2V0dXAgYSBXZWJwYWNrLWJhc2VkIGxvZ2dlciBpbnN0YW5jZVxuICBjb25zdCBsb2dnZXIgPSB7XG4gICAgLy8gbGV2ZWwgMiBpcyB3YXJuaW5nc1xuICAgIGxldmVsOiAyLFxuICAgIGRlYnVnKC4uLmFyZ3M6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgY29uc29sZS5kZWJ1ZyguLi5hcmdzKTtcbiAgICB9LFxuICAgIGluZm8oLi4uYXJnczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICAgIGxvYWRlckNvbnRleHQuZW1pdFdhcm5pbmcobmV3IEVycm9yKGFyZ3Muam9pbignJykpKTtcbiAgICB9LFxuICAgIHdhcm4oLi4uYXJnczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICAgIGxvYWRlckNvbnRleHQuZW1pdFdhcm5pbmcobmV3IEVycm9yKGFyZ3Muam9pbignJykpKTtcbiAgICB9LFxuICAgIGVycm9yKC4uLmFyZ3M6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgICBsb2FkZXJDb250ZXh0LmVtaXRFcnJvcihuZXcgRXJyb3IoYXJncy5qb2luKCcnKSkpO1xuICAgIH0sXG4gIH07XG5cbiAgbGV0IGZpbGVuYW1lID0gbG9hZGVyQ29udGV4dC5yZXNvdXJjZVBhdGg7XG4gIGNvbnN0IG1hcE9iamVjdCA9XG4gICAgdHlwZW9mIG1hcCA9PT0gJ3N0cmluZycgPyAoSlNPTi5wYXJzZShtYXApIGFzIEV4Y2x1ZGU8TG9hZGVyU291cmNlTWFwLCBzdHJpbmc+KSA6IG1hcDtcbiAgaWYgKG1hcE9iamVjdD8uZmlsZSkge1xuICAgIC8vIFRoZSBleHRyYWN0b3IncyBpbnRlcm5hbCBzb3VyY2VtYXAgaGFuZGxpbmcgZXhwZWN0cyB0aGUgZmlsZW5hbWVzIHRvIG1hdGNoXG4gICAgZmlsZW5hbWUgPSBub2RlUGF0aC5qb2luKGxvYWRlckNvbnRleHQuY29udGV4dCwgbWFwT2JqZWN0LmZpbGUpO1xuICB9XG5cbiAgLy8gU2V0dXAgYSB2aXJ0dWFsIGZpbGUgc3lzdGVtIGluc3RhbmNlIGZvciB0aGUgZXh0cmFjdG9yXG4gIC8vICogTWVzc2FnZUV4dHJhY3RvciBpdHNlbGYgdXNlcyByZWFkRmlsZSwgcmVsYXRpdmUgYW5kIHJlc29sdmVcbiAgLy8gKiBJbnRlcm5hbCBTb3VyY2VGaWxlTG9hZGVyIChzb3VyY2VtYXAgc3VwcG9ydCkgdXNlcyBkaXJuYW1lLCBleGlzdHMsIHJlYWRGaWxlLCBhbmQgcmVzb2x2ZVxuICBjb25zdCBmaWxlc3lzdGVtID0ge1xuICAgIHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICBpZiAocGF0aCA9PT0gZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9IGVsc2UgaWYgKHBhdGggPT09IGZpbGVuYW1lICsgJy5tYXAnKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgbWFwID09PSAnc3RyaW5nJyA/IG1hcCA6IEpTT04uc3RyaW5naWZ5KG1hcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZmlsZSByZXF1ZXN0ZWQ6ICcgKyBwYXRoKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHJlbGF0aXZlKGZyb206IHN0cmluZywgdG86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gbm9kZVBhdGgucmVsYXRpdmUoZnJvbSwgdG8pO1xuICAgIH0sXG4gICAgcmVzb2x2ZSguLi5wYXRoczogc3RyaW5nW10pOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIG5vZGVQYXRoLnJlc29sdmUoLi4ucGF0aHMpO1xuICAgIH0sXG4gICAgZXhpc3RzKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgcmV0dXJuIHBhdGggPT09IGZpbGVuYW1lIHx8IHBhdGggPT09IGZpbGVuYW1lICsgJy5tYXAnO1xuICAgIH0sXG4gICAgZGlybmFtZShwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIG5vZGVQYXRoLmRpcm5hbWUocGF0aCk7XG4gICAgfSxcbiAgfTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBjb25zdCBleHRyYWN0b3IgPSBuZXcgTWVzc2FnZUV4dHJhY3RvcihmaWxlc3lzdGVtIGFzIGFueSwgbG9nZ2VyLCB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBiYXNlUGF0aDogbG9hZGVyQ29udGV4dC5yb290Q29udGV4dCBhcyBhbnksXG4gICAgdXNlU291cmNlTWFwczogISFtYXAsXG4gIH0pO1xuXG4gIGNvbnN0IG1lc3NhZ2VzID0gZXh0cmFjdG9yLmV4dHJhY3RNZXNzYWdlcyhmaWxlbmFtZSk7XG4gIGlmIChtZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgb3B0aW9ucz8ubWVzc2FnZUhhbmRsZXIobWVzc2FnZXMpO1xuICB9XG59XG4iXX0=