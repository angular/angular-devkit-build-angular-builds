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
exports.postcss = void 0;
const loader_utils_1 = require("loader-utils");
const path = __importStar(require("path"));
const url = __importStar(require("url"));
const error_1 = require("../../utils/error");
function wrapUrl(url) {
    let wrappedUrl;
    const hasSingleQuotes = url.indexOf("'") >= 0;
    if (hasSingleQuotes) {
        wrappedUrl = `"${url}"`;
    }
    else {
        wrappedUrl = `'${url}'`;
    }
    return `url(${wrappedUrl})`;
}
async function resolve(file, base, resolver) {
    try {
        return await resolver('./' + file, base);
    }
    catch (_a) {
        return resolver(file, base);
    }
}
exports.postcss = true;
function default_1(options) {
    if (!options) {
        throw new Error('No options were specified to "postcss-cli-resources".');
    }
    const { deployUrl = '', resourcesOutputPath = '', filename, loader, emitFile, extracted, } = options;
    const process = async (inputUrl, context, resourceCache) => {
        // If root-relative, absolute or protocol relative url, leave as is
        if (/^((?:\w+:)?\/\/|data:|chrome:|#)/.test(inputUrl)) {
            return inputUrl;
        }
        if (/^\//.test(inputUrl)) {
            return inputUrl;
        }
        // If starts with a caret, remove and return remainder
        // this supports bypassing asset processing
        if (inputUrl.startsWith('^')) {
            return inputUrl.slice(1);
        }
        const cacheKey = path.resolve(context, inputUrl);
        const cachedUrl = resourceCache.get(cacheKey);
        if (cachedUrl) {
            return cachedUrl;
        }
        if (inputUrl.startsWith('~')) {
            inputUrl = inputUrl.slice(1);
        }
        const { pathname, hash, search } = url.parse(inputUrl.replace(/\\/g, '/'));
        const resolver = (file, base) => new Promise((resolve, reject) => {
            loader.resolve(base, decodeURI(file), (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
        const result = await resolve(pathname, context, resolver);
        return new Promise((resolve, reject) => {
            loader.fs.readFile(result, (err, content) => {
                if (err) {
                    reject(err);
                    return;
                }
                let outputPath = (0, loader_utils_1.interpolateName)({ resourcePath: result }, filename(result), {
                    content,
                    context: loader.context || loader.rootContext,
                }).replace(/\\|\//g, '-');
                if (resourcesOutputPath) {
                    outputPath = path.posix.join(resourcesOutputPath, outputPath);
                }
                loader.addDependency(result);
                if (emitFile) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    loader.emitFile(outputPath, content, undefined, { sourceFilename: result });
                }
                let outputUrl = outputPath.replace(/\\/g, '/');
                if (hash || search) {
                    outputUrl = url.format({ pathname: outputUrl, hash, search });
                }
                if (deployUrl && !extracted) {
                    outputUrl = url.resolve(deployUrl, outputUrl);
                }
                resourceCache.set(cacheKey, outputUrl);
                resolve(outputUrl);
            });
        });
    };
    const resourceCache = new Map();
    const processed = Symbol('postcss-cli-resources');
    return {
        postcssPlugin: 'postcss-cli-resources',
        async Declaration(decl) {
            if (!decl.value.includes('url') || processed in decl) {
                return;
            }
            const value = decl.value;
            const urlRegex = /url(?:\(\s*['"]?)(.*?)(?:['"]?\s*\))/g;
            const segments = [];
            let match;
            let lastIndex = 0;
            let modified = false;
            // We want to load it relative to the file that imports
            const inputFile = decl.source && decl.source.input.file;
            const context = (inputFile && path.dirname(inputFile)) || loader.context;
            // eslint-disable-next-line no-cond-assign
            while ((match = urlRegex.exec(value))) {
                const originalUrl = match[1];
                let processedUrl;
                try {
                    processedUrl = await process(originalUrl, context, resourceCache);
                }
                catch (err) {
                    (0, error_1.assertIsError)(err);
                    loader.emitError(decl.error(err.message, { word: originalUrl }));
                    continue;
                }
                if (lastIndex < match.index) {
                    segments.push(value.slice(lastIndex, match.index));
                }
                if (!processedUrl || originalUrl === processedUrl) {
                    segments.push(match[0]);
                }
                else {
                    segments.push(wrapUrl(processedUrl));
                    modified = true;
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < value.length) {
                segments.push(value.slice(lastIndex));
            }
            if (modified) {
                decl.value = segments.join('');
            }
            decl[processed] = true;
        },
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGNzcy1jbGktcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILCtDQUErQztBQUMvQywyQ0FBNkI7QUFFN0IseUNBQTJCO0FBQzNCLDZDQUFrRDtBQUVsRCxTQUFTLE9BQU8sQ0FBQyxHQUFXO0lBQzFCLElBQUksVUFBVSxDQUFDO0lBQ2YsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFOUMsSUFBSSxlQUFlLEVBQUU7UUFDbkIsVUFBVSxHQUFHLElBQUksR0FBRyxHQUFHLENBQUM7S0FDekI7U0FBTTtRQUNMLFVBQVUsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDO0tBQ3pCO0lBRUQsT0FBTyxPQUFPLFVBQVUsR0FBRyxDQUFDO0FBQzlCLENBQUM7QUFjRCxLQUFLLFVBQVUsT0FBTyxDQUNwQixJQUFZLEVBQ1osSUFBWSxFQUNaLFFBQXlEO0lBRXpELElBQUk7UUFDRixPQUFPLE1BQU0sUUFBUSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDMUM7SUFBQyxXQUFNO1FBQ04sT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQzdCO0FBQ0gsQ0FBQztBQUVZLFFBQUEsT0FBTyxHQUFHLElBQUksQ0FBQztBQUU1QixtQkFBeUIsT0FBb0M7SUFDM0QsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztLQUMxRTtJQUVELE1BQU0sRUFDSixTQUFTLEdBQUcsRUFBRSxFQUNkLG1CQUFtQixHQUFHLEVBQUUsRUFDeEIsUUFBUSxFQUNSLE1BQU0sRUFDTixRQUFRLEVBQ1IsU0FBUyxHQUNWLEdBQUcsT0FBTyxDQUFDO0lBRVosTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLFFBQWdCLEVBQUUsT0FBZSxFQUFFLGFBQWtDLEVBQUUsRUFBRTtRQUM5RixtRUFBbUU7UUFDbkUsSUFBSSxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDckQsT0FBTyxRQUFRLENBQUM7U0FDakI7UUFFRCxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDeEIsT0FBTyxRQUFRLENBQUM7U0FDakI7UUFFRCxzREFBc0Q7UUFDdEQsMkNBQTJDO1FBQzNDLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUM1QixPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDMUI7UUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNqRCxNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlDLElBQUksU0FBUyxFQUFFO1lBQ2IsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFFRCxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDNUIsUUFBUSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDOUI7UUFFRCxNQUFNLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0UsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFZLEVBQUUsSUFBWSxFQUFFLEVBQUUsQ0FDOUMsSUFBSSxPQUFPLENBQVMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDdEMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxFQUFFO2dCQUNwRCxJQUFJLEdBQUcsRUFBRTtvQkFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRVosT0FBTztpQkFDUjtnQkFDRCxPQUFPLENBQUMsTUFBZ0IsQ0FBQyxDQUFDO1lBQzVCLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFTCxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxRQUFrQixFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVwRSxPQUFPLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQzdDLE1BQU0sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRTtnQkFDMUMsSUFBSSxHQUFHLEVBQUU7b0JBQ1AsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUVaLE9BQU87aUJBQ1I7Z0JBRUQsSUFBSSxVQUFVLEdBQUcsSUFBQSw4QkFBZSxFQUFDLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDM0UsT0FBTztvQkFDUCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsV0FBVztpQkFDOUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBRTFCLElBQUksbUJBQW1CLEVBQUU7b0JBQ3ZCLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxVQUFVLENBQUMsQ0FBQztpQkFDL0Q7Z0JBRUQsTUFBTSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0IsSUFBSSxRQUFRLEVBQUU7b0JBQ1osb0VBQW9FO29CQUNwRSxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxPQUFRLEVBQUUsU0FBUyxFQUFFLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7aUJBQzlFO2dCQUVELElBQUksU0FBUyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUMvQyxJQUFJLElBQUksSUFBSSxNQUFNLEVBQUU7b0JBQ2xCLFNBQVMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztpQkFDL0Q7Z0JBRUQsSUFBSSxTQUFTLElBQUksQ0FBQyxTQUFTLEVBQUU7b0JBQzNCLFNBQVMsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztpQkFDL0M7Z0JBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3ZDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNyQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7SUFDaEQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFFbEQsT0FBTztRQUNMLGFBQWEsRUFBRSx1QkFBdUI7UUFDdEMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJO1lBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxTQUFTLElBQUksSUFBSSxFQUFFO2dCQUNwRCxPQUFPO2FBQ1I7WUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQ3pCLE1BQU0sUUFBUSxHQUFHLHVDQUF1QyxDQUFDO1lBQ3pELE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztZQUU5QixJQUFJLEtBQUssQ0FBQztZQUNWLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztZQUNsQixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7WUFFckIsdURBQXVEO1lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3hELE1BQU0sT0FBTyxHQUFHLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDO1lBRXpFLDBDQUEwQztZQUMxQyxPQUFPLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQkFDckMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixJQUFJLFlBQVksQ0FBQztnQkFDakIsSUFBSTtvQkFDRixZQUFZLEdBQUcsTUFBTSxPQUFPLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztpQkFDbkU7Z0JBQUMsT0FBTyxHQUFHLEVBQUU7b0JBQ1osSUFBQSxxQkFBYSxFQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNuQixNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ2pFLFNBQVM7aUJBQ1Y7Z0JBRUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRTtvQkFDM0IsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztpQkFDcEQ7Z0JBRUQsSUFBSSxDQUFDLFlBQVksSUFBSSxXQUFXLEtBQUssWUFBWSxFQUFFO29CQUNqRCxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUN6QjtxQkFBTTtvQkFDTCxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUNyQyxRQUFRLEdBQUcsSUFBSSxDQUFDO2lCQUNqQjtnQkFFRCxTQUFTLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2FBQzNDO1lBRUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDNUIsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7YUFDdkM7WUFFRCxJQUFJLFFBQVEsRUFBRTtnQkFDWixJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDaEM7WUFFQSxJQUErQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNyRSxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUF4SkQsNEJBd0pDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGludGVycG9sYXRlTmFtZSB9IGZyb20gJ2xvYWRlci11dGlscyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgRGVjbGFyYXRpb24sIFBsdWdpbiB9IGZyb20gJ3Bvc3Rjc3MnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuXG5mdW5jdGlvbiB3cmFwVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHdyYXBwZWRVcmw7XG4gIGNvbnN0IGhhc1NpbmdsZVF1b3RlcyA9IHVybC5pbmRleE9mKFwiJ1wiKSA+PSAwO1xuXG4gIGlmIChoYXNTaW5nbGVRdW90ZXMpIHtcbiAgICB3cmFwcGVkVXJsID0gYFwiJHt1cmx9XCJgO1xuICB9IGVsc2Uge1xuICAgIHdyYXBwZWRVcmwgPSBgJyR7dXJsfSdgO1xuICB9XG5cbiAgcmV0dXJuIGB1cmwoJHt3cmFwcGVkVXJsfSlgO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc3Rjc3NDbGlSZXNvdXJjZXNPcHRpb25zIHtcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgcmVzb3VyY2VzT3V0cHV0UGF0aD86IHN0cmluZztcbiAgcmViYXNlUm9vdFJlbGF0aXZlPzogYm9vbGVhbjtcbiAgLyoqIENTUyBpcyBleHRyYWN0ZWQgdG8gYSBgLmNzc2Agb3IgaXMgZW1iZWRkZWQgaW4gYSBgLmpzYCBmaWxlLiAqL1xuICBleHRyYWN0ZWQ/OiBib29sZWFuO1xuICBmaWxlbmFtZTogKHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiBzdHJpbmc7XG4gIGxvYWRlcjogaW1wb3J0KCd3ZWJwYWNrJykuTG9hZGVyQ29udGV4dDx1bmtub3duPjtcbiAgZW1pdEZpbGU6IGJvb2xlYW47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmUoXG4gIGZpbGU6IHN0cmluZyxcbiAgYmFzZTogc3RyaW5nLFxuICByZXNvbHZlcjogKGZpbGU6IHN0cmluZywgYmFzZTogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz4sXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCByZXNvbHZlcignLi8nICsgZmlsZSwgYmFzZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiByZXNvbHZlcihmaWxlLCBiYXNlKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgcG9zdGNzcyA9IHRydWU7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChvcHRpb25zPzogUG9zdGNzc0NsaVJlc291cmNlc09wdGlvbnMpOiBQbHVnaW4ge1xuICBpZiAoIW9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9wdGlvbnMgd2VyZSBzcGVjaWZpZWQgdG8gXCJwb3N0Y3NzLWNsaS1yZXNvdXJjZXNcIi4nKTtcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICBkZXBsb3lVcmwgPSAnJyxcbiAgICByZXNvdXJjZXNPdXRwdXRQYXRoID0gJycsXG4gICAgZmlsZW5hbWUsXG4gICAgbG9hZGVyLFxuICAgIGVtaXRGaWxlLFxuICAgIGV4dHJhY3RlZCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgcHJvY2VzcyA9IGFzeW5jIChpbnB1dFVybDogc3RyaW5nLCBjb250ZXh0OiBzdHJpbmcsIHJlc291cmNlQ2FjaGU6IE1hcDxzdHJpbmcsIHN0cmluZz4pID0+IHtcbiAgICAvLyBJZiByb290LXJlbGF0aXZlLCBhYnNvbHV0ZSBvciBwcm90b2NvbCByZWxhdGl2ZSB1cmwsIGxlYXZlIGFzIGlzXG4gICAgaWYgKC9eKCg/Olxcdys6KT9cXC9cXC98ZGF0YTp8Y2hyb21lOnwjKS8udGVzdChpbnB1dFVybCkpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybDtcbiAgICB9XG5cbiAgICBpZiAoL15cXC8vLnRlc3QoaW5wdXRVcmwpKSB7XG4gICAgICByZXR1cm4gaW5wdXRVcmw7XG4gICAgfVxuXG4gICAgLy8gSWYgc3RhcnRzIHdpdGggYSBjYXJldCwgcmVtb3ZlIGFuZCByZXR1cm4gcmVtYWluZGVyXG4gICAgLy8gdGhpcyBzdXBwb3J0cyBieXBhc3NpbmcgYXNzZXQgcHJvY2Vzc2luZ1xuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCdeJykpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybC5zbGljZSgxKTtcbiAgICB9XG5cbiAgICBjb25zdCBjYWNoZUtleSA9IHBhdGgucmVzb2x2ZShjb250ZXh0LCBpbnB1dFVybCk7XG4gICAgY29uc3QgY2FjaGVkVXJsID0gcmVzb3VyY2VDYWNoZS5nZXQoY2FjaGVLZXkpO1xuICAgIGlmIChjYWNoZWRVcmwpIHtcbiAgICAgIHJldHVybiBjYWNoZWRVcmw7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0VXJsLnN0YXJ0c1dpdGgoJ34nKSkge1xuICAgICAgaW5wdXRVcmwgPSBpbnB1dFVybC5zbGljZSgxKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHBhdGhuYW1lLCBoYXNoLCBzZWFyY2ggfSA9IHVybC5wYXJzZShpbnB1dFVybC5yZXBsYWNlKC9cXFxcL2csICcvJykpO1xuICAgIGNvbnN0IHJlc29sdmVyID0gKGZpbGU6IHN0cmluZywgYmFzZTogc3RyaW5nKSA9PlxuICAgICAgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGxvYWRlci5yZXNvbHZlKGJhc2UsIGRlY29kZVVSSShmaWxlKSwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzb2x2ZShyZXN1bHQgYXMgc3RyaW5nKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmUocGF0aG5hbWUgYXMgc3RyaW5nLCBjb250ZXh0LCByZXNvbHZlcik7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsb2FkZXIuZnMucmVhZEZpbGUocmVzdWx0LCAoZXJyLCBjb250ZW50KSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBvdXRwdXRQYXRoID0gaW50ZXJwb2xhdGVOYW1lKHsgcmVzb3VyY2VQYXRoOiByZXN1bHQgfSwgZmlsZW5hbWUocmVzdWx0KSwge1xuICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgY29udGV4dDogbG9hZGVyLmNvbnRleHQgfHwgbG9hZGVyLnJvb3RDb250ZXh0LFxuICAgICAgICB9KS5yZXBsYWNlKC9cXFxcfFxcLy9nLCAnLScpO1xuXG4gICAgICAgIGlmIChyZXNvdXJjZXNPdXRwdXRQYXRoKSB7XG4gICAgICAgICAgb3V0cHV0UGF0aCA9IHBhdGgucG9zaXguam9pbihyZXNvdXJjZXNPdXRwdXRQYXRoLCBvdXRwdXRQYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvYWRlci5hZGREZXBlbmRlbmN5KHJlc3VsdCk7XG4gICAgICAgIGlmIChlbWl0RmlsZSkge1xuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICAgICAgbG9hZGVyLmVtaXRGaWxlKG91dHB1dFBhdGgsIGNvbnRlbnQhLCB1bmRlZmluZWQsIHsgc291cmNlRmlsZW5hbWU6IHJlc3VsdCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBvdXRwdXRVcmwgPSBvdXRwdXRQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgICAgaWYgKGhhc2ggfHwgc2VhcmNoKSB7XG4gICAgICAgICAgb3V0cHV0VXJsID0gdXJsLmZvcm1hdCh7IHBhdGhuYW1lOiBvdXRwdXRVcmwsIGhhc2gsIHNlYXJjaCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXBsb3lVcmwgJiYgIWV4dHJhY3RlZCkge1xuICAgICAgICAgIG91dHB1dFVybCA9IHVybC5yZXNvbHZlKGRlcGxveVVybCwgb3V0cHV0VXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc291cmNlQ2FjaGUuc2V0KGNhY2hlS2V5LCBvdXRwdXRVcmwpO1xuICAgICAgICByZXNvbHZlKG91dHB1dFVybCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCByZXNvdXJjZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgY29uc3QgcHJvY2Vzc2VkID0gU3ltYm9sKCdwb3N0Y3NzLWNsaS1yZXNvdXJjZXMnKTtcblxuICByZXR1cm4ge1xuICAgIHBvc3Rjc3NQbHVnaW46ICdwb3N0Y3NzLWNsaS1yZXNvdXJjZXMnLFxuICAgIGFzeW5jIERlY2xhcmF0aW9uKGRlY2wpIHtcbiAgICAgIGlmICghZGVjbC52YWx1ZS5pbmNsdWRlcygndXJsJykgfHwgcHJvY2Vzc2VkIGluIGRlY2wpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB2YWx1ZSA9IGRlY2wudmFsdWU7XG4gICAgICBjb25zdCB1cmxSZWdleCA9IC91cmwoPzpcXChcXHMqWydcIl0/KSguKj8pKD86WydcIl0/XFxzKlxcKSkvZztcbiAgICAgIGNvbnN0IHNlZ21lbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBsZXQgbWF0Y2g7XG4gICAgICBsZXQgbGFzdEluZGV4ID0gMDtcbiAgICAgIGxldCBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgICAvLyBXZSB3YW50IHRvIGxvYWQgaXQgcmVsYXRpdmUgdG8gdGhlIGZpbGUgdGhhdCBpbXBvcnRzXG4gICAgICBjb25zdCBpbnB1dEZpbGUgPSBkZWNsLnNvdXJjZSAmJiBkZWNsLnNvdXJjZS5pbnB1dC5maWxlO1xuICAgICAgY29uc3QgY29udGV4dCA9IChpbnB1dEZpbGUgJiYgcGF0aC5kaXJuYW1lKGlucHV0RmlsZSkpIHx8IGxvYWRlci5jb250ZXh0O1xuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uZC1hc3NpZ25cbiAgICAgIHdoaWxlICgobWF0Y2ggPSB1cmxSZWdleC5leGVjKHZhbHVlKSkpIHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxVcmwgPSBtYXRjaFsxXTtcbiAgICAgICAgbGV0IHByb2Nlc3NlZFVybDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBwcm9jZXNzZWRVcmwgPSBhd2FpdCBwcm9jZXNzKG9yaWdpbmFsVXJsLCBjb250ZXh0LCByZXNvdXJjZUNhY2hlKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuICAgICAgICAgIGxvYWRlci5lbWl0RXJyb3IoZGVjbC5lcnJvcihlcnIubWVzc2FnZSwgeyB3b3JkOiBvcmlnaW5hbFVybCB9KSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFzdEluZGV4IDwgbWF0Y2guaW5kZXgpIHtcbiAgICAgICAgICBzZWdtZW50cy5wdXNoKHZhbHVlLnNsaWNlKGxhc3RJbmRleCwgbWF0Y2guaW5kZXgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghcHJvY2Vzc2VkVXJsIHx8IG9yaWdpbmFsVXJsID09PSBwcm9jZXNzZWRVcmwpIHtcbiAgICAgICAgICBzZWdtZW50cy5wdXNoKG1hdGNoWzBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWdtZW50cy5wdXNoKHdyYXBVcmwocHJvY2Vzc2VkVXJsKSk7XG4gICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdEluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChsYXN0SW5kZXggPCB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgc2VnbWVudHMucHVzaCh2YWx1ZS5zbGljZShsYXN0SW5kZXgpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1vZGlmaWVkKSB7XG4gICAgICAgIGRlY2wudmFsdWUgPSBzZWdtZW50cy5qb2luKCcnKTtcbiAgICAgIH1cblxuICAgICAgKGRlY2wgYXMgRGVjbGFyYXRpb24gJiB7IFtwcm9jZXNzZWRdOiBib29sZWFuIH0pW3Byb2Nlc3NlZF0gPSB0cnVlO1xuICAgIH0sXG4gIH07XG59XG4iXX0=