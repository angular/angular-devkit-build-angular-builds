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
exports.ParallelCompilation = void 0;
const node_module_1 = require("node:module");
const node_worker_threads_1 = require("node:worker_threads");
const piscina_1 = __importDefault(require("piscina"));
const angular_compilation_1 = require("./angular-compilation");
/**
 * An Angular compilation which uses a Node.js Worker thread to load and execute
 * the TypeScript and Angular compilers. This allows for longer synchronous actions
 * such as semantic and template diagnostics to be calculated in parallel to the
 * other aspects of the application bundling process. The worker thread also has
 * a separate memory pool which significantly reduces the need for adjusting the
 * main Node.js CLI process memory settings with large application code sizes.
 */
class ParallelCompilation extends angular_compilation_1.AngularCompilation {
    jit;
    #worker;
    constructor(jit) {
        super();
        this.jit = jit;
        // TODO: Convert to import.meta usage during ESM transition
        const localRequire = (0, node_module_1.createRequire)(__filename);
        this.#worker = new piscina_1.default({
            minThreads: 1,
            maxThreads: 1,
            idleTimeout: Infinity,
            filename: localRequire.resolve('./parallel-worker'),
        });
    }
    initialize(tsconfig, hostOptions, compilerOptionsTransformer) {
        const stylesheetChannel = new node_worker_threads_1.MessageChannel();
        // The request identifier is required because Angular can issue multiple concurrent requests
        stylesheetChannel.port1.on('message', ({ requestId, data, containingFile, stylesheetFile }) => {
            hostOptions
                .transformStylesheet(data, containingFile, stylesheetFile)
                .then((value) => stylesheetChannel.port1.postMessage({ requestId, value }))
                .catch((error) => stylesheetChannel.port1.postMessage({ requestId, error }));
        });
        // The web worker processing is a synchronous operation and uses shared memory combined with
        // the Atomics API to block execution here until a response is received.
        const webWorkerChannel = new node_worker_threads_1.MessageChannel();
        const webWorkerSignal = new Int32Array(new SharedArrayBuffer(4));
        webWorkerChannel.port1.on('message', ({ workerFile, containingFile }) => {
            try {
                const workerCodeFile = hostOptions.processWebWorker(workerFile, containingFile);
                webWorkerChannel.port1.postMessage({ workerCodeFile });
            }
            catch (error) {
                webWorkerChannel.port1.postMessage({ error });
            }
            finally {
                Atomics.store(webWorkerSignal, 0, 1);
                Atomics.notify(webWorkerSignal, 0);
            }
        });
        // The compiler options transformation is a synchronous operation and uses shared memory combined
        // with the Atomics API to block execution here until a response is received.
        const optionsChannel = new node_worker_threads_1.MessageChannel();
        const optionsSignal = new Int32Array(new SharedArrayBuffer(4));
        optionsChannel.port1.on('message', (compilerOptions) => {
            try {
                const transformedOptions = compilerOptionsTransformer?.(compilerOptions) ?? compilerOptions;
                optionsChannel.port1.postMessage({ transformedOptions });
            }
            catch (error) {
                webWorkerChannel.port1.postMessage({ error });
            }
            finally {
                Atomics.store(optionsSignal, 0, 1);
                Atomics.notify(optionsSignal, 0);
            }
        });
        // Execute the initialize function in the worker thread
        return this.#worker.run({
            fileReplacements: hostOptions.fileReplacements,
            tsconfig,
            jit: this.jit,
            stylesheetPort: stylesheetChannel.port2,
            optionsPort: optionsChannel.port2,
            optionsSignal,
            webWorkerPort: webWorkerChannel.port2,
            webWorkerSignal,
        }, {
            name: 'initialize',
            transferList: [stylesheetChannel.port2, optionsChannel.port2, webWorkerChannel.port2],
        });
    }
    /**
     * This is not needed with this compilation type since the worker will already send a response
     * with the serializable esbuild compatible diagnostics.
     */
    collectDiagnostics() {
        throw new Error('Not implemented in ParallelCompilation.');
    }
    diagnoseFiles() {
        return this.#worker.run(undefined, { name: 'diagnose' });
    }
    emitAffectedFiles() {
        return this.#worker.run(undefined, { name: 'emit' });
    }
    update(files) {
        return this.#worker.run(files, { name: 'update' });
    }
    close() {
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        this.#worker.options.minThreads = 0;
        return this.#worker.destroy();
    }
}
exports.ParallelCompilation = ParallelCompilation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyYWxsZWwtY29tcGlsYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FuZ3VsYXIvY29tcGlsYXRpb24vcGFyYWxsZWwtY29tcGlsYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBSUgsNkNBQTRDO0FBQzVDLDZEQUFxRDtBQUNyRCxzREFBOEI7QUFHOUIsK0RBQTJFO0FBRTNFOzs7Ozs7O0dBT0c7QUFDSCxNQUFhLG1CQUFvQixTQUFRLHdDQUFrQjtJQUdwQztJQUZaLE9BQU8sQ0FBVTtJQUUxQixZQUFxQixHQUFZO1FBQy9CLEtBQUssRUFBRSxDQUFDO1FBRFcsUUFBRyxHQUFILEdBQUcsQ0FBUztRQUcvQiwyREFBMkQ7UUFDM0QsTUFBTSxZQUFZLEdBQUcsSUFBQSwyQkFBYSxFQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRS9DLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1lBQ3pCLFVBQVUsRUFBRSxDQUFDO1lBQ2IsVUFBVSxFQUFFLENBQUM7WUFDYixXQUFXLEVBQUUsUUFBUTtZQUNyQixRQUFRLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQztTQUNwRCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRVEsVUFBVSxDQUNqQixRQUFnQixFQUNoQixXQUErQixFQUMvQiwwQkFFYTtRQU1iLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxvQ0FBYyxFQUFFLENBQUM7UUFDL0MsNEZBQTRGO1FBQzVGLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsRUFBRSxFQUFFO1lBQzVGLFdBQVc7aUJB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QUssRUFBRSxjQUFjLENBQUMsS0FBSyxFQUFFLGdCQUFnQixDQUFDLEtBQUssQ0FBQztTQUN0RixDQUNGLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ2dCLGtCQUFrQjtRQUNuQyxNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVRLGFBQWE7UUFDcEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRVEsaUJBQWlCO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVRLE1BQU0sQ0FBQyxLQUFrQjtRQUNoQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFUSxLQUFLO1FBQ1osb0dBQW9HO1FBQ3BHLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFFcEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2hDLENBQUM7Q0FDRjtBQWxIRCxrREFrSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlck9wdGlvbnMgfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHR5cGUgeyBQYXJ0aWFsTWVzc2FnZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCB7IE1lc3NhZ2VDaGFubmVsIH0gZnJvbSAnbm9kZTp3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB0eXBlIHsgU291cmNlRmlsZSB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHR5cGUgeyBBbmd1bGFySG9zdE9wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgQW5ndWxhckNvbXBpbGF0aW9uLCBFbWl0RmlsZVJlc3VsdCB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5cbi8qKlxuICogQW4gQW5ndWxhciBjb21waWxhdGlvbiB3aGljaCB1c2VzIGEgTm9kZS5qcyBXb3JrZXIgdGhyZWFkIHRvIGxvYWQgYW5kIGV4ZWN1dGVcbiAqIHRoZSBUeXBlU2NyaXB0IGFuZCBBbmd1bGFyIGNvbXBpbGVycy4gVGhpcyBhbGxvd3MgZm9yIGxvbmdlciBzeW5jaHJvbm91cyBhY3Rpb25zXG4gKiBzdWNoIGFzIHNlbWFudGljIGFuZCB0ZW1wbGF0ZSBkaWFnbm9zdGljcyB0byBiZSBjYWxjdWxhdGVkIGluIHBhcmFsbGVsIHRvIHRoZVxuICogb3RoZXIgYXNwZWN0cyBvZiB0aGUgYXBwbGljYXRpb24gYnVuZGxpbmcgcHJvY2Vzcy4gVGhlIHdvcmtlciB0aHJlYWQgYWxzbyBoYXNcbiAqIGEgc2VwYXJhdGUgbWVtb3J5IHBvb2wgd2hpY2ggc2lnbmlmaWNhbnRseSByZWR1Y2VzIHRoZSBuZWVkIGZvciBhZGp1c3RpbmcgdGhlXG4gKiBtYWluIE5vZGUuanMgQ0xJIHByb2Nlc3MgbWVtb3J5IHNldHRpbmdzIHdpdGggbGFyZ2UgYXBwbGljYXRpb24gY29kZSBzaXplcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhcmFsbGVsQ29tcGlsYXRpb24gZXh0ZW5kcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICByZWFkb25seSAjd29ya2VyOiBQaXNjaW5hO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGppdDogYm9vbGVhbikge1xuICAgIHN1cGVyKCk7XG5cbiAgICAvLyBUT0RPOiBDb252ZXJ0IHRvIGltcG9ydC5tZXRhIHVzYWdlIGR1cmluZyBFU00gdHJhbnNpdGlvblxuICAgIGNvbnN0IGxvY2FsUmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUoX19maWxlbmFtZSk7XG5cbiAgICB0aGlzLiN3b3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgICBtaW5UaHJlYWRzOiAxLFxuICAgICAgbWF4VGhyZWFkczogMSxcbiAgICAgIGlkbGVUaW1lb3V0OiBJbmZpbml0eSxcbiAgICAgIGZpbGVuYW1lOiBsb2NhbFJlcXVpcmUucmVzb2x2ZSgnLi9wYXJhbGxlbC13b3JrZXInKSxcbiAgICB9KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGluaXRpYWxpemUoXG4gICAgdHNjb25maWc6IHN0cmluZyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPzpcbiAgICAgIHwgKChjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucykgPT4gQ29tcGlsZXJPcHRpb25zKVxuICAgICAgfCB1bmRlZmluZWQsXG4gICk6IFByb21pc2U8e1xuICAgIGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PFNvdXJjZUZpbGU+O1xuICAgIGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zO1xuICAgIHJlZmVyZW5jZWRGaWxlczogcmVhZG9ubHkgc3RyaW5nW107XG4gIH0+IHtcbiAgICBjb25zdCBzdHlsZXNoZWV0Q2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgIC8vIFRoZSByZXF1ZXN0IGlkZW50aWZpZXIgaXMgcmVxdWlyZWQgYmVjYXVzZSBBbmd1bGFyIGNhbiBpc3N1ZSBtdWx0aXBsZSBjb25jdXJyZW50IHJlcXVlc3RzXG4gICAgc3R5bGVzaGVldENoYW5uZWwucG9ydDEub24oJ21lc3NhZ2UnLCAoeyByZXF1ZXN0SWQsIGRhdGEsIGNvbnRhaW5pbmdGaWxlLCBzdHlsZXNoZWV0RmlsZSB9KSA9PiB7XG4gICAgICBob3N0T3B0aW9uc1xuICAgICAgICAudHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpXG4gICAgICAgIC50aGVuKCh2YWx1ZSkgPT4gc3R5bGVzaGVldENoYW5uZWwucG9ydDEucG9zdE1lc3NhZ2UoeyByZXF1ZXN0SWQsIHZhbHVlIH0pKVxuICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiBzdHlsZXNoZWV0Q2hhbm5lbC5wb3J0MS5wb3N0TWVzc2FnZSh7IHJlcXVlc3RJZCwgZXJyb3IgfSkpO1xuICAgIH0pO1xuXG4gICAgLy8gVGhlIHdlYiB3b3JrZXIgcHJvY2Vzc2luZyBpcyBhIHN5bmNocm9ub3VzIG9wZXJhdGlvbiBhbmQgdXNlcyBzaGFyZWQgbWVtb3J5IGNvbWJpbmVkIHdpdGhcbiAgICAvLyB0aGUgQXRvbWljcyBBUEkgdG8gYmxvY2sgZXhlY3V0aW9uIGhlcmUgdW50aWwgYSByZXNwb25zZSBpcyByZWNlaXZlZC5cbiAgICBjb25zdCB3ZWJXb3JrZXJDaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgY29uc3Qgd2ViV29ya2VyU2lnbmFsID0gbmV3IEludDMyQXJyYXkobmV3IFNoYXJlZEFycmF5QnVmZmVyKDQpKTtcbiAgICB3ZWJXb3JrZXJDaGFubmVsLnBvcnQxLm9uKCdtZXNzYWdlJywgKHsgd29ya2VyRmlsZSwgY29udGFpbmluZ0ZpbGUgfSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgd29ya2VyQ29kZUZpbGUgPSBob3N0T3B0aW9ucy5wcm9jZXNzV2ViV29ya2VyKHdvcmtlckZpbGUsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICAgICAgd2ViV29ya2VyQ2hhbm5lbC5wb3J0MS5wb3N0TWVzc2FnZSh7IHdvcmtlckNvZGVGaWxlIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgd2ViV29ya2VyQ2hhbm5lbC5wb3J0MS5wb3N0TWVzc2FnZSh7IGVycm9yIH0pO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgQXRvbWljcy5zdG9yZSh3ZWJXb3JrZXJTaWduYWwsIDAsIDEpO1xuICAgICAgICBBdG9taWNzLm5vdGlmeSh3ZWJXb3JrZXJTaWduYWwsIDApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVGhlIGNvbXBpbGVyIG9wdGlvbnMgdHJhbnNmb3JtYXRpb24gaXMgYSBzeW5jaHJvbm91cyBvcGVyYXRpb24gYW5kIHVzZXMgc2hhcmVkIG1lbW9yeSBjb21iaW5lZFxuICAgIC8vIHdpdGggdGhlIEF0b21pY3MgQVBJIHRvIGJsb2NrIGV4ZWN1dGlvbiBoZXJlIHVudGlsIGEgcmVzcG9uc2UgaXMgcmVjZWl2ZWQuXG4gICAgY29uc3Qgb3B0aW9uc0NoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICBjb25zdCBvcHRpb25zU2lnbmFsID0gbmV3IEludDMyQXJyYXkobmV3IFNoYXJlZEFycmF5QnVmZmVyKDQpKTtcbiAgICBvcHRpb25zQ2hhbm5lbC5wb3J0MS5vbignbWVzc2FnZScsIChjb21waWxlck9wdGlvbnMpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybWVkT3B0aW9ucyA9IGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPy4oY29tcGlsZXJPcHRpb25zKSA/PyBjb21waWxlck9wdGlvbnM7XG4gICAgICAgIG9wdGlvbnNDaGFubmVsLnBvcnQxLnBvc3RNZXNzYWdlKHsgdHJhbnNmb3JtZWRPcHRpb25zIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgd2ViV29ya2VyQ2hhbm5lbC5wb3J0MS5wb3N0TWVzc2FnZSh7IGVycm9yIH0pO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgQXRvbWljcy5zdG9yZShvcHRpb25zU2lnbmFsLCAwLCAxKTtcbiAgICAgICAgQXRvbWljcy5ub3RpZnkob3B0aW9uc1NpZ25hbCwgMCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBFeGVjdXRlIHRoZSBpbml0aWFsaXplIGZ1bmN0aW9uIGluIHRoZSB3b3JrZXIgdGhyZWFkXG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlci5ydW4oXG4gICAgICB7XG4gICAgICAgIGZpbGVSZXBsYWNlbWVudHM6IGhvc3RPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgIHRzY29uZmlnLFxuICAgICAgICBqaXQ6IHRoaXMuaml0LFxuICAgICAgICBzdHlsZXNoZWV0UG9ydDogc3R5bGVzaGVldENoYW5uZWwucG9ydDIsXG4gICAgICAgIG9wdGlvbnNQb3J0OiBvcHRpb25zQ2hhbm5lbC5wb3J0MixcbiAgICAgICAgb3B0aW9uc1NpZ25hbCxcbiAgICAgICAgd2ViV29ya2VyUG9ydDogd2ViV29ya2VyQ2hhbm5lbC5wb3J0MixcbiAgICAgICAgd2ViV29ya2VyU2lnbmFsLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ2luaXRpYWxpemUnLFxuICAgICAgICB0cmFuc2Zlckxpc3Q6IFtzdHlsZXNoZWV0Q2hhbm5lbC5wb3J0Miwgb3B0aW9uc0NoYW5uZWwucG9ydDIsIHdlYldvcmtlckNoYW5uZWwucG9ydDJdLFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgaXMgbm90IG5lZWRlZCB3aXRoIHRoaXMgY29tcGlsYXRpb24gdHlwZSBzaW5jZSB0aGUgd29ya2VyIHdpbGwgYWxyZWFkeSBzZW5kIGEgcmVzcG9uc2VcbiAgICogd2l0aCB0aGUgc2VyaWFsaXphYmxlIGVzYnVpbGQgY29tcGF0aWJsZSBkaWFnbm9zdGljcy5cbiAgICovXG4gIHByb3RlY3RlZCBvdmVycmlkZSBjb2xsZWN0RGlhZ25vc3RpY3MoKTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkIGluIFBhcmFsbGVsQ29tcGlsYXRpb24uJyk7XG4gIH1cblxuICBvdmVycmlkZSBkaWFnbm9zZUZpbGVzKCk6IFByb21pc2U8eyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdOyB3YXJuaW5ncz86IFBhcnRpYWxNZXNzYWdlW10gfT4ge1xuICAgIHJldHVybiB0aGlzLiN3b3JrZXIucnVuKHVuZGVmaW5lZCwgeyBuYW1lOiAnZGlhZ25vc2UnIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgZW1pdEFmZmVjdGVkRmlsZXMoKTogUHJvbWlzZTxJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4+IHtcbiAgICByZXR1cm4gdGhpcy4jd29ya2VyLnJ1bih1bmRlZmluZWQsIHsgbmFtZTogJ2VtaXQnIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgdXBkYXRlKGZpbGVzOiBTZXQ8c3RyaW5nPik6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLiN3b3JrZXIucnVuKGZpbGVzLCB7IG5hbWU6ICd1cGRhdGUnIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2xvc2UoKSB7XG4gICAgLy8gV29ya2Fyb3VuZCBwaXNjaW5hIGJ1ZyB3aGVyZSBhIHdvcmtlciB0aHJlYWQgd2lsbCBiZSByZWNyZWF0ZWQgYWZ0ZXIgZGVzdHJveSB0byBtZWV0IHRoZSBtaW5pbXVtLlxuICAgIHRoaXMuI3dvcmtlci5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuXG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlci5kZXN0cm95KCk7XG4gIH1cbn1cbiJdfQ==