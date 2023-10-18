"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = exports.emit = exports.diagnose = exports.initialize = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = require("node:crypto");
const node_worker_threads_1 = require("node:worker_threads");
const source_file_cache_1 = require("../source-file-cache");
const aot_compilation_1 = require("./aot-compilation");
const jit_compilation_1 = require("./jit-compilation");
let compilation;
const sourceFileCache = new source_file_cache_1.SourceFileCache();
async function initialize(request) {
    compilation ??= request.jit ? new jit_compilation_1.JitCompilation() : new aot_compilation_1.AotCompilation();
    const stylesheetRequests = new Map();
    request.stylesheetPort.on('message', ({ requestId, value, error }) => {
        if (error) {
            stylesheetRequests.get(requestId)?.[1](error);
        }
        else {
            stylesheetRequests.get(requestId)?.[0](value);
        }
    });
    const { compilerOptions, referencedFiles } = await compilation.initialize(request.tsconfig, {
        fileReplacements: request.fileReplacements,
        sourceFileCache,
        modifiedFiles: sourceFileCache.modifiedFiles,
        transformStylesheet(data, containingFile, stylesheetFile) {
            const requestId = (0, node_crypto_1.randomUUID)();
            const resultPromise = new Promise((resolve, reject) => stylesheetRequests.set(requestId, [resolve, reject]));
            request.stylesheetPort.postMessage({
                requestId,
                data,
                containingFile,
                stylesheetFile,
            });
            return resultPromise;
        },
        processWebWorker(workerFile, containingFile) {
            Atomics.store(request.webWorkerSignal, 0, 0);
            request.webWorkerPort.postMessage({ workerFile, containingFile });
            Atomics.wait(request.webWorkerSignal, 0, 0);
            const result = (0, node_worker_threads_1.receiveMessageOnPort)(request.webWorkerPort)?.message;
            if (result?.error) {
                throw result.error;
            }
            return result?.workerCodeFile ?? workerFile;
        },
    }, (compilerOptions) => {
        Atomics.store(request.optionsSignal, 0, 0);
        request.optionsPort.postMessage(compilerOptions);
        Atomics.wait(request.optionsSignal, 0, 0);
        const result = (0, node_worker_threads_1.receiveMessageOnPort)(request.optionsPort)?.message;
        if (result?.error) {
            throw result.error;
        }
        return result?.transformedOptions ?? compilerOptions;
    });
    return {
        referencedFiles,
        // TODO: Expand? `allowJs` is the only field needed currently.
        compilerOptions: { allowJs: compilerOptions.allowJs },
    };
}
exports.initialize = initialize;
async function diagnose() {
    (0, node_assert_1.default)(compilation);
    const diagnostics = await compilation.diagnoseFiles();
    return diagnostics;
}
exports.diagnose = diagnose;
async function emit() {
    (0, node_assert_1.default)(compilation);
    const files = await compilation.emitAffectedFiles();
    return [...files];
}
exports.emit = emit;
function update(files) {
    sourceFileCache.invalidate(files);
}
exports.update = update;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyYWxsZWwtd29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGF0aW9uL3BhcmFsbGVsLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCw4REFBaUM7QUFDakMsNkNBQXlDO0FBQ3pDLDZEQUE2RTtBQUM3RSw0REFBdUQ7QUFFdkQsdURBQW1EO0FBQ25ELHVEQUFtRDtBQWFuRCxJQUFJLFdBQTJDLENBQUM7QUFFaEQsTUFBTSxlQUFlLEdBQUcsSUFBSSxtQ0FBZSxFQUFFLENBQUM7QUFFdkMsS0FBSyxVQUFVLFVBQVUsQ0FBQyxPQUFvQjtJQUNuRCxXQUFXLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxnQ0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksZ0NBQWMsRUFBRSxDQUFDO0lBRTFFLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQThELENBQUM7SUFDakcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7UUFDbkUsSUFBSSxLQUFLLEVBQUU7WUFDVCxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMvQzthQUFNO1lBQ0wsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDL0M7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFF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LENBQUMsS0FBa0I7SUFDdkMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBRkQsd0JBRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHsgdHlwZSBNZXNzYWdlUG9ydCwgcmVjZWl2ZU1lc3NhZ2VPblBvcnQgfSBmcm9tICdub2RlOndvcmtlcl90aHJlYWRzJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSB9IGZyb20gJy4uL3NvdXJjZS1maWxlLWNhY2hlJztcbmltcG9ydCB0eXBlIHsgQW5ndWxhckNvbXBpbGF0aW9uIH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IEFvdENvbXBpbGF0aW9uIH0gZnJvbSAnLi9hb3QtY29tcGlsYXRpb24nO1xuaW1wb3J0IHsgSml0Q29tcGlsYXRpb24gfSBmcm9tICcuL2ppdC1jb21waWxhdGlvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5pdFJlcXVlc3Qge1xuICBqaXQ6IGJvb2xlYW47XG4gIHRzY29uZmlnOiBzdHJpbmc7XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzdHlsZXNoZWV0UG9ydDogTWVzc2FnZVBvcnQ7XG4gIG9wdGlvbnNQb3J0OiBNZXNzYWdlUG9ydDtcbiAgb3B0aW9uc1NpZ25hbDogSW50MzJBcnJheTtcbiAgd2ViV29ya2VyUG9ydDogTWVzc2FnZVBvcnQ7XG4gIHdlYldvcmtlclNpZ25hbDogSW50MzJBcnJheTtcbn1cblxubGV0IGNvbXBpbGF0aW9uOiBBbmd1bGFyQ29tcGlsYXRpb24gfCB1bmRlZmluZWQ7XG5cbmNvbnN0IHNvdXJjZUZpbGVDYWNoZSA9IG5ldyBTb3VyY2VGaWxlQ2FjaGUoKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUocmVxdWVzdDogSW5pdFJlcXVlc3QpIHtcbiAgY29tcGlsYXRpb24gPz89IHJlcXVlc3Quaml0ID8gbmV3IEppdENvbXBpbGF0aW9uKCkgOiBuZXcgQW90Q29tcGlsYXRpb24oKTtcblxuICBjb25zdCBzdHlsZXNoZWV0UmVxdWVzdHMgPSBuZXcgTWFwPHN0cmluZywgWyh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkLCAocmVhc29uOiBFcnJvcikgPT4gdm9pZF0+KCk7XG4gIHJlcXVlc3Quc3R5bGVzaGVldFBvcnQub24oJ21lc3NhZ2UnLCAoeyByZXF1ZXN0SWQsIHZhbHVlLCBlcnJvciB9KSA9PiB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBzdHlsZXNoZWV0UmVxdWVzdHMuZ2V0KHJlcXVlc3RJZCk/LlsxXShlcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlc2hlZXRSZXF1ZXN0cy5nZXQocmVxdWVzdElkKT8uWzBdKHZhbHVlKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IHsgY29tcGlsZXJPcHRpb25zLCByZWZlcmVuY2VkRmlsZXMgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUoXG4gICAgcmVxdWVzdC50c2NvbmZpZyxcbiAgICB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzOiByZXF1ZXN0LmZpbGVSZXBsYWNlbWVudHMsXG4gICAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICAgICBtb2RpZmllZEZpbGVzOiBzb3VyY2VGaWxlQ2FjaGUubW9kaWZpZWRGaWxlcyxcbiAgICAgIHRyYW5zZm9ybVN0eWxlc2hlZXQoZGF0YSwgY29udGFpbmluZ0ZpbGUsIHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IHJhbmRvbVVVSUQoKTtcbiAgICAgICAgY29uc3QgcmVzdWx0UHJvbWlzZSA9IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgICAgICBzdHlsZXNoZWV0UmVxdWVzdHMuc2V0KHJlcXVlc3RJZCwgW3Jlc29sdmUsIHJlamVjdF0pLFxuICAgICAgICApO1xuXG4gICAgICAgIHJlcXVlc3Quc3R5bGVzaGVldFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICBkYXRhLFxuICAgICAgICAgIGNvbnRhaW5pbmdGaWxlLFxuICAgICAgICAgIHN0eWxlc2hlZXRGaWxlLFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0UHJvbWlzZTtcbiAgICAgIH0sXG4gICAgICBwcm9jZXNzV2ViV29ya2VyKHdvcmtlckZpbGUsIGNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICAgIEF0b21pY3Muc3RvcmUocmVxdWVzdC53ZWJXb3JrZXJTaWduYWwsIDAsIDApO1xuICAgICAgICByZXF1ZXN0LndlYldvcmtlclBvcnQucG9zdE1lc3NhZ2UoeyB3b3JrZXJGaWxlLCBjb250YWluaW5nRmlsZSB9KTtcblxuICAgICAgICBBdG9taWNzLndhaXQocmVxdWVzdC53ZWJXb3JrZXJTaWduYWwsIDAsIDApO1xuICAgICAgICBjb25zdCByZXN1bHQgPSByZWNlaXZlTWVzc2FnZU9uUG9ydChyZXF1ZXN0LndlYldvcmtlclBvcnQpPy5tZXNzYWdlO1xuXG4gICAgICAgIGlmIChyZXN1bHQ/LmVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgcmVzdWx0LmVycm9yO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdD8ud29ya2VyQ29kZUZpbGUgPz8gd29ya2VyRmlsZTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICAoY29tcGlsZXJPcHRpb25zKSA9PiB7XG4gICAgICBBdG9taWNzLnN0b3JlKHJlcXVlc3Qub3B0aW9uc1NpZ25hbCwgMCwgMCk7XG4gICAgICByZXF1ZXN0Lm9wdGlvbnNQb3J0LnBvc3RNZXNzYWdlKGNvbXBpbGVyT3B0aW9ucyk7XG5cbiAgICAgIEF0b21pY3Mud2FpdChyZXF1ZXN0Lm9wdGlvbnNTaWduYWwsIDAsIDApO1xuICAgICAgY29uc3QgcmVzdWx0ID0gcmVjZWl2ZU1lc3NhZ2VPblBvcnQocmVxdWVzdC5vcHRpb25zUG9ydCk/Lm1lc3NhZ2U7XG5cbiAgICAgIGlmIChyZXN1bHQ/LmVycm9yKSB7XG4gICAgICAgIHRocm93IHJlc3VsdC5lcnJvcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdD8udHJhbnNmb3JtZWRPcHRpb25zID8/IGNvbXBpbGVyT3B0aW9ucztcbiAgICB9LFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgcmVmZXJlbmNlZEZpbGVzLFxuICAgIC8vIFRPRE86IEV4cGFuZD8gYGFsbG93SnNgIGlzIHRoZSBvbmx5IGZpZWxkIG5lZWRlZCBjdXJyZW50bHkuXG4gICAgY29tcGlsZXJPcHRpb25zOiB7IGFsbG93SnM6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzIH0sXG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkaWFnbm9zZSgpIHtcbiAgYXNzZXJ0KGNvbXBpbGF0aW9uKTtcblxuICBjb25zdCBkaWFnbm9zdGljcyA9IGF3YWl0IGNvbXBpbGF0aW9uLmRpYWdub3NlRmlsZXMoKTtcblxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbWl0KCkge1xuICBhc3NlcnQoY29tcGlsYXRpb24pO1xuXG4gIGNvbnN0IGZpbGVzID0gYXdhaXQgY29tcGlsYXRpb24uZW1pdEFmZmVjdGVkRmlsZXMoKTtcblxuICByZXR1cm4gWy4uLmZpbGVzXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZShmaWxlczogU2V0PHN0cmluZz4pOiB2b2lkIHtcbiAgc291cmNlRmlsZUNhY2hlLmludmFsaWRhdGUoZmlsZXMpO1xufVxuIl19