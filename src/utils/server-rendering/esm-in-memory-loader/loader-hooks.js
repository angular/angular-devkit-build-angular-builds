"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = exports.resolve = exports.initialize = void 0;
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const url_1 = require("url");
const javascript_transformer_1 = require("../../../tools/esbuild/javascript-transformer");
const node_18_utils_1 = require("./node-18-utils");
const TRANSFORMED_FILES = {};
const CHUNKS_REGEXP = /file:\/\/\/(main\.server|chunk-\w+)\.mjs/;
let workspaceRootFile;
let outputFiles;
const javascriptTransformer = new javascript_transformer_1.JavaScriptTransformer(
// Always enable JIT linking to support applications built with and without AOT.
// In a development environment the additional scope information does not
// have a negative effect unlike production where final output size is relevant.
{ sourcemap: true, jit: true }, 1);
(0, node_18_utils_1.callInitializeIfNeeded)(initialize);
function initialize(data) {
    workspaceRootFile = (0, node_url_1.pathToFileURL)((0, node_path_1.join)(data.workspaceRoot, 'index.mjs')).href;
    outputFiles = data.outputFiles;
}
exports.initialize = initialize;
function resolve(specifier, context, nextResolve) {
    if (!isFileProtocol(specifier)) {
        const normalizedSpecifier = specifier.replace(/^\.\//, '');
        if (normalizedSpecifier in outputFiles) {
            return {
                format: 'module',
                shortCircuit: true,
                // File URLs need to absolute. In Windows these also need to include the drive.
                // The `/` will be resolved to the drive letter.
                url: (0, node_url_1.pathToFileURL)('/' + normalizedSpecifier).href,
            };
        }
    }
    // Defer to the next hook in the chain, which would be the
    // Node.js default resolve if this is the last user-specified loader.
    return nextResolve(specifier, isBundleEntryPointOrChunk(context) ? { ...context, parentURL: workspaceRootFile } : context);
}
exports.resolve = resolve;
async function load(url, context, nextLoad) {
    if (isFileProtocol(url)) {
        const filePath = (0, url_1.fileURLToPath)(url);
        // Remove '/' or drive letter for Windows that was added in the above 'resolve'.
        let source = outputFiles[(0, node_path_1.relative)('/', filePath)] ?? TRANSFORMED_FILES[filePath];
        if (source === undefined) {
            source = TRANSFORMED_FILES[filePath] = Buffer.from(await javascriptTransformer.transformFile(filePath)).toString('utf-8');
        }
        if (source !== undefined) {
            const { format } = context;
            return {
                format,
                shortCircuit: true,
                source,
            };
        }
    }
    // Let Node.js handle all other URLs.
    return nextLoad(url);
}
exports.load = load;
function isFileProtocol(url) {
    return url.startsWith('file://');
}
function handleProcessExit() {
    void javascriptTransformer.close();
}
function isBundleEntryPointOrChunk(context) {
    return !!context.parentURL && CHUNKS_REGEXP.test(context.parentURL);
}
process.once('exit', handleProcessExit);
process.once('SIGINT', handleProcessExit);
process.once('uncaughtException', handleProcessExit);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZGVyLWhvb2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9lc20taW4tbWVtb3J5LWxvYWRlci9sb2FkZXItaG9va3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgseUNBQTJDO0FBQzNDLHVDQUF5QztBQUN6Qyw2QkFBb0M7QUFDcEMsMEZBQXNGO0FBQ3RGLG1EQUF5RDtBQVl6RCxNQUFNLGlCQUFpQixHQUEyQixFQUFFLENBQUM7QUFDckQsTUFBTSxhQUFhLEdBQUcsMENBQTBDLENBQUM7QUFDakUsSUFBSSxpQkFBeUIsQ0FBQztBQUM5QixJQUFJLFdBQW1DLENBQUM7QUFFeEMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLDhDQUFxQjtBQUNyRCxnRkFBZ0Y7QUFDaEYseUVBQXlFO0FBQ3pFLGdGQUFnRjtBQUNoRixFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxFQUM5QixDQUFDLENBQ0YsQ0FBQztBQUVGLElBQUEsc0NBQXNCLEVBQUMsVUFBVSxDQUFDLENBQUM7QUFFbkMsU0FBZ0IsVUFBVSxDQUFDLElBQXFDO0lBQzlELGlCQUFpQixHQUFHLElBQUEsd0JBQWEsRUFBQyxJQUFBLGdCQUFJLEVBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUM5RSxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUNqQyxDQUFDO0FBSEQsZ0NBR0M7QUFFRCxTQUFnQixPQUFPLENBQ3JCLFNBQWlCLEVBQ2pCLE9BQTBDLEVBQzFDLFdBQXFCO0lBRXJCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDOUIsTUFBTSxtQkFBbUIsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMzRCxJQUFJLG1CQUFtQixJQUFJLFdBQVcsRUFBRTtZQUN0QyxPQUFPO2dCQUNMLE1BQU0sRUFBRSxRQUFRO2dCQUNoQixZQUFZLEVBQUUsSUFBSTtnQkFDbEIsK0VBQStFO2dCQUMvRSxnREFBZ0Q7Z0JBQ2hELEdBQUcsRUFBRSxJQUFBLHdCQUFhLEVBQUMsR0FBRyxHQUFHLG1CQUFtQixDQUFDLENBQUMsSUFBSTthQUNuRCxDQUFDO1NBQ0g7S0FDRjtJQUVELDBEQUEwRDtJQUMxRCxxRUFBcUU7SUFDckUsT0FBTyxXQUFXLENBQ2hCLFNBQVMsRUFDVCx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLE9BQU8sRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUM1RixDQUFDO0FBQ0osQ0FBQztBQXhCRCwwQkF3QkM7QUFFTSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQVcsRUFBRSxPQUFtQyxFQUFFLFFBQWtCO0lBQzdGLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZCLE1BQU0sUUFBUSxHQUFHLElBQUEsbUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQztRQUNwQyxnRkFBZ0Y7UUFDaEYsSUFBSSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUEsb0JBQVEsRUFBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVqRixJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7WUFDeEIsTUFBTSxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQ2hELE1BQU0scUJBQXFCLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUNwRCxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNyQjtRQUVELElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtZQUN4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDO1lBRTNCLE9BQU87Z0JBQ0wsTUFBTTtnQkFDTixZQUFZLEVBQUUsSUFBSTtnQkFDbEIsTUFBTTthQUNQLENBQUM7U0FDSDtLQUNGO0lBRUQscUNBQXFDO0lBQ3JDLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLENBQUM7QUF6QkQsb0JBeUJDO0FBRUQsU0FBUyxjQUFjLENBQUMsR0FBVztJQUNqQyxPQUFPLEdBQUcsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQUVELFNBQVMsaUJBQWlCO0lBQ3hCLEtBQUsscUJBQXFCLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDckMsQ0FBQztBQUVELFNBQVMseUJBQXlCLENBQUMsT0FBMEM7SUFDM0UsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN0RSxDQUFDO0FBRUQsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUN4QyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0FBQzFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgY2FsbEluaXRpYWxpemVJZk5lZWRlZCB9IGZyb20gJy4vbm9kZS0xOC11dGlscyc7XG5cbi8qKlxuICogTm9kZS5qcyBFU00gbG9hZGVyIHRvIHJlZGlyZWN0IGltcG9ydHMgdG8gaW4gbWVtb3J5IGZpbGVzLlxuICogQHNlZTogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9lc20uaHRtbCNsb2FkZXJzIGZvciBtb3JlIGluZm9ybWF0aW9uIGFib3V0IGxvYWRlcnMuXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBFU01Jbk1lbW9yeUZpbGVMb2FkZXJXb3JrZXJEYXRhIHtcbiAgb3V0cHV0RmlsZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZztcbn1cblxuY29uc3QgVFJBTlNGT1JNRURfRklMRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbmNvbnN0IENIVU5LU19SRUdFWFAgPSAvZmlsZTpcXC9cXC9cXC8obWFpblxcLnNlcnZlcnxjaHVuay1cXHcrKVxcLm1qcy87XG5sZXQgd29ya3NwYWNlUm9vdEZpbGU6IHN0cmluZztcbmxldCBvdXRwdXRGaWxlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcblxuY29uc3QgamF2YXNjcmlwdFRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgLy8gQWx3YXlzIGVuYWJsZSBKSVQgbGlua2luZyB0byBzdXBwb3J0IGFwcGxpY2F0aW9ucyBidWlsdCB3aXRoIGFuZCB3aXRob3V0IEFPVC5cbiAgLy8gSW4gYSBkZXZlbG9wbWVudCBlbnZpcm9ubWVudCB0aGUgYWRkaXRpb25hbCBzY29wZSBpbmZvcm1hdGlvbiBkb2VzIG5vdFxuICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICB7IHNvdXJjZW1hcDogdHJ1ZSwgaml0OiB0cnVlIH0sXG4gIDEsXG4pO1xuXG5jYWxsSW5pdGlhbGl6ZUlmTmVlZGVkKGluaXRpYWxpemUpO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5pdGlhbGl6ZShkYXRhOiBFU01Jbk1lbW9yeUZpbGVMb2FkZXJXb3JrZXJEYXRhKSB7XG4gIHdvcmtzcGFjZVJvb3RGaWxlID0gcGF0aFRvRmlsZVVSTChqb2luKGRhdGEud29ya3NwYWNlUm9vdCwgJ2luZGV4Lm1qcycpKS5ocmVmO1xuICBvdXRwdXRGaWxlcyA9IGRhdGEub3V0cHV0RmlsZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKFxuICBzcGVjaWZpZXI6IHN0cmluZyxcbiAgY29udGV4dDogeyBwYXJlbnRVUkw6IHVuZGVmaW5lZCB8IHN0cmluZyB9LFxuICBuZXh0UmVzb2x2ZTogRnVuY3Rpb24sXG4pIHtcbiAgaWYgKCFpc0ZpbGVQcm90b2NvbChzcGVjaWZpZXIpKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFNwZWNpZmllciA9IHNwZWNpZmllci5yZXBsYWNlKC9eXFwuXFwvLywgJycpO1xuICAgIGlmIChub3JtYWxpemVkU3BlY2lmaWVyIGluIG91dHB1dEZpbGVzKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBmb3JtYXQ6ICdtb2R1bGUnLFxuICAgICAgICBzaG9ydENpcmN1aXQ6IHRydWUsXG4gICAgICAgIC8vIEZpbGUgVVJMcyBuZWVkIHRvIGFic29sdXRlLiBJbiBXaW5kb3dzIHRoZXNlIGFsc28gbmVlZCB0byBpbmNsdWRlIHRoZSBkcml2ZS5cbiAgICAgICAgLy8gVGhlIGAvYCB3aWxsIGJlIHJlc29sdmVkIHRvIHRoZSBkcml2ZSBsZXR0ZXIuXG4gICAgICAgIHVybDogcGF0aFRvRmlsZVVSTCgnLycgKyBub3JtYWxpemVkU3BlY2lmaWVyKS5ocmVmLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvLyBEZWZlciB0byB0aGUgbmV4dCBob29rIGluIHRoZSBjaGFpbiwgd2hpY2ggd291bGQgYmUgdGhlXG4gIC8vIE5vZGUuanMgZGVmYXVsdCByZXNvbHZlIGlmIHRoaXMgaXMgdGhlIGxhc3QgdXNlci1zcGVjaWZpZWQgbG9hZGVyLlxuICByZXR1cm4gbmV4dFJlc29sdmUoXG4gICAgc3BlY2lmaWVyLFxuICAgIGlzQnVuZGxlRW50cnlQb2ludE9yQ2h1bmsoY29udGV4dCkgPyB7IC4uLmNvbnRleHQsIHBhcmVudFVSTDogd29ya3NwYWNlUm9vdEZpbGUgfSA6IGNvbnRleHQsXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkKHVybDogc3RyaW5nLCBjb250ZXh0OiB7IGZvcm1hdD86IHN0cmluZyB8IG51bGwgfSwgbmV4dExvYWQ6IEZ1bmN0aW9uKSB7XG4gIGlmIChpc0ZpbGVQcm90b2NvbCh1cmwpKSB7XG4gICAgY29uc3QgZmlsZVBhdGggPSBmaWxlVVJMVG9QYXRoKHVybCk7XG4gICAgLy8gUmVtb3ZlICcvJyBvciBkcml2ZSBsZXR0ZXIgZm9yIFdpbmRvd3MgdGhhdCB3YXMgYWRkZWQgaW4gdGhlIGFib3ZlICdyZXNvbHZlJy5cbiAgICBsZXQgc291cmNlID0gb3V0cHV0RmlsZXNbcmVsYXRpdmUoJy8nLCBmaWxlUGF0aCldID8/IFRSQU5TRk9STUVEX0ZJTEVTW2ZpbGVQYXRoXTtcblxuICAgIGlmIChzb3VyY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgc291cmNlID0gVFJBTlNGT1JNRURfRklMRVNbZmlsZVBhdGhdID0gQnVmZmVyLmZyb20oXG4gICAgICAgIGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1GaWxlKGZpbGVQYXRoKSxcbiAgICAgICkudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgfVxuXG4gICAgaWYgKHNvdXJjZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCB7IGZvcm1hdCB9ID0gY29udGV4dDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZm9ybWF0LFxuICAgICAgICBzaG9ydENpcmN1aXQ6IHRydWUsXG4gICAgICAgIHNvdXJjZSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLy8gTGV0IE5vZGUuanMgaGFuZGxlIGFsbCBvdGhlciBVUkxzLlxuICByZXR1cm4gbmV4dExvYWQodXJsKTtcbn1cblxuZnVuY3Rpb24gaXNGaWxlUHJvdG9jb2wodXJsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJyk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVByb2Nlc3NFeGl0KCk6IHZvaWQge1xuICB2b2lkIGphdmFzY3JpcHRUcmFuc2Zvcm1lci5jbG9zZSgpO1xufVxuXG5mdW5jdGlvbiBpc0J1bmRsZUVudHJ5UG9pbnRPckNodW5rKGNvbnRleHQ6IHsgcGFyZW50VVJMOiB1bmRlZmluZWQgfCBzdHJpbmcgfSk6IGJvb2xlYW4ge1xuICByZXR1cm4gISFjb250ZXh0LnBhcmVudFVSTCAmJiBDSFVOS1NfUkVHRVhQLnRlc3QoY29udGV4dC5wYXJlbnRVUkwpO1xufVxuXG5wcm9jZXNzLm9uY2UoJ2V4aXQnLCBoYW5kbGVQcm9jZXNzRXhpdCk7XG5wcm9jZXNzLm9uY2UoJ1NJR0lOVCcsIGhhbmRsZVByb2Nlc3NFeGl0KTtcbnByb2Nlc3Mub25jZSgndW5jYXVnaHRFeGNlcHRpb24nLCBoYW5kbGVQcm9jZXNzRXhpdCk7XG4iXX0=